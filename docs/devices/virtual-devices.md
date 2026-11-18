---
id: virtual-devices
title: Virtual Devices
sidebar_label: Helpers
sidebar_position: 2
---

# Virtual Devices

homeCore has two families of software-only devices for building automations: helpers (timers, switches, counters and more) and modes. They use the same MQTT topics as real devices, appear in `GET /api/v1/devices`, emit `device_state_changed` events, and work in rules like anything else.

In the web app, helpers are under **Settings › Helpers** and modes under **Settings › Modes**.

## Helpers

homeCore owns its helpers (`plugin_id = "core.glue"`), and each one's `device_type` is its kind. Their state persists across restarts. There are eleven kinds:

| Kind | ID prefix | State it holds | Commands |
|---|---|---|---|
| `switch` | `switch_` | `on` | `{"on": true}`, `{"action": "toggle"}` |
| `timer` | `timer_` | `state`, `remaining_secs` and more (see [Timers](#timers)) | `start`, `pause`, `resume`, `cancel`, `restart`, `extend` |
| `counter` | `counter_` | `count`, with `step` and optional `min` and `max` | `increment`, `decrement`, `reset`, `set` with `value` |
| `number` | `number_` | `value`, with `min`, `max`, `step` and an optional `unit` | `{"value": 75}`, `increment`, `decrement` |
| `select` | `select_` | `selected`, one of `options` | `{"option": "Away"}` |
| `text` | `text_` | `value`, with an optional `max_length` | `{"value": "…"}` |
| `button` | `button_` | `last_pressed` | `press` |
| `datetime` | `datetime_` | `value`: a date, a time, or both (`has_date`, `has_time`) | `{"value": "2026-04-04T08:00:00"}` |
| `group` | `group_` | `on`, `active_count` and `member_count`: whether any or all of `member_ids` show `attribute` equal to `expect` (`mode` is `any` or `all`) | `recalculate`; otherwise it follows its members |
| `threshold` | `threshold_` | `above`: whether `source_attribute` on `source_device_id` is above `threshold`, with `hysteresis` | none; it follows its source |
| `schedule` | `schedule_` | `active`: whether now falls inside one of its `blocks` | none; it follows the clock |

Commands written as `increment` or `press` are actions: send `{"action": "increment"}`. A schedule block names its `days` (`Mon` to `Sun`) and a `start` and `end` time such as `"08:00"`. An end earlier than the start runs overnight.

### Managing helpers

```bash
# Create a switch. The prefix is added if you leave it off: this makes switch_away_mode.
curl -s -X POST http://localhost:8080/api/v1/glue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "switch", "id": "away_mode", "name": "Away Mode"}'

# Create a timer
curl -s -X POST http://localhost:8080/api/v1/glue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "timer", "id": "garage_close", "name": "Garage close delay"}'

# Create a select with its options
curl -s -X POST http://localhost:8080/api/v1/glue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "select", "id": "house_mode", "name": "House Mode", "config": {"options": ["Home", "Away"]}}'

# List every helper
curl -s http://localhost:8080/api/v1/glue \
  -H "Authorization: Bearer $TOKEN" | jq

# Change a helper's settings (here, a timer's own length)
curl -s -X PATCH http://localhost:8080/api/v1/glue/timer_garage_close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"config": {"duration_secs": 600}}'

# Delete a helper
curl -s -X DELETE http://localhost:8080/api/v1/glue/switch_away_mode \
  -H "Authorization: Bearer $TOKEN"
```

Settings for each kind go in a `config` object, both when creating and when changing a helper: `{"step": 1, "min": 0}` for a counter, `{"options": ["Home", "Away"]}` for a select, `{"members": [...], "attribute": "open", "mode": "any"}` for a group. A create with an ID that already exists answers `409`.

`PATCH /glue/{id}` changes only the settings each kind allows, so it can't overwrite a live reading:

| Kind | Settings |
|---|---|
| `counter` | `step`, `min`, `max` |
| `number` | `min`, `max`, `step`, `unit` |
| `select` | `options` (if the current choice is no longer an option, the first option is chosen) |
| `text` | `max_length` |
| `datetime` | `has_date`, `has_time` |
| `group` | `member_ids` (or `members`), `attribute`, `mode`, `expect` |
| `threshold` | `source_device_id`, `source_attribute`, `threshold`, `hysteresis` |
| `timer` | `duration_secs` (sets the timer's own length, `default_secs`), `repeat` |
| `schedule` | `blocks` |

A switch and a button have nothing to configure. A group, threshold or schedule is worked out again as soon as its settings change.

Deleting a helper disables the rules that name it and returns their names, the same as deleting any device. `DELETE /glue/{id}` refuses anything that isn't a helper. These endpoints need `devices:read` to list and `devices:write` to change.

You can also seed helpers from `config/glue.toml`. homeCore creates each entry that doesn't exist yet and leaves existing helpers alone, unless the entry sets `override_from_config = true`. That reapplies its settings while keeping the live state. Settings go at the top level of the entry.

```toml
[[glue]]
type = "switch"
id   = "switch_vacation_mode"
name = "Vacation Mode"

[[glue]]
type = "timer"
id   = "timer_bathroom"
name = "Bathroom Timer"
```

The `/timers` and `/switches` endpoints from earlier releases are gone. Use `/glue`.

## Switches

A virtual switch is an on/off flag. Use one as a software condition in rules: away mode, guest mode, vacation mode, or "morning routine running".

```bash
# Turn on
curl -s -X PATCH http://localhost:8080/api/v1/devices/switch_away_mode/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Turn off
curl -s -X PATCH http://localhost:8080/api/v1/devices/switch_away_mode/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": false}'

# Toggle
curl -s -X PATCH http://localhost:8080/api/v1/devices/switch_away_mode/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "toggle"}'
```

These are homeCore's two command shapes: a write to the writable `on` attribute, or the declared action `toggle`. The retired `{"command": "on"}` form still works for older automations. A command that wouldn't change anything produces no event.

### In rules

Rules are RON files. A condition that away mode is on, and an action that turns it on:

```ron
conditions: [
    DeviceState(
        device_id: "switch_away_mode",
        attribute: "on",
        op: Eq,
        value: true,
    ),
],
actions: [
    RuleAction(action: SetDeviceState(
        device_id: "switch_away_mode",
        state: {"on": true},
    )),
],
```

`device_id` also accepts the device's canonical name.

## Timers

You can start, pause, resume, cancel, restart and extend a countdown timer. When it runs out, its `state` becomes `finished`, which rules can trigger on.

### Timer states

```
idle --start--> running --runs out--> finished
                   |                     |
                 pause             (repeat: next cycle starts)
                   v
                paused --resume--> running

cancel from any state --> cancelled
start from any state  --> running
```

The states are `idle`, `running`, `paused`, `finished` and `cancelled`.

### Commanding a timer

```bash
# Start a 5-minute timer
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "duration_secs": 300}'

# Start with the timer's own length
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'

# Restart from the full length of the current run
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "restart"}'

# Add five minutes to a running or paused timer
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "extend", "duration_secs": 300}'

# Pause
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "pause"}'

# Resume
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "resume"}'

# Cancel
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "cancel"}'
```

`start` takes optional `duration_secs`, `label` and `repeat`. Leave `duration_secs` or `repeat` out and the timer uses its own settings. A timer with no length of its own can't be started without one. `start` works from any state and replaces a run in progress. `restart` takes no length; it reuses the length of the current or last run. `extend` lengthens only the current run, so the next cycle of a repeating timer is its usual length.

### Timer attributes

| Attribute | Description |
|---|---|
| `state` | `idle`, `running`, `paused`, `finished` or `cancelled` |
| `remaining_secs` | Seconds left. `GET /glue` works it out live for a running timer. |
| `duration_secs` | Length of the current or last run |
| `default_secs` | The timer's own length, used when a start doesn't give one |
| `repeat` | Whether it starts again when it finishes |
| `started_at` | RFC 3339 time the current run started |
| `label` | Label from the last start, if any |

Each change also emits a `timer_state_changed` event with the new state and the seconds left. Running and paused timers pick up where they were after a restart.

### Reacting when a timer finishes

A rule file with the all-zero `id` gets a fresh one the first time homeCore loads it.

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Garage close: lights off",
    enabled: true,
    priority: 0,
    trigger: DeviceStateChanged(
        device_id: "timer_garage_close",
        attribute: Some("state"),
        to: Some("finished"),
    ),
    conditions: [],
    actions: [
        RuleAction(action: SetDeviceState(
            device_id: "garage.main_light",
            state: {"on": false},
        )),
    ],
)
```

### Example: garage door close reminder

This takes three rules. The first starts a 10-minute timer when the door opens:

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Garage door: start close timer",
    enabled: true,
    priority: 0,
    trigger: DeviceStateChanged(
        device_id: "garage.main_door",
        attribute: Some("open"),
        to: Some(true),
    ),
    conditions: [],
    actions: [
        RuleAction(action: SetDeviceState(
            device_id: "timer_garage_close",
            state: {"action": "start", "duration_secs": 600},
        )),
    ],
)
```

The second sends a notification when the timer finishes and the door is still open:

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Garage door: close reminder",
    enabled: true,
    priority: 0,
    trigger: DeviceStateChanged(
        device_id: "timer_garage_close",
        attribute: Some("state"),
        to: Some("finished"),
    ),
    conditions: [
        DeviceState(
            device_id: "garage.main_door",
            attribute: "open",
            op: Eq,
            value: true,
        ),
    ],
    actions: [
        RuleAction(action: Notify(
            channel: "telegram",
            message: "Garage door has been open for 10 minutes!",
        )),
    ],
)
```

The third cancels the timer when the door closes:

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Garage door: cancel timer on close",
    enabled: true,
    priority: 0,
    trigger: DeviceStateChanged(
        device_id: "garage.main_door",
        attribute: Some("open"),
        to: Some(false),
    ),
    conditions: [],
    actions: [
        RuleAction(action: SetDeviceState(
            device_id: "timer_garage_close",
            state: {"action": "cancel"},
        )),
    ],
)
```

## Modes

A mode is a named on/off device owned by homeCore (`plugin_id = "core.mode"`). The mode manager keeps modes in `config/modes.toml` and watches the file, so an edit there applies without a restart. Modes created through the API are written to the same file.

### Kinds of mode

Solar modes turn on and off at sun events, each with an optional offset in minutes. The sun events are `Sunrise`, `Sunset`, `SolarNoon`, `CivilDawn` and `CivilDusk`. `mode_night` (on at sunset, off at sunrise) and `mode_day` (the reverse) always exist. homeCore writes them to `modes.toml` if they are missing and refuses to delete them.

Manual modes are on/off flags that only people and rules change.

A manual mode can also follow conditions. Give it a definition with `PUT /api/v1/modes/{id}/definition` and an `on_condition`, and homeCore generates and maintains the rules that switch it. It turns off either when the on condition stops being true (`off_behavior: "inverse"`, the default) or on its own `off_condition` (`"explicit"`). homeCore checks it again every `reevaluate_every_n_minutes` (default 1). Setting a definition needs the `automations:write` scope. `GET` reads it and `DELETE` removes it.

### Configuration (`config/modes.toml`)

```toml
[[modes]]
id = "mode_night"
name = "Night Mode"
kind = "solar"
on_event = "Sunset"
off_event = "Sunrise"
# on_offset_minutes  = -30   # 30 minutes before sunset
# off_offset_minutes = 15    # 15 minutes after sunrise

[[modes]]
id   = "mode_away"
name = "Away"
kind = "manual"

[[modes]]
id   = "mode_movie"
name = "Movie Night"
kind = "manual"
```

### API

```bash
# List all modes with their config, live state and any definition
curl -s http://localhost:8080/api/v1/modes \
  -H "Authorization: Bearer $TOKEN" | jq

# Create a manual mode (the id must start with mode_)
curl -s -X POST http://localhost:8080/api/v1/modes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "mode_guests", "name": "Guests", "kind": "manual"}'

# Turn a manual mode on: modes are commanded like any device
curl -s -X PATCH http://localhost:8080/api/v1/devices/mode_away/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Move a solar mode's offsets (at most 720 minutes either way)
curl -s -X PATCH http://localhost:8080/api/v1/modes/mode_night \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on_offset_minutes": -30, "off_offset_minutes": 15}'

# Rename a mode (its id, and every rule that uses it, stays)
curl -s -X PATCH http://localhost:8080/api/v1/modes/mode_away \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Away from home"}'

# Delete a mode
curl -s -X DELETE http://localhost:8080/api/v1/modes/mode_guests \
  -H "Authorization: Bearer $TOKEN"
```

`PATCH /modes/{id}` changes a mode's `name` and, for a solar mode, `on_event`, `off_event`, `on_offset_minutes` and `off_offset_minutes`. Moving an offset updates the mode's on and off times right away. It doesn't switch a mode on or off. To do that, command the mode's device with `{"on": …}` or `{"action": "toggle"}`.

### In rules

```ron
// Trigger: when mode_night turns on
trigger: ModeChanged(mode_id: Some("mode_night"), to: Some(true)),

// Condition: is mode_night on?
conditions: [
    ModeIs(mode_id: "mode_night", on: true),
],

// Action: turn mode_away on (On, Off or Toggle)
actions: [
    RuleAction(action: SetMode(mode_id: "mode_away", command: On)),
],
```

Leave `mode_id` out of `ModeChanged` to fire on any mode. Each change also emits a `mode_changed` event.

### Mode devices

Each mode is also a device whose `device_id` is the mode's id:

```bash
# Check mode state
curl -s http://localhost:8080/api/v1/devices/mode_night \
  -H "Authorization: Bearer $TOKEN" | jq .attributes.on
```

So a plain device condition works too:

```ron
DeviceState(
    device_id: "mode_night",
    attribute: "on",
    op: Eq,
    value: true,
)
```
