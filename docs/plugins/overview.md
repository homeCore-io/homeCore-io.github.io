---
id: overview
title: Plugins Overview
sidebar_label: Overview
sidebar_position: 1
---

# Plugins Overview

A plugin is a separate process that connects physical or cloud devices to HomeCore over MQTT. Plugins run independently of HomeCore, so a plugin that crashes or restarts does not take HomeCore down with it.

## Architecture

```
Physical device (Zigbee, Z-Wave, WiFi, cloud API)
         ↕ native protocol
    Plugin process
         ↕ MQTT
    HomeCore embedded broker (port 1883)
         ↕ internal event bus
    HomeCore state bridge → rule engine
```

Each plugin:
1. Connects to the embedded MQTT broker with its own `plugin_id` credential
2. Publishes device discovery via `homecore/plugins/{plugin_id}/register`
3. Publishes device state to `homecore/devices/{device_id}/state` (retained)
4. Publishes availability to `homecore/devices/{device_id}/availability` (retained)
5. Subscribes to `homecore/devices/{device_id}/cmd` for commands from HomeCore

The SDKs subscribe to each device's own command topic (`homecore/devices/{device_id}/cmd`) and never to a wildcard, so a plugin only receives commands for the devices it owns. The SDK tracks these subscriptions and restores them when the MQTT connection comes back.

HomeCore treats the plugin as the source of truth for device discovery. In normal operation you do not create devices by hand. When the plugin finds a light, sensor, speaker or scene, it registers that device and HomeCore adds it to the registry.

Plugins can also declare **capability actions**: plugin-specific commands such as "Pair Hue bridge", "Include Z-Wave device" or "Rescan devices". They appear under **Actions** on the plugin's page in the web UI, and MCP clients can call them without any plugin-specific code. See [Plugin Capabilities & Actions](./capabilities).

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
| [hc-thermostat](./thermostat) | Rust | Virtual thermostats (aggregated sensors → actuator) |
| [hc-weather](./weather) | Rust | The weather for a place (Open-Meteo), and weather warnings as alerts |
| [hc-nuheat](./nuheat) | Rust | NuHeat Signature floor-heating thermostats |

These plugins live in the homeCore repository. Each one is released as its own
signed artifact and installed from the registry; none of them is built into
homeCore.

## A plugin's own screens

A plugin can bring its own screens to the web app: its page, its devices' panel
and cards, a form in the automation editor, and cards you add to a page
yourself (Edit → Add a card). WLED, Ecowitt, Hue, Lutron, Sonos, Z-Wave,
YoLink, Caséta, Roku, Thermostat, Weather and NuHeat have them. The screens
come in the plugin's own package and are updated along with it. A plugin
without them gets the app's generic screens. See
[Screens and Cards](./plugin-screens) for how a plugin provides them.

## Installing a plugin

