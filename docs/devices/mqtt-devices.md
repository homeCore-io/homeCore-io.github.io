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
matching **ecosystem**, and each one becomes a homeCore device you can put in
a room, see in the app and use in automations. All of it is done in
**Settings › Devices over MQTT**, and every change there applies at once:
nothing restarts.

An ecosystem's **profile** translates the device's own topics and payloads
into homeCore's names (`on`, `brightness_pct`, `temperature`, ...) and
homeCore's commands back into the device's. Profiles come with homeCore for:

| Ecosystem | For |
|---|---|
| Tasmota | Relays, dual relays, dimmers, power monitoring and sensors |
| Shelly (original firmware) | Original-firmware Shelly devices (`shellies/` topics) |
| Shelly Plus, Pro and Mini | Gen2 and Gen3 Shelly devices |
| Zigbee2MQTT | Everything Zigbee2MQTT bridges |

For anything else, [add an ecosystem of your own](#adding-an-ecosystem-of-your-own).

## 1. Let the devices reach the broker

The devices connect to homeCore's MQTT broker, so it has to listen on the
network. The page's first card says whether it does; its **Open it** link
leads to **Open the broker to the network** (homeCore restarts once to do
that). From then on the broker asks every
connection for a login. If you already use plugin runtimes, it is open.

Give each device its own login: open its ecosystem, choose **Logins**, then
**Add a login**. homeCore makes the password and shows it once, with the
host, port and user to type into the device's MQTT settings (in Tasmota:
Configuration › MQTT). A login works the moment it's made. **New password**
or **Remove** shuts the old one out; a device connected at that moment stays
connected until it drops. Zigbee2MQTT needs one login for itself, not one per
Zigbee device. Shelly Gen2 and Gen3 devices connect on the MQTT v5 port,
`v5_port` (1884 by default).

Logins are kept in `logins.toml` in the profiles folder, each password
hashed. Logins in `homecore.toml`'s `[[broker.clients]]` still work as well;
see [`[broker]`](../getting-started/configuration.md#broker). homeCore's own
broker checks each login, not which topics it uses; an external Mosquitto
does that.

## 2. Turn on the ecosystem

The ecosystems homeCore has are listed, off, under **Ecosystems**. **Turn on**
says what's ready and lists the devices it would take in from what the broker
carries now. Turned on, those devices appear at once; the rest appear the
first time they report, each with an ID made from the ecosystem's prefix and
the device's own name: `tasmota_kitchen_plug`,
`shelly_shellyplus1-a8032ab12345_switch_0`, `zigbee_living_room_light`.

Turning one on copies its profile into the profiles folder, `config/profiles/`
beside `homecore.toml` (`homecore-data/config/profiles/` in the Docker setup),
with the device type catalog (`device-types.toml`) and any transforms it uses.
**Turn off** on its page keeps the profile, changes and all, to turn on again;
its devices stay and stop being updated.

**Heard, but not taken in** lists the topics on the broker no ecosystem took in
over the last hour, and which ecosystem would: a way to see what you have
before turning anything on.

## 3. Say what each device is

A device shows its controls in the app once homeCore knows what it is. The
Tasmota and Shelly profiles already say it for the topics that settle it: a
relay is a `switch`, a Shelly roller a `cover`, a Shelly light a `light`.
Anything else arrives with its readings and no controls until you say.

The page says how many devices have no controls; open their ecosystem to see
each one with what it reports and what it is.

- **Zigbee2MQTT says what most of its devices are**, in the device list it
  publishes. Its page offers those suggestions, with each device's
  Zigbee2MQTT name, to use all at once.
- **Select several** to give them one type.
- **Open a device** to choose its type, see what that type gives it in the
  app ("On and off, brightness and warmth"), and name it. **Nothing** takes
  the type off again.

These are kept in the ecosystem's profile, by device ID:

```toml
[ecosystem.devices.zigbee_living_room_light]
device_type = "light"
name        = "Living room light"
```

The types are those in `device-types.toml`. The `name` is what homeCore shows;
a rename in the app is kept separately and still wins.

## Editing a profile

An ecosystem's **Profile** tab is its file. homeCore checks it as you type and
says where it doesn't load; **Try it** shows what it would make of a message
(one the broker carried, or one you type) before you save. Only a profile that
loads is saved, and it applies at once. A profile that stopped loading is
listed with its error and a **Fix it** button. If you edit the files by hand
instead, **Read the folder again** on the page picks the change up.

A copy of a profile homeCore ships is marked **Differs from homeCore's** when it
no longer matches the one this homeCore ships (the devices it names aside):
homeCore's may have been fixed since you copied it. Its Profile tab shows the
two side by side, and **Take homeCore's, keeping your devices** replaces your
copy while keeping the types and names you gave its devices.

The [topic mapper reference](../development/topic-mapper.md) has every profile
setting.

## Adding an ecosystem of your own

**Add an ecosystem** drafts a profile, from a topic the broker carried (it
guesses which part of the topic names the device, and shows how many devices
match), from a commented template, or from a profile someone shared. It opens
in the editor; saved, it is on, and takes in at once what the broker already
carried for it. A heard topic's **Write a profile** starts from that topic.

## Removing a device

Delete it in **Settings › Devices**. It stays deleted even though it keeps
reporting, and is listed under **Deleted** there to bring back. To stop it
reporting at all, turn off MQTT on the device or remove it from its hub.

## When something's wrong

| What you see | Why | What to do |
|---|---|---|
| The device never appears | It isn't reaching the broker, or its topics don't match the profile | Check its MQTT settings and login. **Heard, but not taken in** lists what the broker carries that no ecosystem matched, and which would. With `RUST_LOG=info,hc_core::state_bridge=debug`, homeCore logs every topic no profile matched. |
| The device shows readings but no controls | homeCore doesn't know what it is | Say what it is (step 3); the page also says when the type catalog is missing. |
| A device can't connect | The broker asks for a login it doesn't have, or the password changed | Give it a login (step 1), or a **New password**, and type it into the device. |
| A Tasmota dimmer's commands do nothing | The transform isn't loaded | Turn Tasmota off and on again, which adds it, or copy `custom-transforms.rhai` from `config/profiles/examples` into the profiles folder. |
| A dual-relay Tasmota has relays with no commands | A profile copied before v0.1.126 named relay devices without the `tasmota_` prefix | On its Profile tab, **Take homeCore's, keeping your devices**, then delete the old `<name>_relay1` devices. |
