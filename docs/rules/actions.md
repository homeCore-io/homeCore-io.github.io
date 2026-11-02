---
id: actions
title: Actions
sidebar_label: Actions
sidebar_position: 4
---

# Actions

Actions are what a rule does when it fires. They run one after another in the order listed. Use `Parallel` to run a group at the same time.

Each entry in a rule's `actions` list is a `RuleAction` that wraps one action and an `enabled` flag:

```ron
actions: [
    RuleAction(
        enabled: true,
        action: SetDeviceState(
            device_id: "living_room.floor_lamp",
            state: { "on": true, "brightness_pct": 80 },
        ),
    ),
],
```

```json
{
  "actions": [
    {
      "enabled": true,
      "action": {
        "SetDeviceState": {
          "device_id": "living_room.floor_lamp",
          "state": { "on": true, "brightness_pct": 80 }
        }
      }
    }
  ]
}
```

`enabled` defaults to `true`. Set it to `false` to switch one action off without deleting it; the fire history records it as `skipped`. Only top-level actions have this wrapper. Actions nested inside `Parallel`, `Conditional`, the repeat actions and the other containers are written bare, without `RuleAction`.

The examples below show the `action:` part only. As in triggers and conditions, optional fields take `Some(...)` in RON, and actions with no fields are written by name alone (`ExitRule`).

## Device actions

### `SetDeviceState`

Sends a command to a device by publishing to `homecore/devices/{device_id}/cmd`. The device's plugin receives it and applies it.

```ron
action: SetDeviceState(
    device_id: "living_room.floor_lamp",
    state: { "on": true, "brightness_pct": 80 },
),
```

```ron
// Several attributes at once (°C)
action: SetDeviceState(
    device_id: "hallway.thermostat",
    state: { "hvac_mode": "heat", "heat_setpoint": 20 },
),
```

| Field | Required | Description |
|---|---|---|
| `device_id` (alias `device`) | yes | A canonical name such as `living_room.floor_lamp`, a unique display name such as `Kitchen Speaker`, or a raw device ID. |
| `state` | yes | The command, as a JSON object. |
| `track_event_value` | no | `true` sends the value from the triggering event instead of `state`. Defaults to `false`. |

If a display name matches more than one device, homeCore marks the rule invalid instead of guessing.

`track_event_value` makes one device follow another. The trigger's new value is sent under the single key in `state`, so with `state: { "on": true }` a trigger value of `false` sends `{"on": false}`. If the trigger value is itself an object, it is sent as it is. If `state` has more than one key, the trigger's attribute name is used as the key.

```ron
// Mirror switch A onto switch B
action: SetDeviceState(
    device_id: "switch_b",
    state: { "on": true },
    track_event_value: true,
),
```

`SetDeviceState` is also how you send command-style payloads to plugins, with an `action` key. This is common for scenes, media players and any device where the payload asks for something to happen instead of setting a value.

```ron
// Start playback
action: SetDeviceState(
    device_id: "living_room.sonos",
    state: { "action": "play" },
),
```

```ron
// Set the volume
action: SetDeviceState(
    device_id: "living_room.sonos",
    state: { "action": "set_volume", "volume": 30 },
),
```

```ron
// Play a Sonos favorite by name
action: SetDeviceState(
    device_id: "living_room.sonos",
    state: { "action": "play_favorite", "favorite": "Dinner Jazz" },
),
```

```ron
// The generic media command
action: SetDeviceState(
    device_id: "living_room.sonos",
    state: { "action": "play_media", "media_type": "playlist", "name": "Dinner" },
),
```

The rule names the homeCore device, not the speaker's IP address, the plugin's internal API or a raw Sonos URI. The plugin resolves the favorite or playlist when the command runs. Rule files keep working when a speaker's address changes, and every plugin is automated the same way.

---

### `SetDeviceStatePerMode`

Sends a different state depending on which mode is on. The first entry whose mode is on wins. If none is on, `default_state` is sent. With no `default_state`, nothing is sent.

```ron
action: SetDeviceStatePerMode(
    device_id: "light_desk",
    modes: [
        (mode: "mode_night", state: { "on": true, "brightness_pct": 12, "color_temp": 2700 }),
        (mode: "mode_away", state: { "on": false }),
    ],
    default_state: Some({ "on": true, "brightness_pct": 70, "color_temp": 4000 }),
),
```

| Field | Required | Description |
|---|---|---|
| `device_id` (alias `device`) | yes | The device to command. |
| `modes` | yes | A list of entries, each with `mode` (a mode device ID) and `state`. |
| `default_state` | no | The state to send when no listed mode is on. |

