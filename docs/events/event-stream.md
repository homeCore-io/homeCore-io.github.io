---
id: event-stream
title: Event Stream
sidebar_label: Event Stream
sidebar_position: 1
---

# Event Stream

HomeCore exposes a real-time WebSocket feed of all system events.

## Connecting

```bash
# Install websocat once
cargo install websocat

# Connect — all events
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN"

# Filter to specific event types
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=rule_fired,scene_activated"

# Filter to one device
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&device_id=yolink_garage_door"

# Combine filters
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=device_state_changed&device_id=thermostat_main"
```

**Authentication:** Browsers cannot send custom headers during WebSocket upgrade, so the JWT is passed as `?token=`. The token is validated before the upgrade is accepted — invalid tokens return HTTP 401.

## Query parameters

| Parameter | Example | Description |
|---|---|---|
| `token` | `?token=eyJ...` | JWT (required unless IP is whitelisted) |
| `type` | `?type=rule_fired,device_state_changed` | Comma-separated event type names to forward |
| `device_id` | `?device_id=yolink_abc123` | Only events for this device |

When `type` is omitted, all events are forwarded (except `mqtt_message`, which is internal only).

## Event type reference

| Event type | Emitted when |
|---|---|
| `device_state_changed` | Device attribute changes (from MQTT state update) |
| `device_availability_changed` | Device comes online or goes offline |
| `device_name_changed` | Device display name updated |
| `rule_fired` | A rule's conditions passed and actions executed |
| `scene_activated` | A scene was activated |
| `plugin_registered` | A plugin connected and registered devices |
| `plugin_offline` | A plugin's heartbeat expired |
| `plugin_heartbeat` | A plugin sent a liveness heartbeat |
| `plugin_status_changed` | A managed plugin's status changed (starting/active/offline/stopped) |
| `device_command_sent` | A command was dispatched to a device |
| `timer_state_changed` | A virtual timer started, paused, expired, etc. |
| `action_failed` | A rule action failed to execute |
| `hub_variable_changed` | A hub variable was written |
| `mode_changed` | A named mode transitioned on/off |
| `custom_{event_type}` | A `FireEvent` action emitted a custom event |
| `system_started` | Rule engine finished startup initialization |

## Event envelope

All events follow the same JSON envelope:

```json
{
  "type": "device_state_changed",
  "timestamp": "2026-03-28T14:22:00Z",
  ...event-specific fields...
}
```

## Enriched fields per event type

### `device_state_changed`

```json
{
  "type": "device_state_changed",
  "timestamp": "2026-03-28T14:22:00Z",
  "device_id": "yolink_front_door",
  "previous": {"open": false, "battery": 85},
  "current":  {"open": true,  "battery": 85},
  "changed":  ["open"]
}
```

### `rule_fired`

```json
{
  "type": "rule_fired",
  "timestamp": "2026-03-28T14:22:01Z",
  "rule_id": "550e8400-e29b-41d4-a716-446655440000",
  "rule_name": "Front door alert",
  "trigger_type": "DeviceStateChanged",
  "trigger_context": {
    "device_id": "yolink_front_door",
    "attribute": "open",
    "value": true
  },
  "trigger_label": "front door opened"
}
```

### `device_availability_changed`

```json
{
  "type": "device_availability_changed",
  "timestamp": "2026-03-28T14:22:00Z",
  "device_id": "hue_001788fffe6841b3_1",
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

### `hub_variable_changed`

```json
{
  "type": "hub_variable_changed",
  "timestamp": "2026-03-28T14:22:00Z",
  "name": "alarm_armed",
  "value": true,
  "previous_value": false
}
```

## REST event log

`GET /api/v1/events` returns the last N events from the in-memory ring buffer (not persisted):

```bash
# Last 50 events (default)
curl -s http://localhost:8080/api/v1/events \
  -H "Authorization: Bearer $TOKEN" | jq

# Filter by type
curl -s "http://localhost:8080/api/v1/events?type=rule_fired" \
  -H "Authorization: Bearer $TOKEN" | jq

# Filter by device
curl -s "http://localhost:8080/api/v1/events?device_id=yolink_front_door" \
  -H "Authorization: Bearer $TOKEN" | jq

# Limit
curl -s "http://localhost:8080/api/v1/events?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Common filter recipes

```bash
# Watch all rule fires in real time
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=rule_fired"

# Debug a specific device — all events
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&device_id=thermostat_main"

# Watch door sensors only
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=device_state_changed&device_id=yolink_garage_door"

# Watch mode changes
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=mode_changed"

# Watch plugin connects/disconnects
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN&type=plugin_registered,plugin_offline"
```
