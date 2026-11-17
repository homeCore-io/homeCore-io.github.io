---
id: lutron
title: Lutron RadioRA2
sidebar_label: Lutron
sidebar_position: 6
---

# Lutron RadioRA 2 (`hc-lutron`)

hc-lutron connects a Lutron RadioRA 2 main repeater to homeCore. It logs in
over telnet and speaks the Lutron Integration Protocol (LIP). Each dimmer,
switch, shade, fan, contact closure output, keypad, Pico, occupancy group and
visor control receiver (VCRX) you set up becomes a homeCore device. So does
each phantom button scene and timeclock event.

A Caséta Smart Bridge Pro has its own plugin. See [Caséta](./caseta).

## Before you start

- You need a RadioRA 2 main repeater with a fixed address on your network.
  homeCore must reach it on TCP port 23 (telnet) for control and port 80 for
  device discovery.
- Turn on Telnet Support in RadioRA 2 Essentials or Inclusive, in the
  repeater's integration settings.
- You need the integration account's username and password. The plugin's
  username defaults to `lutron` and its password to empty.

The factory integration logins (`lutron` / `integration` and `rti` /
`integration`) are widely known. Change that password in RadioRA 2 setup
before you rely on the connection.

## Install and set up

1. Install Lutron from **Settings › Plugins › Catalog**.
2. Open **Settings › Plugins › Lutron** and fill in the Main Repeater
   section: the repeater's IP address (for example `192.168.1.50`) and the
   integration login.
3. In the Devices section, press **Import** under **Discover from the
   repeater**. The plugin reads the design from
   `http://<repeater>/DbXmlInfo.xml` and adds a row for each device, scene and
   timeclock event. RadioRA 2 says what kind of load each output is, so rows
   arrive with their kind filled in. If homeCore can't reach the repeater,
   paste a saved copy of `DbXmlInfo.xml` into the box instead.
4. Review the rows and save. homeCore writes
   `config/plugins/plugin.lutron.toml` and restarts only this plugin.

Running Import again adds new devices and scenes and fills in what existing
rows lack, without changing anything you set. Timeclock events have no single
key to match on, so a second import adds them all again. Delete the
duplicates before you save.

When the plugin starts, it registers the devices, reads the keypad and scene
LEDs and current levels, and then follows the repeater's live updates.

## Settings

| Setting | Key | Default | What it does |
|---|---|---|---|
| Repeater host | `lutron.host` | none | IP address of the main repeater. With none set, the plugin raises `not_configured`. |
| Port | `lutron.port` | `23` | Telnet port. |
| Username | `lutron.username` | `lutron` | Integration login. |
| Password | `lutron.password` | empty | Integration password. |
| Default fade | `lutron.default_fade_secs` | `1.0` s | Fade for dimmers when a command doesn't give one. Fan speed changes carry it too. Shades and switches change without a fade. `0` is instant. |
| Hold threshold | `lutron.hold_threshold_ms` | `500` ms | How long a keypad or Pico button must stay down to count as a hold. |
| Reconnect delay | `lutron.reconnect_delay_secs` | `5` s | First wait before reconnecting. It doubles after each failure, up to 60 seconds. |

Each row in the Devices table has these columns:

| Column | Key | What it does |
|---|---|---|
| Integration ID | `integration_id` | The ID from RadioRA 2 programming and `DbXmlInfo.xml`. |
| Name | `name` | Display name. |
| Kind | `kind` | `dimmer`, `switch`, `shade`, `fan_control`, `cco_pulsed`, `keypad`, `pico`, `occupancy_group` or `vcrx`. A row with no Kind, or one the plugin doesn't know, is skipped. |
| Room | `area` | The homeCore area. |
| Fade | `fade_secs` | This device's fade, in seconds. Empty uses Default fade. |
| Invert position | `invert_position` | For a shade mounted the other way up. |
| Buttons | `buttons` | Keypad buttons with LEDs, read on connect. |
| All buttons | `all_buttons` | Every pressable button, LED or not. This is the only list a Pico's buttons go in, because a Pico has no LEDs. |
| Button engravings | `button_names` | What's printed on each button, in the order of All buttons. |
| Contact inputs | `ccis` | A VCRX's contact closure inputs: 30 Full/Security, 31 Flash, 32 Input 1, 33 Input 2. |

