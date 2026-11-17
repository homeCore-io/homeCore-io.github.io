---
id: thermostat
title: Thermostat
sidebar_label: Thermostat
sidebar_position: 11
---

# Thermostat (`hc-thermostat`)

This plugin makes software thermostats. Each one reads temperature sensors
you already have and switches a plug or switch on and off to hold a room at
a target. The sensors and the plug can come from any plugin. A YoLink sensor
and a Z-Wave outlet running a window AC is a typical pairing. Nothing here
talks to hardware directly.

Each thermostat runs an AC, a heater or a fan. An AC or a fan cools (modes
Cool and Off), and a heater heats (Heat and Off). Each one is a homeCore
device of type `thermostat` with the id `thermostat_<id>`.

## Before you start

You need:

- A sensor in the room that reports `temperature`. You can use more than
  one. A sensor that reports in °F or kelvin is converted to °C.
- A plug or switch that runs the AC, heater or fan and reports its `on`
  state. The thermostat checks every on and off against what the plug
  reports back, so a plug whose plugin doesn't report its state shows as
  not answering.
- For a heater, a plug with its own auto-off is safer still. Set it a little
  longer than the thermostat's longest run, which is 4 hours unless you
  change it.

If homeCore uses an external Mosquitto broker, the plugin needs to publish
to `homecore/devices/thermostat_+/#` and `homecore/devices/+/cmd` (the
switches). It needs to subscribe to its own command and state topics and to
`homecore/devices/+/state`, `homecore/devices/+/state/partial` and
`homecore/devices/+/availability` (the sensors and switches). The plugin's
README lists the exact patterns, and `hc-cli broker
generate-mosquitto-config` writes them for you.

## Install and set up

1. Install Thermostat from **Settings › Plugins › Catalog**.
2. Open its page (**Settings › Plugins › Thermostat**) and press
   **+ Add a thermostat**. It asks what the thermostat runs, the plug or
   switch (it offers only plugs and switches, and marks one another
   thermostat already uses), the sensors with their current readings, the
   target, and the safety settings for its kind. It then says what it will
   do, for example "Turns Office AC on when Office Temperature rises above
   68°".
3. Set the mode to Cool or Heat from the thermostat's panel or card.

You can also add thermostats in the plugin's settings file. Targets are in
°C:

```toml
[[thermostat]]
id                 = "office_ac"
name               = "Office AC Thermostat"
kind               = "ac"
sensor_device_ids  = ["yolink_office_temp"]
setpoint           = 20.0          # °C, 68 °F is 20 °C
hysteresis         = 1.0
mode               = "cool"
actuator_device_id = "zwave_38"
min_on_secs        = 180
min_off_secs       = 300
```

homeCore restarts the plugin whenever the file changes, so edits take effect
on their own. A thermostat that can't run as written (a missing field, a
target that looks like °F, a heater set to cool) is skipped, listed on the
plugin's page with the reason, and raises an alert. The others still run.
If its target looks like °F, the page offers a fix such as **Make it 68 °F
(20 °C)**.

## Settings

Each thermostat is one `[[thermostat]]` entry. The app shows them under
**Thermostats** on the plugin's page.

