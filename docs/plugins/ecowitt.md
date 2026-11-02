---
id: ecowitt
title: Ecowitt weather stations
sidebar_label: Ecowitt
sidebar_position: 11
---

# Ecowitt weather stations (`hc-ecowitt`)

The Ecowitt plugin brings Ecowitt weather station gateways and consoles into
homeCore. Sensors are discovered from the gateway's own data, so you don't
list them by hand.

## How it hears the gateway

There are two ways, and you can use either or both:

| Mode | When to use |
|---|---|
| **Upload receiver** (primary) | The gateway sends its readings to the plugin (an HTTP POST) on its own upload interval. No polling load, and readings arrive as soon as the gateway sends them. |
| **Polling** (optional) | The plugin asks the gateway's `/get_livedata_info` endpoint for readings. Use it when the gateway can't reach the plugin but the plugin can reach the gateway, or when you would rather not run a listener at all. |

Both publish the same device ids, attribute names and units, so an automation
doesn't depend on which one you use.

## Supported sensors

Every sensor in the gateway's data is registered the first time it is seen:
the outdoor station, the indoor sensor, rain gauges (tipping bucket and
piezo), WH31 thermo-hygrometers, WN34 probes, soil moisture and soil EC, leaf
wetness, leak detectors, water level, PM2.5, CO2 and lightning. Sensors with
several channels, such as eight WH31 probes, become one device per channel.

## Names and units

Readings follow homeCore's shared device vocabulary and are converted inside
the plugin whatever the gateway's display is set to: **°C, hPa, m/s, mm, km,
W/m²**. There is no unit setting. Showing °F or inches is the app's job. A
value the gateway cannot read (`--`) is left out instead of being published
as 0. Device ids start with `device_prefix`, which defaults to `ecowitt`.

| Device id | Attributes |
|---|---|
| `{prefix}_weather` | `temperature`, `humidity`, `dewpoint`, `windchill`, `feels_like`, `heat_index` (°C / %), `pressure` (relative), `pressure_absolute` (hPa), `wind_speed`, `wind_speed_avg10m`, `wind_gust`, `wind_gust_daily_max` (m/s), `wind_direction`, `wind_direction_avg10m` (°), `solar_radiation` (W/m²), `uvi`, `vpd` (kPa), `datetime` |
| `{prefix}_indoor` | `temperature`, `humidity` |
| `{prefix}_rain`, `{prefix}_piezo_rain` | `rain_rate_mm_hr` (mm/h), `rain_event_mm`, `rain_hourly_mm`, `rain_24h_mm`, `rain_daily_mm`, `rain_weekly_mm`, `rain_monthly_mm`, `rain_yearly_mm`, `rain_total_mm`; the piezo gauge also `raining` |
| `{prefix}_temp_{n}` (WH31) | `temperature`, `humidity` |
| `{prefix}_tf_{n}` (WN34 probe) | `temperature` |
| `{prefix}_soil_{n}` (WH51) | `soil_moisture_pct`, `soil_moisture_raw` |
| `{prefix}_ec_{n}` (WH52) | `temperature`, `soil_moisture_pct`, `ec` (µS/cm) |
| `{prefix}_leaf_{n}` | `leaf_wetness_pct` |
| `{prefix}_leak_{n}` | `water_detected` |
| `{prefix}_lds_{n}` (WH54) | `air_gap_mm`, `depth_mm` |
| `{prefix}_pm25_{n}` | `pm25`, `pm25_24h`, `pm25_aqi`, `pm25_24h_aqi` (µg/m³) |
| `{prefix}_co2` | `co2`, `co2_24h` (ppm), `pm25`, `pm10`, …, `temperature`, `humidity` |
| `{prefix}_lightning` | `distance_km`, `strike_count`, `last_strike` |

Each device also carries the battery attributes below. Nothing is writable,
since Ecowitt gateways only report.

## Battery fields

Ecowitt sensors don't report a uniform battery percentage. What the value
means depends on the sensor family, so the plugin classifies each one and
publishes only what it really is:

| field            | type    | when                                       |
| ---------------- | ------- | ------------------------------------------ |
| `battery_pct`    | f64 %   | a level sensor (0..=5 or 0..=6), converted |
| `voltage`        | f64 V   | a sensor that reports its cell voltage     |
| `battery_low`    | bool    | whenever classified, true when low         |
| `battery_kind`   | string  | `"binary"`, `"voltage"`, or `"level"`      |
| `battery_raw`    | f64     | a value whose scale is unknown             |

