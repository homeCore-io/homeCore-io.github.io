---
id: hue
title: Philips Hue
sidebar_label: Philips Hue
sidebar_position: 4
---

# Philips Hue (`hc-hue`)

The Hue plugin connects homeCore to Philips Hue bridges on your network. Each
bridge's lights, rooms and zones, scenes, motion sensors, contact sensors and
switches become homeCore devices. Changes arrive as they happen over the
bridge's event stream, whether they were made in homeCore, the Hue app, a Hue
switch or anywhere else. You can connect more than one bridge, and the plugin
brings its own page, panels, cards and automation step.

## Before you start

- A Hue bridge with Hue's v2 API (the square bridge). The plugin talks to the
  bridge over HTTPS at `/clip/v2`, which the original round bridge doesn't
  have.
- homeCore must reach the bridge on port 443. Bridges on the same network are
  found with SSDP. A bridge on another subnet or VLAN can be added by its
  address.
- You need to be able to press the button on top of the bridge while you add
  it.

No Hue account is needed. Everything runs on your network. The only thing that
can leave it is the optional lookup at Philips' discovery service, which
answers with your bridge's local address and nothing else.

## Install and set up

1. Install Hue from **Settings › Plugins › Catalog**.
2. Open **Settings › Plugins › Hue** and choose **Add a bridge**.
3. homeCore looks for bridges on the network. Pick one, or give the address of
   a bridge it can't find.
4. Press the button on top of the bridge within 90 seconds.

Its lights, rooms and scenes arrive within seconds. The key the bridge hands
back is kept in homeCore's stored state for the plugin, not in the settings
file. A bridge you remove can be added again the same way.

If a bridge's address changes, correct it on the plugin's page. homeCore first
checks that the new address answers as the same bridge, then restarts the
plugin to connect there. A bridge set up in the settings file by host alone is
also matched by its bridge ID, so an address change from DHCP doesn't lose it.

Rooms and zones are not devices of their own until you turn them on. The
plugin's page lists each room and zone with a switch for **As a device**.
Changing it restarts the plugin.

## Settings

Most people only touch the switches on the plugin's own page. The full list is
under **Settings › Plugins › Hue › Settings**.

| Setting | Key | Default | What it does |
|---|---|---|---|
| Discover bridges | `hue.discovery_enabled` | on | Look for bridges on the network with SSDP. Off: use only bridges you added. |
| Cloud fallback | `hue.discovery_cloud_fallback` | on | When SSDP finds nothing, ask Philips' discovery service for your bridge's address. |
| Discovery timeout | `hue.discovery_timeout_secs` | 5 s | How long a search waits for bridges to answer. |
| Static bridges | `bridges` | none | Bridges added by hand: name, host, app key, bridge ID, Verify TLS (on), Allow self-signed (on). Most installs leave this empty and add bridges from the page. |
| Event stream | `hue.eventstream_enabled` | on | Follow the bridge's push stream so changes arrive at once. Shown on the page as **Live updates**. |
| Reconnect delay | `hue.eventstream_reconnect_secs` | 3 s | How long to wait before reconnecting a dropped event stream. |
| Resync interval | `hue.resync_interval_secs` | 60 s | A full read of every bridge, as a backstop for anything the stream missed. Minimum 5. |
| Heartbeat | `hue.heartbeat_secs` | 30 s | How often the plugin reports its health to homeCore. |
| Compact motion sensors | `hue.compact_motion_facets` | on | A motion sensor's motion, temperature and light level are one device. Off: three devices. |
| Publish room/zone groups | `hue.publish_grouped_lights` | off | Every room and zone becomes a device. |
| Only these groups | `hue.publish_grouped_lights_for` | empty | Just these rooms and zones become devices, for example `["room:kitchen"]`. The page's **As a device** switches set this list. |
| Never these groups | `hue.skip_grouped_lights_for` | empty | Rooms and zones that never become devices. |
| Publish "All lights" group | `hue.publish_bridge_home` | off | The bridge-wide group of every light as a device. |
| Publish entertainment areas | `hue.publish_entertainment_configurations` | off | Hue entertainment areas (sync zones) as devices. |

