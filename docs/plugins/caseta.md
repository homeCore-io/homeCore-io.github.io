---
id: caseta
title: Lutron Caseta Pro
sidebar_label: Caseta
sidebar_position: 7
---

# Lutron Caseta Pro (`hc-caseta`)

Bridges a Lutron Caseta **Smart Bridge Pro** (`L-BDGPRO2-WH`) to
HomeCore via the Lutron Integration Protocol (LIP) over telnet.

> **Pro bridge required.** The standard Caseta Smart Bridge does not
> support telnet integration — only the **Pro** model exposes LIP.

The plugin is separate from `hc-lutron` (RadioRA2) because Caseta
Pro speaks a slimmer subset of LIP and uses different device kinds
than full RadioRA2 systems. Both plugins can run side-by-side if you
have both bridges.

## Supported device kinds

| Caseta kind | HomeCore `device_type` | Notes |
|---|---|---|
| `dimmer` | `light` | `brightness_pct` 0–100, configurable per-device fade time. |
| `switch` | `switch` | On/off relay. |
| `shade` | `cover` | Motorized shade with position control. |
| `fan_control` | `fan` | Fan speed levels. |
| `pico` | `pico_remote` | Button press, hold and release; can be pressed from homeCore. |
| `occupancy_sensor` | `occupancy_sensor` | Occupied / vacant state. |

Scenes made in the Lutron app (the bridge's phantom buttons) are listed as
`[[scenes]]` and appear as `scene` devices you can run.

## What devices report and take

Names and units follow homeCore's shared device vocabulary, converted from
Caséta's own scales inside the plugin.

| Device | Reports | Takes |
|---|---|---|
| dimmer | `on`, `brightness_pct` (0–100, decimals), `last_command_error` | `on`, `brightness_pct`, with optional `transition_ms`; actions `raise`, `lower`, `stop` |
| switch | `on`, `last_command_error` | `on` |
| fan | `on`, `speed` (`off`/`low`/`medium`/`medium-high`/`high`), `speed_pct`, `last_command_error` | `on`, `speed`, `speed_pct` |
| shade | `position` (0–100, 100 = open), `last_command_error` | `position`; actions `raise`, `lower`, `stop` |
| occupancy sensor | `occupied` (absent until the bridge first reports it) | — |
| pico | `available_buttons`, `button_N`, `pushed`, `held`, `released`, `last_button`, `last_button_name`, `last_command_error` | action `press` (`{"action": "press", "button": 2}`) |
| scene | `last_command_error` | action `activate` |

### Pico remotes

- Pressing a button sets `button_N` to `press`, then `hold` if it stays down
  past the hold threshold (500 ms), then `release` when it comes up. It always
  comes back to `release`, so pressing the same button twice runs an
  automation twice.
- For the **button trigger** in automations ("Pico button 2 is pushed / held /
  released"), the Pico reports `pushed`, `held` and `released` — every time.
- Which buttons a Pico has comes from its row in Settings (the integration
  report fills it in). With none set it is the usual 5-button Pico: On,
  Favorite, Off, Raise, Lower. A **4-button scene Pico** is recognised the
  first time one of its buttons is pressed; a **2-button** Pico has to be set
  in Settings (buttons `2, 4`). You can name the buttons there too.
- **Press** a Pico button from an automation step or the API: the bridge does
  whatever that button is paired to in the Lutron app.

### When a command doesn't work

Every command says how it went: the device's `last_command_error` (empty once
a command works) and a `plugin_command_result` event. The bridge refusing a
command (`~ERROR`) shows there in words, and the state shown for it is put
back. While the bridge is offline commands are refused straight away — they
are never queued and sent minutes later.

### Other details

- **`{"on": true}` with no level** turns a dimmer or fan back on at the last
  level the bridge reported. `brightness_pct: 0` is off.
- **Fades:** send `transition_ms` beside a dimmer level, e.g.
  `{"brightness_pct": 40, "transition_ms": 2000}`.
- **Offline:** every device and scene reads offline until the plugin is
  connected to the bridge, and whenever the connection drops. A bridge that
  stops answering without closing the connection is noticed within about a
  minute and a half.
- **Renaming a scene** in the Lutron app keeps its homeCore id, so automations
  that run it keep working.
- **Scene activated** (not yet confirmed on a real bridge): when the bridge
  reports a scene ran, the plugin publishes the MQTT event
  `homecore/events/caseta_scene_activated`.

## The plugin's screens

Open the plugin under **Settings › Plugins › Caséta**:

- the bridge connection, with **Reconnect**;
- **Lights and plugs** — each light, its room, whether it is on, and what it
  works as (its kind in Settings). A device set up as on/off that the bridge
  reports at a part level is marked "dims — set it to Dimmer in Settings?";
  change it in the Lutron app first, then in Settings;
- **Pico remotes** — each button and the automations it starts;
- **Bridge scenes** — run one, and see how many automations use it;
- **Heard from the bridge, not set up here** — IDs the bridge talks about
  that have no row in Settings.

A Pico's panel draws the Pico with the last button pressed lit (the same
panel as Lutron's), its card shows the last press, and **Caséta scenes** is
a card you can add to any page. In automations, a step on a Caséta device
can **run a bridge scene** or **press a Pico button**.

## Prerequisites

- Caseta Smart Bridge Pro on your LAN, with **Telnet Support** turned on in
  the Lutron app (Advanced → Integration)
- Telnet integration credentials (factory defaults: username `lutron`,
  password `integration`)
- The **integration report**: Lutron app → Settings → Advanced → Integration
  → Send Integration Report. Paste it under the plugin's **Settings ›
  Devices** to add every zone, Pico and scene; pasting it again fills in what
  existing rows are missing (such as a Pico's buttons) without changing what
  you set.

## Configuration

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

## Notices

| Code | Means |
|---|---|
| `not_configured` | No bridge address is set. |
| `bridge_unreachable` | The bridge is not answering. Clears on reconnect. |
| `bad_credentials` | The bridge refused the integration username or password. Retried every few minutes. |
| `switch_dims` | A device set up as a switch reports a part level. |
| `not_on_bridge` | A configured integration ID the bridge doesn't know. |

## Upgrading from 0.1.14

- Device and scene ids are unchanged.
- `available_buttons` is now a list of `{number, name}` (it was numbers).
- `button_N` now goes back to `release` after each press; an automation on
  `button_N` becoming `press` fires on every press, not just the first.
- New: `pushed` / `held` / `released` / `last_button` / `last_button_name`
  on Picos, and `last_command_error` on devices and scenes.
- A Pico with no buttons set is now a 5-button Pico.
- Devices read offline until the plugin has connected to the bridge.

## Comparison with `hc-lutron`

| | `hc-lutron` | `hc-caseta` |
|---|---|---|
| Target | RadioRA2 main repeater | Caseta Smart Bridge Pro |
| Protocol | LIP over telnet | LIP over telnet |
| Scenes | Phantom buttons + scene LED feedback | Phantom buttons; no LEDs, so no "on" state |
| VCRX / CCI | Yes | No (not present in Caseta) |
| Device list | Read from the repeater (`DbXmlInfo.xml`) | Pasted integration report |
| Pico remotes | Yes | Yes (same panel) |
| Occupancy sensors | Yes | Yes |
