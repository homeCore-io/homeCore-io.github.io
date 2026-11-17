---
id: overview
title: Rules Overview
sidebar_label: Overview
sidebar_position: 1
---

# Rules Overview

Rules, which the app calls automations, decide what homeCore does when something happens. Each rule is a RON (Rusty Object Notation) file in the rules directory. That is `rules/` under the homeCore home directory, unless `[rules] dir` in `homecore.toml` points somewhere else. homeCore watches the directory and reloads a rule as soon as its file changes, so you never need to restart.

There are four ways to make or change a rule, and they all end up as the same RON files:

- The app: **Settings › Automations**. See [The automation editor](./editor.md).
- The Assistant, if it is installed: ask it in the chat. It shows the rule before saving it. See [The automation editor](./editor.md#the-assistant).
- A text editor, writing the `.ron` file yourself.
- The REST API, under `/api/v1/automations`.

## Device references

Most fields named `device_id` also accept the spelling `device`. They can hold any of these, and homeCore tries them in this order:

1. A raw device ID, such as `yolink_d88b4c01000cf2e5`.
2. A canonical name, such as `living_room.floor_lamp`.
3. A display name, such as `Kitchen Speaker`. The plugin's name and a name you gave the device in homeCore both work.

Prefer canonical names in rules you write by hand. They are readable, and a display name can match more than one device.

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

If a reference matches no device, or a display name matches more than one, homeCore disables the rule and puts the problem in its `error` field. Over the API, the save is refused with `422`.

homeCore resolves names in every device field a rule has: triggers (the battery triggers included), conditions, device steps, `picture_from` on `Notify`, `device_ids` in an `AlertFilter`, and steps nested in `Parallel`, `Conditional`, the repeat steps, `PingHost`, `ForEachAlert` and the `otherwise` list of `WaitAlertCleared`. Rhai scripts are the one place that takes the raw device ID only: `device_state("...")` in `ScriptExpression`, `RunScript`, the gates, and script questions in `Conditional`.

Mode IDs such as `mode_night` are device IDs already.

## What a rule is made of

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
| `cooldown_secs` | none | After the rule fires, ignore new triggers for this many seconds. The app calls this "Rest after running". |
| `run_mode` | `Parallel` | What happens if the rule is triggered while a previous run is still going. See [Run modes](#run-modes). |
| `required_expression` | none | Rhai gate checked before the conditions. |
| `cancel_on_false` | `false` | When `required_expression` is false, also cancel this rule's pending cancellable delays. |
| `trigger_condition` | none | A second Rhai gate, checked after `required_expression`. |
| `variables` | `{}` | Starting values for rule-local variables. |
| `trigger_label` | none | A label for the trigger, readable in scripts and fire history. |
| `log_events`, `log_triggers`, `log_actions` | `false` | Log this rule's matching, evaluation and steps at info level. |

The gates, variables and labels are covered in [Advanced Patterns](./advanced.md).

## What happens when an event arrives

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

Steps run one after another. If a step fails (an HTTP call that returns an error, a command that can't be published), the steps after it don't run, and the fire history shows the failure. A few steps only log a warning and let the rule carry on: `Notify` when sending fails, and steps that name a room, scene or alert that doesn't exist.

Every attempt, including the skipped ones, goes into the rule's fire history. homeCore keeps the last 20 per rule and saves them, so they are still there after a restart.

## Rule file format (RON)

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",  // all zeros: homeCore assigns a real ID on first load
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

Some RON details trip people up:

- `id`, `name`, `enabled`, `priority` and `trigger` are required. `id` must be a UUID. Use all zeros for a new rule, and homeCore writes a fresh ID back into the file. An empty string (`id: ""`) does not parse.
- Optional fields are wrapped in `Some(...)`: `attribute: Some("open")`. Leave the field out to mean "not set".
- Each top-level step is a `RuleAction(enabled: ..., action: ...)`. `enabled` may be left out and defaults to `true`. Steps nested inside `Parallel`, `Conditional`, the repeat steps and the other containers are written bare, without the `RuleAction` wrapper.
- Device states and other free-form values are JSON-style maps: `state: { "on": true, "brightness_pct": 80 }`.
- Times are `"HH:MM:SS"` or `"HH:MM"`.

Older `.toml` rule files still load, but homeCore always writes rules as `.ron`, and these docs use RON throughout.

## Creating rules over the API

The API takes the same structure as JSON. Each trigger, condition and action is an object keyed by its type name, and optional fields are plain values (no `Some`). A trigger or step with no fields is a plain string, such as `"SystemStarted"`.

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

`name`, `enabled`, `priority` and `trigger` are required. The server always assigns the ID, so leave `id` out. It answers `201 Created` with the saved rule. A body that doesn't match the rule types, a device reference that doesn't resolve, or a `priority` outside -1000 to 1000 gets a `422` with the reason.

The rule is written to a `.ron` file in the rules directory (named after the rule) and takes effect at once. Every change to a rule is announced on the event stream as `rule_changed` or `rule_removed`.

| Endpoint | What it does |
|---|---|
| `GET /automations` | List rules. Filters are on [Tags & Groups](./tags-groups.md#automation-list-filters). |
| `GET /automations/{id}` | One rule as JSON. |
| `GET /automations/{id}/ron` | The rule's file, as written, comments included. |
| `PUT /automations/{id}` | Replace a whole rule. |
| `PATCH /automations/{id}` | Change only `enabled` and `priority`. |
| `DELETE /automations/{id}` | Delete a rule and its file. |
| `POST /automations/{id}/clone` | Copy a rule. The copy is named `Copy of ...` and starts turned off. |
| `POST /automations/{id}/test`, `POST /automations/test` | Dry run a saved rule or a draft. See [Debugging rules](./examples.md#debugging-rules). |
| `POST /automations/{id}/run` | Run a rule now, for real. |
| `GET /automations/{id}/history` | The last 20 attempts. |
| `GET /automations/export`, `POST /automations/import` | Back up and restore. See [Tags & Groups](./tags-groups.md#export-and-import). |
| `POST /automations/repoint` | Point every rule that names one device at another, for a replaced sensor. Body: `{"from": "...", "to": "..."}`. Rules turned off only because `from` was deleted are turned back on. Scripts aren't searched. |
| `GET /automations/stale-refs` | Rules that name device IDs the house no longer has. |
| `GET /automations/variables` | Hub variables and their current values. |
| `GET /automations/paused`, `DELETE /automations/{id}/pause` | Rules a `PauseRule` step paused, and resuming one. |
| `GET /automations/vocabulary` | Every trigger, condition and action this homeCore accepts, with its fields. |

All paths are under `/api/v1`. Reading needs `automations:read`, and changing needs `automations:write`.

## Hot reload

Edit any `.ron` file in the rules directory and save it. The watcher waits 200 ms for more changes, then reloads only the files that changed.

```bash
# Edit a rule directly
vim rules/front_door_alert.ron

# The server log confirms the reload:
# INFO hc_core::rule_loader: Rules hot-reloaded (surgical) added_or_updated=1 removed=0
```

Subdirectories are not loaded, so a folder such as `rules/archive/` can hold files that don't run.

## Run modes

`run_mode` controls what happens when a rule is triggered while an earlier run of it is still executing its actions, for example while it waits on a `Delay`. In the app it is "If it starts again while running".

| Run mode | App wording | Behavior |
|---|---|---|
| `Parallel` | run both | Default. Every trigger starts a new run, alongside any that are still going. |
| `Single` | skip the new one | If a run is still going, the new trigger is skipped. |
| `Restart` | start over | Stops the earlier run at its next step (cutting its cancellable delays short), then starts a new run. |
| `Queued` | queue it | Runs one at a time, in the order they were triggered. Up to `max_queue` (default 10) may be waiting or running. Past that, new triggers are skipped. |

```ron
run_mode: Queued(max_queue: 3),   // or Single, Restart, Parallel
```

In JSON these are `"run_mode": "Single"` and `"run_mode": {"Queued": {"max_queue": 3}}`. [Advanced Patterns](./advanced.md#run-modes) explains each mode in more detail, including how `Restart` and `Queued` behaved before v0.1.97.

## Priority

When several rules match the same event, homeCore evaluates them from highest priority to lowest. Order matters when a rule uses `StopRuleChain`.

```
Priority 100 → evaluated first
Priority  10 → evaluated second
Priority   0 → the usual value
Priority -10 → evaluated last
```

The API and the app accept priorities from -1000 to 1000.

## Broken rules

A bad rule file never stops homeCore from starting. A file that fails to parse is loaded as a turned-off stub named after the file (`front_door_alert [BROKEN]`), with the parse error in its `error` field. Two files with the same ID get the same treatment: the second is turned off with an error. A rule whose device reference can't be resolved is turned off with an error too, and so is a rule with an invalid cron expression.

```bash
# Find all broken rules
curl -s "http://localhost:8080/api/v1/automations?stale=true" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | {name, error}]'
```

Fix the file and save it. The watcher replaces the stub with the real rule. A rule that can't run can be saved turned off, but turning it on is refused with `422` until the problem is fixed.

When you delete a device, homeCore rewrites the rules that named it to `DELETED:{id}` and turns them off. `POST /automations/repoint` points them at a replacement and turns them back on.

## Testing a rule

`POST /api/v1/automations/{id}/test` is a dry run. It evaluates the conditions against the house as it is now, or at a time you give, and reports which actions would run without running them. `POST /api/v1/automations/{id}/run` runs the rule for real, straight away. See [Debugging rules](./examples.md#debugging-rules) for both, plus fire history. The app has the same tools on each automation's page.

## Key source files

Paths are relative to the homeCore core repository.

| File | What it contains |
|---|---|
| `crates/hc-types/src/rule.rs` | `Rule`, `Trigger`, `Condition`, `Action` types |
| `crates/hc-core/src/engine.rs` | Trigger matching, gates, condition evaluation, fire history |
| `crates/hc-core/src/executor.rs` | Action execution, all action type handlers |
| `crates/hc-core/src/scheduler.rs` | Time, sun, cron, periodic and calendar triggers, catch-up after a restart |
| `crates/hc-core/src/rule_loader.rs` | RON loading, hot-reload watcher |
| `crates/hc-core/src/rule_resolver.rs` | Resolving `device` references to device IDs |
| `crates/hc-scripting/src/lib.rs` | The Rhai functions scripts can call |
