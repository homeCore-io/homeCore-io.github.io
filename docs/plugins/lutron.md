---
id: lutron
title: Lutron RadioRA2
sidebar_label: Lutron
sidebar_position: 6
---

# Lutron RadioRA2 (`hc-lutron`)

hc-lutron connects a Lutron RadioRA 2 main repeater to HomeCore over telnet, using the Lutron Integration Protocol (LIP). Each dimmer, switch, shade, fan, keypad, Pico, occupancy group and visor receiver you list in its config becomes a HomeCore device, and so does each phantom-button scene and timeclock event. A Caseta Smart Bridge Pro has its own plugin; see [Caseta](./caseta).

## Prerequisites

- A RadioRA 2 main repeater on your LAN, and its IP address
- Telnet support enabled for the repeater, under its integration settings in RadioRA 2 Essentials or Inclusive
- The integration (telnet) account's username and password

The factory integration logins (`lutron`/`integration` and `rti`/`integration`) are widely known. Change that password in RadioRA 2 setup before you rely on the connection.

## Configuration

Install the plugin from the web UI (**Plugins → Add**), then open its **Configuration** tab and set the repeater's address and the integration login. homeCore keeps the config file at `config/plugins/plugin.lutron.toml` and watches it. Saving restarts only this plugin, so it logs in with the new values. Core and the other plugins keep running.

The connection settings look like this in the file:

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
password = ""          # the integration account's password

default_fade_secs    = 1.0   # dimmers and fans; 0.0 is instant
hold_threshold_ms    = 500   # how long a button is down before it counts as a hold
reconnect_delay_secs = 5     # first retry delay; doubles up to 60 s
```

`port` defaults to 23 and `username` to `lutron`. The password has no default.

RadioRA 2 has no device list you can query over LIP, so devices, scenes and timeclock events are entries in the config. You don't have to type them. Under **Configuration → Devices**, **Import** reads the design straight from the repeater (`http://{repeater_ip}/DbXmlInfo.xml`), or takes a pasted copy of that file if this machine can't reach the repeater. Imported rows arrive already classified, and nothing is applied until you save.

| Section | What it holds |
|---|---|
| `[[devices]]` | `integration_id`, `name`, `kind`, `area`, and optionally `fade_secs`, `invert_position` (shades), `buttons`, `all_buttons`, `button_names` (keypads, Picos, VCRX) and `ccis` (VCRX) |
| `[[scenes]]` | `name`, `main_repeater_id` (almost always 1) and `button_component`, the phantom button's number |
| `[[time_clocks]]` | `timeclock_id` (almost always 1), `event_index`, `name`, `area` |

A device's `kind` is one of `dimmer`, `switch`, `shade`, `fan_control`, `cco_pulsed`, `keypad`, `pico`, `occupancy_group` or `vcrx`. A pulsed contact-closure output (a garage door or gate relay) is published as a scene, since it takes `activate` and doesn't latch. A maintained one latches, so give it the `switch` kind.

Fade time can be set in three places. `default_fade_secs` applies to every dimmer and fan, `fade_secs` on a device overrides it, and `transition_ms` sent with a level overrides both for that one command.

## Running

The plugin starts with homeCore once it is installed. Run by hand, it takes the config path as its only argument and falls back to `config/config.toml`:

```bash
cd /path/to/hc-lutron
./hc-lutron config/config.toml
```

It connects over telnet, registers the configured devices, reads the keypad and scene LEDs, and then follows the repeater's live updates. If the connection drops it reconnects on its own.

## Its screens

All of these ship with the plugin, so updating the plugin updates them.

- **Its page** (Settings › Plugins › Lutron) shows whether the main repeater is connected and at what address, and lists keypad buttons nobody has named yet, with a way to name them. Every scene appears, grouped by its room (scenes with no room go under *House*) and lit when the repeater's LED says it is on. Tap one to run it. The keypads are drawn with their lights and the last button pressed, followed by the Picos and visor receivers, and a count of switches, dimmers, fans and occupancy groups with what is on now.
- **A keypad's panel** draws the keypad as it looks on the wall, with live lights. Pick a button to press it, or to set its light off, on, slow flash or fast flash. The repeater may change the light back when its scene changes. Below are the recent presses ("OH1 Toggle, held, 2 min ago") and the automations that start on the picked button.
- **A Pico's panel** is drawn from the buttons the Pico reports: the 2-button On/Off or the 5-button On/Raise/Favorite/Lower/Off. The last button pressed is lit, and the panel shows what each button starts and the last press. A Pico takes no commands, so there is nothing to press here.
- **A visor receiver's panel** (VCRX) shows its buttons and their lights, which you can press, its contact inputs (Open or Closed, and since when), and its last press.
- **A keypad's card** on Home and in rooms shows its named buttons with their lights, to tap. Unnamed buttons are left off. The compact card shows how many lights are lit.
- **Lutron scenes** is a card you add yourself (Edit → Add a card). It holds the scenes you pick, in the order you drag them into, as a grid or a single row.
- **In automations**, a keypad step is *Press a button* or *Set a light*. You pick the button on a drawing of the keypad, and the step reads back in words, for example "press Outside on Kitchen 6 Button".

