---
id: advanced
title: Advanced Rule Patterns
sidebar_label: Advanced Patterns
sidebar_position: 5
---

# Advanced Rule Patterns

The snippets on this page are fragments of a rule file. Put them inside a full `Rule(...)` as shown in the [Rules Overview](./overview.md#rule-file-format-ron).

## Run modes

`run_mode` decides what happens when a rule is triggered while an earlier run is still executing its actions.

| Run mode | Behavior |
|---|---|
| `Parallel` | Default. Every trigger starts a new run, alongside any that are still going. |
| `Single` | While a run is in progress, new triggers are skipped. History records `skipped` with the reason `single: already in-flight`. |
| `Restart` | A new trigger stops the earlier run at its next step and starts a new run. |
| `Queued` | Runs go one at a time, in the order they were triggered. Up to `max_queue` (default 10) may be waiting or running; further triggers are skipped with the reason `queued: queue full (max N)`. |

With `Restart`, the earlier run's cancellable delays are cut short so it reaches its next step straight away, and it stops there without running the steps after the delay. A step that can't be cut short, such as a `Delay` without `cancelable: true` or a `WaitForExpression`, is waited out first, and the earlier run stops after it. The new run starts at once in either case.

With `Queued`, each run waits for the one before it to finish. A waiting run's conditions were checked when it was triggered, but its actions see device states as they are when its turn comes.

Before v0.1.97 these two modes behaved differently. `Restart` only cut the earlier run's cancellable delays short, and that run then carried on with the steps after the delay, so "off in 5 minutes" turned the light off at once. `Queued` started runs alongside each other, as `Parallel` does, and only capped how many ran at once.

For a motion light that stays on until the room has been quiet for five minutes, `Restart` with a cancellable delay does the job in one rule:

```ron
name: "Hallway motion light",
run_mode: Restart,

trigger: DeviceStateChanged(
    device: "hallway.motion",
    attribute: Some("motion"),
    to: Some(true),
),

actions: [
    RuleAction(action: SetDeviceState(device: "hallway.light", state: { "on": true })),
    // New motion stops this run here and starts the five minutes again.
    RuleAction(action: Delay(duration_secs: 300, cancelable: true)),
    RuleAction(action: SetDeviceState(device: "hallway.light", state: { "on": false })),
],
```

This counts five minutes from the last motion that started, so a person standing still for longer than that sees the light go off. `Single` with a wait step counts from when motion clears instead:

```ron
name: "Hallway motion light",
run_mode: Single,

trigger: DeviceStateChanged(
    device: "hallway.motion",
    attribute: Some("motion"),
    to: Some(true),
),

actions: [
    RuleAction(action: SetDeviceState(device: "hallway.light", state: { "on": true })),
    // Wait until there has been no motion for 5 minutes straight.
    // Scripts use the raw device ID, not the canonical name.
    RuleAction(action: WaitForExpression(
        expression: "device_state(\"motion_hallway\")[\"motion\"] == false",
        hold_duration_ms: Some(300000),
    )),
    RuleAction(action: SetDeviceState(device: "hallway.light", state: { "on": false })),
],
```

Fresh motion while the rule is waiting is skipped as a trigger, but it makes the expression false, which restarts the five-minute hold.

---

## Cooldown (`cooldown_secs`)

Stops a rule from firing again within a window, however many triggering events arrive.

```ron
name: "Motion light, no thrash",
priority: 10,
cooldown_secs: Some(60),   // won't fire again for 60 seconds after firing

trigger: DeviceStateChanged(
    device: "hallway.motion",
    attribute: Some("motion"),
    to: Some(true),
),

actions: [
    RuleAction(action: SetDeviceState(device: "hallway.light", state: { "on": true })),
],
```

The window starts when the rule fires (its conditions pass), not when it is merely triggered. Triggers that arrive during the window are recorded in fire history with `outcome.type = "cooldown"` and a `remaining_secs` field. A manual run (`POST /automations/{id}/run`) ignores the cooldown.

```bash
curl -s http://localhost:8080/api/v1/automations/RULE_ID/history \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.outcome.type == "cooldown") | {timestamp, remaining_secs: .outcome.remaining_secs}]'
```

---

## Rule gates (`trigger_condition`, `required_expression`)

Two optional Rhai expressions can stop a rule before its conditions are checked. Both run after the pause and cooldown checks, `required_expression` first, then `trigger_condition`. Each records its own outcome in fire history when it is false:

- `required_expression` records `required_expression_failed`. With `cancel_on_false: true`, a false result also cancels the rule's pending cancellable delays.
- `trigger_condition` records `trigger_gate_failed`.

```ron
// Only bother with this rule while mode_night is on
trigger_condition: Some("device_state(\"mode_night\")[\"on\"] == true"),

// Daytime hours only
required_expression: Some("current_hour() >= 6 && current_hour() < 22"),
```

Both gates can read device state (`device_state("id")`, by raw device ID), the time helpers (`current_hour()`, `current_minute()`, `current_weekday()`) and the trigger accessors (`trigger_device()`, `trigger_value()`, `trigger_prev_value()`, `trigger_label()` and the rest). A manual run with `"checks": false` skips both.

---

## StopRuleChain

When a rule that contains a `StopRuleChain` step fires, rules with lower priority that matched the **same event** are not evaluated.

Example: the right keypad code disarms the alarm, and the "wrong code" alert should not go off.

```ron
// Priority 100: disarm (evaluated first)
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Security: disarm",
    enabled: true,
    priority: 100,
    trigger: DeviceStateChanged(
        device: "entryway.keypad",
        attribute: Some("code"),
    ),
    conditions: [
        DeviceState(device: "entryway.keypad", attribute: "code", op: Eq, value: "1234"),
    ],
    actions: [
        RuleAction(action: SetDeviceState(device: "security.armed_switch", state: { "on": false })),
        RuleAction(action: StopRuleChain),   // the alert rule below never sees this event
    ],
)
```

```ron
// Priority 0: wrong code (only reached when the disarm rule didn't fire)
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Security: wrong code",
    enabled: true,
    priority: 0,
    trigger: DeviceStateChanged(
        device: "entryway.keypad",
        attribute: Some("code"),
    ),
    actions: [
        RuleAction(action: Notify(channel: "telegram", message: "Wrong code entered!")),
    ],
)
```

The chain stops as soon as the higher rule fires, wherever `StopRuleChain` sits in its action list. Only a top-level step that is switched on counts. A `StopRuleChain` nested inside a `Conditional` or `Parallel` does not stop the chain, and neither does one with `enabled: false` (before v0.1.97 a switched-off step still stopped it). If the disarm rule's condition fails, it doesn't fire, and the wrong-code rule runs as usual.

---

## Cancellable delays

A `Delay` with `cancelable: true` can be cut short. Cancelling it ends the wait early, and the run continues with the next step. It does not stop the run.

```ron
actions: [
    RuleAction(action: Delay(
        duration_secs: 300,
        cancelable: true,
        cancel_key: Some("porch_wait"),
    )),
    RuleAction(action: SetDeviceState(device: "porch.light", state: { "on": false })),
],
```

Three steps cancel delays:

| Step | Cancels |
|---|---|
| `CancelDelays(key: Some("porch_wait"))` | This rule's delay with that key. |
| `CancelDelays()` | All of this rule's cancellable delays. |
| `CancelRuleTimers(rule_id: Some("UUID"))` | All cancellable delays of the rule with that ID (this rule if `rule_id` is left out). |

Keys belong to the rule that set them, so `CancelDelays` in one rule can't reach a delay in another. Use `CancelRuleTimers` with the other rule's ID for that.

Because a cancelled delay lets the run carry on, cancelling the delay above with one of these steps turns the porch light off immediately rather than leaving it on. `run_mode: Restart` is different: it also stops the earlier run, so the steps after the delay don't run. To build "turn off after five quiet minutes, and start the count again on new motion", use one of the patterns under [Run modes](#run-modes), or a [timer helper](../devices/virtual-devices.md): one rule sends the timer `{"command": "start", "duration_secs": 300}` on every motion (starting a running timer starts it over), and a second rule turns the light off when the timer's `state` changes to `"finished"`.

---

## Rule-local variables

Variables that belong to one rule. They persist across that rule's firings, in memory only, so a restart resets them to the rule's starting values.

Set starting values with `variables`, change them with the `SetVariable` step, and read them from a `RunScript` step with `rule_var("name")`:

```ron
// Count front door openings; notify on every 5th
variables: { "open_count": 0 },

trigger: DeviceStateChanged(
    device: "entryway.front_door",
    attribute: Some("open"),
    to: Some(true),
),

actions: [
    RuleAction(action: SetVariable(name: "open_count", value: 1, op: Some(Add))),
    RuleAction(action: RunScript(script: r#"
        let n = rule_var("open_count");
        if n % 5 == 0 {
            notify("telegram", "Front door opened " + n + " times");
        }
    "#)),
],
```

`rule_var()` is available in `RunScript` only. Conditions, gates and `Conditional` scripts can't read rule variables.

**`VariableOp` values:**

| Op | Description |
|---|---|
| `Set` | Assign the value (the default when `op` is left out) |
| `Add` | Add to the current value (a missing variable counts as 0) |
| `Subtract` | Subtract from the current value |
| `Multiply` | Multiply the current value |
| `Divide` | Divide the current value |
| `Toggle` | Flip a boolean (the `value` is ignored) |

---

## Hub variables

Hub variables are shared by all rules. Use them for counters, flags and other state that several rules read or write. Like rule variables they live in memory, so a restart clears them. `GET /api/v1/automations/variables` lists the current values.

**Writing:**

```ron
RuleAction(action: SetHubVariable(name: "alarm_armed", value: true)),
```

`SetHubVariable` takes the same optional `op` as `SetVariable`.

**Reading in a script condition or `RunScript`:**

```ron
ScriptExpression(script: "hub_var(\"alarm_armed\") == true"),
```

**As a condition:**

```ron
HubVariable(name: "alarm_armed", op: Eq, value: true),
```

**As a trigger.** Setting a hub variable raises a `hub_variable_changed` event, which the `HubVariableChanged` trigger listens for. Leave out `name` to react to any hub variable:

```ron
trigger: HubVariableChanged(name: Some("alarm_armed")),
```

---

## Startup gap pattern

If HomeCore restarts while a sensor is in an alert state (garage door open, water detected), no state change arrives to trigger your rules. The `SystemStarted` trigger, which fires once after startup, catches it:

```ron
trigger: SystemStarted,

conditions: [
    DeviceState(device: "garage.main_door", attribute: "open", op: Eq, value: true),
],

actions: [
    RuleAction(action: Notify(
        channel: "telegram",
        message: "Garage door is still open (detected on restart)",
    )),
],
```

Without a rule like this, a sensor stuck in an alert state across a restart goes unnoticed until its state changes again.

---

## Trigger label (`trigger_label`)

A human-readable name for the rule's trigger. It is stored in the trigger context of each fire history entry (`trigger_context.trigger_label`) and returned by `trigger_label()` in Rhai scripts.

```ron
trigger_label: Some("bedroom motion at night"),
```

This helps when several rules share a trigger type and you want to tell them apart in history, or when one script serves several rules.

---

## Per-action disable toggle

Any top-level step can be switched off without deleting it. Set `enabled: false` on its `RuleAction`. The executor skips it and records the step as `skipped` in the fire history, so you can confirm it was passed over.

```ron
actions: [
    RuleAction(action: SetDeviceState(device: "office.desk_light", state: { "on": true })),
    RuleAction(
        enabled: false,   // temporarily disabled
        action: Notify(channel: "telegram", message: "Desk light on"),
    ),
],
```

Steps nested inside `Parallel`, `Conditional` and the repeat steps have no `enabled` flag.

---

## Calendar triggers

Rules can fire on events in `.ics` calendar files. HomeCore loads every `.ics` file in the calendar directory, set in `homecore.toml`:

```toml
[calendars]
dir            = "config/calendars"   # the default
expansion_days = 400                  # how far ahead repeating events are expanded (default 400)
```

Then use the `CalendarEvent` trigger. Every field is optional:

```ron
trigger: CalendarEvent(
    calendar_id: Some("work"),             // the .ics filename without the extension
    title_contains: Some("Team meeting"),  // case-insensitive substring of the event title
    offset_minutes: -15,                   // 15 minutes before the event starts
),
```

The scheduler checks once a minute and fires the rule when an event's start time, shifted by `offset_minutes`, falls in the current minute. The `CalendarActive` condition takes the same `calendar_id` and `title_contains` and passes while a matching event is under way.

The calendar directory is watched, so new or edited `.ics` files are picked up without a restart. To load a calendar from a URL, post it to the API:

```bash
curl -s -X POST http://localhost:8080/api/v1/calendars/fetch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://calendar.google.com/calendar/ical/yourfeed/basic.ics", "name": "work", "refresh_hours": 6}'
```

HomeCore saves the file as `work.ics` with a `work.meta.json` sidecar recording the source URL, when it was fetched and the refresh interval, and fetches it again every `refresh_hours`.

---

## Hub mode system (`ModeChanged`, `ModeIs`, `SetMode`)

Modes are named on/off flags such as `mode_night` and `mode_away`, defined in `modes.toml`. Some follow the sun (night, day); others you switch yourself or from rules. They let one rule behave differently depending on the state of the house.

```ron
// Turn on the porch light when mode_night turns on
trigger: ModeChanged(
    mode_id: Some("mode_night"),   // leave out to react to any mode
    to: Some(true),                // leave out to react to both directions
),

actions: [
    RuleAction(action: SetDeviceState(device: "porch.light", state: { "on": true, "brightness_pct": 40 })),
],
```

```ron
// Check a mode in conditions
conditions: [
    ModeIs(mode_id: "mode_away", on: false),
],
```

```ron
// Set a mode from a rule: On, Off or Toggle
RuleAction(action: SetMode(mode_id: "mode_away", command: On)),
```
