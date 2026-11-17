---
id: caseta
title: Lutron Caseta Pro
sidebar_label: Caseta
sidebar_position: 7
---

# Lutron Caséta (`hc-caseta`)

hc-caseta connects a Lutron Caséta Smart Bridge Pro (`L-BDGPRO2-WH`) to
homeCore. It logs in to the bridge's telnet integration and speaks the Lutron
Integration Protocol (LIP). Dimmers, switches, shades, fan controls, Pico
remotes, occupancy sensors and the scenes you made in the Lutron app all show
up as homeCore devices.

RadioRA 2 has its own plugin, [`hc-lutron`](./lutron). If you have both
systems, run both plugins side by side.

## Before you start

- You need the Smart Bridge Pro. The standard Caséta Smart Bridge has no
  telnet integration, so this plugin can't talk to it.
- In the Lutron app, turn on Telnet Support under Settings › Advanced ›
  Integration.
- The bridge needs a fixed address on your network, and homeCore must be able
  to reach it on TCP port 23.
- The integration login is `lutron` / `integration` from the factory. Those
  are also the plugin's defaults.
- Have the integration report ready. In the Lutron app, go to Settings ›
  Advanced › Integration › Send Integration Report. Lutron emails you a JSON
  file that lists every integration ID, name and room. The bridge has no
  device list the plugin can query, so this report is how devices get in.

## Install and set up

1. Install Caséta from **Settings › Plugins › Catalog**.
2. Open **Settings › Plugins › Caséta** and fill in the Bridge section:
   the bridge's IP address (for example `192.168.1.100`), and the login if you
   changed it.
3. In the Devices section, paste the integration report into **Paste
   integration report**. Each zone, Pico and phantom button becomes a row for
   you to review. Nothing is saved until you save.
4. Pick a **Kind** for each device row. The report doesn't say what kind of
   load a zone is, so imported rows arrive without one. The plugin skips a row
   with no kind and names it in its log.
5. Save. homeCore writes `config/plugins/plugin.caseta.toml` and restarts the
   plugin.

Pasting the report again later adds new rows and fills in what existing rows
lack, such as a Pico's buttons. It doesn't change anything you already set.

## Settings

| Setting | Key | Default | What it does |
|---|---|---|---|
| Bridge host | `caseta.host` | none | IP address of the Smart Bridge Pro. With none set, the plugin connects to nothing and raises `not_configured`. |
| Port | `caseta.port` | `23` | Telnet port. |
| Username | `caseta.username` | `lutron` | Integration login. |
| Password | `caseta.password` | `integration` | Integration password. |
| Default fade | `caseta.default_fade_secs` | `1.0` s | Dimmer fade when a command doesn't give one. |
| Hold threshold | `caseta.hold_threshold_ms` | `500` ms | How long a Pico button must stay down to count as a hold. |
| Reconnect delay | `caseta.reconnect_delay_secs` | `5` s | First wait before reconnecting. It doubles after each failure, up to a minute. |

Each row in the Devices table has these columns:

| Column | Key | What it does |
|---|---|---|
| Integration ID | `integration_id` | The ID from the integration report. The device's homeCore ID is `caseta_<integration_id>`. |
| Name | `name` | Display name. |
| Kind | `kind` | `dimmer`, `switch`, `shade`, `fan_control`, `pico` or `occupancy_sensor`. |
| Room | `area` | The homeCore area. |
| Fade | `fade_secs` | This dimmer's fade, in seconds. Empty uses Default fade. |
| Invert position | `invert_position` | For a shade mounted the other way up. Off by default. |
| Pico buttons | `buttons` | A Pico's button numbers. Empty means the usual 5-button Pico. |
| Pico button names | `button_names` | A name for each button, in the same order. Blank keeps the usual name. |

Each row in the Scenes table has a Name (`name`), a Phantom button
(`button_component`, 1 to 100, from the integration report), a Bridge ID
(`bridge_id`, default `1`) and a Room (`area`).

The Logging section sets the log level, what gets forwarded to homeCore, and
file rotation.

If you edit the file by hand, it looks like this:

```toml
[caseta]
host     = "192.168.1.100"
port     = 23
username = "lutron"
password = "integration"

default_fade_secs    = 1.0
hold_threshold_ms    = 500
reconnect_delay_secs = 5

[[devices]]
integration_id = 2
name           = "Living Room Lamp"
kind           = "dimmer"
area           = "living_room"
# fade_secs    = 0.5

[[devices]]
integration_id = 11
name           = "Bedroom Pico"
kind           = "pico"
area           = "bedroom"
buttons        = [2, 3, 4, 5, 6]

[[scenes]]
name             = "Evening"
button_component = 3
bridge_id        = 1
```

## Devices

| Kind | homeCore type | Reports | Takes |
|---|---|---|---|
| `dimmer` | `light` | `on`, `brightness_pct` (0 to 100, %, to a tenth) | `on`, `brightness_pct`, optional `transition_ms`; actions `raise`, `lower`, `stop` |
| `switch` | `switch` | `on` | `on` |
| `fan_control` | `fan` | `on`, `speed`, `speed_pct` (%) | `on`, `speed`, `speed_pct` |
| `shade` | `cover` | `position` (0 to 100, %, 100 is open) | `position`; actions `raise`, `lower`, `stop` |
| `occupancy_sensor` | `occupancy_sensor` | `occupied` | nothing |
| `pico` | `pico_remote` | `available_buttons`, `button_N`, `pushed`, `held`, `released`, `last_button`, `last_button_name` | action `press` |
| scene | `scene` | nothing but `last_command_error` | action `activate` |

