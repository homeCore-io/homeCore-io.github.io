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

## Available plugins

| Plugin | Language | Devices |
|---|---|---|
| [hc-hue](./hue) | Rust | Philips Hue lights, groups, scenes |
| [hc-yolink](./yolink) | Rust | YoLink sensors, door sensors, outlets |
| [hc-lutron](./lutron) | Rust | Lutron RadioRA2 dimmers, switches, scenes |
| hc-sonos | Rust | Sonos speakers (via UPnP) |
| [hc-zwave](./zwave) | Rust | Z-Wave devices via zwave-js WebSocket |
| [hc-wled](./wled) | Rust | WLED LED controllers |
| [hc-isy](./isy) | Rust | ISY/IoX hub (Insteon, Z-Wave, Zigbee) |
| [http-poller](./http-poller) | Rust | Generic HTTP endpoint polling |

## Plugin configuration

All plugins share the same `[homecore]` config section:

```toml
# config/config.toml (in the plugin's directory)

[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.hue"
password    = ""           # set if broker auth is enabled
```

The config file path defaults to `config/config.toml` relative to the binary's working directory. Override with the first CLI argument:

```bash
./hc-hue /etc/homecore-plugins/hue.toml
```

## Running plugins

Plugins are independent binaries. Run them from their installation directory:

```bash
cd /path/to/hc-hue
./hc-hue config/config.toml
```

Or with `run-dev.sh` for local development (relative paths from the workspace root):

```bash
./scripts/run-dev.sh   # starts HomeCore + all configured plugins
```

## Plugin device registration

Plugins register devices by publishing a JSON payload to `homecore/plugins/{plugin_id}/register`:

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

HomeCore stores the device in the registry. Subsequent registrations (on plugin restart) are upserts — the device's name and capabilities are updated.

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

## Plugin MQTT topics (reference)

| Direction | Topic | Purpose |
|---|---|---|
| Plugin → HC | `homecore/devices/{id}/state` | Full state update (retained) |
| Plugin → HC | `homecore/devices/{id}/state/partial` | Partial update (JSON merge-patch) |
| Plugin → HC | `homecore/devices/{id}/availability` | `"online"` or `"offline"` (retained) |
| Plugin → HC | `homecore/plugins/{id}/register` | Device registration |
| HC → Plugin | `homecore/devices/{id}/cmd` | Command from HomeCore/API |
