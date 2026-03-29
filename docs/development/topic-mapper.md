---
id: topic-mapper
title: Topic Mapper & Ecosystem Profiles
sidebar_label: Topic Mapper
sidebar_position: 5
---

# Topic Mapper & Ecosystem Profiles

The topic mapper (`hc-topic-map`) lets non-standard MQTT devices — Tasmota, Shelly, Zigbee2MQTT, ESPHome, and any homebrew firmware — integrate with HomeCore without writing a dedicated plugin. It works by translating their native topic schema to the HomeCore canonical schema using a profile file.

---

## How it works

When the MQTT client receives a message on any topic, the `EcosystemRouter` checks whether any loaded profile matches:

1. **Match** — the topic matches a `state_topics`, `availability_topics`, or `cmd_topics` pattern in a profile.
2. **Extract** — the `{device}` wildcard in the pattern captures the device name.
3. **Field map** — JSON keys are renamed from the device's native names to HomeCore canonical attribute names.
4. **Coerce** — type conversions are applied (`"ON"` → `true`, `100` → percentage float, etc.).
5. **Publish** — the translated payload is forwarded to `homecore/devices/{prefix}{device}/state` as if a plugin had published it.

The device is registered automatically on first state message. No manual registration is needed.

---

## Activating a profile

Profiles live in `config/profiles/`. Only profiles in this directory are loaded — files in `config/profiles/examples/` are reference copies and are **not** auto-loaded.

To activate a profile, copy it from `examples/`:

```bash
cp config/profiles/examples/tasmota.toml config/profiles/tasmota.toml
cp config/profiles/examples/zigbee2mqtt.toml config/profiles/zigbee2mqtt.toml
```

HomeCore loads all `.toml` files in `config/profiles/` at startup. Multiple profiles can be active simultaneously.

---

## Profile structure

A profile is a TOML file with three sections: `[ecosystem]` metadata, `[[ecosystem.state_topics]]` (inbound state), `[[ecosystem.availability_topics]]` (inbound availability), and `[[ecosystem.cmd_topics]]` (outbound commands).

### Minimal example

```toml
[ecosystem]
name        = "my-firmware"
description = "Custom firmware devices"
prefix      = "myfirmware_"

[[ecosystem.state_topics]]
pattern = "myfirmware/{device}/status"

  [ecosystem.state_topics.field_map]
  relay = "on"
  temp  = "temperature"

  [ecosystem.state_topics.coerce]
  on = "onoff_to_bool"    # "ON"/"OFF" → true/false
```

This single stanza maps any `myfirmware/+/status` topic to `homecore/devices/myfirmware_{device}/state` with the attribute rename and type coercion applied.

---

## Pattern syntax

| Syntax | Meaning |
|---|---|
| `{device}` | Captures one or more path segments as the device name |
| `+` | MQTT single-level wildcard (not captured) |
| Literal text | Must match exactly |

The `{device}` capture becomes the second part of the HomeCore device ID: `{prefix}{device}`.

**Examples:**

| Pattern | Topic | Captured `{device}` | HomeCore device ID (prefix=`t_`) |
|---|---|---|---|
| `stat/{device}/POWER` | `stat/kitchen/POWER` | `kitchen` | `t_kitchen` |
| `zigbee2mqtt/{device}` | `zigbee2mqtt/living_room_light` | `living_room_light` | `t_living_room_light` |
| `devices/{device}/sensors/data` | `devices/esp32-01/sensors/data` | `esp32-01` | `t_esp32-01` |

---

## Field map

`field_map` renames JSON keys from the device's schema to HomeCore canonical attribute names.

```toml
[ecosystem.state_topics.field_map]
state        = "on"           # Z2M "state" → HomeCore "on"
brightness   = "brightness"   # same name — can omit, listed for clarity
temperature  = "temperature"  # pass-through
POWER        = "on"           # Tasmota "POWER" → HomeCore "on"
"ENERGY.Power" = "power_w"    # nested path using dot notation
```

Keys not listed in `field_map` pass through with their original names. Keys listed in `field_map` are renamed; their original names do not appear in the published state.

### Nested paths

Use dot notation to extract nested JSON values:

```toml
"ENERGY.Power"   = "power_w"    # { "ENERGY": { "Power": 45.2 } } → { "power_w": 45.2 }
"AM2301.Temperature" = "temperature"
```

---

## Coerce (type conversions)

`coerce` applies a named conversion function to an attribute **after** field renaming.

```toml
[ecosystem.state_topics.coerce]
on           = "onoff_to_bool"    # "ON"/"OFF" → true/false
brightness   = "pct255_to_100"    # 0–255 integer → 0–100 percentage
color_temp   = "mired_to_kelvin"  # mired → Kelvin
battery      = "scalar_int"       # ensure integer type
```

| Coerce name | Input | Output |
|---|---|---|
| `onoff_to_bool` | `"ON"` / `"OFF"` | `true` / `false` |
| `bool_to_onoff` | `true` / `false` | `"ON"` / `"OFF"` |
| `scalar_bool` | Any non-zero / non-null | `true` / `false` |
| `scalar_int` | Number | Integer |
| `scalar_float` | Number | Float |
| `pct255_to_100` | 0–255 | 0–100 percentage |
| `pct100_to_255` | 0–100 | 0–255 |
| `mired_to_kelvin` | Mired (integer) | Kelvin |

---

## Availability topics

```toml
[[ecosystem.availability_topics]]
pattern   = "tele/{device}/LWT"
payload   = "raw_string"          # treat payload as a plain string (not JSON)

  [ecosystem.availability_topics.value_map]
  Online  = true
  Offline = false
```