The Logging section has the usual level, forwarding, rotation and pruning
settings.

There is no units setting. The plugin always publishes temperatures in °C and
light levels in lux, and the app shows °F to anyone who prefers it. An old
`[hue.display]` table (`temperature_unit`, `illuminance_display`) is ignored.

## Devices

Device IDs include the bridge's ID:

| Device | Type | ID |
|---|---|---|
| The bridge | `bridge` | `hue_{bridge}_bridge` |
| A light | `light` | `hue_{bridge}_light_{id}` |
| A room or zone, when turned on | `group` | `hue_{bridge}_group_{id}` |
| A scene | `scene` | `hue_{bridge}_scene_{id}` |
| A motion sensor | `motion_sensor` | `hue_{bridge}_motion_{id}` |
| A contact sensor | `contact_sensor` | `hue_{bridge}_contact_{id}` |
| A switch or dial | `button` | `hue_{bridge}_{resource}_{id}` |
| An entertainment area, when turned on | `entertainment` | `hue_{bridge}_entertainment_configuration_{id}` |

With compact motion sensors turned off, temperature and light level arrive as
`temperature_sensor` and `illuminance_sensor` devices of their own.

A light belongs to its Hue room in homeCore and moves when you move it in the
Hue app. Renames, new scenes and deleted scenes in the Hue app show up within
seconds.

### Lights

A light publishes `on`, `brightness_pct` (0 to 100), `color_temp` (kelvin)
with `color_temp_min` and `color_temp_max` for its own range, `color_xy`,
`color_mode`, `effect`, `dynamic_speed` (0 to 1) and, on a gradient lamp,
`gradient_points`. It also reports `scene` and `scene_name` (see below), and
its model, product name, software version and `update_state`. A white-only
bulb is offered no color, and its white runs over its own range.

Commands are writes to the same names. Any of them can carry `transition_ms`
to fade:

```json
{ "on": true, "brightness_pct": 40, "transition_ms": 2000 }
{ "color_temp": 2700 }
{ "color_xy": { "x": 0.6, "y": 0.38 } }
{ "brightness_step": -10 }
{ "effect": "candle", "dynamic_speed": 0.6 }
{ "gradient_points": [{ "x": 0.6, "y": 0.38 }, { "x": 0.17, "y": 0.7 }] }
```

`brightness_pct: 0` turns the light off, and any other level turns it on.
Lights also take these actions:

| Action | Does |
|---|---|
| `{"action": "identify"}` | Flashes the light so you can find it. |
| `{"action": "breathe"}` | Pulses once. |
| `{"action": "signal", "kind": "on_off", "duration_secs": 5}` | Blinks for a while, then goes back to how it was. `kind` is `on_off`, `on_off_color` or `alternating`; the last two take `colors`, a list of `{x, y}`. |
| `{"action": "stop_dynamic"}` | Stops an effect. |
| `{"action": "apply_scene", "scene_id": "hue_{bridge}_scene_{id}"}` | Sets this light only to its part of a scene and leaves the rest of the room alone. `transition_ms` is optional. A scene that doesn't include the light is refused. |

### Rooms and zones

A room or zone device has one switch, one dimmer and one color for all its
lights. It publishes `on`, `brightness_pct`, `light_ids`, `supports_color_xy`,
`supports_color_temp`, and `scene` and `scene_name` for the scene the bridge
reports active (null when none is).

It takes `on`, `brightness_pct`, `brightness_step`, `color_temp`, `color_xy`
and `transition_ms`, plus `breathe` and `signal` like a light, and:

```json
{ "action": "activate", "scene_id": "hue_{bridge}_scene_{id}", "dynamic": true, "transition_ms": 2000, "brightness_pct": 80 }
{ "action": "save_scene", "name": "Movie" }
```

`activate` shows one of its scenes. `scene_id` is the scene's homeCore device
ID or its Hue ID. `save_scene` saves how its lights are now as a new scene.

### Scenes

