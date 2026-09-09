---
id: overview
title: Plugins Overview
sidebar_label: Overview
sidebar_position: 1
---

# Plugins Overview

Plugins are separate processes that bridge physical or cloud devices to HomeCore via MQTT. They run independently — crashing or restarting a plugin never affects HomeCore itself.

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

**Plugin isolation:** The SDK subscribes to specific device command topics (`homecore/devices/{device_id}/cmd`) rather than using wildcards. This prevents cross-plugin command contamination — a plugin only receives commands for devices it owns. Subscriptions are tracked internally and restored automatically on MQTT reconnect.

HomeCore treats the plugin as the source of truth for device discovery. In normal operation you do **not** pre-create devices manually. When the plugin discovers a light, sensor, speaker, or scene, it registers that device and HomeCore adds it to the registry automatically.

Plugins can also declare **capability actions** — plugin-specific
commands like "Pair Hue bridge", "Include Z-Wave device", "Rescan
devices". These show up as buttons under **Actions** on the plugin's
page in the web UI and are exposable to MCP clients without
plugin-specific code. See [Plugin Capabilities & Actions](./capabilities).

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
| [http-poller](./http-poller) | Rust | Generic HTTP endpoint polling |

Every one of these is its own repository, releases its own signed
artifact, and is installed from the registry rather than being built into
homeCore.

## Installing a plugin

