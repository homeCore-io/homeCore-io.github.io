---
id: ecowitt
title: Ecowitt weather stations
sidebar_label: Ecowitt
sidebar_position: 11
---

# Ecowitt (`hc-ecowitt`)

This plugin brings an Ecowitt weather station into homeCore through its
gateway or console (GW1100, GW2000 and similar). It learns the sensors from
the gateway's own data, so you never list them by hand. Every sensor becomes
a read-only homeCore device, and the gateway itself becomes one more device
that shows its firmware, network and upload settings.

## Before you start

You need an Ecowitt gateway or console on your network and the Ecowitt app
to set it up. No Ecowitt account or cloud connection is involved: the
plugin only talks to the gateway on your network.

The plugin can hear the gateway in two ways, and you can use both.

| Mode | How it works | Use it when |
|---|---|---|
| Upload receiver | The gateway sends each reading to the plugin over HTTP (a POST to `/data/report/`) on its own upload interval. | The gateway can reach the host that runs the plugin. This is the usual setup. |
| Polling | The plugin asks the gateway's `/get_livedata_info` page for readings on a timer. | The gateway can't reach the plugin, or you don't want to open a port. |

Both modes publish the same device ids, attribute names and units, so your
automations work either way.

The receiver listens on TCP port 8888 by default. Gateway discovery uses a
UDP broadcast to port 45000.

## Install and set up

1. Install Ecowitt from **Settings › Plugins › Catalog**. Its settings are
   on its page under **Settings › Plugins › Ecowitt**. homeCore keeps the
   plugin's config file (`config/plugins/plugin.ecowitt.toml`) and restarts
   the plugin when you save.

2. Let the gateway reach the receiver. **Bind address** starts as
   `127.0.0.1`, so the plugin only accepts uploads sent from its own host.
   The gateway is a separate box, so its uploads are dropped, and neither
   side reports an error. To receive uploads, open the listener and limit it
   to the gateway's address:

   ```toml
   [ecowitt]
   bind_addr = "0.0.0.0"
   allowed_source_ips = ["192.168.1.42"]   # the gateway's IP
   ```

   The loopback default is deliberate, since Ecowitt's upload protocol has no
   real authentication. Its PASSKEY is the gateway's MAC address, sent in clear
   text, so an open listener would let any host on your network send fake
   weather. **Accept readings from** closes that gap. Give the gateway a
   fixed DHCP lease so the entry stays right. Entries that aren't valid IP
   addresses are logged and ignored.

   If you would rather not run a listener, set **Console address**
   (`gateway_ip`) and the plugin polls the gateway instead.

3. Point the gateway's uploads at the plugin. The quickest way is
   **Point its uploads here** on the plugin's page, or the
   `set_custom_server` action. Both fill in this host's address as the
   gateway sees it and the listen port. To do it by hand, open the
   gateway's **Customized** upload settings in the Ecowitt app:

   | Field | Value |
   |---|---|
   | Protocol | `Ecowitt` |
   | Server IP | the IP of the host running the plugin |
   | Path | `/data/report/` |
   | Port | `8888`, or your **Listen port** |
   | Upload interval | `60` seconds |

   Save and turn it on. Sensors appear as devices after the next upload.

4. Give each sensor a name and a room under **Sensors** on the plugin's
   page.

### In a container

A Docker bridge network breaks two of the three paths. A bridge does not
forward the discovery broadcast to `255.255.255.255:45000`, and the shipped
`compose.yml` does not publish port 8888, so `bind_addr = "0.0.0.0"` alone
won't let uploads in. Use host networking, publish the port yourself, or set
`gateway_ip` and let the plugin poll over ordinary outbound HTTP.

## Settings

| Setting | Key | Default | What it does |
|---|---|---|---|
| Bind address | `ecowitt.bind_addr` | `127.0.0.1` | Address the upload receiver listens on. A value that won't parse falls back to `127.0.0.1`. |
| Listen port | `ecowitt.listen_port` | `8888` | Port the receiver listens on. It must match the port in the gateway's upload settings. |
| Accept readings from | `ecowitt.allowed_source_ips` | empty | Gateway IPs allowed to post readings. Empty accepts any source. |
| Console address | `ecowitt.gateway_ip` | empty | Set it and the plugin polls the gateway. Empty means uploads only. |
| Poll every | `ecowitt.poll_interval_secs` | `60` | Seconds between polls. Sensors report about once a minute, so polling faster mostly reads the same values again. |
| Also probe these hosts | `ecowitt.manual_hosts` | empty | Gateway addresses that discovery checks over HTTP. Use it for a gateway on another subnet, since the UDP broadcast doesn't cross VLANs. |
| Username | `ecowitt.gateway_username` | `admin` | The gateway's web login name. Most firmware ignores it and checks only the password. |
| Password | `ecowitt.gateway_password` | empty | The gateway's web password. Only needed to change gateway settings on firmware that asks for one. Reading never needs it. |
| Device ID prefix | `ecowitt.device_prefix` | `ecowitt` | Starts every device id. Changing it renames every device and breaks rules that use the old ids, so set it once. |
| Sensors | `devices` | | A name and a room for each sensor the gateway has reported. |

