---
id: thermostat
title: Thermostat
sidebar_label: Thermostat
sidebar_position: 11
---

# Software thermostats (`hc-thermostat`)

A software thermostat uses a temperature sensor to switch a plug or switch on
and off, holding a room at a target temperature. The sensors and the plug can
come from any plugin. A YoLink sensor and a Z-Wave outlet running a window AC
is a typical pairing.

Each thermostat runs **an AC, a heater or a fan**. An AC or a fan cools (modes
Cool and Off), and a heater heats (Heat and Off). Each one is a `thermostat`
device named `thermostat_<id>`.

## Before you start

- A **sensor** in the room that reports `temperature`. You can use more than
  one.
- A **plug or switch** that runs the AC, heater or fan and reports `on`. The
  thermostat checks every on and off against what the plug reports back, so
  the plug needs to report its state.
- For a **heater**, a plug with its own auto-off is safer still. Set it a
  little longer than the thermostat's longest run, which is 4 h unless you
  change it.

## Its screens

hc-thermostat carries its own screens, and the app shows them in place of its
generic ones.

- **The plugin page** (Settings › Plugins › Thermostat) has a card for each
  thermostat. The card shows the room's temperature, the target and mode,
  what it is doing and why, its sensor and how old the reading is, its switch
  and whether the switch confirmed, today's run time and its guards, with Open
  and Turn off buttons.
  **+ Add a thermostat** walks you through it: what it runs, the plug or
  switch (only plugs and switches are offered, and one already used by a
  thermostat is marked), the sensors with their current readings, the target,
  and the safety settings for its kind. It then tells you what it will do, for
  example "Turns Outlet - Office AC on when Office Desk Temperature rises above
  68°". A thermostat in Settings that can't run is listed with the reason. If
  its target looks like °F, the page offers a fix such as **Make it 68 °F
  (20 °C)**.
- **A thermostat's panel** shows the room in a ring, the target with − and +
  buttons, and its modes. *Doing now* gives the reason for what it's doing,
  plus a button when one helps (Start now anyway, Take over now, Send it
  again, See the alert). One-tap holds ("66° for 2 h", "66° until 7:00") and
  "Back to 68°" sit below. **Today** charts the room's temperature against the
  target band, with the times it ran shaded, taken from homeCore's history of
  the thermostat. The panel also shows what it reads, what it switches and how
  it switches, each with a way to change it.
- **Its card** on Home and in rooms comes in three sizes (standard, large and
  compact). It is outlined when it needs attention: no reading, the switch not
  answering, or a hand flip being left alone.
- **The automation step** offers Set the target, Set the mode, Hold for a
  while, and Back to usual.

Temperatures are stored in °C and shown in each person's chosen unit. The
target moves half a degree Celsius at a time.

## How it decides

- **The reading.** Several sensors are combined by their average, the warmest
  or the coldest. A reading counts while it is **current**: it comes from a
  sensor that is online, lies between −40 and 60 °C, and is less than 2 h old
  (`sensor_timeout_secs`).
- **The swing.** `hysteresis` is a width in °C, split evenly either side of
  the target. With a value of 1, an AC turns on half a degree above the target
  and off half a degree below.
- **Short-cycle guards.** Once on, the switch stays on for at least
  `min_on_secs`, and once off it stays off for at least `min_off_secs`. Short
  cycling damages a compressor. A thermostat added from the plugin page gets
  its kind's guards: AC 3 min on and 5 min off, heater 2 and 2, fan 1 and 1.
  The plugin page points out an AC with no guards.
- **Every on and off is checked.** The switch has 30 s to report the state it
  was asked for, and until it does the thermostat doesn't report itself as
  cooling. If the switch never confirms, or is offline, the thermostat raises
  an alert and asks again, waiting longer between attempts each time.