Buttons take their names from their engravings. Where nothing is engraved, a keypad's raise/lower rocker is named *Lower* and *Raise*, and a Pico's buttons *On*, *Favorite*, *Off*, *Raise* and *Lower*. Any other unengraved button reads "Button 5" (or whatever its number is) until it is named, either as its engraving in the plugin's settings or with `set_button_name` (see [Button names](#button-names)). A VCRX's contact inputs are *Input 1* and *Input 2*.

## SDK adoption

hc-lutron is built on the official Rust plugin SDK (`plugin-sdk-rs`) and supports the full management protocol: heartbeat monitoring, remote configuration and dynamic log level.

## Device IDs

| Device type | ID pattern | Example |
|---|---|---|
| Dimmer, switch, shade, fan, keypad, occupancy group, pulsed CCO | `lutron_{integration_id}` | `lutron_21` |
| Pico remote | `lutron_{integration_id}` | `lutron_5` |
| VCRX | `lutron_{integration_id}` | `lutron_36` |
| Scene (phantom button) | `lutron_scene_{name}`, the scene's name lowercased with anything other than letters and digits turned into `_` | `lutron_scene_movie_mode` |
| Timeclock event | `lutron_tc_{timeclock_id}_{event_index}` | `lutron_tc_1_3` |

The integration ID is the one shown in Lutron's programming software and in `DbXmlInfo.xml`.

## Device attributes

Names and units follow homeCore's shared device vocabulary. The plugin converts from Lutron's own scales.

| Device | Reports | Takes |
|---|---|---|
| dimmer | `on`, `brightness_pct` (0 to 100, decimals) | `on`, `brightness_pct`, with optional `transition_ms` |
| switch | `on` | `on` |
| fan | `on`, `speed` (`off`/`low`/`medium`/`medium-high`/`high`), `speed_pct` | `on`, `speed`, `speed_pct`, optional `transition_ms` |
| shade | `position` (0 to 100, 100 = open) | `position`; actions `raise`, `lower`, `stop` |
| occupancy group | `occupied` | nothing |
| keypad / VCRX | `button_N`, `button_names`, `last_button`, `last_button_name`, `led_N` (0 off, 1 on, 2 slow flash, 3 rapid) | actions `press_button {button}`, `set_led {button, state}`, `set_button_name {button, name}` |
| Pico | `button_N`, `button_names`, `last_button`, `last_button_name` | action `set_button_name {button, name}` |
| VCRX contact inputs | `cci_N_open` (`true` = contact open) | nothing |
| scene | `active` | action `activate` |
| timeclock event | `enabled` | `enabled`; action `execute` |

A keypad's `button_N` is the latest event on that button: `press`, `release`, `hold` or `double_click`. A hold fires once the button has been down for `hold_threshold_ms`, and a release still follows it. Keypads, Picos and VCRXs also publish `available_buttons` (`[{"number": 3, "name": "Outside"}]`), which is where the screens get button names.

### Button names

Each keypad, Pico and VCRX publishes `button_names`, every button's name keyed by its number:

```json
"button_names": { "1": "Movie", "2": "Dinner", "3": "Outside", "16": "Lower", "17": "Raise" }
```

A button's name is the one the household gave it, or else its engraving, or else the name for what it does described under [Its screens](#its-screens). Engravings come from the `button_names` list on the device's row in the plugin's settings, which **Import** fills from the repeater's design. `available_buttons`, `button_N`'s label and `last_button_name` use the same names, so pickers and automations read them too.

Anyone who can control the keypad can name a button:

```json
{ "action": "set_button_name", "button": 1, "name": "Movie" }
```

An empty or missing `name` goes back to the engraving. A name is trimmed and kept to 64 characters, and a button the keypad does not have is refused. Names are kept in homeCore's stored state for the plugin, one entry per button, so they survive a restart and an update. Changing the engraving in the settings does not clear a name the household gave. Nothing is sent to the repeater, and the engraving on the wall stays as it is.

- `{"on": true}` with no level turns a dimmer or fan back on at the last level the repeater reported, or full if none has been seen since the plugin started. `brightness_pct: 0` is off, and a lit dimmer never reports 0 %.
- `transition_ms` sent beside a level sets the fade. It goes to the repeater to the hundredth of a second, for fades under a minute.
- Actions are sent as `{"action": "set_led", "button": 3, "state": 1}`, `{"action": "press_button", "button": 2}` and `{"action": "activate"}`. The older key forms (`{"set_led": {…}}`, `{"press_button": 2}`, `{"activate": true}`) and a `fade_secs` beside a level are still accepted.
- No longer published: `brightness` (a 0 to 255 copy of the level), `occupancy` (the same as `occupied`), the `cci_N` `"open"`/`"closed"` strings (now `cci_N_open`) and a scene's `on` (now `active`). The plugin removes them from retained state at startup.

