---
id: overview
title: Devices
sidebar_label: Overview
sidebar_position: 1
---

# Devices

A device in homeCore is anything, physical or virtual, with a state you can read and usually command. Plugins register devices over MQTT, and homeCore keeps them in its device registry (`data/state.redb`). homeCore's own helpers and modes are devices too; see [Virtual Devices](./virtual-devices.md).

## The device record

`GET /api/v1/devices/{id}` returns one record:

```json
{
  "device_id": "yolink_d88b4c01000e82eb",
  "canonical_name": "entryway.front_door",
  "name": "Front Door",
  "plugin_id": "plugin.yolink",
  "area": "entryway",
  "room": "entryway",
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
| `device_id` | Unique internal ID, set by the plugin when it registers the device |
| `canonical_name` | Stable homeCore name for rules and logs |
| `name` | Display name as the plugin delivers it. Each registration overwrites it, so a rename in the vendor's own app shows up here. |
| `name_override` | A name you set. It wins over `name` and survives plugin restarts. |
| `plugin_id` | The plugin that owns the device |
| `area` | Room slug as the plugin delivers it (`living_room`). Left out when there is none. |
| `area_override` | A room you set, with the same rules as `name_override` |
| `room` | The room that applies: `area_override` if set, otherwise `area`. Computed on every read; homeCore ignores it if you send it. |
| `device_type` | Category such as `light`, `switch`, `contact_sensor`, `motion_sensor`, `thermostat`, `cover`, `lock`, `scene` or `media_player` |
| `ui_hint` | Presentation hint you set, for example a switch shown as a `light`, or a contact sensor shown as a `door`, `window`, `garage` or `gate` |
| `status_icon` | Icon you picked for the device |
| `security` | Whether the device counts toward the house's security. See [Security](#security). |
| `available` | Whether the device can be reached now. See [Availability](#availability). |
| `last_seen` | Time of the most recent state report |
| `last_change` | Where the most recent update came from (`kind`, `source`, `actor_id`, `actor_name`, `correlation_id`), when known |
| `attributes` | Every current attribute value, as a flat JSON object |
| `attributes_changed_at` | When each attribute last took a different value. `last_seen` moves on every report, so use this to answer "clear for how long?". It survives restarts. |
| `manufacturer`, `model`, `sw_version` | What the device's own system reports about it, when the plugin knows |
| `parent_device_id` | The device this one sits behind (a bulb's bridge, one outlet of a strip). It is informational. homeCore doesn't route anything through it or mark children offline with it. |
| `button_names` | Names you gave a keypad's buttons, keyed by button number |

Optional fields are left out of the JSON when they have no value.

`last_change.kind` is `homecore` (the API, a rule, a scene or a script), `physical` (someone used the device), `external` (another system) or `unknown`.

## Availability

`available` is `false` until a device first reports. Any state report marks it available again. A plugin can also publish `online` or `offline` for a device on `homecore/devices/{id}/availability`. Plugins built on the current SDKs mark their devices offline when they stop, and a plugin that says it is going offline reads offline right away instead of after its heartbeat times out.

Each change emits a `device_availability_changed` event. A device offline for 5 minutes raises an offline [alert](../events/alerts.md).

## Shared attribute names and units

Every plugin publishes and accepts the same names for the same ideas, in the same units. Each plugin converts its device's own scale before publishing and when commanding, so apps, rules and scripts only see these. The list lives in `hc-types` (`device_vocabulary.rs`).

| Name | Meaning | Unit or values |
|---|---|---|
| `on` | On or off. `true` with no level restores the last level. | bool |
| `brightness_pct` | Light level. 0 is off; a light that is on never reports 0. | %, 0 to 100 |
| `color_temp` | White warmth | K (kelvin) |
| `color_xy` | Color as a CIE 1931 point, `{x, y}` | |
| `color_rgb` | Color as sRGB, `{r, g, b}` | 0 to 255 each |
| `transition_ms` | Fade time for the change it is sent with | ms |
| `position` | How open a cover is; 100 is fully open | %, 0 to 100 |
| `tilt_pct` | Slat tilt; 100 is fully open | %, 0 to 100 |
| `locked` | The lock is locked | bool |
| `speed_pct` | Fan speed; 0 is off | %, 0 to 100 |
| `open` | A door, window or contact is open | bool |
| `motion` | Motion seen now | bool |
| `person_detected`, `vehicle_detected`, `animal_detected`, `package_detected` | What a camera's own detection sees now | bool |
| `occupied` | Someone is in the area | bool |
| `water_detected` | A leak sensor is wet | bool |
| `tampered` | The cover or mounting was disturbed | bool |
| `temperature` | The temperature here | °C |
| `humidity` | Relative humidity | %, 0 to 100 |
| `illuminance` | Light level | lux |
| `pressure` | Air pressure | hPa |
| `wind_speed` | Wind speed | m/s |
| `co2` | Carbon dioxide | ppm |
| `setpoint` | A thermostat's single target | °C |
| `heat_setpoint` | Heat below this | °C |
| `cool_setpoint` | Cool above this | °C |
| `hvac_mode` | What the thermostat is set to do | `off`, `heat`, `cool`, `auto`, `fan_only`, `dry` |
| `hvac_action` | What it is doing now | `idle`, `heating`, `cooling`, `fan`, `drying`, `off` |
| `fan_mode` | The thermostat's fan setting | text |
| `power_w` | Power drawn now | W |
| `energy_kwh` | Energy used, counting up | kWh |
| `voltage` | Supply voltage | V |
| `current_a` | Current drawn now | A |
| `battery_pct` | Battery left | %, 0 to 100 |
| `battery_low` | The battery needs replacing soon | bool |
| `volume` | Media volume | %, 0 to 100 |
| `muted` | Sound is muted | bool |
| `state` | A media player's playback | `playing`, `paused`, `stopped`, `idle`, `buffering` |
| `source` | The input or app playing | text |
| `media_title`, `media_artist`, `media_album` | What is playing | text |
| `media_position`, `media_duration` | How far in, and how long | seconds |
| `active` | A scene is what its devices show now | bool |

A number names its unit in a suffix (`_pct`, `_ms`, `_secs`, `_w`, `_kwh`, `_a`, `_mm`) unless it is one of the names above whose unit the table sets. Fades use `_ms`; timers keep `_secs`. An idea only one plugin has, such as a WLED preset or a Hue effect, keeps that plugin's own name.

Older names that these replaced include `brightness` and `level` (now `brightness_pct`), `color_temp_mirek` (now `color_temp`, in kelvin), `contact_open` and `door_open` (now `open`), `occupancy`, `tamper`, `humidity_pct`, `illuminance_lux`, `battery` and `battery_level`, and on thermostats `mode`, `target_temp`, `current_temperature` and `call_for`.

Temperatures are always °C inside homeCore. Showing °F is the app's job, from each person's setting or the household unit (`GET` and `PUT /api/v1/system/temperature-unit`). If a plugin still sends °F or kelvin and says so, either in its schema's `unit` or in a `<name>_unit` value beside the reading, homeCore converts the reading to °C before storing it. Rules, history and every screen then see °C.

`GET /api/v1/system/vocabulary-check` compares every automation, scene and device with these names and with what each device accepts. It lists old names, units that differ from the standard, temperatures homeCore had to convert (under `conversions`), and steps that call something a device doesn't have. It only reports. It changes nothing.

## `device_id`, `canonical_name` and `name`

A device has three names:

- `device_id` is the plugin's internal ID, used on MQTT topics.
- `canonical_name` is the stable homeCore name for rules, API clients and logs.
- `name` is the label people see (or `name_override`, when you set one).

```json
{
  "device_id": "hue_001788fffe6841b3_light_1",
  "canonical_name": "living_room.floor_lamp",
  "name": "Floor Lamp"
}
```

Display names repeat. You might have a Floor Lamp in the living room, another in the bedroom, and two in the same room. The canonical name gives each one a readable reference that doesn't change, so rules don't have to hardcode plugin IDs. When a device has none, homeCore makes one from the room and the name (`area.name`) and keeps it unique.

In rules, prefer `canonical_name`. Use `device_id` for low-level API work, debugging, or when you need the exact plugin identifier.

A good canonical name is lowercase, stays the same over time, and includes the room when that avoids a collision: `living_room.floor_lamp`, `bedroom.floor_lamp`, `living_room.floor_lamp_sofa`. Avoid labels that describe a temporary position.

## Reading devices

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

# One device
curl -s http://localhost:8080/api/v1/devices/yolink_front_door \
  -H "Authorization: Bearer $TOKEN" | jq
```

