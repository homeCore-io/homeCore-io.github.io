---
id: yolink
title: YoLink
sidebar_label: YoLink
sidebar_position: 5
---

# YoLink (`hc-yolink`)

The YoLink plugin brings YoLink devices into homeCore: leak sensors, door
sensors, temperature sensors and probes, vibration and motion sensors, locks,
plugs, switches and sirens. It talks either to a YS1606 local hub on your
network, which keeps working without the internet, or to the YoLink cloud for
other hubs. It ships its own YoLink page, panels for locks, temperature
sensors and leak sensors, lock and freezer cards, a **Water** card for any
page, and a lock step for automations.

## Before you start

You need one of these:

- A YS1606 local hub, with a fixed address on your network (give it a static
  DHCP lease, because the plugin can't find it if the address moves). In the
  YoLink app, open *Local Hub › Local Network › Integrations › Local API* and
  note the Client ID, Client Secret and Network ID. The plugin uses the hub's
  API on port 1080 and its event feed on port 18080.
- Any other YoLink hub, through the cloud. In the YoLink app, open *Account ›
  Advanced Settings › Personal Access Credentials* and create a UAID and
  Secret Key. The UAID is not your account email. Cloud mode needs outbound
  internet; it uses YoLink's US servers by default.

## Install and set up

1. Install YoLink from **Settings › Plugins › Catalog**.
2. On its **Settings** tab, choose **Talk to the hub via**: *Local hub* or
   *YoLink cloud*.
3. Fill in the credentials for that mode and save.

The plugin signs in, reads the hub's device list and creates a device for
each one. It waits 10 seconds after connecting before it reads every device's
state, then keeps current from the hub's event feed. Devices you pair later
appear at the next device list check (hourly by default). Lower **Re-scan for
new devices every** to about 300 seconds while you are adding hardware, or run
**Rescan devices** from the plugin's page.

```toml
[yolink]
mode = "local"
poll_interval_secs = 3600      # the hourly check of every device
silent_after_mins  = 540       # a quiet battery sensor shows offline after 9 hours

[yolink.local]
hub_ip        = "192.168.1.60"
client_id     = "..."
client_secret = "..."
net_id        = "..."
```

In the config file you can leave `mode` out. The plugin then uses local mode
if only `[yolink.local]` is present, and cloud mode otherwise.

## Settings

| Setting | Key | Default | What it does |
|---|---|---|---|
| Talk to the hub via | `yolink.mode` | YoLink cloud | `local` or `cloud`. |
| UAID | `yolink.cloud.uaid` | | Cloud mode. The User Access Credential ID. |
| Secret key | `yolink.cloud.secret_key` | | Cloud mode. |
| API URL | `yolink.cloud.api_url` | `https://api.yosmart.com` | Cloud mode. Change it only if YoLink moves its endpoint. |
| MQTT host | `yolink.cloud.mqtt_host` | `mqtt.api.yosmart.com` | Cloud mode event feed. |
| MQTT port | `yolink.cloud.mqtt_port` | `8003` | Cloud mode event feed. |
| Hub address | `yolink.local.hub_ip` | | Local mode. The YS1606's address. |
| Client ID | `yolink.local.client_id` | | Local mode. |
| Client secret | `yolink.local.client_secret` | | Local mode. |
| Network ID | `yolink.local.net_id` | | Local mode. Local access fails without it. |
| API port | `yolink.local.api_port` | `1080` | Local mode. |
| MQTT port | `yolink.local.mqtt_port` | `18080` | Local mode event feed. |
| Full refresh every | `yolink.poll_interval_secs` | 3600 s | How often to read every device's state as a backstop for missed reports. |
| Re-scan for new devices every | `yolink.inventory_interval_secs` | same as full refresh | How often to read the hub's device list. |
| Wait between devices | `yolink.poll_device_delay_ms` | 1000 ms | Pause between devices during a refresh. A hub polled too fast answers `000201 Cannot connect to device`. That means the hub is rate limiting; the device is fine. |
| Settle before first fetch | `yolink.initial_fetch_delay_secs` | 10 s | Wait after connecting before the first full read. 0 skips it and relies on reports and the periodic refresh. |
| Not reporting after | `yolink.silent_after_mins` | 540 min | A battery sensor silent this long shows offline. The minimum is 5. |
| YoLink devices | `devices` | | Every paired device, with a name and room you can change. |

The **Logging** section holds the usual plugin log settings: level, how much
is forwarded to homeCore, rotation (daily), rotate at size (100 MB), prune
after (never) and compression (on).

## Devices

Each device is named `yolink_<YoLink device id>`. Names and units follow
homeCore's shared vocabulary. Temperatures are in °C, and the app shows each
person their own units.

| Device | `device_type` | Attributes |
|---|---|---|
| Leak sensor | `water_sensor` | `water_detected`, `temperature` (its own, °C), `probe_fault`, `freeze_warning`, `battery_pct`, `battery_low`, `last_seen` |
| Door sensor | `contact_sensor` | `open`, `battery_pct`, `battery_low`, `last_seen` |
| Temperature sensor or probe | `temperature_sensor` | `temperature` (°C), `humidity` (%, not on a temperature-only probe such as the YS8004), `temp_limit_low` and `temp_limit_high`, `too_cold` and `too_warm` (the sensor's own limits and alarms, set in the YoLink app), `battery_pct`, `battery_low`, `last_seen` |
| Vibration sensor | `vibration_sensor` | `vibration`, `battery_pct`, `battery_low`, `last_seen` |
| Motion sensor | `motion_sensor` | `motion`, `battery_pct`, `battery_low`, `last_seen` |
| Lock (YS7607, "LockV2") | `lock` | `locked` (writable), `open` (the door), `auto_lock_secs` (writable), `sound_level` (writable: 0 mute, 1 low, 2 medium, 3 high), `last_lock_action`, `last_lock_method`, `last_lock_event`, `last_alert`, `last_alert_at`, `last_alert_source`, `battery_pct`, `battery_low`, `last_seen`, `last_command_error` |
| Lock (YS7606) | `lock` | `locked` (writable), the history attributes above, `battery_pct`, `battery_low`, `last_seen`, `last_command_error` |
| Outlet, plug, switch or power strip | `switch` | `on` (writable), `power_w` (only on plugs that meter, such as the YS6602 and YS6614), `last_command_error` |
| Siren | `switch` | `on` (writable), `alarm` |

The hub itself is not a device. Device types the plugin doesn't know are
skipped.

YoLink counts battery in quarters (0 to 4), and `battery_pct` is that times
25. `battery_low` is true at one quarter or when the device says so, and
homeCore's low battery alert follows it. Without it, one quarter (25%) would
not fall under most percentage thresholds.

Each lock or unlock sets `last_lock_action` (`locked`, `unlocked`,
`lock_failed`, `unlock_failed`, `jammed`), `last_lock_method`
(`fingerprint`, `code`, `card`, `key`, `button`, `app`, `homecore`, `auto`,
`remote`) and `last_lock_event` (all of it, with the time), so an automation
can start on "unlocked by fingerprint". `last_alert` keeps the lock's last
problem in YoLink's own word (`UnLockFailed`), with when and where it came
from.

Every change a device reports is marked as made outside homeCore, and a
change made by hand at a lock (fingerprint, button, key, code) is also marked
as physical. An automation that asks for a change by "another app or hub"
starts on these.

### Commands

Commands are attribute writes:

```json
{"on": true}
{"locked": false}
{"auto_lock_secs": 30}
{"sound_level": 2}
```

`auto_lock_secs` takes 0 to 3600 and `sound_level` takes 0 to 3; both work
only on a YS7607. Sensors take no commands. A command that fails says why in
the device's `last_command_error` and in a `plugin_command_result` event.

## Actions

| Action | Role | What it does |
|---|---|---|
| `status` | read only | The hub, the event feed (connected, since when, last event, reconnects), and each device's last report, battery (0 to 4), signal and whether it is reporting. From memory; it asks the hub nothing. |
| `poll_now` | user | Reads every device's state now, a few seconds apart. **Check every device now** on the YoLink page runs it. |
| `rescan_devices` | user | Reads the device list again and republishes each device's registration and schema. |

## Alerts

homeCore's own alerts cover a leak (`water_detected`), a device offline and a
low battery. The plugin adds these:

| Alert | Severity | When | Clears |
|---|---|---|---|
| Lock didn't lock or unlock | error, on by default | The lock reported `LockFailed` or `UnLockFailed`: the bolt jammed or the door was in the way. | On its next lock or unlock that works, or after 12 hours. |
| Door left open | warning, on by default | A door sensor's or lock's "still open" reminder, as set in the YoLink app. | When it closes. |
| Leak sensor fault | warning, on by default | A probe fault or freezing, so it may not notice water. | When the sensor reports it fixed. |
| Sensor not reporting | warning, off by default | A battery sensor missed its check-ins. homeCore's Offline alert says the same, so this one stays off unless you turn it on. | When it reports. |

The plugin also posts notices on its page: `not_configured` (no hub or
account set, or an empty Client ID or Secret), `hub_unreachable` (it couldn't
start talking to YoLink) and `stream_disconnected` (the event feed is down).

## Screens and cards

The YoLink page (**Settings › Plugins › YoLink**) shows whether every device
is reporting, whether the live feed is up, and any low battery. It lists the
leak sensors (dry or wet, when each last checked in, and the automations that
start on a leak), temperatures with what homeCore tells you about each,
doors, locks, switches and the rest, batteries lowest first, and sensors that
have gone quiet.

A lock's panel has two tabs. **Lock** shows its state and how it last
changed, Lock and Unlock (unlocking asks first), the door, battery, last
problem, and the lock's own auto lock and beep settings. **History** lists
past events.

A temperature sensor's panel has **Tell me when**: warmer than, colder than,
for how long, and who is told. These are saved as homeCore alert rules
(Settings › Alert rules), so they ring the bell, show on the Alerts page,
clear by themselves, and can start automations with **Do something**.
Changing them needs permission to change automations.

A leak sensor's panel shows dry or wet, when it was last wet, when it checked
in, its own temperature, whether its probe works, and what happens if it gets
wet.

Locks and temperature probes (a freezer, say) get their own cards, in
standard, compact and large sizes. Room sensors, doors, plugs and switches
keep the app's own cards. **Water** is a card you can add to any page. It
says all dry, or which sensors are wet and since when and which automations
ran, and whether they all checked in.

In automations, a step on a lock can be Lock, Unlock, Change auto lock or
Beep volume.

## Troubleshooting

Devices report through the hub's event feed as things happen. In local mode
the feed signs in with the client secret, so renewing the plugin's access
token never drops it. If the feed drops, the plugin raises
`stream_disconnected`, reconnects (10 seconds at first, doubling up to a
minute), and then checks every device to catch up.

The hourly check reads every device in the background, one at a time. A leak
report or a lock command never waits behind it.

Battery sensors check in every few hours. One that hasn't checked in for
**Not reporting after** shows offline ("Not reporting") instead of its last
reading, so a leak sensor with flat batteries never shows as dry. It comes
back as soon as it reports.

A device the hub stops listing shows offline. It is removed only if the next
list leaves it out too.

If the plugin can't reach YoLink at startup, it tries three times, a minute
apart, then exits and homeCore restarts it.

| Problem | What to do |
|---|---|
| `hub_unreachable` at startup | Check the hub's address and the Client ID and Secret. In local mode, check the Network ID too. |
| `stream_disconnected` keeps coming back | A rejected credential looks like a dropped connection. Check the Client ID and Secret. Cloud mode also needs outbound internet. |
| Polls fail with `000201 Cannot connect to device` | The hub is rate limiting. Raise **Wait between devices**. |
| A newly paired device doesn't appear | Run **Rescan devices**, or lower **Re-scan for new devices every**. |
| A sensor shows "Not reporting" | Replace its batteries, or check that it is in range of the hub. |

Changes between versions, including the 0.1.17 attribute changes, are in the
[release notes](../release-notes).

## Known limits

The plugin doesn't publish energy (`energy_kwh`), because YoLink doesn't
document its source. YoLink device types not listed above are skipped.
