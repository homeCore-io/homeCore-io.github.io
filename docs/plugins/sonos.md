---
id: sonos
title: Sonos
sidebar_label: Sonos
sidebar_position: 7
---

# Sonos (`hc-sonos`)

The `hc-sonos` plugin discovers Sonos speakers on your network, registers them as HomeCore `media_player` devices, and keeps transport state in sync through MQTT.

It also keeps its own standalone HTTP API. That is intentional. You can use the plugin directly if you want, but once a speaker is registered in HomeCore the preferred automation path is through the HomeCore device ID.

## Its screens

All of these come with the plugin itself — update the plugin, and they update.

- **Its page** (Settings › Plugins › Sonos): how many speakers there are and
  when they were found; speakers that are in no room yet, with a way to place
  them; the speakers **as the groups they play in** — a group is one card with
  the music it plays, one volume for the whole group and each speaker's own
  volume under it, and *Change the group* / *Ungroup*; and your Sonos
  favourites with their artwork: pick one, tick the speakers it should play on,
  and press Play.
- **Play together** (*Group speakers…* on the page, or *Change the group*):
  tick the speakers that should play the same music. The one marked *playing
  from* is where the music comes from; *Play from here* moves it. *All
  speakers* and *Each on its own* are shortcuts. The plugin makes the whole
  group in one go and says, speaker by speaker, what happened — *joined*,
  *left*, or **no answer** for a speaker that is off or asleep, with a button
  to try it again.
