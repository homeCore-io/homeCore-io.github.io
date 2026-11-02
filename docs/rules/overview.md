---
id: overview
title: Rules Overview
sidebar_label: Overview
sidebar_position: 1
---

# Rules Overview

Rules (also called automations) decide what HomeCore does when something happens. Each rule is a RON (Rusty Object Notation) file in the rules directory, which is `rules/` under the HomeCore home directory unless `[rules] dir` in `homecore.toml` points elsewhere. HomeCore watches that directory and reloads a rule as soon as its file changes, so you never need to restart.

You can also create and edit rules in the web app (**Settings › Automations**) or over the REST API. Both write the same RON files.

## Device references

Any field named `device_id` also accepts the spelling `device`. Either one can hold:

- a raw device ID, such as `yolink_d88b4c01000cf2e5`
- a canonical name, such as `living_room.floor_lamp`
- a display name, such as `Kitchen Speaker` (a name you gave the device in HomeCore also works)

HomeCore tries them in that order. Prefer canonical names in rules you write by hand: they are readable, and unlike display names they can't be ambiguous.

```ron
trigger: DeviceStateChanged(
    device: "entryway.front_door",
    attribute: Some("open"),
),
```

```ron
trigger: DeviceStateChanged(
    device_id: "yolink_front_door",
    attribute: Some("open"),
),
```

If a reference matches no device, or a display name matches more than one, HomeCore disables the rule and records the problem in its `error` field instead of guessing.

Names are only resolved in the rule's fields. Inside a Rhai script (`ScriptExpression`, `RunScript`, gates, and script checks in `Conditional`), `device_state("...")` takes the raw device ID. Mode IDs such as `mode_night` are device IDs already.

## Data model

A rule has three working parts:

```
trigger      the event that starts the rule (plus any extra ones in `triggers`)
conditions   checks that must all pass (AND); may be empty
actions      the steps to run, in order
```

Around those sit the rule's identity (`id`, `name`, `enabled`, `priority`, `tags`) and some optional controls:

| Field | Default | Purpose |
|---|---|---|
| `triggers` | `[]` | More triggers. The rule starts when `trigger` or any of these matches. See [Triggers](./triggers.md). |
| `cooldown_secs` | none | After the rule fires, ignore new triggers for this many seconds. |
| `run_mode` | `Parallel` | What happens if the rule is triggered while a previous run is still going. See [Run modes](#run-modes). |
| `required_expression` | none | Rhai gate checked before the conditions. |
| `cancel_on_false` | `false` | When `required_expression` is false, also cancel this rule's pending cancellable delays. |
| `trigger_condition` | none | A second Rhai gate, checked after `required_expression`. |
| `variables` | `{}` | Starting values for rule-local variables. |
| `trigger_label` | none | A label for the trigger, readable in scripts and fire history. |
| `log_events`, `log_triggers`, `log_actions` | `false` | Log this rule's matching, evaluation and steps at info level. |

The gates, variables and labels are covered in [Advanced Patterns](./advanced.md).

## Execution flow

```
Event arrives (device state change, time, webhook, alert, ...)
  → skip disabled rules
  → find rules where `trigger` or one of `triggers` matches
      (a trigger with `for_duration_secs` waits, then re-checks before firing)
  → go through the matching rules in priority order (highest first):
      → paused by another rule?             → record "paused", skip
      → inside cooldown_secs?               → record "cooldown", skip
      → required_expression false?          → record "required_expression_failed", skip
      → trigger_condition false?            → record "trigger_gate_failed", skip
      → run_mode says no (Single, Queued)?  → record "skipped", skip
      → evaluate conditions in order, stopping at the first failure
                                            → record "condition_failed", skip
      → all passed: start the actions in the background; record "fired"
        once they finish
      → if the rule has an enabled StopRuleChain step, stop here: lower-priority
        rules do not see this event
```

Every attempt, including the skipped ones, goes into the rule's fire history. HomeCore keeps the last 20 per rule.

## Rule file format (RON)

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",  // all zeros: HomeCore assigns a real ID on first load
    name: "Front door alert",
    enabled: true,
    priority: 10,          // higher runs first
    tags: ["security", "door-alerts"],

    trigger: DeviceStateChanged(
        device: "entryway.front_door",
        attribute: Some("open"),
        to: Some(true),    // optional: only fire when the attribute changes to this value
    ),

    conditions: [
        TimeWindow(
            start: "08:00:00",
            end: "22:00:00",
        ),
    ],

    actions: [
        RuleAction(
            enabled: true,
            action: Notify(
                channel: "telegram",
                message: "Front door opened",
            ),
        ),
    ],

    // Optional fields:
    // cooldown_secs: Some(300),
    // run_mode: Single,           // Parallel | Single | Restart | Queued(max_queue: 10)
    // trigger_condition: Some("device_state(\"mode_night\")[\"on\"] == true"),
    // required_expression: Some("current_hour() >= 6 && current_hour() < 22"),
)
```

A few RON rules that trip people up:

- `id` is required and must be a UUID. Use all zeros for a new rule. HomeCore replaces it with a fresh ID and writes it back into the file. An empty string (`id: ""`) does not parse.
- Optional fields are wrapped in `Some(...)`: `attribute: Some("open")`. Leave the field out to mean "not set".
- Each top-level step is a `RuleAction(enabled: ..., action: ...)`. `enabled` may be left out and defaults to `true`. Steps nested inside `Parallel`, `Conditional` and the repeat steps are written bare, without the `RuleAction` wrapper.
- Device states and other free-form values are JSON-style maps: `state: { "on": true, "brightness_pct": 80 }`.

Older `.toml` rule files still load, but HomeCore always writes rules as `.ron`, and these docs use RON throughout.

## Creating rules via API

The API takes the same structure as JSON. Each trigger, condition and action is an object keyed by its type name, and optional fields are plain values (no `Some`).

```bash
RULE_ID=$(curl -s -X POST http://localhost:8080/api/v1/automations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Front door alert",
    "enabled": true,
    "priority": 10,
    "tags": ["security"],
    "trigger": {
      "DeviceStateChanged": {
        "device_id": "entryway.front_door",
        "attribute": "open"
      }
    },
    "conditions": [
      {"TimeWindow": {"start": "08:00:00", "end": "22:00:00"}}
    ],
    "actions": [
      {"enabled": true, "action": {"Notify": {"channel": "telegram", "message": "Front door opened"}}}
    ]
  }' | jq -r .id)
