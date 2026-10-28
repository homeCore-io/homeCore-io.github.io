---
id: release-notes
title: Release Notes
sidebar_label: Release Notes
sidebar_position: 99
---

# Release Notes

Detailed history of homeCore releases. Each entry summarises what
operators see — UI changes, stability fixes, configuration updates,
and any flags that affect upgrade. Per-component git tags and CI
state are tracked separately on the
[ci-glance dashboard](https://homecore-io.github.io/ci-glance/).

Component releases follow **per-component SemVer**; the `0.1.x`
cohort moves roughly together but not all components ship in every
patch round. The release matrix for each version below lists which
components were tagged.

**Every core release has an entry here**, including the rounds where
nothing an operator would notice changed — those say so. An entry is
written as part of cutting the release, because a tag with no entry is
a release nobody outside the workspace can find out about.

---

## v0.1.93 — 2026-10-21

**Theme:** the thermostat plugin is made safe and gets its own screens.
Plugins are now asked to stop before they are killed.

### What you'll notice

- **The Thermostat page**: a card for each thermostat with the room
  temperature, its target and mode, what it is doing and why, its sensors,
  switch, today's run and its guards, with Open, Turn off and Remove. A
  "needs you" count and outline point at one that has a problem.
- **Add a thermostat** from the page: pick what it runs (an AC, a heater,
  or a fan or other), the plug or switch, the sensors and the target. Safe
  guards for that kind are filled in for you. Plugs already run by a
  thermostat are marked, and lights, locks and other thermostats are not
  offered.
- **The thermostat panel**: the room temperature, target ± and the modes
  that kind can do (an AC only Cool and Off, a heater only Heat and Off),
  "Doing now" with the reason in words, one-tap holds ("66° for 2 h",
  "until 7 AM") and "Back to usual", today's chart from homeCore's
  history, and its sensors, switch and guards, each with "Change ›".
- **Cards** in three sizes, and **an automation step** to set the target,
  set the mode, hold a target for a while, or go back to usual.
- **A sensor that goes quiet turns the switch off.** After 2 hours with
  no reading (changeable) a sensor no longer counts; with none left the
  AC, heater or fan is turned off and an alert says so. Before, a dead
  sensor's last reading was trusted for ever.
- **Every on and off is checked.** If the plug doesn't confirm within 30 s,
  or is offline, an alert says so and the command is tried again.
- **A switch flipped by hand is left alone for 1 hour** (or until the
  target or mode changes, or you press "Take over now"). An optional alert
  can tell you when it happens.
- **Heaters are turned off** when the plugin stops, when a thermostat is
  removed or moved to another plug, and after their longest run (4 h
  unless changed), with an alert.
- **Nothing is switched at startup** until the plugin knows its state, so
  an AC no longer flicks on and off on a restart.
- **One bad thermostat no longer stops the plugin.** It is skipped with a
  notice and an alert; the rest run. A target that looks like °F (46–110)
  gets a "Make it 68 °F (20 °C)" button.
- **Plugins get 2 seconds to stop.** homeCore now asks a plugin to stop
  (SIGTERM) and only kills it if it is still running after 2 s, so a
  plugin can leave what it controls safe.
- A plugin notice and its fix on a plugin's page now have a space between
  them.

### For integrators

- Rust SDK 0.6.3: `subscribe_availability` and
  `ManagementHandle::with_availability_handler`, to hear whether another
  plugin's devices are online.
- Rust SDK 0.6.3 fixes a hang on reconnect: a plugin with many
  subscriptions that started before the broker could stop reading messages
  for good after core restarted. Every Rust plugin built on 0.6.3 has the
  fix as it is next released.
- A thermostat's command (`set_actuator`) can no longer be used to send an
  arbitrary command to another device: the new switch must be a plain
  on/off device, and custom on/off payloads come only from the config
  file.

### Release matrix

**Tagged at v0.1.93:** `homeCore` (core), `hc-thermostat` 0.1.18. App:
`hc-web-svelte` v0.1.29.

### Upgrade notes

- Update core, the app (0.1.29) and `hc-thermostat` (0.1.18) together.
  The house has no thermostats set up today, so nothing changes until one
  is added.
- A config entry with a target such as `setpoint = 68` used to stop the
  plugin. Now that thermostat alone is skipped until you press "Make it
  68 °F (20 °C)" on the Thermostat page or fix the file.
- New in config: `kind` (`ac`, `heater` or `fan`; an entry without one
  follows its mode), `max_run_secs`, `sensor_timeout_secs`, `on_stale`
  (`off` by default, `hold` to keep the old behaviour) and
  `override_secs`. New thermostats get their kind's guards (AC 3 min on /
  5 min off). An AC with no guards gets a notice; very large swings and
  guards are capped.
- **Off now means off and left alone**: one OFF is sent, then the switch
  is not touched. **No current reading now turns the switch off** (it used
  to hold it).
- Attributes: `actuator_last_error` → `last_command_error`;
  `last_update` removed. New: `kind`, `reason`, `sensor_readings`,
  `actuator_confirmed`, `actuator_online`, `on_since`, `hold_setpoint`,
  `hold_until`, `override_until`, today's run figures (`run_secs_today`,
  `cycles_today`, `longest_run_secs_today`, `today_from`) and the new
  settings above. `hvac_mode` offers only the kind's modes.
- Actions: `hold`, `resume`, `start_now` and `resync` are new; the
  plugin's `reload_config` is gone (homeCore already restarts a plugin
  when its file changes).
- Holds, hand-flip overrides and the compressor guard's timer survive a
  plugin restart but not a core restart.
- Not yet tried against the real plugs: real Z-Wave and YoLink confirm
  timing, and a heater plug's own auto-off. Set a heater plug's auto-off a
  little longer than the thermostat's longest run.

**App v0.1.30 (2026-10-28)** follows with no core change — a polish pass
across the whole app, from a walkthrough of every screen:

- **Numbers that agree.** Settings, System, Devices and Plugins count the
  same way: plugin scenes go with scenes ("1 scene · 81 from plugins"), and
  a plugin turned off on purpose isn't counted as trouble. "Last backup"
  goes by calendar day.