- **A speaker's panel**: what it plays — a track with its progress (tap the bar
  to jump), or a radio station, live, with nothing to skip — the transport,
  mute and volume (and the group's volume, when it is in one); then three tabs:
  **Favourites** to play one here, **Group** to tick the speakers that play this
  one's music, and **Sound** for bass, treble and loudness.
- **A speaker's card** on Home and the rooms: its artwork, what it plays, the
  track's progress, play/pause and its volume; compact, one row with a play
  button. A speaker in a group shows the group's music.
- **Sonos speakers**, a card you add yourself (Edit → Add a card): every
  speaker, or the ones its settings tick — what each plays, its volume,
  play/pause.
- **Sonos favourites**, a card you add yourself: the favourites with their
  artwork; a tap plays one on the speaker its settings choose (*Play on*), or
  on whichever speaker is playing.
- **In automations**, a step on a speaker is *Play a favourite* (optionally at
  a volume), *Volume*, *Pause* or *Group*, and says so in words: "play Piano for
  Sleeping on Bathroom at volume 20", "play Bathroom's music on Office-1 and
  Office-2 too".

### What the screens send

| Command | Does |
|---|---|
| `{"action": "play_favorite", "favorite": "Piano for Sleeping", "volume": 20}` | sets this speaker's volume, then plays the favourite (on its group, if it is in one) |
| `{"volume": 20}` | this speaker's own volume |
| `{"action": "set_group_volume", "volume": 24}` | the whole group's volume, keeping each speaker's balance |
| `{"action": "pause"}`, `{"action": "play"}` | to the group's coordinator, whichever speaker it is sent to |
| `{"action": "group", "members": ["sonos_office_1", "sonos_office_2"]}` | makes this speaker's group exactly these — see below |

The page and Play together use the plugin's own `group_speakers` action, which
does the same as `group` and answers speaker by speaker, and its read-only
`status` action for when the speakers were last looked for.

## Groups

A Sonos group plays the music of one speaker, its *coordinator*; the others are
*members*.

- **A new group shows at once.** The plugin listens for Sonos's group-change
  events and reads the groups again when one arrives, and straight after it
  groups or ungroups speakers itself.
- **Play, pause and favourites go to the group.** Sonos refuses transport
  commands sent to a member, so the plugin sends them to the coordinator: pause
  any speaker's card in a group, and the group pauses.
- **A member shows the group's music**: its title, artist, artwork and
  progress are the coordinator's. Its volume, mute and sound stay its own.
- **`group_volume`** is the whole group's volume, on every speaker in a group
  of two or more.

`{"action": "group", "members": [...]}`, sent to the speaker that should lead,
makes its group **exactly** the speakers listed: they join, everyone else in its
group leaves, and if the leader was itself in another group it leaves that one
first. An empty list plays it on its own. Each speaker gets four seconds to
answer; one that doesn't is skipped and the rest still go ahead.

## SDK adoption

hc-sonos is built on the official Rust plugin SDK (`plugin-sdk-rs`) and supports the full management protocol: heartbeat monitoring, remote configuration, and dynamic log level.

## What the plugin provides

Each discovered speaker is registered automatically as a `media_player` device. You do not need to pre-create the device in HomeCore.

For each player, HomeCore can see:

- playback state such as `playing` and `paused`
- volume and mute state, and the group's volume
- current track title, artist, album and artwork — or the radio station
- group coordinator and group members
- available Sonos favorites
- available Sonos playlists

This means HomeCore rules can target `sonos_living_room` or `sonos_kitchen` directly instead of calling a hardcoded speaker URL.

## Discovery and automatic registration

`hc-sonos` uses SSDP discovery and registers speakers as they are found.

### Multicast routing on multi-NIC hosts

SSDP relies on UDP multicast (group `239.255.255.250:1900`). On a host with multiple network interfaces — common in dev setups with separate management and IoT networks — the kernel may route multicast out the wrong interface and discovery silently fails.

If `hc-sonos` finds zero speakers but the Sonos app on the same network sees them, check your routing table:

```bash
# Confirm where multicast is going
ip route get 239.255.255.250
```

Force the IoT-side interface as the multicast egress (replace `enp12s0` and the IoT subnet with yours):

```bash
sudo ip route add 239.255.255.250/32 dev enp12s0
```

For a more permanent fix, configure your network manager (NetworkManager, systemd-networkd, etc.) to set route metrics so the IoT interface wins for multicast destinations.

As a fallback when multicast is genuinely unroutable (firewalled VLAN, container with restricted networking, etc.), `[sonos] manual_hosts = ["192.168.10.5", ...]` lists speaker IPs the plugin should HTTP-probe directly. The probe path bypasses multicast entirely; the trade-off is that adding a new speaker to the network requires a config edit + plugin restart. An address may carry a port (`"192.168.10.5:1400"`); 1400 otherwise.

### Turning SSDP off

`[sonos] ssdp = false` stops the plugin sending anything to the multicast
group: it contacts only the `manual_hosts`. Use it where multicast is no use
anyway, or for a test homeCore that must never find — and so never command —
the real speakers in the house.

If you have no manual overrides configured, the plugin derives a HomeCore device ID from the room name:

| Sonos room | HomeCore device ID |
|---|---|
| `Living Room` | `sonos_living_room` |
| `Kitchen` | `sonos_kitchen` |
| `Office` | `sonos_office` |

Manual configuration is still useful when you want to:

- assign a stable custom HomeCore device ID
- override the display name
- assign an area
- pin a specific speaker UUID to specific metadata

Manual configuration is **not** required for baseline discovery and use.

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
discovery_interval_secs = 300
discovery_timeout_secs  = 5
manual_hosts            = []     # "192.168.1.50" or "192.168.1.50:1400"

[api]
enabled       = true
host          = "0.0.0.0"
port          = 5005
callback_host = "192.168.1.10"
```

## Optional speaker overrides

If you want a speaker to use a specific HomeCore ID, set it explicitly by Sonos UUID:

```toml
[[devices]]
uuid  = "RINCON_347E5C3D12E401400"
hc_id = "sonos_main_living_room"
name  = "Living Room"
area  = "living_room"
```

Without an override, the plugin will still discover and register the speaker automatically.

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

Typical state attributes include:

| Attribute | Meaning |
|---|---|
| `state` | `playing`, `paused`, `stopped` or `buffering` |
| `volume` | Current volume 0-100 |
| `muted` | Mute state |
| `media_title` | Current track title |
| `media_artist` | Current artist |
| `media_album` | Current album |
| `media_image_url` | Artwork — the track's, or the station's logo |
| `media_duration` | Track duration in seconds |
| `media_position` | Current playback position in seconds |
| `media_kind` | `radio` for a live stream, `track` for anything else, null when nothing is queued |
| `group_coordinator` | HomeCore device ID of the coordinator |
| `group_members` | Array of grouped player IDs |
| `group_volume` | The group's volume 0-100, while it is in a group |
| `available_favorites` | Array of Sonos favorite names |
| `available_playlists` | Array of Sonos playlist names |

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

### Named content commands

The Sonos plugin also exposes named content commands through HomeCore. This is the important part for rules.

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

The plugin resolves the named favorite or playlist internally. Your automation does not need to know the transport URI.

## Rule example

```toml
id       = ""
name     = "Dinner music"
enabled  = true
priority = 10

[trigger]
type      = "device_state_changed"
device    = "dining_room.music_switch"
attribute = "on"
to        = true

[[actions]]
type      = "set_device_state"
device    = "living_room.sonos"
state     = { action = "play_favorite", favorite = "Dinner Jazz" }
```

This is preferable to an HTTP `CallService` action because:

- the rule references a stable HomeCore canonical device name
- the plugin remains free to rediscover speakers and change IPs
- Sonos favorites and playlists stay named content, not embedded transport details

## Plugin actions

hc-sonos declares four [capability actions](./capabilities), exposed in the
homeCore admin UI and surfaced by hc-mcp's `list_plugin_actions`.

### `group_speakers` (sync, user)

`{"leader": "sonos_office_1", "members": ["sonos_office_2", "sonos_bathroom"]}`
— the `group` device action, answered speaker by speaker:

```json
{"status": "partial", "leader": "sonos_office_1",
 "results": [{"device_id": "sonos_office_2", "name": "Office-2", "result": "joined"},
             {"device_id": "sonos_living_room", "name": "Living Room", "result": "no_answer"}]}
```

Results are `joined`, `left`, `already`, `no_answer` or `failed`.

### `status` (sync, read-only)

How many speakers are known, when discovery last looked (`last_sweep`), and
whether it uses SSDP.

### `discover_speakers` (streaming, user)

Re-runs SSDP discovery and emits each found speaker as a stream item
as it's discovered. Streaming so the UI updates progressively rather
than waiting for the whole discovery window to close.

Each `item_add` event carries `{uuid, room_name, host_port, status}`,
keyed on `uuid`. Found speakers are also forwarded into the bridge's
discovery channel — the registration / state-publish path runs exactly
as if the speaker had been picked up by the periodic discovery cycle.

Manifest: `concurrency: single`, `requires_role: user`,
`timeout_ms: 60_000`, `item_key: "uuid"`. Cancelable.

Use this from the admin UI when a speaker isn't appearing — the live
item list tells you whether it was found at all (network / multicast
issue) versus discovered but failing some downstream step.

### `rediscover_speakers` (sync, user)

Fire-and-forget kick that runs the same discovery scan with no event
stream. Returns once the scan completes with a brief summary
(`{count, elapsed_ms}`). Use this from rules or scripts where you
want a quick "force a discovery now" without the streaming UX.

Both actions reuse the same `discovery::run_once` core — they're two
front doors on the same path.

## Standalone HTTP API

The plugin's own HTTP API remains available and supported. This is useful for:

- standalone operation outside HomeCore
- manual testing and debugging
- advanced Sonos-specific workflows not yet modeled as HomeCore device commands

Examples:

```bash
# Direct plugin endpoint
curl http://localhost:5005/Living%20Room/play

# Browse favorites
curl http://localhost:5005/favorites | jq

# Browse playlists
curl http://localhost:5005/playlists | jq
```

For end-user automation inside HomeCore, prefer the HomeCore device ID path first and use the plugin HTTP API as the escape hatch.

## Troubleshooting

| Problem | What to check |
|---|---|
| Speaker never appears in HomeCore | Confirm the plugin is running and the speaker is visible on the same LAN |
| Speaker appears but commands do nothing | Check `available = true` on the device and verify the plugin can reach the speaker |
| Favorites or playlists are empty | Wait for discovery/content refresh, then inspect `available_favorites` and `available_playlists` on the device |
| Rules still use Sonos URLs | Replace `call_service` actions with `set_device_state` targeting the HomeCore device ID |
| GENA callbacks fail | Verify `api.callback_host` is reachable from the Sonos speakers |
| A new group takes minutes to show | Group-change events arrive on the same callback address — check `api.callback_host` |
| A speaker says "no answer" when grouping | It did not reply within four seconds: off, asleep or unreachable. Try again from Play together |
