---
id: triggers
title: Triggers
sidebar_label: Triggers
sidebar_position: 2
---

# Triggers

A trigger is the event that makes homeCore evaluate a rule. Every rule has one in `trigger`, and it can list more in `triggers`. Any of them starts the rule.

## How triggers are written

Rule files are RON. Each trigger is written as its type name followed by its fields in parentheses. The REST API uses the same structure in JSON, with the type name as the object key.

```ron
trigger: DeviceStateChanged(
    device_id: "entryway.front_door",
    attribute: Some("open"),
    to: Some(true),
),
```

```json
{
  "trigger": {
    "DeviceStateChanged": {
      "device_id": "entryway.front_door",
      "attribute": "open",
      "to": true
    }
  }
}
```

Two RON details catch people out:

- Optional fields take `Some(...)` in RON: `attribute: Some("open")`, not `attribute: "open"`. Leave an optional field out entirely to mean "not set". JSON needs no wrapper.
- A trigger with no fields is written by name alone: `trigger: SystemStarted` in RON, `"trigger": "SystemStarted"` in JSON.

Fields called `device_id` also accept the spelling `device`. Either one takes a canonical name (`living_room.floor_lamp`), a unique display name (`Kitchen Speaker`) or a raw device ID. If a display name matches more than one device, homeCore disables the rule with an ambiguity error instead of guessing. See [Rules overview](./overview.md#device-references).

### Several triggers

`triggers` holds any number of additional triggers. The rule runs when `trigger` or any entry in `triggers` matches. If one event matches several of them, the rule still runs once. The rule's fire history records which trigger started it.

```ron
trigger: DeviceStateChanged(
    device_id: "living_room.lamp",
    attribute: Some("on"),
    to: Some(true),
),
triggers: [
    DeviceStateChanged(
        device_id: "living_room.lamp",
        attribute: Some("on"),
        to: Some(false),
    ),
    SystemStarted,
],
```

## Trigger reference

### `DeviceStateChanged`

Fires when a device publishes a state update.

```ron
trigger: DeviceStateChanged(
    device_id: "entryway.front_door",
    attribute: Some("open"),   // optional: only this attribute
    to: Some(true),            // optional: only when it changes to this value
),
```

| Field | Required | Description |
|---|---|---|
| `device_id` (alias `device`) | yes | The device to watch. |
| `device_ids` (alias `devices`) | no | More devices. The trigger fires when `device_id` or any of these changes. |
| `attribute` | no | Only react to this attribute (`"on"`, `"open"`, `"temperature"`). |
| `to` | no | Only fire when the new value equals this. |
| `from` | no | Only fire when the previous value equals this. |
| `not_to` | no | Only fire when the new value is not this. |
| `not_from` | no | Only fire when the previous value is not this. |
| `for_duration_secs` | no | Wait this many seconds, then fire only if the value still matches `to` and `not_to`. |
| `change_kind` | no | Only fire for changes of this origin: `homecore`, `physical`, `external` or `unknown`. |
| `change_source` | no | Only fire when the change's source label is exactly this (for example `api`, `rule`, `scene`, `script`, or a label a plugin reports). |

Without `attribute`, the trigger fires on every state update from the device, and `to`, `from`, `not_to` and `not_from` are ignored. With `attribute`, it fires only when that attribute is present in the update and its value differs from the previous one.

About `for_duration_secs`: homeCore waits the full time and then looks at the device's current value once. It does not watch the value in between, so a value that changes away and comes back during the wait still counts. When a rule fires this way, the `trigger_*()` Rhai functions return empty values.

Examples:

```ron
// Any state update from the device
trigger: DeviceStateChanged(
    device_id: "hallway.dimmer",
),
```

```ron
// The "on" attribute changes, in either direction
trigger: DeviceStateChanged(
    device_id: "living_room.floor_lamp",
    attribute: Some("on"),
),
```

```ron
// Any of three contact sensors opens
trigger: DeviceStateChanged(
    device_id: "sensor_front",
    device_ids: ["sensor_back", "sensor_garage"],
    attribute: Some("open"),
    to: Some(true),
),
```

```ron
// Someone flipped the lamp by hand (not a rule or the app)
trigger: DeviceStateChanged(
    device_id: "living_room.lamp",
    attribute: Some("on"),
    change_kind: Some(physical),
),
```

```ron
// Motion reported true, and still true 30 seconds later
trigger: DeviceStateChanged(
    device_id: "motion_hallway",
    attribute: Some("motion"),
    to: Some(true),
    for_duration_secs: Some(30),
),
```

---

### `TimeOfDay`

Fires at a set time on the listed days, in the timezone from `[location] timezone` in `homecore.toml` (UTC when unset).

```ron
trigger: TimeOfDay(
    time: "07:30:00",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
),
```

| Field | Required | Description |
|---|---|---|
| `time` | yes | `"HH:MM:SS"` or `"HH:MM"`. The scheduler works to the minute. |
| `days` | yes | Day names: `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun` (full names such as `Monday` also work). An empty list `[]` means every day. |

Catch-up on restart: if homeCore starts shortly after a scheduled time, it fires the missed trigger at startup when the time falls within `[scheduler] catchup_window_minutes` (default 15, set 0 to turn catch-up off). The same applies to `SunEvent` and `Cron`.

---

### `SunEvent`

Fires at a solar event, computed locally from the latitude and longitude in `[location]`. No internet connection is needed.

```ron
trigger: SunEvent(
    event: Sunset,
    offset_minutes: -30,   // 30 minutes before sunset
),
```

| Field | Required | Description |
|---|---|---|
| `event` | yes | `Sunrise`, `Sunset`, `SolarNoon`, `CivilDawn` or `CivilDusk`. |
| `offset_minutes` | yes | Minutes before (negative) or after (positive) the event. Write `0` for the event itself. |

On a day when the event doesn't happen (polar day or night), the trigger doesn't fire.

```ron
// At sunrise
trigger: SunEvent(
    event: Sunrise,
    offset_minutes: 0,
),
```

```ron
// 15 minutes after civil dusk
trigger: SunEvent(
    event: CivilDusk,
    offset_minutes: 15,
),
```

---

### `Cron`

Fires on a cron schedule. Expressions have six fields (second, minute, hour, day of month, month, day of week) and are evaluated in the configured timezone.

```ron
trigger: Cron(
    expression: "0 30 7 * * Mon-Fri",
    //           s m  h dom mo dow
),
```

| Expression | Meaning |
|---|---|
| `0 0 7 * * *` | 7:00 AM every day |
| `0 30 7 * * Mon-Fri` | 7:30 AM on weekdays |
| `0 */15 * * * *` | Every 15 minutes |
| `0 0 */2 * * *` | Every 2 hours |
| `0 0 8 1 * *` | 8:00 AM on the 1st of every month |
| `0 0 20 * * Sat,Sun` | 8:00 PM on weekends |

The scheduler checks once a minute, so a schedule finer than a minute fires at most once per minute.

At startup, homeCore disables any rule with an invalid cron expression and sets its `error` field to `invalid cron expression: ...`. To list them:

```bash
curl -s http://localhost:8080/api/v1/automations \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.error | strings | contains("cron")) | {name, error}]'
```

---

### `Periodic`

Fires at a fixed interval. Simpler than `Cron` when you only need "every N minutes".

```ron
trigger: Periodic(
    every_n: 15,
    unit: Minutes,   // Minutes | Hours | Days | Weeks
),
```

| Field | Required | Description |
|---|---|---|
| `every_n` | yes | How many units between firings. |
| `unit` | yes | `Minutes`, `Hours`, `Days` or `Weeks`. |

The interval counts from the rule's last firing, which homeCore keeps in memory. A periodic rule added while homeCore is running fires at the next minute tick and then every interval. After a restart, it fires at startup if the interval is no longer than the catch-up window. Otherwise its first firing comes one interval after startup.

---

### `WebhookReceived`

Fires when an HTTP POST arrives at `/api/v1/webhooks/{path}`. This endpoint needs no authentication, so the path works as a shared secret. Pick something hard to guess.

```ron
trigger: WebhookReceived(
    path: "front-door-bell-a3f9c2",
),
```

The URL for this example is `POST http://homecore.local/api/v1/webhooks/front-door-bell-a3f9c2`.

```bash
# Fire it from any HTTP client: a script, a scheduler, another service
curl -X POST http://homecore.local/api/v1/webhooks/front-door-bell-a3f9c2 \
  -H "Content-Type: application/json" \
  -d '{"source": "doorbell", "action": "pressed"}'
```

In Rhai, `trigger_value()` returns the JSON request body (or nothing if there was none) and `trigger_extra()` returns the query-string parameters as a map. These functions work in the rule's `trigger_condition` and `required_expression` and in `RunScript` actions, but not in `ScriptExpression` conditions. To accept only requests carrying a PIN:

```ron
trigger: WebhookReceived(
    path: "front-door-bell-a3f9c2",
),
trigger_condition: Some(r#"trigger_value()["pin"] == "1234""#),
```

---

### `CustomEvent`

Fires when a `FireEvent` action emits an event with the matching `event_type`. This is how one rule hands work to others. The event goes through homeCore's internal event bus, so the other rules react without waiting on the MQTT broker.

```ron
trigger: CustomEvent(
    event_type: "morning_routine_started",
),
```

Use it for fan-out (one event, several rules reacting) and for pipelines (a chain of rules that each do one thing). It also matches the `response_event` that a `PingHost` action fires. A few event names are reserved for other triggers and never reach a `CustomEvent` trigger: `webhook`, `hub_variable_changed`, `calendar_event`, `system_started` and `mode_changed`.

A chain of three rules, shown as the parts that differ:

```ron
// Rule 1: bedroom motion starts the morning routine
trigger: DeviceStateChanged(
    device_id: "motion_bedroom",
    attribute: Some("motion"),
    to: Some(true),
),
actions: [
    RuleAction(
        enabled: true,
        action: FireEvent(
            event_type: "morning_routine_started",
            payload: {},
        ),
    ),
],
```

```ron
// Rule 2: the routine turns on the coffee maker
trigger: CustomEvent(
    event_type: "morning_routine_started",
),
actions: [
    RuleAction(
        enabled: true,
        action: SetDeviceState(
            device_id: "smart_plug_coffee",
            state: { "on": true },
        ),
    ),
],
```

```ron
// Rule 3: the routine sets the thermostat (°C)
trigger: CustomEvent(
    event_type: "morning_routine_started",
),
actions: [
    RuleAction(
        enabled: true,
        action: SetDeviceState(
            device_id: "thermostat_main",
            state: { "setpoint": 21 },
        ),
    ),
],
```

In Rhai, `trigger_value()` returns the event's payload.

---

### `SystemStarted`

Fires once at startup, right after the rule engine has loaded the current state of every device. Use it to catch anything that changed while homeCore was down.

```ron
trigger: SystemStarted,
```

Pair it with conditions so the actions only run when something needs attention:

```ron
// Warn if the garage door was left open across a restart
trigger: SystemStarted,
conditions: [
    DeviceState(
        device_id: "yolink_garage_door",
        attribute: "open",
        op: Eq,
        value: true,
    ),
],
actions: [
    RuleAction(
        enabled: true,
        action: Notify(
            channel: "telegram",
            message: "Garage door is OPEN (detected on startup)",
        ),
    ),
],
```

---

### `DeviceAvailabilityChanged`

Fires when a device goes online or offline.

```ron
trigger: DeviceAvailabilityChanged(
    device_id: "hue_001788fffe6841b3_1",
    to: Some(false),               // optional: only when it goes offline
    for_duration_secs: Some(60),   // optional: wait before firing
),
```

| Field | Required | Description |
|---|---|---|
| `device_id` (alias `device`) | yes | The device to watch. |
| `to` | no | `true` for online only, `false` for offline only. Leave it out for both. |
| `for_duration_secs` | no | Wait this many seconds, then fire only if the device still has the availability it changed to. |

With `for_duration_secs`, a device that drops off and comes back within the time doesn't fire the rule. Before v0.1.97 homeCore didn't check availability again when the time was up, so it fired anyway; on those versions, add a condition that checks the device's current state.

In Rhai, `trigger_value()` returns `true` or `false` (the new availability).

---

### `MqttMessage`

Fires when a raw MQTT message arrives on a matching topic. Use it for integrations that don't register as homeCore devices.

```ron
trigger: MqttMessage(
    topic_pattern: "homecore/events/+",   // + matches one level, # the rest
),
```

homeCore's internal client subscribes to `homecore/#`. It subscribes to every topic (`#`) only when at least one ecosystem profile is loaded from the profiles directory. Without a profile, a pattern outside `homecore/` never matches.

| Field | Required | Description |
|---|---|---|
| `topic_pattern` | yes | Topic to match. `+` matches one level and `#` matches everything after it. |
| `payload` | no | Only fire when the raw payload is exactly this string. |
| `value_path` | no | JSON pointer into the payload, such as `"/temperature"`. |
| `value_op` | no | Comparison for `value_path`: `Eq`, `Ne`, `Gt`, `Gte`, `Lt` or `Lte`. |
| `value_cmp` | no | The value to compare against. |

`value_path`, `value_op` and `value_cmp` work together: all three must be set for the comparison to apply, and the payload must be JSON.

```ron
// Fire when a CallService response_event reports more than 30
trigger: MqttMessage(
    topic_pattern: "homecore/events/weather_update",
    value_path: Some("/temperature"),
    value_op: Some(Gt),
    value_cmp: Some(30),
),
```

In Rhai, `trigger_value()` returns the payload as a string.

---

### `ManualTrigger`

Never fires on its own. Use it for a rule you only want to run on request. Run it with `POST /api/v1/automations/{id}/run` (which works for any rule), or dry-run it with `POST /api/v1/automations/{id}/test`.

```ron
trigger: ManualTrigger,
```

---

### `ModeChanged`

Fires when a mode turns on or off.

```ron
trigger: ModeChanged(
    mode_id: Some("mode_night"),   // optional: leave out to match any mode
    to: Some(true),                // optional: only when it turns on
),
```

| Field | Required | Description |
|---|---|---|
| `mode_id` | no | The mode's device ID, such as `"mode_night"`. Leave it out to match any mode. |
| `to` | no | `true` for turning on only, `false` for turning off only. Leave it out for both. |

---

### `ButtonEvent`

Fires when a button device (a Pico remote, a keypad, a scene switch) reports a press.

```ron
trigger: ButtonEvent(
    device_id: "lutron_pico_bedroom",
    button_number: Some(2),   // optional: one button only
    event: Pushed,            // Pushed | Held | DoubleTapped | Released
),
```

| Field | Required | Description |
|---|---|---|
| `device_id` (alias `device`) | yes | The button device. |
| `button_number` | no | Match one button. Leave it out for any button on the device. |
| `event` | yes | `Pushed`, `Held`, `DoubleTapped` or `Released`. |

Button presses arrive as ordinary state updates: the device sets an attribute named after the event (`pushed`, `held`, `double_tapped` or `released`) to the button number. `ButtonEvent` matches on that attribute so you don't have to. As with `DeviceStateChanged`, the attribute's value has to differ from its previous value for the trigger to fire.

---

### `NumericThreshold`

Fires when a numeric attribute is past a threshold. The `Crosses...` operators fire once, on the update that crosses the line, instead of on every update while the value stays past it.

```ron
trigger: NumericThreshold(
    device_id: "sensor_basement_temp",
    attribute: "temperature",
    op: CrossesAbove,
    value: 27.0,                   // °C
    for_duration_secs: Some(60),   // optional: still past it 60 s later
),
```

| Field | Required | Description |
|---|---|---|
| `device_id` (alias `device`) | yes | The device to watch. |
| `attribute` | yes | A numeric attribute. |
| `op` | yes | `Above`, `Below`, `CrossesAbove` or `CrossesBelow`. |
| `value` | yes | The threshold. |
| `for_duration_secs` | no | Wait this many seconds, then fire only if the current value is still past the threshold. |

| `op` | Fires when |
|---|---|
| `Above` | The new value is greater than `value`. This fires on every update from the device while it stays above. |
| `Below` | The new value is less than `value`, on every update while it stays below. |
| `CrossesAbove` | The previous value was at or below `value` and the new value is above it. |
| `CrossesBelow` | The previous value was at or above `value` and the new value is below it. |

For a single alert when a reading goes past a line, use `CrossesAbove` or `CrossesBelow`. Use `Above` or `Below` when you want to act on every reading while the value is out of range.

---

### `HubVariableChanged`

Fires when a `SetHubVariable` action writes a hub variable. The trigger doesn't look at the value. To act on particular values, add a `HubVariable` condition.

```ron
trigger: HubVariableChanged(
    name: Some("alarm_armed"),   // optional: leave out to watch every hub variable
),
```

| Field | Required | Description |
|---|---|---|
| `name` | no | The variable to watch. Leave it out to fire on any hub variable change. |

In Rhai, `trigger_value()` returns a map with `name`, `value` and `prev_value`.

---

### `CalendarEvent`

Fires when an event in a loaded `.ics` calendar starts, optionally shifted by an offset. See [Advanced: Calendar triggers](./advanced#calendar-triggers) for setup.

```ron
trigger: CalendarEvent(
    calendar_id: Some("us_holidays"),   // optional: .ics filename without the extension
    title_contains: Some("Holiday"),    // optional: case-insensitive
    offset_minutes: -30,                // optional: 30 minutes before the start
),
```

| Field | Required | Description |
|---|---|---|
| `calendar_id` | no | The `.ics` filename without its extension (`"us_holidays"` for `us_holidays.ics`). Leave it out to match any loaded calendar. |
| `title_contains` | no | Case-insensitive text to look for in the event title. Leave it out to match any event. |
| `offset_minutes` | no | Negative fires before the event starts, positive after. Defaults to `0`. |

Calendars load from `[calendars] dir` (default `config/calendars`). The scheduler checks once a minute.

---

### `DeviceBatteryLow`

Fires once when a device's battery level drops past the low threshold. The battery watcher applies hysteresis: it latches at `threshold_pct` and clears at `threshold_pct + recover_band_pct`. That means the trigger fires on the crossing, not on every battery report while the level stays low.

Leave out `device_id` to match any battery-powered device.

```ron
trigger: DeviceBatteryLow(
    device_id: None,   // or Some("yolink_d88b4c0400064299") for one device
),
```

The thresholds live in `[battery]` in `homecore.toml`. See [Battery monitoring](../devices/battery-monitoring.md) for the whole feature.

---

### `DeviceBatteryRecovered`

The counterpart to `DeviceBatteryLow`. Fires once when a device that was low climbs back above `threshold_pct + recover_band_pct`.

```ron
trigger: DeviceBatteryRecovered(
    device_id: None,   // or Some("yolink_d88b4c0400064299")
),
```

---

### Alert triggers: `AlertRaised`, `AlertCleared`, `AlertAcknowledged`, `AlertActiveFor`

These fire when an alert matching `filter` is raised, clears, is marked seen, or has been active for `minutes`. The alert that started the rule is the one the rule acts on: `{alert.message}` and similar placeholders in a message refer to it, and the alert actions act on it unless told otherwise. Each filter field narrows the match. An empty filter matches any alert.

```ron
trigger: AlertRaised(
    filter: AlertFilter(
        kind: Some(rule),
        rule_id: Some("b02d4f67-…"),
    ),
),
```

```ron
// Any YoLink leak sensor that has been wet for 5 minutes
trigger: AlertActiveFor(
    filter: AlertFilter(
        kind: Some(wet),
        plugin_id: Some("plugin.yolink"),
    ),
    minutes: 5,
),
```

| Trigger | Fields |
|---|---|
| `AlertRaised` | `filter` (optional) |
| `AlertCleared` | `filter` (optional) |
| `AlertAcknowledged` | `filter` (optional) |
| `AlertActiveFor` | `filter` (optional), `minutes` (required) |

`AlertRaised` fires for new alerts only, not when an alert that is already active is updated. `AlertActiveFor` fires once per alert. If that alert clears and is raised again later, it counts as a new alert.

`plugin_id` matches that plugin's own alerts and homeCore's alerts about its devices, so `kind: Some(wet), plugin_id: Some("plugin.yolink")` is any YoLink leak sensor. The filter fields are listed in [Alerts that start automations](./alert-automations.md), along with what happens to such a rule when its alert is turned off or deleted.

---

## Trigger context in Rhai

Rhai scripts can read details of the event that started the rule:

| Function | Returns |
|---|---|
| `trigger_device()` | The device ID behind the event, or `""`. |
| `trigger_attribute()` | The attribute involved, or `""`. |
| `trigger_value()` | The new value: the attribute's value for device triggers, the payload for MQTT and custom events, the body for webhooks. |
| `trigger_prev_value()` | The attribute's previous value, when there is one. |
| `trigger_event_type()` | The event type, such as `device_state_changed`. |
| `trigger_change_kind()`, `trigger_change_source()`, `trigger_change_actor_id()`, `trigger_change_actor_name()` | Who or what made a device change. |
| `trigger_extra()` | Webhook query parameters as a map. |
| `trigger_label()` | The rule's `trigger_label`, or `""`. |

These functions are available in the rule's `trigger_condition` and `required_expression` and in `RunScript` actions. `ScriptExpression` conditions and the expressions in `Conditional`, `RepeatUntil`, `RepeatWhile` and `WaitForExpression` don't receive trigger context.

For `DeviceBatteryLow` and `DeviceBatteryRecovered`, `trigger_device()` returns the device and `trigger_value()` returns its battery level. In a `RunScript` action, `device_state(trigger_device())` returns that device's current attributes.
