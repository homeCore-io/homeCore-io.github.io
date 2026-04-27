---
id: sonos
title: Sonos
sidebar_label: Sonos
sidebar_position: 7
---

# Sonos (`hc-sonos`)

The `hc-sonos` plugin discovers Sonos speakers on your network, registers them as HomeCore `media_player` devices, and keeps transport state in sync through MQTT.

It also keeps its own standalone HTTP API. That is intentional. You can use the plugin directly if you want, but once a speaker is registered in HomeCore the preferred automation path is through the HomeCore device ID.

## SDK adoption

hc-sonos is built on the official Rust plugin SDK (`hc-plugin-sdk-rs`) and supports the full management protocol: heartbeat monitoring, remote configuration, and dynamic log level.

## What the plugin provides

Each discovered speaker is registered automatically as a `media_player` device. You do not need to pre-create the device in HomeCore.

For each player, HomeCore can see:

- playback state such as `playing` and `paused`
- volume and mute state
- current track title, artist, and album
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

As a fallback when multicast is genuinely unroutable (firewalled VLAN, container with restricted networking, etc.), `[sonos] manual_hosts = ["192.168.10.5", ...]` lists speaker IPs the plugin should HTTP-probe directly. The probe path bypasses multicast entirely; the trade-off is that adding a new speaker to the network requires a config edit + plugin restart.

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
discovery_interval_secs = 300
discovery_timeout_secs  = 5
manual_hosts            = []

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
| `state` | `playing`, `paused`, or `stopped` |
| `volume` | Current volume 0-100 |
| `muted` | Mute state |
| `media_title` | Current track title |
| `media_artist` | Current artist |
| `media_album` | Current album |
| `media_duration` | Track duration in seconds |
| `media_position` | Current playback position in seconds |
| `group_coordinator` | HomeCore device ID of the coordinator |
| `group_members` | Array of grouped player IDs |
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

# Set volume
curl -s -X PATCH http://localhost:8080/api/v1/devices/sonos_living_room/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "set_volume", "volume": 30}'
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
