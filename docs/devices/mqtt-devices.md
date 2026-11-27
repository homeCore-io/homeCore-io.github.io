---
id: mqtt-devices
title: Devices That Speak MQTT
sidebar_label: Devices that speak MQTT
sidebar_position: 5
description: Add Tasmota, Shelly and Zigbee2MQTT devices to homeCore through ecosystem profiles, with no plugin.
---

# Devices That Speak MQTT

Tasmota, Shelly and Zigbee2MQTT already talk MQTT. homeCore can take them in
directly, with no plugin: point them at homeCore's broker, turn on the
matching **ecosystem profile**, and each one becomes a homeCore device you can
put in a room, see in the app and use in automations.

A profile translates the device's own topics and payloads into homeCore's
names (`on`, `brightness_pct`, `temperature`, ...) and translates homeCore's
commands back into the device's. Profiles ship for:

| Profile | For |
|---|---|
| `tasmota.toml` | Tasmota relays, dual relays, dimmers, power monitoring and sensors |
| `shelly-gen1.toml` | Original-firmware Shelly devices (`shellies/` topics) |
| `shelly-gen2.toml` | Shelly Plus, Pro and Mini (Gen2 and Gen3) |
| `zigbee2mqtt.toml` | Everything Zigbee2MQTT bridges |

For other firmware you can write a profile of your own; see the
[topic mapper reference](../development/topic-mapper.md).

## 1. Let the devices reach the broker

The devices connect to homeCore's MQTT broker, so it has to listen on the
network, and each device needs a login. In `homecore.toml`:

```toml
[broker]
host = "0.0.0.0"
port = 1883

[[broker.clients]]
id       = "internal.core"          # homeCore's own login, needed once you add any
password = "a-long-random-password"
allow_pub = ["homecore/#"]
allow_sub = ["homecore/#"]

[[broker.clients]]
id       = "tasmota-kitchen-plug"    # the device's MQTT client ID or user
password = "another-long-password"
allow_pub = ["stat/kitchen_plug/#", "tele/kitchen_plug/#"]
allow_sub = ["cmnd/kitchen_plug/#"]
```

Then set the same host, port, user and password in each device's MQTT
settings. Shelly Gen2 and Gen3 devices connect on the MQTT v5 port,
`v5_port` (1884 by default). Restart homeCore after changing `homecore.toml`. If you already use
plugin runtimes, the broker is already open; just add the logins. See
[`[broker]`](../getting-started/configuration.md#broker) for the details,
including why the embedded broker doesn't enforce `allow_pub` and
`allow_sub` (an external Mosquitto does).

Zigbee2MQTT needs one login for itself, not one per Zigbee device.

## 2. Turn on the profile

Profiles live in the profiles folder, `config/profiles/` beside
`homecore.toml` (`homecore-data/config/profiles/` in the Docker setup). The
shipped copies are in `config/profiles/examples/`, in a release archive and
in the homeCore repository; homeCore doesn't load anything in `examples/`.
The Docker image doesn't include them: take them from the
[repository](https://github.com/homeCore-io/homeCore/tree/main/config/profiles/examples).

Copy the profile you need and the device type catalog:

```bash
cp config/profiles/examples/tasmota.toml      config/profiles/
cp config/profiles/examples/device-types.toml config/profiles/
# Tasmota's dimmer and relay commands use a transform:
cp config/profiles/examples/custom-transforms.rhai config/profiles/
```

The catalog matters: it is where a device's controls come from (see the next
step). If you leave it out, **Settings › Devices over MQTT** offers to add it.
Restart homeCore. Its log lists each profile it loaded, and says so if
a profile names a device type the catalog doesn't have.

Each device appears the first time it reports, with an ID made from the
profile's prefix and the device's own name: `tasmota_kitchen_plug`,
`shelly_shellyplus1-a8032ab12345_switch_0`, `zigbee_living_room_light`.

## 3. Say what each device is

A device shows its controls in the app once homeCore knows what it is. The
Tasmota and Shelly profiles already say it for the topics that settle it: a
relay is a `switch`, a Shelly roller a `cover`, a Shelly light a `light`.
Anything else arrives with its readings and no controls until you say.

Do it in **Settings › Devices over MQTT**. The page says how many devices
have no controls; open their ecosystem to see each one with what it reports
and what it is.

- **Zigbee2MQTT says what most of its devices are**, in the device list it
  publishes. Its page offers those suggestions, with each device's
  Zigbee2MQTT name, to use all at once.
- **Select several** to give them one type.
- **Open a device** to choose its type, see what that type gives it in the
  app ("On and off, brightness and warmth"), and name it. **Nothing** takes
  the type off again.

Changes apply at once; nothing restarts. They are kept in your copy of the
profile, by device ID, where you can also write them by hand:

```toml
[ecosystem.devices.zigbee_living_room_light]
device_type = "light"
name        = "Living room light"
```

The types are those in `device-types.toml`. The `name` is what homeCore shows;
a rename in the app is kept separately and still wins. After editing a file by
hand, restart homeCore.

## Removing a device

Delete it in **Settings › Devices**. It stays deleted even though it keeps
reporting, and is listed under **Deleted** there to bring back. To stop it
reporting at all, turn off MQTT on the device or remove it from its hub.

## When something's wrong

| What you see | Why | What to do |
|---|---|---|
| The device never appears | It isn't reaching the broker, or its topics don't match the profile | Check its MQTT settings and login. **Heard, but not taken in** on Settings › Devices over MQTT lists what the broker carries that no ecosystem matched, and which shipped one would. With `RUST_LOG=info,hc_core::state_bridge=debug`, homeCore logs every topic no profile matched. |
| The device shows readings but no controls | homeCore doesn't know what it is | Say what it is in **Settings › Devices over MQTT** (step 3); the page also says when the type catalog is missing. |
| homeCore won't start after opening the broker | A broker on the network needs logins | Add the `[[broker.clients]]` entries in step 1. |
| A Tasmota dimmer's commands do nothing | The transform isn't loaded | Copy `custom-transforms.rhai` into the profiles folder; homeCore names a missing transform at startup. |
| A dual-relay Tasmota has relays with no commands | A profile copied before v0.1.126 named relay devices without the `tasmota_` prefix | Replace your copy of `tasmota.toml` and delete the old `<name>_relay1` devices. |

The [topic mapper reference](../development/topic-mapper.md) has every profile
setting, how to write your own, and more on debugging.
