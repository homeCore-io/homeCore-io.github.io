---
id: event-stream
title: Event Stream
sidebar_label: Event Stream
sidebar_position: 1
---

# Event Stream

homeCore publishes everything that happens in the house as events. You can read them live over a WebSocket, or read the most recent ones over REST. The web app's **Settings › Events** page shows the same stream in words.

The live stream is only available as a WebSocket; homeCore has no Server-Sent Events (SSE) version of it. The one SSE endpoint, `GET /api/v1/plugins/{id}/command/{request_id}/stream`, carries the progress of a single plugin action.

## Connecting

```bash
# Install websocat once
cargo install websocat

# Connect: all events
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN"

# Filter to specific event types
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=rule_fired,scene_activated"

# Filter to one device
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&device_id=yolink_garage_door"

# Combine filters
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=device_state_changed&device_id=thermostat_main"
```

Browsers can't set headers on a WebSocket upgrade, so the credential goes in `?token=`. It can be a JWT or an API key. homeCore checks it before accepting the upgrade, and a missing or invalid token gets HTTP 401. A connection from an address on `[auth].whitelist` may leave the token out. When a token is given, homeCore judges the connection by the token, even from a whitelisted address, the same as for REST.

The stream only goes one way. The server sends a ping every 30 seconds and closes a connection that hasn't answered the previous one. Admins can list open connections with `GET /api/v1/ws/connections`.

## Query parameters

| Parameter | Example | Description |
|---|---|---|
| `token` | `?token=eyJ...` | JWT or API key (required unless the address is whitelisted) |
| `type` | `?type=rule_fired,device_state_changed` | Comma-separated event types to forward |
| `device_id` | `?device_id=yolink_abc123` | Only events about this device |
| `snapshot` | `?snapshot=true` | Send the house as it stands as the first frame (see below) |
| `client_id` | `?client_id=kitchen-panel` | Label that shows in the list of open connections |

Without `type`, every event is forwarded except `plugin_heartbeat` and `plugin_alerts`. Those two are frequent, so you get them only by naming them in `type`. Raw MQTT messages never reach the stream.

`device_id` matches the device an event is about: `device_id` on device events, the device inside `device_added` and `device_metadata_changed`, `timer_id` on `timer_state_changed`, and the alert's device on `alert_raised` and `alert_cleared`. Other events have no device and are dropped by this filter.

### Snapshot

With `snapshot=true`, the first frame is the house as it is now:

```json
{"type": "snapshot", "timestamp": "…", "devices": […], "rooms": […], "scenes": […], "alerts": […]}
```

Each device includes its `schema`, as `GET /devices?include_schema=true` returns it. A section appears only if you may read it: `devices` and `alerts` need `devices:read`, `rooms` needs `areas:read`, and `scenes` needs `scenes:read`. An empty list always means there are none.

homeCore subscribes to the stream before it reads the snapshot, so nothing in between is lost. Changes made meanwhile arrive as events after the snapshot and may repeat what it already shows. Applying events in order on top of the snapshot ends at the current state. With the device, room and scene events below, a client holding the snapshot never needs to reload to stay correct.

### Falling behind

A client too slow to keep up misses events. If it asked for a snapshot, it is sent a fresh one with `"missed": n`. Otherwise it gets `{"type": "lagged", "missed": n}` so it knows to read again.

## Event envelope

Every event is a JSON object with its `type` and a `timestamp` (RFC 3339, UTC), followed by the fields for that type:

```json
{
  "type": "device_state_changed",
  "timestamp": "2026-03-28T14:22:00Z",
  ...event-specific fields...
}
```

## Event types