---

### `FadeDevice`

Moves numeric attributes (`brightness_pct`, `color_temp` and so on) gradually from their current values to a target over `duration_secs`.

```ron
action: FadeDevice(
    device_id: "light_living_room",
    target: { "brightness_pct": 0, "color_temp": 2700 },
    duration_secs: 30,
    steps: Some(10),   // optional
),
```

| Field | Required | Description |
|---|---|---|
| `device_id` (alias `device`) | yes | The device to fade. |
| `target` | yes | The end state. Numeric fields are interpolated. |
| `duration_secs` | yes | Total fade time. |
| `steps` | no | How many commands to send. Defaults to one per second (`duration_secs`). Either way, the count is kept between 2 and 100. |

Starting values come from the device's current state. A numeric attribute the device doesn't report yet jumps straight to its target. Non-numeric fields in `target` (such as `"on": true`) are sent unchanged with every step.

---

### `CaptureDeviceState` / `RestoreDeviceState`

`CaptureDeviceState` saves the current attributes of some devices under a key. `RestoreDeviceState` sends those saved attributes back to the devices as a command.

```ron
// Before the movie scene
action: CaptureDeviceState(
    key: "pre_movie_scene",
    device_ids: ["light_living_room", "light_kitchen", "light_hallway"],
),
```

```ron
// Afterwards
action: RestoreDeviceState(
    key: "pre_movie_scene",
),
```

`device_ids` also accepts the spelling `devices`. Captures belong to the rule that made them, so the restore has to run in the same rule. They are kept in memory across firings until they are replaced or homeCore restarts.

---

### `ActivateScenePerMode`

Activates a different homeCore scene depending on which mode is on. The first entry whose mode is on wins. If none is on, `default_scene_id` is used. Scenes are named by their UUID.

```ron
action: ActivateScenePerMode(
    modes: [
        (mode: "mode_night", scene_id: "11111111-0000-0000-0000-000000000001"),
        (mode: "mode_away", scene_id: "22222222-0000-0000-0000-000000000002"),
    ],
    default_scene_id: Some("33333333-0000-0000-0000-000000000003"),
),
```

---

### `SetMode`

Turns a mode on or off, or toggles it.

```ron
action: SetMode(
    mode_id: "mode_away",
    command: On,   // On | Off | Toggle
),
```

| Field | Required | Description |
|---|---|---|
| `mode_id` | yes | The mode's device ID, such as `"mode_away"`. |
| `command` | yes | `On`, `Off` or `Toggle`. |

The command goes to the mode device, and other rules can react through a `ModeChanged` trigger.

## Messages and integrations

### `Notify`

Sends a notification through a channel configured in `[[notify.channels]]`.

```ron
action: Notify(
    channel: "telegram",
    message: "Front door opened",
    title: Some("Security Alert"),   // optional, defaults to "HomeCore Alert"
),
```

```ron
// Every configured channel
action: Notify(
    channel: "all",
    message: "Critical alert!",
),
```

`channel` is the name you gave a channel in `homecore.toml`, or `all` to send to every one. If sending fails (an unknown channel, a network error), homeCore logs a warning and carries on with the next action.

In a rule an alert started, `{alert.message}`, `{alert.device}`, `{alert.device_id}`, `{alert.reason}`, `{alert.kind}`, `{alert.key}`, `{alert.severity}`, `{alert.raised_at}` and `{alert.id}` in the message or title are replaced with the alert's details. `LogMessage` supports the same placeholders. No other template syntax is substituted.

---

### `LogMessage`

Writes a line to homeCore's log at a given level.

```ron
action: LogMessage(
    message: "Motion detected, turning on lights",
    level: Some(Info),   // Trace | Debug | Info | Warn | Error; defaults to Info
),
```

---

### `PublishMqtt`

Publishes a raw MQTT message. Use it for integrations that aren't homeCore devices.

```ron
action: PublishMqtt(
    topic: "homecore/events/custom_alert",
    payload: r#"{"message":"motion detected"}"#,
    retain: false,
),
```

All three fields are required. `payload` is sent as written.

---

### `CallService`

Makes an outbound HTTP request.

```ron
action: CallService(
    url: "http://sonos.local:5005/Kitchen/say/Dinner+is+ready",
    method: "GET",
    timeout_ms: Some(5000),
),
```

```ron
// POST with a JSON body
action: CallService(
    url: "http://external-api.local/v1/lights",
    method: "POST",
    body: { "id": "kitchen", "brightness": 200 },
),
```

