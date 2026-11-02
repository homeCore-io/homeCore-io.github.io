---
id: plugin-screens
title: Plugin Screens and Cards
sidebar_label: Screens and Cards
sidebar_position: 4
---

# Plugin Screens and Cards

A plugin can bring its own screens to the homeCore web app: a page for
itself, a panel for its devices, a form in the automation editor, its devices'
cards on Home and the rooms, and cards of its own that a household adds to a
page. WLED, Ecowitt, Hue, Lutron, Sonos, Z-Wave, YoLink, Caséta, Roku,
Thermostat, Weather and NuHeat are built this way, and none of their screens
live in the app.

**The plugin carries its screens and serves them.** They are web components
(custom elements) in a folder that travels with the plugin, in whatever
package installs it. homeCore passes the files through to the app and keeps
none of them. The screen you see is therefore always the one the running
plugin carries. A plugin that is stopped, or has no screens, gets the app's
generic ones.

## Where a plugin's screens go

| Slot | Where it appears | The element is given |
|---|---|---|
| `plugin.page` | the plugin's page in Settings › Plugins, in place of the generic list of actions | `host` |
| `device.panel` | a device's panel, in place of the generic controls | `host`, `deviceId` |
| `rule.step` | the automation editor's form for a step that sets one of its devices | `host`, `deviceIds`, `value` |
| `device.card` | its devices' card on Home, the rooms and favourites | `host`, `deviceId`, `form` |
| `dashboard.card` | a card of its own, added from Edit → "Add a card" | `host`, `form`, `config` |

## The folder

Build your components into **one ES module**, with everything they need
bundled in. Nothing of the app's is shared except `host`. Then add a
`manifest.json`:

```json
{
  "host_api": 1,
  "entry": "index.js",
  "slots": [
    { "slot": "plugin.page", "element": "hc-yours-page" },
    { "slot": "device.panel", "element": "hc-yours-panel", "device_types": ["weather_station"] },
    { "slot": "device.card", "element": "hc-yours-card", "forms": ["standard", "large"] },
    {
      "slot": "dashboard.card",
      "element": "hc-yours-glance",
      "label": "At a glance",
      "description": "a line under it in Add a card",
      "forms": ["large", "standard"],
      "settings": "hc-yours-glance-settings"
    }
  ]
}
```

- `element` is the custom element your module defines for that place
  (lowercase, starting with a letter, with a hyphen).
- `device_types` limits a `device.panel`, `rule.step` or `device.card` slot
  to devices of those types. When it is absent, the slot covers all of the
  plugin's devices.
- `forms` lists the sizes a card can be: `compact` (one row), `standard` and
  `large` (two columns). The first is a dashboard card's size when it is
  added. When `forms` is absent, every size is allowed.
- A `dashboard.card` needs a `label` (its name in "Add a card"). `settings`
  names the element that edits its settings.

homeCore drops a slot it doesn't know, or one that breaks these rules. A UI
with no valid slot left is not offered at all.

## Serving it

Rust:

```rust
if let Some(dir) = plugin_sdk_rs::ui::find_dir(env!("CARGO_MANIFEST_DIR")) {
    mgmt = mgmt.with_ui_dir(dir, env!("CARGO_PKG_VERSION"));
}
```

`find_dir` looks at `HC_PLUGIN_UI_DIR` first, then a `ui/` folder beside the
program (where a package installs it), then `ui/dist` in your source tree. The
SDK declares the screens on the plugin's capability manifest, with a hash of
the files as their `build`, and answers homeCore's requests for the files
(`ui_file`, in pieces of 128 KiB). The Python (`with_ui_dir`), Node.js
(`withUiDir`) and .NET (`WithUiDir`) SDKs do the same.

The browser loads the files through homeCore at
`GET /api/v1/plugins/{id}/ui/{build}/{file}`. A given build never changes, so
the browser caches it for good. A rebuilt UI gets a new `build`, so it is
never served stale.

### Pictures the plugin keeps

