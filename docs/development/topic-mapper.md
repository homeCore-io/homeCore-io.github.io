---
id: topic-mapper
title: Topic Mapper & Ecosystem Profiles
sidebar_label: Topic Mapper
sidebar_position: 5
---

# Topic Mapper & Ecosystem Profiles

The topic mapper (`hc-topic-map`) lets MQTT devices that don't speak
homeCore's topic schema (Tasmota, Shelly, Zigbee2MQTT, ESPHome, homebrew
firmware) work with homeCore without a dedicated plugin. A profile file
describes how to translate the device's native topics and payloads into
homeCore's canonical ones, and back again for commands.

---

## How it works

When at least one profile is loaded, core subscribes to every topic
(`#`). The state bridge offers each incoming message to the
`EcosystemRouter` before its own handling:

1. **Match.** The topic is compared against the `state_topics` patterns
   of every loaded profile, then the `availability_topics` patterns. The
   first match wins, so of two entries with the same pattern only the
   first is ever used.
2. **Capture.** `{name}` placeholders in the pattern capture parts of the
   topic, such as `{device}`.
3. **Transform.** The payload is parsed as JSON (or kept as a scalar), its
   keys are renamed by `field_map`, and `coerce` converts values to
   homeCore's units.
4. **Hand over.** The result is applied as the state (or availability) of
   the device ID `{prefix}{device}`, exactly as if a plugin had published
   it to `homecore/devices/{id}/state`.

A device the registry has not seen is created on its first state message,
so no registration step is needed. Its plugin ID is the part of the
device ID before the first `_` (`shelly_abc` belongs to `shelly`).

Commands go the other way. A message on `homecore/devices/{id}/cmd` that
matches a `cmd_topics` source is translated and published to the
device's native topic instead of being handled as a plugin command.

---

## Activating a profile

Profiles are loaded from the profiles directory, `config/profiles/` by
default (`[profiles] dir` in `homecore.toml`). Files in
`config/profiles/examples/` are reference copies and are **not** loaded.

To activate a profile, copy it out of `examples/`:

```bash
cp config/profiles/examples/tasmota.toml config/profiles/tasmota.toml
cp config/profiles/examples/zigbee2mqtt.toml config/profiles/zigbee2mqtt.toml
```

At startup homeCore loads every `.toml` file in the directory except
`device-types.toml`, which is the device type catalog and is loaded
separately. Several profiles can be active at once. A file that fails to
parse is logged and skipped. Profiles are read once, so restart homeCore
after changing one.

---

## Profile structure

A profile is a TOML file with an `[ecosystem]` block (`name`, an optional
`description`, and `prefix`) and three optional arrays:
`[[ecosystem.state_topics]]` (inbound state),
`[[ecosystem.availability_topics]]` (inbound availability) and
`[[ecosystem.cmd_topics]]` (outbound commands).

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

This maps every `myfirmware/<name>/status` topic to the device
`myfirmware_<name>`, renaming `relay` to `on` and `temp` to `temperature`
and converting `on` to a boolean.

---

## Pattern syntax

Patterns are matched segment by segment, and a topic must have exactly as
many segments as the pattern.

| Syntax | Meaning |
|---|---|
| `{device}` | Captures one whole segment under the name `device` |
| `shelly_{device}`, `{id}_x`, `switch:{switch_id}` | Captures the part of one segment between a literal prefix and/or suffix |
| Literal text | Must match exactly |

Any name works in braces, and a pattern can capture several. MQTT
wildcards (`+`, `#`) are not supported in patterns; a `+` is matched as
literal text.

The device ID defaults to `prefix` followed by the `device` capture (or
`nodeId`, or else the first capture). Characters awkward in topics and
URLs (`:`, space and `/`) become `_`.

| Pattern | Topic | Captured `{device}` | HomeCore device ID (prefix=`t_`) |
|---|---|---|---|
| `stat/{device}/POWER` | `stat/kitchen/POWER` | `kitchen` | `t_kitchen` |
| `zigbee2mqtt/{device}` | `zigbee2mqtt/living_room_light` | `living_room_light` | `t_living_room_light` |
| `devices/{device}/sensors/data` | `devices/esp32-01/sensors/data` | `esp32-01` | `t_esp32-01` |

### Choosing the device ID

Set `device_id` on a state topic to build the ID from a template instead.
It may use any capture, and the prefix is **not** added for you:

