---
id: advanced
title: Advanced Rule Patterns
sidebar_label: Advanced Patterns
sidebar_position: 5
---

# Advanced Rule Patterns

## Cooldown (`cooldown_secs`)

Prevents a rule from firing more than once within a window, regardless of how many triggering events arrive.

```toml
id       = ""
name     = "Motion light — no thrash"
enabled  = true
priority = 10
cooldown_secs = 60   # won't fire again for 60 seconds after firing

[trigger]
type      = "device_state_changed"
device    = "hallway.motion"
attribute = "motion"
to        = true

[[actions]]
type      = "set_device_state"
device    = "hallway.light"
state     = { on = true }
```

When a rule is in cooldown, evaluations are recorded in fire history with `outcome.type = "cooldown"` and a `remaining_secs` field. Check how long remains:

```bash
curl -s http://localhost:8080/api/v1/automations/RULE_ID/history \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.outcome.type == "cooldown") | {timestamp, remaining_secs: .outcome.remaining_secs}]'
```

---

## Rule gates (`trigger_condition`, `required_expression`)

Two optional Rhai gates that can stop rule evaluation before conditions are checked:

- **`trigger_condition`**: evaluated on every trigger match. If `false`, the rule is silently skipped (no fire history entry). Use for high-frequency checks where the noise in history is unwanted.
- **`required_expression`**: evaluated before conditions. If `false`, records `required_expression_failed` in history. Use when you want visibility into why the rule didn't fire.

```toml
# Only bother evaluating this rule when mode_night is active
# (skip silently when mode_night is off)
trigger_condition = 'device_state("mode_night")["on"] == true'

# Require daytime hours — visible in history when it fails
required_expression = 'hour() >= 6 && hour() < 22'
```

---

## StopRuleChain

When a high-priority rule fires and includes `StopRuleChain`, all lower-priority rules for the **same event** are skipped.

Use case: "VIP entry" — security code entered correctly → disarm, don't trigger the alert rule.

```toml
# Priority 100 — security disarm (fires first)
id       = ""
name     = "Security — disarm"
priority = 100

[trigger]
type      = "device_state_changed"
device    = "entryway.keypad"
attribute = "code"

[[conditions]]
type   = "script_expression"
script = 'device_state("keypad_main")["code"] == "1234"'

[[actions]]
type      = "set_device_state"
device    = "security.armed_switch"
state     = { on = false }

[[actions]]
type = "stop_rule_chain"   # ← prevents "intruder alert" rule from firing

---

# Priority 0 — intruder alert (never fires when disarmed)
id       = ""
name     = "Security — intruder alert"
priority = 0

[trigger]
type      = "device_state_changed"
device    = "entryway.keypad"
attribute = "code"

[[actions]]
type    = "notify"
channel = "telegram"
message = "Wrong code entered!"
```

---

## Cancellable delays

A `Delay` action can be cancelled by name before it expires. Classic use case: "turn lights off 5 minutes after no motion, but cancel if motion is detected again."

**Rule 1 — motion detected → turn on, start 5-min delay:**

```toml
name = "Motion light — on"

[trigger]
type      = "device_state_changed"
device    = "hallway.motion"
attribute = "motion"
to        = true

[[actions]]
type      = "set_device_state"
device    = "hallway.light"
state     = { on = true }

[[actions]]
type          = "delay"
duration_secs = 300
cancelable    = true
cancel_key    = "motion_off_delay"

[[actions]]
type      = "set_device_state"
device    = "hallway.light"
state     = { on = false }
```

**Rule 2 — motion detected again → cancel the pending delay:**

```toml
name     = "Motion light — cancel off"
priority = 5   # higher than rule 1 so it fires first

[trigger]
type      = "device_state_changed"
device    = "hallway.motion"
attribute = "motion"
to        = true

[[actions]]
type       = "cancel_delays"
cancel_key = "motion_off_delay"
```

When motion triggers again while the delay is pending, rule 2 cancels the delay and the light stays on. The next motion event restarts the 5-minute timer.

---

## Rule-local variables

Variables scoped to a single rule. Persist across firings (in-memory; cleared on restart).

