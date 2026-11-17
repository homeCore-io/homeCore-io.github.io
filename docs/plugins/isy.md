---
id: isy
title: ISY / IoX
sidebar_label: ISY / IoX
sidebar_position: 9
---

# ISY / IoX (`hc-isy`)

hc-isy connects a Universal Devices ISY or IoX controller (ISY994i, eisy or
Polisy) to homeCore. It reads the controller's nodes and scenes over the ISY
REST API and follows changes on the controller's WebSocket event stream. The
Insteon and Z-Wave devices the controller runs show up in homeCore without
you listing them.

## Before you start

- You need an ISY994i, eisy or Polisy on your network, with a fixed address.
- The controller's firmware must offer the WebSocket subscription interface.
  Universal Devices added it in firmware 4.2.3.
- You need the username and password of an account that can use the REST
  interface. That's the login you use for the ISY Admin Console, usually
  `admin`. Don't leave it on the factory `admin` / `admin` password.
- homeCore must reach the controller on port 80, or 443 if you turn on HTTPS.

## Install and set up

1. Install ISY from **Settings › Plugins › Catalog**.
2. Open **Settings › Plugins › ISY / IoX** and fill in the Controller section:
   the address (for example `192.168.1.50`), the port, and the login.
3. Save. homeCore writes `config/plugins/plugin.isy.toml` and restarts the
   plugin.

On start, the plugin fetches the node list (`/rest/nodes`) and every node's
current values (`/rest/status`). It registers each enabled node and scene,
then subscribes to the event stream at `/rest/subscribe` for live updates.
Disabled nodes are skipped, and a node removed from the controller is removed
from homeCore the next time the plugin starts or reconnects.

## Connection

If the controller drops the connection or can't be reached, the plugin marks
every ISY device unavailable, raises `controller_unreachable`, and reconnects
on its own. It waits 2 seconds, then doubles the wait up to 60 seconds. Once a
connection has stayed up for 60 seconds, the wait goes back to 2 seconds. A
reconnect loads the node list and every node's values again, so each device's
state is current, and then clears the notice. Commands sent while the
controller is offline are dropped, with a line in the log.

The plugin also watches for a connection that stays open but goes quiet. The
ISY sends a heartbeat on the event stream and says how long until the next
one. If nothing arrives for three heartbeat intervals (never less than 60
seconds or more than 15 minutes), or for 5 minutes before the first heartbeat
says the interval, the plugin treats the connection as dropped and reconnects
as above.

A refused login is different, because retrying the same username and password
won't help. The plugin raises `auth_refused`, logs why, and exits with an
error. homeCore restarts it with its usual backoff, and the notice clears once
a login succeeds.

## Settings

| Setting | Key | Default | What it does |
|---|---|---|---|
| Address | `isy.host` | none | IP address or name of the controller. With none set, the plugin raises `not_configured`. |
| Port | `isy.port` | `80` | Use `443` when HTTPS is on. |
| Use HTTPS | `isy.tls` | off | Connects over HTTPS and WSS. |
| Username | `isy.username` | `admin` | An account with REST access. |
| Password | `isy.password` | none | Its password. Required when a username is set. |

With HTTPS on, the plugin skips certificate checks, because ISY controllers
ship with a self-signed certificate. The link is encrypted, but the plugin
can't prove it's talking to your controller.

The Devices section lists every node read from the controller. Names come from
the ISY. Edit one there to change what homeCore calls it, and assign it a room.

The Logging section sets the log level, what gets forwarded to homeCore, and
file rotation.

If you edit the file by hand, it looks like this:

```toml
[isy]
host     = "192.168.1.50"
port     = 80
username = "admin"
password = ""
tls      = false
```

## Devices

A device's ID is the ISY node address in lowercase, with spaces and colons
turned into underscores, after `isy_`. Scenes (ISY groups) use the same rule
with the scene's address.

```
isy_13_a6_99_1         Insteon address "13 A6 99 1"
isy_00_3c_89_ab_00_00  address "00:3C:89:AB:00:00"
```

The plugin picks each device's type from its ISY category, type code and the
unit of measure (UOM) of its main value:

| ISY device | homeCore type |
|---|---|
| Insteon dimmers (category 1, UOM 100 or 51) | `light` |
| Relays, switches and outlet modules (UOM 78) | `switch` |
| Contact, motion and leak sensors | `contact_sensor`, `motion_sensor`, `water_sensor` |
| Binary sensors it can't classify further | `binary_sensor` |
| Temperature, humidity, power and other readings | `sensor` |
| Locks (UOM 11) | `lock` |
| Garage doors (UOM 97) and motors (category 14) | `cover` |
| FanLinc (type 1.46) | `fan` |
| Thermostats (category 5) | `thermostat` |
| ISY scenes | `scene` |

A node that matches none of these is published as a `switch`.

### What each device reports and takes

Names and units follow homeCore's shared device vocabulary. The plugin
converts from the ISY's scales using the UOM and precision the ISY sends with
each value.