A screen often wants pictures the plugin fetched from its devices while it
runs, such as a Roku channel's icon. Those can't be part of the built UI. The
plugin keeps them in a folder of its own and serves them the same way
(`with_files_dir` in the Rust SDK, homeCore 0.1.92 and later). The browser
gets them at `GET /api/v1/plugins/{id}/files/{path}` (pictures only: png, jpg,
webp, gif), and a screen builds that address with `host.fileUrl(path)`.

**A file's name is its identity.** The browser caches it for good, so a
plugin writes a new name when the contents change (hc-roku names an icon by
channel and version). App versions up to 0.1.27 have no `host.fileUrl`; on
those, draw no picture.

## The host

Every element is given a `host`: everything a screen may use, scoped to its
own plugin. The types are `@homecore/plugin-ui`, at `sdk/ui/index.d.ts` in the
homeCore repository. The package is not published to npm, so use it from a
checkout of that repository.

| | |
|---|---|
| `host.devices` | the plugin's devices, live: `subscribe(f)` (called now and on every change; returns a function that stops it), `list()`, `get(id)`, `label(d)`, `history(id, attribute)` |
| `host.alerts` | homeCore's alerts on the plugin's devices, live, as the Alerts page shows them: `subscribe(f)`, `list()`. Absent before app 0.1.34. |
| `host.command(deviceId, body)` | a command to one of its devices |
| `host.action(id, params)` / `host.query(id, params)` | one of the plugin's actions; `query` for read-only ones, open to anyone who can see devices |
| `host.upload(action, file, params)` | a file sent to one of its actions (up to 32 MiB) |
| `host.fileUrl(path)` | where a picture the plugin keeps is, for an `<img src>` (see above) |
| `host.config` | its settings file (admins): `get()`, `patch(section, values)`, `restartPlugin()` |
| `host.store` | JSON documents the web app keeps for its screens (up to 2 MiB each): `get(key)`, `put(key, value)`, `remove(key)` |
| `host.fetch(path)` | homeCore's API (`path` under `/api/v1`) as the person using it, for anything else |
| `host.units` | the units the person reads in: `show(value, unit)`, `toCore(value, unit)`, `subscribe(f)`. Absent before app 0.1.21. |
| `host.ui` | the app's `confirm(...)`, `openDevice(id)`, `navigate(href)` |
| `host.me` | who is using it: `name`, `role`, `isAdmin`, `can(scope)` |
| `host.theme` | `sheet` (the app's parts as a stylesheet) and `dark()` |

`host` also carries `api` (always `1`), `pluginId` and `appVersion`. The
optional members (`alerts`, `units`, `fileUrl`) arrived after the first
release of the interface, so check for them before use and fall back when
they are missing.

A screen runs inside the app, as the person using it, with the same trust the
plugin's own program already has. Use `host` for everything, because the
app's own internals change between releases.

Two habits keep a screen consistent with the rest of the app:

- **Show readings in the person's units.** homeCore's readings are °C and
  metric. Display them with `host.units.show(value, schemaUnit)` and convert
  what the person types back with `host.units.toCore`.
- **Show homeCore's alerts instead of deciding again.** Whether a battery is
  low is homeCore's call, based on the threshold the house set and what
  someone chose to ignore. Read `host.alerts` (`kind: 'low_battery'` on the
  device) rather than comparing `battery_pct` to a number of your own.

## The app's look

The app's colours and type are CSS custom properties, which reach into a
shadow root, so your screens follow light, dark and the household's theme.
Adopt `host.theme.sheet` into your shadow root for the app's element defaults
and its parts as classes:

- `hc-card`, `hc-head`, `hc-label`, `hc-num`, `hc-quiet`, `hc-row`, `hc-grid`
- `hc-pill` (+ `go`, `danger`), `hc-field`, `hc-table`
- `hc-tag` and `hc-dot` (+ `good`, `warn`, `bad`)
- for a card: **`hc-tile`** (+ `compact`, `lit`) with `hc-tile-name` and
  `hc-tile-state`. This is the app's own card frame, so your card sits
  naturally among the app's cards.

```js
set host(h) {
  this.shadowRoot.adoptedStyleSheets = [h.theme.sheet];
  ...
}
```

## Each slot's contract

**`plugin.page`, `device.panel`.** Draw the page or panel. A panel is told its
`deviceId`. When the person moves to another device, the panel is told the new
id; it is not recreated.

**`device.card`.** Draw the device's card at its `form`, which may change
while the card is shown. The card replaces the generic one at the sizes it
lists, and the generic card stands in at the others. The element's class may
have a static `accepts(device)`: when it returns false for a device, that
device keeps the app's own card (hc-yolink's card takes locks and temperature
probes and leaves room sensors to the app). Open the device's panel with
`host.ui.openDevice(id)` when the card is tapped.

