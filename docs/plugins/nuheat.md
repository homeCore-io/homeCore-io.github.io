---
id: nuheat
title: NuHeat
sidebar_label: NuHeat
sidebar_position: 14
---

# NuHeat (`hc-nuheat`)

This plugin connects NuHeat Signature floor-heating thermostats through
NuHeat's cloud. Each thermostat on your NuHeat account becomes a homeCore
thermostat that reports its temperature (the floor's or the room's, depending
on how the thermostat is set up), its target, whether it is heating, and
whether it is following its own schedule. You can set the target, hold it for
a while or indefinitely, and hand control back to the schedule.

## Signing in

Open the plugin's page (Settings › Plugins › NuHeat) and press **Link NuHeat
account**. You sign in on NuHeat's own site with the account the NuHeat app
uses, so homeCore never sees your password. NuHeat then sends you back to
homeCore through `homecore.io/oauth/nuheat/callback`, a page that only passes
NuHeat's answer on to your own homeCore. There is nothing to set up first:
the plugin signs in as homeCore's NuHeat client, which NuHeat registered for
everyone to use.

If you opened the plugin's page at a home-network address (localhost, a
private IPv4 address, an IPv6 unique local address, or a name ending in
`.local`, `.home.arpa` or `.internal`), the page sends you straight back. It
sends NuHeat's answer to no other address. If you reach homeCore any other way
(a public name, a VPN address), use **Can't come back to this page from
NuHeat?** on the plugin's page. NuHeat opens in a new tab and ends on an address that won't
load; copy that address and paste it back into the plugin's page.

A sign-in lasts as long as homeCore keeps running. NuHeat only ends one after
15 days of no use, so sign in again if homeCore has been off that long.

## On Home

Each thermostat is a device named `nuheat_<serial>` and uses the app's
standard thermostat card, which shows the temperature and the target
("70.7°F · 75.2°F"). Its details have a target slider, **Resume the
schedule**, **Hold a temperature** (for up to 23 hours) and **Hold
indefinitely**. A new target on a thermostat that is already on a permanent
hold stays permanent. Otherwise the new target holds for a while and then the
schedule takes over again, unless **A new target holds indefinitely** is
turned on.

## Readings

| Reading | |
|---|---|
| `temperature` | the thermostat's reading (floor or air, as it is set up), °C |
| `setpoint` | the target, °C |
| `hvac_action` | `heating` or `idle` |
| `hvac_mode` | always `heat` |
| `schedule_mode` | `auto` (its schedule), `hold` (for now) or `permanent_hold` |
| `hold_until` | when a temporary hold ends, in UTC |
| `error_state` | the thermostat's own fault, if any |

homeCore stores temperatures in °C, and the app shows each person their own
units.

## Alerts

When a thermostat reports a fault (most often a sensor), the plugin raises a
**Thermostat fault** alert in the thermostat's own words. It is an error and
is on by default. It clears when the fault does.

## Settings

| Setting | |
|---|---|
| Check every | how often to ask NuHeat (default 2 minutes) |
| Only these serial numbers | leave empty for every thermostat on the account |
| Area | where the thermostats land in homeCore |
| A new target holds indefinitely | off: a new target holds for a while |
| Hold for | how long a hold lasts when nothing says otherwise (1 to 23 hours) |
| Temperatures in this form | whether the limits below are typed in °C or °F |
| Never go above / below | limits for the floor covering. Worth setting: NuHeat will heat a floor to 30 °C / 86 °F, and engineered hardwood is usually rated to about 27 °C / 80 °F |
| Your own client id | only if NuHeat issued you a client of your own |

## Not covered

NuHeat's API doesn't allow schedule editing (its schedule endpoints are
switched off), so schedules stay in the NuHeat app. Energy use, and away mode
across several thermostats, aren't supported yet.
