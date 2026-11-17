---
id: overview
title: Plugins Overview
sidebar_label: Overview
sidebar_position: 1
---

# Plugins Overview

A plugin is a separate process that connects devices or a cloud service to
homeCore over MQTT. Plugins run apart from homeCore, so a plugin that crashes
or restarts doesn't take homeCore down with it.

## Architecture

```
Physical device (Zigbee, Z-Wave, WiFi, cloud API)
         ↕ native protocol
    Plugin process
         ↕ MQTT
    homeCore embedded broker (port 1883)
         ↕ internal event bus
    homeCore state bridge → rule engine
```

Each plugin:

1. Connects to homeCore's broker with its own `plugin_id` and password.
2. Registers its devices on `homecore/plugins/{plugin_id}/register`.
3. Publishes each device's state to `homecore/devices/{device_id}/state`
   (retained) and its availability to `homecore/devices/{device_id}/availability`
   (retained).
4. Subscribes to `homecore/devices/{device_id}/cmd` for each device it owns.

The SDKs subscribe to each device's own command topic, never to a wildcard,
so a plugin receives commands only for its own devices. They also restore
those subscriptions when the connection comes back.

The plugin is the source of truth for its devices. You don't create devices by
hand: when a plugin finds a light, sensor, speaker or scene, it registers it
and homeCore adds it. homeCore never writes a device's state itself. It sends
a command, and the plugin publishes what actually happened.

Plugins can also declare actions of their own, such as "Pair Hue bridge",
"Include Z-Wave device" or "Rescan devices". They appear under **Actions** on
the plugin's page in the web app, and MCP clients can call them. See
[Plugin Capabilities & Actions](./capabilities).

## Available plugins

| Plugin | Language | Devices |
|---|---|---|
| [hc-hue](./hue) | Rust | Philips Hue lights, groups, scenes |
| [hc-yolink](./yolink) | Rust | YoLink sensors, door sensors, outlets |
| [hc-lutron](./lutron) | Rust | Lutron RadioRA2 dimmers, switches, scenes |
| [hc-sonos](./sonos) | Rust | Sonos speakers, transport controls, favorites, playlists |
| [hc-zwave](./zwave) | Rust | Z-Wave devices via zwave-js WebSocket |
| [hc-wled](./wled) | Rust | WLED LED controllers |
| [hc-isy](./isy) | Rust | ISY/IoX hub (Insteon, Z-Wave, Zigbee) |
| [hc-caseta](./caseta) | Rust | Lutron Caséta Smart Bridge Pro |
| [hc-ecowitt](./ecowitt) | Rust | Ecowitt weather gateways and consoles |
| [hc-roku](./roku) | Rust | Roku players and TVs (ECP) |
| [hc-thermostat](./thermostat) | Rust | Virtual thermostats that combine sensors and drive a heater or cooler |
| [hc-weather](./weather) | Rust | The weather for a place (Open-Meteo), and weather warnings as alerts |
| [hc-nuheat](./nuheat) | Rust | NuHeat Signature floor-heating thermostats |
| [hc-mysa](./mysa) | Rust | Mysa smart thermostats |
| [hc-reolink](./reolink) | Rust | Reolink cameras, NVRs and Home Hubs |
| [Assistant (hc-mcp)](../tools/hc-mcp) | Python | A chat about the house, in a [plugin runtime](./runtimes) |

None of these is built into homeCore. Each is released as its own package and
installed from the registry.

## A plugin's own screens

A plugin can bring its own screens to the web app: its page, its devices'
panel and cards, a form in the automation editor, cards you add to a page
yourself (Edit › Add a card), drawings for the looks, and a helper in the top
bar. Every plugin above except ISY has some. The screens come in the
plugin's package and are updated with it. A plugin without them gets the
app's generic screens. See [Screens and Cards](./plugin-screens).

## Installing a plugin

