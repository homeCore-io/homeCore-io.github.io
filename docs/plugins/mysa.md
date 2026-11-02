---
id: mysa
title: Mysa
sidebar_label: Mysa
sidebar_position: 15
---

# Mysa (`hc-mysa`)

This plugin connects Mysa thermostats through Mysa's cloud. Each thermostat on
your Mysa account becomes a homeCore thermostat that reports its temperature,
humidity, mode and targets. You can change the mode and the targets, and use
whichever of fan, swing, keypad lock and display brightness your model has.
Each thermostat gets the controls Mysa says its model has. It has been tried
on Mysa baseboard thermostats.

## Signing in

Open the plugin's page (Settings › Plugins › Mysa) and press **Link Mysa
account**. Mysa opens in a new tab. You sign in on Mysa's own site with the
account the Mysa app uses, so homeCore never sees your password. Mysa's
consent page names the app "homeCore", published by Simplex Technology;
choose **Allow**. There is nothing to set up first: the plugin signs in as
homeCore's Mysa client, which Mysa registered for everyone to use.

If you opened the plugin's page at a home-network address, Mysa sends you
back through `homecore.io/oauth/mysa/callback`, a page that only passes Mysa's
answer on to your own homeCore, and you land back on the plugin's page,
linked. A home-network address is localhost, a private IPv4 address, an IPv6
unique local address, or a name ending in `.local`, `.home.arpa` or
`.internal`. The page sends Mysa's answer to no other address.

If you reach homeCore any other way (a public name, a VPN address), you sign
in by pasting instead. Mysa's tab ends on an address starting
`http://127.0.0.1:8127/mysa/callback` that won't load. Copy the whole address
from the address bar and paste it into the plugin's page within a minute,
since Mysa's code expires 60 seconds after it's issued.

**A sign-in lasts 30 days.** Mysa ends it 30 days after you sign in, however
much it's used. The plugin's page shows the date. Five days before it, the
plugin raises a reminder. Press **Sign in again** on the plugin's page to start
another 30 days.

**One homeCore per Mysa account.** Only the newest sign-in works, so two
homeCores linked to the same Mysa account sign each other out.

## On Home

Each thermostat is a device named `mysa_<id>` and uses the app's standard
thermostat card and details. Mysa accepts only certain targets for each
thermostat (on a baseboard, 5 to 30 °C in half degrees). The plugin moves
every target onto that list before sending it, and each press of + or −
moves at least one step. Setting a heat target switches the thermostat to
heat, and a cool target to cool, as the Mysa app does.

Thermostats with a schedule also have **Hold until the next change** and
**Follow the schedule**.

## Readings

| Reading | |
|---|---|
| `temperature` | the room temperature, °C |
| `humidity` | %, where the thermostat measures it |
| `hvac_mode` | `off`, `heat`, `cool`, `auto`, `dry` or `fan_only`, as the model allows |
| `heat_setpoint`, `cool_setpoint` | the targets, °C; in auto, the band |
| `fan_mode`, `fan_speed` | where the model has a fan |
| `swing_vertical`, `swing_horizontal` | where the model has them |
| `keypad_lockout` | whether the buttons on the thermostat are locked |
| `display_brightness`, `display_idle_brightness` | where the model has them |
| `model` | Mysa's model name, such as `BB-V2-0` |

Mysa doesn't report whether a thermostat is heating at this moment or whether
it is holding, so the card shows neither.

homeCore stores temperatures in °C, and the app shows each person their own
units.

## How often it checks

Mysa has no way to tell homeCore about a change, so the plugin asks. One call
a minute reads every thermostat on the account, which is the rate Mysa
expects. Changes you make in homeCore go out straight away, at most one every
1.5 seconds to the same thermostat. If you
change many thermostats at once, the plugin spreads the changes over the
minute to stay within Mysa's limits instead of refusing them. If Mysa asks it
to slow down, it waits as long as Mysa says and shows that on the plugin's
page.

## Settings

| Setting | |
|---|---|
| Check every | how often to ask Mysa (default 1 minute, at least 30 seconds) |
| Only these Mysa device ids | leave empty for every thermostat on the account |
| Area | where the thermostats land in homeCore |
| Your own client id | only if Mysa issued you a client of your own |

## Not covered

Schedules stay in the Mysa app: the plugin can hold a target and hand control
back to the schedule, but it doesn't edit schedules. Energy use isn't shown
yet.
