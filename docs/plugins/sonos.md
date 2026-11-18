---
id: sonos
title: Sonos
sidebar_label: Sonos
sidebar_position: 7
---

import PluginFacts from '@site/src/components/PluginFacts';

# Sonos (`hc-sonos`)

<PluginFacts
  mark="So"
  kind="media"
  summary="Finds the Sonos speakers on your network and makes each one a homeCore media player."
  version="0.1.22"
  runs="Under core (Rust)"
  talks="Your network"
  account="None"
  devices={["media_player"]}
  source="https://github.com/homeCore-io/homeCore/tree/develop/plugins/hc-sonos"
  setup="#install-and-set-up"
/>

The Sonos plugin finds the Sonos speakers on your network and makes each one a
homeCore `media_player` device. You can see what each speaker plays, control
playback, volume and sound, play favorites and playlists by name, group
speakers, and switch the household's Sonos alarms on and off. It brings its
own page, panel, cards and automation step.

The plugin talks to the speakers directly on your network. It doesn't use a
Sonos account.

## Before you start

- Sonos speakers on the same network as homeCore, or reachable from it.
- Speakers are found with SSDP multicast (`239.255.255.250:1900`). If
  multicast doesn't reach them, list their addresses under Manual hosts.
- The plugin reads speakers on port 1400.
- Speakers report changes by calling the plugin back on its HTTP API (port
  5005 by default). They must be able to reach homeCore at the address set as
  Callback host.
- In Docker, use host networking. A bridge network carries no SSDP, and the
  speakers can't reach a NATed container address to deliver their events.

## Install and set up

1. Install Sonos from **Settings › Plugins › Catalog**.
2. Open **Settings › Plugins › Sonos › Settings** and set **Callback host** to
   homeCore's LAN address, for example `192.168.1.10`. It is required while
   the API listens on every interface (the default).
3. Speakers appear by themselves as they are found. The plugin looks again
   every minute.

There is nothing to pair. To see what the plugin can find, run **Discover
speakers** from the plugin's page.

### Device IDs

A speaker's device ID comes from its Sonos room name: `Living Room` becomes
`sonos_living_room`. Two speakers with the same name get `sonos_office` and
`sonos_office_2`. The ID is decided once and stored by the speaker's Sonos
UUID in `.sonos-speakers.<plugin_id>.json` beside the config, so it doesn't
change after that:

- A speaker renamed in the Sonos app keeps its ID. Its name in homeCore
  follows the new Sonos name, unless you set a name in homeCore.
- A speaker that gets a new address from DHCP keeps its ID. The plugin follows
  it and subscribes to its events there.
- A speaker that sleeps for a week keeps its ID too.

To choose an ID yourself, pin it by UUID in the settings file:

```toml
[[devices]]
uuid  = "RINCON_000000000000001400"
hc_id = "sonos_main_living_room"
```

Only `hc_id` takes effect. `name` and `area` are still accepted so older
files load, but they are ignored. Set a speaker's name or room on the device
in homeCore instead, which the plugin never overwrites.

Home theater surrounds and Subs, and the second speaker of a stereo pair,
belong to another speaker. Sonos marks them hidden, and the plugin leaves
them out. A speaker that is later bonded into another is marked offline.

## Settings

These are under **Settings › Plugins › Sonos › Settings**.

