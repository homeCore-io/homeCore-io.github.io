---
id: actions
title: Actions
sidebar_label: Actions
sidebar_position: 4
---

# Actions

Actions define **what happens when a rule fires**. Actions run in sequence by default. Use `Parallel` to run a group concurrently.

Every action accepts an optional `enabled` field (default `true`). Set `enabled = false` to disable a specific action without removing it — useful for temporary debugging.

## Action reference

### `SetDeviceState`

Commands a device by publishing to `homecore/devices/{device_id}/cmd`. The plugin receives the command and applies it.

For authored rules, prefer `device = "canonical.name"` instead of `device_id = "plugin_specific_id"`.

```toml
[[actions]]
type      = "set_device_state"
device    = "living_room.floor_lamp"
state     = { on = true, brightness = 200 }

# Turn off
[[actions]]
type      = "set_device_state"
device    = "kitchen.coffee_plug"
state     = { on = false }

# Multiple attributes
[[actions]]
type      = "set_device_state"
device    = "hallway.thermostat"
state     = { mode = "heat", target_temp = 68 }
```

`device_id` still works and remains supported for backward compatibility. `device` is the preferred field because it can take:

- a canonical device name such as `living_room.floor_lamp`
- a unique display name such as `Kitchen Speaker`
- a raw device ID if you need it

If a display name matches more than one device, HomeCore marks the rule invalid instead of guessing.

`SetDeviceState` is also the standard way to send **command-style** payloads to plugins. This is common for scenes, media players, and any device where the payload represents an action rather than a simple state assignment.

### Media player examples

```toml
# Start playback
[[actions]]
type      = "set_device_state"
device    = "living_room.sonos"
state     = { action = "play" }

# Pause playback
[[actions]]
type      = "set_device_state"
device    = "living_room.sonos"
state     = { action = "pause" }

# Set volume
[[actions]]
type      = "set_device_state"
device    = "living_room.sonos"
state     = { action = "set_volume", volume = 30 }

# Play a Sonos favorite by name
[[actions]]
type      = "set_device_state"
device    = "living_room.sonos"
state     = { action = "play_favorite", favorite = "Dinner Jazz" }

# Use the generic media command shape
[[actions]]
type      = "set_device_state"
device    = "living_room.sonos"
state     = { action = "play_media", media_type = "playlist", name = "Dinner" }
```

### Why this matters

The rule references the HomeCore canonical device name, not the plugin's private HTTP API, not a speaker IP address, and not a raw Sonos URI. The plugin resolves the named favorite or playlist at execution time.

That gives you:

- stable rule files when a speaker IP changes
- one consistent automation pattern across plugins
- room for plugin-specific capabilities without leaking transport details into rules

---

### `SetDeviceStatePerMode`

Applies a different state depending on which mode is active. The first matching mode wins. Falls back to `default_state` if no mode matches.

```toml
[[actions]]
type      = "set_device_state_per_mode"
device_id = "light_desk"

[[actions.modes]]
mode_name = "mode_night"
state     = { on = true, brightness = 30, color_temp = 2700 }

[[actions.modes]]
mode_name = "mode_away"
state     = { on = false }

[actions.default_state]
on         = true
brightness = 180
color_temp = 4000
```

---

### `PublishMqtt`

Publishes a raw MQTT message. Useful for non-device integrations or custom protocols.

```toml
[[actions]]
type    = "publish_mqtt"
topic   = "homecore/events/custom_alert"
payload = '{"message":"motion detected"}'
retain  = false
```

---

### `CallService`

Makes an outbound HTTP request.

```toml
[[actions]]
type       = "call_service"
url        = "http://sonos.local:5005/Kitchen/say/Dinner+is+ready"
method     = "GET"
timeout_ms = 5000

# POST with JSON body
[[actions]]
type   = "call_service"
url    = "http://homeassistant.local/api/services/light/turn_on"
method = "POST"
body   = { entity_id = "light.kitchen", brightness = 200 }

# With retries and response capture
[[actions]]
type           = "call_service"
url            = "http://api.openweathermap.org/data/2.5/weather?q=Washington,DC&appid=KEY"
method         = "GET"
retries        = 3        # retry on network errors and 5xx (not 4xx)
response_event = "weather_update"   # fires CustomEvent with response body
```

Use `CallService` when you genuinely need an external HTTP request. Do **not** use it for normal device control when the target is already represented as a HomeCore device. For example, a Sonos speaker registered as `sonos_living_room` should usually be controlled with `SetDeviceState`, not by calling the plugin's HTTP endpoint directly.

**Retry backoff:** 500 ms → 1000 ms → 2000 ms → 4000 ms (on network errors and 5xx only).

---

### `FireEvent`

