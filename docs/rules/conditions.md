---
id: conditions
title: Conditions
sidebar_label: Conditions
sidebar_position: 3
---

# Conditions

Conditions are optional checks that must **all pass** (AND logic) for a rule's actions to execute. The rule can have zero conditions — it fires on every matching trigger event.

Conditions are evaluated in order. The first failure short-circuits — remaining conditions are not evaluated.

## Condition reference

### `DeviceState`

Checks the current value of a device attribute in the database.

```toml
[[conditions]]
type      = "device_state"
device    = "entryway.front_door"
attribute = "open"
op        = "Eq"
value     = false   # door must be closed
```

| Field | Description |
|---|---|
| `device` | Preferred device reference: canonical name, unique display name, or raw device ID |
| `device_id` | Backward-compatible alias for `device` |
| `attribute` | Attribute name |
| `op` | Comparison operator |
| `value` | Expected value |

**Operators (`op`):**

| Operator | Meaning |
|---|---|
| `Eq` | Equal to |
| `Ne` | Not equal to |
| `Gt` | Greater than |
| `Gte` | Greater than or equal to |
| `Lt` | Less than |
| `Lte` | Less than or equal to |

**Examples:**

```toml
# Light is off
[[conditions]]
type      = "device_state"
device    = "living_room.main_light"
attribute = "on"
op        = "Eq"
value     = false

# Temperature above 80°F
[[conditions]]
type      = "device_state"
device    = "hallway.thermostat"
attribute = "temperature"
op        = "Gt"
value     = 80

# Motion was detected (any truthy state)
[[conditions]]
type      = "device_state"
device    = "hallway.motion"
attribute = "motion"
op        = "Eq"
value     = true

# Battery level below 20%
[[conditions]]
type      = "device_state"
device    = "entryway.door_sensor"
attribute = "battery"
op        = "Lt"
value     = 20
```

---

### `TimeWindow`

Checks whether the current wall-clock time falls within a window.

```toml
[[conditions]]
type  = "time_window"
start = "08:00"
end   = "22:00"
```

Handles midnight wrap: `start = "22:00"`, `end = "06:00"` correctly covers 10 PM to 6 AM.

---

### `TimeElapsed`

Checks how long an attribute has held its current value. Uses an in-memory per-attribute timestamp cache — zero database I/O.

```toml
[[conditions]]
type          = "time_elapsed"
device        = "garage.main_door"
attribute     = "open"
duration_secs = 600   # 10 minutes
```

Passes if the attribute has been in its current value for at least `duration_secs` seconds.

**Common pattern — alert if door has been open for 10 minutes:**

```toml
[trigger]
type      = "cron"
expression = "0 * * * * *"   # every minute

[[conditions]]
type      = "device_state"
device_id = "yolink_garage_door"
attribute = "open"
op        = "Eq"
value     = true

[[conditions]]
type          = "time_elapsed"
device_id     = "yolink_garage_door"
attribute     = "open"
duration_secs = 600

[[actions]]
type    = "notify"
channel = "telegram"
message = "Garage door has been open for 10+ minutes!"
```

**Startup behavior:** At startup, the timestamp cache is pre-populated from `device.last_seen` as a conservative baseline. `TimeElapsed` may fire sooner than expected on the first evaluation after restart for attributes that have been in their current state for a long time.

---

### `ScriptExpression`

Evaluates a Rhai script expression that must return `true` or `false`.

```toml
[[conditions]]
type   = "script_expression"
script = 'device_state("thermostat")["temperature"] > 75 && hour() < 22'
```

**Available Rhai functions:**

| Function | Returns | Description |
|---|---|---|
| `device_state("device_id")` | map | Current attributes of a device |
| `hour()` | int | Current hour (0-23, local time) |
| `minute()` | int | Current minute (0-59) |
| `weekday()` | int | Day of week (0=Sun, 1=Mon, …, 6=Sat) |
| `is_weekday()` | bool | True if Mon-Fri |
| `is_weekend()` | bool | True if Sat-Sun |

**Examples:**

```toml
# Complex multi-device condition
[[conditions]]
type   = "script_expression"
script = '''
  let garage = device_state("yolink_garage_door");
  let motion = device_state("motion_garage");
  garage["open"] == true && motion["motion"] == false
'''

# Time-based logic not expressible as TimeWindow
[[conditions]]
type   = "script_expression"
script = 'hour() >= 22 || hour() < 6'   # after 10 PM or before 6 AM
```

---

### `Not`

Inverts the result of any wrapped condition.

```toml
[[conditions]]
type = "not"

[conditions.condition]
type      = "device_state"
device_id = "virtual_switch_away_mode"
attribute = "on"
op        = "Eq"
value     = true
```

This reads: "away mode is NOT active."

**Nesting:** `Not` can wrap any condition type, including `ScriptExpression`, `TimeWindow`, or another `Not` (double-negation, unusual but valid).

---

### `ModeIs`

Checks whether a named mode is currently on or off.

```toml
[[conditions]]
type      = "mode_is"
mode_name = "mode_night"
value     = true   # "is mode_night active?"
```

Equivalent to a `DeviceState` check on the mode's virtual device, but more readable.

---

### `PrivateBooleanIs`

Checks a rule-local boolean flag set by `SetPrivateBoolean` action.

```toml
[[conditions]]
type  = "private_boolean_is"
name  = "already_notified"
value = false
```

Used with `SetPrivateBoolean` to prevent duplicate notifications:

```toml
# Only notify once; set the flag to prevent repeated notifications
[[conditions]]
type  = "private_boolean_is"
name  = "already_notified"
value = false

[[actions]]
type    = "notify"
channel = "telegram"
message = "Alert!"

[[actions]]
type  = "set_private_boolean"
name  = "already_notified"
value = true
```

---

### `HubVariableIs`

Checks a hub variable's value. Hub variables are shared across all rules.

```toml
[[conditions]]
type      = "hub_variable_is"
name      = "alarm_armed"
op        = "Eq"
value     = true
```

---

## Combining conditions

All conditions AND together by default. For OR logic, use a `ScriptExpression`:

```toml
# OR: fire if EITHER door is open
[[conditions]]
type   = "script_expression"
script = '''
  device_state("yolink_front_door")["open"] == true ||
  device_state("yolink_back_door")["open"] == true
'''

# Complex AND/OR mix
[[conditions]]
type   = "script_expression"
script = '''
  let night = device_state("mode_night")["on"] == true;
  let temp  = device_state("thermostat")["temperature"];
  night && (temp > 78 || temp < 65)
'''
```

## Condition trace in fire history

Every condition evaluation is recorded in the rule's fire history. For debugging, check:

```bash
curl -s http://localhost:8080/api/v1/automations/RULE_ID/history \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].conditions'
```

Each condition entry includes `passed`, `actual`, `expected`, and a human-readable `reason`.