| Parameter | Description |
|---|---|
| `device_type` | Only devices of this type. Old type names are accepted (`shade` finds `cover`). |
| `include_schema` | `true` adds each device's `schema` to its record |
| `limit`, `offset` | Paging. `X-Total-Count` is the total after the type filter. |

Reading devices needs the `devices:read` scope.

### Capability schema

```bash
curl -s http://localhost:8080/api/v1/devices/hue_001788fffe6841b3_light_1/schema \
  -H "Authorization: Bearer $TOKEN" | jq
```

A schema lets a client show a device it has never seen before. It has three parts.

`attributes` describe what the device reports and, where `writable` is true, what it accepts. Each has a `kind` that picks a control, plus `unit`, `min`, `max`, `step` and `options` where they apply. Two more fields matter:

- `states` names both sides of a boolean in the device's own words (`open`/`closed`, `locked`/`unlocked`, `motion`/`clear`), with the verb a trigger reads ("when the door opens"). Without names for both sides, a client has nothing good to show for the false side.
- `category` says what a reading is for when that differs from the device's purpose. `diagnostic` covers battery, signal, firmware, IP address and model. `config` covers a setting. With no `category`, the reading is primary. A door lock reports whether it is locked and also its battery, and a client should give the lock state more room.

`primary` lists the readings the device exists for, most important first. A temperature and humidity sensor leads with `temperature`; a multi-sensor that reports motion leads with `motion`. homeCore fills this in from the device type unless the plugin declared its own order.

