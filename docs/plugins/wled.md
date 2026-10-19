---
id: wled
title: WLED
sidebar_label: WLED
sidebar_position: 8
---

# WLED (`hc-wled`)

The WLED plugin brings [WLED](https://kno.wled.ge) LED controllers into
homeCore — all of what a controller can do, with screens of its own: every
segment and its look, presets and playlists, nightlight, sync with other WLEDs,
live data, sound, the controller's own setup, backups and firmware.

Changes arrive over each controller's WebSocket as they happen — made in
homeCore or anywhere else (WLED's app, a button, another WLED). A controller
without one is polled.

## Adding controllers

Install it from **Settings › Plugins › Add**, then open its page:

- **Look for controllers** finds WLEDs on the network (mDNS); add the ones you
  want.
- **Add one by address** for a controller on another network or VLAN.
- Each controller's address can be changed on that page; the plugin restarts
  to take it.

## Its screens

All of these come with the plugin itself — update the plugin, and they update.

- **Its page** (Settings › Plugins › WLED): the controllers — live or polling,
  LEDs, signal and firmware — with identify, restart and remove; copying presets
  between controllers; backing them all up and the backups the plugin keeps;
  updating firmware on all of them; installing updates by itself at night; and
  the plugin's settings.
- **A controller's panel** (tap it anywhere):
  - **Look** — effects by name with their own sliders and options, palettes
    with their colours, colours, white temperature;
  - **Segments** — the strip to scale, boundaries you drag, each segment's
    LEDs, look, brightness and options; split, merge, add, delete;
  - **Presets** — save what's running, rename, delete, the preset at
    power-on, back up, restore, copy one to another controller or duplicate it;
  - **Playlists** — build and edit them, start, next;
  - **Controller** — nightlight, sync, live data, sound, the effect catalogue,
    its own timers, its setup (LED outputs, buttons and remote, network, clock),
    firmware, backups and restart.
- **Its card** on Home and the rooms: on and off, its look as a strip of its
  colours, what it runs and how bright; at the large size, its presets to tap.
- **Quick presets**, a card you add yourself (Edit → Add a card): the presets
  you choose, on the controllers you choose — each found by name on every
  controller. Set it up from the card's settings in Edit.

## In automations

The automation editor has a WLED form for a step: apply a preset, start a
playlist, set a look (effect, palette, colours, speed, intensity, on one
segment or all), nightlight, power, sync and live data — on one controller or
several at once. Presets, playlists, effects and palettes are named everywhere:
"when Eaves lights' preset becomes “Halloween 1”", "apply Halloween 1 on Eaves
lights, fading over 2 s".

## Firmware

Each controller says which build it runs and where its firmware comes from.
The plugin checks that project's releases (daily by default) for that build's
own file, on the channel you choose (stable, beta or nightly). Installing an
update backs the controller up first, sends the file, waits for it to come back
and checks what it runs. A controller on a build nobody publishes is never
offered one. You can also install a firmware file of your own from its panel;
anything that isn't an ESP firmware image is turned away.

**Install updates by itself, at night** (on its page) adds an ordinary
automation you can open and change: at 03:00 it installs each waiting update in
turn, and stops and tells you if a controller doesn't come back.

## Alerts

| Alert | Severity | On unless turned off |
|---|---|---|
| Firmware update available | information | no — the System page lists updates either way |
| Firmware update in progress | information | yes — for automations to hold off |
| Firmware update failed | error | yes |
| Restarted by itself | warning | yes |

Turn them on or off, and send them somewhere, in **Settings › Alerts**.

## Settings

On its page, or **Settings › Plugins › WLED › Settings**:

- where the effect and palette catalogue is kept — read from each controller
  when needed, or a copy kept in the app (so the pickers work while a
  controller is offline);
- how often to read a controller that can't push its changes;
- which firmware to offer;
- addresses on other networks to ask for more WLEDs.

## For developers

The plugin's source, with its screens in `ui/`, is `plugins/hc-wled` in the
homeCore repository — the fullest example of a plugin: named numbers, alerts,
files sent to actions, and its own page, panel, automation step and cards. See
[Developing Plugins](./developing-plugins) and
[Screens and Cards](./plugin-screens).