Every device except the occupancy sensor also reports `last_command_error`.
An occupancy sensor has no `occupied` value until the bridge first reports
one. Fan speeds are `off`, `low`, `medium`, `medium-high` and `high`.

You change a device by writing an attribute, or by sending an action:

```json
{"brightness_pct": 40, "transition_ms": 2000}
{"position": 50}
{"speed": "medium"}
{"action": "raise"}
{"action": "press", "button": 2}
{"action": "activate"}
```

Some details worth knowing:

- `{"on": true}` with no level turns a dimmer or fan back on at the last level
  the bridge reported. If none has been seen since the plugin started, it goes
  to full. `brightness_pct: 0` is off.
- `transition_ms` applies to dimmers only. Shades and fans move at their own
  speed. The older `fade_secs` key is still read.
- A dimmer's `raise` and `lower` ramp the level until you send `stop`.
- A scene's homeCore ID is `caseta_scene_` plus a slug of the name it had when
  the plugin first saw it. If you rename the scene in the Lutron app, the ID
  stays, and so do the automations that use it. Caséta scenes have no LED, so
  a scene has no on or off state.

### Pico remotes

The bridge reports only press and release, so the plugin times holds itself.
A press sets `button_N` to `press`. If the button is still down after the
hold threshold, it changes to `hold`. When the button comes up it goes to
`release`. It always ends at `release`, including at startup and after a
reconnect, so pressing the same button twice runs an automation twice.

The button trigger in automations ("Pico button 2 is pushed") reads
`pushed`, `held` and `released`. Each holds the button number for a moment
and is then cleared, so it fires on every press.

The Pico buttons column sets which buttons a Pico has. With none set, the
plugin assumes the usual 5-button Pico: On (2), Favorite (3), Off (4),
Raise (5) and Lower (6). The first press of button 8, 9, 10 or 11 marks it as
a 4-button scene Pico, and the plugin remembers that. A 2-button Pico has to
be set by hand as `2, 4`. `available_buttons` is a list of `{number, name}`,
the same shape hc-lutron publishes.

The `press` action presses and releases a button as if by hand. The bridge
then does whatever the button is paired to in the Lutron app.

### Scene events

When the bridge reports that a scene ran, the plugin publishes the MQTT event
`homecore/events/caseta_scene_activated` with `device_id`, `name`,
`bridge_id` and `button`. An automation can start on it with an MQTT message
trigger. This event hasn't been checked against a real bridge yet.

## Actions

| Action | Who can run it | Timeout | What it does |
|---|---|---|---|
| `status` | anyone who can see devices | 5 s | The connection, bridge address, when the plugin last heard the bridge, each Pico's buttons and last press, scenes, IDs heard but not set up, and switches that dim. |
| `reconnect` | admins | 5 s | Drops the session with the bridge and logs in again now. |

The settings editor also calls `import_integration_report` when you paste a
report. It turns the report into rows and needs permission to change plugins.

## Alerts

The plugin raises no device alerts. It shows these notices on its own page:

| Code | Level | Meaning |
|---|---|---|
| `not_configured` | error | No bridge address is set. |
| `bridge_unreachable` | error | The bridge isn't answering. It clears on reconnect. |
| `bad_credentials` | error | The bridge refused the integration login. The plugin retries after 30 seconds, backing off to every 5 minutes. It clears once a login works. |
| `switch_dims` | warning | A device set up as a switch reports a part level, so it's probably a dimmer. |
| `not_on_bridge` | warning | A configured integration ID has no zone on the bridge. That device shows offline. |

## Screens and cards

The plugin's page (**Settings › Plugins › Caséta**) shows:

- The bridge connection, with a **Reconnect** button for admins.
- Lights and plugs: each one's room, whether it's on, and what it works as.
  A device set up as on/off that reports a part level is marked "dims".
  Change it in the Lutron app first, then set it to Dimmer in Settings.
- Pico remotes: each button and the automations it starts.
- Bridge scenes: run one, and see how many automations use it.
- Heard from the bridge, not set up here: IDs the bridge talks about that
  have no row in Settings.

A Pico's detail panel draws the remote with the last button pressed lit. Its
card is a small Pico that does the same. The **Caséta scenes** card can go on
any dashboard and holds the scenes you pick, in your order. In the
automation editor, a step on a Caséta scene or Pico can run a bridge scene or
press a Pico button. Lights, switches, fans and shades use the app's standard
cards.

## Troubleshooting

- Every device and scene reads offline until the plugin has a session with
  the bridge, and again whenever the session drops or the plugin stops.
- The plugin sends a keepalive every 60 seconds. A bridge that doesn't answer
  within 10 seconds, or that sends nothing at all for 150 seconds, is treated
  as gone, so a bridge that drops off without closing the connection is
  noticed in about 70 seconds. Connecting times out after 10 seconds.
- Every command reports how it went. The device's `last_command_error` holds
  the reason a command failed, in words, and clears once one works. A
  `plugin_command_result` event goes out too (on MQTT,
  `homecore/events/plugin_command_result`). If the bridge rejects a command,
  the state the plugin published for it is put back.
- While the bridge is offline, commands fail right away. They are never
  queued, and a command that waited more than 30 seconds isn't sent.
- A device that never shows up usually has no Kind set, or its integration ID
  isn't on the bridge (`not_on_bridge`).
- The plugin keeps scene IDs and learned Pico layouts in
  `.caseta-memory.json` beside its config file.

## Known limits

- Caséta scenes have no LED feedback, so homeCore can run a scene but can't
  tell whether it's active.
- The bridge has no queryable device list. New devices appear only after you
  paste a fresh integration report or add a row by hand.
- Caséta has no VCRX or CCI inputs, which hc-lutron supports on RadioRA 2.