| Setting | Key | Default | What it does |
|---|---|---|---|
| Look for speakers on the network | `sonos.ssdp` | on | SSDP discovery. Off: only the manual hosts are contacted. Turn it off where multicast doesn't work, or on a test homeCore that must never find the real speakers. |
| Discovery interval | `sonos.discovery_interval_secs` | 60 s | How often to look again. Minimum 5. |
| Scan duration | `sonos.discovery_timeout_secs` | 5 s | How long each search listens, and how long a manual host has to answer. |
| Manual hosts | `sonos.manual_hosts` | empty | Speaker addresses to probe directly, for example `192.168.1.50` or `192.168.1.50:1400`. Port 1400 if none is given. |
| Enable HTTP API | `api.enabled` | on | The plugin's own HTTP API. It also receives the speakers' events, so turning it off leaves state only as fresh as the one-minute check. |
| Bind address | `api.host` | `0.0.0.0` | Where the API listens. Speakers deliver their events here, so keep it reachable from the LAN. |
| Port | `api.port` | 5005 | The API's port. |
| Callback host | `api.callback_host` | none | The LAN address speakers call back to with events. Required when the API listens on `0.0.0.0`; without it speakers are told 127.0.0.1, which is themselves. |
| Allow control from other machines | `api.allow_remote_control` | off | Off, the web page and the control routes answer only requests from this machine; other machines get `403 Forbidden`. On, anyone who can reach the port can control the speakers. The speakers' event callbacks are accepted from the network either way. See [The plugin's own HTTP API](#the-plugins-own-http-api). |
| Speakers | `devices` | | Each speaker's name and room in homeCore. |

The Logging section has the usual level, forwarding, rotation and pruning
settings. A new speaker found only through Manual hosts needs a settings edit
and a plugin restart.

## Devices

Each speaker is a `media_player`. Every attribute is always present (null
when there is nothing to report), and the plugin publishes only when
something changes.

| Attribute | Meaning |
|---|---|
| `state` | `playing`, `paused`, `stopped` or `buffering` |
| `volume` | This speaker's volume, 0 to 100. Writable. |
| `muted` | Writable. |
| `media_title`, `media_artist`, `media_album` | The track, or the station name for radio |
| `media_image_url` | The track's artwork, or the station's logo |
| `media_duration`, `media_position` | In seconds. Null on radio. |
| `media_position_updated_at` | When `media_position` was read. Screens count on from there while it plays, so the position is published again only when it jumps (a seek, a new track, a pause). |
| `media_kind` | `radio` for a live stream, `track` for anything else, null when nothing is queued or an input is playing |
| `source` | `tv` or `line_in` while an input plays, otherwise null |
| `group_coordinator` | Device ID of the speaker whose music this one plays |
| `group_members` | Device IDs in the group |
| `group_volume` | The group's volume, 0 to 100, in a group of two or more; otherwise null |
| `shuffle`, `repeat`, `crossfade` | Play modes. `repeat` is `none`, `one` or `all`. |
| `bass`, `treble`, `loudness` | Bass and treble run from -10 to 10. |
| `night_mode`, `speech_enhancement` | On a soundbar only |
| `sleep_timer_ends_at` | When the group's sleep timer stops the music, or null |
| `available_favorites`, `available_playlists` | Names of the household's favorites and playlists, read every five minutes |
| `available_favorite_items` | The favorites with title and artwork |
| `last_command_error` | Why the last command failed. Null once one succeeds. |

A speaker's registration also carries its model and firmware version.

For a radio stream, Sonos reports the chunk of audio being fetched as the
track, with a file name for a title and no artwork. The plugin publishes the
station's name and logo instead, and `media_kind` is `radio`.

### Commands

Write `volume` or `muted` directly, or send an action:

```json
{ "volume": 30 }
{ "action": "play" }
{ "action": "play_favorite", "favorite": "Dinner Jazz", "volume": 20 }
{ "action": "group", "members": ["sonos_office_1", "sonos_office_2"] }
```

| Action | Parameters | Notes |
|---|---|---|
| `play`, `pause`, `stop`, `toggle_play_pause`, `next`, `previous` | | Sent to the group's coordinator. |
| `seek` | `position` (seconds) | |
| `set_volume`, `set_mute` | `volume`, `muted` | This speaker only. |
| `volume_up`, `volume_down` | `step` (1 to 100, default 5) | Handy for a keypad button. |
| `set_group_volume` | `volume` | The whole group, keeping the balance between speakers. A speaker on its own takes it as its volume. |
| `set_shuffle`, `set_repeat` | `shuffle`, `repeat` | `repeat` is `none`, `one` or `all`. |
| `set_bass`, `set_treble`, `set_loudness` | `bass`, `treble` (-10 to 10), `loudness` | |
| `set_crossfade` | `crossfade` | Applies to the group. |
| `set_sleep_timer` | `minutes` (0 to 1439; 0 cancels) | Applies to the group. |
| `set_night_mode`, `set_speech_enhancement` | `night_mode`, `speech_enhancement` | Offered only on a soundbar. |
| `select_source` | `source`: `tv` or `line_in` | Offered with the inputs the speaker has. |
| `play_favorite` | `favorite`, optional `volume` | Sets this speaker's volume first, then plays the favorite on its group. A station starts at once; an album or playlist goes through the queue from the top. |
| `play_playlist` | `playlist` | A Sonos playlist by name, through the queue. |
| `play_uri` | `uri` | A container URI, through the queue. |
| `join` | `coordinator` (device ID) | Join that speaker's group. |
| `unjoin` | | Leave the group. |
| `group` | `members` (device IDs) | Make this speaker's group exactly these. |

Volume is clamped to 0 to 100. The older `{"action": "play_media",
"media_type": "favorite", "name": "..."}` form still works, with `media_type`
`favorite`, `playlist` or `uri`.

Every command reports how it went. When one fails (the speaker or its
coordinator isn't answering, the action is unknown, a parameter is missing or
wrong, the favorite doesn't exist, or the speaker refuses), the plugin sets
`last_command_error` and publishes a `plugin_command_result` event with
`plugin_id`, `device_id`, `operation`, `success`, `error` and `error_code`.
`error_code` is `no_answer`, `unknown_action`, `invalid_params`, `not_found`
or `rejected`.

A rule that plays a favorite when a switch turns on:

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Dinner music",
    enabled: true,
    priority: 10,
    trigger: DeviceStateChanged(
        device_id: "dining_room.music_switch",
        attribute: Some("on"),
        to: Some(true),
    ),
    actions: [
        RuleAction(action: SetDeviceState(
            device_id: "sonos_living_room",
            state: { "action": "play_favorite", "favorite": "Dinner Jazz" },
        )),
    ],
)
```

### Groups

A Sonos group plays the music of one speaker, its coordinator. The others are
members.

Sonos refuses play, pause and similar commands sent to a member, so the
plugin sends them to the coordinator. That covers `play`, `pause`, `stop`,
`toggle_play_pause`, `next`, `previous`, `seek`, `play_favorite`,
`play_playlist`, `play_uri`, `set_shuffle`, `set_repeat`, `set_crossfade`,
`set_sleep_timer` and `set_group_volume`. Pause any speaker in a group and the
whole group pauses.

A member shows the group's music: its state, title, artist, artwork, position
and duration are the coordinator's. Its volume, mute and sound settings stay
its own.

`{"action": "group", "members": [...]}`, sent to the speaker that should lead,
makes its group exactly the speakers listed. They join, everyone else in its
group leaves, and if the leader was a member of another group it leaves that
first. An empty list makes it play on its own. Each speaker gets four seconds
to answer. One that doesn't is reported as `no_answer`, and the rest still go
ahead.

New groups show up at once. The plugin listens for Sonos's group change
events, reads the groups again right after it groups speakers itself, and
checks every five minutes for anything the events missed.

## Actions

These plugin actions appear on the plugin's page and to the Assistant and
hc-mcp.

| Action | Role | Timeout | Does |
|---|---|---|---|
| `group_speakers` | user | 30 s | The `group` command, answered speaker by speaker. Takes `leader` and `members`. |
| `status` | read only | 5 s | Speakers known, how many answer and which don't (`offline`), known speakers not seen since the plugin started (`not_found`), when discovery last looked (`last_sweep`), and whether it uses SSDP. |
| `forget_speaker` | admin | 10 s | Removes a speaker that is gone for good, by `device_id`. Refused while it still answers, since it would only be found again. |
| `list_alarms` | read only | 10 s | The household's alarms: `id`, `time`, `repeats`, `enabled`, `device_id`, `room`, `volume`, `plays`. |
| `set_alarm` | user | 10 s | `{"id": "...", "enabled": false}` switches one alarm on or off and leaves the rest of it alone. |
| `rediscover_speakers` | user | default | Runs a search now and registers every speaker found again. Returns at once. |
| `discover_speakers` | user | 60 s | Runs a search and streams each speaker as it is found, with `uuid`, `room_name`, `host_port` and `status` (`discovered`, or `unreachable` for one that answered SSDP but couldn't be read). New speakers are registered as usual. |

`group_speakers` answers like this:

```json
{"status": "partial", "leader": "sonos_office_1",
 "results": [{"device_id": "sonos_office_2", "name": "Office-2", "result": "joined"},
             {"device_id": "sonos_living_room", "name": "Living Room", "result": "no_answer"}]}
```

`status` is `ok` or `partial`. Each result is `joined`, `left`, `already`,
`no_answer` or `failed`.

## Alerts

The plugin raises no alerts of its own. It shows these notices on its page,
each cleared when the problem goes away:

| Notice | Means |
|---|---|
| `no_speakers_found` | A search finished and found nothing. Often a Docker bridge network or multicast routing. Clears when a speaker appears. |
| `events_off` | The HTTP API is off, so speakers have nowhere to send events. State is only as fresh as the one-minute check. |
| `callback_host_unset` | The API listens on every interface but no Callback host is set, so speakers would call back to themselves. |

## Screens and cards

All of these ship with the plugin, so updating the plugin updates them.

The plugin's page (Settings › Plugins › Sonos) shows how many speakers there
are, how many answer, and when they were found. It lists any speaker that
isn't answering (with Forget for admins), speakers not yet in a room, and the
speakers as the groups they play in. Each group is a card with its music, one
volume for the group and each speaker's own volume, and buttons to change the
group or ungroup. Below that are your Sonos favorites with their artwork
(pick one, tick the speakers, press Play) and the household's alarms, each
with an on and off switch.

Play together (Group speakers on the page, or Change the group) lets you tick
the speakers that should play the same music. The one marked "playing from" is
where the music comes from, and Play from here moves that role. All speakers
and Each on its own are shortcuts. The result comes back speaker by speaker:
joined, left, in the group, or no answer for a speaker that is off or asleep,
which you can try again.

A speaker's panel shows what it plays: a track with its progress (tap the bar
to jump), a radio station, or an input such as TV or line in. Below are the
transport controls, mute and volume (and the group's volume in a group), then
three tabs. **Favourites** plays one on this speaker, and **Group** ticks the
speakers that should play this one's music. **Sound** has bass, treble,
loudness, crossfade and the sleep timer, plus night mode and speech
enhancement on a soundbar and Play from TV or line in on a speaker with an
input. If the speaker refuses a command, the panel says why.

A speaker's card on Home and in rooms shows its artwork, what it plays, the
track's progress, play and pause, and its volume. The compact form is one row
with a play button.

You can add two cards yourself (Edit, then Add a card). **Sonos speakers**
lists every speaker, or the ones you choose, with what each plays, its volume
and play and pause. **Sonos favourites** shows the favorites with artwork;
tapping one plays it on the speaker chosen in the card's settings, or on
whichever speaker is playing.

In the automation editor, a step on a speaker can play a favorite (with a
volume if you like), play a playlist, set the volume, pause, or group
speakers. The step reads as a sentence, such as "play Piano for Sleeping on
Bathroom at volume 20".

## Troubleshooting

The plugin asks every speaker for its full state once a minute. A speaker
that misses two of these in a row is marked offline and grayed out, but it
stays registered with the same ID, room, automations and dashboards. It comes
back online as soon as it answers, and the plugin subscribes to its events
again in case it restarted. A speaker is never removed for going quiet; only
Forget removes one.

| Problem | What to check |
|---|---|
| A speaker never appears | It must be on the same network, or listed under Manual hosts. In Docker, use host networking. Run Discover speakers to see what the plugin can find. |
| Changes show up a minute late, or new groups take minutes | Speakers can't deliver events. Check that Callback host is homeCore's LAN address and the speakers can reach port 5005. |
| A speaker is offline | It missed two checks. It comes back by itself when it answers. If it is gone for good, use Forget on the plugin's page. |
| Commands do nothing | Look at the speaker's `last_command_error`. |
| Favorites or playlists are empty | They are read every five minutes. Check `available_favorites` and `available_playlists` after that. |
| Grouping says "no answer" | That speaker didn't reply within four seconds because it is off, asleep or unreachable. Try again from Play together. |
| The HTTP API answers `403 Forbidden` | The request came from another machine. Call it from the homeCore host, or turn on Allow control from other machines. The log says "Refused a Sonos HTTP API request from another machine" with the caller's address. |

On a host with more than one network interface, the kernel may send
multicast out the wrong one, and the search fails without an error. If the
plugin finds nothing but the Sonos app on the same network does, check where
multicast goes:

```bash
ip route get 239.255.255.250
```

Then send it out the interface on the speakers' network (replace `enp12s0`
with yours):

```bash
sudo ip route add 239.255.255.250/32 dev enp12s0
```

To make that permanent, set route metrics in your network manager. If
multicast can't be routed at all, use Manual hosts.

The plugin's log is on the **Log** tab of its page.

## The plugin's own HTTP API

The plugin also serves its own HTTP API on port 5005, independent of
homeCore, with a web page at `/` for browsing speakers, favorites,
playlists, now playing and group state. It is useful for testing and for
things homeCore commands don't cover yet, such as the queue:

```bash
curl http://192.168.1.10:5005/zones
curl http://192.168.1.10:5005/favorites
curl http://192.168.1.10:5005/Living%20Room/play
curl http://192.168.1.10:5005/Living%20Room/queue
```

Other routes include `/{room}/pause`, `/{room}/volume/{level}`,
`/{room}/favorite/{index}`, `/{room}/playlist/{index}`, `/{room}/join/{target}`,
`/{room}/leave`, `/{room}/clearqueue` and `/pauseall`. The favorite and
playlist routes take the item's position (counting from 0) in `/favorites` or
`/playlists`. In automations, use the homeCore device instead.

This API has no sign-in, so by default it answers only requests from the
machine homeCore runs on: loopback, or that machine's own address. A rule on
the homeCore host calling `http://192.168.1.10:5005/Kitchen/play` works.
Requests from any other machine, including a browser opening the web page,
get `403 Forbidden`. The speakers' event callbacks (`/sonos/callback/...`)
are always accepted from the network.

To use the API from another machine, run the caller on the homeCore host, or
turn on **Allow control from other machines** (`api.allow_remote_control =
true`). With it on, anyone who can reach port 5005 can control the speakers,
so keep that port inside your home network.

## Known limits

- Queue management is only in the plugin's HTTP API, not in homeCore
  commands.
- The plugin raises no alerts; an offline speaker shows on its device and the
  plugin's page.