The **Logging** section (level, how much to forward to homeCore, rotation
and pruning) works the same as in every plugin.

## Devices

The plugin registers each sensor the first time the gateway reports it.
Sensors with several channels, such as eight WH31 thermo-hygrometers, become
one device per channel, with `{n}` as the channel number.

The plugin converts every reading to homeCore's shared units, whatever the
gateway's display is set to: °C, %, hPa, m/s, mm, km and W/m². There is no
unit setting. The app shows each person their own units. A value the
gateway can't read (`--`) is left out instead of being published as 0.

| Device id | Type | Attributes |
|---|---|---|
| `{prefix}_weather` | `weather_station` | `temperature`, `humidity`, `dewpoint`, `windchill`, `feels_like`, `heat_index` (°C, %), `pressure` (relative), `pressure_absolute` (hPa), `wind_speed`, `wind_speed_avg10m`, `wind_gust`, `wind_gust_daily_max` (m/s), `wind_direction`, `wind_direction_avg10m` (degrees), `solar_radiation` (W/m²), `uvi`, `vpd` (kPa), `datetime` |
| `{prefix}_indoor` | `temperature_sensor` | `temperature`, `humidity` |
| `{prefix}_rain`, `{prefix}_piezo_rain` | `rain_sensor` | `rain_rate_mm_hr` (mm/h), `rain_event_mm`, `rain_hourly_mm`, `rain_24h_mm`, `rain_daily_mm`, `rain_weekly_mm`, `rain_monthly_mm`, `rain_yearly_mm`, `rain_total_mm` (mm). The piezo gauge also has `raining` (true or false). |
| `{prefix}_temp_{n}` (WH31) | `temperature_sensor` | `temperature`, `humidity` |
| `{prefix}_tf_{n}` (WN34 probe) | `temperature_sensor` | `temperature` |
| `{prefix}_soil_{n}` (WH51) | `soil_sensor` | `soil_moisture_pct`, `soil_moisture_raw` |
| `{prefix}_ec_{n}` (WH52) | `ec_sensor` | `temperature`, `soil_moisture_pct`, `ec` (µS/cm) |
| `{prefix}_leaf_{n}` (WN35) | `leaf_sensor` | `leaf_wetness_pct` |
| `{prefix}_leak_{n}` | `leak_sensor` | `water_detected` (true or false) |
| `{prefix}_lds_{n}` (WH54) | `level_sensor` | `air_gap_mm`, `depth_mm` |
| `{prefix}_pm25_{n}` | `air_quality_sensor` | `pm25`, `pm25_24h` (µg/m³). When polled, also `pm25_aqi` and `pm25_24h_aqi`. |
| `{prefix}_co2` (WH45) | `air_quality_sensor` | `co2`, `co2_24h` (ppm), `pm25`, `pm10`, `pm1`, `pm4` and their 24 hour averages (µg/m³), `temperature`, `humidity` |
| `{prefix}_lightning` (WH57) | `lightning_sensor` | `distance_km`, `strike_count`, `last_strike` |
| `{prefix}_gw_{mac}` | `gateway` | The gateway itself: `ip`, `mac`, `gateway_time`, `timezone`, `ntp_server`, `update_available`, display units (`units.*`), Wi-Fi details (`network.ssid`, `network.ip` and so on) and upload settings (`customserver.*`). Its model and firmware go in the device details. |

The plugin reads the gateway device every 5 minutes. It never publishes the
gateway's Wi-Fi password.

Nothing is writable. Ecowitt sensors only report, so the plugin accepts no
device commands.

### Battery readings

Ecowitt sensors don't share one battery scale. The plugin works out which
kind each sensor uses and publishes only what the value really is:

| Attribute | Type | Published when |
|---|---|---|
| `battery_pct` | number, % | the sensor reports a level (0 to 5 or 0 to 6), converted to a percentage |
| `voltage` | number, V | the sensor reports its cell voltage |
| `battery_low` | true or false | the kind is known; true when low |
| `battery_kind` | text | the kind is known: `binary`, `voltage` or `level` |
| `battery_raw` | number | the value's scale is unknown |

| Kind | Raw value | Low when | Sensors |
|---|---|---|---|
| binary | 0 or 1 | 1 | WH25, WH26, WH65, WH31, PM2.5 channels 5 to 8 |
| voltage, AA cell | volts | below 1.2 V | WH40, WH68, WH51, WN34, WN35, WH54 |
| voltage, supercap | volts | below 2.4 V | WH80, WH85, WH90, WS90 |
| level 0 to 5 | 0 to 5 | 1 or less | WH57, PM2.5 channels 1 to 4, leak detectors |
| level 0 to 6 | 0 to 6 | 1 or less | WH45 (CO2) |

