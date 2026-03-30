---
id: triggers
title: Triggers
sidebar_label: Triggers
sidebar_position: 2
---

# Triggers

A trigger defines **what event causes a rule to be evaluated**. Every rule has exactly one trigger.

## Trigger reference

### `DeviceStateChanged`

Fires when any MQTT state publish arrives for a device.

```toml
[trigger]
type      = "device_state_changed"
device    = "entryway.front_door"

# Optional: only fire when this attribute changes
attribute = "open"

# Optional: only fire when the attribute changes TO this specific value
to = true
```

| Field | Required | Description |
|---|---|---|
| `device` | yes | Preferred device reference: canonical name, unique display name, or raw device ID |
| `device_id` | yes | Backward-compatible alias for `device` |
| `attribute` | no | Narrow to one attribute (e.g. `"on"`, `"open"`, `"temperature"`) |
| `to` | no | Only fire when the attribute's new value equals this |

If you use a display name and more than one device matches it, HomeCore marks the rule invalid with an ambiguity error.

**Examples:**

```toml
# Fire on any state change for a device
[trigger]
type      = "device_state_changed"
device    = "hallway.dimmer"

# Fire only when the "on" attribute changes (either direction)
[trigger]
type      = "device_state_changed"
device    = "living_room.floor_lamp"
attribute = "on"

# Fire only when a door opens (open = true)
[trigger]
type      = "device_state_changed"
device    = "garage.main_door"
attribute = "open"
to        = true
```

---

### `TimeOfDay`

Fires at a specific time on specified days of the week. Computed in local wall-clock time.

```toml
[trigger]
type = "time_of_day"
time = "07:30"   # HH:MM
days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
```

Valid day names: `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun`

**Catch-up on restart:** If HomeCore restarts after a `TimeOfDay` trigger's scheduled time, the scheduler fires it immediately if the missed time falls within `catchup_window_minutes` (default 15).

---

### `SunEvent`

Fires at sunrise or sunset, computed locally from your latitude/longitude in config.

```toml
[trigger]
type            = "sun_event"
event           = "sunset"      # "sunrise" | "sunset"
offset_minutes  = -30           # minutes before (-) or after (+) the event
```

**Examples:**

```toml
# At sunrise
[trigger]
type  = "sun_event"
event = "sunrise"

# 30 minutes before sunset
[trigger]
type           = "sun_event"
event          = "sunset"
offset_minutes = -30

# 15 minutes after sunrise
[trigger]
type           = "sun_event"
event          = "sunrise"
offset_minutes = 15
```

---

### `Cron`

Fires on a repeating cron schedule. Uses **6-field expressions** (second, minute, hour, day-of-month, month, day-of-week) evaluated in local wall-clock time.

```toml
[trigger]
type       = "cron"
expression = "0 30 7 * * Mon-Fri"
#             ^  ^  ^ ^ ^  ^
#             s  m  h dom mo dow
```

| Expression | Meaning |
|---|---|
| `0 0 7 * * *` | 7:00 AM every day |
| `0 30 7 * * Mon-Fri` | 7:30 AM weekdays only |
| `0 */15 * * * *` | Every 15 minutes |
| `0 0 */2 * * *` | Every 2 hours |
| `0 0 8 1 * *` | 8:00 AM on the 1st of every month |
| `0 0 20 * * Sat,Sun` | 8:00 PM weekends only |

Rules with invalid cron expressions are **automatically disabled** at startup with an `error` field set.

```bash
# Check for invalid cron rules
curl -s http://localhost:8080/api/v1/automations \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.error | strings | contains("cron")) | {name, error}]'
```

---

### `WebhookReceived`

Fires when an HTTP POST arrives at `/api/v1/webhooks/{path}`. **No authentication required.** The path acts as the shared secret.

```toml
[trigger]
type = "webhook_received"
path = "front-door-bell-a3f9c2"
```

