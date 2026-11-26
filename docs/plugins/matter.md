---
id: matter
title: Matter
sidebar_label: Matter
sidebar_position: 18
---

import PluginFacts from '@site/src/components/PluginFacts';

# Matter (`hc-matter`)

<PluginFacts
  mark="MT"
  kind="hub"
  summary="Makes homeCore a Matter controller: lights, plugs, locks, blinds, thermostats, fans and sensors from any maker, over Wi-Fi, Ethernet or Thread."
  version="0.1.3"
  runs="In a Node.js plugin runtime"
  talks="Your network (Matter)"
  account="None"
  devices={["light", "switch", "lock", "cover", "thermostat", "fan", "contact_sensor", "occupancy_sensor", "temperature_sensor", "water_sensor"]}
  source="https://github.com/homeCore-io/hc-matter"
  setup="#install-and-set-up"
/>

The Matter plugin makes homeCore a Matter controller of its own. A device can
be in homeCore and in Apple Home, Google Home or Alexa at once: Matter lets a
device be paired with several controllers. Share it from the app it is in, and
pair the code that app shows here.

It runs the Open Home Foundation's
[Matter server](https://github.com/matter-js/matterjs-server), the one Home
Assistant uses, and turns what it reports into homeCore devices.

## Before you start

- **homeCore v0.1.124 or later**, with a
  [Node.js plugin runtime](runtimes.md#a-runtime-for-nodejs-plugins).
- **The runtime uses the host's network** (`network_mode: host`), on a host
  with IPv6, on the same network as your Matter devices. Matter finds devices
  over IPv6 multicast, so a runtime in a bridged container network can't reach
  any of them. The runtime's compose file in the docker repository is set up
  this way.
- **Thread devices** also need a Thread border router on that network: an
  Apple TV or HomePod, a Google Nest hub, or any other.

## Install and set up

1. In the app, open **Settings › Plugins › Catalog**, find **Matter** and
   install it. homeCore places it on your Node.js runtime and gives it the
   Node.js it was built for.
2. Open its page (**Settings › Plugins › Matter**). It says when Matter is
   running.

Nothing else is needed for devices that are already on your network.

## Pairing a device

On the plugin's page, enter the device's setup code and press **Pair**. The
code is the text under its QR code (`MT:…`), or its 11- or 21-digit code.
Progress shows as it goes, then the homeCore devices it became.

Pairing is over the network:

- **A device already in another app:** share it there first. In Apple Home
  that's *Turn On Pairing Mode*, in Google Home *Linked Matter apps &
  services*, and in Alexa *Other assistants and apps*. Then pair the new code
  the app shows. It stays in that app too.
- **A Wi-Fi or Ethernet device already on your network:** pair its own code.
- **A new Thread or Wi-Fi device that isn't on any network yet:** first
  set the network it should join, under *Networks for new devices* on the
  page: your Wi-Fi name and password, or your Thread network's dataset from
  your border router.
- **A brand-new device that has to be set up over Bluetooth** can't be paired
  here yet. Set it up in its own app first, then share it.

## Looking after devices

The page lists each paired Matter device: whether it answers, what it is, its
firmware, and the homeCore devices it became (press one to open it). For each:

- **Share** opens it to another app for 15 minutes and shows a QR code and a
  manual code to add it there.
- **Shared with** lists the controllers it is paired with, and removes any of
  them but homeCore.
- **Check firmware** asks whether newer firmware is published, and installs it
  if you say so.
- **Read again** asks the device what it has, after its firmware changed.
- **Remove** takes it out of homeCore and off homeCore's controller. Other
  apps keep it.

Each of these is also a plugin action, for automations, the Assistant and the
API; the plugin's README lists them. Pairing, sharing, removing, firmware and
network settings are for admins only, on the page and through the API.

## Sharing homeCore devices with other apps

The other way round: homeCore's own devices, from any plugin, shown to Apple
Home, Google Home, Alexa or another Matter app, as one Matter bridge called
"homeCore". Lights, switches, locks, blinds and covers, thermostats, fans,
and contact, occupancy, temperature, humidity, leak and light sensors.

1. On the plugin's page, under **Share with other apps**, press **Turn on**.
2. In the other app, add a Matter device and scan the code the page shows (or
   type its number). The bridge is not a certified Matter product, so the app
   may warn you before adding it. Google Home may refuse an uncertified device
   unless it is set up in Google's developer console.
3. Back on the page, press **Share** next to each device the other app should
   have. Nothing is shared until you choose it, and a device added to homeCore
   later stays private until you do.

Locks, and covers that are garage doors, gates or doors, can be shared too,
after a warning: anyone using the other app, and its voice assistant, could
then unlock or open them without homeCore asking.

Changes go both ways: what you do in the other app happens in homeCore (and
its automations see it), and what happens in homeCore shows in the other app.
A thermostat is shown as it is in homeCore, with only the modes it can take.
To add the bridge to a second app, share it from the first, as for any Matter
device. **Reset** unpairs it from every app and gives it a new code; the
devices you chose stay chosen.

Devices that came from Matter in the first place aren't offered: share them
from their own app instead.

## Backing up the pairings

Every pairing is kept on the runtime, not in homeCore's own backup: lose the
runtime's data, and every device must be paired again, and the bridge in every
app. On the plugin's page, **Download a backup** saves one small file; keep it
off the house's server. **Restore from a backup** puts those pairings back (what
was there is kept aside) and restarts the plugin. The plugin's card says when
the pairings have never been backed up, or some are newer than the last backup.

## Devices

Each part of a Matter device that is a device of its own becomes one homeCore
device: a two-gang switch is two, a sensor that measures temperature and
humidity is two. Devices behind a Matter bridge (a Hue bridge, an IKEA hub)
each become their own. They are named as the device or the bridge names them;
rename them and put them in rooms in homeCore.

A device keeps its homeCore id if it is paired again, after a reset for
instance, so its name, room, history and automations come back with it.

| Matter device | homeCore type | Reports | Takes |
|---|---|---|---|
| Lights (on/off, dimmable, white, colour); dimmable plugs | `light` | on, brightness, colour temperature, colour | the same, a fade time, toggle |
| Plugs and wall switches | `switch` | on | on, toggle |
| Door locks | `lock` | locked, jammed, door open (with a door sensor) | locked |
| Blinds and shades | `cover` | position, tilt | the same; open, close, stop |
| Thermostats | `thermostat` | temperature, heat and cool setpoints, mode, what it is doing, fan | setpoints, mode, fan |
| Fans | `fan` | on, speed | the same |
| Contact, occupancy, leak and rain sensors | `contact_sensor`, `occupancy_sensor`, `water_sensor`, `rain_sensor` | open, occupied, water, rain | |
| Smoke and CO alarms | `smoke_alarm` | smoke, carbon monoxide (raising homeCore's critical alerts), their levels, faults | a self-test |
| Air quality sensors | `air_quality_sensor` | air quality, PM2.5, PM10, CO₂ | |
| Buttons and remotes | `remote` | presses, holds and double presses per button, for button triggers | |
| Temperature, humidity, light and pressure sensors | `temperature_sensor`, `humidity_sensor`, `light_sensor`, `pressure_sensor` | the reading | |

Where a device has them, it also reports its battery, power and energy, and
CO₂. Most offer **Identify**, which makes the device blink or beep. Device
kinds not in the table still appear, with what they report.

## Settings

The plugin's settings form in the app (Controller, Network, Advanced) edits
its config file, under `[matter]`; the plugin restarts when it is saved:

| Setting | Default | |
|---|---|---|
| `fabric_label` | `homeCore` | How homeCore appears in other apps' lists of what a device is paired with |
| `firmware_updates` | on | Check for, and offer, device firmware updates |
| `thread_diagnostics` | on | Find Thread border routers and read their diagnostics |
| `primary_interface` | | The network interface to use, when the host has several |
| `log_level` | `info` | How much the Matter server logs |
| `dcl_offline` | off | Never look certificates up online; use only those bundled |
| `allow_test_devices` | off | Accept development kits with Matter's test certificates. A product sold as Matter certified never needs it |

The fabric (the keys every paired device trusts) is kept with the plugin's
data on the runtime, and survives updates. Back the runtime's data up: losing
it means pairing every device again.

## Alerts

**Firmware update available** (off until you turn it on, in the plugin's
alert settings): a newer firmware is published for a paired Matter device. Its
**Update…** button installs it after a confirm. The plugin checks twice a
day; the alert clears once the device runs that version.

## When something is wrong

The plugin's card and page say what they know:

- **"The Matter server keeps stopping"**: see the plugin's log. Most often the
  runtime isn't on the host's network.
- **"Some devices are not answering"**: check they have power. Thread devices
  also need a border router that is on.
- **"No device with that code answered"** when pairing: the device isn't in
  pairing mode, or isn't on the same network. A code from another app's share
  lasts 15 minutes or so; share it again for a new one.
- **"The device's certificate is not one Matter trusts"**: a certified product
  passes. A development kit needs `allow_test_devices`.
