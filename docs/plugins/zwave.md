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

## What devices report

Names and units follow homeCore's shared device vocabulary, converted from
each device's own scale inside the plugin.

| Attribute | From | Notes |
|---|---|---|
| `on` | Binary Switch (37), Multilevel Switch (38) | Writable. On a dimmer `{"on": true}` restores the last level. |
| `brightness_pct` | Multilevel Switch (38) | 0–100. Z-Wave 99 is 100 %; any level above 0 is at least 1 %. Writing 100 % sends 99, 0 % turns it off. |
| `position` | Window Covering (106), Multilevel Switch (38) on a motorised cover, Barrier Operator (102, read-only) | 0–100, 100 = open. Writable on 106 and 38. |
| `tilt_pct` | Window Covering (106) slat angle | 100 = slats open. Writable. |
| `open` | Binary Sensor, Notification Access Control, Barrier Operator | `true` = open. Writable only on a garage door opener (102). |
| `barrier_state` | Barrier Operator (102) | `open`, `closed`, `opening`, `closing`, `stopped`. |
| `locked` | Door Lock (98) | Writable. Door codes (User Code, 99) are never published. |
| `heat_setpoint`, `cool_setpoint` | Thermostat Setpoint (67) | °C, converted from °F thermostats both ways. Writable. |
| `hvac_mode` | Thermostat Mode (64) | `off`, `heat`, `cool`, `auto`, `fan_only`, `dry`; other modes keep their own name (`aux_heat`, `energy_heat`, `away`, …). Writable. |
| `hvac_action` | Thermostat Operating State (66) | `idle`, `heating`, `cooling`, `fan`. |
| `fan_mode` | Thermostat Fan Mode (68) | `auto_low`, `low`, `high`, `circulation`, …. Writable. |
| `color_rgb` | Color Switch (51) | `{r, g, b}`. Writable; turns the white channels off. |
| `color_temp` | Color Switch (51) warm/cold white | Kelvin, as the mix between 2700 K (warm) and 6500 K (cold). Only on bulbs with both white channels. |
| `temperature`, `humidity`, `illuminance`, `pressure`, `co2`, `power_w`, `voltage`, `current_a` | Multilevel Sensor (49) | °C, %, lux, hPa, ppm, W, V, A — converted from the scale the sensor reports (°F, kPa, inHg, BTU/h, mV, mA). |
| `power_w`, `energy_kwh`, `voltage`, `current_a` | Meter (50) | Plus `*_exported` for produced energy, and the v3 extras (`apparent_energy_kvah`, `power_factor`, …). |
| `battery_pct`, `battery_low` | Battery (128) | |
| `motion`, `tampered`, `water_detected`, `smoke`, `co` | Binary Sensor (48), Notification (113) | |

**Fades.** Send `transition_ms` with a level, position or colour write
(`{"brightness_pct": 40, "transition_ms": 3000}`). Z-Wave durations are whole
seconds, so it rounds to the nearest second, and a device without duration
support ignores it.

:::tip Unaliased values
Anything without a shared name still publishes under a
deterministic synthetic name like `cc50_value_pk67073` so it's visible.
Watch for these in the device's attributes — if you find one that
should have a clean canonical name, file an issue with the propertyKey
and the value's meaning and we'll add an alias.
:::

## Commanding devices

### Switches and dimmers

```bash
# Turn on
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_7/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Set brightness (brightness_pct, 0–100)
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_7/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brightness_pct": 75}'
```

### Door locks

```bash
# Lock
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_23/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locked": true}'

# Unlock
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_23/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"locked": false}'
```


### Thermostats

```bash
# Set the heat setpoint to 20 °C (sent as 68 to a °F thermostat)
curl -s -X PATCH http://localhost:8080/api/v1/devices/zwave_12/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"heat_setpoint": 20}'
```

## Plugin actions

hc-zwave declares three [capability actions](./capabilities) the admin
UI exposes as buttons on the plugin detail page (and hc-mcp surfaces
via `list_plugin_actions`).

### `include_node` (streaming, admin)

Put the controller into inclusion mode and add one or more Z-Wave
devices.

1. Click **Include Z-Wave device**. The drawer opens and tells you to
   press the include button on each device.