Install from **Settings › Plugins › Catalog** in the web app, or with
`POST /api/v1/plugins/install` and `{"id": "plugin.hue"}` (add `"version"` for
a specific one). homeCore downloads the registry's index, checks its ed25519
signature against `[registry].public_key`, downloads the plugin's package and
checks its SHA-256, and only then unpacks it under
`plugins/<plugin_id>/<version>/`. It then writes the plugin a config file with
a fresh broker login and starts supervising it. You don't edit a compose file
or copy a binary into place.

Without a version, homeCore installs the newest one that runs on it. A
registry entry can name the oldest homeCore it needs (`min_core`), and
homeCore refuses a version that needs a newer one, saying which. The registry
keeps the newest three versions of each plugin.

Both `[registry].url` and `[registry].public_key` must be set, or the registry
endpoints return `503`. See
[Configuration](../getting-started/configuration.md).

Python plugins, such as the Assistant, run in a [plugin runtime](./runtimes)
instead of beside homeCore. Install them from the Catalog the same way once a
runtime is added.

homeCore records each installed plugin in `config/plugins/managed.toml`, a
file it owns. It never rewrites your `homecore.toml`. A `[[plugins]]` block
there is for a plugin you built or unpacked yourself.

**Uninstall…** on the plugin's page stops the plugin and deletes its devices
and its installed files, then asks whether to delete its settings too. Kept
settings, credentials included, are used again if you reinstall it. Over the
API, `DELETE /api/v1/plugins/{id}` deletes the settings unless you add
`?keep_config=true`.

## Plugin notices

A plugin reports its own problems as notices: missing credentials, a hub that
doesn't answer, nothing discovered yet, a permission that needs changing on
the device. The web app shows them as banners on the plugin's page, and the
plugin list shows its most serious warning or error. Each notice has a level
(`info`, `warning` or `error`) and can carry a remedy, a line saying what
fixes it.

A notice describes a condition that is true now. It stays up while the
condition holds and clears when it stops being true. The plugin sends its
full set of notices with every heartbeat, and homeCore replaces what it held.

Problems with a plugin's devices, meant for the household, are alerts. See
[Alerts from Plugins](./plugin-alerts).

## Plugin configuration

Every plugin's config file has the same `[homecore]` section:

```toml
# config/plugins/<plugin_id>.toml: owned by homeCore, passed to the plugin at launch

[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.hue"
password    = ""           # set if broker auth is enabled
```

homeCore owns that file, at `config/plugins/<plugin_id>.toml` under its home
directory, and passes the path to the plugin as its only argument. homeCore
fills in `[homecore]` at install.

You can change a plugin's settings on its page (the **Settings** tab), over
the API (`PUT /api/v1/plugins/{id}/config`), or by editing the file. homeCore
watches the directory and restarts that one plugin so it reads the new
settings. homeCore itself doesn't restart, and no other plugin is touched.
homeCore compares the parsed settings, so a write that changes only comments
or spacing is ignored, and so is one that changes only `[logging] level`. A
file that briefly disappears during a save never stops a running plugin. For a plugin
in a runtime, homeCore sends the new settings to the runtime instead.

The settings form comes from the plugin's config schema and descriptor
(`GET /api/v1/plugins/{id}/config/schema` and `/config/descriptor`). A plugin
that publishes neither gets a TOML text box.

The **Log** tab shows the plugin's own log lines. Changing its log level on
the page reaches the running plugin at once and is saved in the plugin's
`[logging] level`. The plugin keeps running; a level change doesn't restart
it.

To run a plugin by hand during development, pass it a config path:

```bash
./hc-hue /path/to/hue.toml
```

## Supervision

homeCore starts each plugin it runs as a child process, with the config path
as `argv[1]`, and supervises it:

- A plugin that exits on its own is restarted after a wait that starts at 2
  seconds and doubles each time, up to 60. A run that lasted at least 60
  seconds resets the wait.
- A plugin that hasn't sent a heartbeat within 2 minutes of starting, or has
  gone 5 minutes without one, is marked not responding, stopped and started
  again. Its last lines of output go into homeCore's log.
- To stop a plugin, homeCore sends SIGTERM and kills it 2 seconds later if it
  is still running. The SDKs answer SIGTERM by running the plugin's stop hook,
  marking every device offline, reporting the plugin offline and
  disconnecting. homeCore then shows the plugin offline at once.