```toml
[[ecosystem.state_topics]]
pattern   = "{device}/status/switch:{switch_id}"
device_id = "shelly_{device}_switch_{switch_id}"
```

Several topics can feed one device by giving them the same `device_id`;
partial updates merge (see below).

---

## State topics

### Field map

`field_map` renames JSON keys from the device's names to homeCore's
shared vocabulary (`on`, `brightness_pct` 0 to 100, `color_temp` in
kelvin, `open`, `occupied`, `battery_pct`, temperatures in °C, and so
on). Convert the device's scale with `coerce` (below) so the published
value is in the shared unit.

```toml
[ecosystem.state_topics.field_map]
state        = "on"           # Z2M "state" → HomeCore "on"
brightness   = "brightness_pct"  # renamed; scale converted by coerce below
temperature  = "temperature"  # pass-through
POWER        = "on"           # Tasmota "POWER" → HomeCore "on"
"ENERGY.Power" = "power_w"    # nested path using dot notation
```

**When a `field_map` is present, only the keys it lists are kept.**
Everything else in the payload is dropped. With no `field_map` at all,
every key passes through under its original name, and no coercions are
applied.

### Nested paths

Use dot notation to pull values out of nested JSON:

```toml
"ENERGY.Power"   = "power_w"    # { "ENERGY": { "Power": 45.2 } } → { "power_w": 45.2 }
"AM2301.Temperature" = "temperature"
```

### Scalar payloads

Many devices publish one bare value per topic (`on`, `57.3`). Set
`attribute` to wrap the value under that name. The other scalar options
then apply in this order:

| Field | Effect |
|---|---|
| `attribute` | Wrap the payload as `{ "<attribute>": value }`. It may use captures. |
| `coerce_scalar = true` | Turn a string into a bool, integer or float where it looks like one |
| `coerce` | Applied to the wrapped attribute by name |
| `value_map` | Replace specific values, looked up by their string form (`"1" = true`) |

```toml
[[ecosystem.state_topics]]
pattern   = "shellies/{device}/relay/0"
attribute = "on"
  [ecosystem.state_topics.coerce]
  on = "01_to_bool"
```

### Full or partial updates

A scalar (`attribute`) topic always merges into the device's existing
state. A JSON topic replaces the whole state by default. Set
`partial = true` on a JSON topic that carries only some of a device's
attributes, so it does not wipe the rest.

---

## Coerce (type conversions)

`coerce` applies a named conversion to a value. On state topics it is
keyed by the homeCore attribute name, after renaming. A conversion that
fails on a mapped key is logged and the raw value is kept.

```toml
[ecosystem.state_topics.coerce]
on           = "onoff_to_bool"    # "ON"/"OFF" → true/false
brightness_pct = "pct255_to_100"  # 0–255 integer → 0–100 percentage
color_temp   = "mired_to_kelvin"  # mired → Kelvin
battery_pct  = "scalar_int"       # ensure integer type
```

| Coerce name | Input | Output |
|---|---|---|
| `onoff_to_bool` | `"ON"` / `"OFF"` (any case) | `true` / `false` |
| `bool_to_onoff` | `true` / `false` | `"ON"` / `"OFF"` |
| `01_to_bool` | `"1"` / `1` | `true`, anything else `false` |
| `bool_to_01` | `true` / `false` | `"1"` / `"0"` |
| `scalar_bool` | `"true"` / `"false"` string (any case) | `true` / `false` |
| `open_close_to_bool` | `"open"` / `"close"` or `"closed"` | `false` / `true` (contact convention: closed is `true`) |
| `scalar_int` | Number or numeric string | Integer (floats truncated) |
| `scalar_float` | Number or numeric string | Float |
| `scalar_auto` | String | Bool, integer or float where it parses as one, otherwise unchanged |
| `pct255_to_100` | 0 to 255 | 0 to 100, rounded |
| `pct100_to_255` | 0 to 100 | 0 to 255, rounded |
| `pct254_to_100` | Zigbee's 0 to 254 level | 0 to 100 to one decimal (on at the lowest level never reads 0) |
| `pct100_to_254` | 0 to 100 | 0 to 254 (above 0 never sends 0) |
| `mired_to_kelvin` | Mired | Kelvin |
| `kelvin_to_mired` | Kelvin | Mired |
| `invert_bool` | `true` / `false` | `false` / `true` (a contact that reports `true` when closed → `open`) |
| `lock_to_bool` | `"LOCK"` / `"locked"` | `true`, anything else `false` |
| `bool_to_lock` | `true` / `false` | `"LOCK"` / `"UNLOCK"` |
| `hvac_action_words` | `"heat"` / `"cool"` / `"fan_only"` / `"dry"` | `"heating"` / `"cooling"` / `"fan"` / `"drying"` (other words pass through) |
| `uppercase` | `"toggle"` | `"TOGGLE"` |
| `ms_to_secs` / `secs_to_ms` | Milliseconds / seconds | Seconds / milliseconds |