A binary sensor publishes only `battery_low`, because its `1` means
"replace me", not 1 %. Build automations on `battery_low`. When polling, the
gateway doesn't always say which model sits behind the outdoor and rain
readings, so those publish `battery_raw` alone. homeCore's own low battery
alerts read these attributes; see [Battery monitoring](../devices/battery-monitoring).

## Actions

These run from the plugin's page, from automations and through `hc-mcp`.
They talk to the gateway's own web pages. Each one takes an optional `host`;
without it the plugin uses the gateway found by the last discovery, then
**Console address**, then a fresh discovery.

| Action | Who can run it | Timeout | What it does |
|---|---|---|---|
| `discover_gateways` | any user | 30 s | Sends a UDP broadcast to port 45000, listens for about 3 seconds, and probes each of **Also probe these hosts** over HTTP. Lists each gateway's MAC, IP, model and firmware. |
| `republish_devices` | any user | 10 s | Describes every sensor to homeCore again on the next report. Use it when a device has lost its readings or controls. |
| `refresh_sensors` | any user | 20 s | The gateway's paired sensors with signal and battery. |
| `get_gateway_info` | any user | 20 s | Firmware, MAC and model. |
| `get_network` | any user | 20 s | The gateway's network settings. |
| `get_units` | any user | 20 s | The gateway's display units. |
| `get_calibration` | any user | 20 s | Calibration offsets. |
| `refresh_iot_devices` | any user | 20 s | Ecowitt IoT devices connected to the gateway. |
| `get_custom_server` | any user | 20 s | The gateway's current upload settings. |
| `set_custom_server` | admin | 60 s | Points the gateway's uploads at the plugin. It finds this host's address as the gateway sees it and fills in the listen port, path `/data/report/`, a 60 second interval and the Ecowitt protocol. You can override any of them. The gateway's minimum interval is 16 seconds. |
| `reboot_gateway` | admin | 30 s | Restarts the gateway. Uploads stop for about 30 seconds. |

## Alerts

The plugin raises no alerts of its own. Low batteries come from homeCore's
battery alerts, which read `battery_low` and `battery_pct`.

It does show notices on its page when it isn't getting data. Each clears by
itself once readings arrive.

| Notice | Level | Raised when |
|---|---|---|
| `receiver_unreachable` | warning | At startup, when the receiver is bound to loopback and **Console address** is empty, so no gateway can reach it. |
| `no_reports_received` | error | No data has arrived since the plugin started: no upload, and no poll that returned readings. The plugin checks every 5 minutes. When polling, the notice names the address it polls. |
| `gateway_silent` | warning | Data was arriving, by upload or poll, and none has come for 10 minutes. When polling, the wait is three poll intervals if that is longer, and the notice names the polled address. |

## Screens and cards

The plugin ships these screens:

- Its page (**Settings › Plugins › Ecowitt**) shows whether the gateway is
  reporting and where its uploads go. If they go to a port the plugin isn't
  listening on, it says so, and **Point its uploads here** fixes it. It also
  shows the weather now, every sensor with its reading, battery and when it
  was last heard, **What the gateway hears** (each paired sensor's signal),
  and the settings.
- The weather station's panel, opened from the station anywhere in the app,
  shows the weather now (outside, wind on a compass, rain, sky and air),
  the last day of temperature, wind and pressure, and the other sensors.
- The weather station's card on Home and in rooms shows temperature,
  humidity, wind and today's rain. The large size adds a wind compass, UV
  and pressure.
- **Weather now** is a card you add yourself (Edit, then Add a card). It
  shows the weather at a glance with the pressure trend. The large size
  adds UV, lightning and sensors with low batteries.

## Troubleshooting

If sensors never appear, check the notices on the plugin's page first. The
usual cause is the loopback default described in step 2. If the receiver is
open, check that the gateway's upload settings name this host, the right
port and path `/data/report/`, and that no firewall blocks the port. Run
`get_custom_server` to see what the gateway has.

If readings stop, `gateway_silent` appears after 10 minutes, or after three
missed polls with a long poll interval. Check that the gateway has power and
still uploads to this host. When polling, check that it answers at its
**Console address**; the plugin's log says why each poll failed. If the
gateway's IP changed and **Accept readings from** still lists the old
address, its uploads are rejected.

On a host with several network interfaces, `discover_gateways` sends its
broadcast out of the default interface, which may not face the gateways. Add
a host route for `255.255.255.255` through the right interface, or list the
gateways in **Also probe these hosts** so discovery skips the broadcast and
asks them over HTTP (`GET /get_device_info`).

A failed poll is logged as a warning and retried on the next interval. When
homeCore stops the plugin, it marks its devices offline before it exits.

## Known limits

- The AQI readings for PM2.5 come only from polling. Uploads don't carry
  them.
- The gateway's display units (`units.*`) are published as the gateway's raw
  codes.
- The plugin doesn't use Ecowitt's cloud, and the receiver reads only the
  Ecowitt upload protocol.