Publishes a custom event to the internal event bus and MQTT. Any rule with `Trigger::CustomEvent` matching the `event_type` fires immediately (same process, no broker round-trip).

```toml
[[actions]]
type       = "fire_event"
event_type = "morning_routine_started"
payload    = { source = "bedroom_motion" }
```

The event appears in the WebSocket stream and event log.

---

### `Notify`

Sends a notification via a configured channel.

```toml
[[actions]]
type    = "notify"
channel = "telegram"
message = "Front door opened"
title   = "Security Alert"     # optional; defaults to "HomeCore Alert"

# Log to server output only (no external service)
[[actions]]
type    = "notify"
channel = "log"
message = "Rule fired: {{rule.name}}"

# Send to ALL configured channels
[[actions]]
type    = "notify"
channel = "all"
message = "Critical alert!"
```

A notification failure (channel misconfigured, network error) logs a warning but does NOT abort the rule action sequence.

---

### `Delay`

Non-blocking pause between actions.

```toml
[[actions]]
type          = "delay"
duration_secs = 5

# Cancellable delay (can be cancelled by cancel_delays action)
[[actions]]
type          = "delay"
duration_secs = 300
cancelable    = true
cancel_key    = "motion_off_delay"
```

---

### `Parallel`

Runs a group of actions concurrently. Waits for all to complete before continuing.

```toml
[[actions]]
type = "parallel"

[[actions.actions]]
type    = "notify"
channel = "telegram"
message = "Alert!"

[[actions.actions]]
type    = "notify"
channel = "pushover"
message = "Alert!"

[[actions.actions]]
type      = "set_device_state"
device_id = "light_alarm"
state     = { on = true, color = "red" }
```

---

### `RepeatUntil`

Loops until a Rhai condition returns `true`. Checks condition **after** each iteration (do-while semantics).

```toml
[[actions]]
type           = "repeat_until"
condition      = 'device_state("light.office")["on"] == false'
max_iterations = 10
interval_ms    = 2000

[[actions.actions]]
type    = "notify"
channel = "log"
message = "Still on — checking again"
```

---

### `RepeatWhile`

Loops while a Rhai condition is `true`. Checks condition **before** each iteration (while semantics).

```toml
[[actions]]
type           = "repeat_while"
condition      = 'device_state("light.office")["on"] == true'
max_iterations = 20
interval_ms    = 5000

[[actions.actions]]
type      = "set_device_state"
device_id = "light.office"
state     = { brightness = 50 }
```

---

### `RepeatCount`

Loops a fixed number of times.

```toml
[[actions]]
type     = "repeat_count"
count    = 3
delay_ms = 500

[[actions.actions]]
type    = "notify"
channel = "pushover"
message = "Alert! ({{iteration}})"
```

---

### `Conditional`

Branches on a Rhai expression.

```toml
[[actions]]
type      = "conditional"
condition = 'device_state("mode_night")["on"] == true'

[[actions.then_actions]]
type      = "set_device_state"
device_id = "light_porch"
state     = { on = true, brightness = 20 }

[[actions.else_actions]]
type      = "set_device_state"
device_id = "light_porch"
state     = { on = true, brightness = 180 }
```

Supports full `else-if` chains with additional `[[actions.elseif_branches]]`.

---

### `FadeDevice`

Gradually interpolates numeric attributes (brightness, color_temp, etc.) to a target value over a duration.

```toml
[[actions]]
type          = "fade_device"
device_id     = "light_living_room"
duration_secs = 30
steps         = 10   # optional; defaults to duration_secs (1 step/sec)

[actions.target]
brightness = 0
color_temp = 2700
```

Non-numeric attributes pass through unchanged.

---

### `CaptureDeviceState` / `RestoreDeviceState`

Snapshots the current state of devices under a named key, and restores it later.

```toml
# Capture before a scene change
[[actions]]
type       = "capture_device_state"
key        = "pre_movie_scene"
device_ids = ["light_living_room", "light_kitchen", "light_hallway"]

# ... movie mode actions ...

# Restore when done
[[actions]]
type = "restore_device_state"
key  = "pre_movie_scene"
```

Captured state persists across rule firings (in-memory, cleared on restart).

---

### `PingHost`

ICMP ping a host. Runs `then_actions` on success, `else_actions` on failure.

```toml
[[actions]]
type       = "ping_host"
host       = "192.168.1.1"
count      = 3
timeout_ms = 2000

[[actions.then_actions]]
type    = "notify"
channel = "log"
message = "Router is reachable"

[[actions.else_actions]]
type    = "notify"
channel = "telegram"
message = "Router is UNREACHABLE!"

# Optionally fire a custom event with result
response_event = "router_ping_result"
# → {host, reachable, rtt_ms}
```

---

### `SetHubVariable`

Write a cross-rule hub variable. Fires a `hub_variable_changed` event.

