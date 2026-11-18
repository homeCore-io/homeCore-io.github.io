---
id: wled
title: WLED
sidebar_label: WLED
sidebar_position: 8
---

import PluginFacts from '@site/src/components/PluginFacts';

# WLED (`hc-wled`)

<PluginFacts
  mark="WL"
  kind="lights"
  summary="Connects WLED LED controllers to homeCore, each one a light with nearly everything the controller can do."
  version="0.1.26"
  runs="Under core (Rust)"
  talks="Your network"
  account="None"
  devices={["light"]}
  source="https://github.com/homeCore-io/homeCore/tree/develop/plugins/hc-wled"
  setup="#install-and-set-up"
/>

The WLED plugin connects [WLED](https://kno.wled.ge) LED controllers to
homeCore. Each controller becomes a light, and the plugin covers nearly
everything a controller can do: segments and their looks, presets and
playlists, nightlight, sync with other WLEDs, live data, sound, the
controller's own settings, backups and firmware. It ships with its own page,
panel, cards and automation step.

Changes arrive over each controller's WebSocket as they happen, whether they
were made in homeCore or somewhere else (WLED's app, a button, another WLED).
A controller whose WebSocket can't be reached is read on a timer instead.

## Before you start

- One or more controllers running WLED, on ESP32 or ESP8266 boards.
- homeCore must reach each controller over HTTP on port 80, for its JSON API
  and its WebSocket at `/ws`.
- The plugin finds controllers on the same network with mDNS. mDNS doesn't
  cross subnets or VLANs, and it doesn't reach into a container on a bridge
  network, so in those setups you add each controller by its address.
- Firmware checks ask GitHub for releases, once a day by default. Set
  **Look for firmware every** to 0 to never ask.

## Install and set up

1. Install WLED from **Settings › Plugins › Catalog**.
2. Open **Settings › Plugins › WLED**.
3. Use **Look for controllers** to find WLEDs on the network over mDNS, then
   add the ones you want. For a controller on another network, use **Add one
   by address** with its IP, for example `192.168.1.74`.

Adding a controller reads its name and MAC address from the controller. Its
device ID is `wled_` plus the last six characters of its MAC (for example
`wled_a1b2c3`), so it stays the same if the address changes. The plugin
restarts to pick up a new controller, a changed address or a removed one.

Until at least one controller is added, the plugin shows a
`no_devices_configured` notice on its page.

## Settings

These are under **Settings › Plugins › WLED › Settings**. The effect catalog
and firmware choices are also on the plugin's page.

| Setting | Key | Default | What it does |
|---|---|---|---|
| Poll interval | `wled.poll_interval_secs` | 30 s | How long to wait before reconnecting a dropped WebSocket, and how often to read a controller that has none. A controller can have its own value. |
| Firmware updates | `wled.firmware_channel` | `stable` | Which releases count as an update: Stable, Stable and betas (`beta`), or Nightly builds too (`nightly`). |
| Look for firmware every | `wled.firmware_check_hours` | 24 hours | How often to check for new firmware. 0 never checks. |
| Effect and palette catalogue | `wled.catalog` | `controller` | For new controllers: read effects and palettes from the controller each time, or keep a copy in the app (`app`) so pickers work while a controller is offline. |
| Backups folder | `wled.backups_dir` | `backups` | Where controller backups are kept, relative to the plugin's config folder. |
| Cross-subnet hosts | `wled.discovery_hosts` | empty | Addresses of WLEDs on other subnets. Discovery asks each one for the WLED-Sync peers it sees. |
| WLED devices | `devices` | empty | Each controller's name and room. Filled in when you add controllers. |

The Logging section has the usual level, forwarding, rotation and pruning
settings.

## Devices

Each controller is a `light` device. Where homeCore has a shared name for a
value, the plugin uses it and converts from WLED's own scale:

| Attribute | Meaning |
|---|---|
| `on` | Power. Writable; `"toggle"` flips it. |
| `brightness_pct` | 0 to 100. |
| `color_rgb`, `color2`, `color3` | The main segment's three colors. |
| `color_temp` | White temperature in kelvin, on a strip that has one. |
| `effect_id`, `palette_id`, `effect_speed`, `effect_intensity` | The main segment's look. Speed and intensity are 0 to 255. |
| `preset_id`, `playlist_id` | What is running. |
| `transition_ms` | The fade time. |
| `main_segment`, `segment_count`, `segments` | The segments, each with its range, look and options. |
| `nightlight` | On, duration, mode and target, with the time left. |
| `sync` | Sending and following other WLEDs, with their groups. |
| `live`, `live_source`, `live_override` | Whether live data (E1.31, DDP and so on) is streaming, from where, and whether it overrides the controller. |
| `audio_reactive` | Whether the controller is listening to sound. |
| `power_on_preset_id`, `power_on` | The preset used at power-on, and whether it comes on then. |
| `effects`, `palettes`, `presets`, `playlists` | Lists by name, so screens and rules show names instead of numbers. |
| `led_count`, `led_current_ma`, `led_max_current_ma`, `led_fps` | The strip, its estimated current draw and its limit. |
| `wifi_signal_pct`, `wifi_rssi` | Signal strength. |
| `firmware_build`, `firmware_source`, `firmware_latest`, `firmware_status` | What it runs and what is on offer. |
| `connection` | `push` while the WebSocket is up, `poll` while it is read on a timer. |

Commands are writes to these names. A look goes to segment 0 unless you add
`segment`, which can be a number, `"all"` or `"selected"`:

```json
{ "on": true, "brightness_pct": 60, "transition_ms": 2000 }
{ "color_rgb": "#ff8800" }
{ "effect_id": 9, "palette_id": 6, "effect_speed": 128, "segment": "all" }
{ "preset_id": 3 }
```

The controller also takes these actions, which the panel and the automation
step use:

| Action | Parameters |
|---|---|
| `set_effect`, `set_palette` | `effect_id` or `palette_id`, optional `segment` |
| `apply_preset` | `preset_id`, optional `transition_ms` |
| `start_playlist` | `playlist_id` |
| `next_in_playlist` | none |
| `save_preset` | `save_preset` (slot 1 to 250), `preset_name`, `preset_quick_label`, `include_brightness` (default on), `include_segments`, `selected_only` |
| `save_playlist` | `slot`, `name`, `start` |
| `rename_preset` | `preset_id`, `name`, `quick_label` |
| `delete_preset` | `delete_preset` (the preset's number) |
| `set_power_on_preset` | `preset_id`, `on` |
| `nightlight` | `nightlight_on`, `nightlight_duration_min` (1 to 255, default 60), `nightlight_mode` (`instant`, `fade`, `color` or `sunrise`), `nightlight_target_pct` |
| `set_sync` | `sync_send`, `sync_receive` |
| `set_live_override` | `live_override`: 0 lets live data take over, 1 ignores it until it stops, 2 ignores it until the controller restarts |
| `stop_live` | none |
| `set_audio` | `audio` |
| `identify` | none; lights every segment bright white |
| `restart` | none |
| `install_firmware` | optional `version` |

For example:

```json
{ "action": "apply_preset", "preset_id": 3, "transition_ms": 2000 }
{ "action": "nightlight", "nightlight_on": true, "nightlight_duration_min": 30, "nightlight_mode": "fade" }
```

## Actions

These plugin actions appear on the plugin's page and to the Assistant and
hc-mcp. Actions that take `device_id` accept the controller's ID or address,
and can leave it out when there is only one controller.

| Action | Role | Timeout | Does |
|---|---|---|---|
| `discover_devices` | user | 20 s | Finds WLEDs over mDNS and from the WLED-Sync peers of known controllers. |
| `add_device` | admin | 20 s | Adds the WLED at `host`, with optional `name` and `area`. |
| `update_device` | admin | 15 s | Changes a controller's `host`, its own `poll_interval_secs`, or where its `catalog` is kept. |
| `remove_device` | admin | 15 s | Stops managing a controller. Its device leaves when the plugin restarts. |
| `republish_devices` | user | 15 s | Sends every controller's registration and controls to homeCore again. |
| `refresh_effects_palettes` | user | 15 s | Reads effect and palette names from every controller. |
| `refresh_presets` | user | 15 s | Reads presets from every controller. |
| `get_catalog` | read only | 20 s | Every effect with its controls and every palette with its colors. |
| `nodes` | read only | 15 s | The other WLEDs a controller sees on WLED-Sync. |
| `get_settings` | admin | 15 s | The controller's own settings (LED outputs, buttons, timers, sync, clock, network), with secrets hidden. |
| `apply_settings` | admin | 20 s | Changes the controller's settings. `restart: true` restarts it for settings that need one. |
| `backup` | admin | 30 s | Backs up a controller's presets and settings (secrets hidden) to the backups folder. |
| `list_backups`, `get_backup` | admin | 15 s | The kept backups, newest first, or one by file name. |
| `restore` | admin | 30 s | Puts back a backup's presets, settings or both. The controller's own secrets are kept. |
| `copy_presets` | admin | 30 s | Replaces one controller's presets with another's. |
| `copy_preset` | admin | 30 s | Copies one preset to another controller, or duplicates it on the same one. |
| `firmware_status` | read only | 15 s | What each controller runs and what is on offer. |
| `check_firmware` | user | 30 s | Checks GitHub for firmware now. |
| `install_firmware_file` | admin | 240 s | Installs a firmware file you upload: backs up, sends the file, waits for the controller and checks what it runs. |
| `firmware_file_begin`, `firmware_file_end` | admin | 60 s, 200 s | The steps around a firmware file the app sends to the controller itself. |
| `reboot` | admin | 15 s | Restarts every controller, or the one named by `host`. |

## Alerts

| Alert | Severity | On by default |
|---|---|---|
| Firmware update available | information | no (the System page lists updates either way) |
| Firmware update in progress | information | yes, so automations can hold off |
| Firmware update failed (the controller didn't come back, or came back on another version) | error | yes |
| Controller restarted by itself (its uptime went back with nobody asking; clears after a day) | warning | yes |

Turn them on or off, and choose where they go, in **Settings › Alerts**.

## Screens and cards

All of these ship with the plugin, so updating the plugin updates them.

The plugin's page (Settings › Plugins › WLED) lists the controllers, live or
polled, with their LEDs, signal and firmware. You can identify, restart or
remove each one, copy presets between controllers, back them all up and
browse the kept backups, update firmware on all of them, turn on unattended
updates at night, and change the plugin's settings.

A controller's panel opens when you tap the controller anywhere. Its tabs:

- Look: effects by name with their own sliders and options, palettes with
  their colors, colors, and white temperature.
- Segments: the strip drawn to scale, with boundaries you drag and each
  segment's LEDs, look, brightness and options. You can split, merge, add and
  delete segments.
- Presets: save what's running, rename, delete, pick the power-on preset,
  back up, restore, copy a preset to another controller, or duplicate it.
- Playlists: build and edit them, start one, skip to the next entry.
- Controller: nightlight, sync, live data, sound, the effect catalog, the
  controller's own timers, its setup (LED outputs, buttons and remote,
  network, clock), firmware, backups and restart.

On Home and in rooms, a controller's card shows on and off, the current look
as a strip of its colors, what it is running and how bright. At the large
size it also has presets to tap.

**Quick presets** is a card you add yourself (Edit, then Add a card). It shows
the presets you pick on the controllers you pick, and finds each preset by
name on every controller.

In the automation editor, a WLED step can apply a preset, start a playlist,
set a look (effect, palette, colors, speed and intensity, on one segment or
all of them), and control nightlight, power, sync and live data, on one
controller or several. Presets, playlists, effects and palettes show by name,
so a rule reads like "apply Halloween 1 on Eaves lights, fading over 2 s".

### Firmware

Each controller reports which build it runs and which project publishes that
build. The plugin checks that project's GitHub releases for the build's own
file on the channel you chose. Installing an update first backs the
controller up, then sends the file, waits for the controller to come back and
checks what it is running. A controller on a build nobody publishes is never
offered an update.

You can also install a firmware file of your own from the controller's panel.
The plugin only takes an ESP32 or ESP8266 firmware image (a `.bin`, or a
gzipped `.bin.gz`) of a plausible size, and refuses anything else before it
touches the controller.

**Install WLED updates by itself, at 03:00, one controller at a time**, on
the plugin's page, adds an ordinary automation you can open and change. At
03:00 it installs each waiting update in turn and stops at the first one that
doesn't take.

## Troubleshooting

When a controller's WebSocket closes, the plugin checks whether the
controller still answers. If it doesn't, the device shows offline. The plugin
reads it on the poll interval until the WebSocket connects again, and the
device's `connection` shows `poll` meanwhile.

If **Look for controllers** finds nothing, homeCore and the controllers are
probably on different subnets, or homeCore runs in a container on a bridge
network. Add
each controller by address, or list an address on the far side under
Cross-subnet hosts.

If a device has lost its controls in homeCore, run **Republish devices**.
After a firmware update changes the effect list, run **Refresh effects +
palettes**.

The plugin's log is on the **Log** tab of its page.
