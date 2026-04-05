---
id: wled
title: WLED
sidebar_label: WLED
sidebar_position: 8
---

# WLED (`hc-wled`)

The hc-wled plugin bridges [WLED](https://kno.wled.ge) LED controllers to HomeCore. It discovers WLED devices on your network via mDNS/SSDP and registers them as addressable LED devices.

## Prerequisites

- One or more WLED controllers on your LAN (any ESP8266/ESP32 running WLED firmware)
- WLED devices accessible by IP

## Configuration

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.wled"
password    = ""

[wled]
# Optional: specify device IPs explicitly (in addition to auto-discovery)
devices = [
  "192.168.1.150",  # deck WLED
  "192.168.1.151",  # garage WLED
]

# Optional: discovery timeout in seconds (default: 10)
discovery_timeout_secs = 10
```

## Running

```bash
cd /path/to/hc-wled
./hc-wled config/config.toml
```

The plugin discovers WLED devices via mDNS/SSDP and subscribes to their state via WebSocket for real-time updates.

## Device IDs

WLED device IDs use the device's configured name:

```
wled_deck         ← WLED named "deck"
wled_garage       ← WLED named "garage"
wled_kitchen_strip
```

The name comes from WLED's configured device name (Settings → WiFi Setup → mDNS address).

## Device attributes

| Attribute | Type | Description |
|---|---|---|
| `on` | boolean | Power state |
| `brightness` | integer 0-255 | Brightness |
| `effect` | string | Active effect name |
| `effect_speed` | integer 0-255 | Effect animation speed |
| `effect_intensity` | integer 0-255 | Effect intensity parameter |
| `palette` | string | Active color palette |
| `color` | object `{r,g,b}` | Primary color (RGB) |
| `color2` | object `{r,g,b}` | Secondary color |
| `preset` | integer | Active preset ID |

## Commanding WLED

```bash
# Turn on
curl -s -X PATCH http://localhost:8080/api/v1/devices/wled_deck/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Set to red at 50% brightness
curl -s -X PATCH http://localhost:8080/api/v1/devices/wled_deck/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true, "brightness": 127, "color": {"r": 255, "g": 0, "b": 0}}'

# Activate an effect
curl -s -X PATCH http://localhost:8080/api/v1/devices/wled_deck/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true, "effect": "Fireworks", "effect_speed": 128, "palette": "Random Colors"}'

# Load a saved preset
curl -s -X PATCH http://localhost:8080/api/v1/devices/wled_deck/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"preset": 3}'

# Turn off
curl -s -X PATCH http://localhost:8080/api/v1/devices/wled_deck/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": false}'
```

## Rule example — sunset deck lights

```toml
name = "Deck WLED — on at sunset"
enabled = true

[trigger]
type           = "sun_event"
event          = "sunset"
offset_minutes = -15

[[actions]]
type      = "set_device_state"
device_id = "wled_deck"
state     = { on = true, brightness = 200, effect = "Breath", palette = "Sunset" }

---

name = "Deck WLED — off at sunrise"
enabled = true

[trigger]
type  = "sun_event"
event = "sunrise"

[[actions]]
type      = "set_device_state"
device_id = "wled_deck"
state     = { on = false }
```

## Architecture note

hc-wled is a fully managed plugin built on the official HomeCore plugin SDK. It supports the management protocol including heartbeat monitoring, remote configuration, and dynamic log level changes.

The plugin uses WebSocket connections to each WLED device for real-time state updates (preferred), with HTTP polling as a fallback when WebSocket is unavailable. If a WLED device goes offline and comes back, the plugin automatically reconnects.

### Management protocol support

- Heartbeat published every 30 seconds
- Log level can be changed at runtime via `POST /api/v1/plugins/plugin.wled/config` or the `set_log_level` management command
- Plugin can be started, stopped, and restarted via the management API

## Log rotation

hc-wled writes logs to `logs/hc-wled.log`. Rotation and compression are configured in `config/config.toml`:

```toml
[logging]
level       = "info"   # stderr log level; RUST_LOG overrides this
rotation    = "daily"  # daily | hourly | weekly | never
max_size_mb = 100      # rotate when file exceeds this MB (0 = time-only)
compress    = true     # gzip rotated files in a background thread
```

| File | Description |
|---|---|
| `logs/hc-wled.log` | Active log (always uncompressed) |
| `logs/hc-wled.2026-03-27.log.gz` | Rotated daily file (compressed) |
| `logs/hc-wled.2026-03-27.1.log.gz` | Second rotation in same period (size limit hit) |
