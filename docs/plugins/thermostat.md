---
id: thermostat
title: Thermostat
sidebar_label: Thermostat
sidebar_position: 11
---

# Software thermostats (`hc-thermostat`)

A temperature sensor switches a plug or switch to hold a room at a
temperature. The sensors and the plug can belong to any plugin — a YoLink
sensor and a Z-Wave outlet running a window AC, say.

Each thermostat runs **an AC, a heater or a fan**: an AC or a fan cools (modes
Cool and Off), a heater heats (Heat and Off). Each is a `thermostat` device.

## Before you start

- A **sensor** in the room that reports `temperature` — or several.
- A **plug or switch** that runs the AC, heater or fan, and reports `on`. A
  plug that reports its state back is what lets the thermostat check every on
  and off.
- For a **heater**: a plug with its own auto-off, set a little longer than the
  thermostat's longest run (4 h unless you change it), is safer still.

## Its screens

hc-thermostat carries its own screens; the app shows them in place of its
generic ones.

- **The plugin page** (Settings › Plugins › Thermostat): a card per thermostat —
  the room's temperature, the target and mode, what it is doing and why, its
  sensor and how old the reading is, its switch and whether it confirmed,
  today's run, its guards — with Open and Turn off. **+ Add a thermostat** asks
  what it runs, the plug or switch (plugs and switches only; one already run by
  a thermostat is marked), the sensors (with their readings now), the target,
  and the safety settings for its kind, then says what it will do ("Turns
  Outlet - Office AC on when Office Desk Temperature rises above 68°"). A
  thermostat in Settings that can't run is shown with why — and for a target
  that looks like °F, **Make it 68 °F (20 °C)**.
- **A thermostat's panel**: the room in a ring, the target with − and +, its
  modes; *Doing now* with the reason and the button that helps (Start now
  anyway, Take over now, Send it again, See the alert); one-tap holds ("66° for
  2 h", "66° until 7:00") and "Back to 68°"; **Today** — the room's temperature
  against the target band with the times it ran shaded, from homeCore's
  history of the thermostat; what it reads, what it switches, and how it
  switches, each with a way to change it.
- **Its card** on Home and the rooms, in three sizes; outlined when it needs
  someone — no reading, the switch not answering, a hand flip being left alone.
- **The automation step**: Set the target, Set the mode, Hold for a while, Back
  to usual.

Temperatures are kept in °C and shown in the unit each person chose; the target
moves half a degree Celsius at a time.

## How it decides

- **The reading.** Several sensors combine by their average, the warmest or the
  coldest. A reading counts while it is **current**: from a sensor that is
  online, between −40 and 60 °C, and less than 2 h old (`sensor_timeout_secs`).
- **The swing.** `hysteresis` is a width in °C split either side of the target:
  with 1, an AC turns on half a degree above the target and off half a degree
  below.
- **Short-cycle guards.** Once on it stays on at least `min_on_secs`, once off
  at least `min_off_secs` — a compressor is damaged by short cycling. New
  thermostats get their kind's guards (AC 3 min on / 5 min off, heater 2 / 2,
  fan 1 / 1). An AC with none is pointed out on the plugin page.
- **Every on and off is checked.** The switch has 30 s to report the state it
  was asked for; until then the thermostat isn't "cooling". One it never
  confirms, or a switch that is offline, raises an alert and is asked again,
  less often each time.
- **A sensor goes quiet.** With no current reading the switch is turned off and
  an alert says so, until a reading comes back (`on_stale = "hold"` leaves the
  switch as it is instead). A sensor not heard from at all gets two minutes at
  start: when homeCore restarts, its broker forgets the last readings, and the
  sensor's plugin needs a moment to say them again.
- **Someone flips the switch** while it heats or cools: a manual override. It is
  left alone for an hour (`override_secs`), or until the target or mode changes.
- **Off** sends one OFF, then leaves the switch to the household.
- **Heaters, always**: turned off after their longest run without a break (4 h
  unless set, with an alert), when the plugin stops, and when the thermostat is
  removed.
- **Removing** a thermostat, or giving it another switch, turns off the switch
  it was running first.

## What a thermostat reports

| Attribute | |
|---|---|
| `temperature` | the combined current reading, °C (null with none) |
| `setpoint` | the usual target, °C — writable |
| `hvac_mode` | `cool` / `off` (AC, fan) or `heat` / `off` (heater) — writable |
| `hvac_action` | what the switch is confirmed doing: `cooling`, `heating`, `idle`, `off` |
| `reason` | why: `cooling`, `heating`, `idle_in_band`, `waiting_min_off`, `waiting_min_on`, `override`, `sensors_stale`, `actuator_not_responding`, `max_run_exceeded`, `no_switch`, `off` |
| `kind` | `ac`, `heater` or `fan` |
| `hold_setpoint`, `hold_until` | a hold running |
| `override_until` | a hand flip being left alone until |
| `sensors_stale` | no current reading |
| `sensor_readings` | each sensor's `temperature`, `at`, `stale`, `online` |
| `actuator_state`, `actuator_confirmed`, `actuator_online` | the switch: on, confirmed, online |
| `last_command_error` | the last command's refusal; null once one succeeds |
| `run_secs_today`, `cycles_today`, `longest_run_secs_today` | today's runs |

And its settings: `hysteresis`, `aggregation`, `sensor_ids`,
`actuator_device_id`, `min_on_secs`, `min_off_secs`, `max_run_secs`,
`sensor_timeout_secs`, `on_stale`, `override_secs`.

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
```

- A **hold** keeps a different target for a while, then goes back to the usual
  one by itself. **resume** ends a hold or a hand-flip override now.
  **start_now** skips a short-cycle guard once. **resync** sends the switch what
  it should be, even if it seems so already.
- Targets are °C. One that looks like °F (68) is refused, not obeyed.
- A mode the thermostat's kind hasn't got is refused: an AC can't heat.
- **set_actuator** takes only a plug or switch — a device with an on/off that
  isn't a lock, a thermostat or one of its sensors. Custom on/off payloads come
  from the settings file only.
- Every command ends in a `plugin_command_result` event, and a refusal is said
  on the device (`last_command_error`).

## Plugin actions

| Action | Purpose |
|---|---|
| `status` | The thermostats that run, and those in Settings that can't — why, and the °F fix (read-only) |
| `get_thermostats` | Each thermostat's settings (read-only) |
| `recalculate_all` | Decide every thermostat now; `force` sends every switch what it should be |
| `add_thermostat` | Add one (admin) — the page's "+ Add a thermostat" |
| `remove_thermostat` | Remove one, its switch off first (admin) |
| `fix_entry` | Set the target of a thermostat in Settings that can't run (admin) — "Make it 68 °F (20 °C)" |

## Alerts

| Kind | Means |
|---|---|
| `sensors_stale` | No current reading; the switch was turned off. Clears with a reading. |
| `actuator_not_responding` | The switch didn't confirm an on or off, or is offline. With **Send it again**. |
| `max_run_exceeded` | It ran its longest run without a break and was turned off. With **Start it again**. |
| `manual_override` | Someone switched it by hand; left alone until … With **Take over now**. Off unless you turn it on. |
| `config_entry_skipped` | A thermostat in Settings can't run as written. |

"Do something…" on any of them makes an automation that starts on it.

## Setup

Install it from the registry — Plugins › Add — and add thermostats from its
page. Or in its settings:

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

A thermostat that can't run as written — a missing field, a °F target, a heater
set to cool — is left out and said on the plugin page; the others run.

With an external Mosquitto broker, the plugin needs to publish to its own
devices, `homecore/devices/+/cmd` (the switches) and its plugin topics, and to
subscribe to `homecore/devices/+/state`, `/state/partial` and `/availability`
(the sensors and switches) besides its own. The plugin's README lists the exact
patterns.

## Upgrading from 0.1.17

- New: `kind`, `reason`, `sensor_readings`, `actuator_confirmed`,
  `actuator_online`, `on_since`, holds (`hold_setpoint`, `hold_until`),
  `override_until`, today's figures, and the settings `max_run_secs`,
  `sensor_timeout_secs`, `on_stale`, `override_secs`.
- `actuator_last_error` is now `last_command_error`; `last_update` is gone.
- `hvac_action` says cooling or heating only once the switch confirmed it.
- Modes follow the kind; a thermostat without `kind` is an AC unless its mode
  is `heat`.
- **No current reading now turns the switch off** (it used to hold it).
- **Off now sends one OFF and leaves the switch alone**, and a hand flip while
  it heats or cools is an override for an hour.
- A °F target in Settings no longer stops the whole plugin.
- `reload_config` is gone: homeCore restarts the plugin when its settings file
  changes.

## Notes

- After homeCore restarts, a thermostat's guard timer, a hold, an override and
  today's figures start again: they are kept in homeCore's broker, which
  forgets them on a restart (a restart of the plugin alone keeps them).
- The thermostat sees a switch only through what its plugin reports. A plug
  whose plugin doesn't report its state can't confirm, and shows as not
  answering.