For JSON availability payloads:

```toml
[[ecosystem.availability_topics]]
pattern    = "zigbee2mqtt/{device}/availability"
json_field = "state"               # extract .state from JSON payload

  [ecosystem.availability_topics.value_map]
  online  = true
  offline = false
```

---

## Command topics (outbound)

`cmd_topics` define how HomeCore commands are translated back to the device's native topic/format.

```toml
[[ecosystem.cmd_topics]]
source    = "homecore/devices/tasmota_{device}/cmd"
target    = "cmnd/{device}/POWER"
attribute = "on"                   # extract only "on" from the cmd JSON

  [ecosystem.cmd_topics.coerce]
  on = "bool_to_onoff"             # true → "ON", false → "OFF"
```

The `source` pattern uses the same `{device}` wildcard as `state_topics`. When a `SetDeviceState` action publishes to `homecore/devices/tasmota_kitchen/cmd`, the mapper captures `device=kitchen`, extracts the `on` attribute, coerces it, and publishes `"ON"` to `cmnd/kitchen/POWER`.

---

## Rhai transforms

When `field_map` is not expressive enough, use a `transform` — a Rhai function that receives the raw payload and returns a Rhai map of attribute key-value pairs.

```toml
[[ecosystem.state_topics]]
pattern   = "tele/{device}/SENSOR"
transform = "parse_my_sensor"
```

The Rhai function is defined in a `.rhai` file in `config/profiles/`:

```javascript
// config/profiles/my-transforms.rhai

fn parse_my_sensor(payload) {
    let p = parse_json(payload);
    #{
        "temperature": p.SHT30.Temperature,
        "humidity":    p.SHT30.Humidity,
        "battery":     (p.battery / 255.0 * 100.0).to_int(),
    }
}
```

`.rhai` files in `config/profiles/` are loaded automatically alongside profile TOML files. Function names must be unique across all loaded transform files.

### Rhai functions available in transforms

| Function | Description |
|---|---|
| `parse_json(str)` | Parse a JSON string into a Rhai map |
| `to_json(val)` | Serialize a Rhai value to JSON string |
| All standard Rhai arithmetic and string operations | |

---

## Reference profiles

Four reference profiles ship in `config/profiles/examples/`:

### `tasmota.toml`

Covers single relay, dual relay, power monitoring (Sonoff Pow, Gosund SP111), temperature/humidity sensors (AM2301, DHT22, SHT3x, DS18B20), and dimmer control. Availability via LWT (`tele/{device}/LWT`).

Device IDs: `tasmota_{topic_name}` (topic name set via Tasmota console: `Topic mydevice`)

### `shelly-gen1.toml`

Gen1 Shelly devices (Shelly1, Shelly2.5, ShellyPlug-S). Relay state, power monitoring, availability.

Device IDs: `shelly_{device_id}` (device ID is the Shelly's mDNS name, e.g. `shelly1-AABBCC`)

### `shelly-gen2.toml`

Gen2+ Shelly devices (Plus, Pro, Mini series). Uses the Gen2 RPC-based MQTT topic schema which differs significantly from Gen1.

Device IDs: `shelly2_{device_id}`

### `zigbee2mqtt.toml`

Full attribute mapping for Zigbee2MQTT: lights (on/brightness/color_temp/color_xy), sensors (temperature/humidity/pressure/occupancy/contact/smoke/water_leak), power monitoring, covers, locks, thermostats, signal quality. Availability via `{device}/availability` JSON payload.

Device IDs: `zigbee_{z2m_friendly_name}` (use underscored names in Z2M for clean IDs)

---

## Writing a new profile

1. Create `config/profiles/examples/my-ecosystem.toml`.
2. Define the `[ecosystem]` block with `name`, `description`, and `prefix`.
3. Add one `[[ecosystem.state_topics]]` entry per distinct topic pattern the device publishes. Use `field_map` to rename keys to HomeCore canonical names. Use `coerce` for type conversions.
4. Add `[[ecosystem.availability_topics]]` if the device publishes an availability/LWT topic.
5. Add `[[ecosystem.cmd_topics]]` for each command the device accepts. Map from `homecore/devices/{prefix}{device}/cmd` to the device's command topic.
6. Test by copying to `config/profiles/` and watching the server logs:

   ```bash
   RUST_LOG=info,hc_topic_map=debug cargo run -p homecore
   ```

   Debug log shows every topic match attempt, the captured `{device}` value, the pre- and post-transform payload, and the resulting HomeCore device ID.

7. Commit the file to `config/profiles/examples/` for reference. Users copy it to `config/profiles/` to activate.

---

## Debugging topic mapper issues

```bash
# Show all profile match attempts and transforms
RUST_LOG=info,hc_topic_map=debug cargo run -p homecore

# Run topic mapper tests
cargo test -p hc-topic-map
cargo test -p hc-topic-map -- --nocapture
```

Common problems:

| Symptom | Cause | Fix |
|---|---|---|
| Device never appears | Profile pattern doesn't match the device's topic | Enable `hc_topic_map=debug` and look for "no match" lines |
| Attributes missing | Key not in `field_map` and auto-passthrough dropped it | Add the key to `field_map` (or remove `field_map` entirely for full passthrough) |
| `on` attribute is a string not bool | Missing `coerce` | Add `on = "onoff_to_bool"` to `[coerce]` |
| Commands not reaching device | `cmd_topics` pattern wrong or attribute name mismatch | Check `source` matches the HomeCore device ID exactly |
| Rhai transform error at startup | Syntax error in `.rhai` file | Check server startup log for script error with line number |