| Event type | Sent when | Main fields |
|---|---|---|
| `device_state_changed` | A device's attributes changed | `device_id`, `device_name`, `previous`, `current`, `changed`, `change` |
| `device_availability_changed` | A device went online or offline, including when a new device's first report brings it up | `device_id`, `device_name`, `available` |
| `device_name_changed` | A device was renamed at its source | `device_id`, `previous_name`, `current_name` |
| `device_added` | A device joined the registry | `device` (the whole record) |
| `device_removed` | A device was removed | `device_id` |
| `device_metadata_changed` | Something other than its readings changed: name, room, type, `ui_hint`, `security`, icon, button names, hardware details | `device` (the whole record) |
| `device_schema_changed` | A device's schema changed | `device_id`, `attributes`, `actions` |
| `device_command_sent` | A rule sent a command to a device | `device_id`, `command`, `source`, `source_id`, `correlation_id` |
| `device_battery_low` | A battery dropped to or below the threshold (with hysteresis) | `device_id`, `device_name`, `battery_pct`, `threshold_pct` |
| `device_battery_recovered` | A low battery climbed back above the recovery band | `device_id`, `device_name`, `battery_pct` |
| `room_changed` | A room was created, renamed or gained an alias | `room` |
| `room_removed` | A room was deleted or merged into another | `room_id`, `merged_into` |
| `room_lights_changed` | Room on or Room off ran | `room_id`, `room_name`, `on`, `lights`, `scenes`, `snapshot_saved`, `snapshot_used`, `source` |
| `scene_activated` | A native scene was activated | `scene_id`, `scene_name` |
| `scene_changed` | A native scene was created or edited | `scene` |
| `scene_removed` | A native scene was deleted | `scene_id` |
| `rule_fired` | A rule's conditions passed and its actions ran | `rule_id`, `rule_name`, `trigger_type`, `action_count` |
| `rule_changed` | A rule was created or changed through the API | `rule` |
| `rule_removed` | A rule was deleted through the API | `rule_id` |
| `action_failed` | A rule action failed | `rule_id`, `rule_name`, `action_index`, `action_type`, `error` |
| `mode_changed` | A mode turned on or off | `mode_id`, `mode_name`, `on` |
| `timer_state_changed` | A timer started, paused, finished, was canceled, and so on | `timer_id`, `timer_name`, `state`, `remaining_secs` |
| `alert_raised` | An alert was raised, or what an active one says changed | `alert`, `update` |
| `alert_cleared` | An alert's condition ended | `alert_id`, `device_id`, `alert` |
| `alert_acknowledged` | Someone marked an alert as seen | `alert` |
| `plugin_registered` | A plugin connected and registered | `plugin_id` |
| `plugin_offline` | A plugin went offline or said it was stopping | `plugin_id` |
| `plugin_status_changed` | A managed plugin's status changed | `plugin_id`, `status`, `previous_status` |
| `plugin_heartbeat` | A plugin sent a heartbeat (only when named in `type`) | `plugin_id`, `version`, `uptime_secs`, `device_count` |
| `plugin_capabilities` | A plugin published its capabilities (actions, settings form, screens, alert kinds) | `plugin_id`, `capabilities` |
| `plugin_alerts` | A plugin reported which of its alerts are true (only when named in `type`) | `plugin_id`, `device_id`, `alerts` |
| `custom` | A custom event: from a `FireEvent` action, a webhook, a hub variable change, or startup | `event_type`, `payload` |

Clients normally use `alert_raised` and `alert_cleared` rather than `plugin_alerts`, since homeCore has already decided what counts. The event model also defines `system_alert` and `rule_evaluation_failed`, but nothing in homeCore sends them.

## Event fields

### `device_state_changed`

```json
{
  "type": "device_state_changed",
  "timestamp": "2026-03-28T14:22:00Z",
  "device_id": "yolink_front_door",
  "device_name": "Front Door",
  "previous": {"open": false, "battery_pct": 85},
  "current":  {"open": true,  "battery_pct": 85},
  "changed":  ["open"],
  "change": {
    "changed_at": "2026-03-28T14:22:00Z",
    "kind": "physical",
    "source": "plugin.yolink"
  }
}
```

`changed` lists the attributes that were added, updated or removed. `change` says where the update came from. Its `kind` is `homecore`, `physical`, `external` or `unknown`, and `source`, `actor_id`, `actor_name` and `correlation_id` appear when known.

### `rule_fired`

```json
{
  "type": "rule_fired",
  "timestamp": "2026-03-28T14:22:01Z",
  "rule_id": "550e8400-e29b-41d4-a716-446655440000",
  "rule_name": "Front door alert",
  "trigger_type": "DeviceStateChanged",
  "action_count": 2,
  "elapsed_ms": 4,
  "correlation_id": "8f0c2a5e-1d3b-4c55-9a51-0b7e6f2d9c11"
}
```

`elapsed_ms` and `correlation_id` appear when known.

### `device_availability_changed`

```json
{
  "type": "device_availability_changed",
  "timestamp": "2026-03-28T14:22:00Z",
  "device_id": "hue_001788fffe6841b3_light_1",
  "device_name": "Floor Lamp",
  "available": false
}
```

### `room_lights_changed`

```json
{
  "type": "room_lights_changed",
  "timestamp": "2026-03-28T22:10:00Z",
  "room_id": "2f6c1d0e-8b1a-4c3e-9a77-5d0f0e2b9c41",
  "room_name": "Living Room",
  "on": false,
  "lights": ["hue_001788fffe6841b3_light_1", "lutron_21"],
  "snapshot_saved": true,
  "snapshot_used": false,
  "source": "api"
}
```