`actions` are commands that aren't attribute writes: a scene's `activate`, a shade's `raise`, `lower` and `stop`, a keypad's `press_button`. Each has a label, an optional icon and its parameters, so a rule editor can offer them without knowing the brand.

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

A device with no schema returns `404` with `{"error": "schema not found"}`. That is normal: a plugin declares what it knows, and some devices predate schemas. An empty attribute set means something different. A momentary output, such as a pulsed contact closure, has nothing to read.

When a schema changes, homeCore emits `device_schema_changed` with the declared attribute and action names.

## Commanding a device

`PATCH /api/v1/devices/{id}/state` sends a command to the device and answers `202 Accepted` with `{"status": "accepted"}`. It needs the `devices:command` scope (`devices:write` includes it).

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

homeCore publishes the command to `homecore/devices/{id}/cmd`. The plugin acts on it and publishes the new state back. That report, not the `202`, is what confirms the command.

A command takes one of two shapes: a write to a writable attribute, as above, or one of the device's declared actions, such as `{"action": "start", "duration_secs": 600}`. The schema's `actions` list says which actions a device has. The older `{"command": …}` form is retired. homeCore's own helpers and modes still accept it from older automations.

Media players are mostly driven by actions:

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

The device ID stays the same, and the plugin handles the Sonos lookup and transport itself.

## Editing a device

`PATCH /api/v1/devices/{id}` changes the display name, room, canonical name and other settings without touching state. It needs `devices:write` and returns the updated record.

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/yolink_front_door \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Front Door Sensor", "area": "entryway", "canonical_name": "entryway.front_door"}'
```

| Key | Effect |
|---|---|
| `name` | Sets `name_override`. `null` or `""` clears it, and so does sending the plugin's own name. |
| `area` | Sets `area_override`. A room that doesn't exist yet is created with the spelling you typed. `null` clears the override. |
| `canonical_name` | Sets the canonical name. It must be unique; a clash answers `422`. `null` makes homeCore generate one. |
| `security` | `true`, `false` or `null`. See [Security](#security). |
| `ui_hint` | Presentation hint. `null` or `""` clears it. |
| `status_icon` | Icon name. `null` or `""` clears it. |
| `button_names` | Object of button number to name, merged into what is there. An empty name resets that button to the bridge's name; `null` resets them all. |

`name` and `area` never change the plugin's own values, so your choice survives the plugin registering the device again. Every edit emits `device_metadata_changed` with the whole record.

In the web app, a device's page under **Settings › Devices** edits the same fields.

### Security

`security` decides whether a device counts toward the house's security: the doors, locks and windows a "is the house secure?" check looks at.

- Left out (the default): follow the device's type. The app counts locks, door, window, garage and gate contacts, and covers that open.
- `true`: count it, whatever its type. Use this for a motion sensor or a shed light you want watched.
- `false`: never count it, for example an interior door.

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_7 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"security": false}'
```

