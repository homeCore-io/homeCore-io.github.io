---
id: sonos
title: Sonos
sidebar_label: Sonos
sidebar_position: 7
---

# Sonos (`hc-sonos`)

The `hc-sonos` plugin finds the Sonos speakers on your network, registers each
one in HomeCore as a `media_player` device, and keeps its playback state in
sync over MQTT.

The plugin also has its own standalone HTTP API, on purpose. You can call it
directly if you like, but once a speaker is registered in HomeCore, automations
should address it by its HomeCore device ID.

## Its screens

All of these ship with the plugin, so updating the plugin updates them.

- **Its page** (Settings › Plugins › Sonos) shows:
  - how many speakers there are, how many are answering, and when they were
    found;
  - any speaker that isn't answering, with *Forget* for admins;
  - speakers that aren't in a room yet, with a way to place them;
  - the speakers **as the groups they play in**. Each group is one card with
    the music it is playing, one volume for the whole group and each speaker's
    own volume under it, plus *Change the group* and *Ungroup*;
  - your Sonos favourites with their artwork. Pick one, tick the speakers it
    should play on, and press Play;
  - the household's Sonos **alarms**, each with an on/off switch.
- **Play together** (*Group speakers…* on the page, or *Change the group*):
  tick the speakers that should play the same music. The one marked *playing
  from* is where the music comes from, and *Play from here* moves that role to
  another speaker. *All speakers* and *Each on its own* are shortcuts. The
  plugin builds the whole group in one go and reports back speaker by speaker:
  *joined*, *left*, *in the group*, or **no answer** for a speaker that is off
  or asleep. You can try a speaker that didn't answer again.