Every Hue scene is a homeCore scene, named with its room. A scene publishes
`active`, `status`, `palette` (its colors), `group_name`, and `lights`, one
entry per light it sets:

```json
"lights": [
  { "device_id": "hue_{bridge}_light_{id}", "on": true, "brightness_pct": 56.3,
    "color_temp": 2237, "color_hex": "#ffc48a" },
  { "device_id": "hue_{bridge}_light_{id}", "on": true, "brightness_pct": 80,
    "color_xy": { "x": 0.56, "y": 0.4 }, "color_hex": "#ff9f2e" },
  { "device_id": "hue_{bridge}_light_{id}", "on": false }
]
```

An entry carries only what the scene sets: `on`, `brightness_pct`,
`color_temp` (kelvin), `color_xy`, `gradient_points` and `effect`, plus
`color_hex` for drawing a swatch.

Hue's smart scenes, the ones that change through the day such as Natural
light, are scenes too and apply like any other. They have no `lights`, since
they move through other scenes. Change their times in the Hue app.

A scene takes:

```json
{ "action": "activate", "dynamic": true, "transition_ms": 2000, "brightness_pct": 80 }
{ "action": "rename", "name": "Movie" }
{ "action": "delete" }
```

`dynamic` keeps the scene's colors moving. `delete` removes the scene from the
bridge. `{"activate": true}` and the older `{"action": "activate_scene"}` also
work.

### Which scene a light is showing

