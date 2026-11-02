---
id: virtual-devices
title: Virtual Devices
sidebar_label: Virtual Devices
sidebar_position: 2
---

# Virtual Devices

HomeCore has two families of software-only devices for building automations: **helpers** (timers, switches, counters and more) and **modes**. They behave like real devices. They have the same MQTT topics, appear in `GET /api/v1/devices`, emit `device_state_changed` events, and work in rules like anything else.

In the web app, helpers live in **Settings → Helpers** and modes in **Settings → Modes**.

## Helpers

Helpers are owned by HomeCore itself (`plugin_id = "core.glue"`), with `device_type` set to the kind of helper. Their state persists across restarts. There are eleven kinds:

| Kind | ID prefix | What it holds |
|---|---|---|
| `switch` | `switch_` | An on/off flag (`on`) |
| `timer` | `timer_` | A countdown (`state`, `remaining_secs`, …) |
| `counter` | `counter_` | A count with a step, and optional `min` and `max` |
| `number` | `number_` | A number in a range, with an optional `unit` |
| `select` | `select_` | One choice from a list of `options` |
| `text` | `text_` | A string, with an optional `max_length` |
| `button` | `button_` | When it was last pressed |
| `datetime` | `datetime_` | A date, a time, or both |
| `group` | `group_` | Whether any or all member devices match (`member_ids`, `attribute`, `mode`, `expect`) |
| `threshold` | `threshold_` | Whether another device's reading is above a line, with hysteresis |
| `schedule` | `schedule_` | Whether now falls inside one of its time blocks (`active`) |

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

# List every helper
curl -s http://localhost:8080/api/v1/glue \
  -H "Authorization: Bearer $TOKEN" | jq

# Change a helper's configuration (here, a timer's own length)
curl -s -X PATCH http://localhost:8080/api/v1/glue/timer_garage_close \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"duration_secs": 600}'

# Delete a helper
curl -s -X DELETE http://localhost:8080/api/v1/glue/switch_away_mode \
  -H "Authorization: Bearer $TOKEN"
```

Kind-specific settings go in a `config` object when creating, for example `{"step": 1, "min": 0}` for a counter or `{"options": ["Home", "Away"]}` for a select. `PATCH /glue/{id}` changes only the configuration keys that kind allows, so it can't overwrite a live reading. Deleting a helper turns off the rules that name it and tells you which, the same way deleting any device does. `DELETE /glue/{id}` refuses anything that isn't a helper.

You can also seed helpers from `config/glue.toml`. Entries there are created if they don't exist yet; existing helpers are left alone unless the entry sets `override_from_config = true`, which reapplies its configuration while keeping the live state.

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

## Virtual Switches

A virtual switch is an on/off flag. Use one as a software condition in rules: "away mode", "guest mode", "vacation mode", "morning routine running".

### Commanding

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

These are HomeCore's two command shapes: a write to the writable `on` attribute, or a declared action, `{"action": "toggle"}`. The retired `{"command": "on"}` form is still accepted from older automations. A command that wouldn't change anything produces no event.

### In rules

Rules are stored as RON files. A condition that away mode is on, and an action that turns it on:

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

---

## Virtual Timers

A countdown timer. It can be started, paused, resumed, cancelled, restarted and extended. When it runs out, its `state` changes to `finished`, which rules can trigger on.

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

State values: `idle`, `running`, `paused`, `finished`, `cancelled`

### Commanding

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

`start` takes optional `duration_secs`, `label` and `repeat`. Leave `duration_secs` or `repeat` out and the timer uses its own settings; a timer with no length of its own can't be started without one. `start` works from any state and replaces a run in progress. `restart` takes no length: it reuses the length of the current or last run. `extend` lengthens only the current run, so the next cycle of a repeating timer is its usual length.

### Timer attributes

| Attribute | Description |
|---|---|
| `state` | `idle`, `running`, `paused`, `finished` or `cancelled` |
| `remaining_secs` | Seconds left. `GET /glue` computes it live for a running timer. |
| `duration_secs` | Length of the current or last run |
| `default_secs` | The timer's own length, used when a start doesn't give one |
| `repeat` | Whether it starts again when it finishes |
| `started_at` | ISO-8601 time the current run started |
| `label` | Optional label from the last start |

Besides `device_state_changed`, each change also emits a `timer_state_changed` event with the new state and the seconds left. Running and paused timers pick up where they were after a restart.

### Reacting to timer completion in rules

A rule file with the all-zero `id` gets a fresh one the first time HomeCore loads it.

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

### Common timer pattern: garage door close reminder

Three rules. The first starts a 10-minute timer when the door opens:

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

---

## Modes

A mode is a named on/off device owned by HomeCore (`plugin_id = "core.mode"`). The mode manager keeps them in `config/modes.toml`, which it watches: edit the file and the change applies without a restart. Modes created through the API are written to the same file.

### Mode kinds

**Solar modes** turn on and off at sun events, each with an optional offset in minutes. `mode_night` (on at sunset, off at sunrise) and `mode_day` (the reverse) are always present: HomeCore writes them to `modes.toml` if they are missing, and refuses to delete them. The sun events available are `Sunrise`, `Sunset`, `SolarNoon`, `CivilDawn` and `CivilDusk`.

**Manual modes** are on/off flags that only people and rules change.

A manual mode can also be driven by criteria: give it a definition (`PUT /api/v1/modes/{id}/definition`) with an `on_condition`, and HomeCore generates and maintains the rules that switch it. When it turns off is either the inverse of the on condition (`off_behavior: "inverse"`, the default) or its own `off_condition` (`"explicit"`), and it is re-checked every `reevaluate_every_n_minutes` (default 1). Making one needs the `automations:write` scope.

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
# List all modes with their config, live state and any criteria definition
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

`PATCH /modes/{id}` changes a mode's `name` and, for a solar mode, `on_event`, `off_event`, `on_offset_minutes` and `off_offset_minutes`. Moving an offset updates the mode's on and off times straight away. It doesn't switch a mode on or off; send that to the mode's device, with `{"on": …}` or `{"action": "toggle"}`.

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

Each mode is also a device with the mode's id as its `device_id`:

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