2. Press the device's include button. The flow emits `progress`
   updates as zwave-js reports the inclusion lifecycle: *waiting for
   controller* → *listening* → *Node 14 included; interviewing…* →
   *Node 14 interview complete*. Each newly-added node shows up in
   the item list, color-coded by status (`added` → `interviewing`
   → `ready`).
3. Repeat for any additional devices.
4. Click **Done**. For each node whose interview completed during the
   session, the action prompts for a **name** and **area** (both
   optional, with a **Skip** checkbox). On submit it sends
   `node.set_name` / `node.set_location` to zwave-js, then triggers a
   rescan that publishes the new identity to homeCore.

S2 security: requested classes are auto-granted. Devices that require
**DSK PIN entry** are not supported in v1 — the flow emits a warning
and the inclusion times out.

### `exclude_node` (streaming, admin)

Mirror image. Put the controller into exclusion mode, press the
exclude / reset button on each device, click **Done**. Removed nodes
are unregistered from homeCore immediately.

### `rescan_nodes` (sync, user)

Re-fetches every node's full state from zwave-js and republishes to
homeCore. Useful when:

- A freshly-included device hasn't appeared yet (interview is slow on
  battery / S2 nodes).
- You renamed nodes in Z-Wave JS UI and want the homeCore device names
  refreshed without restarting the plugin.

`include_node`'s `complete` step auto-pings rescan, so you usually
don't need to click this manually after pairing.

## Startup primary-state refresh

zwave-js caches each value's last reported state. Switches/plugs that
only emit meter reports, and dimmers/locks/thermostats/barriers that
don't auto-report on local actuation, can leave their primary state
stale across plugin restarts — at which point the snapshot would
publish a wrong `on` / `brightness_pct` / setpoint / `hvac_mode` / `locked` /
position / colour over the live state in homeCore.

To prevent that, hc-zwave issues `node.poll_value` for the primary
state of every non-sleeping node on startup (and again after every
`rescan_nodes` completion). The reply arrives as a `value updated`
event and corrects everything downstream.

| Command class | Property | Devices |
|---|---|---|
| 37 (Binary Switch) | `currentValue` | Switches, smart plugs |
| 38 (Multilevel Switch) | `currentValue` | Dimmers, motorized shades, fans |
| 64 (Thermostat Mode) | `mode` | Thermostats |
| 66 (Thermostat Operating State) | `state` | Thermostats |
| 67 (Thermostat Setpoint) | `setpoint` | Thermostats (per-type via propertyKey) |
| 68 (Thermostat Fan Mode) | `mode` | Thermostat fan |
| 98 (Door Lock) | `currentMode` | Door locks |
| 102 (Barrier Operator) | `currentState` | Garage doors |
| 117 (Color Switch) | `currentColor` | RGB lights |

Endpoint is not constrained — multi-endpoint devices (e.g., dual-relay
smart plugs exposing endpoints 1 and 2) get every endpoint refreshed.

**Eligibility:**

- **Mains-powered nodes** (`isListening = true`) are always polled.
- **FLiRS nodes** (battery-powered but wake every 250ms / 1000ms — door
  locks are typical) are polled.
- **Sleeping battery devices** are skipped: they can't answer until
  they wake on their own schedule, and zwave-js would queue the
  request and flood the air at wake-up.

**Throttling:** a 200ms inter-poll delay keeps the controller from
saturating — about 5 polls per second, so a 100-poll startup spreads
over ~20 seconds of background chatter.

The summary is logged at info level on completion:

```
INFO Refreshed primary-state values polled_nodes=12 polled_values=18
     skipped_battery=4 eligible_no_targets=2
```

`eligible_no_targets` counts nodes that are mains/FLiRS but expose no
command class hc-zwave currently refreshes (controller, repeaters,
sensor-only devices) — a coverage-gap signal.

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
state     = { locked = true }
```

### Alert on manual unlock

```toml
name = "Front lock — unlocked alert"
enabled = true

[trigger]
type      = "device_state_changed"
device_id = "zwave_23"
attribute = "locked"
to        = false

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
| Lock not responding | Send `{"locked": true}` / `{"locked": false}`; check the lock is awake and in range |
| State stale | Restart the plugin or run `rescan_nodes` — both trigger the [primary-state refresh](#startup-primary-state-refresh) which polls every actuator's current value. Sleeping battery devices catch up on their next wake-up. |
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