Map to homeCore's shared names and units (`brightness_pct` 0 to 100,
`color_temp` in kelvin, `open`, `occupied`, `battery_pct`, temperatures
in °C) and convert the device's own scale here. Automations and the app
then treat a mapped device like any plugin's.

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

`payload` can also be `"raw_bool"`, for payloads that are literally
`true` or `false`. For JSON availability payloads, name the field to read:

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

`cmd_topics` translate homeCore commands back into the device's native
topic and format.

```toml
[[ecosystem.cmd_topics]]
source    = "homecore/devices/tasmota_{device}/cmd"
target    = "cmnd/{device}/POWER"
attribute = "on"                   # extract only "on" from the cmd JSON

  [ecosystem.cmd_topics.coerce]
  on = "bool_to_onoff"             # true → "ON", false → "OFF"
```

`source` uses the same pattern syntax as `state_topics`, and `target` can
use its captures. When a `SetDeviceState` action publishes to
`homecore/devices/tasmota_kitchen/cmd`, the mapper captures
`device=kitchen`, takes the `on` attribute, coerces it and publishes
`"ON"` to `cmnd/kitchen/POWER`.

Without `attribute`, the whole command object is sent as JSON, with keys
renamed by the command's own `field_map` (homeCore name → device key).
In `cmd_topics`, a coercion is looked up by homeCore's attribute name
first, then by the device's key. That lets two attributes that go to the
same key convert differently: Zigbee2MQTT's `state` takes both `on`
(`bool_to_onoff`) and `locked` (`bool_to_lock`).

For Shelly Gen2 devices, `rpc_method` (and `rpc_id`) wrap the command as
a JSON-RPC call; see `shelly-gen2.toml`.

---

## Rhai transforms

`state_topics` and `cmd_topics` both accept a `transform` naming a Rhai
function, and `EcosystemRouter` can run one: it calls the function with
the raw payload as a string and uses the returned value's string form as
the new payload. On a state topic, that output then goes through the
normal JSON parsing, `field_map` and `coerce`. On a command topic it is
published as-is.

:::warning Not wired up in the server
homeCore does not currently load any Rhai source into the router
(`homecore/src/main.rs` builds it with
`EcosystemRouter::new(profiles, None)`), and nothing reads `.rhai` files from `config/profiles/`. A topic
with a `transform` therefore fails with "Rhai transform … called but no
script loaded", logged as an inbound or outbound router error, and the
message is not translated. Until that changes, express mappings with
`field_map`, `attribute`, `value_map` and `coerce`. The comment in
`tasmota.toml` that suggests a `custom-transforms.rhai` file describes
the same unwired hook.
:::

---

## Reference profiles

Four reference profiles ship in `config/profiles/examples/`, along with
the example `device-types.toml` catalog.

### `tasmota.toml`

Single relay, dual relay, power monitoring (Sonoff Pow, Sonoff S31,
Gosund SP111 and similar), temperature and humidity sensors (AM2301,
DHT22, SHT3x, DS18B20), and dimmer control. Availability via LWT
(`tele/{device}/LWT`).

Device IDs: `tasmota_{topic_name}`, where the topic name is set in the
Tasmota console with `Topic mydevice`. The dual-relay entries use
`{device}_relay1` and `{device}_relay2`, without the prefix.

`tele/{device}/SENSOR` is one entry that maps both the power monitoring
and the temperature and humidity fields, and `stat/{device}/RESULT` is
one entry that maps `POWER` and the dimmer fields (`Dimmer`, `CT`,
`Color`). Before v0.1.97 the example profile had two entries for each of
those topics, and because only the first match is used, temperature,
humidity and the dimmer fields were never published. If you copied the
profile from an older release, replace your copy with the current
example, or merge each pair of entries into one.