- **A speaker's panel** shows what it is playing: a track with its progress
  (tap the bar to jump), a live radio station (nothing to skip), or an input
  such as TV or line-in. Below that are the transport controls, mute and
  volume (and the group's volume when it is in one), then three tabs:
  - **Favourites**, to play one on this speaker;
  - **Group**, to tick the speakers that should play this one's music;
  - **Sound**: bass, treble, loudness, crossfade and the sleep timer. A
    soundbar also gets night mode and speech enhancement, and a speaker with
    an input gets *Play from* TV or line-in.

  If the speaker refuses a command, the panel says why.
- **A speaker's card** on Home and in rooms shows its artwork, what it is
  playing, the track's progress, play/pause and its volume. The compact form
  is one row with a play button. A speaker in a group shows the group's music.
- **Sonos speakers** is a card you add yourself (Edit → Add a card). It lists
  every speaker, or the ones ticked in its settings, with what each is playing,
  its volume and play/pause.
- **Sonos favourites** is another card you add yourself. It shows the
  favourites with their artwork. Tapping one plays it on the speaker chosen in
  the card's settings (*Play on*), or otherwise on whichever speaker is
  playing.
- **In automations**, a step on a speaker can be *Play a favourite*
  (optionally at a volume), *Volume*, *Pause* or *Group*. The step reads as a
  sentence, such as "play Piano for Sleeping on Bathroom at volume 20" or "play
  Bathroom's music on Office-1 and Office-2 too".

### What the screens send

| Command | Does |
|---|---|
| `{"action": "play_favorite", "favorite": "Piano for Sleeping", "volume": 20}` | Sets this speaker's volume, then plays the favourite (on its group, if it is in one). |
| `{"volume": 20}` | Sets this speaker's own volume. |
| `{"action": "set_group_volume", "volume": 24}` | Sets the whole group's volume, keeping the balance between speakers. |
| `{"action": "pause"}`, `{"action": "play"}` | Goes to the group's coordinator, whichever speaker it was sent to. |
| `{"action": "group", "members": ["sonos_office_1", "sonos_office_2"]}` | Makes this speaker's group exactly these speakers. See [Groups](#groups). |

The page and Play together use the plugin's own `group_speakers` action, which
does the same as `group` but answers speaker by speaker. The page also uses the
read-only `status` action to show when the speakers were last looked for.

## Groups

A Sonos group plays the music of one speaker, its *coordinator*. The other
speakers are *members*.

- A new group shows up straight away. The plugin listens for Sonos's
  group-change events and reads the groups again when one arrives, and also
  right after it groups or ungroups speakers itself. A poll every five minutes
  catches anything the events missed.
- Transport commands go to the group. Sonos refuses play, pause and similar
  commands sent to a member, so the plugin sends them to the coordinator
  instead. That covers `play`, `pause`, `stop`, `toggle_play_pause`, `next`,
  `previous`, `seek`, `play_favorite`, `play_playlist`, `play_uri`,
  `set_shuffle`, `set_repeat`, `set_crossfade`, `set_sleep_timer` and
  `set_group_volume`. Pause any speaker's card in a group and the whole group
  pauses.
- A member shows the group's music. Its state, title, artist, artwork,
  position and duration are the coordinator's. Its volume, mute and sound
  settings stay its own.
- `group_volume` is the whole group's volume, published on every speaker in a
  group of two or more (null for a speaker on its own).

Sending `{"action": "group", "members": [...]}` to the speaker that should lead
makes its group **exactly** the speakers listed. They join, everyone else in
its group leaves, and if the leader was itself a member of another group it
leaves that group first. An empty list makes it play on its own. Each speaker
gets four seconds to answer. One that doesn't is reported as `no_answer`, and
the rest still go ahead.

## SDK adoption

hc-sonos is built on the official Rust plugin SDK (`plugin-sdk-rs`) and
supports the full management protocol: heartbeat monitoring, remote
configuration and dynamic log level.

## What the plugin provides

Each speaker the plugin finds is registered automatically as a `media_player`
device. You don't need to create the device in HomeCore first.

For each player, HomeCore can see:

- the playback state, such as `playing` or `paused`
- volume and mute, and the group's volume
- the current track's title, artist, album and artwork, or the radio station
- the input playing, on a speaker that has one
- the group coordinator and group members
- the household's Sonos favourites and playlists

So HomeCore rules can target `sonos_living_room` or `sonos_kitchen` directly
instead of calling a hardcoded speaker URL.

## Discovery and automatic registration

`hc-sonos` finds speakers with SSDP and registers them as they are found. It
looks again every `discovery_interval_secs` (60 seconds by default).

SSDP is multicast, and a Docker **bridge** network does not carry it. Sonos
also delivers its event callbacks to an address the plugin advertises, and a
NATed container IP is not one the speakers can reach. If you run the plugin
in Docker, use host networking.

### Multicast routing on multi-NIC hosts

SSDP relies on UDP multicast (group `239.255.255.250:1900`). On a host with
more than one network interface, such as a dev setup with separate management
and IoT networks, the kernel may send multicast out of the wrong interface, and
discovery then fails without any error.

If `hc-sonos` finds no speakers but the Sonos app on the same network sees
them, check your routing table:

```bash
# Confirm where multicast is going
ip route get 239.255.255.250
```

Force the IoT-side interface as the multicast egress (replace `enp12s0` and the IoT subnet with yours):

```bash
sudo ip route add 239.255.255.250/32 dev enp12s0
```

For a permanent fix, configure your network manager (NetworkManager,
systemd-networkd, and so on) with route metrics that make the IoT interface win
for multicast destinations.

If multicast really can't be routed (a firewalled VLAN, a container with
restricted networking), list the speakers' addresses in `[sonos] manual_hosts
= ["192.168.10.5", ...]`. The plugin probes those addresses over HTTP
directly, with no multicast involved. The trade-off is that a new speaker on
the network needs a config edit and a plugin restart. An address may include a
port (`"192.168.10.5:1400"`); otherwise the plugin uses 1400.

### Turning SSDP off

With `[sonos] ssdp = false` the plugin sends nothing to the multicast group
and contacts only the `manual_hosts`. Use it where multicast is no use anyway,
or for a test homeCore that must never find, and so never command, the real
speakers in the house.

## Device IDs, renames and speakers that go quiet

Unless a `[[devices]]` entry pins it, the plugin derives a speaker's HomeCore
device ID from its room name:

| Sonos room | HomeCore device ID |
|---|---|
| `Living Room` | `sonos_living_room` |
| `Kitchen` | `sonos_kitchen` |
| `Office` | `sonos_office` |

Two speakers with the same name get `sonos_office` and `sonos_office_2`.

The ID is decided once and stored by Sonos UUID in
`.sonos-speakers.<plugin_id>.json` beside the config. It doesn't change after
that:

- A speaker renamed in the Sonos app keeps its ID. Its name in HomeCore
  follows the new Sonos name, unless you set a name override in HomeCore.
- A speaker that gets a new address from DHCP keeps its ID. The plugin follows
  it to the new address and subscribes to its events there.
- A speaker that sleeps for a week keeps its ID too.

A speaker is never removed because it stopped answering. If it misses two
heartbeats in a row (they are a minute apart), it is marked **offline**, shown
greyed out, and stays registered with the same ID, room, automations and
dashboards. It comes back **online** as soon as it answers again, and the
plugin subscribes to its events afresh, since it may have restarted and lost
its subscriptions. A known speaker that is asleep when the plugin starts is
marked offline a minute later, rather than left showing whatever it last
showed.

Home-theatre surrounds and Subs, and the second speaker of a stereo pair,
answer on the network like any speaker but belong to another one. Sonos marks
them as hidden, and the plugin leaves them out. A speaker that is later bonded
into another is marked offline.

The only way a speaker leaves HomeCore is the `forget_speaker` action: an
admin uses *Forget …* on the plugin page beside a speaker that isn't
answering. It is refused while the speaker still answers, since the plugin
would only find it again.

## Configuration

```toml
# config/config.toml