| Setting | Key | Default | What it does |
|---|---|---|---|
| ID | `id` | made for you | Names the device, `thermostat_<id>`. It never changes. |
| Name | `name` | | Shown in the app. |
| Runs | `kind` | follows the mode | `ac`, `heater` or `fan`. Left empty, a thermostat in Heat mode is a heater and any other is an AC. |
| Sensors | `sensor_device_ids` | | One or more devices that report temperature. |
| Combine by | `aggregation` | `average` | How several sensors become one reading: `average`, `min` (coldest) or `max` (warmest). |
| Mode | `mode` | `off` | `cool`, `heat` or `off`. It must suit the kind. |
| Target | `setpoint` | | The temperature to keep, °C, from -40 to 45. |
| Swing | `hysteresis` | `1.0` | A width in °C, split evenly either side of the target. Up to 5. With 1, an AC turns on half a degree above the target and off half a degree below. Too small and the switch chatters. |
| Switches | `actuator_device_id` | | The plug or switch it turns on and off. |
| Once on, stays on at least | `min_on_secs` | `0` | Seconds. Up to 3600. 0 turns the guard off. |
| Once off, stays off at least | `min_off_secs` | `0` | Seconds. Up to 3600. 0 turns the guard off. |
| Longest run | `max_run_secs` | empty | Seconds without a break before it turns the switch off and raises an alert. Empty means 4 hours for a heater and no limit otherwise. 0 means no limit. Up to 24 hours. |
| A sensor goes quiet after | `sensor_timeout_secs` | empty (2 hours) | A reading older than this no longer counts. 60 seconds to 24 hours. |
| With no reading | `on_stale` | empty (`off`) | `off` turns the switch off when no sensor has a current reading. `hold` leaves it as it is. |
| Switched by hand, left alone for | `override_secs` | empty (1 hour) | How long a hand flip is respected. 0 takes over again at once. Up to 24 hours. |

A thermostat added from the plugin's page gets defaults for its kind: an AC
stays on 3 minutes and off 5 minutes, a heater 2 and 2, a fan 1 and 1. A
fan's swing starts at 2 °C, the others at 1 °C. The page points out an AC
with no guards.

Three keys exist only in the file: `sensor_attribute` (the reading to use,
`temperature` by default), and `actuator_on_cmd` and `actuator_off_cmd`
(custom payloads for the switch; the defaults are `{"on": true}` and
`{"on": false}`).

The **Logging** section and the hidden connection settings work the same as
in every plugin. **Heartbeat** (`homecore.heartbeat_secs`) defaults to 60.

Changes made at run time (through commands or the app) are kept in
homeCore's stored state for the plugin, not in the settings file. They are
applied over the file at start, unless the file's entry was edited since.

## Devices

### How it decides

The reading is the sensors combined by **Combine by**. A sensor's reading
counts while it is current: the sensor is online, the reading lies between
-40 and 60 °C, and it is newer than **A sensor goes quiet after**.

When the room is past the target by half the swing, the thermostat turns
the switch on, and when it is back by half the swing, it turns it off. The
short cycle guards hold the switch on or off for their minimum time, since
short cycling damages a compressor.

The switch has 30 seconds to report the state it was asked for. Until it
does, the thermostat doesn't report itself as cooling or heating. If the
switch never confirms, or is offline, the thermostat raises an alert and
asks again, waiting longer each time, up to 10 minutes between tries.

With no current reading, the switch is turned off and an alert says so
until a reading comes back, unless **With no reading** is `hold`. At start,
a sensor gets two minutes to report before it counts as quiet (15 seconds
for a sensor added later), because homeCore's broker forgets the last
readings on a restart and the sensor's plugin needs a moment to send them
again.

If someone flips the switch while the thermostat is heating or cooling, it
counts as a manual override. The thermostat leaves the switch alone for an
hour, or until the target or mode changes. Off sends one OFF and then leaves
the switch to the household.

A heater is always turned off after its longest run without a break (with
an alert), when the plugin stops, and when the thermostat is removed.
Removing a thermostat, or giving it a different switch, first turns off the
switch it was running.

Guard timing, holds, overrides and today's figures survive a restart of
homeCore. The plugin keeps them in homeCore's stored state and reads them
back at start.

### Attributes

Temperatures are stored in °C and shown in each person's chosen unit. The
target moves in steps of 0.5 °C.

