---
id: isy
title: ISY / IoX
sidebar_label: ISY / IoX
sidebar_position: 9
---

# ISY / IoX (`hc-isy`)

hc-isy connects a Universal Devices ISY/IoX controller (ISY994i, eisy or Polisy) to HomeCore. It reads the controller's devices and scenes over the ISY REST API and follows changes on its WebSocket event stream, so the Insteon and Z-Wave devices the controller runs show up as HomeCore devices. You don't list devices by hand.

## Prerequisites

- An ISY994i, eisy or Polisy controller on your LAN
- Firmware 4.2.3 or later, for the WebSocket event stream
- The controller's address, and the username and password of an account that can use its REST interface (the ISY Admin Console login)

## Configuration

Install the plugin from the web UI (**Plugins → Add**), then open its **Configuration** tab and set the controller's host, port and credentials. homeCore owns the config file (`config/plugins/plugin.isy.toml` under homeCore's home directory) and restarts the plugin when it changes.

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.isy"
password    = ""

[isy]
host     = "192.168.1.x"   # ISY hub IP address
port     = 80              # 443 with tls = true
username = "admin"
password = ""              # your ISY admin password
tls      = false            # set true if ISY has HTTPS enabled
```

`port` defaults to 80 and `tls` to false. With `tls = true` the plugin uses HTTPS and WSS and skips certificate verification, because ISY controllers usually have a self-signed certificate. That encrypts the link but doesn't prove you're talking to your controller. Don't leave the controller on the factory `admin`/`admin` password.

## Running

The plugin starts with homeCore once it is installed. Run by hand, it takes the config path as its only argument and falls back to `config/config.toml`:

```bash
cd /path/to/hc-isy
./hc-isy config/config.toml
```

It fetches the node list and current values from the REST API, registers every enabled node and scene, then subscribes to the WebSocket event stream for live updates. If the controller stops answering, it reconnects on its own, waiting 2 seconds at first and backing off to a minute.

## Device IDs

A device ID is the ISY node address, lowercased, with spaces and colons turned into underscores:

```
isy_{address}          ← node or scene address
isy_13_a6_99_1         ← Insteon address "13 A6 99 1"
isy_00_3c_89_ab_00_00  ← address "00:3C:89:AB:00:00"
```

Scenes (ISY groups) follow the same rule, using the scene's address. There is no separate scene prefix.

## Devices and attributes

The plugin picks each device's type from its ISY category, type code and the unit of measure (UOM) of its main value.

| ISY device | HomeCore device_type |
|---|---|
| Dimmers (category 1, UOM 100 or 51) | `light` |
| Relays, switches and outlet modules (UOM 78) | `switch` |
| Contact, motion and water sensors | `contact_sensor`, `motion_sensor`, `water_sensor` |
| Binary sensors it can't classify more precisely | `binary_sensor` |
| Temperature, humidity, power and other readings | `sensor` |
| Locks (UOM 11) | `lock` |
| Garage doors (UOM 97) and motors (category 14) | `cover` |
| FanLinc | `fan` |
| Thermostats (category 5) | `thermostat` |
| ISY scenes | `scene` |

Names and units follow homeCore's shared device vocabulary. The plugin
converts from the ISY's own scales, using the UOM and precision the ISY sends
with each value.

| device_type | Attribute | Writable | Unit / values |
|---|---|---|---|
| `light` | `on` | yes | `true` with no level goes back to the last level seen |
| | `brightness_pct` | yes | 0 to 100 %, decimals allowed; 0 turns off; a light that is on never reports 0 % |
| `switch`, `scene` | `on` | yes | |
| `contact_sensor` | `open` | | |
| `motion_sensor` | `motion` | | |
| `water_sensor` | `water_detected` | | Insteon leak sensors report ON when dry; the plugin inverts it |
| `binary_sensor` | `on`, `device_class` | | |
| `sensor` | one reading, see below | | |
| `lock` | `locked` | yes | |
| `cover` | `position` | yes | 0 to 100 % open. A barrier (garage door) only opens (above 0) or closes (0) |
| `fan` | `on`, `speed`, `speed_pct` | yes | `speed` is `off`/`low`/`medium`/`high`; `speed_pct` 0 to 100 % |
| `thermostat` | `temperature` | | °C |
| | `humidity` | | % |
| | `hvac_action` | | `idle`, `heating`, `cooling`, `fan` |
| | `hvac_mode` | yes | `off`, `heat`, `cool`, `auto`, `fan_only` |
| | `heat_setpoint`, `cool_setpoint` | yes | °C |
| | `fan_mode` | yes | `auto`, `on` |

**Levels.** UOM 51 is already a percentage. UOM 100 (Insteon) runs 0 to 255,
and `pct = round(raw × 100 / 255)`, with a minimum of 1 % when the raw value
is above zero. `{"on": true}` sends the last level the device reported.
Before any level has been seen it sends a plain DON, which an Insteon device
takes to its configured on-level.

**Temperatures** are always °C. On the ISY side, UOM 4 is °C, 17 is °F and
101 is half-degrees in the thermostat's own unit. A setpoint is written back
in the thermostat's own degrees and precision, so 20 °C becomes `68` on a
whole-degree °F thermostat and `136` on a half-degree one. Showing °F is up to
the app, from each person's setting.

**Generic sensors** publish one reading under the shared name for its UOM,
converted to the shared unit:

| UOM | Attribute | Unit |
|---|---|---|
| 4, 17, 26 | `temperature` | °C |
| 22 | `humidity` | % |
| 36 | `illuminance` | lux |
| 73, 30 | `power_w` | W |
| 33, 119 | `energy_kwh` | kWh |
| 72, 43 | `voltage` | V |
| 1, 41 | `current_a` | A |
| 54 | `co2` | ppm |
| 118, 117, 31, 23 | `pressure` | hPa |
| 40, 49, 48, 32 | `wind_speed` | m/s |
| 71 | `uv_index` | |
| anything else | `value` | the ISY's own unit |

Commands still accept the old spellings `target_temp_heat`, `target_temp_cool`
and a cover's `state: open|closed`, but the plugin never publishes them. The
0 to 255 `brightness` is no longer accepted.

## Commanding devices

```bash
# Turn on (at the last level seen)
curl -s -X PATCH http://localhost:8080/api/v1/devices/isy_13_a6_99_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Set brightness (brightness_pct, 0–100)
curl -s -X PATCH http://localhost:8080/api/v1/devices/isy_13_a6_99_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brightness_pct": 75}'

