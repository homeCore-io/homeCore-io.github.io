---
id: yolink
title: YoLink
sidebar_label: YoLink
sidebar_position: 5
---

# YoLink (`hc-yolink`)

The hc-yolink plugin brings YoLink devices into homeCore: leak sensors, door
sensors, temperature sensors and probes, vibration and motion sensors, locks,
plugs and switches. It talks to a **YS1606 local hub** on your network (no
internet needed) or to the **YoLink cloud** for other hubs, and it has its own
screens: a YoLink page, lock, temperature and leak panels, lock and freezer
cards, a "Water" card for any page, and a lock step for automations.

## Setup

Install it from **Settings › Plugins › Add**, then on its **Settings** tab:

- **Local hub** (YS1606, recommended): the hub's address, and the Client ID,
  Client Secret and Network ID from the YoLink app under *Local Hub → Local
  Network → Integrations → Local API*. Give the hub a fixed address.
- **YoLink cloud**: a UAID and Secret Key from *Account → Advanced Settings →
  Personal Access Credentials*. The defaults point at YoLink's US servers
  (`api.yosmart.com`, `mqtt.api.yosmart.com:8003`).

`mode` may be left out: the plugin uses whichever credentials you entered.

```toml
[yolink]
mode = "local"
poll_interval_secs = 3600      # the hourly check of every device
silent_after_mins  = 540       # a quiet battery sensor shows offline after 9 h

[yolink.local]
hub_ip        = "192.168.1.60"
client_id     = "…"
client_secret = "…"
net_id        = "…"
```

## How it stays current

- **Live events.** Devices report through the hub's event feed as things
  happen. In local mode the feed signs in with the client secret, so renewing
  the plugin's access token never drops it. If the feed drops, the plugin says
  so on its page, reconnects, and then checks every device to catch up.
- **The hourly check** reads every device a few seconds apart, in the
  background — a leak or a lock command never waits behind it. **Check every
  device now** on the YoLink page does the same at once.
- **Sensors that go quiet.** Battery sensors check in every few hours. One
  that hasn't for `silent_after_mins` is shown **offline** ("Not reporting"),
  never as its last reading — a leak sensor with flat batteries is never shown
  as dry. It comes back as soon as it reports.
- A device the hub stops listing is shown offline, and removed only if the next
  list leaves it out too.

## What it publishes

Names and units follow homeCore's shared device vocabulary. Temperatures are
°C; the app shows each person's own units.

