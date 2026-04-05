---
id: hue
title: Philips Hue
sidebar_label: Philips Hue
sidebar_position: 4
---

# Philips Hue (`hc-hue`)

The hc-hue plugin bridges a Philips Hue bridge to HomeCore. It registers all lights, groups, and scenes as devices and subscribes to their command topics.

## Prerequisites

- A Philips Hue bridge on your LAN
- The bridge IP address (find it at `https://discovery.meethue.com` or your router's DHCP list)
- An app key (obtained on first run — see below)

## Configuration

```toml
# config/config.toml

[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.hue"
password    = ""

[hue]
bridge_ip = "192.168.1.100"
app_key   = ""              # filled in automatically after first pairing
```

## First run — pairing

1. **Press the physical button on top of the Hue bridge**
2. Within 30 seconds, start hc-hue:

```bash
cd /path/to/hc-hue
./hc-hue config/config.toml
```

The plugin pairs with the bridge and writes the generated `app_key` back to `config/config.toml`. You will see:

```
INFO hc_hue: Pairing with bridge... press the button now
INFO hc_hue: Paired — app_key written to config
INFO hc_hue: Registered 24 devices
```

On subsequent starts, the stored `app_key` is used directly — no button press needed.

## Device IDs

| Device type | ID pattern | Example |
|---|---|---|
| Individual light | `hue_{bridge_id}_{light_id}` | `hue_001788fffe6841b3_1` |
| Light group/room | `hue_{bridge_id}_group_{group_id}` | `hue_001788fffe6841b3_group_1` |
| Hue scene | `hue_{bridge_id}_scene_{scene_uuid}` | `hue_001788fffe6841b3_scene_abc123_def456` |
| Zigbee sensor | `hue_{bridge_id}_sensor_{sensor_id}` | `hue_001788fffe6841b3_sensor_1` |
| Zigbee connectivity | `hue_{bridge_id}_zigbee_connectivity_{id}` | Read-only diagnostic — not commandable |

:::caution Scene vs. light
Devices with `device_type = "scene"` are Hue scenes — they have no brightness/color attributes and activate by setting `{"action": "activate_scene"}`. Do not try to control them as lights.

Devices with `device_type = "light"` are individual bulbs or groups that you can dim, color, etc.
:::

## Commanding lights

```bash
# Turn on
curl -s -X PATCH http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Dim to 50%
curl -s -X PATCH http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true, "brightness": 127}'

# Set color temperature (Kelvin)
curl -s -X PATCH http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true, "brightness": 200, "color_temp": 2700}'

# Set color (XY)
curl -s -X PATCH http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true, "color_xy": {"x": 0.675, "y": 0.322}}'
```

## Activating Hue scenes

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_scene_abc123/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "activate_scene"}'
```

## Light attributes

| Attribute | Type | Description |
|---|---|---|
| `on` | boolean | Power state |
| `brightness` | integer 0-254 | Brightness level |
| `color_temp` | integer (Kelvin) | Color temperature (warm white to cool white) |
| `color_xy` | object `{x, y}` | CIE XY color coordinates |
| `reachable` | boolean | Bridge can communicate with the bulb |

## Grouped lights

Light groups (rooms and zones from the Hue app) appear as single devices. Commanding the group controls all lights in it simultaneously — more efficient than commanding each bulb separately.

```bash
# Turn off the living room group
curl -s -X PATCH http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_group_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": false}'
```

## Rule example — turn on Hue scene at sunset

```toml
name = "Living room — sunset scene"
enabled = true

[trigger]
type           = "sun_event"
event          = "sunset"
offset_minutes = 0

[[actions]]
type      = "set_device_state"
device_id = "hue_001788fffe6841b3_scene_evening_relaxing"
state     = { action = "activate_scene" }
```

## Management protocol

hc-hue is a fully managed plugin built on the official HomeCore plugin SDK. It supports:

- **Heartbeat monitoring** — published every 30 seconds; HomeCore marks the plugin offline after 90 seconds without a heartbeat
- **Remote configuration** — `SyncConfig` struct consolidates refresh parameters and can be updated via the management API
- **Dynamic log level** — change verbosity at runtime without restarting the plugin
- **Eventstream metrics** — `EventstreamMetrics` consolidates 26 metric fields for monitoring SSE event processing

### Management API

```bash
# Get current plugin config
curl -s http://localhost:8080/api/v1/plugins/plugin.hue/config \
  -H "Authorization: Bearer $TOKEN" | jq

# Update plugin config
curl -s -X PUT http://localhost:8080/api/v1/plugins/plugin.hue/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"refresh_interval_secs": 30}'

# Restart the plugin
curl -s -X POST http://localhost:8080/api/v1/plugins/plugin.hue/restart \
  -H "Authorization: Bearer $TOKEN"
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `Pairing failed` | Press the bridge button within 30 seconds of starting the plugin |
| `app_key` not being saved | Check that the config file is writable |
| Lights not responding | Check `reachable` attribute — Zigbee mesh issues can cause individual bulbs to go unreachable |
| Scenes not activating | Verify `available = true` on the scene device (`GET /devices/{id}`) |
| `zigbee_connectivity` devices cluttering device list | Filter with `device_type != "zigbee_connectivity"` in your UI |

## Log rotation

hc-hue writes logs to `logs/hc-hue.log`. Rotation and compression are configured in `config/config.toml`:

```toml
[logging]
level       = "info"   # stderr log level; RUST_LOG overrides this
rotation    = "daily"  # daily | hourly | weekly | never
max_size_mb = 100      # rotate when file exceeds this MB (0 = time-only)
compress    = true     # gzip rotated files in a background thread
```

| File | Description |
|---|---|
| `logs/hc-hue.log` | Active log (always uncompressed) |
| `logs/hc-hue.2026-03-27.log.gz` | Rotated daily file (compressed) |
| `logs/hc-hue.2026-03-27.1.log.gz` | Second rotation in same period (size limit hit) |
