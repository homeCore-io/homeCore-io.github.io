---
id: thermostat
title: Thermostat
sidebar_label: Thermostat
sidebar_position: 11
---

# Virtual Thermostat (`hc-thermostat`)

The `hc-thermostat` plugin implements software thermostats that **observe one or
more temperature sensors and drive another HomeCore device on/off** according
to a setpoint, hysteresis deadband, and mode. It's the first plugin that is a
**cross-device consumer** — it reads state from devices owned by other plugins
and publishes commands to them.

Typical use: aggregate two or three sensor readings (e.g. YoLink or Ecowitt
thermometers), maintain a target temperature, and control a Z-Wave relay, Hue
plug, or Shelly switch that powers HVAC equipment.

## Features

- **Multi-sensor aggregation:** average / min / max across any number of sensor
  devices, with configurable attribute name (default `temperature`)
- **Hysteresis deadband:** actuator flips at `setpoint ± hysteresis/2`, with
  sticky state inside the deadband to prevent oscillation
- **Heat / cool / off modes:** inverts the control logic; `off` force-idles
  and publishes an OFF command even inside a lockout window
- **Short-cycle protection:** optional `min_on_secs` and `min_off_secs`
  windows that delay actuator transitions to protect HVAC compressors
- **Pending-call surfacing:** when a lockout defers a transition, the
  thermostat reports the pending state + remaining lockout time for UI display
- **Runtime command persistence:** setpoint / mode / hysteresis / sensors /
  actuator changes made via MQTT are written back to `config.toml` so
  restarts are idempotent
- **Restart reconciliation:** on startup, the plugin reads its own retained
  state topic to restore `actuator_last_change`, so short-cycle lockouts
  survive plugin restarts
- **Full SDK integration:** heartbeat, log forwarding, remote config,
  dynamic log level, custom management commands

## Setup

### 1. Copy and edit the config

```bash
cd plugins/hc-thermostat
cp config/config.toml.example config/config.toml
# (or config.dev.toml if you're running a dev build)
```

### 2. Broker ACL

The thermostat is a *cross-device consumer*, so its ACL is broader than
typical plugins:

```toml
[[broker.clients]]
id       = "plugin.thermostat"
password = "{bcrypt_hash}"
allow_pub = [
    "homecore/devices/thermostat_+/state",       # own state
    "homecore/devices/+/cmd",                    # commands to actuators
    "homecore/plugins/plugin.thermostat/+",      # heartbeat + logs
]
allow_sub = [
    "homecore/devices/thermostat_+/cmd",         # own cmd topic
    "homecore/devices/+/state",                  # read any sensor
    "homecore/plugins/plugin.thermostat/manage/cmd",
]
```

### 3. Register the plugin in `homecore.toml`

```toml
[[plugins]]
id      = "plugin.thermostat"
binary  = "../plugins/hc-thermostat/target/debug/hc-thermostat"
config  = "../plugins/hc-thermostat/config/config.dev.toml"
enabled = true
```

### 4. Build and start

```bash
cd plugins/hc-thermostat
cargo build --release
```

## Configuration

```toml
[homecore]
plugin_id      = "plugin.thermostat"
broker_host    = "127.0.0.1"
broker_port    = 1883
password       = ""                 # empty for anonymous dev broker
heartbeat_secs = 60

[logging]
level              = "info"         # stderr + file filter; RUST_LOG overrides
rotation           = "daily"        # daily | hourly | weekly | never
max_size_mb        = 100            # 0 = time-only rotation
compress           = true           # gzip rotated files
prune_after_days   = 5              # 0 = never prune
log_forward_level  = "info"

# One [[thermostat]] block per virtual thermostat
[[thermostat]]
id                 = "living_room"
name               = "Living Room Thermostat"
sensor_device_ids  = ["yolink_lr_temp_a", "yolink_lr_temp_b"]
sensor_attribute   = "temperature"  # default
aggregation        = "average"      # "average" | "min" | "max"
setpoint           = 70.0
hysteresis         = 1.0            # ±0.5° deadband
mode               = "heat"         # "heat" | "cool" | "off"
actuator_device_id = "switch_furnace_relay"
min_on_secs        = 300            # short-cycle protection
min_off_secs       = 180
# actuator_on_cmd  = { command = "on" }    # optional override
# actuator_off_cmd = { command = "off" }
```

Each thermostat entry becomes a device at `thermostat_<id>` under `plugin.thermostat`
with `device_type = "thermostat"`.

## Published state

Each thermostat continuously publishes to `homecore/devices/thermostat_<id>/state`:

```json
{
  "current_temperature": 71.2,
  "call_for": "heat",
  "actuator_state": true,
  "actuator_last_change": "2026-04-19T12:34:56Z",
  "pending_call": null,
  "lockout_until": null,
  "actuator_last_error": null,
  "setpoint": 70.0,
  "hysteresis": 1.0,
  "mode": "heat",
  "aggregation": "average",
  "sensor_ids": ["yolink_lr_temp_a", "yolink_lr_temp_b"],
  "sensor_attribute": "temperature",
  "actuator_device_id": "switch_furnace_relay",
  "min_on_secs": 300,
  "min_off_secs": 180,
  "last_update": "2026-04-19T12:34:56Z"
}
```

`call_for` values: `"heat"`, `"cool"`, `"idle"`, `"stale"` (all sensors offline).

## Runtime commands

Publish to `homecore/devices/thermostat_<id>/cmd` (or use the device-command
REST endpoint):

```json
{ "command": "set_setpoint",    "value": 72.0 }
{ "command": "set_mode",        "value": "heat" }      // "heat" | "cool" | "off"
{ "command": "set_hysteresis",  "value": 1.0 }
{ "command": "set_sensors",     "sensor_ids": ["sensor_a", "sensor_b"],
                                 "attribute": "temperature" }
{ "command": "set_actuator",    "device_id": "switch_x" }
{ "command": "set_aggregation", "value": "min" }       // "average" | "min" | "max"
{ "command": "set_short_cycle", "min_on_secs": 300, "min_off_secs": 180 }
{ "command": "recalculate" }
```

Runtime changes are written back to `config.toml` atomically, so the next
restart picks them up.

## Management commands

Via `POST /api/v1/plugins/plugin.thermostat/command`:

| Action | Purpose |
|---|---|
| `recalculate_all` | Force every thermostat to re-evaluate immediately |
| `reload_config` | Re-read `config.toml`, applying changes + subscription diffs |
| `add_thermostat` | Create a new thermostat from a JSON config; persists to disk |
| `remove_thermostat` | Delete a thermostat; clears retained state + persists |
| `get_thermostats` | Return the current list of thermostat configs |

Example — add a thermostat from the command line:

```bash
curl -X POST http://localhost:8080/api/v1/plugins/plugin.thermostat/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add_thermostat",
    "config": {
      "id": "bedroom",
      "name": "Bedroom Thermostat",
      "sensor_device_ids": ["yolink_bed_temp"],
      "setpoint": 68.0,
      "hysteresis": 1.0,
      "mode": "heat",
      "actuator_device_id": "zwave_bedroom_heater"
    }
  }'
```

## Admin UI

Each thermostat gets a dedicated card on its device detail page (`/devices/thermostat_<id>`):

- Large current temperature readout with `heat`/`cool`/`idle`/`stale` pill
- Setpoint stepper (±0.5°), mode segmented control, hysteresis slider
- Lockout countdown when short-cycle protection defers a transition
- **Diagnostics banner** — surfaces missing sensors, unconfigured actuator,
  stale readings, last actuator publish error
- **Collapsible Configuration section** — sensor multi-select (filtered to
  devices exposing a numeric temperature attribute), actuator picker
  (filtered to on/off-capable devices), aggregation toggle, short-cycle inputs
- **History chart** — 1h / 6h / 24h / 7d selector, temperature line, setpoint
  overlay, shaded bands for actuator-on periods
- **Remove button** — drops the thermostat and clears its retained state

A compact thermostat card also appears on the devices grid showing current
temperature + setpoint + mode controls.

On the Plugins page, `plugin.thermostat` exposes three action buttons
(Recalculate all, Reload config) plus an inline "+ New thermostat" wizard for
creating thermostats without hand-editing `config.toml`.

## Logs

Log files rotate daily in `plugins/hc-thermostat/logs/hc-thermostat.log`.
Plugin logs at `log_forward_level` or above are also published to
`homecore/plugins/plugin.thermostat/logs` and appear in HomeCore's log stream.

## Integration patterns

### Multi-zone HVAC

One `[[thermostat]]` block per zone, each with its own sensor set and
actuator. All thermostats share the same `homecore/plugins/plugin.thermostat/`
management namespace, so commands like `recalculate_all` reach all of them.

### Outdoor reset

Use `aggregation = "max"` across indoor sensors and a negative-feedback rule
that lowers the setpoint when an outdoor sensor rises above a threshold.

### Fail-safe

If all configured sensors drop offline, `call_for` becomes `"stale"` and the
plugin holds the last actuator command (it neither turns on nor off
spontaneously). Pair with a rule that notifies when `call_for == "stale"`
for longer than 15 minutes — the create-thermostat wizard will soon offer
this as an opt-in template.
