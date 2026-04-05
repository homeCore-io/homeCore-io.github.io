---
id: lutron
title: Lutron RadioRA2
sidebar_label: Lutron
sidebar_position: 6
---

# Lutron RadioRA2 (`hc-lutron`)

The hc-lutron plugin bridges a Lutron RadioRA2 (or RadioRA2 Select / Caseta) main repeater to HomeCore via telnet. All dimmers, switches, and scenes are registered as devices.

## Prerequisites

- A Lutron RadioRA2 main repeater on your LAN
- Telnet enabled on the repeater (Integration → Enable Telnet in Lutron Software)
- The repeater's IP address
- Integration credentials (username/password — default: `lutron`/`integration`)

## Configuration

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.lutron"
password    = ""

[lutron]
host     = "192.168.1.50"
port     = 23          # standard telnet
username = "lutron"
password = "integration"
```

## Running

```bash
cd /path/to/hc-lutron
./hc-lutron config/config.toml
```

The plugin connects via telnet, queries the full device list, registers all devices, and subscribes to real-time state updates.

## Device IDs

| Device type | ID pattern | Example |
|---|---|---|
| Dimmer/switch | `lutron_{integration_id}` | `lutron_21` |
| Pico remote | `lutron_pico_{integration_id}` | `lutron_pico_5` |
| Scene (button) | `lutron_scene_{id}` | `lutron_scene_42` |
| Phantom button scene | `lutron_scene_{id}_phantom` | `lutron_scene_42_phantom` |

The integration ID matches the ID shown in Lutron Designer software.

## Device attributes

### Dimmers and switches

| Attribute | Type | Description |
|---|---|---|
| `on` | boolean | Power state |
| `brightness` | integer 0-100 | Level percentage (0 = off, 100 = full) |

### Pico remotes

Pico remotes are registered with `DeviceKind::Pico`. They are read-only button devices — they report button press events but cannot be commanded.

| Attribute | Type | Description |
|---|---|---|
| `button` | integer | Last pressed button number |
| `action` | string | `"press"` or `"release"` |

Pico remotes are distinct from keypads. They do not have LED feedback and cannot be used as scene controllers from HomeCore.

### Scenes

| Attribute | Type | Description |
|---|---|---|
| `available` | boolean | Whether the scene can be activated |
| `on` | boolean | Scene active state (phantom scenes with LED feedback) |

### Phantom scene LED feedback

Phantom scene buttons now report on/off state via LED feedback. The plugin queries LED state at connect and handles LED change events in real time. When a phantom scene's LED turns on, the scene device's `on` attribute becomes `true`, allowing rules to react to scene activation from physical keypads.

:::note Scene availability
Always check `available = true` before activating a Lutron scene. Some phantom button scenes may be unavailable at certain times depending on your Lutron configuration.
:::

## Commanding devices

```bash
# Turn on at 75%
curl -s -X PATCH http://localhost:8080/api/v1/devices/lutron_21/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true, "brightness": 75}'

# Turn off
curl -s -X PATCH http://localhost:8080/api/v1/devices/lutron_21/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": false}'

# Activate a scene
curl -s -X PATCH http://localhost:8080/api/v1/devices/lutron_scene_42/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"activate": true}'
```

## Rule example — Lutron scene at sunset

```toml
name = "Living room — Lutron evening scene"
enabled = true

[trigger]
type           = "sun_event"
event          = "sunset"
offset_minutes = -15

[[actions]]
type      = "set_device_state"
device_id = "lutron_scene_42"
state     = { activate = true }
```

## Rule example — dimmer at different levels by mode

```toml
name = "Office — mode-based lighting"
enabled = true

[trigger]
type      = "device_state_changed"
device_id = "mode_night"
attribute = "on"
to        = true

[[actions]]
type      = "set_device_state_per_mode"
device_id = "lutron_21"

[[actions.modes]]
mode_name = "mode_night"
state     = { on = true, brightness = 20 }

[[actions.modes]]
mode_name = "mode_away"
state     = { on = false }

[actions.default_state]
on         = true
brightness = 80
```

## Troubleshooting

| Problem | Solution |
|---|---|
| `Connection refused` | Verify telnet is enabled in Lutron Designer and the IP/port is correct |
| `Authentication failed` | Default credentials: username `lutron`, password `integration` |
| Scene not activating | Check `available` attribute — phantom buttons may not always be available |
| Devices not appearing | Ensure all devices are programmed in Lutron Designer and the repeater is online |
| Dim level off by 1% | Lutron uses integer 0-100; minor rounding in conversion is expected |

## Log rotation

hc-lutron writes logs to `logs/hc-lutron.log`. Rotation and compression are configured in `config/config.toml`:

```toml
[logging]
level       = "info"   # stderr log level; RUST_LOG overrides this
rotation    = "daily"  # daily | hourly | weekly | never
max_size_mb = 100      # rotate when file exceeds this MB (0 = time-only)
compress    = true     # gzip rotated files in a background thread
```

| File | Description |
|---|---|
| `logs/hc-lutron.log` | Active log (always uncompressed) |
| `logs/hc-lutron.2026-03-27.log.gz` | Rotated daily file (compressed) |
| `logs/hc-lutron.2026-03-27.1.log.gz` | Second rotation in same period (size limit hit) |
