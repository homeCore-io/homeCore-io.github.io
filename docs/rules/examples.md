---
id: examples
title: Rule Examples
sidebar_label: Examples
sidebar_position: 7
---

# Rule Examples

Worked end-to-end examples covering the most common automation patterns.

## 1. Door alert during specific hours

Notify when the front door opens between 8 AM and 10 PM.

```toml
id       = ""
name     = "Front door — daytime alert"
enabled  = true
priority = 10
tags     = ["door-alerts", "security"]

[trigger]
type      = "device_state_changed"
device_id = "yolink_front_door"
attribute = "open"
to        = true

[[conditions]]
type  = "time_window"
start = "08:00"
end   = "22:00"

[[actions]]
type    = "notify"
channel = "telegram"
message = "Front door opened at {{time}}"
```

---

## 2. Garage door — alert if left open 10 minutes

Check every minute; alert if the garage has been open for 10+ continuous minutes.

```toml
id       = ""
name     = "Garage — left open alert"
enabled  = true
priority = 10
tags     = ["garage", "door-alerts"]
cooldown_secs = 600   # don't spam — alert at most every 10 minutes

[trigger]
type       = "cron"
expression = "0 * * * * *"   # every minute

[[conditions]]
type      = "device_state"
device_id = "yolink_garage_door"
attribute = "open"
op        = "Eq"
value     = true

[[conditions]]
type          = "time_elapsed"
device_id     = "yolink_garage_door"
attribute     = "open"
duration_secs = 600

[[actions]]
type    = "notify"
channel = "telegram"
message = "Garage door has been open for 10+ minutes!"
```

---

## 3. Sunset — outdoor lights on

Turn on porch and deck lights 15 minutes before sunset.

```toml
id       = ""
name     = "Outdoor lights — on at sunset"
enabled  = true
priority = 10
tags     = ["outdoor", "lighting", "solar"]

[trigger]
type           = "sun_event"
event          = "sunset"
offset_minutes = -15

[[actions]]
type = "parallel"

[[actions.actions]]
type      = "set_device_state"
device_id = "light_porch"
state     = { on = true, brightness = 200 }

[[actions.actions]]
type      = "set_device_state"
device_id = "light_deck"
state     = { on = true, brightness = 150 }
```

---

## 4. Motion-triggered light with auto-off

Turn on a hallway light when motion is detected, turn it off 5 minutes after no motion. Cancel the off timer if motion is detected again.

**Rule A — turn on and schedule off:**

```toml
id       = ""
name     = "Hallway — motion on"
enabled  = true
priority = 10

[trigger]
type      = "device_state_changed"
device_id = "motion_hallway"
attribute = "motion"
to        = true

[[actions]]
type      = "set_device_state"
device_id = "light_hallway"
state     = { on = true }

[[actions]]
type = "comment"
text = "Wait 5 minutes then turn off"

[[actions]]
type          = "delay"
duration_secs = 300
cancelable    = true
cancel_key    = "hallway_off_delay"

[[actions]]
type      = "set_device_state"
device_id = "light_hallway"
state     = { on = false }
```

**Rule B — cancel the off timer on new motion:**

```toml
id       = ""
name     = "Hallway — motion cancel off"
enabled  = true
priority = 20   # higher priority — fires before rule A

[trigger]
type      = "device_state_changed"
device_id = "motion_hallway"
attribute = "motion"
to        = true

[[actions]]
type       = "cancel_delays"
cancel_key = "hallway_off_delay"
```

---

## 5. Morning routine — fan-out with CustomEvent

A single motion trigger starts a chain of parallel actions via `CustomEvent`.

**Rule 1 — motion → fire event:**

```toml
id       = ""
name     = "Morning — motion detected"
enabled  = true
priority = 10

[trigger]
type      = "device_state_changed"
device_id = "motion_bedroom"
attribute = "motion"
to        = true

[[conditions]]
type  = "time_window"
start = "06:00"
end   = "09:00"

[[actions]]
type       = "fire_event"
event_type = "morning_routine_started"
payload    = {}
```

**Rule 2 — coffee on:**