A light publishes `scene` (the scene's device ID) and `scene_name` when what
it shows matches its part of a scene, and null when it matches none. The
match allows for small differences the bridge reports: 3 points of
brightness, 8 mirek of white (about 60 K around 2700 K), and 0.02 in color.
A light that is off matches no scene. When two scenes match, the one the
bridge reports active wins, then the first by name. Dimming a light by hand
clears its scene.

### Sensors and switches

| Device | Publishes | Takes |
|---|---|---|
| Motion sensor | `motion`, `temperature` (°C), `illuminance` (lux), each with a `*_valid` flag, `enabled`, `motion_sensitivity`, `battery_pct` | `{"enabled": false}` to pause it, `{"motion_sensitivity": 2}` (0 to 2) |
| Contact sensor | `open` (true when open), `tampered`, `enabled`, `battery_pct` | `{"enabled": false}` |
| Switch | `last_press`, the button and what happened, for example `Brighter held` (a press goes `down`, then `pressed`; a hold goes `down`, `held`, `released`), `last_pressed_at`, `button_event` (Hue's own word), `battery_pct` | nothing |
| Dial | `rotary_action`, `rotary_direction`, `rotary_steps`, `rotary_updated` | nothing |
| Entertainment area | `entertainment_active`, `entertainment_status` and its details | `{"action": "activate_entertainment"}`, `{"action": "deactivate_entertainment"}` |

homeCore tells a switch's buttons apart, so an automation can start on "the
bedroom dimmer's Brighter button held" instead of on any press.

### The bridge

The bridge device publishes `host`, `online`, `pairing_status` (`paired`,
`unpaired` or `unreachable`), counts of its lights, scenes, rooms, zones and
sensors, and its software update state.

## Actions

These appear on the plugin's page and to the Assistant and hc-mcp.

| Action | Role | Timeout | Does |
|---|---|---|---|
| `rooms` | read only | 15 s | Every bridge's rooms and zones, with light and scene counts and the device for each one that is turned on. |
| `find_bridges` | admin | 15 s | Bridges on the network, and whether each is already added. |
| `pair_start` | admin | 15 s | Starts adding a bridge, by `bridge_id` from `find_bridges` or by `host`. Returns at once; press the bridge's button within 90 seconds. |
| `pair_status` | read only | 15 s | How adding a bridge is going: looking, waiting for the button (with seconds left), paired, failed or canceled. |
| `pair_cancel` | admin | 15 s | Stops waiting for the button. |
| `set_bridge_address` | admin | 15 s | Points a bridge at a new `host` after checking it answers as the same bridge. Takes effect when the plugin restarts. |
| `pair_bridge` | admin | 90 s | The same as `pair_start`, as one streaming action that waits for the button. Cancelable. |
| `unpair_bridge` | admin | 60 s | Removes a bridge: its devices leave homeCore and its key is forgotten. Works while the bridge is offline. |
| `refresh_devices` | user | 120 s | Reads every bridge again and republishes everything, removing devices that no longer exist on their bridge. Streams progress per bridge. |
| `cleanup_stale_devices` | admin | 120 s | The same sweep, framed as removing leftover devices. |

## Alerts

| Alert | Severity | On by default |
|---|---|---|
| Bridge not answering | error | yes |
| Light not answering (a light, sensor or switch the bridge can't reach; often a light switched off at the wall) | warning | yes |
| Software update waiting in the Hue app | information | no |

Low battery is homeCore's own alert, raised for any device that reports a
battery. Turn alerts on or off, and choose where they go, in
**Settings › Alerts**.

When a bridge stops answering, the plugin also shows a notice on its page
(`bridge_unreachable_{bridge_id}`). It clears on the next read that works.

## Screens and cards

All of these ship with the plugin, so updating the plugin updates them.

The plugin's page (Settings › Plugins › Hue) lists each bridge: whether it is
live or being read every minute, its address, its lights, sensors and scenes,
and whether an update is waiting. You can refresh or remove a bridge there,
add one, choose which rooms and zones are devices, and see lights that aren't
answering and batteries running low. Admins also get the main switches
(entertainment areas, live updates).

A light's panel has white across the lamp's own range, a color wheel, a
gradient lamp's color points, and Hue's effects (candle, fire, sparkle, prism,
opal and the rest) with their speed. It shows its room's scenes as swatches of
their colors, plus the model, signal and software version, and an Identify
button.

A room's or zone's panel has its scenes, with a choice to keep their colors
moving and a fade time. You can save how its lights are now as a new scene,
rename or delete a scene, set all its lights at once (off, warm, cool, one
color), switch each light on its own, and see the zones its lights also
belong to.

The sensor panel covers motion sensors (motion, temperature, light level, the
day's motion, sensitivity and pause), contact sensors (open or closed, and
tampering), and switches (each button and how it was last pressed, for
example "Brighter, held, 3 min ago").

On Home and in rooms, a light's card glows in its own color, a room's card
shows each of its lights, and a motion sensor's card says when it last saw
someone. At the large size, light and room cards carry the room's scenes to
tap.

**Hue scenes** is a card you add yourself (Edit, then Add a card). It shows
the scenes of the rooms you choose, plus an All off button.

In the automation editor, a step on a Hue light, room or scene gets its own
form. It can apply a scene (with a fade, a brightness, and colors moving or
still), set a look (a white, a color or an effect, a brightness or a step
brighter or dimmer, and a fade), flash the lights and put them back (blink,
blink in a color, or alternate two colors for a few seconds), pulse once, or
switch them on or off with a fade.

## Troubleshooting

If the event stream drops, the plugin reconnects after 3 seconds (the
reconnect delay) and keeps trying. The full read every 60 seconds goes on
either way, so nothing stays stale for long. With live updates turned off,
that read is the only way changes arrive.

If a bridge doesn't answer, its devices show offline, the Bridge not answering
alert is raised, and the plugin keeps trying on each read. It recovers by
itself when the bridge comes back. If the bridge moved to a new address,
change it on the plugin's page.

If no bridge is found, homeCore and the bridge are probably on different
networks, or multicast is blocked between them. Add the bridge by its address,
for example `192.168.1.20`. In a container on a bridge network, SSDP can't
reach the bridge, so add it by address there too.

If a light shows "Light not answering", it is usually switched off at the
wall. Turn the wall switch back on.

After renaming or moving lights in the Hue app, changes normally arrive by
themselves. If something still looks wrong, run **Refresh devices** from the
plugin's page.

The plugin's log is on the **Log** tab of its page.

## Known limits

- Smart scene times are edited in the Hue app only.
- Entertainment areas can be started and stopped but not streamed to.
