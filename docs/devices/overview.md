---
id: overview
title: Devices
sidebar_label: Overview
sidebar_position: 1
---

# Devices

A **device** in HomeCore is any physical or virtual entity that has a state you can read and optionally command. Devices are registered by plugins via MQTT and stored in the device registry (`data/state.redb`).

## Device model

```json
{
  "device_id": "yolink_d88b4c01000e82eb",
  "name": "Front Door",
  "plugin_id": "plugin.yolink",
  "area": "entryway",
  "device_type": "door_sensor",
  "available": true,
  "last_seen": "2026-03-28T14:22:00Z",
  "attributes": {
    "open": false,
    "battery": 85,
    "signal": -65
  }
}
```

| Field | Description |
|---|---|
| `device_id` | Unique identifier; set by the plugin at registration |
| `name` | Human-readable name; set by plugin, editable via API |
| `plugin_id` | Which plugin owns this device |
| `area` | Room/zone assignment (optional) |
| `device_type` | Category hint (e.g. `light`, `door_sensor`, `thermostat`); used to filter scenes from device lists |
| `available` | Whether the device is online |
| `last_seen` | Last MQTT state update |
| `attributes` | All current attribute values as a flat JSON object |

## Device CRUD

### List devices

```bash
# All devices
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" | jq

# Paginated (large deployments)
curl -s "http://localhost:8080/api/v1/devices?limit=50&offset=0" \
  -H "Authorization: Bearer $TOKEN" | jq
# X-Total-Count header gives total

# Filter by area
curl -s "http://localhost:8080/api/v1/devices?area=garage" \
  -H "Authorization: Bearer $TOKEN" | jq '.[].name'
```

### Get one device

```bash
curl -s http://localhost:8080/api/v1/devices/yolink_front_door \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Get device capability schema

```bash
curl -s http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_1/schema \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Command a device

`PATCH /devices/{id}/state` sends a command to the device via MQTT.

```bash
# Turn a light on
curl -s -X PATCH http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true, "brightness": 200}'

# Unlock a door
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_lock_front/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locked": false}'
```

The command is published to `homecore/devices/{id}/cmd`. The plugin receives it and publishes the updated state back.

### Update device metadata

Change the display name or area without touching state:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/yolink_front_door \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Front Door Sensor", "area": "entryway"}'
```

### Delete a device

Cascades to all rules that reference the device — affected rules are disabled with a `DELETED:` placeholder.

```bash
curl -s -X DELETE http://localhost:8080/api/v1/devices/old_sensor \
  -H "Authorization: Bearer $TOKEN" | jq
# → {"deleted": true, "affected_rules": ["Morning lights", "Away mode check"]}
```

## Bulk operations

### Bulk area assignment

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["sensor_01", "sensor_02", "light_01"], "area": "garage"}' | jq
# → {"updated": 3, "not_found": []}
```

### Bulk delete

```bash
curl -s -X DELETE http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["old_sensor_01", "old_sensor_02"]}' | jq
# → {"deleted": 2, "not_found": [], "affected_rules": ["Garage lights"]}
```

## Device history

Time-series attribute changes stored in SQLite (`data/history.db`):

```bash
# Last 24 hours (default)
curl -s "http://localhost:8080/api/v1/devices/thermostat_main/history" \
  -H "Authorization: Bearer $TOKEN" | jq

# Specific attribute, last 7 days
curl -s "http://localhost:8080/api/v1/devices/thermostat_main/history?attribute=temperature&from=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
  -H "Authorization: Bearer $TOKEN" | jq

# Response shape
# [{"attribute":"temperature","value":72.1,"recorded_at":"2026-03-28T14:00:00Z"}, ...]
```

| Parameter | Default | Description |
|---|---|---|
| `from` | 24 hours ago | ISO-8601 UTC start |
| `to` | now | ISO-8601 UTC end |
| `attribute` | all | Filter to one attribute |
| `limit` | 500 | Max entries (cap 5000) |

## Areas

Assign devices to logical rooms/zones:

```bash
# List areas
curl -s http://localhost:8080/api/v1/areas \
  -H "Authorization: Bearer $TOKEN" | jq

# Create an area
curl -s -X POST http://localhost:8080/api/v1/areas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Living Room"}' | jq

# Assign devices to an area
curl -s -X PUT http://localhost:8080/api/v1/areas/AREA_ID/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"device_ids": ["light_living_room_1", "light_living_room_2"]}' | jq
```

## Device IDs by plugin

| Plugin | Device ID pattern | Example |
|---|---|---|
| hc-hue | `hue_{bridge_id}_{resource_id}` | `hue_001788fffe6841b3_1` |
| hc-yolink | `yolink_{device_id}` | `yolink_d88b4c01000e82eb` |
| hc-lutron | `lutron_{device_id}` | `lutron_21` |
| hc-zwave | `zwave_{node_id}` | `zwave_23` |
| hc-sonos | `sonos_{room_name}` | `sonos_living_room` |
| hc-wled | `wled_{name}` | `wled_deck` |
| hc-isy | `isy_{address}` | `isy_1_2_3_1` |
| Timers | `timer_{name}` | `timer_garage_close` |
| Switches | `switch_{name}` | `switch_away_mode` |
| Modes | `mode_{name}` | `mode_night` |
| Lutron scenes | `lutron_scene_{id}` | `lutron_scene_42` |
| Hue scenes | `hue_{bridge}_scene_{id}` | `hue_001788fffe6841b3_scene_abc123` |
