---
id: overview
title: Devices
sidebar_label: Overview
sidebar_position: 1
---

# Devices

A **device** in HomeCore is anything, physical or virtual, with a state you can read and usually command. Plugins register devices over MQTT, and HomeCore keeps them in its device registry (`data/state.redb`). HomeCore's own helpers and modes are devices too; see [Virtual Devices](./virtual-devices.md).

## Device model

```json
{
  "device_id": "yolink_d88b4c01000e82eb",
  "canonical_name": "entryway.front_door",
  "name": "Front Door",
  "plugin_id": "plugin.yolink",
  "area": "entryway",
  "device_type": "contact_sensor",
  "available": true,
  "last_seen": "2026-03-28T14:22:00Z",
  "attributes": {
    "open": false,
    "battery_pct": 85
  },
  "attributes_changed_at": {
    "open": "2026-03-28T07:41:12Z"
  }
}
```

| Field | Description |
|---|---|
| `device_id` | Unique internal identifier, set by the plugin at registration |
| `canonical_name` | Stable HomeCore name for rules and logs |
| `name` | Display name as the plugin delivers it. Re-registration overwrites it, so a rename in the vendor's own app flows through. |
| `name_override` | Optional name you set. It wins over `name` and survives plugin restarts. |
| `plugin_id` | The plugin that owns the device |
| `area` | Room slug as the plugin delivers it (`living_room`). Omitted when there is none. |
| `area_override` | Optional room you set, with the same rules as `name_override` |
| `device_type` | Canonical category such as `light`, `contact_sensor`, `thermostat`, or `media_player` |
| `ui_hint` | Optional presentation hint, for example a switch shown as a `light` or a contact sensor shown as a `door`, `window`, `garage` or `gate` |
| `available` | Whether the device is reachable now |
| `last_seen` | Time of the most recent state update |
| `last_change` | Where the most recent update came from (`kind`, `source`, the actor, a `correlation_id`), when known |
| `attributes` | Every current attribute value, as a flat JSON object |
| `attributes_changed_at` | When each attribute last took a *different* value. `last_seen` moves on every report; this answers "clear for how long?" and survives restarts. |
| `manufacturer`, `model`, `sw_version` | What the device's own system reports about it, when the plugin knows |
| `parent_device_id` | The device this one sits behind (a bulb's bridge, a strip's outlet). Advisory only: nothing routes through it. |
| `button_names` | Optional names you gave a keypad's buttons, keyed by button number |

Optional fields are left out of the JSON when they have no value.

## Shared attribute names and units

Every plugin publishes and accepts the same names for the same ideas, in the same units, and converts from its device's own scale inside the plugin. Apps, rules and scripts only ever see these. The table lives in `hc-types` (`device_vocabulary`); the common ones are:

| Name | Meaning | Unit |
|---|---|---|
| `on` | On or off. `true` with no level restores the last level. | bool |
| `brightness_pct` | Light level. 0 is off; a light that is on never reports 0. | %, 0 to 100 |
| `color_temp` | White warmth | kelvin |
| `color_xy`, `color_rgb` | Colour as a CIE xy point, or sRGB 0 to 255 | |
| `transition_ms` | Fade time for the change it is sent with | ms |
| `position`, `tilt_pct` | How open a cover or its slats are; 100 is fully open | % |
| `locked` | Whether a lock is locked | bool |
| `speed_pct` | Fan speed; 0 is off | % |
| `open` | A door, window or contact is open | bool |
| `motion`, `occupied`, `water_detected`, `tampered` | Sensor states | bool |
| `temperature` | The temperature here | °C |
| `humidity` | Relative humidity | % |
| `illuminance` | Light level | lux |
| `pressure`, `wind_speed`, `co2` | Weather and air readings | hPa, m/s, ppm |
| `setpoint`, `heat_setpoint`, `cool_setpoint` | Thermostat targets | °C |
| `hvac_mode` | `off`, `heat`, `cool`, `auto`, `fan_only` or `dry` | |
| `hvac_action` | `idle`, `heating`, `cooling`, `fan`, `drying` or `off` | |
| `power_w`, `energy_kwh`, `voltage`, `current_a` | Energy readings | W, kWh, V, A |
| `battery_pct`, `battery_low` | Battery left, and whether it needs replacing soon | %, bool |
| `volume`, `muted` | Media volume and mute | %, bool |
| `state` | A media player's playback: `playing`, `paused`, `stopped`, `idle` or `buffering` | |
| `media_title`, `media_artist`, `media_album` | What is playing | |
| `media_position`, `media_duration` | How far in, and how long | seconds |
| `active` | A scene is what its devices show now | bool |

