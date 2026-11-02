---
id: caseta
title: Lutron Caseta Pro
sidebar_label: Caseta
sidebar_position: 7
---

# Lutron Caseta Pro (`hc-caseta`)

hc-caseta connects a Lutron Caseta **Smart Bridge Pro** (`L-BDGPRO2-WH`) to
HomeCore using the Lutron Integration Protocol (LIP) over telnet.

> **Pro bridge required.** The standard Caseta Smart Bridge has no telnet
> integration. Only the **Pro** model exposes LIP.

This plugin is separate from [`hc-lutron`](./lutron) (RadioRA 2) because
Caseta Pro speaks a smaller subset of LIP and uses different device kinds.
If you have both kinds of bridge, both plugins can run side by side.

## Supported device kinds

| Caseta kind | HomeCore `device_type` | Notes |
|---|---|---|
| `dimmer` | `light` | `brightness_pct` 0 to 100, with a fade time you can set per device. |
| `switch` | `switch` | On/off relay. |
| `shade` | `cover` | Motorized shade with position control. |
| `fan_control` | `fan` | Fan speed levels. |
| `pico` | `pico_remote` | Button press, hold and release. It can also be pressed from homeCore. |
| `occupancy_sensor` | `occupancy_sensor` | Occupied or vacant. |

