---
id: isy
title: ISY / IoX
sidebar_label: ISY / IoX
sidebar_position: 9
---

# ISY / IoX (`hc-isy`)

The hc-isy plugin bridges a Universal Devices ISY/IoX hub to HomeCore via the ISY REST API and WebSocket event stream. It supports Insteon, Z-Wave, Zigbee, and other devices controlled by the ISY hub.

## Prerequisites

- A Universal Devices ISY994 or IoX hub on your LAN
- The hub's IP address, username, and password

## Configuration

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.isy"
password    = ""

[isy]
host     = "192.168.1.x"   # ISY hub IP address
port     = 80
username = "admin"
password = "admin"
tls      = false            # set true if ISY has HTTPS enabled
```

## Running

```bash
cd /path/to/hc-isy
./hc-isy config/config.toml
```

The plugin queries the ISY REST API for the full node list, registers all devices, then subscribes to the WebSocket event stream for real-time state updates.

## Device IDs

ISY device IDs encode the node address:

```
isy_{a}_{b}_{c}_{d}    ← Insteon/Z-Wave node address components
isy_1_2_3_1            ← address 1.2.3.1
```

Scenes are registered as:

```
isy_scene_{address}
```

## Devices and attributes

Names and units follow homeCore's shared device vocabulary. The plugin
converts from the ISY's own scales; which scale a value is in comes from the
unit of measure (UOM) and precision the ISY sends with it.

| device_type | Attribute | Writable | Unit / values |
|---|---|---|---|
| `light` | `on` | yes | `true` with no level goes back to the last level seen |
| | `brightness_pct` | yes | 0–100 %, decimals allowed; 0 turns off; on is never 0 % |
| `switch`, `scene` | `on` | yes | |
| `contact_sensor` | `open` | | |
| `motion_sensor` | `motion` | | |
| `water_sensor` | `water_detected` | | Insteon leak sensors report ON when dry; inverted here |
| `binary_sensor` | `on`, `device_class` | | |
| `sensor` | one reading, see below | | |
| `lock` | `locked` | yes | |
| `cover` | `position` | yes | 0–100 % open. A barrier (garage door) only opens (> 0) or closes (0) |
| `fan` | `on`, `speed`, `speed_pct` | yes | `speed` is `off`/`low`/`medium`/`high`; `speed_pct` 0–100 % |
| `thermostat` | `temperature` | | °C |
| | `humidity` | | % |
| | `hvac_action` | | `idle`, `heating`, `cooling`, `fan` |
| | `hvac_mode` | yes | `off`, `heat`, `cool`, `auto`, `fan_only` |
| | `heat_setpoint`, `cool_setpoint` | yes | °C |
| | `fan_mode` | yes | `auto`, `on` |

**Levels.** UOM 51 is already a percentage; UOM 100 (Insteon) is 0–255, and
`pct = round(raw × 100 / 255)`, at least 1 % when above zero.

**Temperatures** are always °C. A setpoint is written back in the thermostat's
own degrees and precision, so 20 °C becomes `68` on a whole-degree °F
thermostat. Showing °F is the app's job, from each person's setting.

**Generic sensors** publish one reading under the shared name its UOM gives
it, in the shared unit: `temperature` (°C), `humidity` (%), `illuminance`
(lux), `power_w`, `energy_kwh`, `voltage`, `current_a`, `co2` (ppm),
`pressure` (hPa), `wind_speed` (m/s), `uv_index` — or `value` in the ISY's own
unit for anything else.

## Commanding devices

```bash
# Turn on (at the last level seen)
curl -s -X PATCH http://localhost:8080/api/v1/devices/isy_1_2_3_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Set brightness (brightness_pct, 0–100)
curl -s -X PATCH http://localhost:8080/api/v1/devices/isy_1_2_3_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brightness_pct": 75}'

# Turn off
curl -s -X PATCH http://localhost:8080/api/v1/devices/isy_1_2_3_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": false}'

# Activate a scene
curl -s -X PATCH http://localhost:8080/api/v1/devices/isy_scene_12345/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'
```

## Rule example — ISY light at sunset

```toml
name = "Porch light — on at sunset"
enabled = true

[trigger]
type           = "sun_event"
event          = "sunset"
offset_minutes = 0

[[actions]]
type      = "set_device_state"
device_id = "isy_1_5_2_1"
state     = { on = true, brightness_pct = 100 }
```

## Communication details

- **REST API** — queries node list, current state, and sends commands via `http://{host}/rest/`
- **WebSocket** — subscribes to `ws://{host}/rest/subscribe` for real-time state change events
- Events use the ISY Subscription API (XML-based event envelope)

## Troubleshooting

| Problem | Solution |
|---|---|
| `Connection refused` | Verify ISY IP, port, and that the hub is online |
| `Authentication failed` | Default credentials are `admin`/`admin`; check ISY admin panel |
| State not updating | Check WebSocket connectivity; the ISY subscription may have timed out — restart the plugin |
| TLS errors | Set `tls = false` unless you've explicitly enabled HTTPS on the ISY hub |
| Scenes not appearing | ISY scenes must have at least one member device to be discoverable |

## Log rotation

hc-isy writes logs to `logs/hc-isy.log`. Rotation and compression are configured in `config/config.toml`:

```toml
[logging]
level       = "info"   # stderr log level; RUST_LOG overrides this
rotation    = "daily"  # daily | hourly | weekly | never
max_size_mb = 100      # rotate when file exceeds this MB (0 = time-only)
compress    = true     # gzip rotated files in a background thread
```

| File | Description |
|---|---|
| `logs/hc-isy.log` | Active log (always uncompressed) |
| `logs/hc-isy.2026-03-27.log.gz` | Rotated daily file (compressed) |
| `logs/hc-isy.2026-03-27.1.log.gz` | Second rotation in same period (size limit hit) |

For verbose debugging of ISY API responses and WebSocket events:

```bash
RUST_LOG=hc_isy=debug ./hc-isy config/config.toml
```
