---
id: lutron
title: Lutron RadioRA2
sidebar_label: Lutron
sidebar_position: 6
---

# Lutron RadioRA2 (`hc-lutron`)

The hc-lutron plugin bridges a Lutron RadioRA2 (or RadioRA2 Select / Caseta) main repeater to HomeCore via telnet. All dimmers, switches, and scenes are registered as devices.

## Prerequisites

- A Lutron RadioRA2 main repeater on your LAN
- Telnet enabled on the repeater (Integration → Enable Telnet in Lutron Software)
- The repeater's IP address
- Integration credentials (username/password — default: `lutron`/`integration`)

## Configuration

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.lutron"
password    = ""

[lutron]
host     = "192.168.1.50"
port     = 23          # standard telnet
username = "lutron"
password = "integration"
```

## Running

```bash
cd /path/to/hc-lutron
./hc-lutron config/config.toml
```

The plugin connects via telnet, queries the full device list, registers all devices, and subscribes to real-time state updates.

## Its screens

All of these come with the plugin itself — update the plugin, and they update.

- **Its page** (Settings › Plugins › Lutron): whether the main repeater is
  connected and at what address; keypad buttons nobody has named yet, with a
  way to name them; every scene, grouped by the room it is in (scenes in no
  room under *House*), lit when the repeater's light says it is on — tap one to
  run it; the keypads drawn with their lights and what was pressed last; the
  Picos and visor receivers; and a count of switches, dimmers, fans and
  occupancy groups with what is on now.
- **A keypad's panel**: the keypad as it is on the wall, its lights live.
  Pick a button to press it, or to set its light off, on, slow flash or fast
  flash — the repeater may change it back when its scene changes. Below, what
  was pressed lately ("OH1 Toggle, held, 2 min ago") and the automations that
  start on the picked button.
- **A Pico's panel**: drawn from the buttons it reports — the 2-button On/Off
  or the 5-button On/Raise/Favorite/Lower/Off — with the one pressed last lit,
  what each button starts, and its last press. A Pico takes no commands, so
  there is nothing to press here.
- **A visor receiver's panel** (VCRX): its buttons and their lights, to
  press; its contact inputs, Open or Closed and since when; its last press.
- **A keypad's card** on Home and the rooms: its named buttons with their
  lights, to tap (unnamed ones are left off); compact, how many are lit.
- **Lutron scenes**, a card you add yourself (Edit → Add a card): the scenes
  you choose, in the order you drag them into, in a grid or a single row.
- **In automations**, a step on a keypad is *Press a button* or *Set a light*,
  picked on the keypad drawn, and says so in words: "press Outside on Kitchen 6
  Button".

Buttons are named by their engravings. A keypad's raise/lower rocker is named
*Lower* and *Raise*, a Pico's buttons *On*, *Favorite*, *Off*, *Raise* and
*Lower*, where nothing was engraved; any other unengraved button reads
"Button 5" until it is named in the plugin's settings. A VCRX's contact inputs
are *Input 1* and *Input 2*.

## SDK adoption

hc-lutron is built on the official Rust plugin SDK (`plugin-sdk-rs`) and supports the full management protocol: heartbeat monitoring, remote configuration, and dynamic log level.

## Device IDs

| Device type | ID pattern | Example |
|---|---|---|
| Dimmer/switch | `lutron_{integration_id}` | `lutron_21` |
| Pico remote | `lutron_pico_{integration_id}` | `lutron_pico_5` |
| VCRX | `lutron_{integration_id}` | `lutron_36` |
| Scene (button) | `lutron_scene_{id}` | `lutron_scene_42` |
| Phantom button scene | `lutron_scene_{id}_phantom` | `lutron_scene_42_phantom` |

The integration ID matches the ID shown in Lutron Designer software.

## Device attributes

Names and units follow homeCore's shared device vocabulary, converted from
Lutron's own scales inside the plugin.

| Device | Reports | Takes |
|---|---|---|
| dimmer | `on`, `brightness_pct` (0–100, decimals) | `on`, `brightness_pct`, with optional `transition_ms` |
| switch | `on` | `on` |
| fan | `on`, `speed` (`off`/`low`/`medium`/`medium-high`/`high`), `speed_pct` | `on`, `speed`, `speed_pct`, optional `transition_ms` |
| shade | `position` (0–100, 100 = open) | `position`; actions `raise`, `lower`, `stop` |
| occupancy group | `occupied` | — |
| keypad / VCRX | `button_N`, `last_button`, `last_button_name`, `led_N` (0 off, 1 on, 2 slow flash, 3 rapid) | actions `press_button {button}`, `set_led {button, state}` |
| VCRX contact inputs | `cci_N_open` (`true` = contact open) | — |
| scene | `active` | action `activate` |
| timeclock event | `enabled` | `enabled`; action `execute` |

- **`{"on": true}` with no level** turns a dimmer or fan back on at the last
  level the repeater reported (full, if none has been seen since the plugin
  started). `brightness_pct: 0` is off, and a lit dimmer never reports 0 %.
- **Fades:** `transition_ms` beside a level, sent to the repeater to the
  hundredth of a second under a minute.
- **Actions** are sent as `{"action": "set_led", "button": 3, "state": 1}`,
  `{"action": "press_button", "button": 2}`, `{"action": "activate"}`.
- **No longer published:** `brightness` (a 0–255 copy of the level),
  `occupancy` (same as `occupied`), `cci_N` `"open"`/`"closed"` strings (now
  `cci_N_open`), and a scene's `on` (now `active`).

### VCRX

The VCRX (Visor Control Receiver) is registered with `DeviceKind::Vcrx`. It exposes buttons, LEDs, and CCI (Contact Closure Input) terminals.

**Configuration:**

```toml
[[devices]]
integration_id = 36
name           = "Garage VCRX"
kind           = "vcrx"
area           = "garage"
buttons        = [1, 2, 3, 4, 5, 6]
ccis           = [31, 32, 33, 34]
```

**Device ID:** `lutron_36`

It reports `button_N`, `last_button`, `led_N` and `cci_N_open` (`true` when
the contact is open), and takes the `press_button` and `set_led` actions, as a
keypad does.

**Typical use case:** HomeLink visor control for garage doors, with CCIs wired to contact closure sensors for door open/closed state.

### Phantom scene LED feedback

Phantom scene buttons now report on/off state via LED feedback. The plugin queries LED state at connect and handles LED change events in real time. When a phantom scene's LED turns on, the scene device's `active` attribute becomes `true`, allowing rules to react to scene activation from physical keypads.

Main repeater phantom buttons use LED component = button number + 100 (not +80 like physical keypads). The plugin handles this offset automatically. Scene state is published whenever an LED event arrives from the repeater. Activating a scene also performs an optimistic state update, immediately publishing `active: true` so downstream rules can react without waiting for the LED round-trip. For paired on/off scenes, the state tracks the actual Lutron LED state so both the "on" and "off" scene devices stay in sync.


### What the screens send

| Device | Command | Does |
|---|---|---|
| keypad, VCRX | `{"action": "press_button", "button": 3}` | presses and releases button 3, as a person would |
| keypad, VCRX | `{"action": "set_led", "button": 3, "state": 2}` | sets button 3's light: 0 off, 1 on, 2 slow flash, 3 fast flash |
| scene | `{"action": "activate"}` | presses its phantom button |

The plugin's page also asks the plugin's read-only `status` action whether the
repeater is connected (`connected`, `since`, `error`, `host`, `port`).

## Commanding devices

```bash
# Turn on at 75%
curl -s -X PATCH http://localhost:8080/api/v1/devices/lutron_21/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true, "brightness_pct": 75}'