`source` is `api` or `rule`. `scenes` lists the scenes Room on activated, and is left out when there are none.

### `scene_activated`

```json
{
  "type": "scene_activated",
  "timestamp": "2026-03-28T14:22:00Z",
  "scene_id": "550e8400-e29b-41d4-a716-446655440001",
  "scene_name": "Movie night"
}
```

### `mode_changed`

```json
{
  "type": "mode_changed",
  "timestamp": "2026-03-28T19:41:00Z",
  "mode_id": "mode_night",
  "mode_name": "Night Mode",
  "on": true
}
```

### `timer_state_changed`

```json
{
  "type": "timer_state_changed",
  "timestamp": "2026-03-28T14:32:00Z",
  "timer_id": "timer_garage_close",
  "timer_name": "Garage close delay",
  "state": "finished",
  "remaining_secs": 0
}
```

### `device_battery_low`

```json
{
  "type": "device_battery_low",
  "timestamp": "2026-04-27T14:22:00Z",
  "device_id": "yolink_d88b4c0400064299",
  "device_name": "Front door sensor",
  "battery_pct": 18.0,
  "threshold_pct": 20.0
}
```

### `device_battery_recovered`

```json
{
  "type": "device_battery_recovered",
  "timestamp": "2026-04-30T09:14:23Z",
  "device_id": "yolink_d88b4c0400064299",
  "device_name": "Front door sensor",
  "battery_pct": 92.0
}
```

### `alert_raised`

```json
{
  "type": "alert_raised",
  "timestamp": "2026-03-28T14:30:00Z",
  "alert": {
    "id": "wet:yolink_d88b4c0400064300",
    "kind": "wet",
    "device_id": "yolink_d88b4c0400064300",
    "message": "Laundry leak sensor: wet",
    "reason": "Wet",
    "severity": "critical",
    "raised_at": "2026-03-28T14:29:58Z",
    "device_plugin_id": "plugin.yolink"
  }
}
```

`update: true` marks an alert that was already active but now says something different, for example because someone acknowledged it. See [Alerts](./alerts.md) for every field.

### Custom events

A custom event has `type` `custom`, with its own name in `event_type` and its data in `payload`. Filter for them with `type=custom`. homeCore sends a few of its own:

| `event_type` | Sent when | `payload` |
|---|---|---|
| `system_started` | The rule engine finished starting | `{}` |
| `hub_variable_changed` | A rule set a hub variable | `{"name", "value", "prev_value"}` |
| `webhook` | A webhook was received | `{"path", "body", "query"}` |
| your own name | A `FireEvent` action ran | the action's payload |

```json
{
  "type": "custom",
  "timestamp": "2026-03-28T14:22:00Z",
  "event_type": "hub_variable_changed",
  "payload": {"name": "alarm_armed", "value": true, "prev_value": false}
}
```

## REST event log

`GET /api/v1/events` returns recent events from a buffer in memory that holds the last 1000. It isn't saved, so it starts empty after a restart. It leaves out `plugin_heartbeat`. Reading it needs `devices:read`.

```bash
# Last 50 events (default; at most 1000)
curl -s http://localhost:8080/api/v1/events \
  -H "Authorization: Bearer $TOKEN" | jq

# Filter by type (comma-separated)
curl -s "http://localhost:8080/api/v1/events?type=rule_fired" \
  -H "Authorization: Bearer $TOKEN" | jq

# Filter by device
curl -s "http://localhost:8080/api/v1/events?device_id=yolink_front_door" \
  -H "Authorization: Bearer $TOKEN" | jq

# Limit
curl -s "http://localhost:8080/api/v1/events?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq
```

Entries come newest first. Each one wraps the event:

```json
{"seq": 4812, "event_type": "rule_fired", "event": {"type": "rule_fired", "timestamp": "…", "rule_name": "Front door alert", …}}
```

`seq` counts up from 1 since the last start. Entries for events about a device also carry `device_id`, matched the same way as the stream's `device_id` filter.

For longer records, use [device history](../devices/overview.md#device-history) for attribute values over time.

## Common filters

```bash
# Watch all rule fires in real time
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=rule_fired"

# Debug a specific device: all its events
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&device_id=thermostat_main"

# Watch one door sensor's state changes only
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=device_state_changed&device_id=yolink_garage_door"

# Watch mode changes
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=mode_changed"

# Watch plugins connect and go offline
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=plugin_registered,plugin_offline"

# Watch alerts come and go
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=alert_raised,alert_cleared,alert_acknowledged"
```
