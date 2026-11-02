---
id: roku
title: Roku players and TVs
sidebar_label: Roku
sidebar_position: 12
---

# Roku players and TVs (`hc-roku`)

This plugin brings Roku streaming players, Roku TVs and Roku soundbars into
homeCore over the [External Control Protocol](https://developer.roku.com/dev/docs/external-control-api)
(ECP), a plain-HTTP API that every Roku serves on port 8060.

Each Roku becomes one `media_player`. Rokus on the same network find
themselves over SSDP, so apart from the broker connection there is nothing to
configure.

## Before you start

On each Roku, set:

> Settings › System › Advanced system settings › Control by mobile apps
> › **Network access** = `Default` or `Permissive`

When this is **Disabled**, a Roku still reports what it is showing but refuses
every button press. homeCore points this out on the Roku's card on the plugin
page and in an alert ("Roku refuses control") with the same fix. When a
command is refused, the device's `last_command_error` says so too.

## Its screens

hc-roku carries its own screens, and the app shows them in place of its
generic ones. Channel icons need homeCore 0.1.92 and an app release later
than 0.1.27. On older versions the screens show each channel's name on a
coloured tile.

- **The plugin page** (Settings › Plugins › Roku) shows how many Rokus are
  answering, with "Look for Rokus now" and Settings. Each Roku gets a card
  with what it is showing, its five most-used channels (one tap to open), its
  room, model, address and network, Roku OS version, whether phone control is
  allowed, and its channel and input counts, plus "Open the remote" and
  "Refresh channels". Below the cards is advice for a Roku that refuses
  control, and for one that has moved or is gone.
- **A Roku's panel** opens when you tap its card. At the top are power and
  what it is showing: the channel with its icon and how far into the video,
  or the input. **Open a channel** lists the most-used channels with their
  icons, the open one highlighted, and **All N ›**. Then come three tabs:
  - Remote: Back, Home, the arrows and OK, instant replay, options, rewind,
    play/pause, fast-forward, volume − / mute / +, typing on the screen, and
    "Find the remote" on a Roku that supports it.
  - All channels: every installed channel from A to Z, with a search.
  - Inputs (TVs only): listed by the names you gave them on the TV.
- **Its card** on Home and in rooms shows the channel playing with its icon
  and position, plus play/pause, volume and power. On an input it reads
  "On · HDMI 1", and in standby it reads "Off" with a Turn on button. The
  large size adds four one-tap channels. A Roku that isn't answering gets the
  app's offline look.
- **The automation step** can open a channel (picked by its icon, from that
  Roku's own channels), switch input, turn the Roku on or off, or press a
  button a number of times.

**Channel icons** are each channel's own. They are read once from the Roku
and kept beside the plugin's settings (`.roku-files/icons/`, by channel and
version), so they still show while a Roku is off or unreachable and after a
restart. A Roku with phone control disabled refuses to send icons, and a
channel without one shows its name on a coloured tile.

**"Most used"** counts the channels opened from homeCore on each Roku, and the
counts are kept across restarts. Until there are any, the list follows the
Roku's own home-screen order.

## What a Roku reports

| Attribute | Notes |
|---|---|
| `on` | `true` when it is on: `PowerOn`, and also `DisplayOff` (a TV with its screen off and its sound on) |
| `power_mode` | Roku's own value: `PowerOn`, `DisplayOff`, `Ready` (standby), `Headless`, `PowerOff` |
| `state` | `playing` \| `paused` \| `stopped` (an app open, nothing playing) \| `idle` (home screen, an input, or off) \| `buffering` |
| `source`, `app_id`, `app_name`, `app_type`, `app_version` | The channel or input on screen. `source` is `"Home"` on the home screen and null while off |
| `is_tv_input` | True on an HDMI/AV input or live TV |
| `media_title`, `media_description` | The live-TV programme. Roku reports no title for streaming channels |
| `media_position`, `media_duration` | Seconds. `media_position_updated_at` records when the position was true; screens count on from there, so it is only republished when it jumps |
| `media_is_live`, `media_error`, `media_format`, `player_state` | From the Roku's player |
| `screensaver_active`, `screensaver_name` | |
| `muted` | What homeCore last set; a Roku can't report mute (see below) |
| `tv_channel`, `tv_channel_name`, `tv_channel_info`, `available_tv_channels` | Roku TVs only |
| `available_apps`, `available_inputs`, `available_sources` | Its channels (each with `icon` and `launches`) and inputs. Read whether it is on or in standby, and kept across restarts |
| `serial_number`, `network_type`, `is_tv`, `is_stick`, `ecp_control_enabled`, `headphones_connected` | |
| `supports_find_remote`, `supports_private_listening`, `supports_wake_on_wlan`, `supports_audio_volume_control`, `supports_tv_power_control` | Null when the Roku doesn't say. `supports_tv_power_control` is a player's control of its TV, so it is null on a Roku TV |
| `last_command_error` | Why the last command failed, in words; null once one succeeds |

Every key is always present, and a value that can't be read right now is
null. When a Roku stops answering it is shown offline and what it was doing is
cleared, though its channels stay. It is never removed automatically.

The model and Roku OS version are part of the device's hardware details
(shown with the device), not attributes. The full `device-info` (MAC
addresses, network name and every flag) is available through the
`device_info` action and never appears in state.

There is **no `volume` attribute**. ECP has volume up, volume down and mute
keys but reports no level, so there is nothing to show or set. Seeking is
missing for the same reason. `muted` is tracked from what homeCore sends, so
muting with the Roku's own remote goes unnoticed.

## Commands

Send commands to `homecore/devices/{id}/cmd`, or use
`PATCH /api/v1/devices/{id}/state`. A command is either a write to an
attribute or an `{"action": …}`.

**Attributes** you can write: `on`, `source` (a channel or input, by name or
id), `tv_channel`, `muted`, `state` (`playing` / `paused` / `stopped`), `key`
and `text`. When one command sets several, they run in a fixed order: power
first (followed by a wait for the Roku to report it is on), then what to show,
then the rest. A failure in one doesn't stop the others, and each failure is
recorded in `last_command_error`.

| Group | Actions |
|---|---|
| Power | `power_on`, `power_off`, `power_toggle` |
| Transport | `play`, `pause`, `play_pause`, `stop`, `rewind`, `fast_forward`, `instant_replay` |
| Navigation | `home`, `back`, `select`, `up`, `down`, `left`, `right`, `info`, `enter`, `backspace`, `find_remote` (where the Roku has one) |
| Volume | `volume_up`, `volume_down` (both take `count`), `set_mute` (`muted`), `mute` (toggles) |
| Live TV (TVs) | `channel_up`, `channel_down`, `tune` (`channel: "14.3"`) |
| Channels and inputs | `launch_app` (`app`, `content_id`, `media_type`, `params`), `select_source`, `install_app` |
| Raw input | `key` (`key`, `count`, `hold_ms` up to 10 000), `key_hold`, `key_down`, `key_up`, `text` (`text` up to 200 characters, `submit`) |

Each Roku is offered only what it has. A soundbar gets no tuner, channel or
input keys, and `find_remote` appears only on a Roku that can find its remote.

- **Commands to one Roku run in order**, one after another, and a burst of
  them is followed by a single check of what changed. Each ends in a
  `plugin_command_result` event, with an `error_code` of `control_disabled`,
  `unreachable`, `not_found`, `unsupported`, `invalid_params`, `stale` or
  `rejected` when it fails.
- **Opening a channel on a Roku that is off turns it on first.**
- `play` and `pause` are idempotent. Roku's Play key toggles, so both check
  what the Roku is doing first. `play_pause` toggles.
- `rewind` and `fast_forward` scan, getting faster with each press. A Roku has
  no "next".
- `stop` presses Back to leave playback. It does nothing on an input or live
  TV, where Back would leave the input.

```bash
# Turn on and open Netflix (power first, whatever the order)
curl -X PATCH localhost:8080/api/v1/devices/roku_yk00xf435811/state \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"source": "Netflix", "on": true}'

# Switch a TV to HDMI 1
curl -X PATCH localhost:8080/api/v1/devices/roku_yk00xf435811/state \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "select_source", "source": "HDMI 1"}'

# Type into a search box and submit
curl -X PATCH localhost:8080/api/v1/devices/roku_yl0001073725/state \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "text", "text": "the expanse", "submit": true}'
```

## Plugin actions

| Action | Purpose |
|---|---|
| `status` | Each Roku as the plugin last knew it: address, network, model, Roku OS, phone control, channel and input counts, what it shows, last error (read-only) |
| `discover_devices` | Look for Rokus now, over SSDP (when discovery is on) and at the listed and last-known addresses. A Roku that has moved is found by its serial number |
| `refresh_catalog` | Read the channels and inputs again for one Roku (`hc_id`) or all of them, fetching any new icons |
| `device_info` | The raw `device-info` of one Roku or all of them; the first thing to check when diagnosing a problem |
| `send_command` | Run one command and get its actual result back |
| `forget_device` | Forget a Roku that is gone for good (admin); this is "Forget it" on the page |
| `forget_stale_devices` | Forget every discovered Roku that isn't answering now (admin) |

## Alerts

| Kind | Means |
|---|---|
| `ecp_control_disabled` | The Roku's "Control by mobile apps" setting is disabled, or it refused a command, so homeCore can see it but not control it. Clears once a command goes through. |

A Roku that stops answering raises homeCore's own Offline alert.

## Setup

Install it from the registry (Plugins › Add) and set the broker connection.
Rokus on the network register themselves within a few seconds.

`[[devices]]` entries in its settings are optional. Add one to pin a device
id, to reach a Roku across a VLAN, or when running with
`discovery_enabled = false`, in which case the listed Rokus are the whole
list.

Other settings, with their defaults:

- `poll_interval_secs` (10) while a Roku is on, and
  `standby_poll_interval_secs` (60) while it is in standby or unreachable.
  ECP has no push channel, so every change is found by asking.
- `discovery_interval_secs` (900) between SSDP scans, which also catch DHCP
  address changes, and `discovery_timeout_secs` (4).
- `auto_add_discovered` (on) registers whatever discovery finds.
- `app_refresh_interval_secs` (3600) for re-reading installed channels and
  the TV channel lineup.
- `wake_on_lan` (on), `key_hold_ms` (500) and `type_delay_ms` (50), the gap
  between characters when typing, since Roku's on-screen keyboards drop keys
  sent faster.

## Moving, swapping, unplugging

- **A Roku is identified by its serial number.** What the plugin learns about
  each one (its id, address, MACs, model, capabilities, channels and launch
  counts) is kept in homeCore. After a restart every known Roku appears at
  once with its channels, including a TV that is fully off, which shows as
  offline.
- **Each answer's serial is checked.** When an address answers as a different
  Roku (because DHCP reassigned it, or two swapped), that Roku moves to the
  new address. The one that used to be there is looked for at the addresses
  where Rokus were listed or last seen, and over SSDP when discovery is on.
  Each keeps its id, name, room and automations, and one serial number never
  becomes two devices.
- **A Roku that stops answering** is looked for straight away, shown offline,
  and never removed. "Forget it" on the plugin page is for one that is gone
  for good. A Roku listed in Settings is removed there instead.
- **Powering on a TV that is fully off** needs Wake-on-LAN, because nothing on
  the TV is listening for PowerOn. The plugin learns the MACs while the TV
  answers and keeps them, so this works after a restart too. The packet goes
  to the network's broadcast address and to the TV's subnet (assumed to be a
  /24).

## Upgrading from 0.1.12

- `device_info` (the firmware dump), `model_name`, `model_number`,
  `software_version` and `friendly_name` are no longer attributes. The model
  and Roku OS version are now the device's hardware details, and the dump is
  the `device_info` action. MAC addresses and the network name are no longer
  in state.
- `supports_wake_on_lan` is now `supports_wake_on_wlan`. It was always Roku's
  Wi-Fi flag.
- `state` on an HDMI/AV input is now `idle` (it was `playing`), and `idle`
  while off (it was `stopped`). `source` is null while off (it was `"Home"`).
  Live TV still reads `playing`.
- `DisplayOff` (screen off, sound on) now reports `on: true`.
- New: `media_position_updated_at` and `last_command_error`, plus `icon` and
  `launches` on each channel in `available_apps`.
- The `next` and `previous` actions are gone. They were really Roku's scan
  keys, and `rewind` and `fast_forward` replace them. The `app_icon` action is
  also gone, because icons are now served as files.
- `launch_app` is labelled "Open a channel". Rules that used `next` or
  `previous` need changing.

## Notes on the protocol

- **Discovery is link-local.** SSDP does not cross VLANs or a Docker bridge
  network. Use `manual_hosts`, or [host networking](../getting-started/docker.md),
  for any Roku multicast can't reach. ECP itself is ordinary HTTP.
- **A Roku in standby still answers**, so its channel list is read in standby
  too.
- **Roku retired the search endpoint in Roku OS 12.0**, and it does nothing on
  current Rokus.
