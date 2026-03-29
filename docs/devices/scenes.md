---
id: scenes
title: Scenes
sidebar_label: Scenes
sidebar_position: 3
---

# Scenes

A scene is a saved multi-device state snapshot that can be activated with a single API call or rule action.

HomeCore supports two types of scenes:
- **Native scenes** — defined in HomeCore itself; activate by commanding each device
- **Plugin scenes** — scenes defined in the device ecosystem (Hue scenes, Lutron scenes); HomeCore activates them by sending the appropriate command to the plugin

## Scene CRUD

### List scenes

```bash
curl -s http://localhost:8080/api/v1/scenes \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Create a native scene

```bash
SCENE_ID=$(curl -s -X POST http://localhost:8080/api/v1/scenes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Movie night",
    "area": "living_room",
    "devices": [
      {"device_id": "light_living_room_main", "state": {"on": true, "brightness": 30, "color_temp": 2700}},
      {"device_id": "light_kitchen", "state": {"on": false}},
      {"device_id": "light_hallway", "state": {"on": true, "brightness": 10}}
    ]
  }' | jq -r .id)
```

### Activate a scene

```bash
curl -s -X POST http://localhost:8080/api/v1/scenes/$SCENE_ID/activate \
  -H "Authorization: Bearer $TOKEN"
```

### Export and import scenes

```bash
# Export all scenes
curl -s http://localhost:8080/api/v1/scenes/export \
  -H "Authorization: Bearer $TOKEN" > scenes-backup.json

# Import
curl -s -X POST http://localhost:8080/api/v1/scenes/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @scenes-backup.json | jq
```

## Activating scenes from rules

```toml
# Activate a scene
[[actions]]
type     = "call_service"
url      = "http://localhost:8080/api/v1/scenes/SCENE_ID/activate"
method   = "POST"

# Or use the SetDeviceState action on a scene device
[[actions]]
type      = "set_device_state"
device_id = "hue_001788fffe6841b3_scene_abc123_def456"
state     = { action = "activate_scene" }
```

### Mode-dependent scene activation

```toml
[[actions]]
type             = "activate_scene_per_mode"
default_scene_id = "scene_daytime_living"

[[actions.modes]]
mode_name = "mode_night"
scene_id  = "scene_nighttime_living"

[[actions.modes]]
mode_name = "mode_away"
scene_id  = "scene_minimal_away"
```

## Plugin scenes

Plugin scenes appear as devices in the registry with device_type = `scene`. They have device IDs following plugin conventions:

| Plugin | Scene device ID pattern |
|---|---|
| hc-hue | `hue_{bridge_id}_scene_{scene_id}` |
| hc-lutron | `lutron_scene_{id}` or `lutron_scene_{id}_phantom` |
| hc-isy | `isy_scene_{address}` |

Activate a Hue scene:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_scene_abc123/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "activate_scene"}'
```

Activate a Lutron scene:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/lutron_scene_42/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"activate": true}'
```

:::note Scene availability
Lutron phantom button scenes must have `available = true` before activation. Check device state before using in rules if availability might vary.
:::

## Filtering scenes from device lists

The `device_type = "scene"` field is used by UIs and the API to separate controllable devices from scene entries:

```bash
# List only controllable devices (exclude scenes)
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.device_type != "scene")]'

# List only scenes
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.device_type == "scene") | {device_id, name, area}]'
```