```ron
// Retries, and the response published for other rules
action: CallService(
    url: "http://weather.local/api/current",
    method: "GET",
    retries: Some(3),
    response_event: Some("weather_update"),
),
```

| Field | Required | Description |
|---|---|---|
| `url` | yes | The URL to call. |
| `method` | yes | `GET`, `POST`, `PUT`, `PATCH` or `DELETE`. |
| `body` | no | JSON body, sent with `POST`, `PUT` and `PATCH`. |
| `timeout_ms` | no | Per-attempt timeout. Defaults to 10000. |
| `retries` | no | Extra attempts after a network error or a 5xx response. Defaults to 0. A 4xx response is not retried. |
| `response_event` | no | Publish the JSON response body to the MQTT topic `homecore/events/{response_event}`. |

Retries wait 500 ms, then 1 s, 2 s, and 4 s for every later attempt. A request that still fails counts as an action error.

The response from `response_event` goes out over MQTT only, so a `CustomEvent` trigger won't see it. React to it with an `MqttMessage` trigger on `homecore/events/weather_update`.

Use `CallService` when you really need an outside HTTP request. If the target is already a homeCore device, command it with `SetDeviceState`. A Sonos speaker registered as `sonos_living_room` should be controlled that way, not through the plugin's HTTP endpoint.

---

### `FireEvent`

Emits a custom event on homeCore's internal event bus and publishes it to MQTT at `homecore/events/{event_type}`. Rules with a `CustomEvent` trigger for the same `event_type` react straight from the internal bus.

```ron
action: FireEvent(
    event_type: "morning_routine_started",
    payload: { "source": "bedroom_motion" },
),
```

Both fields are required. Use `payload: {}` when there's nothing to send. The event shows up in the WebSocket stream and the event log.

---

### `PingHost`

Pings a host with the system `ping` command and runs `then_actions` if it answers or `else_actions` if it doesn't.

```ron
action: PingHost(
    host: "192.168.1.1",
    count: Some(3),               // optional, defaults to 1
    timeout_ms: Some(2000),       // optional, defaults to 3000
    then_actions: [
        LogMessage(message: "Router is reachable"),
    ],
    else_actions: [
        Notify(channel: "telegram", message: "Router is UNREACHABLE!"),
    ],
    response_event: Some("router_ping_result"),   // optional
),
```

`timeout_ms` is rounded up to whole seconds (at least 1) and passed to `ping -W`. With `response_event`, homeCore also fires a custom event carrying `host`, `reachable` and, when `ping` reports it, `rtt_ms`. A `CustomEvent` trigger can pick it up.

---

### `RunScript`

Runs a Rhai script.

```ron
action: RunScript(
    script: r#"
        let temp = device_state("thermostat_main")["temperature"];
        if temp > 27 {
            set_device_state("fan_living_room", #{ "on": true });
        }
    "#,
),
```

Besides the functions available to conditions (`device_state`, `hub_var`, `current_hour`, `current_minute`, `current_weekday`), a script action can use:

