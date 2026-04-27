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
> If you have the standard model, use the cloud-based integration
> via Home Assistant or a similar bridge instead, or upgrade.

The plugin is separate from `hc-lutron` (RadioRA2) because Caseta
Pro speaks a slimmer subset of LIP and uses different device kinds
than full RadioRA2 systems. Both plugins can run side-by-side if you
have both bridges.

## Supported device kinds

| Caseta kind | HomeCore `device_type` | Notes |
|---|---|---|
| `dimmer` | `light` | Brightness 0–100, configurable per-device fade time. |
| `switch` | `switch` | On/off relay. |
| `shade` | `cover` | Motorized shade with position control. |
| `fan_control` | `fan` | Fan speed levels. |
| `pico` | `button` | Button press / release / hold events (read-only). |
| `occupancy_sensor` | `occupancy_sensor` | Occupied / vacant state. |

## Prerequisites

- Caseta Smart Bridge Pro on your LAN
- Telnet integration credentials (factory defaults: username `lutron`, password `integration`)
- The integration ID for each device you want to control. Find them in:
  - The Lutron mobile app's "Advanced" section, or
  - The bridge's `DbXmlInfo.xml`: `http://{bridge_ip}/DbXmlInfo.xml`

## Configuration

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.caseta"
password    = ""

[caseta]
host     = "192.168.1.100"   # bridge IP
port     = 23                # telnet (fixed; do not change)
username = "lutron"
password = "integration"

# Optional: global fade time for dimmers (seconds).
# Each [[devices]] entry can override with its own `fade_secs`.
default_fade_secs    = 1.0
reconnect_delay_secs = 5

[[devices]]
integration_id = 2
name           = "Living Room Lamp"
kind           = "dimmer"
area           = "living_room"
# fade_secs    = 0.5         # optional per-device override

[[devices]]
integration_id = 5
name           = "Kitchen Pendant"
kind           = "switch"
area           = "kitchen"

[[devices]]
integration_id = 11
name           = "Bedroom Pico"
kind           = "pico"
area           = "bedroom"
```

Each device needs `integration_id`, `name`, `kind`, and `area`. Pico
remotes are read-only — they emit button events but don't accept
commands.

## Running

```bash
cd /path/to/hc-caseta
./hc-caseta config/config.toml
```

The plugin connects via telnet, registers all configured devices,
and subscribes to real-time state updates from the bridge.

## SDK adoption

`hc-caseta` is built on `hc-plugin-sdk-rs` and supports the full
management protocol: heartbeat, remote configuration, dynamic log
level, and MQTT log forwarding.

## Comparison with `hc-lutron`

| | `hc-lutron` | `hc-caseta` |
|---|---|---|
| Target | RadioRA2 main repeater | Caseta Smart Bridge Pro |
| Protocol | LIP over telnet | LIP over telnet |
| Scenes | Phantom buttons + scene LED feedback | Not supported (Caseta Pro lacks phantom buttons) |
| VCRX / CCI | Yes | No (not present in Caseta) |
| Auto device discovery | Full inventory query at startup | No — devices listed manually in config |
| Pico remotes | Yes | Yes |
| Occupancy sensors | Yes | Yes |

If you have a RadioRA2 system, use `hc-lutron`. Caseta Pro is the
right choice for the Caseta product line.