### VCRX

The VCRX (Visor Control Receiver) uses the `vcrx` kind. It has buttons with LEDs, like a keypad, plus contact closure inputs (CCIs) that report open or closed.

```toml
[[devices]]
integration_id = 36
name           = "Garage VCRX"
kind           = "vcrx"
area           = "garage"
buttons        = [1, 2, 3, 4, 5, 6]
ccis           = [30, 31, 32, 33]
```

Its device ID is `lutron_36`. Per Lutron's Integration Guide, the CCI components are 30 (Full/Security), 31 (Flash), 32 (Input 1) and 33 (Input 2). It reports `button_N`, `last_button`, `led_N` and `cci_N_open` (`true` when the contact is open), and takes the `press_button` and `set_led` actions, as a keypad does.

A typical use is HomeLink visor control for garage doors, with the CCIs wired to contact sensors that report whether each door is open.

### Phantom scene LED feedback

Each scene is a phantom button on the main repeater, and its state comes from that button's LED. The plugin reads the LEDs when it connects and then follows LED changes as they happen. When a phantom button's LED turns on, the scene's `active` attribute becomes `true`, so rules can react to a scene started from a wall keypad.

On the main repeater a phantom button's LED is component number = button + 100, where a physical keypad uses button + 80. The plugin applies the right offset for you. Activating a scene also publishes `active: true` straight away, so rules don't have to wait for the LED to report back. For paired on and off scenes, state follows the real LED, which keeps both scene devices in step.

### What the screens send

| Device | Command | Does |
|---|---|---|
| keypad, VCRX | `{"action": "press_button", "button": 3}` | presses and releases button 3, as a person would |
| keypad, VCRX | `{"action": "set_led", "button": 3, "state": 2}` | sets button 3's light: 0 off, 1 on, 2 slow flash, 3 fast flash |
| scene | `{"action": "activate"}` | presses its phantom button |

To show whether the repeater is connected, the plugin's page calls the plugin's read-only `status` action. It answers with `connected`, `since`, `error`, `host` and `port`, as the connection loop last saw them. Button presses shown on the screens come from homeCore's history of each `button_N`.

## Notices

The plugin reports problems as notices on its card in the web UI.

| Code | Means |
|---|---|
| `not_configured` | No repeater address is set, so there is nothing to connect to. |
| `repeater_unreachable` | The repeater isn't answering on the telnet port. Lights, scenes and keypads served by this plugin won't respond. Clears on reconnect. |
| `no_devices_configured` | No devices, scenes or timeclock events are configured, so nothing is published. Use **Import** under Configuration → Devices. |

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
curl -s -X PATCH http://localhost:8080/api/v1/devices/lutron_scene_movie_mode/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "activate"}'
```

## Rule example: Lutron scene at sunset

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Living room, Lutron evening scene",
    enabled: true,
    priority: 0,
    trigger: SunEvent(event: Sunset, offset_minutes: -15),
    actions: [
        RuleAction(action: SetDeviceState(
            device_id: "lutron_scene_movie_mode",
            state: { "action": "activate" },
        )),
    ],
)
```


## Rule example: dimmer level by mode

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Office, mode-based lighting",
    enabled: true,
    priority: 0,
    trigger: DeviceStateChanged(
        device_id: "mode_night",
        attribute: Some("on"),
        to: Some(true),
    ),
    actions: [
        RuleAction(action: SetDeviceStatePerMode(
            device_id: "lutron_21",
            modes: [
                (mode: "mode_night", state: { "on": true, "brightness_pct": 20 }),
                (mode: "mode_away", state: { "on": false }),
            ],
            default_state: Some({ "on": true, "brightness_pct": 80 }),
        )),
    ],
)
```


## Troubleshooting

| Problem | Solution |
|---|---|
| `Connection refused` | Check that telnet support is enabled for the repeater and that the IP and port are right. |
| `Authentication failed` | Check the integration account's username and password in RadioRA 2 programming. |
| Devices not appearing | Check that they are listed in the plugin's config (run **Import** again if needed), are programmed in the RadioRA 2 design, and that the repeater is online. |
| Dim level off by 1% | Lutron levels run 0 to 100 with two decimals, so small rounding differences are expected. |

## Log rotation

hc-lutron writes its log to `logs/hc-lutron.log`. Rotation and compression are set in the `[logging]` section of its config:

```toml
[logging]
level       = "info"   # stderr log level; RUST_LOG overrides this
rotation    = "daily"  # daily | hourly | weekly | never
max_size_mb = 100      # rotate when file exceeds this MB (0 = time-only)
compress    = true     # gzip rotated files in a background thread
```

| File | Description |
|---|---|
| `logs/hc-lutron.log` | Active log (never compressed) |
| `logs/hc-lutron.2026-03-27.log.gz` | Rotated daily file (compressed) |
| `logs/hc-lutron.2026-03-27.1.log.gz` | Second rotation in the same period (size limit reached) |
