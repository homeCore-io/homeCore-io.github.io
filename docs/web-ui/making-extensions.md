---
id: making-extensions
title: Making a UI extension
sidebar_label: Making an extension
sidebar_position: 4
---

# Making a UI extension

A [UI extension](./extensions.md) is a folder: an `extension.json` that says
what it offers, and the files it draws with. The ones homeCore makes are in
[hc-extensions](https://github.com/homeCore-io/hc-extensions), one directory
each. `hc-thermostat` is a Rive drawing; `hc-gauge` is code.

## The manifest

```json
{
	"id": "hc-gauge",
	"name": "Gauges",
	"version": "0.1.0",
	"values": 1,
	"description": "Readings drawn as a gauge: temperature or humidity on a dial, in your units.",
	"category": "Readings",
	"elements": [
		{
			"id": "dial",
			"kind": "code",
			"label": "Gauge",
			"draws": "readings",
			"module": "gauge.js",
			"element": "hc-gauge-dial"
		}
	]
}
```

- `id` is the folder's name: lowercase letters, digits, `.`, `_` and `-`.
- `values` is the version of the values the app gives drawings, `1` today.
  An app that only knows an older version leaves the extension out.
- `description` and `category` are what the Catalog shows and groups by.
- Each element has an `id`, a `label` (its name in the look editor), the
  family it `draws`, and a `kind`:
  - `rive`: `file`, a `.riv`, with an optional `artboard` and
    `stateMachine` (the file's defaults otherwise);
  - `code`: `module`, a `.js` file, and the custom `element` it defines.

The families are `lights`, `switches`, `scenes`, `doors`, `readings`,
`watching`, `media` and `climate` (thermostats). Code can draw any of them;
Rive drawings draw `climate` so far.

## Rive drawings

Make the animation in [Rive](https://rive.app), in its editor or with its
CLI, which builds a file from markup (`hc-thermostat/rive/` is a whole
project). The app fills the file's **view model** by property name, so give
the artboard a view model with the names below, of the types below, and a
state machine that reacts to them. A file may use as few names as it likes;
the app ignores the rest.

For `climate`:

| Name | Type | What |
|---|---|---|
| `heating` | boolean | it's heating now |
| `cooling` | boolean | it's cooling now |
| `on` | boolean | it isn't off |
| `temperature` | number | the reading, in the person's units, on the thermostat's step (whole °F, half °C) |
| `target` | number | what it's set to, the same way |
| `low`, `high` | number | the ends of its scale |
| `moving` | boolean | the look's motion is lively, so loops may play |
| `unit` | string | `°F` or `°C` |

The look's motion decides how the file runs. **Still** settles each state at
once and draws one frame. **Gentle** plays a change, such as heating starting
or a new target, and stops once it settles. **Lively** keeps running, so
loops play while `moving` is true. Someone who asks for less motion always
gets still, and nothing is drawn off screen. So make each state's settled
pose look right on its own, and keep loops in states that `moving` gates.

Text needs a font inside the file; check that its license lets you embed it
(the Open Font License does, though a reserved font name means you can't
subset it). A file with **scripts** must be signed with Rive's `--publish`;
one made of markup alone, like `hc-thermostat`, needs nothing.

## Code drawings

The module defines the custom element named in the manifest. The app
creates it and sets:

- `host`, an extension's host:
  - `me`: who is looking;
  - `units`: `show(value, unit)` gives a reading in the person's units
    (`show(21.5, '°C').text` is `70.7°F`), and `subscribe(f)` tells you
    when they change;
  - `theme`: `sheet` to adopt into your shadow root, with the app's colors
    as CSS custom properties, and `dark()`;
  - `rive`: Rive's runtime ([below](#rive-from-code));
  - `fileUrl(path)`: the address of one of your extension's files.
- `thing`, the thing's values in plain names, set again whenever they
  change: `name`, `room`, `on`, `level` (0 to 100, or null), `color`,
  `state` (in words, in the person's units), `temperature` (°C),
  `humidity`, `available`, `alarm`, `kind`.
- For `climate`, also `values`: the table above.

A drawing never commands anything, and its host has nothing that could. Ask
for what a tap does with an `act` event, and the app does it:

```js
this.dispatchEvent(new CustomEvent('act', { detail: { do: 'open' } })); // or 'switch', 'run'
```

`hc-gauge/gauge.js` is a whole example in about a hundred lines, with no
build step. A module can import its own files by relative path. The app
serves `.js`, `.mjs`, `.css`, `.json`, `.riv`, `.png`, `.jpg`, `.webp`,
`.svg`, `.woff2`, `.txt` and `.md` from inside the folder, and nothing
hidden.

If the module fails to load, or doesn't define its element within ten
seconds, the thing is drawn as Classic draws it.

### Rive from code

Code can play a Rive file with the app's runtime, and the same rules for
motion apply:

```js
const player = await host.rive.play(canvas, {
	src: host.fileUrl('dial.riv'),
	stateMachine: 'Main',
	values: { heating: true, temperature: 21.5 },
	width: 236,
	height: 236
});
player.set({ heating: false });
player.destroy(); // when your element is removed
```

`motion` defaults to the look's (`host.rive.motion()`); `player.properties`
lists the file's view model. Plugins have `host.rive` too, for their own
screens.

## Trying it

Copy the folder into `extensions/` in the web app's data directory
(`HC_DATA_DIR`), or pack it and use **Add from a file** in the Catalog.
Then choose its drawing in a look's Drawings; the editor's preview draws it
with your own things.

## Packing and releasing

In hc-extensions, `./pack.sh <id>` packs an extension's folder into
`dist/<id>-<version>.tar.zst`, leaving out hidden files and anything its
`.packignore` lists (`hc-thermostat` leaves out its Rive project). It also
gathers the licenses of embedded fonts. Pushing a tag `<id>-v<version>`
releases it: the workflow packs it, attaches it to a GitHub Release, adds it
to the registry's signed list of extensions, and checks that the Catalog
offers it.

An extension made elsewhere can be shared as its packed file, which anyone
can add with **Add from a file**.
