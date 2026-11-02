---
id: scenes
title: Scenes
sidebar_label: Scenes
sidebar_position: 3
---

# Scenes

A scene is a saved set of device states that you can apply in one step, from the API, a rule, or the web app's **Scenes** page.

HomeCore has two kinds:

- **Native scenes** are stored in HomeCore. Activating one sends each device its saved state as a command.
- **Plugin scenes** are defined in the device ecosystem (Hue, Lutron, Caséta, ISY). They appear as devices with `device_type = "scene"`, and HomeCore activates them by commanding that device.

In the web app, **Settings → Scenes** edits native scenes.

## Native scenes

A native scene has an `id`, a `name`, and `states`: a map from device ID to the state to send that device.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Movie night",
  "states": {
    "light_living_room_main": {"on": true, "brightness_pct": 12, "color_temp": 2700},
    "light_kitchen": {"on": false},
    "light_hallway": {"on": true, "brightness_pct": 4}
  }
}
```

A state of the form `{"actions": [ … ]}` sends each item to that device in turn, for a device that needs more than one command.

### List scenes

```bash
curl -s http://localhost:8080/api/v1/scenes \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Create a scene

```bash
SCENE_ID=$(curl -s -X POST http://localhost:8080/api/v1/scenes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Movie night",
    "states": {
      "light_living_room_main": {"on": true, "brightness_pct": 12, "color_temp": 2700},
      "light_kitchen": {"on": false},
      "light_hallway": {"on": true, "brightness_pct": 4}
    }
  }' | jq -r .id)
```

`GET /scenes/{id}` reads one scene, `PUT /scenes/{id}` replaces its name and states, and `DELETE /scenes/{id}` removes it.

### Activate a scene

```bash
curl -s -X POST http://localhost:8080/api/v1/scenes/$SCENE_ID/activate \
  -H "Authorization: Bearer $TOKEN"
# → {"activated": "Movie night"}
```

Activation publishes each device's state to its command topic and emits a `scene_activated` event. Running a scene needs the `scenes:run` scope (`scenes:write` also works), which is what lets a wall display run scenes without being able to edit them.

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
# → {"imported": 3}
```

Import gives every scene a fresh ID, so importing a file twice makes two copies.

## Activating scenes from rules

The `ActivateScenePerMode` action activates a native scene chosen by which mode is on. The first entry whose mode is on wins, and `default_scene_id` is used when none is:

```ron
RuleAction(action: ActivateScenePerMode(
    modes: [
        (mode: "mode_night", scene_id: "11111111-0000-0000-0000-000000000001"),
        (mode: "mode_away",  scene_id: "22222222-0000-0000-0000-000000000002"),
    ],
    default_scene_id: Some("33333333-0000-0000-0000-000000000003"),
)),
```

With an empty `modes` list, it simply activates the default scene, which is how a rule runs one native scene.

A plugin scene is a device, so a rule activates it with `SetDeviceState`:

```ron
RuleAction(action: SetDeviceState(
    device_id: "hue_001788fffe6841b3_scene_abc123",
    state: {"action": "activate"},
)),
```

## Plugin scenes

Plugin scenes are devices with `device_type = "scene"`, and their IDs follow each plugin's conventions:

| Plugin | Scene device ID pattern |
|---|---|
| hc-hue | `hue_{bridge_id}_scene_{scene_id}` |
| hc-lutron | `lutron_scene_{name}` (from the scene's configured name) |
| hc-caseta | `caseta_scene_{name}` |
| hc-isy | `isy_{address}`, like other ISY nodes |

`{"action": "activate"}` works across Hue, Lutron and Caséta scenes. Hue also accepts the older `{"action": "activate_scene"}`, and Lutron and Caséta accept `{"activate": true}`. ISY scenes are turned on and off with `on`.

Activate a Hue scene:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_scene_abc123/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "activate"}'
```

Activate a Lutron scene:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/lutron_scene_movie/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "activate"}'
```

A scene device that can tell reports `active`: whether its devices currently show the scene. A Lutron phantom scene reports its button's LED this way, and one whose button has no LED state declares no state at all. Caséta scenes go offline when the bridge does.

## Filtering scenes from device lists

`device_type = "scene"` separates scene entries from controllable devices:

```bash
# List only scenes
curl -s "http://localhost:8080/api/v1/devices?device_type=scene" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | {device_id, name, area}]'

# List only controllable devices (exclude scenes)
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.device_type != "scene")]'
```
