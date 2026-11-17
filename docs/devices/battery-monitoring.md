---
id: battery-monitoring
title: Battery monitoring
sidebar_label: Battery monitoring
sidebar_position: 4
---

# Battery monitoring

Door sensors, motion sensors, leak detectors, thermostats and locks stop working without warning when their batteries run out. homeCore's battery watcher turns the battery levels plugins report into a low-battery event. It uses hysteresis, so you hear about each drop below the line once. You can react with a notification, a rule, or just the alert in the app.

## How it works

Plugins publish battery level as `battery_pct`, a percentage from 0 to 100. Each time a `device_state_changed` event changes that attribute, the watcher checks a saved latch for the device and decides whether the new reading crosses the threshold:

```
clear ──── battery_pct ≤ threshold_pct ────► engaged → emit DeviceBatteryLow
   ▲                                              │
   │                                              ▼
engaged ── battery_pct ≥ threshold + recover_band ─► clear → emit DeviceBatteryRecovered
```

The latch is stored in `state.redb`, so a restart while a device is already low doesn't send the event again on its next reading. A device seen for the first time at a healthy level produces no event: one that first reports 80% stays silent. One that first reports 15% produces a single `DeviceBatteryLow`.

## Configuration

The `[battery]` section of `homecore.toml`:

```toml
[battery]
threshold_pct       = 20.0      # latch at or below this percent
recover_band_pct    = 5.0       # clear at threshold + recover_band
# notify_channel       = "all"   # optional shortcut, see below
# notify_on_recovered  = false   # opt-in for recovery notifications
```

The defaults (low at 20% or below, recovered at 25% or above) suit most homes. The same four settings are in the web app under **Settings › Configuration › Battery alerts**. A change applies after homeCore restarts. To see the values in effect:

```bash
curl -s http://localhost:8080/api/v1/system/battery_settings \
  -H "Authorization: Bearer $TOKEN" | jq
# → {"threshold_pct": 20.0, "recover_band_pct": 5.0, "notify_channel": null, "notify_on_recovered": false}
```

## Low-battery alerts

homeCore also raises a `low_battery` [alert](../events/alerts.md) for each device below the line, with the same threshold and recovery band. A device that reports `battery_low: true` on its own gets one too, whatever its level. These alerts show on the web app's **Alerts** page. **Alerts › All batteries** lists every battery in the house, lowest first, and the **Battery low** filter in **Settings › Devices** narrows the device list to low ones.

You can ignore low-battery alerts for one device or for every device. An ignored low battery is also left out of the notification shortcut below.

## Ways to react

Pick the simplest one that does what you need.

### 1. The built-in notification

Set `notify_channel` in `[battery]` to a channel name or `all`. The watcher then sends a notification itself each time a device goes low, titled "Battery low", with a fixed message:

```
Battery low: Front door sensor at 18%
```

You don't need a rule. Recovery notifications are off by default, since you rarely need to act on them. Set `notify_on_recovered = true` to get them as well.

### 2. A rule with a `RunScript` action

Use a rule when you want your own message, several channels, or conditions. Rule actions don't fill device values into their text, so a `RunScript` action reads the trigger instead. In a `DeviceBatteryLow` rule, `trigger_device()` returns the device's ID and `trigger_value()` its battery percentage:

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Notify on any battery low",
    enabled: true,
    priority: 0,
    trigger: DeviceBatteryLow(device_id: None),
    conditions: [],
    actions: [
        RuleAction(action: RunScript(script: r#"
            let id = trigger_device();
            let pct = trigger_value();
            notify_titled("all", "Battery low",
                "Battery low: " + id + " at " + pct + "%");
        "#)),
    ],
)
```

`notify(channel, message)` sends with the default title, "HomeCore Alert". `notify_titled(channel, title, message)` sets one. `device_state(id)` returns a device's current attributes, so `device_state(id)["battery_pct"]` reads the level too. A rule file with the all-zero `id` gets a fresh one when homeCore first loads it.

### 3. Any other action

The same trigger works with any rule action. You could fire a custom event for other tools, set a hub variable that other rules react to, or call a webhook on your own alerting system. To know which device fired, use `trigger_device()` in a `RunScript`, or set `device_id` on the trigger to limit the rule to one device.

## Setting `device_id` on the trigger

`device_id: None` matches any battery-powered device, which is the usual case. Set it when you want a rule for one device, for example one rule per important lock, each with its own actions.

```ron
trigger: DeviceBatteryLow(device_id: Some("yolink_front_door_lock")),
```

## Events

The watcher publishes two events, which rules, the WebSocket event stream and the REST event log all see:

- [`device_battery_low`](../events/event-stream.md#device_battery_low)
- [`device_battery_recovered`](../events/event-stream.md#device_battery_recovered)

Both carry the device ID, the device name when known, and the current battery percentage. `device_battery_low` also carries the threshold that was crossed.

## Triggers

- [`DeviceBatteryLow`](../rules/triggers.md#devicebatterylow)
- [`DeviceBatteryRecovered`](../rules/triggers.md#devicebatteryrecovered)

Rules can also start from the low-battery alert itself; see [Alerts that start automations](../rules/alert-automations.md).

## Implementation notes

- The watcher reads `battery_pct`, the shared name every plugin publishes. If a device doesn't have it, the watcher falls back to the retired `battery` and then `battery_level`. Plugins convert their device's own scale to 0 to 100 before publishing (YoLink reports 0 to 4), so you don't need to tune anything per plugin.
- The latch lives in the `battery_state` table in `state.redb`, so backups include it. Deleting a device does not remove its entry.
- Changing the threshold or band needs a restart. `/system/battery_settings` is read-only.
