---
id: battery-monitoring
title: Battery monitoring
sidebar_label: Battery monitoring
sidebar_position: 4
---

# Battery monitoring

Battery-powered devices (door sensors, motion sensors, leak detectors,
thermostats, locks, …) silently fail if their batteries die before
anyone notices. HomeCore's battery watcher turns every report a plugin
publishes into a structured **low-battery alert** with hysteresis, so
you find out *once* per crossing and can react however you like — visual
indicator, push notification, scripted action.

## How it works

Plugins normalize battery levels to a `battery` attribute on the
device's state, expressed as a percentage (0–100). Every time a
`DeviceStateChanged` event touches that attribute, the watcher consults
a persisted per-device latch and decides whether the change crosses the
configured threshold:

```
clear ──── battery_pct ≤ threshold_pct ────► engaged → emit DeviceBatteryLow
   ▲                                              │
   │                                              ▼
engaged ── battery_pct ≥ threshold + recover_band ─► clear → emit DeviceBatteryRecovered
```

The latch is stored in `state.redb` so a restart while a device is
already low does **not** re-emit on the next reading. Devices are
"first-sighting silent" if healthy: a fresh device that reports 80%
on first observation produces no event. A fresh device that reports
15% on first observation produces a single `DeviceBatteryLow`.

## Configuration

Add a `[battery]` section to `homecore.toml`:

```toml
[battery]
threshold_pct       = 20.0      # latch at or below this percent
recover_band_pct    = 5.0       # clear at threshold + recover_band
# notify_channel       = "all"   # optional shortcut, see below
# notify_on_recovered  = false   # opt-in for recovery notifications
```

Defaults are sensible for most installs (latch at ≤ 20%, recover at
≥ 25%). You can confirm the live values via:

```bash
curl -s http://localhost:8080/api/v1/system/battery_settings \
  -H "Authorization: Bearer $TOKEN" | jq
```

## The three usage paths

Pick the simplest one that meets your need:

### 1. Built-in notify shortcut

The fastest path. Set `notify_channel` in `[battery]`, and the watcher
will fire `hc-notify` directly on each low edge with a fixed message
format:

```
Battery low: Front door sensor at 18%
```

No rules required. Recovery notifications are off by default
(they're typically less actionable); set `notify_on_recovered = true`
to opt in.

### 2. Rule with `RunScript` action

Use this when you want a custom message, multiple channels, or
conditional logic. Until template substitution lands for literal action
params, `RunScript` is the way to read trigger context inside an
action. Rhai's built-in `trigger_device()` returns the firing device's
id; pair it with `device_state(id)` to read the name and current
battery level:

```ron
Rule(
    id: "",
    name: "Notify on any battery low",
    enabled: true,
    priority: 0,
    trigger: DeviceBatteryLow(device_id: None),
    conditions: [],
    actions: [
        RuleAction(action: RunScript(script: r#"
            let id = trigger_device();
            let dev = device_state(id);
            notify("all", "Battery low",
                "Battery low: " + dev["name"] + " at " + dev["attributes"]["battery"] + "%");
        "#)),
    ],
)
```

A reference rule lives at `core/rules/examples/battery_low_notify.ron`
in the source tree.

### 3. Any non-notification reaction

The same trigger pairs with any rule action. A few examples:

- Log to a custom event for downstream tooling
- Set a hub variable that other rules can react to
- Activate a scene that puts the home in "battery audit" mode
- Fire a webhook to your own alerting system

In all cases, identify the device via `trigger_device()` from a
`RunScript`, or by setting `device_id` on the trigger to scope the
rule to a specific device.

## When to set `device_id` on the trigger

By default `device_id: None` matches any battery-powered device — the
common case. Set it when you want a *per-device* rule, e.g. one rule
per critical lock with different priorities or actions.

```ron
trigger: DeviceBatteryLow(device_id: Some("yolink_front_door_lock")),
```

## House Status hero tile

The bundled web admin's overview dashboard surfaces low-battery
devices on its **House Status** hero with a single live tile. The
count comes from the same `battery_pct` attribute the watcher reads,
and the threshold is fetched from the same `[battery]` config —
edits to `homecore.toml` are reflected on the next restart. Click the
tile to drop into a filtered devices view showing only the offenders.

See [Web UI overview](../web-ui/overview.md) for details on the dashboard.

## Events emitted

The watcher publishes two new event variants on the public event bus,
visible to rules, the WebSocket event stream, and the REST event log:

- [`device_battery_low`](../events/event-stream.md#device_battery_low)
- [`device_battery_recovered`](../events/event-stream.md#device_battery_recovered)

Both carry the device id, optional name, current battery percentage,
and (for `device_battery_low`) the threshold value that was crossed.

## Triggers

- [`DeviceBatteryLow`](../rules/triggers.md#devicebatterylow)
- [`DeviceBatteryRecovered`](../rules/triggers.md#devicebatteryrecovered)

## Implementation notes

- The watcher reads the `battery`, `battery_pct`, or `battery_level`
  attribute (in that order). YoLink's 0–4 scale is converted to 0–100
  in the plugin layer; Z-Wave reports continuous values. Either format
  works without per-plugin tuning.
- Hysteresis state lives in the `battery_state` redb table inside
  `state.redb`. Backups include it; deleting a device removes its entry.
- Threshold edits in `homecore.toml` require a restart today. A future
  PATCH endpoint on `/system/battery_settings` will allow runtime
  changes without restart.