# Turn off
curl -s -X PATCH http://localhost:8080/api/v1/devices/isy_13_a6_99_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": false}'

# Activate a scene
curl -s -X PATCH http://localhost:8080/api/v1/devices/isy_12345/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'
```

## Rule example: ISY light at sunset

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Porch light, on at sunset",
    enabled: true,
    priority: 0,
    trigger: SunEvent(event: Sunset, offset_minutes: 0),
    actions: [
        RuleAction(action: SetDeviceState(
            device_id: "isy_13_a6_99_1",
            state: { "on": true, "brightness_pct": 100 },
        )),
    ],
)
```


## Communication details

- The REST API at `http://{host}/rest/` gives the node list (`/rest/nodes`) and current values (`/rest/status`), and takes commands.
- The WebSocket at `ws://{host}/rest/subscribe` (`wss://` with TLS) carries live state changes, using the ISY Subscription API's XML event envelope and the `ISYSUB` sub-protocol.

## Notices

The plugin reports problems as notices on its card in the web UI.

| Code | Means |
|---|---|
| `not_configured` | No controller address is set, so there is nothing to connect to. |
| `controller_unreachable` | The ISY isn't answering REST or the event WebSocket, so every device it serves is unavailable. Clears on reconnect. |

## Troubleshooting

| Problem | Solution |
|---|---|
| `Connection refused` | Check the ISY's IP and port, and that the controller is online. |
| `Authentication failed` | Use the ISY Admin Console username and password. The account needs REST access. |
| State not updating | Check that the WebSocket can connect. The plugin reconnects on its own after an error; restart it if updates still don't arrive. |
| TLS errors | Set `tls = false` unless you've turned on HTTPS on the controller. |
| A device or scene is missing | Only enabled nodes are registered. Check that it is enabled on the ISY. |

## Log rotation

hc-isy writes its log to `logs/hc-isy.log`. Rotation and compression are set in the `[logging]` section of its config:

```toml
[logging]
level       = "info"   # stderr log level; RUST_LOG overrides this
rotation    = "daily"  # daily | hourly | weekly | never
max_size_mb = 100      # rotate when file exceeds this MB (0 = time-only)
compress    = true     # gzip rotated files in a background thread
```

| File | Description |
|---|---|
| `logs/hc-isy.log` | Active log (never compressed) |
| `logs/hc-isy.2026-03-27.log.gz` | Rotated daily file (compressed) |
| `logs/hc-isy.2026-03-27.1.log.gz` | Second rotation in the same period (size limit reached) |

For verbose logging of ISY API responses and WebSocket events:

```bash
RUST_LOG=hc_isy=debug ./hc-isy config/config.toml
```