```toml
id = ""
name = "Morning — start coffee"
enabled = true
priority = 10

[trigger]
type       = "custom_event"
event_type = "morning_routine_started"

[[actions]]
type      = "set_device_state"
device_id = "smart_plug_coffee"
state     = { on = true }
```

**Rule 3 — thermostat:**

```toml
id = ""
name = "Morning — thermostat"
enabled = true
priority = 10

[trigger]
type       = "custom_event"
event_type = "morning_routine_started"

[[actions]]
type      = "set_device_state"
device_id = "thermostat_main"
state     = { target_temp = 70 }
```

**Rule 4 — raise blinds:**

```toml
id = ""
name = "Morning — open blinds"
enabled = true
priority = 10

[trigger]
type       = "custom_event"
event_type = "morning_routine_started"

[[actions]]
type      = "set_device_state"
device_id = "zwave_blinds_bedroom"
state     = { position = 100 }
```

---

## 6. Arrival home — context-aware welcome

When front door opens and away mode is active: turn on lights, turn off away mode, welcome announcement.

```toml
id       = ""
name     = "Arrival home"
enabled  = true
priority = 10
tags     = ["presence", "arrival"]

[trigger]
type      = "device_state_changed"
device_id = "yolink_front_door"
attribute = "open"
to        = true

[[conditions]]
type  = "mode_is"
mode  = "mode_away"
value = true

[[actions]]
type = "parallel"

[[actions.actions]]
type      = "set_device_state"
device_id = "light_entryway"
state     = { on = true, brightness = 200 }

[[actions.actions]]
type      = "set_device_state"
device_id = "thermostat_main"
state     = { mode = "heat", target_temp = 70 }

[[actions]]
type  = "set_mode"
name  = "mode_away"
value = false

[[actions]]
type   = "call_service"
url    = "http://sonos.local:5005/Entryway/say/Welcome+home"
method = "GET"
```

---

## 7. Play a Sonos favorite by name

Start a named Sonos favorite when a virtual switch turns on.

This example demonstrates the preferred pattern for media playback in HomeCore:

- target the HomeCore canonical device name
- send a structured command payload
- let the plugin resolve the favorite internally

You do **not** need to hardcode a Sonos player IP, plugin-local HTTP endpoint, or a raw transport URI.

```toml
id       = ""
name     = "Kitchen music — play favorite"
enabled  = true
priority = 10
tags     = ["music", "sonos", "kitchen"]

[trigger]
type      = "device_state_changed"
device    = "kitchen.music_switch"
attribute = "on"
to        = true

[[actions]]
type      = "set_device_state"
device    = "kitchen.sonos"
state     = { action = "play_favorite", favorite = "Morning Jazz" }
```

### What the rule does

1. A virtual switch named `switch_kitchen_music` turns on
2. HomeCore resolves `kitchen.sonos` to the real device ID and publishes a command to `homecore/devices/{device_id}/cmd`
3. `hc-sonos` receives that command
4. The plugin looks up the Sonos favorite named `Morning Jazz`
5. The plugin starts playback on the kitchen speaker

### When to use this pattern

Use this form when:

- the target is a HomeCore media player device such as `sonos_kitchen`
- the target is a HomeCore media player device such as `kitchen.sonos`
- the content is a named Sonos favorite or playlist
- you want the rule to stay stable even if the speaker IP or Sonos URI changes

### Related variants

```toml
# Play a playlist by name
[[actions]]
type      = "set_device_state"
device    = "kitchen.sonos"
state     = { action = "play_playlist", playlist = "Dinner" }

# Use the generic media command shape
[[actions]]
type      = "set_device_state"
device_id = "sonos_kitchen"
state     = { action = "play_media", media_type = "favorite", name = "Morning Jazz" }
```

---

## 8. Hysteresis control — humidifier

Turn a humidifier on when humidity drops below 35%, off when it rises above 50%.

```toml
# Turn ON
id       = ""
name     = "Humidifier — on"
enabled  = true
priority = 10

[trigger]
type      = "device_state_changed"
device_id = "yolink_humidity_sensor"
attribute = "humidity"

[[conditions]]
type      = "device_state"
device_id = "yolink_humidity_sensor"
attribute = "humidity"
op        = "Lt"
value     = 35

[[conditions]]
type      = "device_state"
device_id = "smart_plug_humidifier"
attribute = "on"
op        = "Eq"
value     = false

[[actions]]
type      = "set_device_state"
device_id = "smart_plug_humidifier"
state     = { on = true }
```