- homeCore sets `HOMECORE_SUPERVISED` to its own process id on each plugin
  it starts. If that homeCore is killed or crashes, the SDKs see it and the
  plugin exits within a few seconds, so the next homeCore doesn't end up
  running a second copy.

homeCore starts plugins only after its own MQTT client is subscribed, so it
sees registrations a plugin sends as soon as it connects. A plugin still needs
a moment to subscribe to its command topics, and a command sent before then is
lost. `plugin_ready_delay_secs` in the `[startup]` section of `homecore.toml`
(default 10) sets how long homeCore waits after startup before it publishes
the initial mode states. Raise it if a plugin takes a long time to start.

## Plugin device registration

A plugin registers a device by publishing JSON to
`homecore/plugins/{plugin_id}/register`:

```json
{
  "device_id": "sonos_living_room",
  "plugin_id": "plugin.sonos",
  "name": "Living Room",
  "area": "living_room",
  "device_type": "media_player"
}
```

homeCore creates or updates the device record and offers the device to the
API, the app and the rule engine. Registering again is an upsert, so names,
areas, types and schemas follow what the plugin reports after a restart. A
registration can also carry `manufacturer`, `model`, `sw_version` (the
device's firmware) and `parent_device_id` (the bridge or controller it sits
behind). homeCore shows these and acts on none of them.