Each row in the Scenes table has a Name (`name`), a Repeater ID
(`main_repeater_id`, almost always `1`, and `1` when left out) and a Phantom button
(`button_component`). Each row in the Timeclock events table has a Timeclock
ID (`timeclock_id`, almost always `1`), an Event index (`event_index`), a Name
(`name`) and a Room (`area`).

The Logging section sets the log level, what gets forwarded to homeCore, and
file rotation.

A fade can be set in three places. Default fade applies to every dimmer and
fan, a row's Fade overrides it, and `transition_ms` sent with a level
overrides both for that one command.

If you edit the file by hand, the connection part looks like this:

```toml
[lutron]
host     = "192.168.1.50"
port     = 23
username = "lutron"
password = ""

default_fade_secs    = 1.0
hold_threshold_ms    = 500
reconnect_delay_secs = 5

[[devices]]
integration_id = 36
name           = "Garage VCRX"
kind           = "vcrx"
area           = "garage"
buttons        = [1, 2, 3, 4, 5, 6]
ccis           = [30, 31, 32, 33]
```

## Devices

| Kind | homeCore type | Device ID |
|---|---|---|
| `dimmer` | `light` | `lutron_<integration_id>` |
| `switch` | `switch` | `lutron_<integration_id>` |
| `shade` | `cover` | `lutron_<integration_id>` |
| `fan_control` | `fan` | `lutron_<integration_id>` |
| `cco_pulsed` | `scene` | `lutron_<integration_id>` |
| `keypad` | `keypad` | `lutron_<integration_id>` |
| `pico` | `pico_remote` | `lutron_<integration_id>` |
| `occupancy_group` | `occupancy_sensor` | `lutron_<integration_id>` |
| `vcrx` | `vcrx` | `lutron_<integration_id>` |
| phantom button scene | `scene` | `lutron_scene_<name>` |
| timeclock event | `timeclock_event` | `lutron_tc_<timeclock_id>_<event_index>` |

A scene's ID is its name in lowercase, with every character other than a
letter or digit turned into `_`. "Movie Mode" becomes
`lutron_scene_movie_mode`.

A pulsed contact closure output, such as a garage door or gate relay, is
published as a scene because it takes `activate` and doesn't latch. A
maintained one latches, so give it the `switch` kind.

### What each device reports and takes

| Device | Reports | Takes |
|---|---|---|
| dimmer | `on`, `brightness_pct` (0 to 100, %, to a tenth) | `on`, `brightness_pct`, optional `transition_ms` |
| switch | `on` | `on` |
| fan | `on`, `speed`, `speed_pct` (%) | `on`, `speed`, `speed_pct`, optional `transition_ms` |
| shade | `position` (0 to 100, %, 100 is open) | `position`; actions `raise`, `lower`, `stop` |
| pulsed contact closure | nothing | action `activate` |
| occupancy group | `occupied` | nothing |
| keypad | `button_N`, `led_N`, `available_buttons`, `button_names`, `last_button`, `last_button_name` | actions `press_button`, `set_led`, `set_button_name` |
| VCRX | the keypad attributes, plus `cci_N_open` | actions `press_button`, `set_led`, `set_button_name` |
| Pico | `button_N`, `available_buttons`, `button_names`, `last_button`, `last_button_name` | action `set_button_name` |
| scene | `active`, `phantom_button`, and `led_component` once the repeater reports an LED | action `activate` |
| timeclock event | `enabled` | `enabled`; action `execute` |

Fan speeds are `off`, `low`, `medium`, `medium-high` and `high`.