**`dashboard.card`.** Each one added is its own card, with its own settings on
that page, given as `config` (`{}` until set). Its `settings` element is given
`host` and `config` and answers with a `change` event:

```js
this.dispatchEvent(new CustomEvent('change', { detail: { config: next } }));
```

Keep a working copy of the settings in that element. The `config` it is given
lags a moment behind its own saves, so several quick changes must build on
each other, not on `config`. The web app keeps the settings with the page;
homeCore never holds them.

**`rule.step`.** Given `deviceIds` (one device, or several set at once) and
`value` (the step's `state` for the first). Answer with the whole step:

```js
this.dispatchEvent(new CustomEvent('change', { detail: { action: {
  SetDeviceState: { device_id: id, state: { preset_id: 14 }, track_event_value: false }
} } }));
```

When several devices are each set differently, answer with a `Parallel` of
`SetDeviceState`s instead. The editor accepts the step only if every device
in it is the plugin's own. The element's class may offer two statics:

- `accepts(value)`: whether it can edit that step. When it says no, the
  generic form shows.
- `describe(host, deviceIds, value)`: the step in words, with `{devices}`
  where the devices' names go ("apply “Halloween 1” on `{devices}`"). It is
  used in every automation sentence.

## Name your numbers instead

You may not need a screen for names at all. Give an integer attribute
`options` in your device's schema:

```json
"preset_id": { "kind": "integer", "writable": true, "display_name": "Preset",
  "options": [{ "value": "14", "label": "Halloween 1" }] }
```

Every picker, trigger, check and sentence then says "Halloween 1" instead of
14. Republish the schema when the names change.

## Building

Any way of making custom elements works:

- **Plain JavaScript.** The plugin template's `ui/` is a page and a card
  written as plain classes, with no framework and no bundler; its build
  script only copies the files into `dist/`.
- **Svelte 5** with Vite, which the other plugins with screens use. Set
  `compilerOptions: { customElement: true }`, use `build.lib` with
  `formats: ['es']`, and copy `public/manifest.json` into `dist/`.
- **Lit**, or anything else that defines elements.

Things worth knowing:

- In a Svelte custom element, a prop named `host` turns `$host()` into a store
  subscription. Write `let { host: hc } = $props()`.
- The app's global stylesheet doesn't reach a shadow root, and a CSS file
  imported from your script lands nowhere. Import it with `?inline` and adopt
  it.
- A `@container` rule that overrides others must come after them.

## Developing

1. Run `npm run build` in `ui/` (or keep `vite build --watch` running).
2. Restart the plugin. Its new files have a new `build`, and the app loads them.
3. Run the app against a test homeCore with stand-ins for the real devices,
   never against your real house.

## Releasing

Put `ui/package.json` in your plugin. The release workflow builds it
(`npm ci && npm run build`, which must write `dist/manifest.json`) and packs
`dist/` into the plugin's package as `ui/`, beside the program; homeCore
installs it there. Commit `ui/package-lock.json`. Nothing else is published.

## Examples

- `plugins/hc-plugin-template/ui`: a page and a light's card, in plain JavaScript.
- `plugins/hc-ecowitt/ui`: a page, a weather station's panel and card, and
  "Weather now".
- `plugins/hc-wled/ui`: a page, a controller's panel, the automation editor's
  WLED step (with files sent to an action), a controller's card, and "Quick
  presets" with its settings.
- `plugins/hc-roku/ui`: pictures the plugin keeps (channel icons through
  `host.fileUrl`) and an automation step with its own device picker.
- `plugins/hc-thermostat/ui`: an add flow on the page, a panel that reads
  homeCore's device history (`host.devices.history`) for its chart, and a
  step whose `describe()` names what it does in the editor.
