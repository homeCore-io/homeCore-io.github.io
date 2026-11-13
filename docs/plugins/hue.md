---
id: hue
title: Philips Hue
sidebar_label: Philips Hue
sidebar_position: 4
---

# Philips Hue (`hc-hue`)

The Hue plugin brings Philips Hue into homeCore through the Hue bridge. You get
every light, room and zone, scene, motion sensor, contact sensor and switch,
and the plugin brings its own screens.

Changes arrive as they happen over the bridge's event stream, whether they were
made in homeCore, the Hue app, a Hue switch or anywhere else. If the stream
drops, the plugin reads the bridge every minute until it comes back. You can
connect more than one bridge.

## Adding a bridge

Install it from **Settings › Plugins › Add**, then open its page and choose
**Add a bridge**:

1. homeCore looks for bridges on the network. For a bridge on another network,
   give it an address instead.
2. Choose one.
3. Press the round button on top of the bridge within 90 seconds.
4. Its lights, rooms and scenes arrive.

homeCore keeps the key the bridge hands back in its own stored state, outside
any settings file. A bridge you remove can be added again the same way. If a
bridge's address changes, correct it on the plugin's page. homeCore checks
that the new address answers as the same bridge, then connects there.

## Its screens

All of these ship with the plugin, so updating the plugin updates them.

- **Its page** (Settings › Plugins › Philips Hue) lists each bridge: whether
  it is live or being checked every minute, its address, how many lights,
  sensors and scenes it has, and whether a software update is waiting, with
  refresh and remove buttons. The page is also where you add a bridge, choose
  which rooms and zones are devices of their own, see lights that aren't
  answering and batteries running low, and change the main settings.
- **A light's panel** has white across the lamp's own range, a colour wheel, a
  gradient lamp's colour points, and Hue's effects (candle, fire, sparkle,
  prism, opal and the rest) with their speed. It shows its room's scenes as
  swatches of their colours, plus the model, signal and software version.
  *Identify* flashes the light.
- **A room's or zone's panel** has its scenes, with *keep their colours
  moving* and a fade time. From here you can save how its lights are now as a
  new scene, rename or delete a scene, set all its lights at once (off, warm,
  cool, one colour), switch each light on its own, and see the zones its
  lights also belong to.
- **A motion sensor's panel** shows motion, temperature and light level and
  the day's motion, and lets you set sensitivity or pause the sensor.
- **A contact sensor's panel** shows whether it is open or closed, and whether
  it has been tampered with.
- **A switch's panel** shows each of its buttons and how it was last pressed,
  for example "Brighter, held, 3 min ago".
- **Their cards** on Home and in the rooms: a light glows in its own colour,
  and a room shows each of its lights. At the large size both carry the room's
  scenes to tap. A motion sensor's card says when it last saw someone.
- **Hue scenes** is a card you add yourself (Edit → Add a card). It shows the
  scenes of the rooms you choose, to tap, and an All off button. Set it up
  from the card's settings in Edit.

## Scenes

Every Hue scene is a scene in homeCore, named with its room, with its colours
on every swatch. Hue's **smart scenes**, the ones that change through the day
such as *Natural light*, are there too and apply like any other scene. Change
their times in the Hue app. When you rename, add or delete a scene in the Hue
app, homeCore follows within seconds. The same goes for a light that is
renamed or moved to another room.

### What a scene sets each light to

A scene publishes `lights`, one entry per light it sets. Each entry has the
light's homeCore device id and the scene's setting for it, in the same names
the light uses:

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
`color_hex`, a swatch to draw. A smart scene has no `lights`, because it moves
through other scenes. When a scene is edited in the Hue app, `lights` follows.

One light can take its own part of a scene and leave the rest of the room
alone:

```json
{ "action": "apply_scene", "scene_id": "hue_{bridge}_scene_{id}", "transition_ms": 400 }
```

`scene_id` is the scene's homeCore device id or its Hue id. `transition_ms` is
optional. Without it, the light fades as the scene does. A scene that does not
set that light is refused, and the reason shows with the command's result.

### Which scene is showing

