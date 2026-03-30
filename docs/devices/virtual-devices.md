---
id: virtual-devices
title: Virtual Devices
sidebar_label: Virtual Devices
sidebar_position: 2
---

# Virtual Devices

HomeCore provides three types of software-only devices for building complex automations: **timers**, **switches**, and **modes**. They work exactly like real devices — same MQTT topics, same state bridge, same rule engine integration.

## Virtual Switches

A virtual switch is an on/off boolean flag. Use them as software conditions in rules: "away mode", "guest mode", "vacation mode", "morning routine running".

### Configuration

Switches are registered like any other device. The plugin ID is `switch` and the device_id prefix is `switch_`:

```toml
# Example: switch registered by a plugin or created via API
device_id = "switch_away_mode"
name      = "Away Mode"
```

Or they can be managed by the built-in `SwitchManager` — create devices with `plugin_id = "switch"` in the registry.

### Commanding

```bash
# Turn on
curl -s -X PATCH http://localhost:8080/api/v1/devices/switch_away_mode/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "on"}'

# Turn off
curl -s -X PATCH http://localhost:8080/api/v1/devices/switch_away_mode/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "off"}'

# Toggle
curl -s -X PATCH http://localhost:8080/api/v1/devices/switch_away_mode/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "toggle"}'
```

Both `{"command":"on"}` and `{"on": true}` payloads are accepted.

### In rules

```toml
# Condition: away mode is ON
[[conditions]]
type      = "device_state"
device    = "mode.away_switch"
attribute = "on"
op        = "Eq"
value     = true

# Action: turn away mode on
[[actions]]
type      = "set_device_state"
device    = "mode.away_switch"
state     = { command = "on" }
```

---

## Virtual Timers

A countdown timer device. Supports start, pause, resume, cancel, and reset. When the timer finishes, it fires a `DeviceStateChanged` event with `state = "finished"`, which rules can react to.

### Timer state machine

```
idle → running → finished
              → paused → running (resume)
              → cancelled → idle (restart)
```

State values: `idle`, `running`, `finished`, `paused`, `cancelled`

### Commanding

```bash
# Start a 5-minute timer
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "start", "duration_secs": 300}'

# Restart with same duration
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "restart"}'

# Pause
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "pause"}'

# Resume
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "resume"}'

# Cancel
curl -s -X PATCH http://localhost:8080/api/v1/devices/timer_garage_close/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command": "cancel"}'
```

### Timer attributes

| Attribute | Description |
|---|---|
| `state` | Current state: `idle`, `running`, `finished`, `paused`, `cancelled` |
| `remaining_secs` | Seconds remaining (only when running or paused) |
| `duration_secs` | Total configured duration |
| `started_at` | ISO-8601 timestamp when last started |

### Reacting to timer completion in rules

```toml
name = "Garage close — lights off"

[trigger]
type      = "device_state_changed"
device    = "garage.close_timer"
attribute = "state"
to        = "finished"

[[actions]]
type      = "set_device_state"
device    = "garage.main_light"
state     = { on = false }
```

### Common timer pattern — garage door close reminder

```toml
# When garage opens → start 10-minute timer
name = "Garage door — start close timer"
enabled = true

[trigger]
type      = "device_state_changed"
device    = "garage.main_door"
attribute = "open"
to        = true

[[actions]]
type      = "set_device_state"
device    = "garage.close_timer"
state     = { command = "restart", duration_secs = 600 }

---

# When timer finishes → notify
name = "Garage door — close reminder"
enabled = true

[trigger]
type      = "device_state_changed"
device    = "garage.close_timer"
attribute = "state"
to        = "finished"

[[conditions]]
type      = "device_state"
device    = "garage.main_door"
attribute = "open"
op        = "Eq"
value     = true

[[actions]]
type    = "notify"
channel = "telegram"
message = "Garage door has been open for 10 minutes!"

---

# When garage closes → cancel the timer
name = "Garage door — cancel timer on close"
enabled = true

[trigger]
type      = "device_state_changed"
device    = "garage.main_door"
attribute = "open"
to        = false

[[actions]]
type      = "set_device_state"
device    = "garage.close_timer"
state     = { command = "cancel" }
```

---

## Modes

Modes are named boolean flags with optional solar calculation. They are managed by the `ModeManager` and configured in `config/modes.toml`.

### Mode types

**Solar modes:** Computed from sunrise/sunset with optional offset. `mode_night` is the canonical solar mode — on from sunset to sunrise.

**Manual modes:** Simple on/off boolean flags set via API or rule actions.

### Configuration (`config/modes.toml`)

```toml
[[modes]]
name = "mode_night"
type = "solar"
# on_at_offset  = 0   # minutes after sunset to turn on (-30 = 30 min before)
# off_at_offset = 0   # minutes after sunrise to turn off

[[modes]]
name    = "mode_away"
type    = "manual"
default = false

[[modes]]
name    = "mode_vacation"
type    = "manual"
default = false

[[modes]]
name    = "mode_movie"
type    = "manual"
default = false
```

### API

```bash
# List all modes and their current state
curl -s http://localhost:8080/api/v1/modes \
  -H "Authorization: Bearer $TOKEN" | jq

# Set a manual mode
curl -s -X PATCH http://localhost:8080/api/v1/modes/mode_away \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Adjust solar offset (minutes before/after event)
curl -s -X PATCH http://localhost:8080/api/v1/modes/mode_night \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on_at_offset": -30, "off_at_offset": 15}'
```

### In rules

```toml
# Trigger: when mode_night turns on
[trigger]
type      = "mode_changed"
mode_name = "mode_night"
to        = true

# Condition: is mode_night active?
[[conditions]]
type      = "mode_is"
mode_name = "mode_night"
value     = true

# Action: set mode from a rule
[[actions]]
type  = "set_mode"
name  = "mode_away"
value = true
```

### Mode device IDs

Mode devices are accessible as `mode_{name}`:

```bash
# Check mode state
curl -s http://localhost:8080/api/v1/devices/mode_night \
  -H "Authorization: Bearer $TOKEN" | jq .attributes.on
```

Use in `DeviceState` conditions:

```toml
[[conditions]]
type      = "device_state"
device_id = "mode_night"
attribute = "on"
op        = "Eq"
value     = true
```