Temperatures are always °C on the bus. Showing °F is the app's job, from each person's setting.

`GET /api/v1/system/vocabulary-check` compares every automation step and every device with these names and with what each device accepts. It lists old names, units that differ from the standard, and steps that call something a device doesn't have. It only reports and changes nothing.

## `device_id` vs `canonical_name`

HomeCore distinguishes three kinds of names:

- `device_id`: the plugin-owned internal ID used on MQTT topics and at runtime
- `canonical_name`: the stable HomeCore name meant for rules, API consumers and logs
- `name`: the display label people see (or `name_override`, when you set one)

Example:

```json
{
  "device_id": "hue_001788fffe6841b3_light_1",
  "canonical_name": "living_room.floor_lamp",
  "name": "Floor Lamp"
}
```

When you write rules, prefer `canonical_name`. Keep `device_id` for low-level API work, debugging, or when you need the exact plugin identifier. HomeCore generates a canonical name from the area and name (`area.name`) when a device has none, and keeps it unique.

### Why this exists

Display names are not always unique. You may have:

- `Floor Lamp` in the living room
- `Floor Lamp` in the bedroom
- two separate `Floor Lamp` devices in the same room

`canonical_name` gives each one a readable, stable reference for automations, so rules don't have to hardcode plugin IDs.

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

# Filter by device type
curl -s "http://localhost:8080/api/v1/devices?device_type=media_player" \
  -H "Authorization: Bearer $TOKEN" | jq '.[].device_id'

# Include resolved capability schema inline
curl -s "http://localhost:8080/api/v1/devices?device_type=media_player&include_schema=true" \
  -H "Authorization: Bearer $TOKEN" | jq '.[].name'
```

### Get one device

```bash
curl -s http://localhost:8080/api/v1/devices/yolink_front_door \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Get device capability schema

```bash
curl -s http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_light_1/schema \
  -H "Authorization: Bearer $TOKEN" | jq
```

A schema lets a client render a device it has never seen before. It has three parts.

**`attributes`** describe what the device reports and, where `writable` is true, what it accepts. Each carries a `kind` that picks a control, plus `unit`, `min`, `max`, `step` and `options` where they apply. Two fields say more than the value alone:

- `states` names both sides of a boolean in the device's own words (`open`/`closed`, `locked`/`unlocked`, `motion`/`clear`), with the verb a trigger reads ("when the door *opens*"). A boolean is really two events. Without names for both, a client ends up showing something like "open, but Not" for the other half.
- `category` says what a reading is *for* when that differs from what the device is for: `diagnostic` for battery, signal, firmware, IP address and model, and `config` for a setting. When `category` is absent, the reading is primary. A door lock reports whether it is locked and also its battery, and a client that renders both the same way buries the one you came for.

**`primary`** lists the readings the device exists for, most important first. A temperature and humidity sensor leads with `temperature`; a multi-sensor that reports motion leads with `motion`. HomeCore derives this from the device type unless the plugin declared its own order, so a client with one row to fill doesn't have to guess.

**`actions`** are commands that aren't attribute writes: a scene's `activate`, a shade's `raise`, `lower` and `stop`, a keypad's `press_button`. Each has a label, an optional icon and its parameters, so a rule editor can offer them without knowing the brand.

```json
{
  "primary": ["temperature", "humidity"],
  "attributes": {
    "temperature": { "kind": "float", "writable": false, "unit": "°C" },
    "humidity":    { "kind": "float", "writable": false, "unit": "%" },
    "battery_pct": { "kind": "float", "writable": false, "unit": "%",
                     "category": "diagnostic" }
  }
}
```

A device with no schema returns `404` with `{"error": "schema not found"}`. That isn't a fault: a plugin declares what it knows, and some devices predate schemas. An *empty* attribute set means something else. A momentary output such as a pulsed contact closure has nothing to read, and the empty set says so.

### Command a device

