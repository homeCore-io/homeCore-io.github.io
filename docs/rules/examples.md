---
id: examples
title: Rule Examples
sidebar_label: Examples
sidebar_position: 7
---

# Rule Examples

Complete rules for common automation patterns. Each one can be saved as a `.ron` file in the rules directory as it stands; change the device names to match your house. The all-zero `id` tells HomeCore to assign a real one on first load.

## 1. Door alert during specific hours

Notify when the front door opens between 8 AM and 10 PM.

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Front door, daytime alert",
    enabled: true,
    priority: 10,
    tags: ["door-alerts", "security"],

    trigger: DeviceStateChanged(
        device: "entryway.front_door",
        attribute: Some("open"),
        to: Some(true),
    ),

    conditions: [
        TimeWindow(start: "08:00:00", end: "22:00:00"),
    ],

    actions: [
        RuleAction(action: Notify(channel: "telegram", message: "Front door opened")),
    ],
)
```

---

## 2. Garage door: alert if left open 10 minutes

Check every minute, and alert if the garage has been open for 10 minutes or more.

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Garage, left open alert",
    enabled: true,
    priority: 10,
    tags: ["garage", "door-alerts"],
    cooldown_secs: Some(600),   // alert at most every 10 minutes

    trigger: Cron(expression: "0 * * * * *"),   // every minute (seconds field first)

    conditions: [
        DeviceState(device: "garage.main_door", attribute: "open", op: Eq, value: true),
        TimeElapsed(device: "garage.main_door", attribute: "open", duration_secs: 600),
    ],

    actions: [
        RuleAction(action: Notify(
            channel: "telegram",
            message: "Garage door has been open for 10+ minutes!",
        )),
    ],
)
```

`TimeElapsed` passes when the attribute hasn't changed for at least `duration_secs`. If you only need one alert per opening, a `DeviceStateChanged` trigger with `to: Some(true)` and `for_duration_secs: Some(600)` does it without the cron schedule.

---

## 3. Sunset: outdoor lights on

Turn on the porch and deck lights 15 minutes before sunset.

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Outdoor lights on at sunset",
    enabled: true,
    priority: 10,
    tags: ["outdoor", "lighting", "solar"],

    trigger: SunEvent(event: Sunset, offset_minutes: -15),

    actions: [
        RuleAction(action: Parallel(actions: [
            SetDeviceState(device: "porch.light", state: { "on": true, "brightness_pct": 80 }),
            SetDeviceState(device: "deck.light", state: { "on": true, "brightness_pct": 60 }),
        ])),
    ],
)
```

---

## 4. Motion-triggered light with auto-off

Turn the hallway light on with motion, and off once there has been no motion for 5 minutes. New motion while the light is on starts the 5 minutes over.

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Hallway motion light",
    enabled: true,
    priority: 10,
    run_mode: Single,   // one run at a time; new motion is handled by the wait below

    trigger: DeviceStateChanged(
        device: "hallway.motion",
        attribute: Some("motion"),
        to: Some(true),
    ),

    actions: [
        RuleAction(action: SetDeviceState(device: "hallway.light", state: { "on": true })),
        RuleAction(action: Comment(text: "Wait for 5 minutes without motion, then turn off")),
        RuleAction(action: WaitForExpression(
            expression: "device_state(\"motion_hallway\")[\"motion\"] == false",
            hold_duration_ms: Some(300000),
        )),
        RuleAction(action: SetDeviceState(device: "hallway.light", state: { "on": false })),
    ],
)
```

The expression is a Rhai script, so it uses the motion sensor's raw device ID (`motion_hallway` here) rather than its canonical name. It is checked every 500 ms by default and has to stay true for the whole `hold_duration_ms`; motion resets the count.

A pair of rules with a cancellable `Delay` and `CancelDelays` does **not** work for this: delay keys are private to the rule that set them, and cancelling a delay makes the run skip ahead to the "off" step instead of stopping. See [Cancellable delays](./advanced.md#cancellable-delays). A [timer helper](../devices/virtual-devices.md) is the other reliable way to do it.

---

## 5. Morning routine: fan-out with CustomEvent

One motion trigger starts several independent rules through a custom event.

**Rule 1: motion fires the event**

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Morning, motion detected",
    enabled: true,
    priority: 10,

    trigger: DeviceStateChanged(
        device: "bedroom.motion",
        attribute: Some("motion"),
        to: Some(true),
    ),

    conditions: [
        TimeWindow(start: "06:00:00", end: "09:00:00"),
    ],

    actions: [
        RuleAction(action: FireEvent(event_type: "morning_routine_started", payload: {})),
    ],
)
```

**Rule 2: coffee on**

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Morning, start coffee",
    enabled: true,
    priority: 10,

    trigger: CustomEvent(event_type: "morning_routine_started"),

    actions: [
        RuleAction(action: SetDeviceState(device: "kitchen.coffee_plug", state: { "on": true })),
    ],
)
```

