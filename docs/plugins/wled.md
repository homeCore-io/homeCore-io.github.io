---
id: wled
title: WLED
sidebar_label: WLED
sidebar_position: 8
---

# WLED (`hc-wled`)

The WLED plugin brings [WLED](https://kno.wled.ge) LED controllers into
homeCore and covers nearly everything a controller can do: every segment and
its look, presets and playlists, nightlight, sync with other WLEDs, live data,
sound, the controller's own setup, backups and firmware. It comes with its own
screens for all of it.

Changes arrive over each controller's WebSocket as they happen, whether they
were made in homeCore or somewhere else (WLED's app, a button, another WLED).
A controller without a WebSocket is polled instead.

## Adding controllers

Install the plugin from **Settings › Plugins › Add**, then open its page:

- **Look for controllers** finds WLEDs on the network over mDNS. Add the ones
  you want.
- **Add one by address** covers a controller on another network or VLAN.
- You can change a controller's address on the same page. The plugin restarts
  to pick it up.

If homeCore runs in a container on a bridge network, the search will find
nothing, because mDNS multicast does not cross the bridge. Add each controller
by address instead. Until at least one controller is added, the plugin shows a
`no_devices_configured` notice.

## What it publishes

Each controller is a `light` device. Values that homeCore has shared names for
use them, converted from WLED's own scales: `brightness_pct` (0 to 100),
`transition_ms`, `color_temp` in kelvin and `color_rgb`. The device also
carries each segment, the running preset and playlist, nightlight, sync and
live data state, the controller's presets, playlists, effects and palettes by
name, its LED count and estimated current draw, and its firmware status.

## Its screens

All of these ship with the plugin, so updating the plugin updates them.

- **Its page** (Settings › Plugins › WLED) lists the controllers, live or
  polling, with their LEDs, signal and firmware, and lets you identify,
  restart or remove each one. From here you can also copy presets between
  controllers, back them all up and browse the backups the plugin keeps,
  update firmware on all of them, turn on unattended updates at night, and
  change the plugin's settings.
- **A controller's panel** opens when you tap the controller anywhere. It has
  these tabs:
  - Look: effects by name with their own sliders and options, palettes with
    their colours, colours, and white temperature.
  - Segments: the strip drawn to scale, with boundaries you drag and each
    segment's LEDs, look, brightness and options. You can split, merge, add
    and delete segments.
  - Presets: save what's running, rename, delete, pick the preset used at
    power-on, back up, restore, copy a preset to another controller, or
    duplicate it.
  - Playlists: build and edit them, start one, skip to the next entry.
  - Controller: nightlight, sync, live data, sound, the effect catalogue, the
    controller's own timers, its setup (LED outputs, buttons and remote,
    network, clock), firmware, backups and restart.
- **Its card** on Home and in rooms shows on and off, the current look as a
  strip of its colours, what it is running and how bright. At the large size
  it also shows presets you can tap.
- **Quick presets** is a card you add yourself (Edit → Add a card). It shows
  the presets you pick, on the controllers you pick, and finds each preset by
  name on every controller. Set it up from the card's settings in Edit.

## In automations

The automation editor has a WLED form for a step. It can apply a preset,
start a playlist, set a look (effect, palette, colours, speed and intensity,
on one segment or all of them), and control nightlight, power, sync and live
data, on one controller or several at once. Presets, playlists, effects and
palettes appear by name everywhere, so a rule reads like "when Eaves lights'
preset becomes “Halloween 1”" or "apply Halloween 1 on Eaves lights, fading
over 2 s".

## Firmware

Each controller reports which build it runs and where that build's firmware
comes from. The plugin checks that project's releases for the build's own
file, once a day by default, on the channel you choose: stable, beta or
nightly. Installing an update first backs the controller up, then sends the
file, waits for the controller to come back and checks what it is running. A
controller on a build that nobody publishes is never offered an update.

You can also install a firmware file of your own from the controller's panel.
The plugin only accepts an ESP32 or ESP8266 firmware image (a `.bin`, or a
gzipped `.bin.gz`) of a plausible size, and turns anything else away before
touching the controller.

**Install updates by itself, at night** (on the plugin's page) adds an
ordinary automation that you can open and change. At 03:00 it installs each
waiting update in turn, and if a controller doesn't come back it stops and
tells you.

## Alerts

| Alert | Severity | On unless turned off |
|---|---|---|
| Firmware update available | information | no (the System page lists updates either way) |
| Firmware update in progress | information | yes, so automations can hold off |
| Firmware update failed | error | yes |
| Restarted by itself | warning | yes |

Turn them on or off, and choose where they are sent, in **Settings › Alerts**.

## Settings

These are on the plugin's page, or under **Settings › Plugins › WLED ›
Settings**:

- Where the effect and palette catalogue is kept: read from each controller
  when needed (the default), or a copy kept in the app so the pickers still
  work while a controller is offline.
- How often to poll a controller that can't push its changes (30 seconds by
  default).
- Which firmware channel to offer (stable by default).
- Addresses on other networks to ask for more WLEDs.

## For developers

The plugin's source, with its screens in `ui/`, is `plugins/hc-wled` in the
homeCore repository. It is the most complete example of a plugin, with named
numbers, alerts, files sent to actions, and its own page, panel, automation
step and cards. See [Developing Plugins](./developing-plugins) and
[Screens and Cards](./plugin-screens).