- **A sensor goes quiet.** With no current reading, the switch is turned off
  and an alert says so until a reading comes back. Set `on_stale = "hold"` to
  leave the switch as it is instead. A sensor that hasn't been heard from at
  all gets two minutes of grace at start (15 s when it is newly added). When
  homeCore restarts, its broker forgets the last readings, and the sensor's
  plugin needs a moment to send them again.
- **Someone flips the switch** while the thermostat is heating or cooling.
  That counts as a manual override, and the thermostat leaves the switch alone
  for an hour (`override_secs`) or until the target or mode changes.
- **Off** sends one OFF, then leaves the switch to the household.
- **Heaters** are always turned off after their longest run without a break
  (4 h unless set, with an alert), when the plugin stops, and when the
  thermostat is removed.
- **Removing** a thermostat, or giving it a different switch, first turns off
  the switch it was running.

## What a thermostat reports

| Attribute | |
|---|---|
| `temperature` | the combined current reading, °C (null with none) |
| `setpoint` | the usual target, °C; writable |
| `hvac_mode` | `cool` / `off` (AC, fan) or `heat` / `off` (heater); writable |
| `hvac_action` | what the switch is confirmed doing: `cooling`, `heating`, `idle`, `off` |
| `reason` | why: `cooling`, `heating`, `idle_in_band`, `waiting_min_off`, `waiting_min_on`, `override`, `sensors_stale`, `actuator_not_responding`, `max_run_exceeded`, `no_switch`, `off` |
| `kind` | `ac`, `heater` or `fan` |
| `hold_setpoint`, `hold_until` | a hold that is running |
| `override_until` | when a hand flip stops being left alone |
| `sensors_stale` | no current reading |
| `sensor_readings` | each sensor's `temperature`, `at`, `stale`, `online` |
| `actuator_state`, `actuator_confirmed`, `actuator_online` | the switch: on, confirmed, online |
| `actuator_last_change`, `on_since` | when the switch last changed, and how long it has been on |
| `pending_call`, `lockout_until` | what a guard is holding back, and until when |
| `last_command_error` | the last command's refusal; null once one succeeds |
| `run_secs_today`, `cycles_today`, `longest_run_secs_today`, `today_from` | today's runs |

It also reports its settings: `hysteresis`, `aggregation`, `sensor_ids`,
`sensor_attribute`, `actuator_device_id`, `min_on_secs`, `min_off_secs`,
`max_run_secs`, `sensor_timeout_secs`, `on_stale`, `override_secs`.

## Commands

```json
{ "setpoint": 21.5 }
{ "hvac_mode": "cool" }
{ "action": "set_setpoint", "value": 21.5 }
{ "action": "set_mode", "value": "cool" }
{ "action": "hold", "setpoint": 19, "for_secs": 7200 }
{ "action": "resume" }
{ "action": "start_now" }
{ "action": "resync" }
{ "action": "set_hysteresis", "value": 1.0 }
{ "action": "set_aggregation", "value": "max" }
{ "action": "set_short_cycle", "min_on_secs": 180, "min_off_secs": 300 }
{ "action": "set_sensors", "sensor_ids": ["yolink_a", "yolink_b"] }
{ "action": "set_actuator", "device_id": "zwave_39" }
{ "action": "recalculate" }
```

- A **hold** keeps a different target for a while (1 minute to 7 days, or
  until a given time), then returns to the usual target by itself.
  **resume** ends a hold or a hand-flip override immediately. **start_now**
  skips a short-cycle guard once. **resync** sends the switch the state it
  should be in, even if it already seems to be there.
- Targets are in °C, from −40 to 45. A target that looks like °F (68, say) is
  refused rather than obeyed.
- A mode the thermostat's kind doesn't have is refused. An AC can't heat.
- **set_actuator** accepts only a plug or switch: a device with an on/off that
  isn't a lock, a thermostat or one of its own sensors. Custom on/off payloads
  can only be set in the settings file.