The usual way is **Plugins → Add** in the web UI, or
`POST /api/v1/plugins/install`. homeCore fetches the plugin's artifact from
the [signed registry](https://homecore.io/registry/) and checks the index's
ed25519 signature and the artifact's SHA-256 before it unpacks anything. It
then seeds a config file and starts supervising the plugin. You don't edit a
compose file or copy a binary into place.

Both `[registry].url` and `[registry].public_key` must be set, or the
registry endpoints return `503`. See
[Configuration](../getting-started/configuration.md).

homeCore records each installed plugin in `config/plugins/managed.toml`, a
file it owns. It never rewrites your `homecore.toml`. A `[[plugins]]` block
there is for a plugin you built or unpacked yourself.

## Plugin notices

A plugin reports its own problems as structured **notices**, such as missing
credentials, a hub that doesn't answer, nothing discovered yet, or a
permission that needs changing on the device. The web UI shows them as
banners on the plugin's page, and the plugin list shows its most serious
warning or error.
Each notice has a level (`info`, `warning` or `error`) and can carry a
remedy, a line saying what fixes it.

A notice describes a condition that is true now. It stays up while the
condition holds and clears when the condition stops being true. The plugin
sends its full set of notices with every heartbeat, and HomeCore replaces what
it held. So a plugin that reports "no devices found" has to re-check that
after each discovery sweep instead of deciding once at startup.

## Plugin configuration

Every plugin's config file has the same `[homecore]` section:

```toml
# config/plugins/<plugin_id>.toml — core-owned, passed to the plugin at launch

[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.hue"
password    = ""           # set if broker auth is enabled
```

homeCore owns that file. Each plugin's config lives at
`<base>/config/plugins/<plugin_id>.toml`, and the supervisor passes the path
to the plugin as its first argument. The plugin still just reads a file. What
changed is where the file lives: it is no longer inside the plugin's own
directory, where a plugin upgrade could overwrite it and where the API, the
settings form and someone editing by hand could each end up with a different
copy.

You can edit it from the UI (Plugins, then the plugin's **Settings** tab),
over the API (`PUT /api/v1/plugins/{id}/config`), or by editing the file.
HomeCore watches the directory and **restarts that one plugin** so it re-reads
its config. HomeCore itself does not restart, and no other plugin is touched.
A write that leaves the bytes unchanged is ignored, and a file that briefly
disappears during an unlink or rename never stops a running plugin.

To run a plugin standalone during development, pass it a path:

```bash
./hc-hue /etc/homecore-plugins/hue.toml
```

## Running plugins

Plugins are independent binaries. You can run one from its installation directory:

```bash
cd /path/to/hc-hue
./hc-hue config/config.toml
```

For local development, `run-dev.sh` in the workspace root builds everything
and starts core with its plugins:

```bash
./hc-scripts/run-dev.sh   # builds everything, then starts core + its plugins
```

## Plugin device registration

A plugin registers a device by publishing a JSON payload to `homecore/plugins/{plugin_id}/register`.

For well-known device classes, use **typed registration**: the plugin sends a
canonical `device_type`. Clients use the type to choose cards and controls,
which is how lights, switches and media players from different plugins end up
presented the same way.

### Typed registration example

```json
{
  "device_id": "sonos_living_room",
  "plugin_id": "plugin.sonos",
  "name": "Living Room",
  "area": "living_room",
  "device_type": "media_player"
}
```

When HomeCore receives that registration it:

1. Creates or updates the device record
2. Stores the `device_type`
3. Resolves a built-in schema for that type, if the device type catalog is installed (see below)
4. Exposes the device to the API, UI, and rule engine without manual setup

The built-in schemas come from `device-types.toml` in the profiles directory
(`config/profiles/device-types.toml` by default). HomeCore ships an example at
`config/profiles/examples/device-types.toml`, which is not loaded
automatically. Without the file, HomeCore logs that typed devices will not get
automatic schemas, and the plugin's own schema is all a client has to go on.

### Explicit capabilities example

:::tip Prefer a device schema

The `capabilities` blob below is the original shape and is still accepted. A
current plugin publishes a **device schema** on
`homecore/devices/{id}/schema` instead. The schema carries attribute kinds and
ranges, the names of both states of every boolean, which readings are
housekeeping, which one leads, and the actions the device takes that are not
attribute writes. With that, a client can render controls for hardware it has
never seen before.

See [Declaring a
device](./developing-plugins#declaring-a-device), and the checklist in [Before
you release a plugin](./developing-plugins#before-you-release-a-plugin).

:::

A plugin can also publish explicit capabilities when it needs a custom device shape:

```json
{
  "device_id": "hue_001788fffe6841b3_1",
  "plugin_id": "plugin.hue",
  "name": "Living Room Main",
  "area": "living_room",
  "device_type": "light",
  "capabilities": {
    "on":             {"type": "boolean"},
    "brightness_pct": {"type": "number", "minimum": 0, "maximum": 100},
    "color_temp":     {"type": "integer", "minimum": 2000, "maximum": 6500}
  }
}
```

Use explicit capabilities when the device does not fit a built-in type
cleanly. Use `device_type` when you want HomeCore to understand the device as
a known category.

### Known device types

The example catalog includes common categories such as:

- `switch`
- `light`
- `lock`
- `cover`
- `climate`
- `binary_sensor`
- `temperature_sensor`
- `media_player`

A shared type lets HomeCore treat devices from different plugins the same way
in automations. `hc-sonos` registers its speakers as `media_player`, for
example, so rules target a player by its HomeCore device ID rather than a
plugin-local URL or IP address.

HomeCore stores the device in the registry. When the plugin restarts and
registers again, the registration is an upsert, so names, areas, types and
schemas stay in step with what the plugin reports.

## Plugin startup race condition

HomeCore starts plugins only after its internal MQTT client has confirmed its
`homecore/#` subscription, so registrations a plugin publishes as soon as it
connects are not missed.

A second timing issue remains: a plugin needs a moment to connect and
subscribe to its command topics, and a command sent before then is dropped.
`plugin_ready_delay_secs` in the `[startup]` section of `homecore.toml`
(default 10 seconds) sets how long HomeCore waits after startup before the
mode manager publishes initial mode states. Raise it if you have plugins that
take a long time to start.

## Connecting to an external broker

For multi-machine deployments, point the plugin at the broker HomeCore uses:

```toml
[homecore]
broker_host = "192.168.1.10"    # HomeCore machine IP
broker_port = 1883
plugin_id   = "plugin.hue"
password    = "hue-password"
```

## Plugin management protocol

HomeCore's plugin manager supervises every plugin it launches. Each plugin has
its own supervisor task that can start, stop and restart it. When a plugin
exits on its own, the supervisor restarts it with exponential backoff, from
2 seconds up to 60. A run that lasted at least 60 seconds resets the backoff.

### Management MQTT topics

| Direction | Topic | Purpose |
|---|---|---|
| Plugin → HC | `homecore/plugins/{id}/heartbeat` | Plugin liveness signal, at an interval the plugin chooses |
| HC → Plugin | `homecore/plugins/{id}/manage/cmd` | Management commands from core |
| Plugin → HC | `homecore/plugins/{id}/manage/response` | Plugin response to management commands |

### Management commands

The SDKs answer these themselves:

| Command | Description |
|---|---|
| `ping` | Health check; the plugin replies with `status: "ok"` |
| `get_config` | Return the contents of the plugin's config file |
| `set_config` | Write a new config file (TOML text, or a JSON object converted to TOML) |
| `set_log_level` | Change the plugin's log level at runtime |

The Rust SDK also handles `ui_file` and `plugin_file` (serving the plugin's
screens and the pictures it keeps), `upload_chunk` (a file on its way to an
action), and `cancel` / `respond` for streaming actions. Any other command is
one of the plugin's own [capability actions](./capabilities).

### Heartbeat and timeout

A managed plugin publishes a heartbeat at the interval it passes to
`enable_management`. The first-party plugins use 60 seconds. The heartbeat
carries the plugin's version, SDK and protocol versions, uptime, device count
and its current notices. HomeCore checks every 30 seconds and marks a plugin
offline once 90 seconds have passed without a heartbeat.

### Management API

| Endpoint | Description |
|---|---|
| `GET /api/v1/plugins/:id` | Get plugin status and details |
| `PATCH /api/v1/plugins/:id` | Update plugin metadata |
| `DELETE /api/v1/plugins/:id` | Deregister the plugin |
| `POST /api/v1/plugins/:id/start` | Start a managed plugin |
| `POST /api/v1/plugins/:id/stop` | Stop a managed plugin |
| `POST /api/v1/plugins/:id/restart` | Restart a managed plugin |
| `GET /api/v1/plugins/:id/config` | Get plugin configuration |
| `PUT /api/v1/plugins/:id/config` | Update plugin configuration |
| `GET /api/v1/plugins/:id/config/schema` | The JSON Schema of its config |
| `GET /api/v1/plugins/:id/config/descriptor` | How its settings form is laid out |
| `GET /api/v1/plugins/:id/capabilities` | Its capability manifest |
| `POST /api/v1/plugins/:id/command` | Run one of its actions |
| `POST /api/v1/plugins/:id/query` | Run one of its read-only actions |
| `DELETE /api/v1/plugins/:id/devices` | Delete every device the plugin owns; the plugin re-registers live ones on its next sync. See [Devices → Wipe all devices for one plugin](../devices/overview#wipe-all-devices-for-one-plugin). |

### Managed plugins

Every first-party plugin is built on the Rust SDK and supports the whole
management protocol: heartbeat, remote config, a runtime log level, and log
forwarding over MQTT. Most also declare their own actions, which each plugin's
page describes. A few examples:

- **hc-yolink**: `rescan_devices`
- **hc-ecowitt**: `discover_gateways`, `refresh_sensors`,
  `get_gateway_info`, `set_custom_server`
- **hc-roku**: `status`, `discover_devices`, `refresh_catalog`,
  `device_info`, `send_command`, `forget_device`, `forget_stale_devices`
- **hc-thermostat**: `status`, `get_thermostats`, `recalculate_all`,
  `add_thermostat`, `remove_thermostat`, `fix_entry`. It also reads other
  plugins' devices: their state (`subscribe_state` with
  `run_managed_with_state`) and whether they are online
  (`subscribe_availability`).

---

## Plugin MQTT topics (reference)

| Direction | Topic | Purpose |
|---|---|---|
| Plugin → HC | `homecore/devices/{id}/state` | Full state update (retained) |
| Plugin → HC | `homecore/devices/{id}/state/partial` | Partial update (JSON merge-patch) |
| Plugin → HC | `homecore/devices/{id}/availability` | `"online"` or `"offline"` (retained) |
| Plugin → HC | `homecore/devices/{id}/schema` | Device schema (retained) |
| Plugin → HC | `homecore/devices/{id}/alerts` | The device's current alerts (retained) |
| Plugin → HC | `homecore/plugins/{id}/register` | Device registration |
| Plugin → HC | `homecore/plugins/{id}/unregister` | Device removal |
| Plugin → HC | `homecore/plugins/{id}/status` | Plugin status (retained) |
| Plugin → HC | `homecore/plugins/{id}/capabilities` | Capability manifest (retained) |
| Plugin → HC | `homecore/plugins/{id}/alerts` | The plugin's alerts about itself (retained) |
| HC → Plugin | `homecore/devices/{id}/cmd` | Command from HomeCore/API |
| Plugin → HC | `homecore/plugins/{id}/heartbeat` | Liveness signal (managed plugins) |
| HC → Plugin | `homecore/plugins/{id}/manage/cmd` | Management command (managed plugins) |
| Plugin → HC | `homecore/plugins/{id}/manage/response` | Management response (managed plugins) |
| Plugin → HC | `homecore/plugins/{id}/commands/{request_id}/events` | Stages of a streaming action |
| Plugin → HC | `homecore/plugins/{id}/logs` | Forwarded plugin log lines (JSON `LogLine`) |