| Device | `device_type` | Attributes |
|---|---|---|
| Leak sensor | `water_sensor` | `water_detected`, `temperature` (its own, °C), `probe_fault`, `freeze_warning`, `battery_pct`, `battery_low`, `last_seen` |
| Door sensor | `contact_sensor` | `open`, `battery_pct`, `battery_low`, `last_seen` |
| Temperature sensor / probe | `temperature_sensor` | `temperature` (°C), `humidity` (%, not on a temperature-only probe such as the YS8004), `temp_limit_low` / `temp_limit_high` and `too_cold` / `too_warm` (the sensor's own limits and alarms, set in the YoLink app), `battery_pct`, `battery_low`, `last_seen` |
| Vibration sensor | `vibration_sensor` | `vibration`, `battery_pct`, `battery_low`, `last_seen` |
| Motion sensor | `motion_sensor` | `motion`, `battery_pct`, `battery_low`, `last_seen` |
| Lock (YS7607 "LockV2") | `lock` | `locked` (writable), `open` (the door), `auto_lock_secs` (writable), `sound_level` (writable: 0 mute, 1 low, 2 medium, 3 high), `last_lock_action`, `last_lock_method`, `last_lock_event`, `last_alert`, `last_alert_at`, `last_alert_source`, `battery_pct`, `battery_low`, `last_seen`, `last_command_error` |
| Lock (YS7606) | `lock` | `locked` (writable), the history attributes above, battery, `last_command_error` |
| Plug / outlet / switch | `switch` | `on` (writable), `power_w` (only plugs with a meter — YS6602, YS6614, or any that reports power), `last_command_error` |

- **Battery.** YoLink counts in quarters (0–4); `battery_pct` is that × 25.
  `battery_low` is true at one quarter or when the device says so — homeCore's
  low-battery alert follows it (one quarter, "25 %", is under no percentage
  threshold on its own).
- **A lock's history.** Each lock and unlock sets `last_lock_action`
  (`locked`, `unlocked`, `lock_failed`, `unlock_failed`, `jammed`),
  `last_lock_method` (`fingerprint`, `code`, `card`, `key`, `button`, `app`,
  `homecore`, `auto`, `remote`) and `last_lock_event` (all of it, with when).
  Automations can start on "unlocked by fingerprint". `last_alert` keeps the
  lock's last problem in YoLink's own word (`UnLockFailed`), with when and from
  where.
- **Outside changes.** Every change a device reports is marked as made outside
  homeCore (a hand at a lock — fingerprint, button, key, code — as by hand), so
  an automation that asks for "another app or hub" starts on it.

Commands: `{"on": bool}`, `{"locked": bool}`, `{"auto_lock_secs": N}`,
`{"sound_level": 0-3}`. A command that fails says why on the device
(`last_command_error`) and as a `plugin_command_result` event.

## Alerts

homeCore's own alerts cover a leak (`water_detected`), a device offline and a
low battery. The plugin adds:

| Alert | When | Clears |
|---|---|---|
| Lock didn't lock or unlock | the lock reported `LockFailed` / `UnLockFailed` | on its next lock or unlock that works (or after 12 h) |
| Door left open | a door sensor's (or lock's) "still open" reminder | when it closes |
| Leak sensor fault | a probe fault or freezing | when the sensor reports it fixed |
| Sensor not reporting | a battery sensor missed its check-ins (off unless turned on — homeCore's Offline alert says the same) | when it reports |

## Its screens

- **The YoLink page** (Settings › Plugins › YoLink): whether every device
  reports and the live feed is up; a low battery; the water — every leak sensor,
  dry or wet, and when it last checked in, with the automations that start on a
  leak; temperatures with what homeCore tells you about each; doors; locks;
  switches and the rest; batteries lowest first; sensors that have gone quiet.
- **A lock's panel**: Lock (its state and how it last changed, Lock / Unlock —
  unlocking asks first — door, battery, last problem, and the lock's own
  auto-lock and beep settings) and History.
- **A temperature sensor's panel**: **Tell me when** — warmer than, colder
  than, for how long, and who is told. These are saved as homeCore **alert
  rules** (Settings › Alert rules), so they ring the bell, show on the Alerts
  page, clear by themselves and can start automations with **Do something…**.
  Changing them needs permission to change automations.
- **A leak sensor's panel**: dry or wet, when it was last wet, when it checked
  in, its own temperature, whether its probe works, and what happens if it gets
  wet.
- **Cards**: a lock card, and a card for temperature probes (a freezer) with
  what it tells you about. Room sensors, doors, plugs and switches keep the
  app's own cards.
- **"Water"**, a card for any page: all dry, or which sensors are wet and since
  when (and which automations ran), and whether they all checked in.
- **The automation step** on a lock: Lock, Unlock, Change auto-lock, Beep
  volume.

## Upgrading from 0.1.16

- `energy_kwh` is gone (YoLink doesn't document its source), and `power_w` is
  now right: YoLink sends tenths of a watt, so a plug reading 3.7 W in the
  YoLink app used to show 37 W. Plugs without a meter publish no `power_w`.
- A temperature-only probe no longer publishes `humidity`.
- Leak sensors read wet correctly on every check (they used to read dry on the
  hourly check during a leak); vibration and motion sensors now fire.
- New on every battery device: `battery_low`, `last_seen`. On locks:
  `last_lock_*`, `last_alert_at`, `last_alert_source`. On leak sensors:
  `temperature`, `probe_fault`, `freeze_warning`.
- Reports are now marked as outside changes, so an automation with "changed
  by another app or hub" on a YoLink device starts — it never did before.
- Kept as they were: `water_detected`, `open`, `locked`, `on`, `humidity`,
  `temperature`, `battery_pct`, `vibration`, `last_alert`.