```toml
# Count door openings; notify at every 5th
[trigger]
type      = "device_state_changed"
device    = "entryway.front_door"
attribute = "open"
to        = true

[[actions]]
type  = "set_variable"
name  = "open_count"
op    = "Add"
value = 1.0

[[actions]]
type      = "conditional"
condition = 'variable("open_count") % 5 == 0'

[[actions.then_actions]]
type    = "notify"
channel = "telegram"
message = "Front door opened 5 more times (total: {{variable.open_count}})"
```

**`VariableOp` values:**

| Op | Description |
|---|---|
| `Set` | Assign value |
| `Add` | Add to current (creates if missing) |
| `Subtract` | Subtract from current |
| `Multiply` | Multiply current |
| `Divide` | Divide current |
| `Toggle` | Flip boolean |
| `Append` | Append to string |
| `Clear` | Reset to null |

---

## Hub variables

Cross-rule variables shared across all rules. Use for counters, flags, and state that multiple rules need to read or write.

**Writing:**

```toml
[[actions]]
type  = "set_hub_variable"
name  = "alarm_armed"
op    = "Set"
value = true
```

**Reading in Rhai:**

```toml
[[conditions]]
type   = "script_expression"
script = 'hub_var("alarm_armed") == true'
```

**`HubVariableIs` condition:**

```toml
[[conditions]]
type  = "hub_variable_is"
name  = "alarm_armed"
op    = "Eq"
value = true
```

Setting a hub variable fires a `hub_variable_changed` event, so rules can trigger on variable changes using `Trigger::CustomEvent { event_type: "hub_variable_changed" }`.

---

## Startup gap pattern

If HomeCore restarts while a sensor is in an alert state (garage door open, alarm triggered), the `SystemStarted` trigger catches it:

```toml
[trigger]
type = "system_started"

[[conditions]]
type      = "device_state"
device    = "garage.main_door"
attribute = "open"
op        = "Eq"
value     = true

[[actions]]
type    = "notify"
channel = "telegram"
message = "Garage door is still open (detected on restart)"
```

Without this pattern, a sensor stuck in an alert state across a restart would be silently missed until the state changes again.

---

## Trigger label (`trigger_label`)

A human-readable description added to the `rule_fired` event for better observability. Appears in the event log, WebSocket stream, and fire history.

```toml
trigger_label = "bedroom motion at night"
```

Useful when multiple rules share the same trigger type and you want to distinguish them in log output.

---

## Per-action disable toggle

Any action can be disabled without removing it. Set `enabled = false` to skip that action. The executor records a `Skipped` entry in the fire history so you can confirm the skip happened.

```toml
[[actions]]
type      = "set_device_state"
device    = "office.desk_light"
state     = { on = true }

[[actions]]
enabled  = false          # ← temporarily disabled
type     = "notify"
channel  = "telegram"
message  = "Desk light on"
```

---

## Calendar triggers

Fire rules based on `.ics` calendar events. Configure a calendar directory in `homecore.toml`:

```toml
[calendar]
dir            = "calendars"
expansion_days = 400
```

Then use the `CalendarEvent` trigger:

```toml
[trigger]
type        = "calendar_event"
calendar_id = "work"     # filename without .ics
event_match = "contains" # "exact" | "contains" | "regex"
summary     = "Team meeting"

# Optional: when relative to the event to fire
offset_minutes = -15    # 15 minutes before the event starts
```

The `.ics` files are hot-reloaded. URL-sourced calendars can be auto-refreshed by including a `.meta.json` sidecar:

```json
{
  "url": "https://calendar.google.com/calendar/ical/yourfeed/basic.ics",
  "refresh_hours": 6
}
```

---

## Hub mode system (`ModeChanged`, `ModeIs`, `SetMode`)

Named modes are active/inactive boolean flags with solar calculation support. They enable complex context-aware rules:

```toml
# Turn on porch light when mode_night activates
[trigger]
type      = "mode_changed"
mode_name = "mode_night"
to        = true

[[actions]]
type      = "set_device_state"
device    = "porch.light"
state     = { on = true, brightness = 100 }

---

# Set a mode from a rule
[[actions]]
type  = "set_mode"
name  = "mode_away"
value = true
```
