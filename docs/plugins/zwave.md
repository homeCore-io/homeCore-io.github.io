---
id: zwave
title: Z-Wave
sidebar_label: Z-Wave
sidebar_position: 7
---

# Z-Wave (`hc-zwave`)

The hc-zwave plugin brings a Z-Wave network into homeCore through a
[zwave-js](https://zwave-js.github.io/node-zwave-js/) server: locks, plugs,
outlets, switches, dimmers, sensors, thermostats and the rest. It adds and
removes devices, shows each one's health, changes their own settings, and
manages a lock's codes and history — all from homeCore.

## Prerequisites

- A Z-Wave controller (USB stick: Zooz ZST39, Aeotec Z-Stick, …)
- [zwave-js-server](https://github.com/zwave-js/zwave-js-server) running and
  reachable over WebSocket — or [Z-Wave JS UI](https://github.com/zwave-js/zwave-js-ui),
  which includes it (Settings → Home Assistant → WS Server, port 3000)

```bash
docker run -d --name zwave-js-ui \
  --device /dev/ttyUSB0:/dev/ttyUSB0 \
  -p 8091:8091 -p 3000:3000 \
  -v /path/to/store:/usr/src/app/store \
  zwavejs/zwave-js-ui:latest
```

## Setup

Install it from **Settings › Plugins › Add**, then on its **Settings** tab set
**Server URL** to the WebSocket address (`ws://host:3000`). Nodes come from
the server; you do not list them.

```toml
[server]
url            = "ws://10.0.0.20:3000"
schema_version = 32   # clamped to what the server offers
```

## Its screens

All of these come with the plugin — update it, and they update.

- **Its page** (Settings › Plugins › Z-Wave): whether Z-Wave JS answers and
  how many devices do; a note for anything that needs you — a lock's battery
  getting low, a device not answering, one no longer in the network; every
  device with its room, what it is doing, its power (mains, or battery and
  whether it sleeps), its **signal** and when it was last heard — tap one for
  its health and settings; the **controller** (stick, home ID, region,
  firmware, Z-Wave JS versions); **Rebuild routes**, with each device's
  progress; and **Download a backup** of the stick.
- **Add a device**: *Pairing* (put it in pairing mode; four minutes) →
  *Security*, only for a device with S2: type the **first five digits of the
  PIN** on its label, or untick *strongest security* for basic security with
  no PIN, or *Add without security* → *Getting to know it* (the interview, with
  its progress; you can close the sheet — it finishes on its own) → *Name it
  and put it in a room*: the name and room go to Z-Wave JS too, so both show
  the same.
- **Remove a device**: press the device's pairing button while the sheet
  waits. It leaves the network and homeCore; automations that used it are
  turned off, and the sheet names them.
- **A device's panel** — outlets, plugs and sensors keep the app's own switch,
  readings and history, and get two tabs:
  - **Health**: answering or not and when it was last heard, its signal (RSSI
    and round trip), messages sent and how many didn't arrive, its route,
    security, power, node and firmware (*check for an update*); **Ping**,
    **Rebuild its routes**, **Ask it what it can do again**. A device that has
    stopped answering offers **Remove it from the network** and **Replace it**
    — a new device in its place, keeping its id, name, room and automations.
  - **Settings**: the device's own configuration parameters, named as its
    device file describes them, with "not the default" marked; changes go to
    the device at once. *Read them from the device*, *Back to defaults*. A
    device with Protection gets **Its own buttons** (child lock).
- **A lock's panel** replaces the app's lock button with tabs:
  - **Lock**: locked or not and how it last changed ("Unlocked with code 2 ·
    Cleaner · 2:14 PM"), Lock / Unlock (unlocking asks first), the door, the
    battery, the bolt (jammed or not), and **Lock again after** — the lock's own
    auto-relock, so it works with homeCore down.
  - **Codes**: each slot, who it is for and when it was last used; *Turn on* /
    *Turn off* (kept on the lock), *Change*, *Clear*, *Add a code*. Admins only.
  - **History**: what the lock reported, newest first — "Unlocked with code 2 ·
    Cleaner — keypad", "Locked — by itself", "Locked — homeCore · Leave home",
    "Wrong code entered", "Jammed".
  - **Health**, and **Settings** if it has any.
- **A lock's card** on Home and the rooms: locked or not, the door, how it last
  changed and its battery, with Lock / Unlock — unlocking asks first. Compact:
  one row.
- **Z-Wave network**, a card you add yourself (Edit → Add a card): how many
  devices answer, and only the ones that need something.
- **In automations**, a step on a lock is **Lock**, **Unlock** (marked: nobody
  may be there) or **Turn a code on or off** — "turn off code 2 · Cleaner on
  Lock - Living Room", stored as
  `{"action": "set_code_enabled", "slot": 2, "enabled": false}`. Codes
  themselves are never set in an automation.

## Lock codes are write-only

A code goes from the Codes tab to the lock and nowhere else. homeCore never
shows it, keeps it, logs it or returns it: it is not a device attribute, not in
history or the event log, not in the plugin's log, and an error about it never
quotes it. zwave-js reports every slot's code in the clear; the plugin drops
those values as they arrive. Who each slot is for is kept by the plugin
(`.zwave-code-names.json` beside its config) — names, never codes.

## Device IDs

Each node is `zwave_{node_id}` — `zwave_1` the controller, `zwave_46` a lock.

**Multi-channel devices are one device.** An outlet whose switch zwave-js
reports only on endpoint 1 (its root values hidden) is that endpoint: it
publishes `on`, written to endpoint 1. A device with several channels — a
power strip — publishes each channel with an `ep{n}_` prefix: `ep1_on`,
`ep2_on`, `ep2_power_w`; the app shows one switch per channel, and
`{"ep2_on": false}` switches endpoint 2.

## What devices report

Names and units follow homeCore's shared vocabulary, converted from each
device's own scale.

| Attribute | From | Notes |
|---|---|---|
| `on` | Binary Switch (37), Multilevel Switch (38) | Writable. On a dimmer `{"on": true}` restores the last level. |
| `brightness_pct` | Multilevel Switch (38) | 0–100. Z-Wave 99 is 100 %; any level above 0 is at least 1 %. |
| `position`, `tilt_pct` | Window Covering (106), a motorised Multilevel Switch, Barrier (102, read-only) | 100 = open. |
| `open` | Binary Sensor, Notification Access Control "Door state" (22 and 5632/5633 open, 23 closed), Door Lock `doorStatus`, Barrier Operator | `true` = open. Writable only on a garage door opener. |
| `locked` | Door Lock (98) `currentMode` | `true` only when secured (255); every unsecured mode — including the timed, inside and outside ones — is `false`; 254 ("unknown") clears it. Writable. |
| `jammed` | Notification Access Control "Lock state", lock events | Raises the **Lock jammed** alert. |
| `lock_operation_type`, `lock_timeout_secs`, `lock_auto_relock_secs` | Door Lock configuration | "Stays as it is" / "Locks again by itself" and after how long. Writable. |
| `last_lock_action`, `last_lock_method`, `last_lock_slot`, `last_lock_event` | Notification CC events, or v1 `alarmType`/`alarmLevel` | See [Lock history](#lock-history). |
| `heat_setpoint`, `cool_setpoint`, `hvac_mode`, `hvac_action`, `fan_mode` | Thermostat (64, 66, 67, 68) | °C, converted from °F thermostats both ways. |
| `color_rgb`, `color_temp` | Color Switch (51) | |
| `temperature`, `humidity`, `illuminance`, `pressure`, `co2`, `power_w`, `voltage`, `current_a` | Multilevel Sensor (49) | Converted from the sensor's own scale. |
| `power_w`, `energy_kwh`, `voltage`, `current_a` | Meter (50) | Consumed (rate type 1, and Meter v1/v2's unspecified 0); `*_exported` for produced. |
| `battery_pct`, `battery_low` | Battery (128) | |
| `motion`, `tampered`, `intrusion`, `smoke`, `co`, `water_detected`, `heat_alarm` | Binary Sensor (48), Notification (113) by zwave-js's names: Home Security "Motion sensor status", "Cover status", "Sensor status"; Smoke / CO / Water Alarm "Sensor status" | |
| `overload`, `overcurrent` | Notification Power Management | Raise the **Overloaded** alert. |
| `child_lock` | Protection (117) local | The device's own buttons do nothing. Writable. |
| `last_command_error` | the plugin | Why the last command to this device failed; gone once one succeeds. |

**Not state** — kept out of devices' attributes, where they cluttered every
picker: identity (Manufacturer Specific, Version, Z-Wave Plus Info), wake-up
settings, security, configuration parameters (the Settings tab), a lock's code
slots (the Codes tab), v1 alarm numbers (decoded into lock events), Basic, a
switch's transition time, a battery's chemistry flags, a lock's bolt and latch
(they said the same as `locked`). A node's name and room are its registration,
not attributes. Anything else without a shared name still publishes as
`cc{class}_{property}`.

**Fades.** Send `transition_ms` with a level, position or colour write; Z-Wave
durations are whole seconds.

## Lock history

Every time the lock says what happened, it sets four attributes at once:

| Attribute | Values |
|---|---|
| `last_lock_action` | `locked`, `unlocked`, `jammed`, `wrong_code`, `code_added`, `code_removed`, `codes_cleared`, `code_rejected`, `keypad_disabled` |
| `last_lock_method` | `keypad`, `manual` (by hand), `rf` (homeCore or another controller), `auto` (by itself) |
| `last_lock_slot` | the code's slot, named in the device's schema ("Code 2 · Cleaner") |
| `last_lock_event` | all of it with when — it changes on every event, even a repeat |

Notification CC v2+ locks report Access Control events (keypad with the user's
slot, manual, RF, auto-lock, jammed, too many wrong codes) and Home Security
"Tampering, invalid code". Older locks report a v1 alarm, decoded for the
common Kwikset/Yale/Schlage numbering (9 jammed, 16/19 keypad unlock, 18 keypad
lock, 21/22 manual, 24/25 RF, 26/27 auto, 33/112 code removed/added, 161 wrong
codes); others are left alone rather than guessed. A lock or unlock by radio
right after homeCore asked is credited to whoever asked — an automation or a
person — on the History tab.

**"When unlocked with code 2"**: trigger on `last_lock_event` changing, with
the checks `last_lock_action` is `unlocked` and `last_lock_slot` is `2`.

## Health and signal

The plugin keeps each node's radio statistics from zwave-js. **Signal** is the
worst of:

| | Good | Fair | Poor |
|---|---|---|---|
| RSSI of the last working route | above −80 dBm | −80 to −90 dBm | −90 dBm or less |
| Messages that never arrived (once 10+ were sent) | under 3 % | 3–10 % | 10 % or more |
| Round trip | under 300 ms | 300 ms – 1 s | 1 s or more |
| Hops | direct or one repeater | two or more | |

A dead node is **poor**; with nothing to judge yet, **—**.

**Not answering is not gone.** A dead node is marked offline and keeps its
device, room and automations; it comes back online by itself. Devices leave
homeCore only when the network says so — removed with its button, removed as
failed — or when you remove one that has left the network from the page.

## When Z-Wave JS goes away

Every Z-Wave device goes offline at once, and the page says why. A command sent
meanwhile **fails and says so** (`last_command_error` on the device, and a
`plugin_command_result` event) — it is not kept to be sent later, so a door is
never unlocked an hour after somebody asked. The plugin pings the server and
notices a connection that has silently died within a minute; when it is back,
everything is read again and comes back online.

## Commands

Attribute writes, or `{"action": …}`:

```bash
curl -X PATCH http://homecore:8080/api/v1/devices/zwave_46/state \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"locked": true}'

# Turn code 2 off (kept on the lock)
  -d '{"action": "set_code_enabled", "slot": 2, "enabled": false}'

# Lock again by itself after 30 s
  -d '{"lock_operation_type": 2, "lock_timeout_secs": 30}'
```

A command that the device refuses — zwave-js answers each write with a status —
is reported the same way as one sent while disconnected.

## Plugin actions

| Action | Who | Does |
|---|---|---|
| `status` | anyone | the connection, the controller and every node's health — from memory |
| `include_node` | admin, streaming | add a device (S2 grant + PIN, interview, name and room); `replace_device_id` replaces a failed one |
| `exclude_node` | admin, streaming | remove a device by its pairing button |
| `rebuild_routes` | admin, streaming | every node's routes, with progress |
| `ping_node` | user | does it answer, and how fast |
| `rebuild_node_routes`, `reinterview_node` | admin | one device's routes; its interview again |
| `remove_failed_node` | admin | a dead device, without its button |
| `forget_device` | admin | a device no longer in the network, from homeCore |
| `get_config_params` | anyone | its parameters with label, description, value, default, range, choices; `refresh` reads them first |
| `set_config_param`, `reset_config_params` | admin | one parameter; every one back to its default |
| `list_user_codes` | anyone | slots: in use, off or empty, and who for — never codes |
| `set_user_code`, `clear_user_code`, `set_code_enabled` | admin | send a code (4–10 digits) and who it is for; empty a slot; turn one on or off |
| `backup_nvm`, `backup_nvm_chunk` | admin | the stick's memory, in pieces — the page saves it as a file |
| `check_firmware` | user | whether Z-Wave JS's firmware service has newer firmware |
| `rescan_nodes` | user | read every node again |

## Alerts

| Alert | When |
|---|---|
| **Lock jammed** | the bolt did not lock or unlock fully |
| **Overloaded** | a plug or switch is drawing more than it can take |

## Notices

| Code | Means |
|---|---|
| `not_configured` | No server URL set yet. |
| `server_unreachable` | Z-Wave JS is not answering; every device is offline. Clears when it is back. |

## Startup refresh

zwave-js caches each value; a switch that only sends meter reports can leave
`on` stale. At startup the plugin polls the primary value of every
**mains-powered** node (switches, dimmers, thermostats, covers, colour), one
every 200 ms, in the background. Locks are not polled — they report their own
changes, and each poll costs their batteries — and sleeping devices can't
answer.

## Troubleshooting

| Problem | Solution |
|---|---|
| Every device offline | Z-Wave JS isn't answering — check it runs and the Server URL. The page and the `server_unreachable` notice say what went wrong. |
| A device is "Not answering" | Check its power; **Ping** it from its Health tab. Gone for good: **Remove it from the network**, or **Replace it**. |
| Secure pairing fails | Type the first five digits of the PIN on the device's label (or box). Untick *strongest security* to add it with basic security. |
| A device shows in homeCore but "no longer in the Z-Wave network" | It was removed with another app. Remove it from homeCore on the plugin's page. |
| A command did nothing | Look at the device's `last_command_error`. |
| Signal fair or poor | Move it or the controller, add a mains-powered device in between, then **Rebuild routes**. |

## Logs

`logs/hc-zwave.log` beside its config; rotation and compression are its
`[logging]` settings. Codes never appear in it.
