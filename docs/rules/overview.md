---
id: overview
title: Rules Overview
sidebar_label: Overview
sidebar_position: 1
---

# Rules Overview

Automation rules are the core of HomeCore. A rule defines what happens when a specific event occurs. Rules are stored as RON (Rusty Object Notation) files in the `rules/` directory and hot-reloaded on every file change — no restarts needed.

## Data model

Every rule has exactly three parts:

```
trigger     — what event causes this rule to be evaluated
conditions  — optional checks that ALL must pass (AND logic), can be empty []
actions     — what to do (run in sequence by default)
```

## Execution flow

```
Event arrives (device state change, time trigger, webhook, etc.)
  → filter rules whose trigger matches the event type
  → sort matching rules by priority (highest first)
  → for each rule:
      → if rule is paused or disabled → skip
      → if cooldown_secs active → record "cooldown" and skip
      → evaluate trigger_condition Rhai gate (if set)
      → evaluate conditions (short-circuit AND — stop at first failure)
      → if all pass → execute actions
      → record full trace in fire history ring buffer
  → StopRuleChain action skips remaining lower-priority rules
```

## Rule file format (RON)

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",  // all zeros = auto-generated on first load
    name: "My rule",
    enabled: true,
    priority: 10,          // higher = evaluated first; range [-1000, 1000]
    tags: ["lighting", "morning"],

    trigger: DeviceStateChanged(
        device_id: "yolink_front_door",
        attribute: Some("open"),
        // to: Some(true),   // optional: only fire when attribute changes TO this value
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

    // Optional fields (shown with defaults):
    // cooldown_secs: Some(300),
    // trigger_condition: Some("device_state(\"mode_night\")[\"on\"] == true"),
    // required_expression: Some("current_hour() >= 6 && current_hour() < 22"),
)
```

## Creating rules via API

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
        "device_id": "yolink_front_door",
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

Rules created via API are immediately written to a `.ron` file in `rules/` and take effect instantly.

## Hot-reload

Edit any `.ron` file in `rules/` and save — the rule is reloaded within 200 ms. No API call, no restart.

```bash
# Edit a rule directly
vim rules/front_door_alert.ron

# Check it was reloaded (watch the server log)
# INFO hc_core::rule_loader: Hot-reloaded rule "Front door alert"
```

## Priority

Rules with higher priority are evaluated before rules with lower priority for the same event. The order matters when using `StopRuleChain`.

```
Priority 100 → evaluated first
Priority  10 → evaluated second
Priority   0 → default
Priority -10 → evaluated last
```

## Broken rules

HomeCore never fails to start because of a bad rule file. A rule that fails to parse becomes a disabled **stub**:

```bash
# Find all broken rules
curl -s http://localhost:8080/api/v1/automations \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.error != null) | {name, error}]'
```

Fix the RON file and save — the watcher replaces the stub automatically.

## Key source files

| File | What it contains |
|---|---|
| `crates/hc-types/src/rule.rs` | `Rule`, `Trigger`, `Condition`, `Action` types |
| `crates/hc-core/src/engine.rs` | Trigger matching, condition evaluation, fire history |
| `crates/hc-core/src/executor.rs` | Action execution, all action type handlers |
| `crates/hc-core/src/rule_loader.rs` | RON loading, hot-reload watcher |
| `rules/` | Live rule files (RON) |
| `rules/examples/` | Reference patterns and commented examples |