`PATCH /devices/{id}/state` sends a command to the device over MQTT and answers `202 Accepted` with `{"status": "accepted"}`.

```bash
# Turn a light on
curl -s -X PATCH http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_light_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true, "brightness_pct": 80}'

# Unlock a door
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_lock_front/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locked": false}'
```

The command is published to `homecore/devices/{id}/cmd`. The plugin acts on it and publishes the updated state back; the device reporting the new state is what confirms the command.

A command takes one of two shapes: a write to a writable attribute, as above, or a declared action such as `{"action": "start", "duration_secs": 600}`. The older `{"command": …}` form is retired, though HomeCore's own devices still accept it from older automations.

Media players are mostly driven by actions. Examples:

```bash
# Start playback on a media player
curl -s -X PATCH http://localhost:8080/api/v1/devices/sonos_living_room/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "play"}'

# Play a Sonos favorite by name
curl -s -X PATCH http://localhost:8080/api/v1/devices/sonos_living_room/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "play_favorite", "favorite": "Dinner Jazz"}'

# Use the generic media command shape
curl -s -X PATCH http://localhost:8080/api/v1/devices/sonos_living_room/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "play_media", "media_type": "playlist", "name": "Dinner"}'
```

The device ID stays the same inside HomeCore, and the plugin handles the Sonos-specific lookup and transport details itself.

### Update device metadata

Change the display name, area, canonical name or presentation hint without touching state:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/yolink_front_door \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Front Door Sensor", "area": "entryway", "canonical_name": "entryway.front_door"}'
```

`name` and `area` set the overrides (`name_override`, `area_override`), never the plugin's own values, so a rename survives the plugin registering the device again. Send `null` or an empty string to clear an override and go back to whatever the bridge calls the device. An area that doesn't exist yet is created with the spelling you typed. The body also accepts `ui_hint`, `status_icon` and `button_names`.

### Canonical naming guidance

Good canonical names are:

- lowercase
- stable over time
- qualified with the area when that helps
- descriptive enough to avoid collisions

Examples:

- `living_room.floor_lamp`
- `bedroom.floor_lamp`
- `living_room.floor_lamp_sofa`

Avoid temporary or positional labels that are likely to change.

### Delete a device

Deleting a device cascades to every rule that references it. Those rules are disabled, the reference is replaced with a `DELETED:{device_id}` placeholder, and the rule records the reason.

```bash
curl -s -X DELETE http://localhost:8080/api/v1/devices/old_sensor \
  -H "Authorization: Bearer $TOKEN" | jq
# → {"deleted": true, "affected_rules": ["Morning lights", "Away mode check"]}
```

A plugin device you delete stays deleted: HomeCore remembers it, and the plugin reporting it again doesn't bring it back. `GET /api/v1/devices/removed` lists the devices kept out, newest first, and `DELETE /api/v1/devices/removed/{id}` lets one return on its plugin's next report, with its recorded history. HomeCore's own helpers and modes aren't remembered, since nothing reports them.

To move rules from an old device to its replacement in one step, use `POST /api/v1/automations/repoint`.

## Bulk operations

### Bulk area assignment

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["sensor_01", "sensor_02", "light_01"], "area": "garage"}' | jq
# → {"updated": 3, "not_found": []}
```

Pass `"area": null` to clear the area on all of them.

### Bulk delete

```bash
curl -s -X DELETE http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["old_sensor_01", "old_sensor_02"]}' | jq
# → {"deleted": 2, "not_found": [], "affected_rules": ["Garage lights"]}
```

### Wipe all devices for one plugin

This removes every device whose `plugin_id` matches, with the same rule cascade. The plugin stays registered, and the devices it still knows about are registered again on its next sync. Use it to clear out stale devices left by plugin development or a reworked plugin config, without dropping the whole state database.

```bash
curl -s -X DELETE http://localhost:8080/api/v1/plugins/plugin.hue/devices \
  -H "Authorization: Bearer $TOKEN" | jq
# → {
#     "deleted": 47,
#     "device_ids": ["hue_light_1", "hue_scene_2", ...],
#     "affected_rules": ["Morning routine"]
#   }
```

Unlike a single or bulk delete, this doesn't add the devices to the removed list, which is why they can come back. It needs the `devices:write` scope.

## Device history

Attribute changes over time are stored in SQLite (`data/history.db`):