The normal path is **Plugins → Add** in the web UI, or
`POST /api/v1/plugins/install`. homeCore fetches the plugin's artifact
from the [signed registry](https://homecore.io/registry/), verifies the
index's ed25519 signature and the artifact's SHA-256 before unpacking
anything, seeds a config file, and starts supervising it. No compose file
to edit, no binary to place.

Both `[registry].url` and `[registry].public_key` must be set or the
registry endpoints return `503` — see
[Configuration](../getting-started/configuration.md).

An installed plugin is recorded in `config/plugins/managed.toml`, which
homeCore owns. Your `homecore.toml` is never rewritten; a `[[plugins]]`
block there is for a plugin you built or unpacked yourself.

## Plugin notices

A plugin reports its own problems as structured **notices**, and the web
UI renders them inline on the plugin's card: missing credentials, a hub
that will not answer, nothing discovered yet, a permission that needs
changing on the device. They carry a severity and, where there is one, the
action that fixes it.

Notices are state, not log lines — a notice stays up while the condition
holds and clears when it stops being true, so a plugin that says "no
devices found" must re-evaluate that after each discovery sweep rather
than deciding once at startup.

## Plugin configuration

All plugins share the same `[homecore]` config section:

```toml
# config/plugins/<plugin_id>.toml — core-owned, passed to the plugin at launch

[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.hue"
password    = ""           # set if broker auth is enabled
```

homeCore owns that file. Each plugin's config lives at
`<base>/config/plugins/<plugin_id>.toml` and the supervisor passes the
path as the plugin's first argument, so the plugin still just reads a file
— only the *location* moved out of the plugin's own tree, where a plugin
upgrade could clobber it and where the API, the settings form, and an
operator editing by hand all disagreed about which copy was real.

Edit it from the UI (Plugins → the plugin → Configuration), over the API
(`PUT /api/v1/plugins/{id}/config`), or by editing the file directly. Core
watches the directory and **restarts that one plugin** so it re-reads its
config — core itself does not restart, and no other plugin is touched. A
write whose bytes are unchanged is ignored, and a transient unlink or
rename never kills a running plugin.

Run standalone for development by passing a path:

```bash
./hc-hue /etc/homecore-plugins/hue.toml
```

## Running plugins

Plugins are independent binaries. Run them from their installation directory:

```bash
cd /path/to/hc-hue
./hc-hue config/config.toml
```

Or with `run-dev.sh` for local development, from the workspace root:

```bash
./hc-scripts/run-dev.sh   # builds everything, then starts core + its plugins
```

## Plugin device registration

Plugins register devices by publishing a JSON payload to `homecore/plugins/{plugin_id}/register`.

For well-known device classes, the recommended path is **typed registration**. The plugin sends a canonical `device_type`, and HomeCore resolves the built-in schema automatically. This is how different plugins can expose lights, switches, and now media players in a consistent way.

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
3. Resolves the matching built-in device schema
4. Exposes the device to the API, UI, and rule engine without manual setup

### Explicit capabilities example

:::tip Prefer a device schema

The `capabilities` blob below is the original shape and still accepted. What a
modern plugin publishes is a **device schema** on
`homecore/devices/{id}/schema` — attribute kinds and ranges, both names of
every boolean, which readings are housekeeping, which one leads, and the
actions the device takes that are not attribute writes. That is what lets a
client render controls for hardware it has never heard of.

See [Declaring a
device](./developing-plugins#declaring-a-device), and the checklist in [Before
you release a plugin](./developing-plugins#before-you-release-a-plugin).

:::

Plugins can also publish an explicit schema when they need a custom device shape:

```json
{
  "device_id": "hue_001788fffe6841b3_1",
  "plugin_id": "plugin.hue",
  "name": "Living Room Main",
  "area": "living_room",
  "device_type": "light",
  "capabilities": {
    "on":         {"type": "boolean"},
    "brightness": {"type": "integer", "minimum": 0, "maximum": 254},
    "color_temp": {"type": "integer", "minimum": 2000, "maximum": 6500}
  }
}
```

Use explicit capabilities when the device does not fit a built-in type cleanly. Use `device_type` when you want HomeCore to understand the device as a known category.

### Known device types

The built-in catalog includes common categories such as:

- `switch`
- `light`
- `lock`
- `cover`
- `climate`
- `binary_sensor`
- `temperature_sensor`
- `media_player`

This matters because HomeCore can now treat media players from different plugins the same way at the automation layer. A plugin such as `hc-sonos` can register speakers as `media_player`, and rules can target those players by HomeCore device ID instead of plugin-local URLs or IP addresses.

HomeCore stores the device in the registry. Subsequent registrations on plugin restart are upserts, so names, areas, types, and schemas stay in sync with what the plugin reports.

## Plugin startup race condition

**Problem:** If a plugin starts very quickly and HomeCore's internal MQTT client isn't subscribed to `homecore/#` yet, the registration message is missed.

**Solution:** Set `plugin_ready_delay_secs` in `homecore.toml` (default: 10 seconds). HomeCore waits this many seconds after startup before the mode manager publishes initial states. The MQTT client subscription is established well before plugins connect.

For automated scripts, wait for HomeCore to print `API server starting` before launching plugins.

## Connecting to an external broker

For multi-machine deployments, configure plugins to connect to the same external broker as HomeCore:

```toml
[homecore]
broker_host = "192.168.1.10"    # HomeCore machine IP
broker_port = 1883
plugin_id   = "plugin.hue"
password    = "hue-password"
```

## Plugin management protocol

HomeCore includes a PluginManager that supervises managed plugins. Each managed plugin runs under a per-plugin supervisor task with start/stop/restart support and exponential backoff on crashes.

### Management MQTT topics

| Direction | Topic | Purpose |
|---|---|---|
| Plugin → HC | `homecore/plugins/{id}/heartbeat` | Plugin liveness signal (30-60s interval) |
| HC → Plugin | `homecore/plugins/{id}/manage/cmd` | Management commands from core |
| Plugin → HC | `homecore/plugins/{id}/manage/response` | Plugin response to management commands |

### Management commands

| Command | Description |
|---|---|
| `ping` | Health check — plugin responds with `pong` |
| `get_config` | Request plugin's current configuration |
| `set_config` | Push configuration changes to the plugin |
| `set_log_level` | Change the plugin's log level at runtime |

### Heartbeat and timeout

Managed plugins publish a heartbeat message every 30-60 seconds. The PluginManager runs a timeout sweep and marks a plugin as offline after 90 seconds without a heartbeat.

### Management API

| Endpoint | Description |
|---|---|
| `GET /api/v1/plugins/:id` | Get plugin status and details |
| `PATCH /api/v1/plugins/:id` | Update plugin metadata |
| `POST /api/v1/plugins/:id/start` | Start a managed plugin |
| `POST /api/v1/plugins/:id/stop` | Stop a managed plugin |
| `POST /api/v1/plugins/:id/restart` | Restart a managed plugin |
| `GET /api/v1/plugins/:id/config` | Get plugin configuration |
| `PUT /api/v1/plugins/:id/config` | Update plugin configuration |
| `DELETE /api/v1/plugins/:id/devices` | Bulk-wipe every device the plugin owns; plugin re-registers live ones on next sync. See [Devices → Wipe all devices for one plugin](../devices/overview#wipe-all-devices-for-one-plugin). |

### Managed plugins

All Rust device plugins use the official SDK with full management protocol support:

- **hc-hue** — heartbeat, remote config, dynamic log level, MQTT log forwarding
- **hc-wled** — heartbeat, remote config, dynamic log level, MQTT log forwarding
- **hc-yolink** — + custom action: `rescan_devices`
- **hc-lutron** — heartbeat, remote config, dynamic log level, MQTT log forwarding
- **hc-sonos** — heartbeat, remote config, dynamic log level, MQTT log forwarding
- **hc-isy** — heartbeat, remote config, dynamic log level, MQTT log forwarding
- **hc-zwave** — heartbeat, remote config, dynamic log level, MQTT log forwarding
- **hc-caseta** — heartbeat, remote config, dynamic log level, MQTT log forwarding
- **hc-ecowitt** — + gateway actions: `discover_gateways`, `refresh_sensors`,
  `get_gateway_info`, `set_custom_server`
- **hc-roku** — + device actions: `discover_devices`, `list_devices`,
  `refresh_catalog`, `device_info`, `send_command`, `app_icon`,
  `forget_stale_devices`
- **hc-thermostat** — + custom actions: `recalculate_all`, `reload_config`,
  `add_thermostat`, `remove_thermostat`, `get_thermostats`.
  First plugin to use the SDK's cross-device state subscription
  (`subscribe_state` / `run_managed_with_state`).

---

## Plugin MQTT topics (reference)

| Direction | Topic | Purpose |
|---|---|---|
| Plugin → HC | `homecore/devices/{id}/state` | Full state update (retained) |
| Plugin → HC | `homecore/devices/{id}/state/partial` | Partial update (JSON merge-patch) |
| Plugin → HC | `homecore/devices/{id}/availability` | `"online"` or `"offline"` (retained) |
| Plugin → HC | `homecore/plugins/{id}/register` | Device registration |
| HC → Plugin | `homecore/devices/{id}/cmd` | Command from HomeCore/API |
| Plugin → HC | `homecore/plugins/{id}/heartbeat` | Liveness signal (managed plugins) |
| HC → Plugin | `homecore/plugins/{id}/manage/cmd` | Management command (managed plugins) |
| Plugin → HC | `homecore/plugins/{id}/manage/response` | Management response (managed plugins) |
| Plugin → HC | `homecore/plugins/{id}/logs` | Forwarded plugin log lines (JSON `LogLine`) |
