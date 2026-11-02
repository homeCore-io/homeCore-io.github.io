---
id: conditions
title: Conditions
sidebar_label: Conditions
sidebar_position: 3
---

# Conditions

Conditions are optional checks that all have to pass before a rule's actions run. A rule with no conditions (`conditions: []`) acts on every matching trigger event.

homeCore evaluates conditions in order and stops at the first one that fails. The rest are not evaluated.

Conditions are written in the same RON and JSON shapes as triggers: the type name, then its fields. Optional fields take `Some(...)` in RON.

```ron
conditions: [
    DeviceState(
        device_id: "entryway.front_door",
        attribute: "open",
        op: Eq,
        value: false,
    ),
],
```

```json
{
  "conditions": [
    { "DeviceState": { "device_id": "entryway.front_door", "attribute": "open", "op": "Eq", "value": false } }
  ]
}
```

The same condition types can also be the question in a `Conditional` action. See [Actions](./actions.md#conditional).

## Condition reference

### `DeviceState`

Compares a device attribute's current value with a fixed value.

```ron
DeviceState(
    device_id: "entryway.front_door",
    attribute: "open",
    op: Eq,
    value: false,   // the door must be closed
),
```

| Field | Description |
|---|---|
| `device_id` (alias `device`) | The device: a canonical name, a unique display name, or a raw device ID. |
| `attribute` | The attribute to read. |
| `op` | The comparison (below). |
| `value` | The value to compare against. |

| `op` | Meaning |
|---|---|
| `Eq` | Equal to |
| `Ne` | Not equal to |
| `Gt` | Greater than |
| `Gte` | Greater than or equal to |
| `Lt` | Less than |
| `Lte` | Less than or equal to |

`Eq` and `Ne` compare any JSON value exactly. `Gt`, `Gte`, `Lt` and `Lte` only work on numbers: if either side isn't a number, the condition fails. The condition also fails when the device or the attribute is missing.

Examples:

```ron
// The light is off
DeviceState(
    device_id: "living_room.main_light",
    attribute: "on",
    op: Eq,
    value: false,
),
```

```ron
// Above 27 °C (temperatures are always °C; the app can show °F)
DeviceState(
    device_id: "hallway.thermostat",
    attribute: "temperature",
    op: Gt,
    value: 27,
),
```

```ron
// Battery below 20 %
DeviceState(
    device_id: "entryway.door_sensor",
    attribute: "battery_pct",
    op: Lt,
    value: 20,
),
```

---

### `TimeWindow`

Passes when the current time, in the configured timezone, falls between `start` and `end`. Both ends are included.

```ron
TimeWindow(
    start: "08:00:00",
    end: "22:00:00",
),
```

Times can be written `"HH:MM:SS"` or `"HH:MM"`. A window that crosses midnight works as expected: `start: "22:00:00", end: "06:00:00"` covers 10 PM to 6 AM.

---

### `TimeElapsed`

Passes when an attribute has held its current value for at least `duration_secs` seconds. homeCore keeps the time of each attribute's last change in memory, so the check does no database work.

```ron
TimeElapsed(
    device_id: "garage.main_door",
    attribute: "open",
    duration_secs: 600,   // 10 minutes
),
```

The usual pattern is a door left open. Run a check every minute and notify once both conditions pass:

```ron
trigger: Cron(
    expression: "0 * * * * *",   // every minute
),
conditions: [
    DeviceState(
        device_id: "yolink_garage_door",
        attribute: "open",
        op: Eq,
        value: true,
    ),
    TimeElapsed(
        device_id: "yolink_garage_door",
        attribute: "open",
        duration_secs: 600,
    ),
],
actions: [
    RuleAction(
        enabled: true,
        action: Notify(
            channel: "telegram",
            message: "Garage door has been open for 10+ minutes!",
        ),
    ),
],
```

As written, this notifies every minute while the door stays open. Add a `PrivateBooleanIs` guard if you want one message.

After a restart, the change times come from what the device record saved (`attributes_changed_at`), so a door that has been open for an hour still counts as open for an hour. For an attribute with no saved change time, homeCore uses the device's `last_seen` time instead. An attribute homeCore has never seen makes the condition fail.

---

### `ScriptExpression`

Runs a Rhai expression that must return `true` or `false`.

```ron
ScriptExpression(
    script: r#"device_state("thermostat")["temperature"] > 24 && current_hour() < 22"#,
),
```

RON raw strings (`r#"..."#`) save you from escaping the quotes inside the script.

Functions available in a condition script:

| Function | Returns | Description |
|---|---|---|
| `device_state("device_id")` | map | The device's current attributes. Use the raw device ID here. |
| `hub_var("name")` | any | A hub variable's value, or nothing if it isn't set. |
| `current_hour()` | int | The current hour, 0 to 23, in the configured timezone. |
| `current_minute()` | int | The current minute, 0 to 59. |
| `current_weekday()` | string | The day as `"Mon"`, `"Tue"` … `"Sun"`. |

The `trigger_*()` functions exist here but return empty values, because conditions don't receive trigger context. To test something about the triggering event, use the rule's `trigger_condition`. See [Triggers: Trigger context in Rhai](./triggers.md#trigger-context-in-rhai).

Examples:

```ron
// Two devices at once
ScriptExpression(
    script: r#"
        let garage = device_state("yolink_garage_door");
        let motion = device_state("motion_garage");
        garage["open"] == true && motion["motion"] == false
    "#,
),
```

```ron
// Weekend mornings
ScriptExpression(
    script: r#"(current_weekday() == "Sat" || current_weekday() == "Sun") && current_hour() < 11"#,
),
```

---

### `Not`

Inverts the result of the condition inside it.

```ron
// Away mode is NOT on
Not(
    condition: DeviceState(
        device_id: "virtual_switch_away_mode",
        attribute: "on",
        op: Eq,
        value: true,
    ),
),
```

`Not` can wrap any condition, including `And`, `Or` and another `Not`.

---

### `ModeIs`

Passes when a mode is on (or off).

```ron
ModeIs(
    mode_id: "mode_night",
    on: true,   // is night mode on?
),
```

| Field | Required | Description |
|---|---|---|
| `mode_id` | yes | The mode's device ID, such as `"mode_night"`. |
| `on` | yes | `true` to require the mode to be on, `false` to require it to be off. |

This reads the mode device's `on` attribute, so it does the same job as a `DeviceState` check on that device with less to write. A mode that doesn't exist counts as off.

---

### `PrivateBooleanIs`

Checks one of this rule's private booleans, which only `SetPrivateBoolean` actions in the same rule can set. A boolean that was never set reads as `false`. They are kept in memory and reset when homeCore restarts.

```ron
PrivateBooleanIs(
    name: "already_notified",
    value: false,
),
```

Together with `SetPrivateBoolean`, this stops a rule from repeating itself:

```ron
// Notify once, then set the flag so later firings stop here
conditions: [
    PrivateBooleanIs(
        name: "already_notified",
        value: false,
    ),
],
actions: [
    RuleAction(
        enabled: true,
        action: Notify(
            channel: "telegram",
            message: "Alert!",
        ),
    ),
    RuleAction(
        enabled: true,
        action: SetPrivateBoolean(
            name: "already_notified",
            value: true,
        ),
    ),
],
```

Clear the flag again (`value: false`) from another branch or another trigger of the same rule when the situation is over.

---

### `HubVariable`

Compares a hub variable with a value. Hub variables are shared by all rules. They are set by `SetHubVariable` actions and kept in memory until homeCore restarts. `GET /api/v1/automations/variables` lists their current values.

```ron
HubVariable(
    name: "alarm_armed",
    op: Eq,
    value: true,
),
```

| Field | Required | Description |
|---|---|---|
| `name` | yes | The hub variable. |
| `op` | yes | `Eq`, `Ne`, `Gt`, `Gte`, `Lt` or `Lte`. |
| `value` | yes | The value to compare against (any JSON type). |

A variable that isn't set fails the condition, whatever the operator.

---

### `DeviceLastChange`

Passes when the most recent change to a device matches the given provenance. Use it to ask whether a person, a rule or a plugin made the change.

```ron
DeviceLastChange(
    device_id: "living_room.lamp",
    kind: Some(physical),        // optional: homecore | physical | external | unknown
    // source: Some("rule"),     // optional: exact source label
    // actor_id: Some("..."),    // optional: exact actor ID
    // actor_name: Some("..."),  // optional: exact actor name
),
```

| Field | Required | Description |
|---|---|---|
| `device_id` (alias `device`) | yes | The device whose last change to inspect. |
| `kind` | no | The kind of change. |
| `source` | no | Exact match on the source label, such as `api`, `rule`, `scene`, `script`, `timer_manager`, or a label a plugin reports. |
| `actor_id` | no | Exact match on the actor ID (a user ID, rule ID or scene ID, when known). |
| `actor_name` | no | Exact match on the actor's name (a username, rule name or scene name, when known). |

Fields you leave out aren't checked. The condition fails if the device has no recorded change.

---

### `CalendarActive`

Passes while an event in a loaded `.ics` calendar is in progress (it has started and not yet ended). Calendars load from `[calendars] dir`.

```ron
CalendarActive(
    calendar_id: Some("us_holidays"),   // optional: .ics filename without the extension
    title_contains: Some("Holiday"),    // optional: case-insensitive
),
```

| Field | Required | Description |
|---|---|---|
| `calendar_id` | no | The `.ics` filename without its extension. Leave it out to match any calendar. |
| `title_contains` | no | Case-insensitive text to look for in the event title. Leave it out to match any event. |

Pair it with a time trigger to make a routine depend on the calendar. For example, load a workdays calendar and add `CalendarActive` with `title_contains: Some("Workday")` so the morning lighting only runs on workdays.

---

### `AlertActive`, `NoAlertActive`, `TriggerAlertActive`

Conditions on homeCore's active alerts. `filter` takes the same `AlertFilter` as the alert triggers (see [Alerts that start automations](./alert-automations.md)). An empty filter matches any alert.

```ron
conditions: [
    // At least one firmware update is waiting
    AlertActive(
        filter: AlertFilter(topic: Some("firmware_update")),
    ),
    // ...and the controller has no warning or worse
    NoAlertActive(
        filter: AlertFilter(
            device_ids: ["wled_1"],
            min_severity: Some(warning),
        ),
    ),
    // ...and the alert that started this rule hasn't cleared yet
    TriggerAlertActive,
],
```

| Condition | Passes when |
|---|---|
| `AlertActive` | At least `at_least` active alerts match `filter`. `at_least` is optional and defaults to 1. |
| `NoAlertActive` | No active alert matches `filter`. |
| `TriggerAlertActive` | The alert that started this rule is still active. It fails for a rule an alert didn't start. |

Ignored alerts don't count, because they were never raised.

---

### `And`

Groups conditions that must all pass. The top-level list already works this way. `And` is for nesting inside `Or`, `Xor` or `Not`.

```ron
And(
    conditions: [
        ModeIs(
            mode_id: "mode_night",
            on: true,
        ),
        TimeWindow(
            start: "22:00:00",
            end: "06:00:00",
        ),
    ],
),
```

---

### `Or`

Passes when at least one of the conditions inside passes. It stops at the first one that does.

```ron
Or(
    conditions: [
        DeviceState(
            device_id: "yolink_front_door",
            attribute: "open",
            op: Eq,
            value: true,
        ),
        DeviceState(
            device_id: "yolink_back_door",
            attribute: "open",
            op: Eq,
            value: true,
        ),
    ],
),
```

---

### `Xor`

Passes when exactly one of the conditions inside passes.

```ron
Xor(
    conditions: [
        DeviceState(
            device_id: "switch_away_mode",
            attribute: "on",
            op: Eq,
            value: true,
        ),
        DeviceState(
            device_id: "switch_vacation_mode",
            attribute: "on",
            op: Eq,
            value: true,
        ),
    ],
),
```

This passes if away mode or vacation mode is on, but not both.

---

## Combining conditions

Top-level conditions are combined with AND. For other logic, nest `And`, `Or`, `Xor` and `Not`, or write the whole test as one `ScriptExpression`:

```ron
// Night, and too warm or too cold
And(
    conditions: [
        ModeIs(
            mode_id: "mode_night",
            on: true,
        ),
        Or(
            conditions: [
                DeviceState(
                    device_id: "thermostat",
                    attribute: "temperature",
                    op: Gt,
                    value: 26,
                ),
                DeviceState(
                    device_id: "thermostat",
                    attribute: "temperature",
                    op: Lt,
                    value: 18,
                ),
            ],
        ),
    ],
),
```

```ron
// The same test as a script
ScriptExpression(
    script: r#"
        let night = device_state("mode_night")["on"] == true;
        let temp  = device_state("thermostat")["temperature"];
        night && (temp > 26 || temp < 18)
    "#,
),
```

## Condition trace in fire history

Every condition evaluation is recorded in the rule's fire history, which keeps the last 20 attempts, newest last. To see the conditions of the most recent attempt:

```bash
curl -s http://localhost:8080/api/v1/automations/RULE_ID/history \
  -H "Authorization: Bearer $TOKEN" | jq '.[-1].conditions'
```

Each entry has `condition_type`, `passed`, `actual`, `expected` and a readable `reason`. Evaluation stops at the first failure, so later conditions don't appear.