You change a device by writing an attribute, or by sending an action:

```json
{"on": true, "brightness_pct": 75}
{"brightness_pct": 40, "transition_ms": 2000}
{"speed": "medium"}
{"position": 50}
{"action": "raise"}
{"action": "press_button", "button": 3}
{"action": "set_led", "button": 3, "state": 2}
{"action": "set_button_name", "button": 1, "name": "Movie"}
{"action": "activate"}
{"action": "execute"}
{"enabled": false}
```

From the API, send these to `PATCH /api/v1/devices/<id>/state`:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/lutron_21/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true, "brightness_pct": 75}'
```

Some details worth knowing:

- `{"on": true}` with no level turns a dimmer or fan back on at the last level
  the repeater reported. If none has been seen since the plugin started, it
  goes to full. `brightness_pct: 0` is off.
- `transition_ms` goes to the repeater to the hundredth of a second, for fades
  under a minute. A `fade_secs` beside a level is still accepted.
- Shades move at their own speed. Fades don't apply to them.
- A timeclock event's `enabled` is what the plugin last sent. RadioRA 2 has no
  way to ask whether one event is enabled, so the plugin starts every event at
  `true`. `execute` runs the event once for testing and doesn't change its
  schedule.

### Keypads, Picos and the VCRX

A button's `button_N` is the latest thing that happened on it: `press`,
`release`, `hold` or `double_click`. A hold fires once the button has been
down for the hold threshold, and a release still follows it.

`led_N` is a keypad or VCRX button's light: `0` off, `1` on, `2` slow flash,
`3` fast flash. `set_led` takes the same values. The repeater may change the
light back when its scene changes. A button with no LED assigned publishes no
`led_N`.

`press_button` presses and releases a button as a person would. A Pico
sends nothing to the repeater, so the only action it takes is
`set_button_name`.

A VCRX's `cci_N_open` is `true` when that contact is open. A typical use is
HomeLink visor control for garage doors, with the inputs wired to contact
sensors that report whether each door is open.

### Button names

Each keypad, Pico and VCRX publishes `button_names`, every button's name keyed
by its number:

```json
"button_names": { "1": "Movie", "2": "Dinner", "3": "Outside", "16": "Lower", "17": "Raise" }
```

A button's name is the one the household gave it. Without one, it's the
engraving from the Button engravings column, which Import fills in. Without
an engraving, a keypad's rocker is *Lower* and *Raise*, a Pico's buttons are
*On*, *Favorite*, *Off*, *Raise* and *Lower*, and any other button is
"Button 5" (or whatever its number is). A VCRX's contact inputs are *Input 1*
and *Input 2*. `available_buttons` (`[{"number": 3, "name": "Outside"}]`),
`last_button_name` and the screens all use these names.

Anyone who can control the keypad can name a button with `set_button_name`.
An empty or missing `name` goes back to the engraving. Names are trimmed and
kept to 64 characters, and a button the device doesn't have is refused. The
plugin keeps each name in homeCore's stored state for the plugin, so names
survive restarts and updates. Changing the engraving in Settings doesn't
clear a name the household gave, and nothing is sent to the repeater.

### Scene state

Each scene is a phantom button on the main repeater, and its state comes from
that button's LED. On the main repeater a phantom button's LED is the button
number plus 100. On a keypad it's the button number plus 80. The plugin
applies the right offset for you.

The plugin reads the LEDs when it connects and follows LED changes after
that. When a phantom button's LED turns on, the scene's `active` becomes
`true`, so automations can react to a scene started from a wall keypad.
Activating a scene from homeCore sets `active: true` right away, so automations
don't wait for the LED. A scene whose phantom button has no LED (usually one
tied to a Pico) still publishes `active`, but nothing confirms it, so the app
shows it as the last activation and not as a reading.

### Automation example

This rule runs a scene 15 minutes before sunset:

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

## Actions

| Action | Who can run it | Timeout | What it does |
|---|---|---|---|
| `status` | anyone who can see devices | 5 s | Whether the repeater session is up (`connected`), since when (`since`), the last error (`error`), and the `host` and `port`. |

The settings editor also calls `import_design` when you press Import. It
needs permission to change plugins, and it gives the repeater 45 seconds to
answer.

## Alerts

The plugin raises no device alerts. It shows these notices on its own page:

| Code | Level | Meaning |
|---|---|---|
| `not_configured` | error | No repeater address is set. |
| `repeater_unreachable` | error | The repeater isn't answering on the telnet port, so lights, scenes and keypads served by this plugin won't respond. It clears on reconnect. |
| `no_devices_configured` | warning | No devices, scenes or timeclock events are set up, so nothing is published. Run Import. |
| `devices_skipped` | warning | One or more device rows have a blank, missing or unknown Kind. The notice names each row by number, name and integration ID. Those rows aren't published; every other device loads. It clears once every row has a Kind. |

## Screens and cards

All of these ship with the plugin, so updating the plugin updates them.

The plugin's page (**Settings › Plugins › Lutron**) shows whether the main
repeater is connected and at what address. It lists keypad buttons nobody has
named yet, with a way to name them. Every scene appears, grouped by room
(scenes with no room go under *House*), lit when its LED is on. Tap one to run
it. Keypads are drawn with their lights and the last button pressed, followed
by Picos and visor receivers, and a count of switches, dimmers, fans and
occupancy groups with what's on now.

A keypad's panel draws the keypad as it looks on the wall, with live lights.
Pick a button to press it, or to set its light. Below are recent presses
("OH1 Toggle, held, 2 min ago") and the automations that start on that
button.

A Pico's panel is drawn from the buttons the Pico reports, with the last
button pressed lit and what each button starts. There is nothing to press,
because a Pico takes no commands.

A VCRX's panel shows its buttons and lights, which you can press, its contact
inputs (Open or Closed, and since when), and its last press.

A keypad's card shows its named buttons with their lights, to tap. Unnamed
buttons are left off. The compact card shows how many lights are lit.

The **Lutron scenes** card is one you add yourself (Edit › Add a card). It
holds the scenes you pick, in the order you drag them, as a grid or a single
row.

In the automation editor, a keypad or VCRX step is *Press a button* or *Set a
light*. You pick the button on a drawing of the keypad, and the step reads
back in words, for example "press Outside on Kitchen 6 Button".

## Troubleshooting

| Problem | What to check |
|---|---|
| `repeater_unreachable` | The repeater is powered and on the network, Repeater host is its address, and Telnet Support is on. |
| The login fails | The integration account's username and password in RadioRA 2 programming. |
| Import fails | homeCore can reach the repeater on port 80. If it can't, paste a copy of `DbXmlInfo.xml`. |
| A device doesn't appear | It has a row, it's programmed in the RadioRA 2 design, and the repeater is online. Run Import again. |
| `devices_skipped`, or a device is missing after a save | Choose a Kind for each row the notice names, then save. The plugin skips a row without a usable Kind and logs a warning for it. |
| A dim level is a little off | The repeater works in hundredths of a percent and homeCore shows tenths, so small rounding differences are normal. |

The plugin sends a keepalive every 60 seconds. If the repeater doesn't answer
within 10 seconds, or sends nothing at all for 150 seconds, the plugin drops
the session and reconnects. The wait starts at Reconnect delay and doubles up
to 60 seconds.

## Known limits

- While the repeater is unreachable, devices keep their last state and still
  read online in homeCore. Watch the `repeater_unreachable` notice. Devices go
  offline when the plugin itself stops.
- RadioRA 2 has no device list over LIP. New devices appear only after you
  run Import again or add a row by hand.
- Timeclock `enabled` is what the plugin last sent, since the repeater can't
  be asked.
- Picos can't be pressed from homeCore.