[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.sonos"
password    = ""

[sonos]
ssdp                    = true   # false: only the manual_hosts are contacted
discovery_interval_secs = 60
discovery_timeout_secs  = 5
manual_hosts            = []     # "192.168.1.50" or "192.168.1.50:1400"

[api]
enabled       = true
host          = "0.0.0.0"
port          = 5005
callback_host = "192.168.1.10"
```

| Setting | Default | |
|---|---|---|
| `sonos.ssdp` | `true` | Look for speakers with SSDP multicast. |
| `sonos.manual_hosts` | `[]` | Speakers to probe by address. |
| `sonos.discovery_interval_secs` | `60` | How often to look again. |
| `sonos.discovery_timeout_secs` | `5` | How long one look listens, and how long a manual host has to answer. |
| `api.enabled` | `true` | The plugin's HTTP API, which also receives the speakers' events. |
| `api.host`, `api.port` | `0.0.0.0`, `5005` | Where the API listens. |
| `api.callback_host` | | The address the speakers call back to with events. Set it to the server's LAN IP whenever `host` is `0.0.0.0`. |

## Optional speaker overrides

To give a speaker a specific HomeCore ID, pin it by Sonos UUID:

```toml
[[devices]]
uuid  = "RINCON_347E5C3D12E401400"
hc_id = "sonos_main_living_room"
name  = "Living Room"
area  = "living_room"
```

Only `hc_id` still takes effect. `name` and `area` are accepted so older
config files still load, but they are ignored: a speaker's name follows what
Sonos reports. To fix a speaker's name or room regardless of Sonos, set the
name or area override on the device in HomeCore, which the plugin never
touches.

Without an override, the plugin still discovers and registers the speaker
automatically. You don't need any `[[devices]]` entries for normal use.

## HomeCore device behavior

Once registered, a Sonos player appears like any other HomeCore device:

```bash
curl -s "http://localhost:8080/api/v1/devices?device_type=media_player" \
  -H "Authorization: Bearer $TOKEN" | jq
```

You can also inspect one player directly:

```bash
curl -s http://localhost:8080/api/v1/devices/sonos_living_room \
  -H "Authorization: Bearer $TOKEN" | jq
```

Each speaker publishes HomeCore's shared media-player attribute names. Every
key is always published (null when there is nothing to report), and only when
something changes.

| Attribute | Meaning |
|---|---|
| `state` | `playing`, `paused`, `stopped` or `buffering` |
| `volume` | This speaker's volume, 0 to 100. Writable. |
| `muted` | Mute state. Writable. |
| `media_title` | Current track title, or the station name |
| `media_artist` | Current artist |
| `media_album` | Current album |
| `media_image_url` | Artwork: the track's, or the station's logo |
| `media_duration` | Track duration in seconds. Null on a radio station. |
| `media_position` | Playback position in seconds. Null on a radio station. |
| `media_position_updated_at` | When `media_position` was true. Screens count on from there while it plays, so the position is only published again when it jumps (a seek, a new track, a pause). |
| `media_kind` | `radio` for a live stream (nothing to skip or seek), `track` for anything else, null when nothing is queued or an input is playing |
| `source` | `tv` (a soundbar's TV input) or `line_in` while an input plays, otherwise null |
| `group_coordinator` | HomeCore device ID of the coordinator |
| `group_members` | Array of grouped player IDs |
| `group_volume` | The group's volume, 0 to 100, while in a group; otherwise null |
| `shuffle`, `repeat`, `crossfade` | Play modes. `repeat` is `none`, `one` or `all`. |
| `bass`, `treble`, `loudness` | Sound settings. Bass and treble run from −10 to 10. |
| `night_mode`, `speech_enhancement` | On a soundbar only |
| `sleep_timer_ends_at` | When the group's sleep timer stops the music (RFC 3339), or null |
| `available_favorites`, `available_playlists` | Names of the household's Sonos favourites and playlists, read from one speaker every five minutes |
| `available_favorite_items` | The favourites with title and artwork |
| `last_command_error` | Why the last command to this speaker failed. Null once one succeeds. |

A speaker's registration also carries its model and firmware (for example
`Sonos`, `Sonos Five`, `85.0-64110`).

The older names `title`, `artist`, `album`, `position_secs` and
`duration_secs` are no longer published. They were duplicates of the `media_*`
attributes.

For a radio stream, Sonos reports the chunk of audio being fetched as the
"track": its title is a filename and it has no artwork. The plugin publishes
the **station** instead, with its name and logo, and `media_kind` is `radio`.

## Controlling Sonos through HomeCore

For normal automation, use the HomeCore device command path:

```bash
# Play
curl -s -X PATCH http://localhost:8080/api/v1/devices/sonos_living_room/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "play"}'

# Pause
curl -s -X PATCH http://localhost:8080/api/v1/devices/sonos_living_room/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "pause"}'

# Set volume (a write to the writable `volume` attribute, 0–100)
curl -s -X PATCH http://localhost:8080/api/v1/devices/sonos_living_room/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"volume": 30}'
```

Besides writing `volume` and `muted`, you can send these actions. Volume is
clamped to 0 to 100, and bass and treble to −10 to 10.

| Action | Params | Notes |
|---|---|---|
| `play`, `pause`, `stop`, `toggle_play_pause`, `next`, `previous` | | Sent to the group's coordinator. |
| `seek` | `position` (seconds) | |
| `set_volume`, `set_mute` | `volume`, `muted` | This speaker's own. |
| `volume_up`, `volume_down` | `step` (1 to 100, default 5) | Handy for a keypad button. |
| `set_group_volume` | `volume` | The whole group's. A speaker on its own takes it as its volume. |
| `set_shuffle`, `set_repeat`, `set_bass`, `set_treble`, `set_loudness` | | `repeat` must be `none`, `one` or `all`. |
| `set_crossfade` | `crossfade` | Applies to the group. |
| `set_sleep_timer` | `minutes` (0 cancels) | Applies to the group. |
| `set_night_mode`, `set_speech_enhancement` | `night_mode`, `speech_enhancement` | Offered only on a soundbar. |
| `select_source` | `source`: `tv` or `line_in` | Offered with the inputs the speaker has. |
| `play_favorite` | `favorite`, optional `volume` | The volume is set on this speaker first, even when the favourite plays on its coordinator. A station starts at once; an album or playlist goes through the queue, from the top. |
| `play_playlist`, `play_uri` | `playlist`, `uri` | A Sonos playlist, or a container URI, played through the queue. |
| `join` | `coordinator` (device ID) | Join that speaker's group. |
| `unjoin` | | Leave the group. |
| `group` | `members` (device IDs) | Make this speaker's group exactly these. See [Groups](#groups). |

Every command reports how it went. If it fails (the speaker or its group's
coordinator isn't answering, the action is unknown, a parameter is missing or
wrong, the favourite doesn't exist, or the speaker refuses), the plugin sets
the speaker's `last_command_error` and publishes a `plugin_command_result`
event with `{plugin_id, device_id, operation, success, error, error_code}`.
`error_code` is one of `no_answer`, `unknown_action`, `invalid_params`,
`not_found` or `rejected`. A later success clears the error.

### Named content commands

Rules usually want named content: play a favourite or a playlist by its name.

```bash
# Play a Sonos favorite by name
curl -s -X PATCH http://localhost:8080/api/v1/devices/sonos_living_room/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "play_favorite", "favorite": "Dinner Jazz"}'

# Play a Sonos playlist by name
curl -s -X PATCH http://localhost:8080/api/v1/devices/sonos_living_room/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "play_playlist", "playlist": "Dinner"}'

# Generic media command form
curl -s -X PATCH http://localhost:8080/api/v1/devices/sonos_living_room/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "play_media", "media_type": "favorite", "name": "Dinner Jazz"}'
```

The plugin looks up the favourite or playlist by name, so your automation
doesn't need to know its transport URI. `play_media` is still accepted
(`media_type` is `favorite`, `playlist` or `uri`) but isn't listed among the
speaker's declared actions; the three specific actions are.

## Rule example

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
            device_id: "living_room.sonos",
            state: { "action": "play_favorite", "favorite": "Dinner Jazz" },
        )),
    ],
)
```


This is better than an HTTP `CallService` action for three reasons. The rule
names a stable HomeCore device. The plugin can rediscover speakers and follow
IP changes without the rule changing. And favourites and playlists stay named
content instead of embedded transport details.

## Plugin actions

hc-sonos declares these [capability actions](./capabilities). They appear in
the homeCore admin UI and in hc-mcp's `list_plugin_actions`.

| Action | Role | Does |
|---|---|---|
| `group_speakers` | user | The `group` command, answered speaker by speaker. Play together uses it. |
| `status` | read-only | Speakers known, how many answer and which don't (`offline`), known speakers not found since the plugin started (`not_found`), when discovery last looked (`last_sweep`), and whether it uses SSDP. |
| `forget_speaker` | admin | `{"device_id": …}`: removes a speaker that is gone for good. Refused while it answers. |
| `list_alarms` | read-only | The household's alarms: `{id, time, repeats, enabled, device_id, room, volume, plays}`. |
| `set_alarm` | user | `{"id": …, "enabled": true}` or `false`: switches one alarm on or off and leaves the rest of it alone. |
| `rediscover_speakers` | user | Runs a discovery sweep now and registers every speaker found again, restoring anything homeCore lost. |
| `discover_speakers` | user, streaming | Runs a discovery sweep and streams what it finds. |

### `group_speakers`

`{"leader": "sonos_office_1", "members": ["sonos_office_2", "sonos_bathroom"]}`
answers like this:

```json
{"status": "partial", "leader": "sonos_office_1",
 "results": [{"device_id": "sonos_office_2", "name": "Office-2", "result": "joined"},
             {"device_id": "sonos_living_room", "name": "Living Room", "result": "no_answer"}]}
```

`status` is `ok` or `partial`. Each result is `joined`, `left`, `already`,
`no_answer` or `failed`.

### `discover_speakers`

Runs SSDP and manual-host discovery and sends each speaker as a stream item as
soon as it is found, so the UI fills in as it goes instead of waiting for the
whole discovery window.

Each `item_add` carries `{uuid, room_name, host_port, status}`, keyed on
`uuid`. `status` is `discovered`, or `unreachable` for a speaker that answered
SSDP but couldn't be read. Speakers it finds are also passed to the plugin's
normal discovery path, so any new ones are registered exactly as if the
periodic sweep had found them. The final result is `{discovered, count}`.

Manifest: `concurrency: single`, `requires_role: user`, `timeout_ms: 60_000`,
`item_key: "uuid"`. It cannot be cancelled.

Use it from the admin UI when a speaker isn't appearing. The live list shows
whether the speaker was found at all (pointing to a network or multicast
problem) or was found but failed a later step.

### `rediscover_speakers`

Asks the discovery loop for an immediate sweep, without a stream, and returns
`{"status": "ok"}` straight away. Use it from rules or scripts when you just
want to force a discovery now.

## Notices

Problems show up as **notices** on the plugin's card in the web UI. A notice
reflects current state, unlike a log line.

| Code | Means |
|---|---|
| `no_speakers_found` | A discovery sweep finished and found nothing, usually because of the Docker bridge network problem described above. Clears as soon as a speaker appears. |
| `events_off` | The HTTP API is off, so speakers have nowhere to send their events. State is only as fresh as the one-minute heartbeat. |
| `callback_host_unset` | The API listens on every interface but no `callback_host` is set, so speakers would be told to call back to 127.0.0.1, which is themselves. |

## Standalone HTTP API

The plugin's own HTTP API is still available and supported. It is useful for:

- running the plugin on its own, outside HomeCore
- manual testing and debugging
- Sonos-specific tasks that HomeCore device commands don't cover yet, such as
  queue management

Examples:

```bash
# Direct plugin endpoint
curl http://localhost:5005/Living%20Room/play

# Browse favorites
curl http://localhost:5005/favorites | jq

# Browse playlists
curl http://localhost:5005/playlists | jq
```

For everyday automation inside HomeCore, use the HomeCore device ID, and keep
the plugin's HTTP API for the cases it doesn't cover.

## Troubleshooting

| Problem | What to check |
|---|---|
| Speaker never appears in HomeCore | Check that the plugin is running and the speaker is on the same LAN. In Docker, use host networking. Run `discover_speakers` to see what the plugin can find. |
| Speaker appears but commands do nothing | Check that the device is online and that the plugin can reach the speaker. Look at its `last_command_error`. |
| Speaker shows as offline | It missed two heartbeats. It comes back by itself when it answers again. If it is gone for good, use *Forget* on the plugin page. |
| Favorites or playlists are empty | Wait for the next content refresh (every five minutes), then check `available_favorites` and `available_playlists` on the device. |
| Rules still use Sonos URLs | Replace `call_service` actions with `set_device_state` targeting the HomeCore device ID. |
| GENA callbacks fail | Check that `api.callback_host` is reachable from the Sonos speakers. |
| A new group takes minutes to show | Group-change events arrive at the same callback address, so check `api.callback_host`. |
| A speaker says "no answer" when grouping | It didn't reply within four seconds because it is off, asleep or unreachable. Try again from Play together. |