| Type | Reports | Takes |
|---|---|---|
| `light` | `on`, `brightness_pct` (0 to 100, %) | `on`, `brightness_pct` |
| `switch` | `on` | `on` |
| `scene` | `on` | `on` |
| `contact_sensor` | `open` | nothing |
| `motion_sensor` | `motion` | nothing |
| `water_sensor` | `water_detected` | nothing |
| `binary_sensor` | `on`, and `device_class` when known | nothing |
| `sensor` | one reading (see below) | nothing |
| `lock` | `locked` | `locked` |
| `cover` | `position` (0 to 100, % open) | `position` |
| `fan` | `on`, `speed`, `speed_pct` (%) | `on`, `speed`, `speed_pct` |
| `thermostat` | `temperature` (°C), `humidity` (%), `hvac_action`, `hvac_mode`, `heat_setpoint` and `cool_setpoint` (°C), `fan_mode` | `hvac_mode`, `heat_setpoint`, `cool_setpoint`, `fan_mode` |

The values:

- Fan `speed` is `off`, `low`, `medium` or `high`.
- `hvac_action` is `idle`, `heating`, `cooling` or `fan`.
- `hvac_mode` is `off`, `heat`, `cool`, `auto` or `fan_only`.
- `fan_mode` is `auto` or `on`.

Every command is an attribute write. ISY devices have no actions.

```json
{"on": true}
{"brightness_pct": 75}
{"speed": "medium"}
{"locked": true}
{"position": 0}
{"hvac_mode": "heat", "heat_setpoint": 20}
```

From the API, send these to `PATCH /api/v1/devices/<id>/state`:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/isy_13_a6_99_1/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brightness_pct": 75}'
```

### How values are converted

Levels: UOM 51 is already a percentage. UOM 100 (Insteon) runs 0 to 255, and
the plugin converts it as `round(raw × 100 / 255)`, with a minimum of 1% when
the raw value is above zero, so a lit light never reports 0%. `{"on": true}`
on a light goes back to the last level the device reported. Before any level
has been seen, it sends a plain on, which an Insteon device takes to its
configured on-level. `brightness_pct: 0` is off.

Fans: `{"on": true}` goes back to the last speed, or medium before one has
been seen.

Covers: a garage door (UOM 97) only opens or closes. Any `position` above 0
opens it, and 0 closes it. It reports only 0 or 100.

Leak sensors: Insteon leak sensors report on when dry. The plugin inverts
that, so `water_detected` is `true` when there's water.

Temperatures are always published in °C. On the ISY side, UOM 4 is °C, 17 is
°F and 101 is half-degrees in the thermostat's own unit. A setpoint is written
back in the thermostat's own unit and precision, so 20 °C becomes `68` on a
whole-degree °F thermostat and `136` on a half-degree one. The app shows °F to
anyone who prefers it.

A generic sensor publishes one reading under the shared name for its UOM:

| UOM | Attribute | Unit |
|---|---|---|
| 4, 17, 26 | `temperature` | °C |
| 22 | `humidity` | % |
| 36 | `illuminance` | lux |
| 73, 30 | `power_w` | W |
| 33, 119 | `energy_kwh` | kWh |
| 72, 43 | `voltage` | V |
| 1, 41 | `current_a` | A |
| 54 | `co2` | ppm |
| 118, 117, 31, 23 | `pressure` | hPa |
| 40, 49, 48, 32 | `wind_speed` | m/s |
| 71 | `uv_index` | none |
| anything else | `value` | the ISY's own unit |

Commands still accept the old names `target_temp_heat`, `target_temp_cool`
and a cover's `state: open|closed`, but the plugin never publishes them. The
0 to 255 `brightness` is no longer accepted.

## Actions

The plugin declares no plugin actions.

## Alerts

The plugin raises no device alerts. It shows these notices on its own page:

| Code | Level | Meaning |
|---|---|---|
| `not_configured` | error | No controller address is set. |
| `controller_unreachable` | error | The controller isn't answering, or its event stream has gone quiet. Every device it serves is marked unavailable while the plugin reconnects. It clears once the plugin loads the node list again. |
| `auth_refused` | error | The controller refused the username and password. The plugin exits and homeCore restarts it. It clears once a login succeeds. |

## Troubleshooting

| Problem | What to check |
|---|---|
| `controller_unreachable` | The controller is powered and on the network, and the address and port are right. |
| `auth_refused`, or the login fails | Use the ISY Admin Console username and password. The account needs REST access. |
| TLS errors | Turn Use HTTPS off unless you turned on HTTPS on the controller. |
| A device or scene is missing | Only enabled nodes are registered. Check that it's enabled on the ISY, then restart the plugin. |
| Devices keep going unavailable | Look in the plugin's log for "Lost the connection" or "Nothing from the ISY WebSocket". The second means the event stream went quiet, which points at the controller or the network between them. |

The notice says how long the plugin will wait before it tries again. REST
requests time out after 15 seconds. When the event stream connects, the log
says how long a quiet stream may last before the plugin treats it as dropped.

For more detail in the log, set the Logging level to `hc_isy=debug`. That
logs each API response and WebSocket event.

## Known limits

- New nodes and scenes appear when the plugin starts or reconnects. Restart
  it after you add one on the controller.
- A scene's `on` is `false` at startup and then follows the scene's events.
  It isn't a reading of whether every device in the scene is on.
- ISY programs and variables aren't exposed.