`device_type` says what the device is (`light`, `switch`, `lock`,
`media_player` and so on). Clients use it to choose cards and controls, so
lights and players from different plugins look and behave the same. The
device's schema, published retained on `homecore/devices/{id}/schema`, says
what each attribute is and what the device can do. See
[Declaring a device](./developing-plugins#declaring-a-device).

## Connecting to a broker on another machine

A plugin can run on another machine than homeCore. Point it at homeCore's
broker:

```toml
[homecore]
broker_host = "192.168.1.10"    # the machine homeCore runs on
broker_port = 1883
plugin_id   = "plugin.hue"
password    = "hue-password"
```

The broker has to listen on the network for this; see
[Plugin Runtimes](./runtimes#before-you-start-the-broker) and
[Broker](../administration/broker).

## Management protocol

### Management MQTT topics

| Direction | Topic | Purpose |
|---|---|---|
| Plugin → homeCore | `homecore/plugins/{id}/heartbeat` | Liveness, at an interval the plugin chooses |
| homeCore → Plugin | `homecore/plugins/{id}/manage/cmd` | Management commands and actions |
| Plugin → homeCore | `homecore/plugins/{id}/manage/response` | The plugin's replies |

### Management commands

The SDKs answer these themselves:

| Command | Description |
|---|---|
| `ping` | Health check; the reply is `status: "ok"` |
| `get_config` | Return the plugin's config file |
| `set_config` | Write a new config file. homeCore uses it for a plugin in a runtime; it writes the file itself for a plugin it runs. |
| `set_log_level` | Change the plugin's log level while it runs |
| `api_access` | homeCore's REST address and a key for the plugin (see [The plugin's own REST access](./capabilities#the-plugins-own-rest-access)) |
| `cancel` / `respond` | Cancel or answer a streaming action |
| `ui_file` | A piece of one of the plugin's screen files |

The Rust SDK also answers `plugin_file` (pictures the plugin keeps) and
`upload_chunk` (a file on its way to an action). Any other command is one of
the plugin's own [actions](./capabilities).

### Heartbeat and timeout

A managed plugin publishes a heartbeat at the interval it passes to the SDK.
The first-party plugins use 60 seconds. The heartbeat carries the plugin's
version, SDK and protocol versions, uptime, device count and its current
notices. homeCore checks every 30 seconds and marks a plugin offline once 90
seconds have passed without a heartbeat. A plugin that reports itself offline
on its way out reads offline at once.

### Management API

| Endpoint | Description |
|---|---|
| `GET /api/v1/plugins` | Every plugin and its status |
| `GET /api/v1/plugins/{id}` | One plugin's status and details |
| `PATCH /api/v1/plugins/{id}` | Turn it on or off (`enabled`), or set its log level (`log_level`) |
| `DELETE /api/v1/plugins/{id}` | Uninstall it (`?keep_config=true` keeps its config file) |
| `POST /api/v1/plugins/install` | Install from the registry (`id`, `version`) or from a local package (`path`) |
| `POST /api/v1/plugins/{id}/start` | Start a plugin homeCore runs |
| `POST /api/v1/plugins/{id}/stop` | Stop it |
| `POST /api/v1/plugins/{id}/restart` | Restart it |
| `GET /api/v1/plugins/{id}/config` | Its config |
| `PUT /api/v1/plugins/{id}/config` | Change its config |
| `GET /api/v1/plugins/{id}/config/schema` | The JSON Schema of its config |
| `GET /api/v1/plugins/{id}/config/descriptor` | How its settings form is laid out |
| `GET /api/v1/plugins/{id}/capabilities` | Its capability manifest |
| `POST /api/v1/plugins/{id}/command` | Run one of its actions |
| `POST /api/v1/plugins/{id}/query` | Run one of its read-only actions |
| `POST /api/v1/plugins/{id}/upload/{action}` | Send a file to one of its actions |
| `DELETE /api/v1/plugins/{id}/devices` | Delete every device the plugin owns; the plugin registers live ones again on its next sync. See [Devices › Wipe all devices for one plugin](../devices/overview#wipe-all-devices-for-one-plugin). |
| `GET /api/v1/registry/plugins` | What the registry offers |

A plugin in a runtime can't be started, stopped or turned off from homeCore;
its runtime runs it for as long as it is installed there.

Every first-party plugin supports the whole management protocol: heartbeat,
remote config, log level, log forwarding and actions. Each plugin's page
describes its actions.

## Plugin MQTT topics (reference)

| Direction | Topic | Purpose |
|---|---|---|
| Plugin → homeCore | `homecore/devices/{id}/state` | Full state (retained) |
| Plugin → homeCore | `homecore/devices/{id}/state/partial` | Partial state (JSON merge patch) |
| Plugin → homeCore | `homecore/devices/{id}/availability` | `online` or `offline` (retained) |
| Plugin → homeCore | `homecore/devices/{id}/schema` | Device schema (retained) |
| Plugin → homeCore | `homecore/devices/{id}/alerts` | The device's current alerts (retained) |
| homeCore → Plugin | `homecore/devices/{id}/cmd` | A command for the device |
| Plugin → homeCore | `homecore/plugins/{id}/register` | Device registration |
| Plugin → homeCore | `homecore/plugins/{id}/unregister` | Device removal |
| Plugin → homeCore | `homecore/plugins/{id}/status` | Plugin status (retained) |
| Plugin → homeCore | `homecore/plugins/{id}/capabilities` | Capability manifest (retained) |
| Plugin → homeCore | `homecore/plugins/{id}/alerts` | The plugin's alerts about itself (retained) |
| Plugin → homeCore | `homecore/plugins/{id}/heartbeat` | Liveness signal |
| homeCore → Plugin | `homecore/plugins/{id}/manage/cmd` | Management command |
| Plugin → homeCore | `homecore/plugins/{id}/manage/response` | Management reply |
| Plugin → homeCore | `homecore/plugins/{id}/commands/{request_id}/events` | Stages of a streaming action |
| Plugin → homeCore | `homecore/plugins/{id}/logs` | Forwarded log lines (JSON) |
| Plugin → homeCore | `homecore/plugins/{id}/state/set` | A change to what the plugin has learned, for homeCore to keep |
| homeCore → Plugin | `homecore/plugins/{id}/state` | What the plugin has learned, kept by homeCore (retained) |
| Plugin → homeCore | `homecore/events/{event_type}` | A custom event |
| homeCore → Plugin | `homecore/system/location` | The house's latitude and longitude (retained) |
| homeCore → Plugin | `homecore/system/tz` | The house's time zone (retained) |