**Rule 3: thermostat**

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Morning, thermostat",
    enabled: true,
    priority: 10,

    trigger: CustomEvent(event_type: "morning_routine_started"),

    actions: [
        RuleAction(action: SetDeviceState(device: "hallway.thermostat", state: { "setpoint": 21 })),   // °C
    ],
)
```

**Rule 4: raise the blinds**

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Morning, open blinds",
    enabled: true,
    priority: 10,

    trigger: CustomEvent(event_type: "morning_routine_started"),

    actions: [
        RuleAction(action: SetDeviceState(device: "bedroom.blinds", state: { "position": 100 })),   // 100 = fully open
    ],
)
```

---

## 6. Arrival home: context-aware welcome

When the front door opens while away mode is on: turn on the lights, set the heating, turn away mode off and play a welcome announcement.

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Arrival home",
    enabled: true,
    priority: 10,
    tags: ["presence", "arrival"],

    trigger: DeviceStateChanged(
        device: "entryway.front_door",
        attribute: Some("open"),
        to: Some(true),
    ),

    conditions: [
        ModeIs(mode_id: "mode_away", on: true),
    ],

    actions: [
        RuleAction(action: Parallel(actions: [
            SetDeviceState(device: "entryway.light", state: { "on": true, "brightness_pct": 80 }),
            SetDeviceState(device: "hallway.thermostat", state: { "hvac_mode": "heat", "setpoint": 21 }),   // °C
        ])),
        RuleAction(action: SetMode(mode_id: "mode_away", command: Off)),
        RuleAction(action: CallService(
            url: "http://sonos.local:5005/Entryway/say/Welcome+home",
            method: "GET",
        )),
    ],
)
```

---

## 7. Play a Sonos favorite by name

Start a named Sonos favorite when a virtual switch turns on.

This is the preferred way to start media in HomeCore:

- target the speaker by its HomeCore canonical name
- send a structured command
- let the plugin look up the favorite itself

You don't need to hardcode a speaker IP, a plugin's own HTTP endpoint or a raw transport URI.

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Kitchen music, play favorite",
    enabled: true,
    priority: 10,
    tags: ["music", "sonos", "kitchen"],

    trigger: DeviceStateChanged(
        device: "kitchen.music_switch",
        attribute: Some("on"),
        to: Some(true),
    ),

    actions: [
        RuleAction(action: SetDeviceState(
            device: "kitchen.sonos",
            state: { "action": "play_favorite", "favorite": "Morning Jazz" },
        )),
    ],
)
```

### What the rule does

1. The virtual switch `kitchen.music_switch` turns on.
2. HomeCore resolves `kitchen.sonos` to the speaker's device ID and publishes the command to `homecore/devices/{device_id}/cmd`.
3. `hc-sonos` receives the command.
4. The plugin looks up the Sonos favorite named `Morning Jazz`.
5. The plugin starts playback on the kitchen speaker.

### When to use this pattern

Use it when:

- the target is a HomeCore media player device such as `kitchen.sonos`
- the content is a named Sonos favorite or playlist
- you want the rule to keep working if the speaker's IP or the Sonos URI changes

### Related variants

Swap in either of these as the rule's action:

```ron
// Play a playlist by name
RuleAction(action: SetDeviceState(
    device: "kitchen.sonos",
    state: { "action": "play_playlist", "playlist": "Dinner" },
)),
```

```ron
// The generic media command: media_type is "favorite", "playlist" or "uri"
RuleAction(action: SetDeviceState(
    device: "kitchen.sonos",
    state: { "action": "play_media", "media_type": "favorite", "name": "Morning Jazz" },
)),
```

---

## 8. Hysteresis control: humidifier

Turn a humidifier on when humidity drops below 35% and off when it rises above 50%. Two rules share the same trigger.

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Humidifier on",
    enabled: true,
    priority: 10,

    trigger: DeviceStateChanged(device: "office.humidity_sensor", attribute: Some("humidity")),

    conditions: [
        DeviceState(device: "office.humidity_sensor", attribute: "humidity", op: Lt, value: 35),
        DeviceState(device: "office.humidifier_plug", attribute: "on", op: Eq, value: false),
    ],

    actions: [
        RuleAction(action: SetDeviceState(device: "office.humidifier_plug", state: { "on": true })),
    ],
)
```

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Humidifier off",
    enabled: true,
    priority: 10,

    trigger: DeviceStateChanged(device: "office.humidity_sensor", attribute: Some("humidity")),

    conditions: [
        DeviceState(device: "office.humidity_sensor", attribute: "humidity", op: Gt, value: 50),
        DeviceState(device: "office.humidifier_plug", attribute: "on", op: Eq, value: true),
    ],

    actions: [
        RuleAction(action: SetDeviceState(device: "office.humidifier_plug", state: { "on": false })),
    ],
)
```

---

## 9. Webhook: doorbell integration