The webhook URL: `POST http://homecore.local/api/v1/webhooks/front-door-bell-a3f9c2`

The request body (if valid JSON) is forwarded as the `body` field in the event payload and accessible in `ScriptExpression` conditions:

```toml
# Condition using webhook body
[[conditions]]
type   = "script_expression"
script = 'event.body["pin"] == "1234"'
```

**Example — trigger from a cloud service:**

```bash
# From Node-RED, IFTTT, Home Assistant, a button device, etc.
curl -X POST http://homecore.local/api/v1/webhooks/front-door-bell-a3f9c2 \
  -H "Content-Type: application/json" \
  -d '{"source": "doorbell", "action": "pressed"}'
```

---

### `CustomEvent`

Fires when a `FireEvent` action emits the matching `event_type`. Enables clean rule chaining — one rule fires an event, other rules react to it **in the same process with no MQTT round-trip**.

```toml
[trigger]
type       = "custom_event"
event_type = "morning_routine_started"
```

This is the primary mechanism for **fan-out** (one event → many parallel reactions) and **pipeline** patterns (chain of rules that each do one thing).

**Example chain:**

```toml
# Rule 1: motion sensor → start morning routine
[trigger]
type      = "device_state_changed"
device_id = "motion_bedroom"
attribute = "motion"
to        = true

[[actions]]
type       = "fire_event"
event_type = "morning_routine_started"
payload    = {}

# Rule 2: morning routine → turn on coffee
[trigger]
type       = "custom_event"
event_type = "morning_routine_started"

[[actions]]
type      = "set_device_state"
device_id = "smart_plug_coffee"
state     = { on = true }

# Rule 3: morning routine → set thermostat
[trigger]
type       = "custom_event"
event_type = "morning_routine_started"

[[actions]]
type      = "set_device_state"
device_id = "thermostat_main"
state     = { target_temp = 70 }
```

---

### `SystemStarted`

Fires **once**, immediately after the rule engine finishes pre-populating its device cache on startup. Use to catch state that may have changed while HomeCore was offline.

```toml
[trigger]
type = "system_started"
```

Always pair with `DeviceState` conditions to guard the action:

```toml
# Alert if garage door was left open across a restart
[trigger]
type = "system_started"

[[conditions]]
type      = "device_state"
device_id = "yolink_garage_door"
attribute = "open"
op        = "Eq"
value     = true

[[actions]]
type    = "notify"
channel = "telegram"
message = "Garage door is OPEN (detected on startup)"
```

---

### `DeviceAvailabilityChanged`

Fires when a device comes online or goes offline.

```toml
[trigger]
type      = "device_availability_changed"
device_id = "hue_001788fffe6841b3_1"

# Optional: only fire in one direction
to = false   # only when device goes offline
```

| `to` | Fires when |
|---|---|
| `true` | Device comes online |
| `false` | Device goes offline |
| *(omitted)* | Either direction |

---

### `MqttMessage`

Fires when a raw MQTT message arrives on a matching topic. Supports MQTT wildcards.

```toml
[trigger]
type          = "mqtt_message"
topic_pattern = "homecore/devices/+/state"   # + = one level
# topic_pattern = "homecore/devices/#"        # # = rest of path
```

Use this for non-standard integrations or when you need to react to any MQTT traffic, not just typed device events.

---

### `ManualTrigger`

Never fires automatically. Only activated via the `/test` dry-run endpoint.

```toml
[trigger]
type = "manual_trigger"
```

Useful for rules that should only ever run when explicitly tested.

---

### `ModeChanged`

Fires when a named mode transitions on or off.

```toml
[trigger]
type      = "mode_changed"
mode_name = "mode_night"
to        = true   # fires when mode_night turns on
```

---

## Trigger context in conditions

For `WebhookReceived` triggers, the request body is available in `ScriptExpression` conditions as `event.body`. For `DeviceStateChanged`, `event.device_id`, `event.attribute`, and `event.value` are available.
