---
id: roku
title: Roku players and TVs
sidebar_label: Roku
sidebar_position: 12
---

# Roku players and TVs (`hc-roku`)

The Roku plugin brings Roku streaming players, Roku TVs and Roku soundbars
into homeCore over Roku's
[External Control Protocol](https://developer.roku.com/dev/docs/external-control-api)
(ECP), a plain HTTP API that every Roku serves on port 8060. Each Roku becomes
one `media_player`. The plugin finds Rokus on the same network over SSDP, so
there is usually nothing to configure. It ships its own page, a panel with a
remote and channel icons, a card, and an automation step.

## Before you start

On each Roku, open *Settings › System › Advanced system settings › Control by
mobile apps* and set **Network access** to `Default` or `Permissive`. When it
is `Disabled`, a Roku still reports what it is showing but refuses every
button press. homeCore points this out on the plugin page and with the **Roku
refuses control** alert.

homeCore needs to reach each Roku on port 8060. Discovery uses SSDP
multicast, which doesn't cross VLANs or a Docker bridge network. For a Roku
that multicast can't reach, add its address under **Cross-subnet hosts**, or
run homeCore with [host networking](../getting-started/docker.md).

## Install and set up

1. Install Roku from **Settings › Plugins › Catalog**.
2. Rokus on the network register themselves within a few seconds. Use **Look
   for Rokus now** on the plugin's page to search again.
3. Give each Roku a name and room under **Devices** on the plugin's Settings
   tab.

A Roku is identified by its serial number, and its device id is
`roku_<serial>` in lowercase. A Roku that answered without a serial is named
by its address instead.

`[[devices]]` entries in the config file are optional. Add one to pin a
device id, to set a Roku's own port or poll interval, or when discovery is
off, in which case the listed Rokus are the whole list:

```toml
[[devices]]
host  = "192.168.1.45"
hc_id = "roku_living_room"
name  = "Living Room TV"
area  = "Living Room"
```

## Settings

| Setting | Key | Default | What it does |
|---|---|---|---|
| Auto-discover on the network | `roku.discovery_enabled` | on | Look for Rokus over SSDP. |
| Register discovered devices automatically | `roku.auto_add_discovered` | on | Off means discovery only reports what it finds, and only listed Rokus are registered. |
| Re-scan every | `roku.discovery_interval_secs` | 900 s | Time between SSDP scans. A scan also catches DHCP address changes. |
| Listen for replies | `roku.discovery_timeout_secs` | 4 s | How long each scan waits for answers. |
| Cross-subnet hosts | `roku.manual_hosts` | empty | Addresses of Rokus that SSDP can't reach. Each is probed directly on every scan. |
| Poll interval | `roku.poll_interval_secs` | 10 s | How often to ask a Roku that is on. ECP has no push channel, so every change is found by asking. |
| Standby poll interval | `roku.standby_poll_interval_secs` | 60 s | How often to ask a Roku in standby or not answering. |
| Request timeout | `roku.request_timeout_secs` | 5 s | How long to wait for a Roku to answer. |
| Refresh channel list every | `roku.app_refresh_interval_secs` | 3600 s | How often to read the installed channels, inputs and TV channel lineup again. |
| Wake with Wake-on-LAN | `roku.wake_on_lan` | on | Wake a Roku TV that is fully off. |
| Default key hold | `roku.key_hold_ms` | 500 ms | How long `key_hold` presses a key when the command doesn't say. |
| Typing key delay | `roku.type_delay_ms` | 50 ms | Gap between characters when typing, because Roku's on-screen keyboards drop keys sent faster. |
| Roku devices | `devices` | | Every Roku found or listed, with a name and room. |

The **Logging** section holds the usual plugin log settings: level, how much
is forwarded to homeCore, rotation (daily), rotate at size (100 MB), prune
after (never) and compression (on).

## Devices

Each Roku is a `media_player`. All of its attributes are always present, and
a value that can't be read right now is null.

| Attribute | Notes |
|---|---|
| `on` | `true` when it is on: `PowerOn`, and also `DisplayOff` (a TV with its screen off and its sound on). |
| `power_mode` | Roku's own value: `PowerOn`, `DisplayOff`, `Ready` (standby), `Headless`, `PowerOff`. |
| `state` | `playing`, `paused`, `stopped` (a channel open, nothing playing), `idle` (home screen, an input, or off) or `buffering`. Live TV reads `playing`. |
| `source`, `app_id`, `app_name`, `app_type`, `app_version` | The channel or input on screen. `source` is `"Home"` on the home screen and null while off. |
| `is_tv_input` | True on an HDMI or AV input, or live TV. |
| `media_title`, `media_description` | The live TV program. Roku reports no title for streaming channels. |
| `media_position`, `media_duration` | Seconds. `media_position_updated_at` records when the position was true. Screens count on from there, so the position is republished only when it jumps. |
| `media_is_live`, `media_error`, `media_format`, `player_state` | From the Roku's player. |
| `screensaver_active`, `screensaver_name` | |
| `muted` | What homeCore last set. A Roku can't report mute. |
| `tv_channel`, `tv_channel_name`, `tv_channel_info`, `available_tv_channels` | Roku TVs only. |
| `available_apps`, `available_inputs`, `available_sources` | Its channels (each with `icon` and `launches`) and inputs. Read in standby too, and kept across restarts. |
| `serial_number`, `network_type`, `is_tv`, `is_stick`, `ecp_control_enabled`, `headphones_connected` | |
| `supports_find_remote`, `supports_private_listening`, `supports_wake_on_wlan`, `supports_audio_volume_control`, `supports_tv_power_control` | Null when the Roku doesn't say. `supports_tv_power_control` is a player's control of its TV, so it is null on a Roku TV. |
| `last_command_error` | Why the last command failed, in words. Null once one succeeds. |

The model and Roku OS version are hardware details shown with the device,
not attributes. The full `device-info` (MAC addresses,
network name and every flag) comes from the `device_info` action and never
appears in state.

There is no `volume` attribute. ECP has volume up, volume down and mute keys
but reports no level, so there is nothing to show or set. Seeking is missing
for the same reason. `muted` follows what homeCore sends, so muting with the
Roku's own remote goes unnoticed.

### Commands

Send a command with `PATCH /api/v1/devices/{id}/state` or to
`homecore/devices/{id}/cmd`. A command is an attribute write or an
`{"action": ...}`.

You can write `on`, `source` (a channel or input, by name or id),
`tv_channel`, `muted`, `state` (`playing`, `paused` or `stopped`), `key` and
`text`. When one command sets several, they run in a fixed order: power first
(then a wait for the Roku to report it is on), then what to show, then the
rest. A failure in one doesn't stop the others, and each failure is recorded
in `last_command_error`.

| Group | Actions |
|---|---|
| Power | `power_on`, `power_off`, `power_toggle` |
| Transport | `play`, `pause`, `play_pause`, `stop`, `rewind`, `fast_forward`, `instant_replay` |
| Navigation | `home`, `back`, `select`, `up`, `down`, `left`, `right`, `info`, `enter`, `backspace`, `find_remote` (where the Roku has one) |
| Volume | `volume_up`, `volume_down` (both take `count`), `set_mute` (`muted`), `mute` (toggles) |
| Live TV (TVs) | `channel_up`, `channel_down`, `tune` (`channel: "14.3"`) |
| Channels and inputs | `launch_app` (`app`, `content_id`, `media_type`, `params`), `select_source` (`source`), `install_app` (`app_id`) |
| Raw input | `key` (`key`, `count`), `key_hold` (`key`, `hold_ms` from 100 to 10000), `key_down`, `key_up`, `text` (`text` up to 200 characters, `submit`) |

Each Roku is offered only what it has. A soundbar gets no tuner, channel or
input keys, and `find_remote` appears only on a Roku that can find its remote.

Commands to one Roku run in order, and a burst of them is followed by a
single check of what changed. Each ends in a `plugin_command_result` event.
When one fails, the event's `error_code` is `control_disabled`,
`unreachable`, `not_found`, `unsupported`, `invalid_params`, `stale` or
`rejected`.

Opening a channel on a Roku that is off turns it on first. Roku's Play key
toggles, so `play` and `pause` check what the Roku is doing before they press
it, and `play_pause` simply toggles. `rewind` and `fast_forward` scan, getting
faster with each press, and a Roku has no "next". `stop` presses Back to leave
playback, and does nothing on an input or live TV, where Back would leave the
input.

```bash
# Turn on and open Netflix (power goes first, whatever the order)
curl -X PATCH http://localhost:8080/api/v1/devices/roku_living_room/state \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"source": "Netflix", "on": true}'

# Switch a TV to HDMI 1
  -d '{"action": "select_source", "source": "HDMI 1"}'

# Type into a search box and submit
  -d '{"action": "text", "text": "the expanse", "submit": true}'
```

## Actions

These plugin actions go to `POST /api/v1/plugins/plugin.roku/command`.

| Action | Role | Timeout | What it does |
|---|---|---|---|
| `status` | read only | 5 s | Each Roku as the plugin last knew it: address, network, model, Roku OS, phone control, channel and input counts, what it shows, last error. |
| `discover_devices` | user | 60 s | Looks for Rokus now, over SSDP (when discovery is on) and at the listed and last known addresses. A Roku that has moved is found by its serial number. |
| `list_devices` | user | | Every Roku the plugin manages, with its address and whether it is answering. |
| `refresh_catalog` | user | 30 s | Reads the channels and inputs again for one Roku (`hc_id`) or all of them, and fetches any new icons. |
| `device_info` | user | 20 s | The raw `device-info` of one Roku (`hc_id`) or all of them. Check this first when a Roku misbehaves. |
| `send_command` | user | 45 s | Runs one device command and returns whether it worked. |
| `forget_device` | admin | 15 s | Forgets a Roku that is gone for good. This is **Forget it** on the page. |
| `forget_stale_devices` | admin | 30 s | Forgets every discovered Roku that isn't answering now. |

## Alerts

| Alert | Severity | When |
|---|---|---|
| Roku refuses control (`ecp_control_disabled`) | warning, on by default | The Roku's "Control by mobile apps" is disabled, or it refused a command, so homeCore can see it but not control it. It clears once a command goes through. |

A Roku that stops answering raises homeCore's own Offline alert. When no Roku
is configured or found, the plugin page shows the `no_devices_configured`
notice.

## Screens and cards

The plugin page (**Settings › Plugins › Roku**) shows how many Rokus are
answering, with **Look for Rokus now** and Settings. Each Roku gets a card
with what it is showing, its five most used channels (one tap to open), its
room, model, address and network, Roku OS version, whether phone control is
allowed, and its channel and input counts, plus **Open the remote** and
**Refresh channels**. Below the cards is advice for a Roku that refuses
control, and for one that has moved or is gone.

Tap a Roku's card to open its panel. At the top are power and what it is
showing: the channel with its icon and how far into the video, or the input.
**Open a channel** lists the most used channels with their icons, the open
one highlighted, and **All N**. Then come three tabs. **Remote** has Back,
Home, the arrows and OK, instant replay, options, rewind, play and pause,
fast forward, volume down, mute and up, typing on the screen, and **Find the
remote** on a Roku that supports it. **All channels** lists every installed
channel from A to Z, with a search. **Inputs**, on TVs only, lists inputs by
the names you gave them on the TV.

The card on Home and in rooms shows the channel playing with its icon and
position, plus play and pause, volume and power. On an input it reads "On ·
HDMI 1", and in standby it reads "Off" with a Turn on button. It comes in
compact, standard and large sizes; the large one adds four one-tap channels.
A Roku that isn't answering gets the app's offline look.

In automations, a Roku step can open a channel (picked by its icon from that
Roku's own channels), switch input, turn the Roku on or off, or press a
button a number of times.

Channel icons are each channel's own. The plugin reads them once from the
Roku and keeps them in `.roku-files/icons/` beside its config, by channel and
version, so they still show while a Roku is off and after a restart. A Roku
with phone control disabled refuses to send icons, and a channel without one
shows its name on a colored tile.

"Most used" counts the channels opened from homeCore on each Roku, and the
counts survive restarts. Until there are any, the list follows the Roku's own
home screen order.

## Troubleshooting

What the plugin learns about each Roku (its id, address, MACs, model,
capabilities, channels and launch counts) is kept in homeCore. After a
restart every known Roku appears at once with its channels, including a TV
that is fully off, which shows as offline.

The plugin checks the serial number in every answer. When an address answers
as a different Roku, because DHCP reassigned it or two swapped, that Roku
moves to the new address. The plugin looks for the one that used to be there
at the addresses where Rokus were listed or last seen, and over SSDP when
discovery is on. Each keeps its id, name, room and automations, and one
serial number never becomes two devices.

A Roku that stops answering is looked for straight away, shown offline with
what it was doing cleared (its channels stay), and never removed
automatically. Use **Forget it** on the plugin page for one that is gone for
good. A Roku listed in `[[devices]]` is removed there instead.

Turning on a Roku TV that is fully off needs Wake-on-LAN, because nothing on
the TV is listening for ECP. The plugin learns the MACs while the TV answers
and keeps them, so this works after a restart too. The packet goes to the
network's broadcast address and to the TV's subnet, taken as a /24.

| Problem | What to do |
|---|---|
| A Roku shows but buttons do nothing | Set *Control by mobile apps › Network access* to `Default` or `Permissive` on the Roku. |
| No Rokus are found | SSDP doesn't cross VLANs or a Docker bridge. Add each Roku under **Cross-subnet hosts**, or use host networking. |
| A Roku TV won't turn on from off | Make sure **Wake with Wake-on-LAN** is on, and that the TV answered at least once so the plugin knows its MAC. |
| A Roku behaves oddly | Run `device_info` for it and check what it reports. |

Changes between versions, including the attribute renames in 0.1.13, are in
the [release notes](../release-notes).

## Known limits

ECP reports no volume level and no mute state, and it can't seek. Roku
retired the search endpoint in Roku OS 12.0, so it does nothing on current
Rokus.