### `shelly-gen1.toml`

Every original-firmware (Gen1) Shelly on the `shellies/` topic prefix:
relays, rollers, dimmers and bulbs, metering, inputs, and more.

Device IDs: `shelly_{device}_relay{n}`, `shelly_{device}_roller{n}`,
`shelly_{device}_light{n}` and so on, where `{device}` is the Shelly's
MQTT ID (for example `shelly1-AABBCC`).

### `shelly-gen2.toml`

Shelly Plus, Pro and Mini devices (Gen2 and Gen3), which use an RPC-based
topic schema quite unlike Gen1's.

Device IDs: `shelly_{device}_switch_{n}`, `shelly_{device}_light_{n}`,
`shelly_{device}_cover_{n}`, `shelly_{device}_sensor` and similar.

### `zigbee2mqtt.toml`

Full attribute mapping for Zigbee2MQTT in homeCore's shared names:
lights (`on`, `brightness_pct` from Zigbee's 0 to 254, `color_temp` in
kelvin, `color_xy`; commands also take `color_rgb`, `transition_ms` and
`{"action": "toggle"}`), sensors (`temperature`, `humidity`, `pressure`,
`illuminance`, `occupied`, `open`, `water_detected`, `battery_pct`,
`tampered`, `co2`), power monitoring, covers (`position`, `tilt_pct`),
locks (`locked`), thermostats (`temperature`, `heat_setpoint`,
`cool_setpoint`, `hvac_mode`, `hvac_action`, `fan_mode`) and signal
quality. Availability via the `{device}/availability` JSON payload.

Device IDs: `zigbee_{z2m_friendly_name}`. Use underscored names in Z2M
for clean IDs.

---

## Writing a new profile

1. Create `config/profiles/examples/my-ecosystem.toml`.
2. Define the `[ecosystem]` block with `name`, `description` and
   `prefix`.
3. Add one `[[ecosystem.state_topics]]` entry per distinct topic the
   device publishes. Rename keys with `field_map` (remembering that
   unlisted keys are dropped) or wrap scalars with `attribute`, and
   convert values with `coerce`.
4. Add `[[ecosystem.availability_topics]]` if the device publishes an
   availability or LWT topic.
5. Add `[[ecosystem.cmd_topics]]` for each command the device accepts,
   mapping `homecore/devices/{prefix}{device}/cmd` to the device's
   command topic.
6. Test it on a sandbox homeCore, not the house: copy it into that
   sandbox's `config/profiles/`, restart, and watch the log.

   ```bash
   RUST_LOG=info,hc_topic_map=debug,hc_core::state_bridge=debug cargo run -p homecore -- --home /tmp/hc-dev
   ```

   `hc_topic_map` logs each matched state, availability or command topic
   with the resulting device ID. `hc_core::state_bridge` logs topics that
   matched no profile and any router errors.

7. Add a test beside the existing ones in `crates/hc-topic-map/` (the
   router's unit tests load every example profile, and
   `tests/shelly_profiles.rs` checks real topics end to end), then commit
   the file to `config/profiles/examples/`. Operators copy it into
   `config/profiles/` to activate it.

---

## Debugging topic mapper issues

```bash
# Matches, unmatched topics and router errors
RUST_LOG=info,hc_topic_map=debug,hc_core::state_bridge=debug cargo run -p homecore

# Run topic mapper tests
cargo test -p hc-topic-map
cargo test -p hc-topic-map -- --nocapture
```

Common problems:

| Symptom | Cause | Fix |
|---|---|---|
| Device never appears | The pattern doesn't match the topic (often a different number of segments) | Turn on `hc_core::state_bridge=debug` and look for "No ecosystem profile match" lines |
| Profile not loaded | File is in `examples/`, or failed to parse | Check the startup log for "Loaded ecosystem profile" or "Failed to parse profile" |
| Attributes missing | `field_map` is present and the key isn't in it | Add the key to `field_map`, or remove `field_map` entirely for full passthrough |
| `on` attribute is a string, not a bool | Missing `coerce` | Add `on = "onoff_to_bool"` to `[coerce]` |
| Commands not reaching device | `source` pattern wrong or attribute name mismatch | Check that `source` matches the homeCore device ID exactly |
| "Rhai transform … called but no script loaded" | The topic uses `transform` | See [Rhai transforms](#rhai-transforms) |