| Function | Description |
|---|---|
| `set_device_state(id, map)` | Command a device. |
| `notify(channel, message)` | Send a notification titled "HomeCore Alert". |
| `notify_titled(channel, title, message)` | Send a notification with a title. |
| `http_get(url)` | Make a GET request. |
| `http_post(url, json_body_string)` | Make a POST request with a JSON body. |
| `publish_mqtt(topic, payload)` | Publish an MQTT message. |
| `rule_var(name)` | Read one of this rule's variables. |
| `trigger_device()`, `trigger_value()` and the other `trigger_*()` functions | Details of the event that started the rule. See [Trigger context in Rhai](./triggers.md#trigger-context-in-rhai). |

Device commands, notifications, HTTP requests and MQTT publishes don't happen while the script is running. homeCore collects them and carries them out after the script finishes, in the order they were made. `device_state()` takes a raw device ID and returns the states as they were when the rule fired (when its turn came, for a `Queued` rule; at the start of the pass, inside a `RepeatUntil` or `RepeatWhile` loop).

## Flow control

### `Delay`

Pauses the action sequence without blocking anything else.

```ron
action: Delay(
    duration_secs: 5,
),
```

```ron
// A delay that can be cut short
action: Delay(
    duration_secs: 300,
    cancelable: true,
    cancel_key: Some("motion_off_delay"),
),
```

| Field | Required | Description |
|---|---|---|
| `duration_secs` | yes | How long to wait. |
| `cancelable` | no | Allow `CancelDelays`, `CancelRuleTimers` or `cancel_on_false` to end the delay early. Defaults to `false`. |
| `cancel_key` | no | A name for `CancelDelays` to target. A cancelable delay without one gets a generated key. |

When a delay is cancelled, the actions after it still run. Cancelling only ends the wait early. See [Advanced: Cancellable delays](./advanced#cancellable-delays).

---

### `DelayPerMode`

Waits for a duration that depends on which mode is on. The first entry whose mode is on wins. If none is on, `default_secs` is used, and with no `default_secs` there is no wait. A duration of `0` skips the wait.

```ron
action: DelayPerMode(
    modes: [
        (mode: "mode_night", duration_secs: 300),   // 5 minutes at night
        (mode: "mode_away", duration_secs: 0),      // no wait when away
    ],
    default_secs: Some(60),
),
```

This delay can't be cancelled.

---

### `Parallel`

Runs a group of actions at the same time and waits for all of them before moving on.

```ron
action: Parallel(
    actions: [
        Notify(channel: "telegram", message: "Alert!"),
        Notify(channel: "pushover", message: "Alert!"),
        SetDeviceState(device_id: "light_alarm", state: { "on": true, "color": "red" }),
    ],
),
```

---

### `Conditional`

Runs one of several branches. The question can be any [condition](./conditions.md) or a Rhai expression written as a string.

```ron
action: Conditional(
    condition: ModeIs(mode_id: "mode_night", on: true),
    then_actions: [
        SetDeviceState(device_id: "light_porch", state: { "on": true, "brightness_pct": 8 }),
    ],
    else_actions: [
        SetDeviceState(device_id: "light_porch", state: { "on": true, "brightness_pct": 70 }),
    ],
),
```

```ron
// A Rhai expression, with an else-if branch
action: Conditional(
    condition: r#"device_state("sensor_lux")["illuminance"] < 10"#,
    then_actions: [
        SetDeviceState(device_id: "light_porch", state: { "on": true, "brightness_pct": 100 }),
    ],
    else_if: [
        (
            condition: r#"device_state("sensor_lux")["illuminance"] < 50"#,
            actions: [
                SetDeviceState(device_id: "light_porch", state: { "on": true, "brightness_pct": 40 }),
            ],
        ),
    ],
    else_actions: [
        SetDeviceState(device_id: "light_porch", state: { "on": false }),
    ],
),
```

| Field | Required | Description |
|---|---|---|
| `condition` | yes | A condition, or a Rhai expression as a string. |
| `then_actions` | yes | Runs when the condition passes. |
| `else_if` | no | A list of branches, each with its own `condition` and `actions`. The first that passes runs. |
| `else_actions` | no | Runs when nothing else did. |

A condition here is judged the same way as in the rule's `conditions` list. A Rhai expression reads device states as they were when the rule fired, which matters after a `Delay` (inside a `RepeatUntil` or `RepeatWhile` loop, as they were at the start of that pass), and can use `device_state()` and the time functions but not `hub_var()` or the `trigger_*()` functions.

---

### `RepeatCount`

Runs a list of actions a fixed number of times.

```ron
action: RepeatCount(
    count: 3,
    interval_ms: Some(500),   // optional pause between passes
    actions: [
        Notify(channel: "pushover", message: "Alert!"),
    ],
),
```

The pause comes between passes, not after the last one.

---

### `RepeatWhile`

Runs a list of actions for as long as a Rhai expression stays `true`. The expression is checked before each pass, so the actions may not run at all.

```ron
action: RepeatWhile(
    condition: r#"device_state("light.office")["on"] == true"#,
    max_iterations: Some(20),
    interval_ms: Some(5000),
    actions: [
        SetDeviceState(device_id: "light.office", state: { "brightness_pct": 20 }),
    ],
),
```

`max_iterations` defaults to 100 and `interval_ms` (the pause after each pass) to 0.

---

### `RepeatUntil`

Runs a list of actions until a Rhai expression becomes `true`.

```ron
action: RepeatUntil(
    condition: r#"device_state("light.office")["on"] == false"#,
    max_iterations: Some(10),
    interval_ms: Some(2000),
    actions: [
        LogMessage(message: "Still on, checking again"),
    ],
),
```

`max_iterations` defaults to 100 and `interval_ms` (the pause after each pass) to 0. The actions run first and the expression is checked after each pass, so the actions run at least once and at most `max_iterations` times, even when the expression is already `true` at the start. Before v0.1.97 the expression was checked before each pass: the actions didn't run at all if it was already `true`, and ran at most `max_iterations - 1` times.

The expressions in `RepeatWhile` and `RepeatUntil` see device states as they are at each check, and so do the actions inside the loop. A loop can wait for a device to change, for example for a door to close. Before v0.1.97 both loops saw device states as they were when the rule fired, so a loop waiting for a change ran to its limit.

---

### `WaitForEvent`

Pauses the sequence until a matching event arrives, or until the timeout runs out.

```ron
// Wait up to 30 s for the front door sensor to report "open"
action: WaitForEvent(
    device_id: Some("door_sensor_front"),
    attribute: Some("open"),
    timeout_ms: Some(30000),
),
```

```ron
// Wait for a custom event
action: WaitForEvent(
    event_type: Some("garage_closed"),
    timeout_ms: Some(600000),
),
```

| Field | Required | Description |
|---|---|---|
| `event_type` | no | Resume on a custom event of this type, such as one from `FireEvent`. |
| `device_id` (alias `device`) | no | Resume on a state update from this device. |
| `attribute` | no | With `device_id`, only resume on an update that includes this attribute. |
| `timeout_ms` | no | Give up after this long and continue. Without it, the wait has no limit. |

The wait doesn't look at values, and either kind of event ends it. Whether the event arrived or the time ran out, the sequence carries on with the next action. To wait for a particular value, use `WaitForExpression`.

---

### `WaitForExpression`

Pauses the sequence until a Rhai expression becomes `true`.

```ron
action: WaitForExpression(
    expression: r#"device_state("door_sensor_front")["open"] == false"#,
    poll_interval_ms: Some(1000),
    timeout_ms: Some(60000),
    hold_duration_ms: Some(5000),
),
```

| Field | Required | Description |
|---|---|---|
| `expression` | yes | A Rhai expression that reads current device states. |
| `poll_interval_ms` | no | How often to check. Defaults to 500. |
| `timeout_ms` | no | Give up after this long and continue. Without it, the wait has no limit. |
| `hold_duration_ms` | no | The expression must stay `true` this long before the sequence moves on. |

Each check reads the devices' current states. An expression that fails to evaluate counts as `false`.

---

### `ExitRule`

Stops the rest of this rule's actions. It doesn't cancel pending delays or affect other rules.

```ron
action: ExitRule,
```

---

### `StopRuleChain`

Stops homeCore from evaluating the remaining rules for the current event. Rules are evaluated in priority order, highest first, so this skips the lower-priority rules (and any rules of equal priority that come after this one).

```ron
action: StopRuleChain,
```

It takes effect when the rule fires, wherever it sits in the top-level `actions` list. Inside a container action it does nothing, and a step switched off with `enabled: false` doesn't stop the chain (before v0.1.97 it still did). It usually goes on a high-priority rule that should be exclusive. See [Advanced: StopRuleChain](./advanced#stoprulechain).

---

### `CancelDelays`

Cancels cancelable delays in the current rule.

```ron
// One delay, by key
action: CancelDelays(
    key: Some("motion_off_delay"),
),
```

```ron
// All of this rule's cancelable delays
action: CancelDelays(),
```

---

### `CancelRuleTimers`

Cancels every cancelable delay pending for a rule, the current one or another.

```ron
action: CancelRuleTimers(
    rule_id: Some("550e8400-e29b-41d4-a716-446655440000"),   // leave out for the current rule
),
```

---

### `Comment`

Does nothing. Use it to label parts of a long action list. The text is logged when the rule's `log_actions` is on.

```ron
action: Comment(
    text: "--- Begin motion-triggered sequence ---",
),
```

## Variables and flags

### `SetVariable`

Sets or changes a rule-local variable. Variables keep their values across firings, in memory, until homeCore restarts or the rule is reloaded. See [Advanced: Rule-local variables](./advanced#rule-local-variables).

```ron
action: SetVariable(
    name: "open_count",
    op: Some(Add),   // Set | Add | Subtract | Multiply | Divide | Toggle
    value: 1,
),
```

| Field | Required | Description |
|---|---|---|
| `name` | yes | The variable. |
| `value` | yes | The operand. `Toggle` ignores it, but the field must still be present. |
| `op` | no | Defaults to `Set`. |

`Add`, `Subtract`, `Multiply` and `Divide` treat a missing or non-numeric variable as 0. Dividing by zero sets the variable to null. `Toggle` flips a boolean, treating a missing one as `false`.

Read variables in a `RunScript` with `rule_var("open_count")`.

---

### `SetHubVariable`

Sets or changes a hub variable, shared by every rule. It takes the same `op` values as `SetVariable`, and each write fires the event that `HubVariableChanged` triggers listen for. Hub variables are kept in memory and start empty after a restart.

```ron
action: SetHubVariable(
    name: "door_open_count",
    op: Some(Add),
    value: 1,
),
```

```ron
// Set a string
action: SetHubVariable(
    name: "last_motion_room",
    value: "living_room",
),
```

```ron
// Toggle a boolean (value is ignored but required)
action: SetHubVariable(
    name: "alarm_armed",
    op: Some(Toggle),
    value: false,
),
```

Read hub variables with a `HubVariable` condition, or in Rhai with `hub_var("door_open_count")`.

---

### `SetPrivateBoolean`

Sets a boolean flag that belongs to this rule.

```ron
action: SetPrivateBoolean(
    name: "already_notified",
    value: true,
),
```

Read it with the `PrivateBooleanIs` condition. Flags are kept in memory and reset when homeCore restarts.

## Other rules

### `RunRuleActions`

Runs another rule's actions here, without checking that rule's trigger, conditions or gates. Use it to share one action sequence between several rules.

```ron
action: RunRuleActions(
    rule_id: "550e8400-e29b-41d4-a716-446655440000",
),
```

The other rule's own `enabled` flags on its actions are respected. Its actions don't appear in this rule's fire history.

`RunRuleActions` can nest up to 10 levels deep, counted across every rule in the chain. Past that, the step is skipped and homeCore logs a warning (`max call depth reached`), so rules that run each other stop there. Before v0.1.97 the count started again at 0 in each called rule, and two rules that ran each other never stopped.

---

### `PauseRule` / `ResumeRule`

Pause or resume a rule while homeCore is running. A paused rule ignores its triggers but stays enabled.

```ron
action: PauseRule(
    rule_id: "550e8400-e29b-41d4-a716-446655440000",
),
```

```ron
action: ResumeRule(
    rule_id: "550e8400-e29b-41d4-a716-446655440000",
),
```

`rule_id` is required for both. Pauses are held in memory and clear on restart. `GET /api/v1/automations/paused` lists paused rules, and `DELETE /api/v1/automations/{id}/pause` resumes one.

## Alert actions

These act on homeCore's alerts. With no `alert_id`, an alert action works on "the alert": the one a surrounding `ForEachAlert` is on, otherwise the one that started the rule. See [Alerts that start automations](./alert-automations.md) for the `AlertFilter` fields.

```ron
// Install each waiting WLED update, one at a time
action: ForEachAlert(
    filter: AlertFilter(
        plugin_id: Some("plugin.wled"),
        topic: Some("firmware_update"),
    ),
    actions: [
        PressAlert(),
        WaitAlertCleared(
            timeout_secs: 600,
            otherwise: [
                Notify(channel: "all", message: "{alert.device} didn't come back on {alert.key}"),
                ExitRule,
            ],
        ),
    ],
),
```

| Action | Fields | What it does |
|---|---|---|
| `ForEachAlert` | `filter`, `actions` | Runs `actions` once for each active alert matching `filter`, oldest first. |
| `PressAlert` | `alert_id` (optional) | Presses the alert's button, such as "Update…". Does nothing if the alert has no button. |
| `WaitAlertCleared` | `alert_id` (optional), `timeout_secs`, `otherwise` (optional) | Waits up to `timeout_secs` for the alert to clear. If it hasn't, runs `otherwise`. Add `ExitRule` there to stop the rule. |
| `AcknowledgeAlert` | `alert_id` (optional) | Marks the alert seen. |
| `SkipAlert` | `alert_id` (optional) | Stops showing a plugin's alert about this one thing (this version, for example) while the next of its kind still shows. Only works on plugin alerts that have a key. |
| `IgnoreAlerts` | `filter`, `minutes` (optional), `note` (optional) | Doesn't raise alerts matching `filter` for `minutes`, or for good when `minutes` is left out. A `min_severity` in the filter is ignored here. |

## Action trace in fire history

Every top-level action is recorded in the rule's fire history, newest firing last:

```bash
curl -s http://localhost:8080/api/v1/automations/RULE_ID/history \
  -H "Authorization: Bearer $TOKEN" | jq '.[-1].actions'
```

Each entry has `index`, `action_type`, `description`, `outcome.status` (`ok`, `error` or `skipped`) and `duration_ms`.