| Attribute | What it holds |
|---|---|
| `temperature` | the combined current reading, °C; empty with none |
| `setpoint` | the usual target, °C; writable |
| `hvac_mode` | `cool` or `off` (AC, fan), `heat` or `off` (heater); writable |
| `hvac_action` | what the switch is confirmed doing: `cooling`, `heating`, `idle` or `off` |
| `reason` | why: `cooling`, `heating`, `idle_in_band`, `waiting_min_off`, `waiting_min_on`, `override`, `sensors_stale`, `actuator_not_responding`, `max_run_exceeded`, `no_switch` or `off` |
| `kind` | `ac`, `heater` or `fan` |
| `hold_setpoint`, `hold_until` | a hold that is running |
| `override_until` | when a hand flip stops being respected |
| `sensors_stale` | true when there is no current reading |
| `sensor_readings` | each sensor's `temperature`, `at`, `stale` and `online` |
| `actuator_state`, `actuator_confirmed`, `actuator_online` | the switch: on or off, whether it confirmed, whether it is online |
| `actuator_last_change`, `on_since` | when the switch last changed, and since when it has been on |
| `pending_call`, `lockout_until` | what a guard is holding back, and until when |
| `last_command_error` | why the last command was refused; empty once one succeeds |
| `run_secs_today`, `cycles_today`, `longest_run_secs_today`, `today_from` | today's runs |
| `settled` | false during the startup grace, true after |

It also reports its settings: `hysteresis`, `aggregation`, `sensor_ids`,
`sensor_attribute`, `actuator_device_id`, `min_on_secs`, `min_off_secs`,
`max_run_secs`, `sensor_timeout_secs`, `on_stale` and `override_secs`.

### Commands

Write `setpoint` or `hvac_mode`, or send an action:

```json
{ "setpoint": 21.5 }
{ "hvac_mode": "cool" }
{ "action": "set_setpoint", "value": 21.5 }
{ "action": "set_mode", "value": "cool" }
{ "action": "hold", "setpoint": 19, "for_secs": 7200 }
{ "action": "hold", "setpoint": 19, "until": "2026-11-18T07:00:00Z" }
{ "action": "resume" }
{ "action": "start_now" }
{ "action": "resync" }
{ "action": "recalculate" }
{ "action": "set_hysteresis", "value": 1.0 }
{ "action": "set_aggregation", "value": "max" }
{ "action": "set_short_cycle", "min_on_secs": 180, "min_off_secs": 300 }
{ "action": "set_sensors", "sensor_ids": ["yolink_a", "yolink_b"] }
{ "action": "set_actuator", "device_id": "zwave_39" }
```

A hold keeps a different target for a while (1 minute to 7 days, or until a
given time) and then goes back to the usual target. `resume` ends a hold or
a hand flip override at once. `start_now` skips a short cycle guard once.
`resync` and `recalculate` send the switch the state it should be in, even
if it already seems to be there.

The thermostat refuses:

- a target outside -40 to 45 °C. One that looks like °F (68, say) is refused
  with the °C value it probably meant.
- a mode its kind doesn't have. An AC can't heat.
- a swing over 5 °C or a guard over 3600 seconds.
- `set_actuator` with anything but a plug or switch: a lock, another
  thermostat or one of its own sensors is refused. An empty `device_id`
  removes the switch. Custom on and off payloads come only from the file.

Every command ends in a `plugin_command_result` event, and a refusal shows
on the device as `last_command_error`.

## Actions

| Action | Who can run it | Timeout | What it does |
|---|---|---|---|
| `status` | read only users and up | 10 s | The thermostats that run, and those in Settings that can't, with the reason and the °F fix. |
| `get_thermostats` | read only users and up | 10 s | Each running thermostat's settings, from the file plus changes since. |
| `recalculate_all` | any user | 10 s | Decides every thermostat again now. With `force`, every switch is sent what it should be. |
| `add_thermostat` | admin | 10 s | Adds one and starts it. This is the page's **+ Add a thermostat**. `config` takes `name`, `kind`, `sensor_device_ids`, `setpoint` and `actuator_device_id`; the rest default for its kind. |
| `remove_thermostat` | admin | 10 s | Turns its switch off if it was running it, then removes it from Settings and its device from homeCore. Takes `id`. |
| `fix_entry` | admin | 10 s | Sets the target of a thermostat in Settings that can't run. This is **Make it 68 °F (20 °C)**. Takes `index`, `id` and `setpoint`. |