Any other value answers `422` and changes nothing. Plugins never touch the field, so the choice survives restarts. The app sets it under **Security** on a device's page and uses it for **Everywhere › Security**.

## Deleting devices

Deleting a device needs `devices:write`. It also updates every rule that refers to the device: the reference becomes a `DELETED:{device_id}` placeholder, the rule is disabled, and the rule records why.

```bash
curl -s -X DELETE http://localhost:8080/api/v1/devices/old_sensor \
  -H "Authorization: Bearer $TOKEN" | jq
# → {"deleted": true, "affected_rules": ["Morning lights", "Away mode check"]}
```

A plugin device you delete stays deleted. homeCore remembers it, so the plugin reporting it again doesn't bring it back. `GET /api/v1/devices/removed` lists the devices kept out, newest first. `DELETE /api/v1/devices/removed/{id}` lets one return on its plugin's next report, with its recorded history. homeCore's own helpers and modes aren't remembered, since nothing reports them.

To move rules from an old device to its replacement in one step, use `POST /api/v1/automations/repoint`.

`GET /api/v1/devices/orphaned` finds devices a running plugin no longer manages. For each plugin that reports how many devices it has, homeCore compares that count with how many it holds for the plugin. The difference is the orphan count, and the least recently seen devices are listed as suspects. Check the suspects before deleting them.

## Bulk operations

### Move several devices to a room

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["sensor_01", "sensor_02", "light_01"], "area": "garage"}' | jq
# → {"updated": 3, "not_found": []}
```

This sets `area_override` on each device, the same as a single edit. Pass `"area": null` to clear it on all of them.

### Delete several devices

```bash
curl -s -X DELETE http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["old_sensor_01", "old_sensor_02"]}' | jq
# → {"deleted": 2, "not_found": [], "affected_rules": ["Garage lights"]}
```

Rules are updated as for a single delete, and the devices are added to the removed list.

### Wipe all devices for one plugin

This removes every device whose `plugin_id` matches, with the same rule updates. The plugin stays registered, and it registers the devices it still knows about on its next sync. Use it to clear out stale devices left by plugin development or a changed plugin config.

```bash
curl -s -X DELETE http://localhost:8080/api/v1/plugins/plugin.hue/devices \
  -H "Authorization: Bearer $TOKEN" | jq
# → {
#     "deleted": 47,
#     "device_ids": ["hue_light_1", "hue_scene_2", ...],
#     "affected_rules": ["Morning routine"]
#   }
```

These devices are not added to the removed list, which is why they can come back. It needs the `devices:write` scope.

## Device history

homeCore records attribute changes in SQLite (`data/history.db`). Nothing prunes this file, so it grows over time.

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
| `from` | 24 hours ago | RFC 3339 start time |
| `to` | now | RFC 3339 end time |
| `attribute` | all | Only this attribute |
| `limit` | 500 | Most rows read, at most 5000 |
| `max_points` | none | Reduce each attribute's series to at most this many points, keeping its shape |

`limit` counts rows read, newest first. Without `max_points`, a longer window gives you a shorter span of time, cut off wherever the limit fell. With `max_points`, each numeric series is downsampled so a week-long chart still shows its spikes, and if you leave `limit` out homeCore reads up to the 5000-row cap. A series that isn't numeric comes back whole. The `X-Total-Count` header is the number of rows read, and `X-Truncated` says whether the read hit its limit.

## Rooms (areas)

The API calls rooms areas. A room has a fixed `id`, the `name` as you typed it ("TV Room"), and a `slug` (`tv_room`). Devices name their room by slug in `area` and `area_override`. `aliases` holds other slugs that mean the same room: old names after a rename, and rooms merged into it. A bridge that still reports an old room name puts its devices in the right room. `device_ids` lists the devices in the room when you read it.

```bash
# List rooms
curl -s http://localhost:8080/api/v1/areas \
  -H "Authorization: Bearer $TOKEN" | jq