Scenes made in the Lutron app (the bridge's phantom buttons) are listed as
`[[scenes]]` and appear as `scene` devices you can run.

Devices get the ID `caseta_{integration_id}`. A scene's ID is
`caseta_scene_` followed by a slug of the name it had when the plugin first
saw it.

## What devices report and take

Names and units follow homeCore's shared device vocabulary. The plugin
converts from Caseta's own scales.

| Device | Reports | Takes |
|---|---|---|
| dimmer | `on`, `brightness_pct` (0 to 100, decimals), `last_command_error` | `on`, `brightness_pct`, with optional `transition_ms`; actions `raise`, `lower`, `stop` (ramp the level) |
| switch | `on`, `last_command_error` | `on` |
| fan | `on`, `speed` (`off`/`low`/`medium`/`medium-high`/`high`), `speed_pct`, `last_command_error` | `on`, `speed`, `speed_pct` |
| shade | `position` (0 to 100, 100 = open), `last_command_error` | `position`; actions `raise`, `lower`, `stop` |
| occupancy sensor | `occupied` (absent until the bridge first reports it) | nothing |
| pico | `available_buttons`, `button_N`, `pushed`, `held`, `released`, `last_button`, `last_button_name`, `last_command_error` | action `press` (`{"action": "press", "button": 2}`) |
| scene | `last_command_error` | action `activate` |

### Pico remotes

- The bridge reports only press and release, so the plugin times holds
  itself. Pressing a button sets `button_N` to `press`, then to `hold` if it
  stays down past the hold threshold (500 ms), then to `release` when it comes
  up. It always returns to `release`, including at registration and after a
  reconnect, so pressing the same button twice runs an automation twice.
- For the **button trigger** in automations ("Pico button 2 is pushed / held /
  released"), the Pico reports `pushed`, `held` and `released`. Each carries
  the button number for a moment and is cleared straight away, so it fires
  every time.
- A Pico's buttons come from its row in Settings, which the integration report
  fills in. With none set it is treated as the usual 5-button Pico: On (2),
  Favorite (3), Off (4), Raise (5), Lower (6). A **4-button scene Pico** is
  recognised the first time one of its buttons (8 to 11) is pressed, and
  remembered. A **2-button** Pico has to be set in Settings (buttons `2, 4`).
  You can name the buttons there too. `available_buttons` is a list of
  `{number, name}`, the same shape hc-lutron publishes.
- You can **press** a Pico button from an automation step or the API. The
  bridge then does whatever that button is paired to in the Lutron app.

### When a command doesn't work

Every command reports how it went, in the device's `last_command_error`
(cleared once a command works) and in a `plugin_command_result` event (on
MQTT, `homecore/events/plugin_command_result`). If the bridge refuses a
command (`~ERROR`), the error is shown in words and the state published for
that command is put back. While the bridge is offline, commands are refused
straight away. They are never queued, and a command that has waited more than
30 seconds is not sent.

### Other details

- `{"on": true}` with no level turns a dimmer or fan back on at the last
  level the bridge reported, or full if none has been seen since the plugin
  started. `brightness_pct: 0` is off, and a lit dimmer never reports 0 %.
- To fade, send `transition_ms` beside a dimmer level, for example
  `{"brightness_pct": 40, "transition_ms": 2000}`. The older `fade_secs` is
  still read.
- Every device and scene reads offline until the plugin has a session with
  the bridge, and again whenever the connection drops. A bridge that stops
  answering without closing the connection is noticed within about 70
  seconds.
- Renaming a scene in the Lutron app keeps its homeCore ID, so automations
  that run it keep working. The plugin remembers scene IDs and learned Pico
  layouts in `.caseta-memory.json` beside its config.
- When the bridge reports that a scene ran, the plugin publishes the MQTT
  event `homecore/events/caseta_scene_activated` with `device_id`, `name`,
  `bridge_id` and `button`. An automation can start on it with an MQTT
  message trigger. This hasn't yet been confirmed on a real bridge.
- No longer published: `brightness` (a 0 to 255 copy of the level),
  `occupancy` (the same as `occupied`) and a scene's unconfirmed `on`.

## The plugin's screens

Open the plugin under **Settings › Plugins › Caséta**. Its page shows:

- the bridge connection, with **Reconnect** (for admins);
- **Lights and plugs**: each light, its room, whether it is on, and what it
  works as (its kind in Settings). A device set up as on/off that the bridge
  reports at a part level is marked "dims", followed by "set it to Dimmer in
  Settings?". Change it in the Lutron app first, then in Settings;
- **Pico remotes**: each button and the automations it starts;
- **Bridge scenes**: run one, and see how many automations use it;
- **Heard from the bridge, not set up here**: IDs the bridge talks about
  that have no row in Settings.

A Pico's panel draws the Pico with the last button pressed lit. It is the
same panel hc-lutron uses. A Pico's card is a small Pico with the last press
lit. **Caséta scenes** is a card you can add to any page, holding the scenes
you choose in your order. In automations, a step on a Caséta scene or Pico
can **run a bridge scene** or **press a Pico button**. Lights keep the app's
own cards.

## Prerequisites

- A Caseta Smart Bridge Pro on your LAN, with **Telnet Support** turned on in
  the Lutron app (Advanced → Integration)
- The telnet integration login (factory defaults: username `lutron`,
  password `integration`, which are also the plugin's defaults)
- The **integration report**: Lutron app → Settings → Advanced → Integration
  → Send Integration Report. Paste it under the plugin's **Settings ›
  Devices** to add every zone, Pico and scene. Pasting it again adds new rows
  and fills in what existing rows are missing (such as a Pico's buttons)
  without changing anything you set. A Caseta bridge has no `DbXmlInfo.xml`;
  that is RadioRA 2's.

## Configuration

Install the plugin from the web UI (**Plugins → Add**), then set the bridge
address and login on its **Configuration** tab. homeCore owns the config file
(`config/plugins/plugin.caseta.toml` under homeCore's home directory) and
restarts the plugin when it changes.

```toml
[caseta]
host     = "192.168.1.100"   # bridge IP
port     = 23
username = "lutron"
password = "integration"

default_fade_secs    = 1.0   # dimmer fade when a command carries none
hold_threshold_ms    = 500   # a Pico button held this long is a hold
reconnect_delay_secs = 5     # first wait before reconnecting; doubles up to a minute

[[devices]]
integration_id = 2
name           = "Living Room Lamp"
kind           = "dimmer"
area           = "living_room"
# fade_secs    = 0.5         # optional per-device override

[[devices]]
integration_id = 11
name           = "Bedroom Pico"
kind           = "pico"
area           = "bedroom"
buttons        = [2, 3, 4, 5, 6]   # optional; empty = the usual 5-button Pico

[[scenes]]
name             = "Evening"
button_component = 3         # the phantom button, from the integration report
bridge_id        = 1
```

Picos can also take `button_names`, and a scene can take an `area`.

Connecting times out after 10 seconds. Reconnects start at
`reconnect_delay_secs` and back off up to a minute.

## Actions

| Action | Who | What |
|---|---|---|
| `status` | anyone who can see devices | the connection, bridge address, when the plugin last heard the bridge, each Pico's buttons and last press, scenes, IDs heard but not set up, and switches that dim |
| `reconnect` | admin | drops the session and logs in again now |
| `import_integration_report` | admin | turns a pasted integration report into config rows |

## Notices

| Code | Means |
|---|---|
| `not_configured` | No bridge address is set, so no connection is attempted. |
| `bridge_unreachable` | The bridge isn't answering. Clears on reconnect. |
| `bad_credentials` | The bridge refused the integration username or password. The plugin retries after 30 seconds, backing off to every 5 minutes, and the notice clears on login. |
| `switch_dims` | A device set up as a switch reports a part level, so it may be a dimmer. |
| `not_on_bridge` | A configured integration ID the bridge has no zone for. The device shows offline. |

## Upgrading from 0.1.14

- Device and scene IDs are unchanged.
- `available_buttons` is now a list of `{number, name}`. It used to be numbers.
- `button_N` now goes back to `release` after each press, so an automation on
  `button_N` becoming `press` fires on every press, not just the first.
- Picos gain `pushed`, `held`, `released`, `last_button` and
  `last_button_name`, and devices and scenes gain `last_command_error`.
- A Pico with no buttons set is now a 5-button Pico.
- Devices read offline until the plugin has connected to the bridge.

## Comparison with `hc-lutron`

| | `hc-lutron` | `hc-caseta` |
|---|---|---|
| Target | RadioRA2 main repeater | Caseta Smart Bridge Pro |
| Protocol | LIP over telnet | LIP over telnet |
| Scenes | Phantom buttons with scene LED feedback | Phantom buttons; no LEDs, so no "on" state |
| VCRX / CCI | Yes | No (Caseta has none) |
| Device list | Read from the repeater (`DbXmlInfo.xml`) | Pasted integration report |
| Pico remotes | Yes | Yes (same panel) |
| Occupancy sensors | Yes | Yes |