A 0/1 flag publishes only `battery_low`, where `1` means "replace me" (it
doesn't mean 1 %). Automations should trigger on `battery_low`.

The classification follows Ecowitt's family-by-family spec, cross-checked
against [`aioecowitt`](https://github.com/home-assistant-libs/aioecowitt):

| kind                   | raw range | low when     | sensors                                                |
| ---------------------- | --------- | ------------ | ------------------------------------------------------ |
| **binary**             | 0 or 1    | `>= 1`       | WH25, WH26, WH65, WH31 (`batt1..8`), PM2.5 ch 5 to 8   |
| **voltage** (AA-class) | volts     | `< 1.2`      | WH40, WH68, WH51 soil, WN34 soil temp, WN35 leaf, LDS  |
| **voltage** (supercap) | volts     | `< 2.4`      | WH80, WH85, WH90, WS90                                 |
| **level** (0..=5)      | 0 to 5    | `<= 1`       | WH57 lightning, PM2.5 ch 1 to 4, leak detectors        |
| **level** (0..=6)      | 0 to 6    | `<= 1`       | WH45 / CO2 5-in-1                                      |

The poll (`get_livedata_info`) doesn't always name the sensor model in its
outdoor and rain blocks. Those publish `battery_raw` and leave out
`battery_low` and `battery_kind` instead of guessing.

## Setup

1. Install it from **Settings › Plugins › Add** and open its
   **Configuration** tab. homeCore records the install itself, so there is no
   `[[plugins]]` block to write. It owns the plugin's config file
   (`config/plugins/plugin.ecowitt.toml`) and restarts the plugin when the
   file changes.

2. **Let the gateway reach the receiver.** `bind_addr` defaults to
   `127.0.0.1`, so out of the box the plugin only accepts uploads from its own
   host. A gateway is a separate box on your network, so unless you change
   this its uploads are dropped. Nothing reports an error: the gateway sees no
   failure, the plugin sees no request, and the sensors never update.

   ```toml
   [ecowitt]
   bind_addr = "0.0.0.0"
   allowed_source_ips = ["10.0.0.42"]   # the gateway's IP
   ```

   The loopback default is deliberate. Ecowitt's upload protocol has no real
   authentication (the PASSKEY is just the gateway's MAC address, sent in
   cleartext), so an open `0.0.0.0` listener would let any host on your
   network forge weather readings. `allowed_source_ips` restores that
   protection. Give the gateway a fixed DHCP lease so the entry stays
   correct.

   If you'd rather have no listener at all, set `gateway_ip` and the plugin
   polls the gateway instead (every `poll_interval_secs`, 60 by default),
   leaving `bind_addr` on loopback.

3. **Point the gateway's uploads at the plugin.** In the Ecowitt app, open
   the gateway's *Customized* upload settings:

   | Field | Value |
   |---|---|
   | Protocol | `Ecowitt` |
   | Server IP | The IP of the host running `hc-ecowitt` |
   | Path | `/data/report/` |
   | Port | `8888` (or the `listen_port` you configured) |
   | Upload interval | `60` seconds |

   Save and enable it. Sensors appear as devices within one upload interval.

   You can skip this step: run `set_custom_server` from the plugin's Actions,
   or **Point its uploads here** on its page, and the plugin writes its own
   address into the gateway's settings.

Other settings: `manual_hosts` lists gateway addresses to probe directly
during discovery, and `gateway_password` is the gateway's web login, needed
for changing settings on firmware that puts writes behind a password.

### In a container

A Docker **bridge** network breaks two of the three paths. Gateway discovery
is a UDP broadcast to `255.255.255.255:45000`, which a bridge does not
forward. The upload port is inbound, and `compose.yml` does not publish
`8888`, so `bind_addr = "0.0.0.0"` alone is not enough there (it would be on
bare metal). Use host networking, or set `gateway_ip` and let the plugin poll
over ordinary outbound HTTP.

## Its screens

These come with the plugin:

- **Its page** (Settings › Plugins › Ecowitt) shows whether the gateway is
  reporting and where its uploads go. If they go to a port the plugin isn't
  listening on, it says so, and **Point its uploads here** fixes it. It also
  shows the weather now, every sensor with its reading, its battery in the
  right terms for its kind and when it was last heard, **What the gateway
  hears** (each paired sensor's signal), and the plugin's settings.
- **The weather station's panel** (tap it anywhere) shows the weather now
  (outside, the wind on a compass, rain, sky and air), the last day of
  temperature, wind and pressure, and the other sensors on the gateway.
- **The weather station's card** on Home and in the rooms shows temperature,
  humidity, wind and today's rain. At the large size it adds a wind compass,
  UV and pressure.
- **Weather now** is a card you add yourself (Edit → Add a card). It gives the
  weather at a glance with the pressure trend, and at the large size also UV,
  lightning and sensors with low batteries.

## Plugin actions

These appear in the web UI and through `hc-mcp`, and they talk to the
gateway's own HTTP endpoints:

- `discover_gateways`: a UDP broadcast, plus an HTTP probe of each of
  `manual_hosts`
- `refresh_sensors`: the gateway's live sensor list, with signal levels and
  battery values
- `republish_devices`: describe every sensor to homeCore again on the next
  report
- `get_gateway_info`: firmware version, MAC address, model
- `get_network`, `get_units`, `get_calibration`, `refresh_iot_devices`: the
  gateway's network settings, display units, calibration offsets, and
  connected Ecowitt IoT devices
- `get_custom_server`: the gateway's current upload settings
- `set_custom_server` (admin): point the gateway's uploads at the plugin.
  The server address and port are filled in for you.
- `reboot_gateway` (admin)

The target gateway is taken from the action's `host` when given, otherwise
from the gateway found by the last discovery, then `gateway_ip`, then
discovery.

## Notices

The plugin reports problems as notices on its page. Each clears when the
condition stops being true.

| Code | Means |
|---|---|
| `receiver_unreachable` | Bound to loopback with no poller configured, so nothing can reach it (the silent failure described in Setup). |
| `no_reports_received` | Listening, but no gateway has ever uploaded. |
| `gateway_silent` | Reports were arriving and then stopped. |

## Network considerations

`discover_gateways` sends a `CMD_BROADCAST` UDP probe to
`255.255.255.255:45000`. On a host with several network interfaces, this goes
out the default broadcast interface, which may not be the network your
gateways are on. There are two fixes:

1. **Pin a broadcast route** to the IoT interface. The
   [Sonos discovery notes](sonos#multicast-routing-on-multi-nic-hosts) show
   the technique with different addresses.
2. **List `manual_hosts`** with the gateway addresses. The plugin probes them
   with HTTP `GET /get_device_info?` whenever discovery runs, bypassing UDP
   entirely.

## For developers

`hc-ecowitt` is built on `plugin-sdk-rs` and supports the full management
protocol: heartbeat, remote configuration, changing the log level while it
runs, and forwarding logs over MQTT. Its capability manifest lists every
action available to automations and `hc-mcp`.