```toml
# Turn OFF
id       = ""
name     = "Humidifier — off"
enabled  = true
priority = 10

[trigger]
type      = "device_state_changed"
device_id = "yolink_humidity_sensor"
attribute = "humidity"

[[conditions]]
type      = "device_state"
device_id = "yolink_humidity_sensor"
attribute = "humidity"
op        = "Gt"
value     = 50

[[conditions]]
type      = "device_state"
device_id = "smart_plug_humidifier"
attribute = "on"
op        = "Eq"
value     = true

[[actions]]
type      = "set_device_state"
device_id = "smart_plug_humidifier"
state     = { on = false }
```

---

## 9. Webhook — doorbell integration

Flash a light when a smart doorbell POSTS to a webhook.

```toml
id       = ""
name     = "Doorbell — flash light"
enabled  = true
priority = 10
tags     = ["security", "doorbell"]

[trigger]
type = "webhook_received"
path = "doorbell-secret-path-a3f9c2"

[[actions]]
type = "repeat_count"
count    = 3
delay_ms = 500

[[actions.actions]]
type      = "set_device_state"
device_id = "light_living_room"
state     = { on = true, color = "yellow" }

[[actions]]
type      = "set_device_state"
device_id = "light_living_room"
state     = { on = false }

[[actions]]
type    = "notify"
channel = "telegram"
message = "Doorbell rang"
```

Fire it:

```bash
curl -X POST http://homecore.local/api/v1/webhooks/doorbell-secret-path-a3f9c2
```

---

## 10. Security alert — multi-condition with script logic

Alert when motion is detected at night AND the house is not in "expected motion" mode.

```toml
id       = ""
name     = "Security — nighttime motion alert"
enabled  = true
priority = 50
tags     = ["security"]
cooldown_secs = 120

[trigger]
type      = "device_state_changed"
device_id = "motion_exterior"
attribute = "motion"
to        = true

[[conditions]]
type  = "mode_is"
mode  = "mode_night"
value = true

[[conditions]]
type   = "script_expression"
script = '''
  !device_state("virtual_switch_expected_motion")["on"]
  && !device_state("mode_away")["on"]
'''

[[actions]]
type = "parallel"

[[actions.actions]]
type    = "notify"
channel = "telegram"
message = "Motion detected outside at night!"
title   = "Security Alert"

[[actions.actions]]
type    = "notify"
channel = "pushover"
message = "Exterior motion detected"

[[actions.actions]]
type      = "set_device_state"
device_id = "light_exterior"
state     = { on = true, brightness = 255 }
```

---

## 11. Startup state check

Check critical devices when HomeCore starts, alert if anything is in a wrong state.

```toml
id       = ""
name     = "Startup — check critical devices"
enabled  = true
priority = 10

[trigger]
type = "system_started"

[[actions]]
type      = "conditional"
condition = 'device_state("yolink_garage_door")["open"] == true'

[[actions.then_actions]]
type    = "notify"
channel = "telegram"
message = "Garage door is OPEN (detected at startup)"

[[actions]]
type      = "conditional"
condition = 'device_state("yolink_water_sensor")["wet"] == true'

[[actions.then_actions]]
type    = "notify"
channel = "telegram"
message = "Water sensor is WET (detected at startup)"
title   = "WATER ALERT"
```

---

## Debugging rules

```bash
# Dry-run a rule (no execution)
curl -s -X POST http://localhost:8080/api/v1/automations/RULE_ID/test \
  -H "Authorization: Bearer $TOKEN" | jq

# View last 20 evaluation attempts
curl -s http://localhost:8080/api/v1/automations/RULE_ID/history \
  -H "Authorization: Bearer $TOKEN" | jq

# Find rules that never fired
curl -s http://localhost:8080/api/v1/automations \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.enabled == true) | {name, trigger: .trigger.type}]'

# Find broken rules
curl -s "http://localhost:8080/api/v1/automations?stale=true" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.[] | {name, error}'
```