## Alerts

| Alert | Topic | Severity | On by default | Raised when |
|---|---|---|---|---|
| Thermostat has no current reading | `sensors_stale` | warning | yes | No sensor has a current reading, so the switch was turned off. Clears when a reading arrives. |
| Thermostat's switch isn't answering | `actuator_not_responding` | warning | yes | The switch didn't confirm an on or off within 30 seconds, or is offline. Offers **Send it again**. |
| Thermostat ran too long | `max_run_exceeded` | warning | yes | It ran its longest run without a break and was turned off. Offers **Start it again**. |
| Thermostat's switch was used by hand | `manual_override` | info | no | Someone switched it by hand and it is being left alone. Offers **Take over now**. |
| A thermostat in Settings isn't running | `config_entry_skipped` | warning | yes | A `[[thermostat]]` entry can't run as written. |

"Do something…" on any of these creates an automation that starts when the
alert fires.

## Screens and cards

The app shows the plugin's own screens in place of its generic ones.

- The plugin's page (**Settings › Plugins › Thermostat**) has a card for
  each thermostat: the room's temperature, the target and mode, what it is
  doing and why, its sensor and how old the reading is, its switch and
  whether the switch confirmed, today's run time and its guards, with
  **Open** and **Turn off**. Thermostats in Settings that can't run are
  listed with the reason.
- A thermostat's panel shows the room in a ring, the target with minus and
  plus buttons, and its modes. **Doing now** gives the reason for what it is
  doing, with a button when one helps (Start now anyway, Take over now, Send
  it again, See the alert). One tap holds ("66° for 2 h", "66° until 7:00")
  and "Back to 68°" sit below. **Today** charts the room against the target
  band and shades the times it ran, from homeCore's history. The panel also
  shows what it reads, what it switches and how, each with a way to change
  it.
- Its card on Home and in rooms comes in compact, standard and large sizes.
  It is outlined when it needs attention: no reading, the switch not
  answering, or a hand flip being respected.
- Its automation step offers Set the target, Set the mode, Hold for a while,
  and Back to usual.

## Troubleshooting

If a thermostat isn't on the page, look for the `config_entry_skipped`
alert. The page says what to fix.

If it says the switch isn't answering, check that the switch is online and
that its plugin reports its `on` state. Use **Send it again** once it is
back. The thermostat keeps retrying on its own, less often each time.

If it says there is no current reading, check the sensors are online and
reporting. The thermostat turns the switch off meanwhile, unless **With no
reading** is set to leave it.

When homeCore stops the plugin, it turns off any heater it is running, then
marks its devices offline before it exits.

## Upgrading from 0.1.17 or earlier

- New attributes: `kind`, `reason`, `sensor_readings`, `actuator_confirmed`,
  `actuator_online`, `on_since`, holds (`hold_setpoint`, `hold_until`),
  `override_until` and today's figures. New settings: `max_run_secs`,
  `sensor_timeout_secs`, `on_stale` and `override_secs`.
- `actuator_last_error` is now `last_command_error`, and `last_update` is
  gone.
- `hvac_action` reports cooling or heating only once the switch confirms it.
- Modes follow the kind. A thermostat without `kind` is an AC unless its
  mode is `heat`.
- No current reading now turns the switch off. It used to leave it as it
  was.
- Off now sends one OFF and then leaves the switch alone, and a hand flip
  while it heats or cools counts as an override for an hour.
- A °F target in Settings no longer stops the whole plugin.
- `reload_config` is gone, since homeCore restarts the plugin when its
  settings file changes.