# Create a room (201, or 200 with the existing room of that name)
curl -s -X POST http://localhost:8080/api/v1/areas \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Living Room"}' | jq

# Rename a room (409 if another room has the name; merge instead)
curl -s -X PATCH http://localhost:8080/api/v1/areas/AREA_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Den"}' | jq

# Merge this room into another
curl -s -X POST http://localhost:8080/api/v1/areas/AREA_ID/merge \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"into": "OTHER_AREA_ID"}' | jq

# Set exactly which devices are in the room (a plain array of device IDs)
curl -s -X PUT http://localhost:8080/api/v1/areas/AREA_ID/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '["light_living_room_1", "light_living_room_2"]' | jq

# Delete a room (204)
curl -s -X DELETE http://localhost:8080/api/v1/areas/AREA_ID \
  -H "Authorization: Bearer $TOKEN"
```

`PUT /areas/{id}/devices` replaces the room's list. Devices you add get an `area_override`. Devices you leave out are taken out of the room. Deleting a room takes its devices out of it. Reading rooms needs `areas:read`; changing them needs `areas:write`.

A room the plugin reports that homeCore doesn't have yet is created with the bridge's spelling. Rooms you named yourself are never renamed by a bridge.

Room changes emit `room_changed`, and deletes and merges emit `room_removed`. A device moving between rooms is a `device_metadata_changed` on the device. In the web app, **Settings › Rooms** manages rooms.

### Room on and Room off

```bash
# Turn every light in the room off, saving how they were
curl -s -X POST http://localhost:8080/api/v1/areas/AREA_ID/off \
  -H "Authorization: Bearer $TOKEN" | jq

# Bring them back
curl -s -X POST http://localhost:8080/api/v1/areas/AREA_ID/on \
  -H "Authorization: Bearer $TOKEN" | jq

# What Room off last saved (204 when nothing is saved)
curl -s http://localhost:8080/api/v1/areas/AREA_ID/saved-lights \
  -H "Authorization: Bearer $TOKEN" | jq
```

Room off saves each light's on state, brightness and color, plus which of the room's scenes were active, then turns every light off. Room on activates the saved scenes first, then turns on each saved light that a scene doesn't already cover. With nothing saved, Room on turns every light fully on. The saved state survives restarts and stays after Room on. Only the next Room off that finds a light on replaces it.

A light here is a device of type `light`, or one with `ui_hint` set to `light`. Hue rooms and zones (`group`), scenes, and a camera's own spotlight are left out. Both calls need `devices:command`, return what they did (`lights`, `scenes`, `commands` and whether they saved or used the saved state), and emit `room_lights_changed`. Rules can do the same with the `RoomOn` and `RoomOff` actions.

## Device IDs by plugin

| Plugin | Device ID pattern | Example |
|---|---|---|
| hc-hue (bridge) | `hue_{bridge_id}_bridge` | `hue_001788fffe6841b3_bridge` |
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

Names in an ID are lowercased, with anything that isn't a letter or digit turned into `_`. A Hue `resource_id` is the bridge's own resource ID, usually a UUID.

## Media players

`media_player` is a built-in device type. A plugin can discover players and register them without any setup, and they then appear in `GET /api/v1/devices`, in `?device_type=media_player`, in rules that use `SetDeviceState`, and in scenes.

A Sonos player, for example, reports its playback `state`, `media_position`, `volume` and `muted`, what is playing (`media_title`, `media_artist`, `media_album`), its group, and the Sonos favorites and playlists it found. `GET /api/v1/devices/{id}/media/art` returns the current artwork. homeCore fetches it from the speaker and serves it from its own address, so a browser can load it over HTTPS or from outside the house.

Rules refer to a logical device such as `sonos_living_room` instead of a speaker's address.
