---
id: zwave
title: Z-Wave
sidebar_label: Z-Wave
sidebar_position: 7
---

# Z-Wave (`hc-zwave`)

The hc-zwave plugin bridges a [zwave-js](https://zwave-js.github.io/node-zwave-js/) WebSocket server to HomeCore. It supports all Z-Wave devices that zwave-js can handle — locks, dimmers, switches, sensors, thermostats, and more.

## Prerequisites

- A Z-Wave controller (USB stick: Zooz ZST39, Aeotec Z-Stick, etc.)
- [zwave-js-server](https://github.com/zwave-js/zwave-js-server) running and accessible via WebSocket
- Alternatively, [Z-Wave JS UI](https://github.com/zwave-js/zwave-js-ui) (includes zwave-js-server)

## Setting up zwave-js-server

The easiest option is Z-Wave JS UI via Docker:

```bash
docker run -d \
  --name zwave-js-ui \
  --device /dev/ttyUSB0:/dev/ttyUSB0 \
  -p 8091:8091 \
  -p 3000:3000 \
  -v /path/to/store:/usr/src/app/store \
  zwavejs/zwave-js-ui:latest
```

Open `http://localhost:8091` → Settings → Z-Wave → enable WebSocket server on port 3000.

## Configuration

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.zwave"
password    = ""

[zwave]
ws_url = "ws://localhost:3000"  # zwave-js WebSocket server URL
```

## Running

```bash
cd /path/to/hc-zwave
./hc-zwave config/config.toml
```

## Device IDs

Z-Wave device IDs follow the pattern `zwave_{node_id}`:

```
zwave_1     ← controller (typically no attributes)
zwave_23    ← a door lock
zwave_7     ← a light switch
```

Multi-endpoint devices (e.g. a multi-outlet plug with separately controllable outlets) use:

```
zwave_{node_id}_ep{endpoint}
zwave_15_ep1    ← endpoint 1 of node 15
zwave_15_ep2    ← endpoint 2 of node 15
```

## Supported Command Classes

| CC | Devices | Attributes |
|---|---|---|
| Binary Switch (0x25) | On/off switches, outlets | `on` |
| Multilevel Switch (0x26) | Dimmers, fans | `on`, `level` (0-99) |
| Binary Sensor (0x30) | Motion, door sensors | `sensor_binary` |
| Multilevel Sensor (0x31) | Temperature, humidity | `air_temperature`, `humidity`, etc. |
| Door Lock (0x62) | Smart locks | `current_mode` (`"unsecured"` / `"secured"`), `locked` |
| Thermostat Mode (0x40) | Thermostats | `mode` |
| Thermostat Setpoint (0x43) | Thermostats | `heating`, `cooling` |
| Battery (0x80) | Any battery device | `level` |
| Notification (0x71) | Door/window, smoke, CO | Various event values |
| Color Switch (0x33) | RGB/RGBW lights | `red`, `green`, `blue`, `warm_white`, `cold_white` |
| Meter (0x32) | Power monitors | `electric_consumed_kwh`, `electric_w`, `electric_v`, `electric_a` |

## Commanding devices

### Switches and dimmers

```bash
# Turn on
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_7/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Set level (dimmer, 0-99)
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_7/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true, "level": 75}'
```

### Door locks

```bash
# Lock
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_23/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetMode": "secured"}'

# Unlock
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_23/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"targetMode": "unsecured"}'
```

:::caution Lock command field
For Door Lock CC 98, the command target field is `targetMode` (not `currentMode`). Using `currentMode` results in the command being silently ignored by zwave-js.
:::

### Thermostats

```bash
# Set heat setpoint to 68°F
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_12/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"heating": 68}'
```

## Rule examples

### Auto-lock after door closes

```toml
name = "Front door — auto-lock"
enabled = true

[trigger]
type      = "device_state_changed"
device_id = "yolink_front_door"
attribute = "open"
to        = false

[[actions]]
type          = "delay"
duration_secs = 30

[[actions]]
type      = "set_device_state"
device_id = "zwave_23"
state     = { targetMode = "secured" }
```

### Alert on manual unlock

```toml
name = "Front lock — unlocked alert"
enabled = true

[trigger]
type      = "device_state_changed"
device_id = "zwave_23"
attribute = "current_mode"
to        = "unsecured"

[[actions]]
type    = "notify"
channel = "telegram"
message = "Front door unlocked"
```

## Troubleshooting

| Problem | Solution |
|---|---|
| `WebSocket connection failed` | Check zwave-js-server is running and the `ws_url` in config is correct |
| Devices not appearing | Check zwave-js UI — nodes must be included in the Z-Wave network |
| Lock not responding | Verify `targetMode` (not `currentMode`) is used in the command |
| State stale | Z-Wave is a polling protocol for some CCs — values may be cached; force a poll in zwave-js UI |
| Node `zwave_1` has no attributes | This is the controller node — it has no user-visible state |

## Node name sync

Node names set in Z-Wave JS UI are synced to HomeCore device names automatically when state is published. Renaming a node in the UI takes effect at the next state update. Restarting hc-zwave forces immediate re-registration of all node names.

## Log rotation

hc-zwave writes logs to `logs/hc-zwave.log`. Rotation and compression are configured in `config/config.toml`:

```toml
[logging]
level       = "info"   # stderr log level; RUST_LOG overrides this
rotation    = "daily"  # daily | hourly | weekly | never
max_size_mb = 100      # rotate when file exceeds this MB (0 = time-only)
compress    = true     # gzip rotated files in a background thread
```

| File | Description |
|---|---|
| `logs/hc-zwave.log` | Active log (always uncompressed) |
| `logs/hc-zwave.2026-03-27.log.gz` | Rotated daily file (compressed) |
| `logs/hc-zwave.2026-03-27.1.log.gz` | Second rotation in same period (size limit hit) |