```toml
[[actions]]
type  = "set_hub_variable"
name  = "door_open_count"
op    = "Add"    # Set | Add | Subtract | Multiply | Divide | Toggle | Append | Clear
value = 1

# Set a string
[[actions]]
type  = "set_hub_variable"
name  = "last_motion_room"
op    = "Set"
value = "living_room"

# Toggle a boolean
[[actions]]
type = "set_hub_variable"
name = "alarm_armed"
op   = "Toggle"
```

Read in conditions via `HubVariableIs` or in Rhai: `hub_var("door_open_count")`.

---

### `SetPrivateBoolean`

Set a boolean flag scoped to this rule only.

```toml
[[actions]]
type  = "set_private_boolean"
name  = "already_notified"
value = true
```

Read in conditions via `PrivateBooleanIs`.

---

### `StopRuleChain`

Stops HomeCore from evaluating any lower-priority rules for the current event. Rules with the same or lower priority are skipped.

```toml
[[actions]]
type = "stop_rule_chain"
```

Typically placed on a high-priority rule that should be exclusive. See [Advanced: StopRuleChain](./advanced#stoprulechain) for full usage.

---

### `RunRuleActions`

Invoke another rule's action sequence inline (without evaluating its trigger/conditions).

```toml
[[actions]]
type    = "run_rule_actions"
rule_id = "550e8400-e29b-41d4-a716-446655440000"
```

Maximum recursion depth: 10. Useful for shared action sequences across multiple rules.

---

### `WaitForEvent`

Suspend execution until a matching event arrives on the bus.

```toml
[[actions]]
type       = "wait_for_event"
event_type = "device_state_changed"
device_id  = "door_sensor_front"   # optional filter
attribute  = "open"                # optional filter
value      = false                 # optional filter
timeout_ms = 30000
```

---

### `WaitForExpression`

Suspend execution until a Rhai expression returns `true`.

```toml
[[actions]]
type       = "wait_for_expression"
expression = 'device_state("door_sensor_front")["open"] == false'
poll_ms    = 1000
timeout_ms = 60000
```

---

### `LogMessage`

Emit a log line at a specified level.

```toml
[[actions]]
type    = "log_message"
level   = "info"   # trace | debug | info | warn | error
message = "Motion detected, turning on lights"
```

---

### `Comment`

A no-op for documentation. The executor skips it silently.

```toml
[[actions]]
type = "comment"
text = "--- Begin motion-triggered sequence ---"
```

---

### `PauseRule` / `ResumeRule`

Pause or resume a rule at runtime. Paused rules skip evaluation without being disabled.

```toml
# Pause another rule
[[actions]]
type    = "pause_rule"
rule_id = "550e8400-e29b-41d4-a716-446655440000"

# Pause this rule itself (omit rule_id)
[[actions]]
type = "pause_rule"

# Resume
[[actions]]
type    = "resume_rule"
rule_id = "550e8400-e29b-41d4-a716-446655440000"
```

Pause state is in-memory and clears on restart.

---

### `ExitRule`

Stop executing this rule's remaining actions immediately. Does not affect other rules.

```toml
[[actions]]
type = "exit_rule"
```

---

### `CancelDelays`

Cancel a specific named cancellable delay.

```toml
[[actions]]
type       = "cancel_delays"
cancel_key = "motion_off_delay"
```

### `CancelRuleTimers`

Cancel all cancellable delays for a rule.

```toml
[[actions]]
type    = "cancel_rule_timers"
rule_id = "550e8400-e29b-41d4-a716-446655440000"   # omit for current rule
```

---

### `DelayPerMode`

Delay for a duration that depends on the active mode.

```toml
[[actions]]
type         = "delay_per_mode"
default_secs = 0

[[actions.modes]]
mode_name = "mode_night"
duration_secs = 300   # 5 minutes at night

[[actions.modes]]
mode_name = "mode_away"
duration_secs = 0     # no delay when away (skip the delayed action)
```

---

### `ActivateScenePerMode`

Activate a different scene depending on which mode is active.

```toml
[[actions]]
type             = "activate_scene_per_mode"
default_scene_id = "scene_daytime_living_room"

[[actions.modes]]
mode_name = "mode_night"
scene_id  = "scene_nighttime_living_room"

[[actions.modes]]
mode_name = "mode_away"
scene_id  = "scene_away_living_room"
```

---

## Action trace in fire history

Every action execution is recorded in the rule's fire history:

```bash
curl -s http://localhost:8080/api/v1/automations/RULE_ID/history \
  -H "Authorization: Bearer $TOKEN" | jq '.[0].actions'
```

Each entry includes `action_type`, `description`, `outcome.status` (`ok`/`error`/`skipped`), and `duration_ms`.
