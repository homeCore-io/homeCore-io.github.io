---
id: zwave
title: Z-Wave
sidebar_label: Z-Wave
sidebar_position: 7
---

# Z-Wave (`hc-zwave`)

The Z-Wave plugin brings a Z-Wave network into homeCore through a
[Z-Wave JS](https://zwave-js.github.io/node-zwave-js/) server. Locks, plugs,
switches, dimmers, sensors, thermostats and covers all become homeCore
devices. From homeCore you can add and remove devices, watch each one's
health and signal, change a device's own settings, and manage a lock's codes
and history. The plugin never touches the radio itself: Z-Wave JS owns the
USB stick, and the plugin talks to it over a WebSocket.

## Before you start

You need a Z-Wave controller, usually a USB stick such as a Zooz ZST39 or an
Aeotec Z-Stick, and
[zwave-js-server](https://github.com/zwave-js/zwave-js-server) running where
homeCore can reach it. [Z-Wave JS UI](https://github.com/zwave-js/zwave-js-ui)
includes the server. Turn it on under Settings › Home Assistant › WS Server;
it listens on port 3000.

```bash
docker run -d --name zwave-js-ui \
  --device /dev/ttyUSB0:/dev/ttyUSB0 \
  -p 8091:8091 -p 3000:3000 \
  -v /path/to/store:/usr/src/app/store \
  zwavejs/zwave-js-ui:latest
```

## Install and set up

1. Install Z-Wave from **Settings › Plugins › Catalog**.
2. On its **Settings** tab, set **Server URL** to the server's WebSocket
   address, such as `ws://192.168.1.20:3000`. Use `wss://` if the server sits
   behind TLS.
3. Save. The plugin connects, reads every node from Z-Wave JS and creates a
   device for each one. You don't list nodes yourself.

Devices already paired in Z-Wave JS show up on their own. To pair a new one,
use **Add a device** on the plugin's page (see
[Screens and cards](#screens-and-cards)).

```toml
[server]
url            = "ws://192.168.1.20:3000"
schema_version = 32   # clamped to what the server offers
```

## Settings

| Setting | Key | Default | What it does |
|---|---|---|---|
| Server URL | `server.url` | `ws://localhost:3000` | The WebSocket address of zwave-js-server. An empty URL raises the `not_configured` notice. |
| Schema version | `server.schema_version` | `32` | The protocol version to ask for. The plugin clamps it to the range the server offers, so the default works with every current Z-Wave JS. |
| Z-Wave nodes | `devices` | | Every node, with a name and a room you can change. Names start out as Z-Wave JS has them. |

The **Logging** section holds the usual plugin log settings: level
(`logging.level`, default `info`), how much is forwarded to homeCore
(`logging.log_forward_level`, default `info`), rotation (`logging.rotation`,
default `daily`), rotate at size (`logging.max_size_mb`, default 100 MB),
prune after (`logging.prune_after_days`, default 0, never) and compression
(`logging.compress`, default on).

## Devices

Each node is a device named `zwave_{node_id}`. `zwave_1` is the controller,
and `zwave_46` might be a lock. A node's name and room start out as Z-Wave JS
has them. The name and room you give a device while adding it are written to
Z-Wave JS as well.

A multi-channel device is still one device. If Z-Wave JS reports an outlet's
switch only on endpoint 1 and hides the root values, endpoint 1 is the device:
it publishes `on`, and writes go to endpoint 1. A device with several
channels, such as a power strip, publishes each channel with an `ep{n}_`
prefix (`ep1_on`, `ep2_on`, `ep2_power_w`). The app shows one switch per
channel, and `{"ep2_on": false}` turns off endpoint 2.

### Attributes

Names and units follow homeCore's shared vocabulary. Each value is converted
from the device's own scale, and every temperature is in °C.

| Attribute | From | Notes |
|---|---|---|
| `on` | Binary Switch (37), Multilevel Switch (38) | Writable. On a dimmer, `{"on": true}` goes back to the last level. |
| `brightness_pct` | Multilevel Switch (38) | 0 to 100. Z-Wave's 99 reads as 100, and any level above 0 is at least 1. |
| `position`, `tilt_pct` | Window Covering (106), a motorized Multilevel Switch, Barrier Operator (102, read only) | 100 is open. |
| `open` | Binary Sensor, Notification Access Control "Door state" and "Door state (simple)", Door Lock `doorStatus`, Barrier Operator | `true` is open. Writable only on a garage door opener. |
| `locked` | Door Lock (98) `currentMode` | `true` only when secured (255). Every unsecured mode, including the timed, inside and outside ones, is `false`. 254 ("unknown") clears it. Writable. |
| `jammed` | Notification Access Control "Lock state", lock events | homeCore raises its own **Jammed** alert from this. |
| `lock_operation_type`, `lock_timeout_secs`, `lock_auto_relock_secs` | Door Lock configuration | Whether the lock stays as it is (1) or locks again by itself (2), and after how many seconds. Writable. |
| `last_lock_action`, `last_lock_method`, `last_lock_slot`, `last_lock_event` | Notification events, or v1 `alarmType`/`alarmLevel` | See [Lock history](#lock-history). |
| `heat_setpoint`, `cool_setpoint`, `hvac_mode`, `hvac_action`, `fan_mode` | Thermostat (64, 66, 67, 68) | °C, converted to and from °F for Fahrenheit thermostats. |
| `color_rgb`, `color_temp` | Color Switch (51) | |
| `temperature`, `humidity`, `illuminance`, `uv_index`, `pressure`, `co2`, `power_w`, `voltage`, `current_a` | Multilevel Sensor (49) | |
| `power_w`, `energy_kwh`, `voltage`, `current_a` | Meter (50) | Consumption: rate type 1, and the unspecified rate type 0 that Meter v1 and v2 devices report. Power sent back to the grid is `power_w_exported` and `energy_kwh_exported`. |
| `battery_pct` | Battery (128) | |
| `battery_low` | the device, and the plugin | Set by the device's own low battery warning (the Z-Wave JS "battery low" notification, Battery `rechargeOrReplace`, or Power Management "Battery level status"), and for a lock at 30% or below. It clears once the battery reads above 30%. |
| `motion`, `tampered`, `intrusion`, `smoke`, `co`, `co2_alarm`, `water_detected`, `heat_alarm` | Binary Sensor (48), and Notification (113) by Z-Wave JS's names | Home Security "Motion sensor status", "Cover status" and "Sensor status"; the Smoke, CO, CO2, Water and Heat Alarm sensor status. |
| `overload`, `overcurrent` | Notification Power Management | Raise the **Overloaded** alert. |
| `child_lock` | Protection (117) local | When set, the device's own buttons do nothing. Writable. |
| `last_command_error` | the plugin | Why the last command to this device failed. Cleared once a command succeeds. |

Some values are kept out of a device's attributes on purpose, because they
cluttered every picker: identity (Manufacturer Specific, Version, Z-Wave Plus
Info), wake up settings, security, configuration parameters (they are on the
Settings tab), a lock's code slots (the Codes tab), v1 alarm numbers (decoded
into lock events), Basic, a switch's transition time, battery chemistry
flags, and a lock's bolt and latch (they repeat `locked`). Anything else
without a shared name publishes as `cc{class}_{property}`.

### Commands

Write an attribute, or send `{"action": ...}`:

```bash
curl -X PATCH http://localhost:8080/api/v1/devices/zwave_46/state \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"locked": true}'

# Turn code 2 off (it stays on the lock)
  -d '{"action": "set_code_enabled", "slot": 2, "enabled": false}'

# Lock again by itself after 30 seconds
  -d '{"lock_operation_type": 2, "lock_timeout_secs": 30}'

# Fade a dimmer to 40% over 3 seconds
  -d '{"brightness_pct": 40, "transition_ms": 3000}'
```

`transition_ms` works with a level, position or color write. Z-Wave
durations are whole seconds.

Z-Wave JS answers each write with a status. A command the device refuses, or
one sent while Z-Wave JS is unreachable, fails and says why in the device's
`last_command_error` and in a `plugin_command_result` event.

### Lock codes are write only

A code goes from the Codes tab to the lock and nowhere else. homeCore never
shows, stores, logs or returns it. It is not an attribute, and it is not in
history, the event log or the plugin's log. Error messages about a code never
quote it. Z-Wave JS reports every slot's code in the clear, so the plugin
drops those values as they arrive. It does keep who each slot is for, in
`.zwave-code-names.json` beside its config. That file holds names only.

### Lock history

Each time a lock reports what happened, the plugin sets four attributes
together:

| Attribute | Values |
|---|---|
| `last_lock_action` | `locked`, `unlocked`, `jammed`, `wrong_code`, `code_added`, `code_removed`, `codes_cleared`, `code_rejected`, `keypad_disabled` |
| `last_lock_method` | `keypad`, `manual` (by hand), `rf` (homeCore or another controller), `auto` (by itself) |
| `last_lock_slot` | the code's slot, named in the device's schema ("Code 2 · Cleaner") |
| `last_lock_event` | all of the above plus the time. It changes on every event, even a repeat. |

Locks with Notification v2 or later report Access Control events (keypad with
the user's slot, manual, RF, auto lock, jammed, too many wrong codes) and the
Home Security event "Tampering, invalid code". Older locks report a v1 alarm.
The plugin decodes the common Kwikset, Yale and Schlage numbers: 9 jammed, 16
and 19 keypad unlock, 18 keypad lock, 21 and 22 manual lock and unlock, 24 and
25 RF lock and unlock, 26 jammed while locking by itself, 27 locked by itself,
33 and 112 code removed and added, 161 wrong codes. It leaves other numbers
alone. When a lock or unlock arrives by radio just after homeCore asked for
it, the History tab credits whoever asked, an automation or a person.

To trigger on "unlocked with code 2", trigger on `last_lock_event` changing,
with the conditions `last_lock_action` is `unlocked` and `last_lock_slot` is
`2`.

### Health and signal

The plugin keeps each node's radio statistics from Z-Wave JS. A device's
**signal** is the worst of these:

| | Good | Fair | Poor |
|---|---|---|---|
| RSSI of the last working route | above -80 dBm | -80 to -90 dBm | -90 dBm or less |
| Messages that never arrived (once 10 or more were sent) | under 3% | 3 to 10% | 10% or more |
| Round trip | under 300 ms | 300 ms to 1 s | 1 s or more |
| Hops | direct or one repeater | two or more | |

A dead node is poor. With nothing to judge yet, the signal is unknown.

A device that stops answering stays in homeCore. It is marked offline, keeps
its room and automations, and comes back online by itself. Asleep is normal
for a battery device and does not count as offline. Devices leave homeCore
only when the network says they are gone (removed with their button, or
removed as failed), or when you remove one that has already left the network
from the plugin's page.

## Actions

Plugin actions are sent to `POST /api/v1/plugins/plugin.zwave/command`. The
first three stream their progress and can be canceled.

| Action | Role | Timeout | What it does |
|---|---|---|---|
| `include_node` | admin | 15 min | Adds a device: S2 grant and PIN, interview, name and room. With `replace_device_id`, replaces a failed device and keeps its id, room and automations. |
| `exclude_node` | admin | 2 min | Removes the device whose pairing button you press. |
| `rebuild_routes` | admin | 30 min | Rebuilds every node's routes, with each one's progress. |
| `status` | read only | 15 s | The connection, the controller and every node's health, from memory. |
| `rescan_nodes` | user | 60 s | Reads every node from Z-Wave JS again. |
| `ping_node` | user | 25 s | Checks whether a device answers, and how fast. |
| `rebuild_node_routes` | admin | 125 s | Rebuilds one device's routes. |
| `reinterview_node` | admin | 35 s | Runs a device's interview again, after a firmware update or when something is missing. |
| `remove_failed_node` | admin | 65 s | Removes a dead device without its button. Refused while it still answers. |
| `forget_device` | admin | 15 s | Removes from homeCore a device that is no longer in the network. Refused while it is still there. |
| `get_config_params` | read only | 65 s | Lists a device's parameters with label, description, value, default, range and choices. `refresh` reads them from the device first. |
| `set_config_param` | admin | 30 s | Sets one parameter (`param`, `value`, optional `property_key`). |
| `reset_config_params` | admin | 2 min | Puts every parameter that has a default back to it. |
| `list_user_codes` | read only | 5 s | A lock's slots (in use, off or empty) and who each is for. Never the codes. |
| `set_user_code` | admin | 30 s | Sends a code of 4 to 10 digits to a slot, with who it is for. Without `code`, renames the slot. |
| `clear_user_code` | admin | 30 s | Empties a slot. |
| `set_code_enabled` | admin | 30 s | Turns a slot on or off. Off keeps the code on the lock. |
| `backup_nvm`, `backup_nvm_chunk` | admin | 3 min, 10 s | Reads the controller's memory in pieces. The plugin's page saves it as a file. |
| `check_firmware` | user | 65 s | Asks Z-Wave JS's firmware service whether newer firmware exists for a device. |

```bash
curl -X POST http://localhost:8080/api/v1/plugins/plugin.zwave/command \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"action": "ping_node", "device_id": "zwave_46"}'
```

## Alerts

| Alert | Severity | When |
|---|---|---|
| Overloaded | warning, on by default | A plug or switch is drawing more than it can take, and may have switched off. |

A jammed lock raises homeCore's own **Jammed** alert from `jammed`, so the
plugin doesn't raise a second one. Low batteries are homeCore's alert too,
from `battery_pct` or `battery_low`.

The plugin also posts two notices on its page:

| Notice | Means |
|---|---|
| `not_configured` | The server URL is empty. |
| `server_unreachable` | Z-Wave JS isn't answering, and every device is offline. It clears when the server is back. |

## Screens and cards

All of these ship with the plugin, so updating the plugin updates them.

The plugin's page (**Settings › Plugins › Z-Wave**) shows whether Z-Wave JS is
answering and how many devices are. It lists anything that needs you, such as
a lock's battery running low, a device that has stopped answering, or one
that is no longer in the network. Below that is every device with its room,
what it is doing, its power source (mains, or battery and whether it sleeps),
its signal and when it was last heard; tap one for its health and settings.
The controller section shows the stick, home ID, region, firmware and Z-Wave
JS versions, with **Rebuild routes** and **Download a backup**.

**Add a device** takes four steps:

1. Pairing: put the device in pairing mode. The sheet waits four minutes.
2. Security, only for a device with S2: type the first five digits of the PIN
   on its label. You can untick *strongest security* to use basic security
   with no PIN, or choose *Add without security*.
3. Getting to know it: the interview, with its progress. You can close the
   sheet and it finishes on its own.
4. Name it and put it in a room. The name and room go to Z-Wave JS too, so
   both show the same thing.

**Remove a device** waits for you to press the device's pairing button. The
device leaves the network and homeCore. Automations that used it are turned
off, and the sheet lists them.

A device's panel keeps the app's own switch, readings and history, and adds
two tabs. **Health** shows whether it answers and when it was last heard, its
signal (RSSI and round trip), messages sent and lost, its route, security,
power, node and firmware, with *check for an update*. It has **Ping**,
**Rebuild its routes** and **Ask it what it can do again**. A device that has
stopped answering also offers **Remove it from the network** and **Replace
it**. **Settings** lists the device's configuration parameters as its device
file names them, marks any value that isn't the default, and sends changes
straight away. It also has *Read them from the device* and *Back to
defaults*. A device with Protection gets an **Its own buttons** setting (child
lock).

A lock's panel replaces the app's lock button with tabs:

- **Lock** shows whether it is locked and how it last changed ("Unlocked with
  code 2 · Cleaner · 2:14 PM"), Lock and Unlock (unlocking asks first), the
  door, the battery, the bolt, and **Lock again after**. That last one is the
  lock's own auto relock, so it works when homeCore is down.
- **Codes** lists each slot, who it is for and when it was last used, with
  *Turn on*, *Turn off* (the code stays on the lock), *Change*, *Clear* and
  *Add a code*. Admins only.
- **History** lists what the lock reported, newest first: "Unlocked with code
  2 · Cleaner, keypad", "Locked, by itself", "Wrong code entered", "Jammed".
- **Health**, and **Settings** if the lock has any.

A lock card on Home and in rooms shows whether it is locked, the door, how it
last changed and its battery, with Lock and Unlock. It comes in standard,
compact and large sizes. The **Z-Wave network** card, which you add yourself
(Edit › Add a card), shows how many devices answer and lists only the ones
that need something.

In automations, a step on a lock can be **Lock**, **Unlock** or **Turn a code
on or off**. An Unlock step warns that it may open the door with nobody there,
and the automation's card is marked. Turning a code off reads as "turn off
code 2 · Cleaner on Front Door" and is stored as
`{"action": "set_code_enabled", "slot": 2, "enabled": false}`. Codes
themselves are never set in an automation.

## Troubleshooting

When Z-Wave JS goes away, every Z-Wave device goes offline at once and the
plugin's page says why. A command sent during the outage waits up to 5
seconds for the connection, then fails and says so. It is never queued, so a
door is never unlocked an hour after somebody asked. The plugin pings the
server every 20 seconds and treats 50 seconds of silence as a lost
connection. It reconnects on its own, waiting 2 seconds at first and doubling
up to a minute between tries. Once it is back, it reads everything again and
the devices come back online.

At startup the plugin polls the main value of every mains-powered node
(switches, dimmers, thermostats, covers, color), one every 200 ms, because
Z-Wave JS caches values and a switch that only sends meter reports can leave
`on` stale. Locks are not polled: they report their own changes, and each
poll costs battery. Sleeping devices can't answer a poll.

When homeCore stops or restarts the plugin, it marks every Z-Wave device
offline before it exits.

| Problem | What to do |
|---|---|
| Every device is offline | Z-Wave JS isn't answering. Check that it is running and that the Server URL is right. The page and the `server_unreachable` notice say what went wrong. |
| A device is "Not answering" | Check its power, then **Ping** it from its Health tab. If it is gone for good, **Remove it from the network** or **Replace it**. |
| Secure pairing fails | Type the first five digits of the PIN on the device's label or box. Untick *strongest security* to add it with basic security. |
| A device says "no longer in the Z-Wave network" | It was removed with another app. Remove it from homeCore on the plugin's page. |
| A command did nothing | Look at the device's `last_command_error`. |
| Signal is fair or poor | Move the device or the controller, or add a mains-powered device in between, then **Rebuild routes**. |

The log is `logs/hc-zwave.log` beside the plugin's config. Codes never appear
in it.
