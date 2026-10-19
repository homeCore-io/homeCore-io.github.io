---
id: hue
title: Philips Hue
sidebar_label: Philips Hue
sidebar_position: 4
---

# Philips Hue (`hc-hue`)

The Hue plugin brings Philips Hue into homeCore through the Hue bridge: every
light, room and zone, scene, motion sensor and switch, with screens of its own.

Changes arrive the moment they happen — made in homeCore, the Hue app, a Hue
switch or anywhere else — over the bridge's event stream. If the stream drops,
the plugin reads the bridge every minute until it is back. More than one bridge
works.

## Adding a bridge

Install it from **Settings › Plugins › Add**, then open its page and choose
**Add a bridge**:

1. homeCore looks for bridges on the network (or give it an address, for a
   bridge on another network);
2. choose one;
3. press the round button on top of the bridge within 90 seconds;
4. its lights, rooms and scenes arrive.

The key the bridge hands back is kept by homeCore, not in a settings file. A
bridge you remove can be added again the same way. If a bridge's address
changes, correct it on the plugin's page: homeCore checks the new address
answers as that same bridge, and connects there.

## Its screens

All of these come with the plugin itself — update the plugin, and they update.

- **Its page** (Settings › Plugins › Philips Hue): each bridge — live or
  checked every minute, its address, how many lights, sensors and scenes it
  has, and a software update waiting — with refresh and remove; adding a
  bridge; every room and zone, and whether each is a device of its own;
  lights that aren't answering and batteries running low; and the main
  settings.
- **A light's panel**: white across the lamp's own range, a colour wheel, a
  gradient lamp's colour points, Hue's effects (candle, fire, sparkle, prism,
  opal and the rest) with their speed, its room's scenes as swatches of their
  colours, and what it is — model, signal, software. *Identify* flashes it.
- **A room's or zone's panel**: its scenes (with *keep their colours moving*
  and a fade time); saving how its lights are now as a new scene, and
  renaming or deleting one; all its lights at once — off, warm, cool, one
  colour; each light with its own switch; and the zones its lights are also
  in.
- **A motion sensor's panel**: motion, temperature and light level, the
  motions of the day, sensitivity, and pausing it.
- **A switch's panel**: each of its buttons and how it was last pressed —
  "Brighter, held, 3 min ago".
- **Their cards** on Home and the rooms: a light glows in its own colour; a
  room shows each of its lights; at the large size, both carry the room's
  scenes to tap. A motion sensor says when it last saw someone.
- **Hue scenes**, a card you add yourself (Edit → Add a card): the scenes of
  the rooms you choose, to tap, and an All off. Set it up from the card's
  settings in Edit.

## Scenes

Every Hue scene is a scene in homeCore, named with its room, with its colours
on every swatch. **Smart scenes** — Hue's ones that change through the day,
like *Natural light* — are there too, to apply like any other; change their
times in the Hue app. A scene renamed, added or deleted in the Hue app follows
in homeCore within seconds, as does a light renamed or moved to another room.

## Rooms and zones

Each Hue room or zone can be a device of its own in homeCore — one switch,
one dimmer, one colour for all its lights, a card, and its scenes in
automations. Turn that on per room on the plugin's page. A light belongs to
its Hue room in homeCore too, and moves when you move it in the Hue app.

## In automations

The automation editor has a Hue form for a step on a light, room or scene:

- **apply a scene** — from the room's scenes, as swatches — with a fade, a
  brightness, and its colours moving or still;
- **set a look** — a white, a colour or an effect, a brightness (or brighter
  or dimmer by a step), and a fade;
- **flash them, then put them back** — blink, blink in a colour, or alternate
  two colours, for a few seconds (the doorbell, a leak, the washer finishing);
  or pulse once;
- **on or off**, with a fade.

A Hue switch's buttons are told apart, so an automation can start on
"Bedroom dimmer's last press becomes *Brighter held*" rather than on any
press. Scenes are named with their room everywhere.

## Alerts

| Alert | Severity | On unless turned off |
|---|---|---|
| Bridge not answering | error | yes |
| Light not answering (often switched off at the wall) | warning | yes |
| Software update waiting in the Hue app | information | no |

A low battery is homeCore's own alert, for every device that reports one.
Turn them on or off, and send them somewhere, in **Settings › Alerts**.

## Settings

On its page, or **Settings › Plugins › Philips Hue › Settings**:

- temperature in °C or °F;
- whether entertainment areas appear as devices;
- live updates from the bridge (on by default), and how often to read it
  when they are off;
- which rooms and zones are devices;
- whether a motion sensor's motion, temperature and light level are one
  device (the default) or three;
- looking for bridges on the network, and asking Philips' discovery service
  when that finds nothing (it returns only your bridge's address).

## Commanding Hue devices directly

What the screens send, for anyone writing their own:

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
| light, room | `{"action": "signal", "kind": "on_off", "duration_ms": 5000}` | blink, then put it back (`on_off_color` and `alternating` take `colors`) |
| scene | `{"action": "activate", "dynamic": true, "duration_ms": 2000}` | apply it, colours moving, fading in |
| scene | `{"action": "rename", "name": "Movie"}`, `{"action": "delete"}` | rename it, delete it from the bridge |
| room | `{"action": "save_scene", "name": "Movie"}` | save its lights as they are as a new scene |
| light, room | `{"action": "activate", "scene_id": "<the scene's resource_id>"}` | apply a scene through it |
| motion sensor | `{"motion_sensitivity": 2}`, `{"enabled": false}` | sensitivity 0–2; pause it |

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