```

The server always assigns the ID, so you can leave `id` out. It answers `201 Created` with the saved rule. A body that doesn't match the rule types, a device reference that doesn't resolve, or a `priority` outside -1000 to 1000 gets a `422` with the reason.

The rule is written to a `.ron` file in the rules directory (named after the rule) and takes effect immediately. `PUT /api/v1/automations/{id}` replaces a whole rule; `PATCH /api/v1/automations/{id}` changes only `enabled` and `priority`. `GET /api/v1/automations/{id}/ron` returns the rule's file as written.

## Hot-reload

Edit any `.ron` file in the rules directory and save it. The watcher waits 200 ms for further changes, then reloads only the files that changed. No API call or restart is needed.

```bash
# Edit a rule directly
vim rules/front_door_alert.ron

# The server log confirms the reload:
# INFO hc_core::rule_loader: Rules hot-reloaded (surgical) added_or_updated=1 removed=0
```

Subdirectories are not loaded, so a folder such as `rules/archive/` can hold files without them running.

## Run modes

`run_mode` controls what happens when a rule is triggered while an earlier run of it is still executing its actions (for example, waiting on a `Delay`).

| Run mode | Behavior |
|---|---|
| `Parallel` | Default. Every trigger starts a new run, alongside any that are still going. |
| `Single` | If a run is still going, the new trigger is skipped. |
| `Restart` | Stops the earlier run at its next step (cutting its cancellable delays short), then starts a new run. |
| `Queued` | Runs one at a time, in the order they were triggered. Up to `max_queue` (default 10) may be waiting or running; beyond that, new triggers are skipped. |

```ron
run_mode: Single,
// or
run_mode: Queued(max_queue: 3),
```

In JSON these are `"run_mode": "Single"` and `"run_mode": {"Queued": {"max_queue": 3}}`. [Advanced Patterns](./advanced.md#run-modes) explains each mode in more detail, including how `Restart` and `Queued` behaved before v0.1.97.

## Priority

When several rules match the same event, HomeCore evaluates them from highest priority to lowest. Order matters when a rule uses `StopRuleChain`.

```
Priority 100 → evaluated first
Priority  10 → evaluated second
Priority   0 → the usual value
Priority -10 → evaluated last
```

The API accepts priorities from -1000 to 1000.

## Broken rules

A bad rule file never stops HomeCore from starting. A file that fails to parse is loaded as a disabled stub named after the file (`front_door_alert [BROKEN]`), with the parse error in its `error` field. Two files with the same ID get the same treatment: the second is disabled with an error. A rule whose device reference can't be resolved is disabled with an error too.

```bash
# Find all broken rules
curl -s "http://localhost:8080/api/v1/automations?stale=true" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | {name, error}]'
```

Fix the file and save it. The watcher replaces the stub with the real rule.

## Testing a rule

`POST /api/v1/automations/{id}/test` is a dry run: it evaluates the conditions against the house as it is now and reports which actions would run, without running them. `POST /api/v1/automations/{id}/run` runs the rule for real, straight away. See [Debugging rules](./examples.md#debugging-rules) for both, plus fire history.

## Key source files

Paths are relative to the HomeCore core repository.

| File | What it contains |
|---|---|
| `crates/hc-types/src/rule.rs` | `Rule`, `Trigger`, `Condition`, `Action` types |
| `crates/hc-core/src/engine.rs` | Trigger matching, gates, condition evaluation, fire history |
| `crates/hc-core/src/executor.rs` | Action execution, all action type handlers |
| `crates/hc-core/src/rule_loader.rs` | RON loading, hot-reload watcher |
| `crates/hc-core/src/rule_resolver.rs` | Resolving `device` references to device IDs |
| `rules/` | Your rule files (RON), under homeCore's base directory |
