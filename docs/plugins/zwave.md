---
id: zwave
title: Z-Wave
sidebar_label: Z-Wave
sidebar_position: 7
---

# Z-Wave (`hc-zwave`)

The hc-zwave plugin brings a Z-Wave network into homeCore through a
[zwave-js](https://zwave-js.github.io/node-zwave-js/) server. That covers locks,
plugs, outlets, switches, dimmers, sensors, thermostats and the rest. From
homeCore you can add and remove devices, see how healthy each one is, change a
device's own settings, and manage a lock's codes and history.

## Prerequisites

- A Z-Wave controller, usually a USB stick (Zooz ZST39, Aeotec Z-Stick, and
  similar).
- [zwave-js-server](https://github.com/zwave-js/zwave-js-server) running and
  reachable over WebSocket. [Z-Wave JS UI](https://github.com/zwave-js/zwave-js-ui)
  includes it (Settings → Home Assistant → WS Server, port 3000).

```bash
docker run -d --name zwave-js-ui \
  --device /dev/ttyUSB0:/dev/ttyUSB0 \
  -p 8091:8091 -p 3000:3000 \
  -v /path/to/store:/usr/src/app/store \
  zwavejs/zwave-js-ui:latest
```

## Setup

Install it from **Settings › Plugins › Add**. On its **Settings** tab, set
**Server URL** to the WebSocket address (`ws://host:3000`). If you leave the
setting out entirely, the plugin uses `ws://localhost:3000`. You don't list
nodes; they come from the server.

```toml
[server]
url            = "ws://10.0.0.20:3000"
schema_version = 32   # clamped to what the server offers
```

## Its screens

All of these ship with the plugin, so updating the plugin updates them.

- **Its page** (Settings › Plugins › Z-Wave) shows:
  - whether Z-Wave JS is answering, and how many devices are;
  - a note for anything that needs you, such as a lock's battery running low,
    a device that has stopped answering, or one that is no longer in the
    network;
  - every device with its room, what it is doing, its power source (mains, or
    battery and whether it sleeps), its **signal** and when it was last heard.
    Tap a device to see its health and settings;
  - the **controller**: the stick, home ID, region, firmware and Z-Wave JS
    versions;
  - **Rebuild routes**, with each device's progress, and **Download a backup**
    of the stick.
- **Add a device** walks through four steps:
  1. *Pairing*: put the device in pairing mode. The sheet waits four minutes.
  2. *Security*, only for a device with S2: type the **first five digits of
     the PIN** on its label. You can also untick *strongest security* to use
     basic security with no PIN, or choose *Add without security*.
  3. *Getting to know it*: the interview, with its progress. You can close the
     sheet and it will finish on its own.
  4. *Name it and put it in a room*. The name and room are written to Z-Wave
     JS as well, so both show the same thing.
- **Remove a device**: press the device's pairing button while the sheet
  waits. The device leaves the network and homeCore. Any automations that used
  it are turned off, and the sheet lists them.
- **A device's panel**. Outlets, plugs and sensors keep the app's own switch,
  readings and history, and gain two tabs:
  - **Health**: whether it answers and when it was last heard, its signal (RSSI
    and round trip), messages sent and how many didn't arrive, its route,
    security, power, node and firmware (with *check for an update*). Buttons
    for **Ping**, **Rebuild its routes** and **Ask it what it can do again**.
    A device that has stopped answering also offers **Remove it from the
    network** and **Replace it**. Replacing puts a new device in its place and
    keeps the old one's id, name, room and automations.
  - **Settings**: the device's own configuration parameters, named the way its
    device file describes them, with any value that is not the default marked.
    Changes go to the device straight away. There are also *Read them from the
    device* and *Back to defaults*. A device with Protection gets an **Its own
    buttons** setting (child lock).
- **A lock's panel** replaces the app's lock button with tabs:
  - **Lock**: whether it is locked and how it last changed ("Unlocked with code
    2 · Cleaner · 2:14 PM"), Lock and Unlock (unlocking asks first), the door,
    the battery, the bolt (jammed or not), and **Lock again after**. That last
    one is the lock's own auto-relock, so it keeps working when homeCore is
    down.
  - **Codes**: each slot, who it is for and when it was last used, with *Turn
    on* and *Turn off* (the code stays on the lock), *Change*, *Clear* and *Add
    a code*. Admins only.
  - **History**: what the lock reported, newest first. For example "Unlocked
    with code 2 · Cleaner, keypad", "Locked, by itself", "Locked, homeCore ·
    Leave home", "Wrong code entered" or "Jammed".
  - **Health**, and **Settings** if the lock has any.
- **A lock's card** on Home and in rooms shows whether it is locked, the door,
  how it last changed and its battery, with Lock and Unlock (unlocking asks
  first). The compact form is one row.
- **Z-Wave network** is a card you add yourself (Edit → Add a card). It shows
  how many devices answer and lists only the ones that need something.
- **In automations**, a step on a lock can be **Lock**, **Unlock** (the step
  warns that it may open the door with nobody there, and the automation's
  card is marked) or **Turn a code on or off**. The last
  reads as "turn off code 2 · Cleaner on Lock - Living Room" and is stored as
  `{"action": "set_code_enabled", "slot": 2, "enabled": false}`. Codes
  themselves are never set in an automation.

## Lock codes are write-only

A code goes from the Codes tab to the lock and nowhere else. homeCore never
shows it, stores it, logs it or returns it. It is not a device attribute, it is
not in history, the event log or the plugin's log, and error messages about a
code never quote it. zwave-js reports every slot's code in the clear, so the
plugin drops those values as they arrive. The plugin does keep who each slot is
for, in `.zwave-code-names.json` beside its config. That file holds names,
never codes.

## Device IDs

Each node is `zwave_{node_id}`: `zwave_1` is the controller, and `zwave_46`
might be a lock.

A multi-channel device is still one device. Take an outlet whose switch
zwave-js reports only on endpoint 1, with its root values hidden: that endpoint
is the device, so it publishes `on`, and writes go to endpoint 1. A device with
several channels, such as a power strip, publishes each channel with an
`ep{n}_` prefix (`ep1_on`, `ep2_on`, `ep2_power_w`). The app shows one switch
per channel, and `{"ep2_on": false}` switches endpoint 2.

## What devices report

Names and units follow homeCore's shared vocabulary, converted from each
device's own scale.

| Attribute | From | Notes |
|---|---|---|
| `on` | Binary Switch (37), Multilevel Switch (38) | Writable. On a dimmer, `{"on": true}` restores the last level. |
| `brightness_pct` | Multilevel Switch (38) | 0 to 100. Z-Wave 99 is 100 %, and any level above 0 is at least 1 %. |
| `position`, `tilt_pct` | Window Covering (106), a motorised Multilevel Switch, Barrier (102, read-only) | 100 = open. |
| `open` | Binary Sensor, Notification Access Control "Door state" and "Door state (simple)" (22 and 5632/5633 open, 23 closed), Door Lock `doorStatus`, Barrier Operator | `true` = open. Writable only on a garage door opener. |
| `locked` | Door Lock (98) `currentMode` | `true` only when secured (255). Every unsecured mode, including the timed, inside and outside ones, is `false`. 254 ("unknown") clears it. Writable. |
| `jammed` | Notification Access Control "Lock state", lock events | homeCore raises its own **Jammed** alert from this. |
| `lock_operation_type`, `lock_timeout_secs`, `lock_auto_relock_secs` | Door Lock configuration | Whether the lock stays as it is (1) or locks again by itself (2), and after how long. Writable. |
| `last_lock_action`, `last_lock_method`, `last_lock_slot`, `last_lock_event` | Notification CC events, or v1 `alarmType`/`alarmLevel` | See [Lock history](#lock-history). |
| `heat_setpoint`, `cool_setpoint`, `hvac_mode`, `hvac_action`, `fan_mode` | Thermostat (64, 66, 67, 68) | °C, converted to and from °F for Fahrenheit thermostats. |
| `color_rgb`, `color_temp` | Color Switch (51) | |
| `temperature`, `humidity`, `illuminance`, `uv_index`, `pressure`, `co2`, `power_w`, `voltage`, `current_a` | Multilevel Sensor (49) | Converted from the sensor's own scale. |
| `power_w`, `energy_kwh`, `voltage`, `current_a` | Meter (50) | Consumption (rate type 1, and the unspecified rate type 0 that Meter v1/v2 devices report). Production is published as `*_exported`. |
| `battery_pct` | Battery (128) | |
| `battery_low` | the device's own warning, and the plugin | Set by the device's low-battery warning (the zwave-js "battery low" notification, Battery `rechargeOrReplace`, or Power Management "Battery level status"), and for a lock at 30 % or below. It clears once the battery reads above 30 %. |
| `motion`, `tampered`, `intrusion`, `smoke`, `co`, `co2_alarm`, `water_detected`, `heat_alarm` | Binary Sensor (48), and Notification (113) by zwave-js's names: Home Security "Motion sensor status", "Cover status" and "Sensor status"; Smoke, CO, CO2, Water and Heat Alarm sensor status | |
| `overload`, `overcurrent` | Notification Power Management | Raise the **Overloaded** alert. |
| `child_lock` | Protection (117) local | When set, the device's own buttons do nothing. Writable. |
| `last_command_error` | the plugin | Why the last command to this device failed. Cleared once a command succeeds. |

Some values are deliberately kept out of a device's attributes, because they
cluttered every picker: identity (Manufacturer Specific, Version, Z-Wave Plus
Info), wake-up settings, security, configuration parameters (they are on the
Settings tab), a lock's code slots (the Codes tab), v1 alarm numbers (decoded
into lock events), Basic, a switch's transition time, a battery's chemistry
flags, and a lock's bolt and latch (they said the same as `locked`). A node's
name and room are part of its registration, not attributes. Anything else
without a shared name still publishes as `cc{class}_{property}`.

To fade, send `transition_ms` with a level, position or colour write. Z-Wave
durations are whole seconds.

## Lock history

Each time the lock reports what happened, the plugin sets four attributes
together:

| Attribute | Values |
|---|---|
| `last_lock_action` | `locked`, `unlocked`, `jammed`, `wrong_code`, `code_added`, `code_removed`, `codes_cleared`, `code_rejected`, `keypad_disabled` |
| `last_lock_method` | `keypad`, `manual` (by hand), `rf` (homeCore or another controller), `auto` (by itself) |
| `last_lock_slot` | the code's slot, named in the device's schema ("Code 2 · Cleaner") |
| `last_lock_event` | all of the above plus the time. It changes on every event, even a repeat. |

Locks with Notification CC v2 or later report Access Control events (keypad
with the user's slot, manual, RF, auto-lock, jammed, too many wrong codes) and
the Home Security event "Tampering, invalid code". Older locks report a v1
alarm. The plugin decodes the common Kwikset, Yale and Schlage numbering: 9
jammed, 16 and 19 keypad unlock, 18 keypad lock, 21 and 22 manual lock and
unlock, 24 and 25 RF lock and unlock, 26 jammed while locking by itself, 27
locked by itself, 33 and 112 code removed and added, 161 wrong codes. Other
numbers are left alone rather than guessed at. When a lock or unlock arrives by
radio just after homeCore asked for it, the History tab credits whoever asked,
whether an automation or a person.

To trigger "when unlocked with code 2", trigger on `last_lock_event` changing,
with the conditions `last_lock_action` is `unlocked` and `last_lock_slot` is
`2`.

## Health and signal

The plugin keeps each node's radio statistics from zwave-js. **Signal** is the
worst of these:

| | Good | Fair | Poor |
|---|---|---|---|
| RSSI of the last working route | above −80 dBm | −80 to −90 dBm | −90 dBm or less |
| Messages that never arrived (once 10+ were sent) | under 3 % | 3 to 10 % | 10 % or more |
| Round trip | under 300 ms | 300 ms to 1 s | 1 s or more |
| Hops | direct or one repeater | two or more | |

A dead node is **poor**. With nothing to judge yet, the signal is unknown and
shows as a dash.

A device that stops answering is not removed. A dead node is marked offline
and keeps its device, room and automations, and it comes back online by
itself. Devices leave homeCore only when the network says they have gone
(removed with their button, or removed as failed), or when you remove one that
has already left the network from the plugin's page.

## When Z-Wave JS goes away

Every Z-Wave device goes offline at once, and the page says why. A command
sent during the outage fails and says so, through `last_command_error` on the
device and a `plugin_command_result` event. It is not queued to be sent later,
so a door is never unlocked an hour after somebody asked. The plugin pings the
server and notices a connection that has silently died within a minute. When
the server is back, everything is read again and comes back online.

## Commands

Write attributes, or send `{"action": …}`:

```bash
curl -X PATCH http://homecore:8080/api/v1/devices/zwave_46/state \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"locked": true}'

# Turn code 2 off (kept on the lock)
  -d '{"action": "set_code_enabled", "slot": 2, "enabled": false}'

# Lock again by itself after 30 s
  -d '{"lock_operation_type": 2, "lock_timeout_secs": 30}'
```

zwave-js answers each write with a status. A command the device refuses is
reported the same way as one sent while disconnected.

## Plugin actions

| Action | Who | Does |
|---|---|---|
| `status` | anyone | Reports the connection, the controller and every node's health, from memory. |
| `include_node` | admin, streaming | Adds a device (S2 grant and PIN, interview, name and room). With `replace_device_id` it replaces a failed one. |
| `exclude_node` | admin, streaming | Removes a device using its pairing button. |
| `rebuild_routes` | admin, streaming | Rebuilds every node's routes, with progress. |
| `ping_node` | user | Checks whether a device answers, and how fast. |
| `rebuild_node_routes`, `reinterview_node` | admin | Rebuilds one device's routes, or runs its interview again. |
| `remove_failed_node` | admin | Removes a dead device without its button. |
| `forget_device` | admin | Removes a device that is no longer in the network from homeCore. |
| `get_config_params` | anyone | Lists its parameters with label, description, value, default, range and choices. `refresh` reads them from the device first. |
| `set_config_param`, `reset_config_params` | admin | Sets one parameter, or puts every one back to its default. |
| `list_user_codes` | anyone | Lists the slots (in use, off or empty) and who each is for. Never the codes. |
| `set_user_code`, `clear_user_code`, `set_code_enabled` | admin | Sends a code (4 to 10 digits) and who it is for; empties a slot; turns a slot on or off. |
| `backup_nvm`, `backup_nvm_chunk` | admin | Reads the stick's memory in pieces. The page saves it as a file. |
| `check_firmware` | user | Asks Z-Wave JS's firmware service whether newer firmware exists. |
| `rescan_nodes` | user | Reads every node again. |

## Alerts

| Alert | When |
|---|---|
| **Overloaded** | A plug or switch is drawing more than it can take, and may have switched off. |

A jammed lock raises homeCore's own **Jammed** alert from the `jammed`
attribute, so the plugin does not raise a second one. Low batteries are also
homeCore's alert, from `battery_pct` or `battery_low`.

## Notices

| Code | Means |
|---|---|
| `not_configured` | The server URL is empty. |
| `server_unreachable` | Z-Wave JS is not answering, and every device is offline. Clears when it is back. |

## Startup refresh

zwave-js caches each value, so a switch that only sends meter reports can
leave `on` stale. At startup the plugin polls the primary value of every
**mains-powered** node (switches, dimmers, thermostats, covers, colour), one
every 200 ms, in the background. Locks are not polled: they report their own
changes, and each poll costs battery. Sleeping devices can't answer a poll.

## Troubleshooting

| Problem | Solution |
|---|---|
| Every device offline | Z-Wave JS isn't answering. Check that it is running and that the Server URL is right. The page and the `server_unreachable` notice say what went wrong. |
| A device is "Not answering" | Check its power, then **Ping** it from its Health tab. If it is gone for good, **Remove it from the network** or **Replace it**. |
| Secure pairing fails | Type the first five digits of the PIN on the device's label (or its box). Untick *strongest security* to add it with basic security. |
| A device shows in homeCore but "no longer in the Z-Wave network" | It was removed using another app. Remove it from homeCore on the plugin's page. |
| A command did nothing | Look at the device's `last_command_error`. |
| Signal fair or poor | Move the device or the controller, or add a mains-powered device in between, then **Rebuild routes**. |

## Logs

The log is `logs/hc-zwave.log` beside the plugin's config. Rotation and
compression are set in its `[logging]` section. Codes never appear in it.