A light publishes `scene` (the scene's homeCore device id) and `scene_name`
when what it shows matches its part of a scene. They are null when it matches
none. The match allows for the small differences the bridge reports: 3 points
of brightness, 8 mirek of white (about 60 K around 2700 K), and a short
distance in color. A light that is off matches no scene, and neither does a
scene setting that only switches a light on. When two scenes match, the one
the bridge reports active wins, then the first by name. Both follow the
bridge's event stream, so dimming a light by hand clears its scene.

A room or zone that is a device publishes `scene` and `scene_name` for its
scene the bridge reports active, and null when none is.

## Rooms and zones

Each Hue room or zone can be a device of its own in homeCore, with one switch,
one dimmer and one colour for all its lights, a card, and its scenes available
to automations. Turn that on per room on the plugin's page. A light belongs to
its Hue room in homeCore as well, and moves when you move it in the Hue app.

## In automations

The automation editor has a Hue form for a step on a light, room or scene:

- **Apply a scene**, picked from the room's scenes as swatches, with a fade, a
  brightness, and its colours moving or still.
- **Set a look**: a white, a colour or an effect, a brightness (or brighter or
  dimmer by a step), and a fade.
- **Flash them, then put them back**: blink, blink in a colour, or alternate
  two colours for a few seconds (for the doorbell, a leak, or the washer
  finishing). Or pulse once.
- **On or off**, with a fade.

homeCore tells a Hue switch's buttons apart, so an automation can start on
"Bedroom dimmer's last press becomes *Brighter held*" instead of on any press.
Scenes are named with their room everywhere.

## Alerts

| Alert | Severity | On unless turned off |
|---|---|---|
| Bridge not answering | error | yes |
| Light not answering (often switched off at the wall) | warning | yes |
| Software update waiting in the Hue app | information | no |

Low battery is homeCore's own alert, raised for every device that reports a
battery. Turn alerts on or off, and choose where they are sent, in
**Settings › Alerts**.

## Settings

On its page, or **Settings › Plugins › Philips Hue › Settings**:

- whether entertainment areas appear as devices;
- whether the bridge-wide "All lights" group appears as a device (off by
  default);
- live updates from the bridge (on by default), and how often to re-read every
  bridge (every 60 seconds by default) as a backstop;
- which rooms and zones are devices;
- whether a motion sensor's motion, temperature and light level are one device
  (the default) or three;
- looking for bridges on the network, and asking Philips' discovery service
  when that finds nothing. The service returns only your bridge's address.

There is no unit setting. Temperatures are always published in °C and light
levels in lux, and the app shows °F to anyone who prefers it. An old
`[hue.display]` table (`temperature_unit`, `illuminance_display`) is ignored.

## Commanding Hue devices directly

These are the commands the screens send, for anyone writing their own:

| Device | Command | Does |
|---|---|---|
| light, room | `{"on": true, "brightness_pct": 40}` | on, at 40 % |
| light, room | `{"color_temp": 2700}` | a white, in kelvin |
| light, room | `{"color_xy": {"x": 0.6, "y": 0.38}}` | a colour |
| light, room | `{"brightness_step": -10}` | 10 % dimmer |
| light, room | `"transition_ms": 2000` beside any of these | fade over 2 s |
| light | `{"effect": "candle"}`, `{"dynamic_speed": 0.6}` | an effect, its speed |
| light | `{"gradient_points": [{"x":…,"y":…}, …]}` | a gradient lamp's colours |
| light | `{"action": "identify"}` | flash it to find it |
| light, room | `{"action": "breathe"}` | pulse once |
| light, room | `{"action": "signal", "kind": "on_off", "duration_secs": 5}` | blink, then put it back (`on_off_color` and `alternating` take `colors`) |
| scene | `{"action": "activate", "dynamic": true, "transition_ms": 2000}` | apply it, colours moving, fading in |
| scene | `{"action": "rename", "name": "Movie"}`, `{"action": "delete"}` | rename it, delete it from the bridge |
| room | `{"action": "save_scene", "name": "Movie"}` | save its lights as they are as a new scene |
| light, room | `{"action": "activate", "scene_id": "<the scene's resource_id>"}` | apply a scene through it |
| light | `{"action": "apply_scene", "scene_id": "<the scene's device id>"}` | give this light only its part of the scene |
| motion sensor | `{"motion_sensitivity": 2}`, `{"enabled": false}` | sensitivity 0 to 2; pause it |
| contact sensor | `{"enabled": false}` | pause it |

Send them with `PATCH /api/v1/devices/{id}/state`. Device ids are
`hue_{bridge}_light_{id}`, `hue_{bridge}_group_{id}` (rooms and zones),
`hue_{bridge}_scene_{id}`, and `hue_{bridge}_motion_{id}` and the like for
sensors and switches.

## For developers

The plugin's source, with its screens in `ui/`, is `plugins/hc-hue` in the
homeCore repository. It reads a bridge in one request (`GET
/clip/v2/resource`) and follows its event stream, so a command is not followed
by a read. See [Developing Plugins](./developing-plugins) and
[Screens and Cards](./plugin-screens).