Flash a light three times when a smart doorbell posts to a webhook.

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Doorbell, flash light",
    enabled: true,
    priority: 10,
    tags: ["security", "doorbell"],

    trigger: WebhookReceived(path: "doorbell-secret-path-a3f9c2"),

    actions: [
        RuleAction(action: RepeatCount(
            count: 3,
            interval_ms: Some(1000),   // pause between flashes
            actions: [
                SetDeviceState(device: "living_room.lamp", state: { "on": true, "color_rgb": { "r": 255, "g": 200, "b": 0 } }),
                Delay(duration_secs: 1),
                SetDeviceState(device: "living_room.lamp", state: { "on": false }),
            ],
        )),
        RuleAction(action: Notify(channel: "telegram", message: "Doorbell rang")),
    ],
)
```

Fire it:

```bash
curl -X POST http://localhost:8080/api/v1/webhooks/doorbell-secret-path-a3f9c2
```

The webhook endpoint needs no token: the path itself is the shared secret, so make it long and hard to guess. A JSON body, if sent, is available to scripts as `trigger_value()`, and query parameters as `trigger_extra()`.

---

## 10. Security alert: multi-condition with script logic

Alert when there is motion outside at night, unless motion is expected or the house is in away mode.

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Security, nighttime motion alert",
    enabled: true,
    priority: 50,
    tags: ["security"],
    cooldown_secs: Some(120),

    trigger: DeviceStateChanged(
        device: "outside.motion",
        attribute: Some("motion"),
        to: Some(true),
    ),

    conditions: [
        ModeIs(mode_id: "mode_night", on: true),
        // Scripts take raw device IDs
        ScriptExpression(script: "!device_state(\"switch_expected_motion\")[\"on\"] && !device_state(\"mode_away\")[\"on\"]"),
    ],

    actions: [
        RuleAction(action: Parallel(actions: [
            Notify(channel: "telegram", message: "Motion detected outside at night!", title: Some("Security Alert")),
            Notify(channel: "pushover", message: "Exterior motion detected"),
            SetDeviceState(device: "outside.floodlight", state: { "on": true, "brightness_pct": 100 }),
        ])),
    ],
)
```

The script could also be two more conditions (`DeviceState` on the switch and `ModeIs` on `mode_away`); a script is handy when the logic needs `||` or arithmetic.

---

## 11. Startup state check

When HomeCore starts, check critical devices and alert if any is in the wrong state.

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Startup, check critical devices",
    enabled: true,
    priority: 10,

    trigger: SystemStarted,

    actions: [
        RuleAction(action: Conditional(
            condition: DeviceState(device_id: "garage.main_door", attribute: "open", op: Eq, value: true),
            then_actions: [
                Notify(channel: "telegram", message: "Garage door is OPEN (detected at startup)"),
            ],
        )),
        RuleAction(action: Conditional(
            condition: "device_state(\"yolink_water_sensor\")[\"water_detected\"] == true",
            then_actions: [
                Notify(channel: "telegram", message: "Water sensor is WET (detected at startup)", title: Some("WATER ALERT")),
            ],
        )),
    ],
)
```

A `Conditional` asks either a check written like a rule condition (the first step) or a Rhai expression in a string (the second). A check takes device names just as conditions do; the script needs the raw device ID. `else_if` and `else_actions` are optional.

---

## Debugging rules

```bash
# Dry run: evaluate the conditions now, run nothing
curl -s -X POST http://localhost:8080/api/v1/automations/RULE_ID/test \
  -H "Authorization: Bearer $TOKEN" | jq

# Dry run as if it were 22:30 today (or ?at=2026-10-18T22:30)
curl -s -X POST "http://localhost:8080/api/v1/automations/RULE_ID/test?at=22:30" \
  -H "Authorization: Bearer $TOKEN" | jq

# Dry run a draft that isn't saved yet (same JSON body as POST /automations)
curl -s -X POST http://localhost:8080/api/v1/automations/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @draft-rule.json | jq

# Run a rule now, for real. "checks": false skips its conditions and gates
curl -s -X POST http://localhost:8080/api/v1/automations/RULE_ID/run \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"checks": true}' | jq

# The last 20 evaluation attempts, oldest first
curl -s http://localhost:8080/api/v1/automations/RULE_ID/history \
  -H "Authorization: Bearer $TOKEN" | jq

# List enabled rules with their trigger types
curl -s http://localhost:8080/api/v1/automations \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.enabled) | {name, trigger: (.trigger | if type == "object" then keys[0] else . end)}]'

# Find broken rules
curl -s "http://localhost:8080/api/v1/automations?stale=true" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.[] | {name, error}'
```

A dry run returns `rule_id`, `rule_name`, `conditions_pass`, `would_fire`, the rule's `actions`, and a `conditions` list. Each entry in that list holds the `condition`, whether it `passed`, and where they apply the `actual` and `expected` values, `elapsed_ms` (for `TimeElapsed`) and a `reason`. With `?at=`, time windows and elapsed-time checks are judged at that time, devices and modes stay as they are now, and the response includes the `at` it used. Scripts still read the real clock, and their `reason` says so.

A run answers `202 Accepted` straight away. The run itself appears in the rule's history.

Each history entry has a `timestamp`, the `trigger_type` and `trigger_context`, an `outcome` (`fired`, `condition_failed`, `cooldown`, `paused`, `required_expression_failed`, `trigger_gate_failed` or `skipped`), per-condition results in `conditions`, per-step results in `actions` and `eval_ms`.