```bash
# Last 24 hours (default)
curl -s "http://localhost:8080/api/v1/devices/thermostat_main/history" \
  -H "Authorization: Bearer $TOKEN" | jq

# Specific attribute, last 7 days
curl -s "http://localhost:8080/api/v1/devices/thermostat_main/history?attribute=temperature&from=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
  -H "Authorization: Bearer $TOKEN" | jq

# Response shape (newest first)
# [{"attribute":"temperature","value":22.3,"recorded_at":"2026-03-28T14:00:00Z"}, ...]
```

| Parameter | Default | Description |
|---|---|---|
| `from` | 24 hours ago | ISO-8601 UTC start |
| `to` | now | ISO-8601 UTC end |
| `attribute` | all | Filter to one attribute |
| `limit` | 500 | Maximum rows read (cap 5000) |
| `max_points` | none | Reduce each attribute's series to at most this many points, keeping its shape |

`limit` counts rows read, so without `max_points` a longer window gives you a *shorter* series, cut off wherever the limit fell. With `max_points`, each numeric series is downsampled so a week-long chart still shows its spikes; when `max_points` is set and `limit` isn't, HomeCore reads up to the 5000-row cap. The `X-Total-Count` header is the number of rows read, and `X-Truncated` says whether the read hit its limit.

## Areas

Assign devices to rooms:

```bash
# List areas
curl -s http://localhost:8080/api/v1/areas \
  -H "Authorization: Bearer $TOKEN" | jq

# Create an area
curl -s -X POST http://localhost:8080/api/v1/areas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Living Room"}' | jq

# Assign devices to an area (the body is a plain array of device IDs)
curl -s -X PUT http://localhost:8080/api/v1/areas/AREA_ID/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '["light_living_room_1", "light_living_room_2"]' | jq
```

An area keeps the name as you typed it ("TV Room") and a slug (`tv_room`) that devices carry. `PATCH /areas/{id}` renames one and `POST /areas/{id}/merge` merges two; the old slugs stay as aliases, so a bridge that still reports the old room name lands its devices in the right place.

## Device IDs by plugin

| Plugin | Device ID pattern | Example |
|---|---|---|
| hc-hue (light) | `hue_{bridge_id}_light_{resource_id}` | `hue_001788fffe6841b3_light_1` |
| hc-hue (group, scene) | `hue_{bridge_id}_group_{id}`, `hue_{bridge_id}_scene_{id}` | `hue_001788fffe6841b3_scene_abc123` |
| hc-yolink | `yolink_{device_id}` | `yolink_d88b4c01000e82eb` |
| hc-lutron (devices, Picos included) | `lutron_{integration_id}` | `lutron_21` |
| hc-lutron (scenes) | `lutron_scene_{name}` | `lutron_scene_oh1_door_phantom` |
| hc-caseta | `caseta_{integration_id}`, `caseta_scene_{name}` | `caseta_12` |
| hc-zwave | `zwave_{node_id}` | `zwave_23` |
| hc-sonos | `sonos_{speaker_name}` | `sonos_living_room` |
| hc-wled (discovered) | `wled_{last six hex digits of the MAC}` | `wled_a1b2c3` |
| hc-isy (devices and scenes) | `isy_{address}` | `isy_13_a6_99_1` |
| Timers | `timer_{name}` | `timer_garage_close` |
| Switches | `switch_{name}` | `switch_away_mode` |
| Modes | `mode_{name}` | `mode_night` |

Names in an ID are lowercased, with anything that isn't a letter or digit turned into `_`.

## Media players

HomeCore treats `media_player` as a built-in device type. A plugin can discover players and register them without manual configuration, and they then show up in:

- `GET /api/v1/devices`
- `GET /api/v1/devices?device_type=media_player`
- rules using `set_device_state`
- scenes and any UI built on the device registry

A Sonos player, for example, reports its playback `state` and `media_position`, `volume` and `muted`, what is playing (`media_title`, `media_artist`, `media_album`), its group, and the Sonos favorites and playlists it found. Artwork is available from `GET /api/v1/devices/{id}/media/art`, which HomeCore fetches from the speaker and serves from its own origin so a browser can load it.

Rules can then refer to a logical device such as `sonos_living_room` instead of embedding `http://speaker-ip:port/...` URLs in automation logic.