- Every command ends in a `plugin_command_result` event, and a refusal is
  shown on the device (`last_command_error`).

Changes made at runtime are kept in homeCore's learned state for the plugin,
not in the settings file. They are applied over the file at start, unless the
file's entry was edited since.

## Plugin actions

| Action | Purpose |
|---|---|
| `status` | The thermostats that run, and those in Settings that can't, with the reason and the °F fix (read-only) |
| `get_thermostats` | Each thermostat's settings (read-only) |
| `recalculate_all` | Decide every thermostat now; `force` sends every switch what it should be |
| `add_thermostat` | Add one (admin); this is the page's "+ Add a thermostat" |
| `remove_thermostat` | Remove one, turning its switch off first (admin) |
| `fix_entry` | Set the target of a thermostat in Settings that can't run (admin); this is "Make it 68 °F (20 °C)" |

## Alerts

| Kind | Means |
|---|---|
| `sensors_stale` | No current reading, so the switch was turned off. Clears when a reading arrives. |
| `actuator_not_responding` | The switch didn't confirm an on or off, or is offline. Offers **Send it again**. |
| `max_run_exceeded` | It ran for its longest run without a break and was turned off. Offers **Start it again**. |
| `manual_override` | Someone switched it by hand, and it is being left alone until a set time. Offers **Take over now**. Off unless you turn it on. |
| `config_entry_skipped` | A thermostat in Settings can't run as written. |

"Do something…" on any of these creates an automation that starts when the
alert fires.

## Setup

Install it from the registry (Plugins › Add) and add thermostats from its
page, or add them in its settings:

```toml
[[thermostat]]
id                 = "office_ac"
name               = "Office AC Thermostat"
kind               = "ac"
sensor_device_ids  = ["yolink_office_temp"]
setpoint           = 20.0          # °C — 68 °F is 20 °C
hysteresis         = 1.0
mode               = "cool"
actuator_device_id = "zwave_38"
min_on_secs        = 180
min_off_secs       = 300
```

A thermostat that can't run as written (a missing field, a °F target, a
heater set to cool) is left out and reported on the plugin page. The others
still run. homeCore restarts the plugin whenever its settings file changes, so
edits made by hand take effect without a reload.

With an external Mosquitto broker, the plugin needs to publish to its own
devices, to `homecore/devices/+/cmd` (the switches) and to its plugin topics.
It also needs to subscribe to `homecore/devices/+/state`, `/state/partial` and
`/availability` (the sensors and switches) as well as its own topics. The
plugin's README lists the exact patterns.

## Upgrading from 0.1.17

- New: `kind`, `reason`, `sensor_readings`, `actuator_confirmed`,
  `actuator_online`, `on_since`, holds (`hold_setpoint`, `hold_until`),
  `override_until`, today's figures, and the settings `max_run_secs`,
  `sensor_timeout_secs`, `on_stale` and `override_secs`.
- `actuator_last_error` is now `last_command_error`, and `last_update` is
  gone.
- `hvac_action` reports cooling or heating only once the switch has confirmed
  it.
- Modes follow the kind. A thermostat without `kind` is treated as an AC
  unless its mode is `heat`.
- **No current reading now turns the switch off.** It used to leave it as it
  was.
- **Off now sends one OFF and then leaves the switch alone**, and a hand flip
  while it heats or cools counts as an override for an hour.
- A °F target in Settings no longer stops the whole plugin.
- `reload_config` is gone, because homeCore restarts the plugin when its
  settings file changes.

## Notes

- A thermostat's guard timing, any hold or override, and today's figures
  survive a restart of homeCore (since 0.1.19). homeCore's broker forgets the
  plugin's own state on a restart, so the plugin also keeps these in homeCore's
  learned state and picks them up from there at start.
- The thermostat only knows about a switch through what that switch's plugin
  reports. A plug whose plugin doesn't report its state can't confirm, and
  shows as not answering.