- **Times, dates and units said one way.** Your own 12- or 24-hour clock
  everywhere, never "02:04 PM"; "Today" and "Yesterday"; "12 d ago", not
  "285 h ago"; degrees against the number ("70.7°F"). Device pages say
  times, named values ("Lock failed", a WLED effect's name) and colours
  instead of raw data.
- **Offline looks offline.** A card for a device that's offline drops its
  switch and controls and says "Offline" — the same word on every card.
- **One Edit button** on Home and each room: "Just for me" (the old
  Customise) or "For everyone".
- **Alerts:** each alert is one card with its buttons inside, always in the
  same order; the quieter choices are behind "⋯"; a count and "Mark all
  seen".
- **Wording:** "Delete…" for anything that destroys, "Remove" only for
  taking something out of a list, "Uninstall…" for plugins.
- **The automation editor:** triggers, checks and steps are all added from
  the same picker; an unfinished part reads "(choose a device)"; a new
  automation's to-do list waits for its first Save.
- **On a phone:** More lists your rooms; nothing scrolls over the header;
  Devices' filters scroll in one row; the "devices may be gone" banners
  fold into one line.
- **Pages** is out of the menus until it's built.
- Plugin cards hold their place while they load instead of swapping in, and
  their names wrap to two lines.

**Plugins, same day, no core change — their cards:** `hc-hue` 0.2.4 (the
card laid out as the app's own, with its symbol, switch and colour bar; a
switched-off light's switch no longer dims), `hc-wled` 0.1.24 and
`hc-sonos` 0.1.18 (an offline controller or speaker says "Offline" with
nothing to press), `hc-zwave` 0.1.18 and `hc-roku` 0.1.14 ("Offline", not
"Not answering"), `hc-yolink` 0.1.18 (the cold limit shows an example, not
a dash). Update the app first; the plugins' cards follow it.

**App v0.1.31, `hc-sonos` 0.1.19 and `hc-hue` 0.2.5 (2026-10-28)**, no core
change:

- **Sonos playlists.** The plugin always read your Sonos playlists; now its
  screens show them — under Favourites on its page (pick, choose speakers,
  Play), as a Playlists tab on a speaker's panel, and as "Play a playlist"
  in automations.
- **Restarting or updating a plugin.** "…is restarting" and "…installed and
  starting" now clear once it's running again, instead of staying up. A
  plugin updated while the app is open keeps its own screens and offers
  "Reload to see its new screens" — it used to fall back to the general
  plugin page. The Settings tab reads its form again after a restart.
- **Panels.** A light that's off shows its last brightness, faded, not
  "0%". Sonos's panel fills its dialog, shows a music note where there's no
  artwork, and an offline speaker shows nothing to press. Hue's light panel
  no longer repeats "Off".
- **Smaller things.** "For everyone" no longer opens with a note about
  changes to things that are gone (Done tidies them away). A rule's page
  doesn't say the rule twice. Automations: one link style, "Show them all"
  on an empty search, a tidier phone layout. Add a person says a short
  password as you type. Me labels its unit rows. A plugin's custom log rule
  is shown instead of an empty box.

**App v0.1.32 (2026-10-28)**, no core change — the last of the polish pass:
System shows a person's identical connections once ("× 6"); Alert rules
say what "Add rule" still needs, give their times in your clock ("between
11:00 PM and 5:00 AM") and write "14°F"; the settings search runs full
width; choosing a backup file is no longer a red button (the warning comes
at Restore); a plugin's "Delete all its devices…" is an ordinary button;
Add a plugin says "Update to …" for a newer version; and Add a card's
filters show there are more to scroll to.

---

## v0.1.92 — 2026-10-21

**Theme:** Roku gets its own screens, with every channel's real icon, and
the Roku plugin is reworked.

### What you'll notice

- **Open a channel by its icon.** Each Roku's panel starts with "Open a
  channel": its channels with their own icons from the Roku, most used
  first, and the one playing lit. "All 43 ›" opens every channel, A–Z, with
  a search. Icons are kept by the plugin, so they show at once and survive
  a restart.
- **The Roku panel**: what is on (channel and position, an input, or off),
  a power button, the remote (arrows, OK, Back, Home, replay, options,
  rewind, play/pause, fast-forward, volume, mute, typing on the screen, and
  "Find my remote" where the Roku has it), and on TVs an Inputs tab with
  the inputs named as you named them on the TV.
- **The Roku page**: each Roku with its channel strip, room, model,
  address, network, Roku OS, whether phone control is allowed, and how many
  channels and inputs it has, plus "Open the remote", "Refresh channels",
  and "Forget it" for a found Roku that is gone for good.
- **Cards**: a Roku card with play/pause, volume and power, and in large
  size its four most used channels. A TV that is off has "Turn on".
- **In automations**: open a channel (picked by its icon), switch input,
  turn on or off, or press a button a number of times. Opening a channel
  on a TV that is off turns it on first.
- **Remote presses arrive in order.** A burst of presses no longer jumbles
  or drops, and the Roku is checked once afterwards instead of after every
  press.
- **A Roku that refuses control says so.** If "Control by mobile apps" is
  off, the device shows why and an alert gives the fix (on the Roku:
  Settings › System › Advanced system settings › Control by mobile apps ›
  Network access: Default). It clears on the next command that works.
- **A TV that is off keeps its channels and inputs**, including after a
  restart, so the 65" TV's panel is never empty. A TV on an input reads
  "On · HDMI 1" rather than "playing", and one that is off shows no input.
- **A Roku that stops answering** stops showing what it was playing; it is
  never removed. One that changes address is found again by its serial
  number and keeps its id, name, room and automations.
- **A TV fully off can be woken after a restart**: the plugin remembers its
  network address for Wake-on-LAN.
- Settings no longer re-register every few seconds, and a Roku's state no
  longer carries its network name and hardware addresses.

### For integrators

- `GET /plugins/{id}/files/{file}`: a picture a running plugin keeps
  (png, jpg, webp, gif; up to 4 MiB), passed through and cached for good —
  a plugin gives a file a new name when it changes. The plugin side is the
  Rust SDK's `with_files_dir`; plugin screens get the address from the new
  optional `host.fileUrl(path)`.
- Rust SDK 0.6.2: `with_files_dir` and `with_async_handler` (plugin actions
  that run without holding up the others).

### Release matrix

**Tagged at v0.1.92:** `homeCore` (core), `hc-roku` 0.1.13. App:
`hc-web-svelte` v0.1.28.

### Upgrade notes

- Update core, the app (0.1.28) and `hc-roku` (0.1.13) together; channel
  icons need all three. On an older app the screens show coloured name
  tiles instead.
- Roku device ids are unchanged. No house automations use Rokus.
- Removed from Roku state: `device_info`, `model_name`, `model_number`,
  `software_version`, `friendly_name`, the MAC addresses and the network
  name. Renamed: `supports_wake_on_lan` → `supports_wake_on_wlan`. `state`
  is `idle` on an input (was `playing`) and when off (was `stopped`);
  `source` is empty when off (was "Home"); a TV with its screen off
  ("DisplayOff") counts as on.
- Actions: `next` / `previous` became `rewind` / `fast_forward`;
  `app_icon` is gone; `forget_device` and `status` are new. New
  attributes: `media_position_updated_at`, `last_command_error`, and
  `icon` and `launches` on each channel.

---

## v0.1.91 — 2026-10-21

**Theme:** an alert can start automations, and they stay tied to it — for
every kind of alert and every plugin.

### What you'll notice

- **"Do something…" on every alert** (Alerts page): choose what it covers —
  this device, any device like it (any YoLink leak sensor, including ones
  you add later), or every alert of its kind — and when: it happens, it
  ends, or it's still on after 10 minutes. The automation editor opens with
  that trigger filled in, a banner saying which alert starts it, and a few
  steps to start from. The alert's words can go in any message as
  `{alert.message}`.
- **Settings › Alert rules shows what each alert starts.** Under every alert
  rule, every plugin alert type, and a new "homeCore's own" section (wet,
  smoke, offline, jammed, low battery) is a "When it happens:" line naming its
  automations, with "+ Do something…". Automations you wrote by hand that
  start from an alert are found and listed too.
- **Alerts and their automations are looked after together.**
  - Turn an alert rule off, set a plugin alert to "Show it: Off", or ignore
    an alert, and the automations it starts wait — their cards say so — and
    come back when you turn it on again.
  - Deleting an alert rule that starts automations asks first: delete them
    too, or keep them turned off. An automation that also has another
    trigger keeps running on that one; only the deleted rule's trigger goes.
    A kept automation says its alert was deleted and runs again once you
    give it another trigger.
  - Deleting an automation leaves its alert alone.
- **Automations list:** each card started by an alert says which ("Started by
  the alert “Freezer warming up”"), and a "Started by alerts" filter shows
  just those. Sentences name the alert ("When the alert “Garage door left
  open” is raised", "When an offline alert from YoLink is raised").
- Turning on an automation that can't run is now refused before anything is
  saved (before, it was saved and then failed).

### What is deliberately unchanged

- Alerts still notify on their own ("Tell" / "Also send to"); automations are
  for everything else.
- "When it ends" also runs when an alert is withdrawn — its rule turned off
  or the alert ignored — so clean-up automations still run.
- Automations that watch a device directly (like "Water Valve Off" on the
  leak sensors) aren't tied to an alert and aren't listed under one.

### For integrators

- `GET /alerts/automations`: every automation with an alert trigger, what can
  raise it, and whether it is waiting (`off`, `ignored`, `deleted`).
- `GET /alert-rules/{id}/automations`: what deleting the rule would touch.
- `DELETE /alert-rules/{id}?automations=delete|disable`. Without the choice,
  a rule that starts automations is refused with 409 and the list; a rule
  that starts nothing is deleted as before (204).
- An alert filter's `plugin_id` now also matches homeCore's own kinds on that
  plugin's devices (`{kind: "wet", plugin_id: "plugin.yolink"}`). A filter
  with only `plugin_id` set therefore also matches that plugin's devices
  going offline or wet.

### Release matrix

**Tagged at v0.1.91:** `homeCore` (core). App: `hc-web-svelte` v0.1.25.

### Upgrade notes

- Update the app to 0.1.25 with core. On an older core the app still works,
  without these screens.
- No configuration changes. Existing automations are unchanged.

**YoLink gets its own screens, and leak sensors are read right (2026-10-21)**:
`hc-yolink` 0.1.17 and app `hc-web-svelte` 0.1.26. No core change needed.

- **"Water Valve Off" will start working.** It only runs on changes from
  YoLink itself, and the plugin never marked them that way, so it has never
  fired. From 0.1.17 a leak sensor getting wet runs it and turns the Water
  Valve switch **on**, as the automation says — check that "on" is the way
  round you want before upgrading.
- **A leak stays a leak.** The hourly check and the check after a restart
  read a wet sensor as dry; now they read it right.
- **The mouse trap's vibration sensor works** (it could never report
  shaking), and so do YoLink motion sensors.
- **Power is right**: the power-meter plug showed 37 W for 3.7 W. Plugs
  without a meter (Office Humidifier Plug, Water Valve) no longer show a
  made-up 0 W.
- **A low lock battery is an alert now.** YoLink's lowest level read as
  25% and never alerted; it now raises the low-battery alert.
- **A sensor that goes quiet goes offline** after 9 hours with nothing, so
  a leak sensor with dead batteries is never shown as dry.
- **Locking and unlocking the Laundry Room Lock from homeCore** sends the
  request newer YoLink locks expect.
- **The live feed from the hub no longer drops** when its sign-in renews,
  catches up after a reconnect, and the hourly check no longer holds up
  leak alerts or lock commands.
- **The YoLink page**: water (all 7 leak sensors), temperatures with what
  each one alerts on, doors, locks, switches, batteries lowest first (in
  YoLink's quarters), and sensors that have gone quiet.
- **A lock opens with Lock and History tabs**: lock or unlock (unlocking
  asks first), the door, the battery, the last problem, auto-lock and beep
  volume, and how it was last locked or unlocked (fingerprint, app, button,
  by itself, homeCore). A lock that fails to lock raises an alert that
  clears on the next success.
- **The freezer opens with "Tell me when"**: warmer than a temperature for a
  while makes an alert rule ("Garage Freezer warming up"), so "Do
  something…" works on it. Leak sensors show when they were last wet, their
  check-in and any sensor fault.
- **Cards**: a lock card, a freezer card, and a "Water" card for the
  dashboard. Room temperature sensors, doors and switches keep the app's
  own cards.
- **In automations**: lock, unlock, change auto-lock, and beep volume.
- The app (0.1.26) lets a plugin's card apply to some of its devices only
  (the freezer gets YoLink's card, room sensors keep the app's).

**Upgrade:** update the app to 0.1.26 with or before `hc-yolink` 0.1.17. No
longer published: `energy_kwh`, the freezer probe's `humidity`, and
`power_w` on plugs without a meter. `power_w` on the metering plug is now
a tenth of what it was. New: `battery_low`, `last_seen`, the lock's
`last_lock_action` / `last_lock_method`, `last_alert_at` /
`last_alert_source`, a leak sensor's `temperature`, `probe_fault`,
`freeze_warning`, and the temperature sensors' own limits. Device ids are
unchanged.

**Caséta gets its own screens, and every Pico press counts (2026-10-21)**:
`hc-caseta` 0.1.15, `hc-lutron` 0.1.22 and app `hc-web-svelte` 0.1.27. No
core change needed.

- **Every Pico press reaches your automations.** A press used to be lost
  whenever the release before it was missed, so pressing the same button
  again did nothing — likely why your Pico showed button 5 stuck "pressed".
  Buttons now reset after each press and after a reconnect, holds are
  reported, and the "button pushed / held / released" trigger works for
  Caséta Picos.
- **Picos know their buttons.** One with none set up is the usual 5-button
  Pico (On, Favorite, Off, Raise, Lower); a 4-button scene Pico is learned
  from its first press; a 2-button one is set in Settings, where buttons
  and their names can now be edited. Re-importing the bridge's integration
  report fills in what's missing without touching what you set by hand.
- **A Pico opens exactly like a Lutron Pico**: the same drawn Pico with the
  last press lit, what each button starts (with "+ Make one"), and the last
  press. The app no longer adds its own button readings, chart and raw
  presses under it — for Lutron Picos and keypads too.
- **A silent bridge is noticed** within a couple of minutes (it took about 15),
  a wrong password says so instead of "unreachable" every 5 seconds, and
  reconnects back off.
- **Commands are honest**: one the bridge rejects shows why on the device,
  one sent while the bridge is unreachable is refused at once instead of
  running whenever it comes back, and scenes go offline with the bridge.
- **The Caséta page**: connection, lights and plugs with how each works
  (from Settings) and a "dims — set it to Dimmer?" hint when a light set
  to on/off reports a part level, the Picos and what their buttons do, the
  bridge scenes with Run and how many automations use each, and anything
  the bridge mentions that isn't set up.
- **Cards**: a "Caséta scenes" card for the dashboard (choose which and
  their order) and a small Pico card with its last press.
- **In automations**: run a bridge scene, or press a Pico button (it does
  whatever the button is paired to in the Lutron app).
- A malformed line from the bridge no longer restarts the plugin; renaming
  a scene keeps its automations.
- `hc-lutron` 0.1.22: its Pico panel also lists automations using the
  "button pushed" trigger.

**Upgrade:** update the app to 0.1.27 with or before `hc-caseta` 0.1.15
and `hc-lutron` 0.1.22. Device and scene ids are unchanged. Automations on
`button_N` becoming "press" now fire on every press, not just the first.
`available_buttons` becomes a list of `{number, name}`. New on Picos:
`pushed`, `held`, `released`, `last_button`, `last_button_name`; new on
devices and scenes: `last_command_error`. "Holiday Lights Remote 1"
becomes a 5-button Pico. Devices read offline until the plugin is
connected.

**Lutron notices a silent repeater (2026-10-21)**: `hc-lutron` 0.1.23. When
the main repeater lost power or dropped off the network without closing the
connection, all Lutron devices stayed "online" and commands went nowhere for
about 15 minutes. Now the plugin expects an answer to its keepalive and
reconnects within about a minute. Nothing else changes; no upgrade steps.

---

## v0.1.90 — 2026-10-20

**Theme:** readings in each person's own units, and the topic-mapper
profiles in the shared names — step six of the device vocabulary.

### What you'll notice

- **Units are yours.** *Me → Units* chooses °F or °C, and inHg · mph · in or
  hPa · m/s · mm. Until you choose, your browser's language decides (a US
  browser gets °F and US). Cards, device details, history charts, setpoint
  sliders, scenes, automation sentences and fields, and alert levels all show
  your units; what you type is sent to homeCore in °C and metric (70 °F is
  kept as 21.111 °C and shows as 70 again). Each person chooses for
  themselves.
- **Plugin screens follow it too**: the Ecowitt page and cards and the Hue
  sensor panel show your units (needs hc-ecowitt 0.1.21 and hc-hue 0.2.3).
- **The thermostat's "Set the target temperature"** is in your unit
  (hc-thermostat 0.1.17).
- Number fields on a device's actions no longer round to a whole number —
  21.5 was sent as 22.

### Topic mapper (Zigbee2MQTT, Shelly, Tasmota)

- The example profiles report and take the shared names: `brightness_pct`
  (Zigbee's 0–254 converted), `color_temp` in kelvin, `open`, `occupied`,
  `battery_pct`, `tampered`, `heat_setpoint`, `hvac_mode`, `hvac_action` in
  words, `locked`; commands take `color_rgb`, `transition_ms` and
  `{"action": "toggle"}`. Shelly's door contact and radiator-valve
  `window_open` read the right way round (both were inverted).
- New coercions: `pct254_to_100`, `pct100_to_254`, `invert_bool`,
  `lock_to_bool`, `bool_to_lock`, `hvac_action_words`, `uppercase`,
  `ms_to_secs`, `secs_to_ms`. A failed coercion now keeps the raw reading
  instead of the whole message.

### What is deliberately unchanged

- homeCore stores °C and metric, as since v0.1.89; only the display changed.
  History recorded in °F before the plugins moved still reads as it was
  stored, so older chart points can look too high.
- An alert rule's label is saved in the words of whoever wrote it ("above
  86 °F").

### For plugin authors

- `host.units` (optional): the person's choice, `show(value, unit)`,
  `toCore(value, unit)` and `subscribe`. Without it (an app before 0.1.21)
  show the schema's unit.
- The SDK READMEs and example lights use `brightness_pct`, the last level
  for `{"on": true}`, and `{"action": "toggle"}`.

### Release matrix

**Tagged at v0.1.90:** `homeCore` (core), `hc-ecowitt-v0.1.21`,
`hc-hue-v0.2.3`, `hc-thermostat-v0.1.17`. App: `hc-web-svelte` v0.1.21.

### Upgrade notes

- **Using a profile copied from `config/profiles/examples/`?** Your copy keeps
  the old names until you copy the new example over it. Mapped devices then
  report the new names — automations reading `brightness`, `contact`,
  `occupancy`, `battery`, `target_temp` on them need the new names (the
  vocabulary check lists them).
- Update the app and the three plugins together with core; nothing else to
  change.

**Lutron gets its own screens (2026-10-20)**: `hc-lutron` 0.1.21 and app
`hc-web-svelte` 0.1.22. No core change needed.

- **The Lutron page** shows the repeater connection, your scenes (phantom
  buttons) grouped by room with the light that shows which is on — tap one
  to run it — the keypads with their lit buttons and last press, the Picos
  and visor receivers, and how many switches, dimmers, fans and occupancy
  groups there are. Keypad buttons that still read "Button 5" are pointed
  out.
- **A keypad opens as the keypad on the wall**: pick a button to press it or
  set its light (off, on, slow or fast flash), with its last presses and the
  automations that start on it. **A Pico** is drawn from the buttons it has
  (2-button or 5-button); **a visor receiver** shows its buttons and its
  contact inputs.
- **Cards**: a keypad card in three sizes, and a "Lutron scenes" card for a
  dashboard — choose which scenes and in what order.
- **In automations**, "Press a button" or "Set a light" is picked on the
  drawn keypad.
- Buttons with no engraving are named for what they are: a keypad's raise
  and lower buttons read Raise and Lower, a Pico's On, Favorite, Off, Raise
  and Lower.
- The app (0.1.22) keeps a plugin's panel open while the device's readings
  change — a keypad no longer forgets the button you picked after a press —
  and gives a plugin's automation step a full row. Hue's screens benefit
  too.

**Upgrade:** update the app to 0.1.22 with or before `hc-lutron` 0.1.21.

**Sonos gets its own screens, and grouping works (2026-10-20)**: `hc-sonos`
0.1.17 and app `hc-web-svelte` 0.1.23. No core change needed.

- **The Sonos page** shows your speakers with what each is playing, a
  play/pause button and its volume, your Sonos favourites (pick one, pick
  the speakers, Play), your alarms with a switch each, and which speakers
  aren't answering.
- **Grouping is fixed.** A group shows within seconds of changing, not up to
  five minutes later. Play, pause, skip and favourites go to the group
  whichever speaker you touched — before, pausing a grouped speaker reported
  success and did nothing. Grouped speakers show the group's music.
- **Play together**: tick the speakers, choose which one the music plays
  from, and the plugin makes the whole group in one go and says speaker by
  speaker what happened ("Living Room didn't answer — try again"). A group
  is one card with a volume for the group and each speaker's own under it.
- **A speaker opens as a player**: artwork, progress (or "Live" for a
  station), transport and volume, with tabs for Favourites, Group and Sound
  — bass, treble, loudness, crossfade, a sleep timer, and on a soundbar
  night mode, speech enhancement and switching to TV or line-in.
- **Cards**: a speaker card in three sizes, and "Sonos speakers" and "Sonos
  favourites" cards for a dashboard.
- **In automations**: play a favourite (optionally at a volume), set the
  volume, pause, or group speakers — the group step names the speakers and
  makes exactly that group.
- **A speaker that stops answering is no longer deleted.** It used to be
  removed after three minutes, losing its room and breaking the automations
  that used it. It now shows offline and comes back on its own; a new
  "Forget" button removes one deliberately. Its id stays the same through
  renames, restarts and a new IP address.
- Also fixed: stereo pairs and surround speakers no longer appear as extra
  speakers; renames in the Sonos app carry through without a restart; Sonos
  playlists and album favourites play (they failed with error 714); a
  command that fails says why on the speaker; a station no longer shows the
  last track's length; one sleeping speaker no longer slows the rest.
- New setting `ssdp` (default on): turn it off to use only the addresses in
  `manual_hosts`.
- The app (0.1.23) leaves out its own artwork, buttons and volume when a
  media player's plugin draws its own panel, so they aren't shown twice.

**Upgrade:** update the app to 0.1.23 with or before `hc-sonos` 0.1.17.
Existing speakers keep their ids.

**Z-Wave gets its own screens, and locks report correctly (2026-10-20)**:
`hc-zwave` 0.1.17 and app `hc-web-svelte` 0.1.24. No core change needed.

- **A lock that said "locked" when it wasn't is fixed.** Several of a lock's
  states — unlocked with a timeout, the inside or outside handle free —
  were reported as locked. Only fully locked now reads locked, and a lock
  that doesn't know says so instead of guessing.
- **The Z-Wave page** lists every device with what it's doing now, its
  power or battery, how good its signal is and when it was last heard,
  warns about a low lock battery, and shows the controller. From it you can
  add a device (pairing, the security PIN for S2 devices, then a name and
  room), remove one, rebuild the network's routes, and download a backup of
  the controller.
- **A lock opens with Lock, Codes and History tabs.** Codes: name each slot,
  add, change, clear, or turn a code off and back on. Codes go straight to
  the lock — homeCore never shows, stores or logs them. History: who locked
  or unlocked it and how (keypad and which code, by hand, by itself,
  homeCore and which automation), wrong codes and jams.
- **Every device gains Health and Settings tabs**: whether it's answering,
  its signal, ping, rebuild its routes, re-interview it, and for one that's
  gone, remove it from the network or replace it keeping its name, room and
  automations. Settings shows the device's own settings by name with their
  ranges and choices.
- **Cards**: a lock card (with a compact size) and a "Z-Wave network" card
  for a dashboard listing only the devices that need something.
- **In automations**: lock, unlock, or turn a code on or off (e.g. the
  cleaner's code only on Tuesdays). New lock readings for triggers: who and
  how it was last locked or unlocked, the code slot used, and jammed.
- **Removing a device now takes it out of homeCore**; before, it stayed
  behind. A device that stops answering, or a lost connection to Z-Wave JS,
  shows offline and is never deleted — before, a bad reply could remove
  every device.
- **A command sent while Z-Wave JS is unreachable fails and says so** within
  5 seconds. Before, it waited and ran when the connection came back — an
  unlock could happen hours later.
- Also fixed: S2 devices can be added (only S0 worked); door sensors that
  report "open" in their newer form are read as open; an outlet whose switch
  is on its first endpoint works; a device that refuses a command says so on
  the device; a hung Z-Wave JS server is noticed within a minute; startup no
  longer wakes battery devices and locks.
- The app (0.1.24) leaves out its own lock button and readings when a lock's
  plugin draws its own panel, and names power, energy and current readings
  properly.

**Upgrade:** update the app to 0.1.24 with or before `hc-zwave` 0.1.17.
These attributes are no longer published, so check any automation that uses
them: `name`, `location`, `bolt_status`, `latch_status`, `door_status` (now
`open`), and the raw `cc…_` ones (user codes, alarm type/level, and the
like). Node ids are unchanged. A device removed from Z-Wave while homeCore
was off now stays until you remove it from the Z-Wave page.

---

## v0.1.89 — 2026-10-20

**Theme:** one name, one meaning, one unit — the core half of the plugins'
move to one set of names (the plugin releases are listed under v0.1.88).

### What you'll notice

- **Timers, modes and homeCore's other own devices take actions** the way
  every plugin's devices do: an automation step is `{"action": "start",
  "duration_secs": 600}`. They now say which actions they take — *Start*,
  *Pause*, *Cancel*, *Add time* on a timer; *Count up* on a counter; *Turn on*
  on a mode — so the automation editor offers them instead of raw JSON. The
  old `{"command": "start"}` still works.
- **A vocabulary check**, `GET /api/v1/system/vocabulary-check`: every
  automation step and every device compared with what the device takes and
  with the shared names. It lists steps that call something the device doesn't
  have, old names, and units that differ from the standard — with what to
  write instead. It only reports; nothing is blocked.

### For plugin authors

- The shared names and units live in `hc-types` (`device_vocabulary`) and
  in the plugin guide's *Names and units*: `brightness_pct` 0–100,
  `color_temp` kelvin, `transition_ms`, `open`, `battery_pct`, temperatures
  in °C, and the two command shapes — write an attribute, or call a declared
  action. Convert from the device's own scale inside the plugin.

### Release matrix

**Tagged at v0.1.89:** `homeCore` (core). The plugins moved in the same round
were tagged separately (see v0.1.88).

### Upgrade notes

- **Update core**, then rewrite the timer steps to the new form:
  `core/scripts/vocabulary-rewrite.py --url http://HOST:8080 --user admin
  --phase core` shows them; add `--apply` to write. Nothing breaks if you
  don't — the old form still works.

---

## v0.1.88 — 2026-10-19

**Theme:** plugins' own cards on Home and the rooms.

### Cards

- **Devices get their plugin's own card.** Wherever a WLED controller or an
  Ecowitt weather station appears — a room, Home's Pinned, your favourites —
  it now has a card made for it:
  - a WLED controller: on and off, its look as a strip of its colours, what
    it runs and how bright; at the large size, its presets to tap;
  - a weather station: the temperature, humidity, wind and today's rain; at
    the large size, the wind on a compass, UV and pressure.
- **Cards of a plugin's own, added to a page.** Edit → "Add a card" now
  offers plugins' cards beside the house's devices and scenes:
  - **Weather now** (Ecowitt) — the weather at a glance, with the pressure
    trend; large, also UV, lightning and sensors with low batteries;
  - **Quick presets** (WLED) — the presets you choose, on the controllers you
    choose, each found by name on every controller; set up from the card's
    Settings in Edit.
  Each one added is its own card, with its own settings on that page, kept
  by the web app — not by homeCore.

### For plugin authors

- Two new places for a plugin's screens: `device.card` (its devices' card)
  and `dashboard.card` (a card of its own, with a name for "Add a card", the
  sizes it can be and an optional settings element). The `hc-tile` class
  gives a card the app's own frame. See `@homecore/plugin-ui` (`core/sdk/ui`).
- The SDKs (Rust 0.6.1, Python 0.5.1, Node.js 0.4.1, .NET 0.4.1) now pass a
  plugin's slots through as declared — homeCore decides which exist — so a
  plugin is no longer held back from a newer slot by an older SDK. The
  slot-filtering helpers the non-Rust SDKs had (`validated()` and their slot
  lists) are gone.

### Release matrix

**Tagged at v0.1.88:** `homeCore` (core), `hc-wled` 0.1.20, `hc-ecowitt`
0.1.19. The Rust plugin SDK is 0.6.1. The web app,
`ghcr.io/homecore-io/hc-web-svelte`, is released separately as v0.1.19.
Python SDK v0.5.1, Node.js SDK v0.4.1, .NET SDK v0.4.1.

### Upgrade notes

- **Update core, the web app, WLED and Ecowitt** to see the cards. In any
  other order nothing breaks: a device keeps its generic card until its
  plugin carries one.
- Nothing about pages changes on its own: plugins' cards appear only where
  someone adds them, and devices' own cards replace the generic ones in place.

**App v0.1.20 (2026-10-19)** follows with no core change:

- **Add a card is sorted.** Chips along the top narrow it to a kind of thing —
  lights and switches, sensors, scenes, media, locks and doors, modes and
  timers, hubs and remotes, plugins' cards — each with a count that follows
  the search. Everything is grouped under its room, so a hub's scenes that
  share a name in every room ("Bright", "Bright", "Bright") are told apart,
  and each says what it is ("Scene · Hue", "Temperature sensor"). Plugins'
  cards come first, with what they show.
- **The sidebar folds** to its icons for more room — its button at the top,
  or Ctrl+\ (⌘\ on a Mac). Each screen remembers its own choice.
- **homeCore has its mark:** the roofline over a dot from the old web app, in
  the app's colours — brown in light, amber in dark, and a household's own
  palette when it has one. It is the browser tab's icon, the sidebar's and
  the sign-in page's, and the icon on a phone's home screen.
- Fixed: Edit mode on a phone was wider than the screen and scrolled
  sideways.

**hc-hue 0.2.0 (2026-10-19)** follows with no core change — Philips Hue gets
its own screens, and a faster, steadier plugin under them:

- **Its screens.** Its page lists each bridge (live, or checked every
  minute), adds a bridge — homeCore looks for it, you press its button — and
  shows every room and zone, which ones are devices of their own (switch it
  there), and what needs a look. A light's panel has white across the lamp's
  own range, a colour wheel, a gradient lamp's colour points, Hue's effects
  with their speed, and its room's scenes as swatches of their colours. A
  room's panel applies its scenes (colours moving or still, with a fade) and
  sets all its lights at once. A motion sensor shows the day's motion; a
  switch shows each button and how it was last pressed.
- **Cards.** Hue lights glow in their own colour on Home and the rooms; a
  room's card shows each of its lights; large cards carry the room's scenes.
  **Hue scenes** is a card to add yourself: the scenes of the rooms you
  choose, and All off.
- **Automations.** A Hue step applies a scene, sets a look (white, colour,
  effect, brightness or a step brighter or dimmer), flashes the lights and
  puts them back (for a doorbell or a leak), or turns them on or off — each
  with a fade. A Hue switch's buttons are told apart: start on "Brighter
  held", not on any press.
- **Faster and steadier.** Reading a bridge takes one request instead of
  about twenty, and a command is no longer followed by a full read; changes
  made close together are no longer lost; button and dial presses now reach
  homeCore. **With two bridges, every device of one was dropped and added
  back about once a minute — fixed.** Pairing from the bridge's device no
  longer stalls every light while it waits for the button.
- **Alerts:** a bridge or a light not answering, and a software update
  waiting in the Hue app (off unless wanted). A light the bridge cannot
  reach now shows as unavailable.

**Upgrade:** update the plugin. Rooms and zones stay devices or not as they
were set (`publish_grouped_lights_for`); turn others on from its page.
Automations keep working; a room's device now also takes colour and white.

**hc-hue 0.2.1 (2026-10-19)** follows, again with no core change:

- **Smart scenes** — Hue's ones that change through the day, like *Natural
  light* — are scenes in homeCore now, to apply like any other.
- **Your own scenes from a room's panel:** save how its lights are now as a
  new scene, rename a scene, or delete one from the bridge.
- **Changes in the Hue app follow.** A light renamed or moved to another
  room, and a scene added, renamed or deleted, reach homeCore within seconds;
  before, a rename never did and a deletion could take a minute.
- **A bridge's address can be changed** on the plugin's page. homeCore first
  checks the new address answers as that same bridge, so a typo cannot point
  it at another one.
- **A room's panel lists the zones** its lights are also in.

**Upgrade:** update the plugin; nothing to change. Entertainment areas are
deliberately unchanged — starting one needs an app streaming colours over
Hue's own protocol, which homeCore does not speak.

**hc-wled 0.1.21 (2026-10-19)**, no core change: an automation step written
before WLED had its own step form — a preset, playlist or look with
`"on": true` beside it — now opens in that form instead of as JSON, and
keeps the `"on"` when saved. These automations always ran; only the editor
could not show them. **Upgrade:** update the plugin; nothing to change.

**hc-wled 0.1.22 (2026-10-19)**, no core change: a WLED step that applies a
preset now has a **Power** choice — *as the preset has it* or *turn it on* —
and says under it whether the chosen preset turns the strip on by itself.
A WLED preset turns the strip on only when it was saved with *Include
brightness*; one saved without leaves a strip that is off, off. Check your
"on at sunset" automations. **Upgrade:** update the plugin.

**hc-zwave 0.1.15, hc-thermostat 0.1.15, hc-caseta 0.1.13 and hc-sonos 0.1.15
(2026-10-19)**, no core change. Fixes for things that did nothing or said too
much, found by an audit of how every plugin names what devices report:

- **Z-Wave locks no longer publish their door codes.** A lock's User Code
  slots were published as device attributes in the clear, readable by anyone
  who could read devices, and kept in history. They are never published now,
  and updating the plugin clears them from current state on its first start.
  **They stay in history and in any backup taken before** — delete them from
  `history.db` with
  `DELETE FROM state_history WHERE attribute LIKE 'cc99_usercode%' OR attribute LIKE 'cc99_admincode%' OR attribute LIKE 'cc99_mastercode%';`
  and, since they were exposed, consider changing the codes.
- **Z-Wave** no longer reports what a switch, dimmer or lock was *told* as
  what it *did*; only the device's own report counts. A thermostat's heating
  setpoint is read and written where zwave-js keeps it, and colour lights are
  polled on the right command class.
- **Virtual thermostat:** setting the target temperature or mode from the app
  or an automation did nothing; it works now. A change also no longer
  restarts the plugin (and re-sends its switch command): changes are kept by
  homeCore, and a later edit to the config file still wins.
- **Caséta:** scene and shade buttons did nothing from the app or an
  automation; they work now.
- **Sonos:** *Group with…* always failed; it works now.

**Upgrade:** update the plugins. Nothing to change.

**The plugins move to one set of names (2026-10-20)**: `hc-hue` 0.2.2,
`hc-wled` 0.1.23, `hc-zwave` 0.1.16, `hc-isy` 0.1.12, `hc-lutron` 0.1.20,
`hc-caseta` 0.1.14, `hc-yolink` 0.1.16, `hc-ecowitt` 0.1.20,
`hc-thermostat` 0.1.16, `hc-sonos` 0.1.16, `hc-roku` 0.1.12. No core change
needed. Every plugin now reports and takes the same idea under the same name,
in the same unit: light level is `brightness_pct` (0–100) everywhere, white
warmth is `color_temp` in kelvin, fades are `transition_ms`, a door is `open`,
a battery is `battery_pct`, and **temperatures are °C** whatever the device
or its own setting says. The list is in the plugin guide, *Names and units*.
**This renames what devices report, so automations that use an old name stop
matching** — see the upgrade steps.

- **Hue:** `color_temp` in kelvin only (`color_temp_mirek` is gone);
  temperature always °C and light level always lux, as `illuminance`; a
  contact sensor reports `open`; fades are `transition_ms`. The *Temperature
  in* and raw-light settings are gone. Rooms and zones declare *Activate a
  scene*, and stop offering colour and white they never reported. A
  brightness above 0 turns a light on.
- **WLED:** `brightness_pct` only (the 0–255 `brightness` is gone);
  `color_temp` in kelvin replaces `cct`; the main colour is `color_rgb`
  `{r, g, b}`; fades are `transition_ms`; `led_power_mw` was really
  milliamps and is now `led_current_ma`. A preset, effect and palette are
  `preset_id`, `effect_id`, `palette_id`; *Restart* is the one restart.
- **Z-Wave:** dimmers report `brightness_pct` (from Z-Wave's 0–99) and `on`;
  `on: true` brings back the last level. `contact_open` → `open`, `tamper` →
  `tampered`, `battery` → `battery_pct`. Sensors are read in the unit the
  device reports and converted (°C, hPa, lux, W). Thermostats report
  `heat_setpoint` / `cool_setpoint`, `hvac_mode`, `hvac_action` in words and
  `fan_mode`. Covers report `position` (100 = open) from the right command
  class; a garage door opener is a cover with `open`, no longer a lock.
- **ISY:** `brightness_pct` only, read in the scale each device reports;
  `on: true` brings back the last level. Thermostats in °C with
  `heat_setpoint` / `cool_setpoint`; writing a setpoint no longer sends ten
  times the value. Sensors report `temperature`, `humidity` … by their unit.
  Barrier doors read 0 or 100; leak sensors read the same from events as from
  a full read.
- **Lutron and Caséta:** `brightness_pct` only; `occupied` only (`occupancy`
  is gone); fades are `transition_ms`, sent in fractions of a second. `on:
  true` brings back the last level rather than 100 % (and Caséta fans no
  longer go to 50 %). A Lutron scene reports `active` instead of `on`; a
  contact input reports `cci_N_open` true/false instead of `cci_N`
  "open"/"closed". Caséta no longer reports unknown occupancy as vacant.
- **YoLink:** `battery` → `battery_pct`, `humidity_pct` → `humidity`, a
  lock's `door_open` → `open`; temperatures °C (the plugin's temperature-unit
  setting is gone). A temperature-only probe now reports.
- **Ecowitt:** the same reading has one name whether polled or pushed, in
  °C, hPa, m/s and mm (`rain_daily_mm`, `wind_gust` …); solar radiation is
  `solar_radiation` in W/m²; soil moisture `soil_moisture_pct`; leaks
  `water_detected`. An unreadable value is skipped instead of reported as 0.
  Some sensors keep one device id on both paths now, so a few get a new one.
- **Virtual thermostat:** `temperature`, `hvac_mode` and `hvac_action`
  (*heating*, *cooling*, *idle*, *off*); `sensors_stale` says the sensors went
  quiet. `setpoint` and `hvac_mode` can be written directly. **In °C.**
- **Sonos:** `media_title`, `media_artist`, `media_album`, `media_position`,
  `media_duration`; it reports *stopped*; `volume` and `muted` can be written
  directly. **Roku:** *muted* sets mute instead of toggling it.

Each plugin clears its old names from homeCore on its first start, so an
automation reading one fails visibly instead of reading a frozen value.

**Upgrade:**

1. **Before updating the virtual thermostat, change its config to °C** —
   for example `setpoint = 21.7` and `hysteresis = 0.5` for 71 °F and 1 °F.
   It refuses a setpoint outside −40 to 45 °C and will not start with a °F
   one.
2. **Before or after:** `core/scripts/vocabulary-rewrite.py --url
   http://HOST:8080 --user admin --phase now` shows the automation steps that
   can move to the new form with today's plugins (Lutron LED and scene steps,
   WLED's `preset`); add `--apply` to write them.
3. **Update the plugins.**
4. **Straight after:** run it again with `--phase plugins` for the renamed
   attributes (`humidity_pct` → `humidity`, a Lutron scene's `on` →
   `active`, …), then `--apply`. It never converts a temperature threshold;
   it lists any automation comparing one, to check by hand, since those were
   in °F.
5. Devices whose id changed (a few Ecowitt sensors) stop updating; remove the
   old ones.
6. The web app shows temperatures in °C until a release that converts to the
   unit you choose.

---

## v0.1.87 — 2026-10-19

**Theme:** WLED's screens now come with WLED, and plugins' screens can do more.

### WLED

- **Nothing to relearn.** WLED's plugin page, a controller's panel and the
  automation editor's WLED step look and work as they did — they now come
  with the WLED plugin itself, so they update with it, not with the app.
- **Names everywhere.** Each controller now tells homeCore the names of its
  presets, playlists, effects and palettes, so automations say “Halloween 1”
  — in the moments ("Eaves lights' preset becomes “Halloween 1”"), the checks
  and the steps — everywhere they are shown.
- **Firmware from a file** goes to the plugin through homeCore now; the
  plugin backs the controller up, sends the file and waits for it to come
  back, as before. A file that isn't a firmware image is turned away before
  anything happens to the controller.

### For plugin authors

- A plugin's screens can now also be the automation editor's form for steps
  on its devices (`rule.step`), and word those steps in automation sentences.
- `host` gained `upload` (send a file to one of the plugin's actions —
  `POST /plugins/{id}/upload/{action}`, up to 32 MiB), `store` (documents
  the app keeps for the plugin's screens), `fetch` (homeCore's API as the
  viewer) and each device's firmware version.
- A plugin that names a device's numbers in its schema (`options` on an
  integer attribute) gets those names in every picker and sentence with no
  screen of its own.
- The Python (0.5.0), Node.js (0.4.0) and .NET (0.4.0) SDKs can serve a
  plugin's own screens, like the Rust SDK (now 0.6.0, which also receives
  files sent to actions).

### Release matrix

**Tagged at v0.1.87:** `homeCore` (core), `hc-wled` 0.1.19. The Rust plugin
SDK is 0.6.0. The web app, `ghcr.io/homecore-io/hc-web-svelte`, is released
separately as v0.1.18. Python SDK v0.5.0, Node.js SDK v0.4.0, .NET SDK v0.4.0.

### Upgrade notes

- **Update core, the web app and WLED together.** The app no longer contains
  WLED's screens: with an older WLED, its controllers show the generic
  screens until WLED 0.1.19 is installed (Plugins → WLED → Update). An older
  core drops WLED's automation step form and can't take a firmware file.
- Automations, presets and controllers are untouched.

---

## v0.1.86 — 2026-10-19

**Theme:** plugins can bring their own screens. Ecowitt is the first.

### Ecowitt has its own page

- **The Ecowitt plugin's page** now shows:
  - whether the gateway is reporting, and where its uploads go — it says so
    when they go to a port the plugin isn't listening on, and offers to point
    them here;
  - the weather now: outside, the wind on a compass, rain, and sky and air;
  - every sensor with its reading, its battery in the right terms for its
    kind (OK/low, volts or level), and when it was last heard;
  - "What the gateway hears": each paired sensor's signal, on demand;
  - the plugin's settings.
- **The weather station's panel** (open the station from any page) shows the
  weather now, the last day of temperature, wind and pressure, and the other
  sensors on the same gateway.

### For plugin authors

- A plugin can carry web components — a page for itself, a panel for its
  devices — beside its program, and serve them itself. homeCore passes the
  files to the web app and keeps none, so the screens are always the ones the
  running plugin carries, however it was installed (registry, file, source
  build, plugin runtime). Rust SDK 0.5.0: `with_ui_dir`. The `host` interface
  the app hands each component is described by `@homecore/plugin-ui`
  (`core/sdk/ui`); `plugins/hc-ecowitt/ui` is a complete example.
- A plugin's release packs its `ui/` folder into its package when it has one.

### Release matrix

**Tagged at v0.1.86:** `homeCore` (core), `hc-ecowitt` 0.1.18. The Rust
plugin SDK is 0.5.0. The web app, `ghcr.io/homecore-io/hc-web-svelte`, is
released separately as v0.1.17, which shows plugins' own screens.

### Upgrade notes

- **Update core, the web app and Ecowitt together** for the new screens.
  Any one alone changes nothing you can see: an older app or an older core
  shows the screens as before, and an older Ecowitt carries none.
- Nothing about Ecowitt's readings, devices or automations changes.

---

## v0.1.85 — 2026-10-18

**Theme:** WLED controllers in full, plugins that raise alerts, and
automations that act on alerts.

### WLED

- **Changes made outside homeCore now show up.** Since newer WLED firmware,
  the plugin couldn't read the controller's description at start, took it for
  unreachable and polled every 30 seconds; and the live connection it should
  have used was never read anyway. Both are fixed: a change made in WLED's
  app, on a button or by another WLED reaches homeCore at once.
- **Everything WLED does, from its device page:** every segment (split, join,
  add, delete, their LEDs, grouping, direction, white temperature), each
  effect with only the controls it uses — named as WLED names them — colours
  and palettes drawn in their colours, presets and playlists by name (save,
  rename, delete, the preset at power-on), nightlight, sync with other WLEDs,
  live data, sound, the controller's own timers and LED outputs, backups,
  restoring them, and copying presets between controllers.
- **Firmware updates.** homeCore looks for new firmware for each controller's
  own board (daily, from WLED's GitHub releases, on the channel you choose),
  shows it on the System page, and installs it — from GitHub or a file you
  choose — backing the controller up first and checking it came back on the
  new version. "Update all" goes one controller at a time.
- **Several controllers:** the plugin page lists them with the address each
  is reached at (which can now be changed there), finds new ones on the
  network, adds one by address, and removes one.
- **Rules name presets and playlists** — "when the eaves start preset
  Halloween 1", "only if the garage is running Halloween Solid" — and a WLED
  step sets a preset, a playlist, a look, the nightlight, power or sync, on
  one controller or several (a preset is matched by name on each).
- **Reboot from the plugin page reaches one controller** when you say which;
  it used to restart every one.

### Alerts

- **Plugins raise alerts about their devices** — WLED's: a firmware update
  is out, one is being installed, one failed, a controller restarted by
  itself. Each kind is listed in Settings › Alerts, to turn off or send to a
  notification channel. An alert can carry a button ("Update…"), and a single
  one can be skipped ("skip 17.0.0") without silencing its kind. A plugin's
  alert is never critical.
- **Automations can start on, check and act on alerts:** when one is raised,
  clears, is seen or has lasted a while; only if one is (or none is) active;
  and press its button, wait for it to clear, mark it seen, skip it, or
  ignore alerts like it for a while — for each such alert, one at a time.
  `{alert.device}`, `{alert.key}` and friends fill in a message.

### Plugins

- **A plugin's action no longer stalls the plugin** while it runs. A long one
  (a firmware install waiting for its controller) used to stop the plugin
  hearing anything, keep-alives included.
- **Read-only plugin information is open to anyone who can see devices**
  (`POST /plugins/{id}/query`), so a household member's screen shows a WLED's
  effect names as an admin's does.

### Release matrix

**Tagged at v0.1.85:** `homeCore` (core), `hc-wled` 0.1.16. The Rust plugin
SDK is 0.4.2 (alerts). The web app, `ghcr.io/homecore-io/hc-web-svelte`,
is released separately as v0.1.14, which uses all of the above.

**App v0.1.15 (2026-10-19)** follows with no core change: the WLED plugin's
page now leads with its controllers instead of a list of the plugin's raw
actions, lists the backups the plugin keeps (put a controller's presets or
settings back, or download one), and has the plugin's few settings —
where the effect catalogue lives, polling, which firmware to offer, and
controllers on other networks — on the page itself.

**hc-wled 0.1.17 and app v0.1.16 (2026-10-19)** follow, again with no core
change. Update WLED from the registry, then the app:

- **Install WLED updates by itself, at night** — a choice on the WLED plugin
  page and in Settings › Alerts. It writes an ordinary automation, *Install
  WLED updates at night*, which you can open and change: at 03:00 it installs
  each waiting update in turn, and stops and tells you if a controller doesn't
  come back within ten minutes. It turns on the "Firmware update available"
  alert, which it acts on. Off unless you turn it on.
- **A controller's own setup, in full:** sound (gain, ignore-below, automatic
  gain, smoothing, sound sync, the microphone); timers at a time or at
  sunrise/sunset with an offset, on chosen days and dates; buttons (what a
  press, long press and double press do), the IR remote; its name and
  address on the network, moving it to another Wi-Fi network, its own access
  point; and its clock. Hardware and network changes restart the controller
  and ask first — a wrong address or Wi-Fi password takes it off the network
  until it is fixed from its own access point.
- **Segments:** drag a boundary on the strip, or move it with the arrow keys.
- **Presets:** copy one preset to another controller, or duplicate it.
- The IR receiver's and microphone's pins were shown hidden, as if secret;
  they are now shown and can be changed.

The plugin SDKs for Python (0.4.0), Node.js (0.3.0) and .NET (0.3.0) can now
raise alerts, as the Rust SDK has since 0.4.2.

### Upgrade notes

- **Update WLED to 0.1.16 with core**, from the registry as usual. Older
  plugins work with this core unchanged.
- **WLED's "firmware update available" alert is off until you turn it on**
  (Settings › Alerts); the System page lists updates either way.
- Rules that set a WLED's preset, effect or palette by number keep working.
- If you put the web app behind your own proxy, let requests of a few
  megabytes through to it, for installing firmware from a file.

---

## v0.1.84 — 2026-10-18

**Theme:** Keys and sign-outs that mean what they say, rules that can ask
more, and plugins that say what's dangerous.

### Security

- **An API key can't make or change keys any more** unless it was given
  `api_keys:admin`. Before, any key — a wall tablet's display key included —
  could make itself a new key with everything its owner's role allows, widen
  itself, or drop its address fence. A key made by anyone also never gets
  more than the person or key making it holds.
- **Logs are for admins** (`GET /logs`, `/logs/stream`). Before, any
  signed-in person or key, a display included, could read them.

### Signing in

- **Signing out ends the session in homeCore, at once** (new
  `POST /auth/logout`, used by the app). Before, signing out only forgot the
  browser's cookies, and the session kept working.
- **Ending a session from another device takes effect at once**, not when its
  access token ran out (up to a day). This holds across a restart.
- **The sessions list marks the one you're using** (`current`).

### Automations

- **An if/otherwise can ask anything a rule's own checks can**: a calendar, a
  house value, a private boolean, time since a change, who changed it last.
- **Testing a rule answers house-value and calendar checks** instead of
  saying no; a private boolean says it can't be told in a test.
- **Rules paused by another rule can be seen and resumed**
  (`GET /automations/paused`, `DELETE /automations/{id}/pause`).
- **"Use the value that started it" works.** A step sent the bare reading
  (`true`) as the whole command, which a device couldn't use; it now sends it
  under the step's setting (`{"on": true}`), so one device can follow another.
- **Starting a timer keeps its own length and its "start again"** unless the
  start says otherwise. A rule's longer start no longer replaces the timer's
  own length.
- **Every calendar moment of a rule counts**, not only the first.
- **A threshold helper is re-checked when its line changes**, not at the next
  reading.

### Notifications, backups, the broker

- **Pushover "Emergency" works.** It needs how often to repeat and when to
  stop, which homeCore never sent, so every emergency message failed. New
  `retry` (default 60 s) and `expire` (default 1 h) on a Pushover channel.
- **A kept backup can be put back where it is**
  (`POST /system/backups/{name}/restore`; Data & backups › Put back…),
  without downloading and uploading it.
- **The MQTT v5 listener can be turned off**: `[broker] v5_port = 0`. The
  form said "empty = off", but empty meant 1884.
- The "Serve the bundled UI" switch is gone from the form: it did nothing
  without a folder the form doesn't offer. `homecore.toml` still takes both.

### Live updates

- **A screen that falls behind is brought up to date.** One too slow to keep
  up used to miss changes silently until it reconnected; it is now sent the
  house as it stands.

### Plugins

- **A plugin can mark an action dangerous**, and a screen asks first. Marked:
  WLED's reboot (every strip), Ecowitt's gateway reboot, Z-Wave's exclude,
  Hue's unpair and clean-up, Roku's forgetting stale devices.
- **WLED effects and palettes by name** — WLED publishes their names and
  offers "Choose an effect" / "Choose a palette".
- **The thermostat's actions start from its current setpoint and mode.**

### Release matrix

**Tagged at v0.1.84:** `homeCore` (core), `hc-wled` 0.1.15,
`hc-thermostat` 0.1.14, `hc-ecowitt` 0.1.17, `hc-hue` 0.1.18, `hc-roku`
0.1.11, `hc-zwave` 0.1.14. The web app, `ghcr.io/homecore-io/hc-web-svelte`,
is released separately (v0.1.13 uses the above, and also: a password reset
for someone else works again, readers of the audit and plugins can open
them, calendars for anyone who makes rules, house values on the automations
list, and plugin fields keep their names and help).

### Upgrade notes

- **Anything that read logs without being an admin** gets 403 now. Use an
  admin's key for it.
- **A script whose key makes or changes keys** needs `api_keys:admin` on it.
- **Sessions signed in before the upgrade** can't be ended at once: they
  carry no session id. They still end when their access token runs out;
  signing in again gives a session that can.
- Plugins update from the registry as usual; core works with the old ones.

---

## v0.1.83 — 2026-10-18

**Theme:** Backups homeCore makes by itself, a list of where you're signed
in, and a newer Rust toolchain.

### Backups

- **homeCore backs itself up once a day.** Each backup is the same file
  **Back up now** gives you, kept in `backups/` in homeCore's home
  (`/homecore/backups` in the container, so on the `homecore-data` volume).
  The newest 7 are kept, and older ones are deleted. How often, how many
  and the folder are under Configuration › Backups (`[backup] every_hours`,
  `keep`, `dir`). `every_hours = 0` turns the schedule off.
- **A restart doesn't add a backup.** The next one is due a full interval
  after the newest one already in the folder.
- **Each one counts as a backup**: it's in the audit like one you take, so
  "Last backup" on Data & backups includes it.
- **The kept backups can be listed and downloaded** (`GET /system/backups`,
  `GET /system/backups/{name}`; Settings › Data & backups). Admins only.
- They sit on the same disk as homeCore. Keep a copy somewhere else as well.

### Signing in

- **See where you're signed in** (`GET /auth/sessions`; Me › Signed in):
  each browser or app, since when, and when it was last used.
- **Sign one out** (`DELETE /auth/sessions/{id}`), or **sign out
  everywhere** (`POST /auth/sessions/end-all`). Signing out everywhere ends
  every session of yours at once, including the one you're using. Both are
  recorded in the audit.
- Sessions started before this release don't know their browser or start
  time. They show what they can until they next sign in.

### Under the hood

- **Rust 1.99.** CI, the container and the release binaries (core and
  plugins) are all built with Rust 1.99 now. Before, CI and the container
  used 1.95, and release binaries used whatever was newest that day. The
  container's base is Alpine 3.24 (was 3.23).
- No other change you'd see.

### Release matrix

**Tagged at v0.1.83:** `homeCore` (core). The web app,
`ghcr.io/homecore-io/hc-web-svelte`, is released separately. App v0.1.12
uses the above: the backup schedule and list on Data & backups, and Signed
in on Me. It also, by itself:

- tells an admin on the System page when a newer homeCore or app is out.
  The app's server asks GitHub at most every six hours; homeCore never
  does. `HC_UPDATE_CHECK=off` on the app's container turns this off.
- offers every option a device action takes.
- adds number and colour controls (WLED).
- lists a plugin's own devices in its settings.
- keeps screens up to date as they change.
- shows each person only what their role lets them use.

### Upgrade notes

- **Backups start by themselves.** The first is made when homeCore starts
  after the upgrade, then one a day. Each is about the size of the state and
  history files together, times the 7 kept. Set `[backup] every_hours = 0`
  if you don't want them.
- Nothing else to do.

---

## v0.1.82 — 2026-10-18

**Theme:** Removed devices stay removed, helpers and modes that can be
changed fully, and the old ways of making timers and switches gone.

### Devices

- **A plugin device you delete stays deleted.** It used to come back the
  next time its plugin reported it. homeCore now remembers it: its plugin
  reporting it again — registering it, its state, its availability — doesn't
  bring it back. A new list (`GET /devices/removed`; Settings › Devices ›
  Removed) has **Bring back**, after which it returns on its plugin's next
  report, with its recorded history. Helpers and modes aren't remembered —
  nothing reports them.
- **Replace a device in every rule at once** (`POST /automations/repoint`):
  for a sensor swapped for a new one, or one deleted. Rules turned off only
  because the old device was deleted are turned on again.

### Helpers and modes

- **A schedule's blocks can be changed** after it's made. They're checked
  (days, and two times) and the schedule is worked out again at once.
- **Changing a helper is announced** like any device change, so every open
  screen shows it as it now is.
- **Deleting a helper** (`DELETE /glue/{id}`) turns off the rules that name
  it and says which, as deleting a device does. It now refuses anything
  that isn't a helper; before, it would delete any device and leave its
  rules as they were.
- **Helpers and modes have their name for rules as soon as they're made**,
  not after the next restart.
- **A sun-following mode's events can be changed** (`PATCH /modes/{id}`:
  `on_event`, `off_event`, offsets), and new ones made without editing
  `modes.toml`. Moving an offset now updates the mode's on and off times at
  once, rather than at the next sunrise or sunset.

### Automations

- **Hub variables can be listed** (`GET /automations/variables`).
- **The audit can pick out a kind**: `event_type=auth.*` is every sign-in
  kind and `!auth.*` everything else.

### Plugins

- **Turning on a plugin that has stopped running starts it.** Before, a
  plugin that crashed while on stayed down unless restarted.
- **A plugin version needing a newer homeCore isn't installed** — homeCore
  says which it needs — and installing with no version picks the newest
  that runs here.

### Settings file

- A new notification channel is written with its name and type first,
  rather than its fields in alphabetical order, and homeCore no longer
  writes an empty `[notify]` section of its own.

### Removed

- **The `core.timer` and `core.switch` kinds, and the `/timers` and
  `/switches` endpoints.** Timers and switches are helpers, made and listed
  with `/glue` (`{"type": "timer", …}`), as they have been since helpers
  were added; the startup step that converted old switches is gone with
  them. `hc-tui`'s timer and switch screens used those endpoints and no
  longer work; it is being rewritten.

### Release matrix

**Tagged at v0.1.82:** `homeCore` (core). The web app,
`ghcr.io/homecore-io/hc-web-svelte`, is released separately (v0.1.11 uses
the above: removed devices, schedule editing, mode sun events, repointing,
the audit's kinds, hub variable suggestions, starting a stopped plugin).

### Upgrade notes

- **Anything that made timers or switches with `/timers` or `/switches`**
  must use `/glue`. Nothing in the house's apps but `hc-tui` did.
- **A device deleted before this release** isn't remembered — if its plugin
  still reports it, it's back already; delete it again to keep it out.
- Nothing else to do.

---

## v0.1.81 — 2026-10-18

**Theme:** Alerts you can answer, rules you can run, and displays that only
use the house.

### Alerts

- **Seen.** Anyone who may use the house — a display included — can mark an
  alert as seen. It stays, marked with who and when, until its condition
  ends; if it comes back, it's new again. homeCore keeps this in memory, so
  after a restart an alert that is still true shows as unseen.
- **Ignore.** An admin can stop showing some alerts: one kind on one device
  (low battery on the hall sensor), every one of a kind (every low battery),
  everything about a device, or one rule's — for good, or until a time. What
  an ignore covers clears at once, isn't raised while it lasts, and isn't
  sent anywhere; a low battery it covers isn't sent by `[battery]
  notify_channel` either. Ignores are kept, and listed until removed.
- **Notifications.** A time rule can name a channel (or `all`) to tell when
  one of its alerts is raised. Something wet, smoky, jammed or offline is
  sent to the new **`[alerts] notify_channel`** (in Configuration › Alerts);
  a low battery still goes to `[battery] notify_channel`. Nothing is sent on
  homeCore's first look after it starts, so a restart doesn't resend every
  alert that is already true.
- **Readings over or under a line.** A time rule can watch a number — a
  freezer above −10 °C, humidity above 80 % — as well as a state, and can say
  "isn't". "For at least" counts from when the reading first crossed the line.

### Automations

- **Run a rule now**, as if its moment came — even while it's off, paused or
  resting. Its checks still decide unless you ask to skip them. The run is in
  its history as a manual run, with who asked.
- **Test a rule at another time.** A dry run can judge the checks as if it
  were, say, 22:30 tomorrow: time windows and "how long" checks move to then,
  devices and modes stay as they are now, and a script still reads the real
  clock (the result says so).

### Modes, displays, timers

- **A mode can be renamed.** Its id — and so every rule that uses it — stays.
- **A display can be renamed.** Its key, and the tablet using it, carry on.
- **A timer can be given more time** while it runs or is paused
  (`{"command": "extend", "duration_secs": 300}`); a repeating timer's next
  cycle is its usual length.

### Plugins

- **A plugin's log level stays changed.** Setting it is now written to
  `[logging] level` in the plugin's own settings, so it starts at that level
  next time. (A plugin running on another runtime keeps its file there; for
  it, the change still lasts until it restarts.)
- homeCore now sends **`plugin_offline`** when a plugin goes offline. The
  event existed but was never sent.

### Fixed

- **A timer that was paused and resumed** worked out how much time it had
  left from its full length, so it read wrong — and came back wrong after a
  restart — until it finished.

### Security

- **Displays can no longer rename, move or delete devices**, or restart
  homeCore. They were given more than they needed (`devices:write`); they now
  hold `devices:command` — they still control devices and run scenes. This
  applies to displays made before this release too, without remaking them.

### Release matrix

**Tagged at v0.1.81:** `homeCore` (core). The web app,
`ghcr.io/homecore-io/hc-web-svelte`, is released separately (v0.1.10 uses the
above: seen and ignored alerts, readings and channels in alert rules, run
now, test at a time, renaming modes and displays, more time on a timer).

### Upgrade notes

- **A display that renamed, moved or deleted devices** (none of the house's
  apps do) is refused now (403).
- To have wet, smoke, jammed and offline alerts sent somewhere, set
  **Configuration › Alerts › Notify channel**. Until then they're shown, not
  sent, as before.
- Nothing else to do.

---

## v0.1.80 — 2026-10-17

**Theme:** API keys kept to where they're used, and the last settings the
form couldn't reach.

### API keys limited by address

A key could always be given a list of addresses it may be used from, but
homeCore never checked it. It does now: a key with a list is refused (403)
from anywhere else — on the API and on the live event and log streams. A
list homeCore can't read refuses the key rather than letting it through, and
an entry that isn't an address or a network (`10.0.10.0/24`, `192.168.1.7`)
is turned down when the key is made or changed.

The address is the one homeCore sees. A program that reaches homeCore through
the web app is seen at the web app's address.

### Settings

- **Per-module log levels** (`[logging.targets]`, e.g. `hc_core = "debug"`)
  are in the settings form, under Logging → Per module. Before, they could
  only be changed in the file.
- **A setting can be taken out** through the API: a patch that sends `null`
  for a key removes it from the file (homeCore's settings and plugins'
  alike). It's how the form removes a per-module level.

### Calendars

- The calendar list says **how often a fetched calendar is fetched again**.
- **Deleting a calendar names every rule that uses it** — rules that only
  check "is there an event now?" as well as those it starts. Before, only the
  second kind were listed.

### Fixed

- A calendar fetched through the API said it was never fetched again until
  homeCore restarted, though it was.

### Documentation

- The API reference now says webhooks need no sign-in (the address is the
  secret) and answer 200, which is what they have always done.

### Release matrix

**Tagged at v0.1.80:** `homeCore` (core). The web app,
`ghcr.io/homecore-io/hc-web-svelte`, is released separately (v0.1.8 uses the
above: address limits on keys, per-module log levels, calendar refresh).

### Upgrade notes

- **Check any API key that has an address list.** It was ignored before and
  is enforced now; a key used from an address not on its list stops working.
  A key without a list is unaffected. `hc-cli` shows a key's list.
- Nothing else to do.

---

## v0.1.79 — 2026-10-17

**Theme:** Calendars that repeat the way they're written.

### Repeating calendar events

homeCore used to repeat only **yearly** events (holidays). A weekly bin day, a
school day or a fortnightly recycling collection was kept only at its first
date, so rules asking "is there a calendar event now?" or waiting for one
missed every later occurrence.

Now every repeat in an `.ics` file is followed:

- Daily, weekly, every other week, monthly — by date or "the second Tuesday" —
  and yearly, with counts and end dates.
- Dates the calendar skips, extra dates it adds, and single occurrences moved
  or cancelled.
- Times in their own time zone; a time with none, and all-day dates, in the
  house's. A weekly 07:00 stays 07:00 when the clocks change.

### Fixed

- **An all-day event is active all day.** A calendar reloaded after midnight
  dropped that day's all-day event, so "bin day today" stopped being true at
  00:01. Events already under way are now kept.
- **All-day events start at the house's midnight**, not midnight UTC (8 p.m.
  the evening before, in New York).

### Release matrix

**Tagged at v0.1.79:** `homeCore` (core).

### Upgrade notes

- **A calendar trigger on an all-day event fires at the house's midnight**
  (plus any offset), where before it fired at midnight UTC. Check any rule
  that runs "N minutes before" an all-day event.
- Calendars with repeating events now have many more events; nothing to do —
  they are read again when homeCore starts or the file changes.

---

## v0.1.78 — 2026-10-17

**Theme:** What the new web app needs to run the house — and a record of who
changed what.

### Automations

- **A rule can start at several moments.** Besides `trigger`, a rule may list
  more in `triggers`; any of them starts it. Its history says which one did.
- **"If / otherwise" steps can check the house directly** — a device's state,
  a mode, a time window, and And/Or/Not of those — as well as with a Rhai
  expression as before. Together these let a pair of rules ("turn on when…",
  "turn off when…") become one.
- **Changes to rules are announced** on the event stream (`rule_changed`,
  `rule_removed`), so every open screen updates when a rule is edited
  elsewhere.
- **A draft can be tested before it's saved** (`POST /automations/test`).

### Plugins

- **Turning off a plugin installed from the registry now stays off** — across
  a restart of homeCore, and through an update. Before, both turned it back on.
- homeCore now says when a plugin **comes back online**, not only when it goes
  away.
- Saving a plugin's settings from the web app changes only what changed: the
  file keeps its comments and layout, and a masked password sent back unchanged
  is left alone. Lists in a settings file (the thermostats, say) are edited in
  place.

### People and access

- **A household-member role.** Family members can use every device and run
  every scene, see alerts and set up their own Home — and change nothing
  shared: no renaming or deleting devices, no rules, rooms, settings, plugins
  or people. It comes with a new permission, `devices:command`, for using a
  device without being able to rename or delete it.
- **Changing someone's role signs them out everywhere**, so the new role
  applies at once. Their own API keys lose anything the new role doesn't allow.
- **Removing someone revokes their API keys.** Before, a removed person's keys
  kept working. Display keys they made are the house's and stay.
- **The house always keeps an admin**: the only admin can't be demoted or
  removed.
- **An admin can clear a forgotten PIN** (`DELETE /auth/users/{id}/pin`); the
  person then chooses a new one.

### The audit records changes

The audit used to hold sign-ins, accounts and API keys. **It now records every
change made through the API to how the house works** — rules, devices,
helpers, modes, rooms, scenes, alert rules, plugins and the log level — with
who made it and what it was called at the time, so a removed rule or room can
still be told apart. Setting values are never recorded, only which settings
changed (and on/off).

### Backup and restore

- **Restore no longer writes over homeCore's databases while it runs.** That
  could leave the house half restored if anything failed partway. Now a backup
  can be checked first (`POST /system/restore?check=true` says what it would
  put back), and restoring stages it: **homeCore puts it in place at its next
  start**, before it opens anything. Restart homeCore to finish a restore.
- Backups now include **calendars**, and record when they were taken.

### Fixed

- After a calendar was added or uploaded, homeCore **reloaded the calendar
  folder five times a second for as long as it ran**, filling the log. Its
  own reading of the files set off the next reload.

### Release matrix

**Tagged at v0.1.78:** `homeCore` (core). The new web app,
`ghcr.io/homecore-io/hc-web-svelte`, is released separately.

### Upgrade notes

- **Finish a restore with a restart.** `POST /system/restore` now stages the
  backup; nothing changes until homeCore restarts. Anything that restored and
  expected the house to change at once must now restart homeCore (the Flutter
  console already says to).
- **Changing someone's role now signs them out**, on every device.
- **Removing someone revokes their API keys.** If a script runs on a key made
  by someone you remove, make it a new key first.
- Existing roles gain `devices:command` and `scenes:run` alongside what they
  had; existing API keys are unchanged.
- **Rules that use several moments or checks in if/otherwise can't be read by
  an older homeCore** — keep a backup before downgrading.
- **Update hc-tui** if anyone has the household-member role: older versions
  can't list people once one exists.
- The audit grows faster now that it records changes; `[auth]
  audit_retention_days` (default 365) still governs how long it keeps them.

---

## v0.1.77 — 2026-10-16

**Theme:** A tablet on the wall that isn't anybody.

### Security: API keys are no longer admins by default

homeCore treated **every API key as an admin** in its admin-only checks —
managing users, backup and restore, reading and changing the system's
configuration, restarting — whatever scopes the key was given. A key made to
only read the house could, for example, create users.

Now a key is an admin only if it was given an admin's scopes (it holds
`users:write`). **Keys made with an admin's full scopes work as before.** A
narrower key that was being used for admin tasks will now get `403` for them;
give it the scopes it needs, or use an admin's full set.

### Displays

A kitchen panel or hall tablet can now be **its own identity** instead of
somebody's account. An admin makes a display (`POST /api/v1/displays`, or
Settings → Displays in the new web app) and is shown its key once; the tablet
is set up with that key. A display can see the house, use devices and run
scenes — and nothing else: it can never be an admin, edit anything, or manage
users or keys. Removing it (`DELETE /api/v1/displays/{id}`) stops it at once.

Running scenes now also accepts a new, narrower `scenes:run` scope, which
displays hold, so a panel can run scenes without being able to change them.
People and keys with `scenes:write` are unaffected.

### PINs

Each person can set a **PIN** (`PUT /api/v1/auth/pin`, with their password; 4
to 8 digits, and no two people can share one). At a display, a PIN unlocks
the full app as that person for **five minutes**, then the display goes back
to being itself. Only a display can be unlocked with a PIN, and five wrong
PINs in fifteen minutes make that display wait.

### Release matrix

**Tagged at v0.1.77:** `homeCore` (core).

### Upgrade notes

- **Check any API key you use for admin work** (scripts, other tools): if it
  was made with fewer than an admin's scopes, admin endpoints now refuse it.
- Nothing else to change. Nobody has a PIN until they set one, and there are
  no displays until an admin makes one.
- Whitelisted addresses (`[auth].whitelist`) are unchanged — but a display
  key is the better way to put a tablet on the wall: a whitelisted address is
  a full admin.

---

## v0.1.76 — 2026-10-16

**Theme:** homeCore says what needs attention.

### Alerts

homeCore now keeps a list of what needs attention in the house, and every
client sees the same one. It is worked out by homeCore itself, so it is right
whether or not any screen is open, and it clears itself when the problem goes
away. These are always alerts:

- **something wet** or **smoke** (shown as urgent);
- **a lock jammed** — where the lock says so (`jammed`, or a last alert that
  mentions a jam);
- **a battery low**, using your `[battery]` threshold and recover band;
- **a device offline** for five minutes — long enough that a bridge
  restarting doesn't raise one for everything behind it.

**Time rules** add the ones that depend on the clock: "the garage door open
after 22:00", "the front door unlocked for 30 minutes". A rule names one or
more devices, the state that counts, optionally the hours it applies (a
window can run past midnight) and how long the state must have lasted. How
long something has been open is remembered across a restart. Rules are made
in the new web app's Settings → Alerts, or over the API.

For client authors: `GET /api/v1/alerts` lists the active alerts (most
serious first); `/api/v1/alert-rules` holds the rules; the event stream
announces `alert_raised` and `alert_cleared`, and its `?snapshot=true` frame
now includes `alerts`. Reading alerts needs `devices:read`; rules need
`automations:read` / `automations:write`, like automations.

### Release matrix

**Tagged at v0.1.76:** `homeCore` (core).

### Upgrade notes

- Nothing to change. Expect a few alerts as soon as it starts if anything is
  already wet, jammed, offline or low on battery — devices that only report
  "battery low" without a percentage count too.
- Alerts do not send notifications. To be told on your phone, keep using an
  automation with a notify action; alerts are what screens show.
- Existing clients see no difference unless they ask for alerts.

---

## v0.1.75 — 2026-10-16

**Theme:** A room stays the same room.

### Renaming a room sticks

A room used to be only its short name (`tv_room`), so renaming it made a
different room — anything that remembered it, like a pinned room in a client,
lost it — and the rename did not last: the next time the Hue bridge registered
its devices it said "Tv room" again, and they went back.

Now each room has an id that never changes, and keeps its name exactly as you
type it — "TV Room", "Kid's Room". Rename it and the devices stay in it. Its
old name keeps working behind the scenes, so a bridge that still calls it
"Tv room" puts its devices in the renamed room instead of bringing the old one
back.

A room a bridge reports that you do not have yet is still created
automatically, spelled the way the bridge spells it. Deleting such a room only
lasts until the bridge reports it again; to fold it into another room for
good, **merge** it (`POST /areas/{id}/merge`) — its devices move, and the
bridge's name for it points at the room you merged it into from then on.

### Every open screen hears about edits

Renaming a device, moving it to another room, changing its icon or display
type, adding or removing devices, and changing rooms or scenes used to be
saved without telling anybody — a wall panel kept showing the old name until
it was reloaded. They are now all announced on the event stream
(`device_added`, `device_metadata_changed`, `device_removed`, `room_changed`,
`room_removed`, `scene_changed`, `scene_removed`).

A client can also ask the stream for the whole house when it connects
(`?snapshot=true`), so after a dropped connection it catches up in one step.
Existing clients do not ask for it and see no difference.

### Fixes

- **The event stream honours who you signed in as.** From an address on the
  `[auth].whitelist`, the stream treated everybody as admin even when they had
  signed in as someone else; the REST API never did. Now a sign-in always
  counts, on both.
- **Assigning a room to several devices at once now sticks.** It was being
  undone the next time their plugin registered them.

### Release matrix

**Tagged at v0.1.75:** `homeCore` (core).

### Upgrade notes

- **Rooms are converted once, on the first start.** Every room keeps the id it
  had, and gets a readable name from its short one: `tv_room` becomes
  "Tv Room", `bathroom_2` "Bathroom 2". Where a bridge has its own spelling
  ("Master Bedroom"), that replaces the guess when the bridge next registers.
  Names you type are never replaced. Rename any you want to look different.
  **Take a backup before upgrading**, as for any change to stored data.
- `GET /areas` now returns the name as typed in `name`, plus `slug` (the
  short form devices carry), `aliases` and `named_by`. A client that treated
  `name` as the short form should use `slug`. hc-web and hc-tui show names
  much as before.
- Rules are unaffected: they refer to devices by names assigned once, which a
  room rename does not change.

---

## v0.1.74 — 2026-09-10

**Theme:** How long has it been like that?

### "Clear for 40 minutes" is answerable now

Every device carried a `last_change` timestamp that looked like it said when
the device last changed. It did not — it said when homeCore last *heard* from
it, which for a sensor reporting every few seconds is always "a moment ago".
An occupancy sensor clear since breakfast looked like it had just gone clear.

`attributes_changed_at` records when each reading last actually moved, and it
survives a restart, so a wall panel that rebooted overnight does not tell you
the whole house changed at 3am. It is **per reading**, which matters: asking
how long a room has been clear should not be reset by the same sensor's
battery percentage ticking over.

The old field keeps its job — it answers "what turned that on?", which is a
different and equally useful question.

Automations get the same fix: a rule saying "no motion for 20 minutes" could
not become true until 20 minutes after a restart. It can now.

### A Hue sensor's temperature said °C and meant °F

If you have your Hue bridge set to Fahrenheit, the motion sensor's temperature
was labelled °C while reporting °F — so 71 °F read as 71 °C, which is 160 °F.
The label now follows what the device says it is using.

### Release matrix

**Tagged at v0.1.74:** `homeCore` (core), `hc-hue` 0.1.17.

### Upgrade notes

- **Nothing to do.** `attributes_changed_at` fills in as devices report; a
  reading that has not moved since the upgrade simply has no entry yet, and a
  client should fall back rather than assume.
- Restart hc-hue, or press *Refresh devices*, for the temperature label.

---

## v0.1.73 — 2026-09-10

**Theme:** Every device says exactly what it shows you.

The end of a run that started with 82 of 178 devices publishing at least one
attribute nothing described. This release takes it to none.

**Timers** publish when they started and, if you named the countdown, that
name. Both are now labelled, and both sit with the housekeeping rather than
beside the time remaining.

**Rokus** publish eleven facts about the box itself — model, serial, firmware,
the network it is on — lifted out of a nested blob so an automation can ask
"is this a TV?" without picking through JSON. They are labelled and folded
away now, while the channel that is playing stays where you can see it.

Earlier in the run: Hue's lights, scenes and bridge (v0.1.71–72), Lutron's
keypads, dimmers and scenes, and Sonos's now-playing and catalogues (their own
plugin releases).

### Release matrix

**Tagged at v0.1.73:** `homeCore` (core), `hc-roku` 0.1.10.

### Upgrade notes

- **Restart hc-roku** or press *Discover devices* on it; core's own timers
  update on the next tick.
- Nothing renames and nothing disappears — the same attributes, with labels
  and with the housekeeping marked as such.

---

## v0.1.72 — 2026-09-10

**Theme:** Two things v0.1.71 missed, found by running it.

**A value already stored stayed stored.** v0.1.71 stopped homeCore's own
bookkeeping arriving as a device reading, and said existing ones would clear
on the device's next report. That was only true for a plugin that publishes
its whole state each time; one that publishes changes — which is most of them,
and hc-wled since 0.1.13 — would have carried it indefinitely. The keys are
cleared from what is stored now, so any device that reports again cleans
itself.

**The Hue bridge was the one device its own fix missed.** Lights and scenes
were filled in from what they publish; the bridge is registered on a different
path and kept showing its id, kind and name with nothing to label them. It
goes through the same filler.

### Release matrix

**Tagged at v0.1.72:** `homeCore` (core), `hc-hue` 0.1.16.

### Upgrade notes

- **Nothing to do.** Devices clean themselves as they report; the Hue bridge
  updates when the plugin restarts or *Refresh devices* is pressed.

---

## v0.1.71 — 2026-09-10

**Theme:** Every value a device shows you is a value something can name.

### Attributes nothing declared

Reading the reference house back after the September schema work: **82 of 178
devices published at least one attribute their own schema never mentioned.**
An undeclared attribute still shows up — as a raw name and a raw value, with
nothing to label it, rank it, or fold it away as housekeeping.

Two unrelated causes, both closed.

**Hue's hand-written schemas covered the controls and stopped.** A light
declared four attributes and published nineteen — the bridge and resource ids,
its capability flags, the colour-temperature bounds. A scene declared whether
it was active and published eight. They are all described now, and demoted
where they are not readings, so a light's page leads with brightness rather
than with the id of the bridge it is on.

**homeCore stored its own bookkeeping as if the device had reported it.** A
WLED controller carried a `correlation_id` among its readings — homeCore's
term for "which command caused this", presented as something the light strip
had said. Provenance is stripped from device state now.

### Release matrix

**Tagged at v0.1.71:** `homeCore` (core), `hc-hue` 0.1.15.

### Upgrade notes

- **Restart hc-hue**, or press *Refresh devices* on it — either republishes the
  fuller schemas. The plugin gained that ability in 0.1.14 yesterday.
- Existing `correlation_id` values already stored on a device are cleared by
  v0.1.72 — this release stopped new ones arriving but left the stored ones
  alone, which showed up immediately on a plugin that publishes changes
  rather than whole states.
- Nothing that was working stops: every attribute still has the same name and
  the same value, and more of them now have a label.

---

## v0.1.70 — 2026-09-09

**Theme:** A Z-Wave device stops calling itself "Z-Wave".

### Every Z-Wave node had the wrong type

Every node this plugin registered carried `device_type: "zwave"` — the
protocol it speaks, not the thing it is. A door lock, four outlets, a door
sensor and a motion sensor all arrived indistinguishable, so any client
filtering a list by type, choosing an icon, or deciding which reading to lead
with had nothing to work from.

zwave-js had been sending the answer on every node the whole time. The plugin
now reads it, and on the reference network that means:

| Node | What it registers as now |
|---|---|
| Living Room lock | `lock` |
| Four outlets and a plug | `switch` |
| Test Door Sensor | `contact_sensor` |
| Test Motion Sensor | `motion_sensor` |
| The controller itself | `gateway` |

The two sensors are worth a note: Z-Wave describes both of them identically —
"Notification Sensor" — so the class alone cannot separate a door sensor from
a motion sensor. What separates them is that one reports a contact and the
other reports motion, so that is what the plugin reads when the class runs
out.

A node that has not finished its interview yet says nothing rather than
guessing, and fills its type in on the next registration.

### Modes had no type at all

The two devices in the reference house reporting no `device_type` were both
modes — the only device family registering without one. They are `mode` now,
and lead with whether they are on.

### Release matrix

**Tagged at v0.1.70:** `homeCore` (core), `hc-zwave` 0.1.13.

### Upgrade notes

- **Restart hc-zwave to see the change.** Types are set at registration, so
  nodes keep their old `zwave` type until the plugin reconnects and
  re-registers them.
- **A dashboard or rule that filters on `device_type == "zwave"` will stop
  matching.** Nothing in homeCore does this by default, but a hand-written
  filter might; point it at the real type, which is what it wanted.
- Modes gaining a type is additive — nothing filtered on "no type".

---

## v0.1.69 — 2026-09-09

**Theme:** A device's declaration can change, and now says so.

### For anyone building against the API

**`device_schema_changed` is a new event.** It fires when a device changes
what it *declares* — the attributes and actions it says it has — rather than
when a value changes. The event carries the names, so a client can decide
whether it cares before refetching `GET /devices/{id}/schema`.

This matters because device schemas are not static, and became less so with
the September schema work. A Lutron phantom scene upgrades its own about a
second after the bridge connects, once its LED query is answered. The Ecowitt
plugin republishes when a sensor's set of readings changes. Hue republishes
when a sensor gains a facet, Z-Wave on a rescan. Until now nothing announced
any of it: a client showing controls built from the schema kept the old ones
until somebody reloaded the page.

**The event stream's documented type list was eight of twenty-one.** It had
never included `device_name_changed`, and nothing added since. All twenty-one
are listed now, checked against the code that names them, so filtering by
`?type=` can be written from the spec rather than by experiment.

### Unchanged

Nothing an operator does changes here, and no device behaves differently.
This is an addition to the API surface for the people writing against it.

### Release matrix

**Tagged at v0.1.69 (1 repo):** `homeCore` (core). No plugin changed.

### Upgrade notes

- **Nothing to do.** A client that ignores the new event behaves exactly as
  it did; one that subscribes to everything sees a new `type` it can ignore
  or act on.
- Core-owned devices — timers, counters, modes — do **not** emit this event.
  They write their schemas when the device is created, which a client learns
  about by the device appearing.

---

## v0.1.68 — 2026-09-09

**Theme:** An API key is a credential for the whole API.

Two things an API key could not do, both found while working out how a
wall panel should authenticate. If you use API keys, this release
matters; if you only ever log in with a password, nothing here changes
what you see.

### A key opened no stream

`/events/stream`, `/logs/stream` and the media route take their
credential in a `?token=` query parameter, because a browser cannot set
a header on a WebSocket upgrade. All three validated it as a JWT, so an
API key worked for every REST call and silently for none of these.

A display authenticated with a key would load its dashboard and then
never hear another word from the house — a frozen picture with nothing
saying why. All three now accept keys on the same terms as the header
path.

### `/auth/me` now says what the credential may do

It described the *user*: a key names its owner, so the profile and its
`role` were the owner's, while the key's real authority is the narrower
set of scopes it was issued with. Anything reading `role` and looking up
that role's rights gave a deliberately restricted key everything its
creator could do.

The response now carries `scopes` — what **this credential** may do, for
password sessions and keys alike. **If you authorise against `/auth/me`,
read `scopes` and not `role`.**

### Two smaller things that came with consolidating

- The event stream never checked token version, so a session ended by a
  password change could keep streaming. It does now, as the header path
  always has.
- The media route accepted a key in its `Authorization` header but not
  in its `?token=` parameter.

**Upgrade notes:** none, and no permissions change. A whitelisted caller
still receives `404` from `/auth/me`, which is correct — the bypass
trusts an address, not a person, so there is no profile to return.

---

## v0.1.67 — 2026-09-09

**Theme:** The spec says which version it is.

Nothing an operator will notice, and the entry exists because that is
still worth knowing.

v0.1.66 shipped with `docs/openapi.yaml` stamped `0.1.65`. The version
lives in two files — the crate manifest and the spec's `info.version` —
and only one of them was bumped, so a release described itself as its
predecessor. A test exists for exactly this and caught it, after the tag
had already gone out and its artifacts had been built.

This release stamps both. If you fetched the v0.1.66 spec and are
matching it against a running core, take this one instead; the described
API is identical.

**Upgrade notes:** none.

---

## v0.1.66 — 2026-09-09

**Theme:** Somewhere to put what you made.

Two new scopes, `content:read` and `content:write`, and nothing else.

**No permissions change today.** Reading joins the other reads, writing
joins authoring beside `dashboards:write` and `skins:write`, so the same
four roles may write — admin, user, rule_editor, service_operator — and
the same three may not. Nobody gains or loses access on upgrade.

**What they are for.** A client is starting to keep what a household
authored: widget templates, icon rules, the images somebody uploaded.
That content lives in core today only because the previous web client
compiled ahead of time and could hold nothing itself, which is why
`/assets` and `/dashboards/templates` exist. It is moving back to the
client that makes it.

What does *not* move is identity. The house has one set of users, roles
and revocations and it is core's, so a client presents the caller's own
bearer, asks `/auth/me` who it belongs to and `/auth/roles` what that
role may do, and enforces the answer itself. These two scopes are the
vocabulary for that conversation.

You will find them in `GET /auth/roles` and on no operation in the API
spec. That is deliberate: the thing they authorise is not here. The
OpenAPI preamble says so, so a reader who notices does not go looking
for a missing endpoint.

**Upgrade notes:** none. Existing tokens keep working; a client that has
not been taught the new scopes falls back to the dashboard ones.

---

## v0.1.65 — 2026-09-08

**Theme:** A chart asks for points, not rows.

Device history was returning every attribute of a device interleaved,
with no way to ask for one — so a client drawing six hours of a single
temperature fetched every reading that device had produced and threw
most of it away. On a sensor that reports a dozen attributes, a chart's
thousand-row budget could run out before reaching the one asked for, and
the chart came up empty on a device that plainly had the data.

History now takes an attribute filter and downsamples server-side.

**Upgrade notes:** none. The existing shape still answers.

---

## v0.1.64 — 2026-09-08

**Theme:** What the deployed house showed that the source did not.

A round of fixes found by running against a real 184-device house rather
than by reading code.

- **The Hue bridge declares itself** — the last device in the house with
  no capability schema. Every device now has one.
- **A WLED controller stops overwriting half of itself**, so its
  attributes no longer arrive with pieces missing.
- **A Roku stops reporting that time has passed** when nothing is
  playing, which had made it look like a device in constant motion.
- **Three filed issues closed**: an absent reading, a scale that
  misreported itself, and an advertisement a device made about a
  capability it did not have.

Also released alongside: hc-lutron 0.1.18, hc-yolink 0.1.14,
hc-zwave 0.1.12.

**Upgrade notes:** none.

---

## v0.1.63 — 2026-09-08

**Theme:** Every device says what it is.

A reference house of 184 devices had 107 with a capability schema. It now
has 184. The gap was never one problem: some devices had no schema
because core mis-wired its own, most because their plugin declared only
part of what it supports, and the rest because two schema fields that
already existed were set by nobody.

Between this entry and v0.1.6 the project moved to per-component
releases and shipped 56 core versions; those rounds are recorded in the
per-component tags and on the
[ci-glance dashboard](https://homecore-io.github.io/ci-glance/) rather
than here.

### What a client can do now that it could not

- **Tell a reading from a battery.** `AttributeSchema.category` marks a
  reading `diagnostic` (battery, signal, firmware, ip, model) or
  `config` (a setting). Absent means primary. The field has been in the
  schema for a while and read by the web UI for nearly as long — no
  plugin ever set it, so a lock's battery was declared exactly as
  primary as whether it was locked, and clients kept private lists of
  attribute names to demote. One lexicon in core now backs every plugin
  that builds attributes from a name.
- **Know which reading leads.** `DeviceSchema.primary` is an ordered
  list of the readings a device exists to report. A temperature/humidity
  sensor leads with temperature; a multi-sensor that reports motion
  leads with motion. homeCore derives it from the device's own type, so
  no plugin has to declare anything, and a plugin that knows better can
  override it. Before this, "the first attribute" was not even stable
  between two reads of the same device — the attribute map has no order.
- **Render a scene, a shade, a fan or a timeclock event.** See below.
- **Show an enum value in a person's words.** An attribute's options may
  now carry a label and an icon, matching what action parameters have
  always had. Accepted, not yet emitted: no plugin declares a label in
  this release, because a client that decodes options as plain strings
  must be updated first. An option carrying neither extra is still sent
  as the bare string it always was, so nothing changes on the wire yet.

### Added

- **Devices that declared nothing now declare themselves.** Lutron fans,
  shades, pulsed contact closures, phantom scenes, occupancy groups and
  timeclock events; every Caséta device except the Pico, which was the
  only one that had a schema before; Hue scenes, sensors and the bridge;
  the Ecowitt gateway; and core's own glue devices — timers, counters,
  groups and the rest.
- **A Lutron scene says whether its state can be trusted.** A phantom
  scene's state is its button's LED, and RadioRA 2 answers 255 — no
  state at all — for a button that has none, which is the shape a scene
  tied to a Pico has. Those scenes declare no `on`; the ones that really
  report declare it, and both publish the button and (where there is
  one) the LED behind it. A scene whose status a client cannot show can
  now say why.
- **A momentary output declares an empty attribute set**, which is a
  different statement from having no schema. A pulsed contact closure
  has nothing to read — the Integration Guide forbids querying one — and
  now says so rather than staying silent.

### Fixed

- **Core wrote glue-device schemas from a startup sweep that raced the
  manager that creates them.** A timer added through the API got no
  schema until the next restart, and one seeded from config could miss
  it entirely. Every path that creates a core-owned device now writes
  the schema with it.
- **Hue scenes could not be activated by the id their schema declares.**
  `{"action": "activate"}` is accepted alongside the older
  `{"action": "activate_scene"}`, so one action works across Hue and
  Lutron scenes.
- **A Lutron LED event could be attributed to the wrong scene.** Phantom
  LEDs are `button + 100` and keypad LEDs are `button + 80`, and both
  subtractions land on real button numbers — component 106 is button 6's
  LED, but 106 − 80 = 26 is a button someone may have a scene on. The
  reading that applies is now chosen rather than guessed.
- **A Lutron timeclock event ignored the attribute it publishes.** It
  reported `enabled` and accepted only `enable`, so a client echoing
  back what it had just read was silently dropped.

### Documentation

- The REST contract now describes `category`, `states`, `primary` and
  the attribute-option forms. All four were being served without being
  documented.
- [Devices → overview](./devices/overview) explains what a
  capability schema contains, rather than only how to fetch one.

### Release matrix

**Tagged at v0.1.63 (1 repo):** `homeCore` (core).

**Plugins tagged in the same round (7):** `hc-lutron` 0.1.18,
`hc-hue` 0.1.13, `hc-caseta` 0.1.12, `hc-ecowitt` 0.1.14,
`hc-yolink` 0.1.14, `hc-zwave` 0.1.12, `hc-isy` 0.1.11.

**Web UI:** `hc-web-flutter` 0.1.94 — reads `primary`, and accepts both
attribute-option forms.

**Skipped (no behavioural change):** `hc-roku` and `hc-thermostat` were
edited only to compile against the new option type; their published
schemas are byte-identical.

### Upgrade notes

- **Restart the plugins, not only core.** The two halves arrive by
  different routes: `primary` is computed by the API when it serves a
  schema, so it appears as soon as core is new enough — even for
  schemas stored by older plugins. Everything else (`category`, and
  every schema listed under *Added*) is published by the plugin as a
  retained MQTT message at registration, so a plugin that has not
  restarted is still silent.
- **A Lutron scene settles about a second after the bridge connects**,
  once its LED query is answered. Before that it declares status on the
  assumption that it has an LED, which is true of every phantom scene
  that is not tied to a Pico.
- **Nothing needs migrating and nothing needs purging.** A republished
  schema replaces the old one by device id, and every field added here
  is optional — a client that ignores them behaves exactly as it did.

---

## v0.1.6 — 2026-07-26

**Theme:** One artifact per component — and devices that no plugin owns.

Two unrelated bodies of work land together, because 0.1.6 is the first
tagged round since 0.1.5 in May.

### Deployment and release (operator-visible)

homeCore now ships as **two containers**, wired together by compose:

| Image | What it is |
|---|---|
| `ghcr.io/homecore-io/hc-core` | The REST/WebSocket API and the embedded MQTT broker. |
| `ghcr.io/homecore-io/hc-web` | The web UI. nginx serves the app and proxies `/api/v1/*` to core. |

- **The appliance image is retired.** `homecore-appliance` baked core and
  every plugin into one container. Plugins install at runtime from the
  signed registry, so the merged image was a different product from the
  one being shipped. Existing appliance images stay in GHCR and keep
  working; none are published any more. The
  `homecore-appliance-*.tar.gz` release archive is gone for the same
  reason.
- **hc-core no longer carries a web UI.** It used to bundle a Leptos WASM
  build. `hc-web` is the UI now, released for the first time at v0.1.6.
- **Repaired image tags.** `hc-core:latest`, `:0.1.5` and `:0.1.4` had all
  become unpullable — the tags existed but the amd64 child manifest each
  one referenced had been deleted in the 2026-05-11 GHCR cleanup incident,
  so `docker pull` failed with "content not found". v0.1.6 republishes a
  working `:latest`. The cleanup job now fails rather than pruning against
  an incomplete protected set, which is what allowed it.
- **amd64 only.** aarch64 tarballs and images had in practice not been
  produced for months — the matrix entry was switched off behind a
  hardcoded override while the release still advertised a multi-arch
  toggle. The pipeline now says amd64 and means it. If you need arm64,
  say so; restoring it is a small change.
- **The whole plugin registry is current.** Ten plugins had shipped
  versions well ahead of what the index served (`hc-lutron` was at 0.1.10
  against a published 0.1.4). All are reconciled, and `plugin.roku` is
  published for the first time.

Upgrade: `docker compose pull && docker compose up -d`. Installed plugins
live in the data directory, not the image, so they are untouched.

### Devices that no plugin owns

**Theme:** the silence around them.

A keypad button that had been dead since May turned out to be pointing
at a Hue group the Hue plugin had stopped managing back in April. The
device was still listed, still accepted commands, and still reported
state — the state just never changed again. Everything downstream
believed it.

This round fixes that button, deletes the devices behind it, and adds
the check that would have caught it in April.

### The failure, for anyone who might hit it

A device can outlive its plugin's interest in it. Turn off
`publish_grouped_lights` in the Hue plugin and its grouped lights stop
being registered — but homeCore's registration and retained state for
them persist. Such an **orphaned** device then fails silently in *both*
directions:

- **Commands vanish.** Plugins subscribe to command topics per-device,
  only for devices they registered. An orphan has no subscriber, so the
  broker drops its commands. No error, anywhere — and the rule engine
  still records the action as `fired: success`.
- **State freezes.** Its attributes stay at whatever they last were,
  forever, and rule conditions keep reading them as truth.

Together those wedge a toggle permanently. The affected keypad had:

```
Btn1 "On"  — condition: group.on == false → turn on    ← could never pass
Btn1 "Off" — condition: group.on == true  → turn off   ← always passed
```

The group was frozen `on: true`, so the "On" rule never fired *once* in
two months (`condition_failed`, 9 of 9 presses), the "Off" rule fired
every time, and its command evaporated at the broker. The button looked
broken; every layer reported success.

### Added

- **`GET /api/v1/devices/orphaned`** — finds devices homeCore holds that
  their owning plugin no longer manages.

  Detection is a **count comparison, not a staleness threshold**. Every
  management-capable plugin self-reports `device_count`; if core holds
  more devices for that plugin than the plugin claims, the difference is
  exactly the orphan count. Flagging on `last_seen` age is the obvious
  approach and is wrong — plugins that publish only on change leave
  healthy devices cold for months (a wall switch nobody flips is not
  orphaned), so an age rule cries wolf on exactly the quiet devices you
  care least about.

  Worth running once after upgrading. On the system this was found on it
  immediately turned up 11 more orphans in a *second* plugin, unrelated
  and unnoticed.

### Fixed

- **`hc-hue`** now reports a command sent to a Hue device it no longer
  manages — a `warn` plus a failed `plugin_command_result` — instead of
  silently discarding it as another plugin's device. (This covers a
  device pruned mid-run; a device orphaned across a restart is caught by
  `/devices/orphaned` above, since its command never reaches the plugin
  at all.)
- **`hc-hue`** warns, rather than staying quiet, when it skips the
  cross-restart reconcile that retires stale devices.
- **Plugin SDK** warns when it cannot load its published-device snapshot.
  That file is the only record of devices registered in earlier runs, so
  losing it silently disables stale-device cleanup for every plugin.

### Documentation

- **`openapi.yaml` now matches the server** — 89 of 89 routes, 124 of 124
  operations, up from 39. It had also stopped parsing entirely at some
  point (an unquoted `description:` containing `": "` reads as YAML
  mapping syntax), so nothing could consume it. Both fixed; the
  "adding an endpoint" checklist now includes documenting it, which is
  what was missing.

### Upgrade notes

- **Orphans from before the SDK's device-snapshot mechanism cannot be
  auto-cleaned.** `reconcile_devices` computes `stale = known − live`
  from its persisted `.published-device-ids.json`; devices registered
  before that file existed were never written to it, so `known == live`
  and the stale set is empty. They are structurally invisible to the
  reconcile — running the plugin's **cleanup stale devices** action will
  never remove them and will log nothing when it doesn't.

  Delete them explicitly:

  ```
  GET    /api/v1/devices/orphaned      # review the suspects first
  DELETE /api/v1/devices/{id}
  ```

  Check `affected_rules` in the delete response — deletion cascades into
  rule files, disabling any automation that referenced the device. An
  empty list means nothing was disturbed.

---

## v0.1.5 — 2026-05-07

**Theme:** Comfort fix + diagnostic toolkit + client UX cleanup.

A larger-than-usual patch round that closes out a cluster of
operator-reported bugs and lands the WS-observability work that
was deferred from 0.1.3.

### Added

- **`GET /api/v1/logs`** — REST log-tail companion to the
  WebSocket `/api/v1/logs/stream`. Same filter semantics
  (`level`, `target` prefix), plus `since=<RFC3339>` for
  incremental polling and `limit` (default 100, cap 1000).
  CLI-friendly: `curl ... | jq` no longer needs a websocket
  client. Same auth as the WS endpoint.
- **`GET /api/v1/ws/connections`** (admin-only) — live
  registry of every active WebSocket connection (events_stream
  + logs_stream) with `connection_id`, `endpoint`, `client_id`,
  `ip`, `user`, `user_agent`, `connected_at`. Distinguishes
  "one looping client" from "many churning clients" during
  reconnect-storm investigations.
- **WS lifecycle Prometheus metrics** —
  `homecore_ws_connects_total{endpoint}` and
  `homecore_ws_disconnects_total{endpoint, reason}`. The
  `reason` label uses the same categories as the disconnect
  log (see Changed). Combined with `/api/v1/metrics` scraping,
  dashboards can alert on `pong_timeout` rate (network/proxy
  issues) independent of normal `client_close` churn.
- **`hc-thermostat` operator-triggered force-recalc** — the
  `recalculate_all` plugin command now accepts
  `{"force": true}` which re-issues actuator commands
  unconditionally (regardless of cached `actuator_state`).
  Recovery path for the cached-vs-physical-reality drift the
  comfort fix below was added to prevent in the first place.

### Changed

- **WS disconnect log carries a `reason` field** — seven
  categorised strings (`client_close`, `socket_closed`,
  `recv_error`, `pong_timeout`, `ping_send_failed`,
  `event_send_failed`, `bus_closed`) replace the
  previously-indistinguishable `INFO "WebSocket client
  disconnected"`. `logs/stream` got the same treatment with
  its own four categories. Reconnect storms are now
  diagnosable from logs alone.
- **`hc-thermostat` settle gate** — after a plugin or
  appliance restart, the bridge holds command issuance until
  every configured sensor has reported at least once, then
  issues an unconditional command for the desired state.
  Fixes the case where the cached `actuator_state` (restored
  from retained MQTT) matched the desired state but physical
  reality had drifted (power blip, manual flip, dropped
  Z-Wave frame) — the transition-only path never re-synced.
- **Version-banner is direction-aware** (Leptos admin) — only
  fires when the server is strictly newer than the tab. The
  prior any-mismatch trigger fired during in-flight upgrades
  too, where Reload couldn't help. Banner copy also rewritten
  for clarity ("homeCore was upgraded — server is on v0.1.5,
  this tab is still on v0.1.4. Reload to pick up the new
  client.").
- **Overview Security widget honours per-device opt-out** —
  unchecking a contact-sensor or lock on its detail page now
  actually excludes it from the Security tile. Previously the
  default-set fallback ("all locks + contact sensors when no
  tags are explicit") swept unchecked devices back in. New
  explicit-exclude store; checkbox semantics now match operator
  expectations.
- **Overview widget click resets Devices-page filters** —
  clicking a Security/Climate/etc. tile now overrides
  persisted filter chips on the Devices page, instead of
  intersecting with them. Previously a stored
  `area_filter=["kitchen"]` from a prior session could
  produce an empty view when clicking through to a system
  with no Kitchen devices.

### Fixed

- **Cargo.lock metadata drift** in 9 plugin repos — the
  per-repo lockfiles' "version" line for the local crate now
  matches the `Cargo.toml` (was 0.1.2 lingering after the
  v0.1.3 ceremony due to the meta-layout workspace shadowing
  per-plugin builds). Cosmetic — release-pipeline binaries
  were already correct.
- **`/health` and `/system/status` report the binary's
  version, not hc-api's** (HEALTH-VERSION-SOURCE-1). Core's
  binary now passes `CARGO_PKG_VERSION` into AppState and
  the handlers read it from there. Removes the
  bump-all-17-workspace-crates workaround that v0.1.4 needed
  — future "tag only what changed" releases can bump just
  the top-level Cargo.toml.

### Release matrix

**Tagged at v0.1.5 (4 repos):** `homeCore` (core),
`hc-web-leptos`, `hc-thermostat`, `homeCore-io/docker`
(orchestration; triggers appliance build).

**Skipped (no tag, only branch merge for cosmetic Cargo.lock
sync):** 9 plugins (`hc-hue`, `hc-yolink`, `hc-lutron`,
`hc-sonos`, `hc-wled`, `hc-isy`, `hc-zwave`, `hc-caseta`,
`hc-ecowitt`).

**Appliance image:**
`ghcr.io/homecore-io/homecore-appliance:0.1.5` published.
Bundles core 0.1.5 + leptos 0.1.5 + thermostat 0.1.5 +
plugins still at 0.1.3.

### Upgrade notes

- **Stuck thermostat from before 0.1.5?** If you upgraded
  from 0.1.4 with an actuator that had drifted from the
  plugin's cached state (the symptom: AC outlet visibly off
  while the thermostat shows `actuator_state: true`), invoke
  the new force path:
  ```
  POST /api/v1/plugins/plugin.thermostat/command
  {"action":"recalculate_all", "force": true}
  ```
  Or: flip the setpoint by ±1°F to force a transition the
  old way.

---

## v0.1.4 — 2026-05-07 (hotfix)

**Theme:** `/health` version-reporting fix.

Same-day hotfix after v0.1.3. The v0.1.3 ceremony bumped only
the top-level `homecore` `Cargo.toml`, but `/health` and
`/system/status` are implemented in the `hc-api` sub-crate and
read **its** `CARGO_PKG_VERSION` — which was still at 0.1.2.
A v0.1.3 appliance image therefore reported `version: 0.1.2`
through `/health`, the Leptos sidebar, and the login page.

### Fixed

- Bumped every workspace crate (top-level `homecore` + 16
  sub-crates) to 0.1.4 in lockstep, so `hc-api`'s
  `CARGO_PKG_VERSION` lines up with the binary's. `hc-web-leptos`
  rode along to keep the WASM bundle's `client_version` in
  sync with the new server.

### Release matrix

**Tagged at v0.1.4 (3 repos):** `homeCore`, `hc-web-leptos`,
`homeCore-io/docker`. Appliance image
`ghcr.io/homecore-io/homecore-appliance:0.1.4` published.

### Upgrade notes

- The proper architectural fix for this fragility ships in
  v0.1.5 (HEALTH-VERSION-SOURCE-1). Lockstep-bump-everything
  is no longer required from v0.1.5 forward.

---

## v0.1.3 — 2026-05-06

**Theme:** Leptos admin reliability + automation hygiene.

The browser-side admin client got a substantial reliability pass after
field reports of disconnect storms and stale state. Three of the four
fixes are behavioural changes invisible until you look at the
WebSocket events log; the fourth is a banner that finally tells you
your tab is running old code.

### Added

- **`hc-web-leptos` first-ever release tag.** The web admin client
  has shipped through the appliance image since 0.1.0; this is its
  first standalone `v*` git tag, joining the per-component SemVer
  cohort.
- **Stale-WASM banner.** When the operator deploys a new homeCore,
  every existing browser tab keeps running the WASM it loaded
  earlier (`Ctrl+Shift+R` only reloads the active tab). The admin
  now compares its embedded `CARGO_PKG_VERSION` against
  `/api/v1/health` on connect and on every WS reconnect; on
  mismatch a "new version available — Reload" banner appears at
  the top of the viewport. Dismissable per server-version in
  `sessionStorage`.
- **Renovate digest-bump automation.** Every base-image digest
  pinned in 0.1.2 (alpine 3.23, rust 1.95-alpine3.23) now has
  Renovate watching it. Weekly Monday probe; digest + patch tag
  bumps auto-merge on green CI; minor/major land as PRs labelled
  `review-required`. Twelve repos covered.
- **CI for `hc-web-leptos`.** The crate now has a
  `.github/workflows/ci.yml` (fmt + tests via the shared
  `hc-scripts/rust-ci.yml`). It also joined the
  [ci-glance dashboard](https://homecore-io.github.io/ci-glance/).
- **Per-repo `Dockerfile` for `hc-caseta`, `hc-ecowitt`,
  `hc-thermostat`.** These three plugins missed the original
  Dockerfile copy-pass; now in line with the other seven plugins so
  `docker build .` works from each plugin's checkout.

### Changed

- **WebSocket survives navigation.** Routing between admin pages
  (Devices → Scenes → Areas, etc.) used to tear down the
  WebSocket and reopen it ~10 ms later — visible as a continuous
  disconnect/connect storm in the events log and as occasional
  missed state updates. The shared `WsContext` is now hoisted
  above the router so the connection lives for the session.
- **Cached state self-heals on reconnect.** When the WebSocket
  disconnects (real network blips, server restarts), the device
  and plugin maps now re-fetch from REST on every reconnect.
  Previously, state changes that happened during the disconnect
  window were silently lost until the next event for that device.
  In particular: the symptom "Sonos shows paused while the
  speaker is actually playing, until something nudges it" should
  no longer recur.
- **Plugins consume `plugin_sdk_rs::types::*` /
  `plugin_sdk_rs::logging::*` re-exports.** Eleven plugins
  (`hc-hue`, `hc-yolink`, `hc-lutron`, `hc-sonos`, `hc-wled`,
  `hc-isy`, `hc-zwave`, `hc-caseta`, `hc-ecowitt`,
  `hc-thermostat`, `hc-captest`) dropped their direct
  `hc-types` / `hc-logging` git deps and now consume those
  surfaces through the SDK. One upstream-homeCore dependency per
  plugin instead of three. SDK SemVer becomes the only
  homeCore-side version a plugin needs to track.
- **Release-tag policy: tag only what changed.** Starting with
  0.1.3 the project no longer publishes a fixed N-tag table per
  release. Components with operator-impact changes get a tag;
  components whose only changes are configuration that doesn't
  affect the produced binary (e.g. `.github/renovate.json`) are
  skipped. The appliance is always retagged because it bundles
  whatever's latest.

### Fixed

- **Expired session leaves the user logged in.** Before this
  release, a JWT that expired mid-session was only detected on
  the next API write — read-only browsing of cached state stayed
  "alive" indefinitely. The admin now checks token expiry every
  30 seconds and bounces to `/login` proactively. The 401-handler
  in the API client also reliably clears the session signal now
  (a `use_context` lookup inside `spawn_local` previously
  silently failed).

### Release matrix

**Tagged at v0.1.3 (13 repos):** `homeCore` (core), `hc-web-leptos`
(first tag), `hc-hue`, `hc-yolink`, `hc-lutron`, `hc-sonos`,
`hc-wled`, `hc-isy`, `hc-zwave`, `hc-caseta`, `hc-ecowitt`,
`hc-thermostat`, `homeCore-io/docker` (orchestration; triggers
appliance build).

**Skipped (no tag, only branch merge):** `hc-captest` (dev-only
repo, not in production release flow).

**Appliance image:**
`ghcr.io/homecore-io/homecore-appliance:0.1.3` published.

### Upgrade notes

- **Hard-refresh at least one browser tab** after pulling the new
  appliance — the new banner is the long-term answer, but the
  *first* tab on the new server still needs a manual reload
  because it loaded the old WASM before the banner code existed.
- **Renovate onboarding PRs** may appear once Mend Renovate
  Cloud's first scan completes (24-48 h after the App was
  installed). They contain default config; close them — the
  canonical `renovate.json` already shipped on `main` in each
  repo.

### Note on Phase F (the "tag only what changed" rule)

This was the first release applying our new policy of tagging
only components whose binaries differ from the prior release
(rather than the lockstep "tag everything" approach used through
0.1.2). The initial pass tagged 12 components and skipped two
(`homeCore`, `hc-captest`) whose only changes were
`.github/renovate.json`. Operators reported the appliance still
showing v0.1.2 in the Leptos sidebar — because the sidebar reads
core's `CARGO_PKG_VERSION` which was untouched. Resolved by
amending the rule: components that ship *inside* the appliance
image (today: core, plus the WASM bundled into core) ride with
the appliance tag even when their own diff is binary-irrelevant.
Core was retagged at `v0.1.3` and the appliance was rebuilt with
the new core image. Future releases follow the amended rule.

---

## v0.1.2 — 2026-05-05

**Theme:** WebSocket reliability + version correctness + base
image hardening.

A targeted patch round after a 0.1.1 deploy debugging session
exposed three orthogonal weaknesses: the server-side WS loop
mishandled some edge cases, the tooling couldn't tell *which*
component a heartbeat came from, and the Dockerfiles all floated
on a single `alpine:3.20` tag.

### Added

- **`GET /api/v1/system/versions`** — BOM endpoint returning
  `{appliance, core, built_at, plugins: {hc-*: version, ...}}`.
  The appliance image stamps `versions.json` at build time so
  this endpoint always serves accurate per-component versions
  even when components ship at independent SemVers.
- **Plugin heartbeat carries `sdk_version`** — auto-populated
  from the SDK crate's own `CARGO_PKG_VERSION` at compile time.
  Core's state bridge reads this on first heartbeat per plugin
  per session and warns (does not refuse) on MAJOR/MINOR
  divergence from `hc-types::PROTOCOL_VERSION`.
- **Per-tab `client_id` fingerprint.** The Leptos admin generates
  a UUID in `sessionStorage` on first connect and includes it in
  every WS/SSE URL. Server logs now correlate reconnect storms
  to a specific tab instead of `client_id="-"`.

### Changed

- **Server WebSocket loop refactored** to `select!` over
  `socket.recv()`, a 30-second ping ticker, and the event bus —
  closed clients are detected within one ping interval rather
  than waiting for the next event broadcast. NAT/proxy idle
  timeouts also kept warm.
- **Activity page WebSocket consolidated.** Pre-0.1.2, the
  Activity page opened its own `/events/stream` socket *in
  addition* to the shared NavShell socket. Both cycled in
  lockstep, doubling the disconnect-storm signal. The page now
  subscribes to the shared `WsContext.latest_event` signal.
- **Base images digest-pinned.** Three canonical Dockerfiles in
  `homeCore-io/docker` plus eight per-plugin local Dockerfiles
  moved from `alpine:3.20` (floating) to
  `alpine:3.23@sha256:5b10f432…` (3.23.4 digest-pinned). Driven
  by a kernel CVE in the 3.20 lineage. Rust toolchain pinned to
  `1.95` across the board.
- **`apk upgrade` runs in every Dockerfile** before
  `apk add --no-cache` so CVE patches in named packages land
  even on cached layers.

### Fixed

- **Cargo.toml version-correctness sweep.** Several plugin and
  client crates had stale `version = "0.1.0"` lines despite
  shipping inside a v0.1.1 cohort. A pre-tag CI guard now
  refuses to publish if any tracked Cargo.toml's version field
  doesn't match the tag being pushed.
- **`result_large_err` boxing in `hc-api`** — the largest
  variant of the auth-middleware error type was inlined in
  every `Result<T, _>` return. Boxed it; smaller stack frames,
  same surface.
- **Duplicate `debug!` disconnect log** in the WS handler
  removed.

### Release matrix

14 tags total: `homeCore`, `hc-tui`, ten plugins, and
`homeCore-io/docker` all at `v0.1.2`. `hc-plugin-sdk-rs`
shipped independently at `v0.1.3` (its first independent
SemVer; the appliance pulls SDK by tag at plugin-build time).

### Upgrade notes

- The appliance image at `:0.1.2` is the first to carry
  `/etc/homecore/versions.json` and to expose
  `GET /system/versions`. Earlier appliance versions had
  inconsistent self-reported version strings.

---

## v0.1.1 — 2026-05-03

**Theme:** Timezone unification, backup/restore plumbing, plugin
security hardening.

Operator-visible polish round. The most noticeable change is that
every UI timestamp now renders in your configured timezone instead
of UTC; the most consequential is that backups now actually
include plugin configs.

### Added

- **System timezone** propagates from `/api/v1/system/status`
  through every component. The Leptos admin renders timestamps
  in the configured zone; plugins receive the zone via a new
  retained MQTT topic `homecore/system/tz` and use it for log
  formatting.
- **Plugin configs included in backup archive.** `POST
  /api/v1/system/backup` now zips up `state.redb`, `history.db`,
  rules, and every plugin's `config.toml`. Restore unzips back
  in place. Body limit raised to handle realistic archive sizes.
- **Live status text during backup + restore** — the admin shows
  byte counters and stage transitions instead of a blocking
  spinner.
- **Telegram channel** added to `hc-notify`. `type = "telegram"`
  in `[[notify.channels]]`; `channel = "all"` fans out to every
  registered channel.
- **`TimeElapsed` rule condition** — `type = "time_elapsed"`
  checks ms since an attribute last changed. Per-attribute
  timestamp cache; dry-run uses `last_seen` baseline.
- **README dashboard badges** repointed at the new
  [ci-glance dashboard](https://homecore-io.github.io/ci-glance/)
  across 12 repos.

### Changed

- **Solar mode ON/OFF transitions** now fire the simultaneous
  edge correctly when the sun event lands on an exact tick
  boundary (previously dropped).
- **Plugin MQTT log forwarding** redacts secret-named fields
  (`password`, `api_key`, `token`, etc.) before publishing to
  `homecore/plugins/{id}/logs`.
- **Plugin command admin enforcement** verified end-to-end;
  `hc-web-leptos` disables the submit button for non-admin
  users.
- **`hc-ecowitt` LAN attack surface** reduced — the HTTP
  receiver binds loopback by default and accepts an
  `allowed_source_ips` allowlist when binding to a routable
  address.

### Fixed

- **Telegram `CHANGE_ME` placeholder check** — homeCore now
  refuses to start when a notification channel is configured
  with the example placeholder values, instead of silently
  failing on first dispatch.

### Release matrix

14 tags at `v0.1.1`. 12 GitHub Releases (canonical + `latest`
mirror), 12 Docker images on ghcr (`:0.1.1` + `:latest`),
appliance image + tarball.

---

## v0.1.0 — 2026-04-09

Initial release. Runs a house, not yet packaged for general use.

### Core

- Rust kernel with `axum` REST + WebSocket API and embedded
  `rumqttd` MQTT broker.
- Rule engine — triggers, conditions, actions stored as RON
  files on disk, hot-reloaded.
- `redb`-backed device registry; SQLite-backed history.
- Rhai sandboxed scripting for conditions and action scripts.
- Solar event triggers computed locally (no cloud).
- Multi-user auth — JWT HS256, Argon2id passwords, 7 preset
  roles (admin / user / read_only and four mid-tier roles).
- Pushover, email, and (later) Telegram notification
  channels.

### Plugins (Rust SDK)

- `hc-hue`, `hc-yolink`, `hc-lutron`, `hc-sonos`, `hc-wled`,
  `hc-isy`, `hc-zwave`. All on the same plugin SDK with
  management protocol, heartbeat, remote config, dynamic log
  level, and MQTT log forwarding.

### Clients

- `hc-web-leptos` — Rust+WASM single-page admin. (Retired since; the web
  UI is now `hc-web`.)
- `hc-tui` — terminal UI built on `ratatui`.

### Distribution

- Per-component Docker images on `ghcr.io/homecore-io/`.
- All-in-one `homecore-appliance` image (alpine, multi-stage).
- Per-component tarballs published as GitHub Releases.

### Release matrix

14 repos tagged at `v0.1.0`; amd64-only via `FORCE_FAST` (multi-arch is a deliberate later run, tracked as
MULTIARCH-1).

---

## Looking forward

Active and deferred work for the next patch release lives in the
project's planning docs (not part of public docs). User-visible
items will appear here once they ship.
