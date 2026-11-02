---
id: event-stream
title: Event Stream
sidebar_label: Event Stream
sidebar_position: 1
---

# Event Stream

HomeCore publishes everything that happens in the house as events, live over a WebSocket and as a short in-memory history over REST. The web app's **Settings → Events** page shows the same stream in words.

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

**Authentication:** browsers can't set headers on a WebSocket upgrade, so the credential goes in `?token=`. It can be a JWT or an API key. HomeCore checks it before accepting the upgrade, and a missing or invalid token gets HTTP 401. A connection from an address on `[auth].whitelist` may leave the token out; when a token is given, it wins over the whitelist, as it does for REST.

The stream is one-way. The server sends a ping every 30 seconds and closes a connection that doesn't answer.

## Query parameters

| Parameter | Example | Description |
|---|---|---|
| `token` | `?token=eyJ...` | JWT or API key (required unless the address is whitelisted) |
| `type` | `?type=rule_fired,device_state_changed` | Comma-separated event type names to forward |
| `device_id` | `?device_id=yolink_abc123` | Only events for this device |
| `snapshot` | `?snapshot=true` | Send the house as it stands as the first frame (see below) |
| `client_id` | `?client_id=kitchen-panel` | Optional label that shows up in the server's list of live connections |

Without `type`, every event is forwarded except `plugin_heartbeat` and `plugin_alerts`, which are frequent and which you get only by naming them in `type`. `mqtt_message` events never reach the stream.

### Snapshot

With `snapshot=true`, the first frame is the house as it is now:

```json
{"type": "snapshot", "timestamp": "…", "devices": […], "rooms": […], "scenes": […], "alerts": […]}
```

Each device carries its `schema` inline, as `GET /devices?include_schema=true` gives it, and each section is present only if you may read it. The stream is subscribed before the snapshot is read, so nothing in between is lost: it arrives as events after the snapshot, possibly repeating what the snapshot already shows. Applying events in order on top of the snapshot ends at the current state, and with the device, room and scene events below, a client holding the snapshot never needs to reload to stay correct.

### Falling behind

A client too slow to keep up misses events. If it asked for snapshots it is sent a fresh one, with `"missed": n`. Otherwise it gets `{"type": "lagged", "missed": n}` so it knows to read again.

## Event type reference

| Event type | Emitted when |
|---|---|
| `device_state_changed` | A device's attributes changed |
| `device_availability_changed` | A device went online or offline, including when a new device's first report brings it up |
| `device_name_changed` | A device's display name changed |
| `device_added` | A device was added to the registry |
| `device_removed` | A device was removed |
| `device_metadata_changed` | A device's name, room, icon or display type was edited |
| `device_schema_changed` | A device's schema changed (attributes or actions added or removed) |
| `device_command_sent` | A rule action sent a command to a device |
| `device_battery_low` | A battery-powered device crossed the low threshold (with hysteresis) |
| `device_battery_recovered` | A device that was low climbed back above the recovery band |
| `room_changed` | A room was added or changed |
| `room_removed` | A room was deleted or merged into another |
| `scene_activated` | A native scene was activated |
| `scene_changed` | A native scene was added or changed |
| `scene_removed` | A native scene was deleted |
| `rule_fired` | A rule's conditions passed and its actions ran |
| `rule_changed` | A rule was added or changed |
| `rule_removed` | A rule was deleted |
| `action_failed` | A rule action failed |
| `mode_changed` | A mode turned on or off |
| `timer_state_changed` | A timer started, paused, finished, was cancelled, and so on |
| `alert_raised` | An alert was raised (or updated) |
| `alert_cleared` | An alert's condition ended |
| `alert_acknowledged` | Someone marked an alert as seen |
| `plugin_registered` | A plugin connected and registered |
| `plugin_offline` | A plugin went offline |
| `plugin_status_changed` | A managed plugin's status changed |
| `plugin_heartbeat` | A plugin sent a liveness heartbeat (only when asked for by `type`) |
| `plugin_capabilities` | A plugin published its capabilities (actions, config descriptor, screens) |
| `plugin_alerts` | A plugin reported alerts (only when asked for by `type`; clients normally use `alert_raised` and `alert_cleared`) |
| `custom` | A custom event: from a `FireEvent` action, a webhook, a hub variable change, or startup (see [Custom events](#custom-events)) |

The event model also defines `system_alert` and `rule_evaluation_failed`, but nothing in HomeCore sends them today.

## Event envelope

Every event is a JSON object with its `type` and a `timestamp`, followed by the fields for that type:

```json
{
  "type": "device_state_changed",
  "timestamp": "2026-03-28T14:22:00Z",
  ...event-specific fields...
}
```

## Fields per event type

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

`change` says where the update came from. `kind` is `homecore`, `physical`, `external` or `unknown`, and `source`, `actor_id`, `actor_name` and `correlation_id` appear when known.

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

### Custom events

A custom event has `type` `custom`, with its own name in `event_type` and its data in `payload`. Filter for them with `type=custom`. HomeCore uses them for a few things of its own:

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

`GET /api/v1/events` returns recent events from an in-memory ring buffer that holds the last 1000. It is not persisted, so it starts empty after a restart. It leaves out `plugin_heartbeat`.

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

Entries come newest first, each wrapping the event:

```json
{"seq": 4812, "event_type": "rule_fired", "event": {"type": "rule_fired", "timestamp": "…", "rule_name": "Front door alert", …}}
```

`device_id` is included on entries for device events.

## Common filter recipes

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
```