# Turn off
curl -s -X PATCH http://localhost:8080/api/v1/devices/lutron_21/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": false}'

# Activate a scene
curl -s -X PATCH http://localhost:8080/api/v1/devices/lutron_scene_42/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "activate"}'
```

## Rule example — Lutron scene at sunset

```toml
name = "Living room — Lutron evening scene"
enabled = true

[trigger]
type           = "sun_event"
event          = "sunset"
offset_minutes = -15

[[actions]]
type      = "set_device_state"
device_id = "lutron_scene_42"
state     = { action = "activate" }
```

## Rule example — dimmer at different levels by mode

```toml
name = "Office — mode-based lighting"
enabled = true

[trigger]
type      = "device_state_changed"
device_id = "mode_night"
attribute = "on"
to        = true

[[actions]]
type      = "set_device_state_per_mode"
device_id = "lutron_21"

[[actions.modes]]
mode_name = "mode_night"
state     = { on = true, brightness_pct = 20 }

[[actions.modes]]
mode_name = "mode_away"
state     = { on = false }

[actions.default_state]
on             = true
brightness_pct = 80
```

## Troubleshooting

| Problem | Solution |
|---|---|
| `Connection refused` | Verify telnet is enabled in Lutron Designer and the IP/port is correct |
| `Authentication failed` | Default credentials: username `lutron`, password `integration` |
| Devices not appearing | Ensure all devices are programmed in Lutron Designer and the repeater is online |
| Dim level off by 1% | Lutron levels are 0–100 with two decimals; minor rounding is expected |

## Log rotation

hc-lutron writes logs to `logs/hc-lutron.log`. Rotation and compression are configured in `config/config.toml`:

```toml
[logging]
level       = "info"   # stderr log level; RUST_LOG overrides this
rotation    = "daily"  # daily | hourly | weekly | never
max_size_mb = 100      # rotate when file exceeds this MB (0 = time-only)
compress    = true     # gzip rotated files in a background thread
```

| File | Description |
|---|---|
| `logs/hc-lutron.log` | Active log (always uncompressed) |
| `logs/hc-lutron.2026-03-27.log.gz` | Rotated daily file (compressed) |
| `logs/hc-lutron.2026-03-27.1.log.gz` | Second rotation in same period (size limit hit) |
