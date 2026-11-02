---
id: nuheat
title: NuHeat
sidebar_label: NuHeat
sidebar_position: 14
---

# NuHeat (`hc-nuheat`)

NuHeat Signature floor-heating thermostats, through NuHeat's cloud. Each
thermostat on your NuHeat account is a homeCore thermostat: its temperature
(the floor's or the room's, as the thermostat is set up), its target, whether it is heating, and whether it follows its
own schedule. You can set the target, hold it for a while or indefinitely,
and hand it back to the schedule.

## Signing in

Open the plugin's page (Settings › Plugins › NuHeat) and press **Link NuHeat
account**. You sign in on NuHeat's own site with the account the NuHeat app
uses; homeCore never sees your password. NuHeat then sends you back to
homeCore through `homecore.io/oauth/nuheat/callback`, a page that only
passes NuHeat's answer to your own homeCore. Nothing needs setting up first:
the plugin signs in as homeCore's NuHeat client, which NuHeat registered for
everyone.

If homeCore is on your home network, the page sends you straight back. If
you reach homeCore at an internet address, it shows that address and asks
before sending you there. If you sign in somewhere that can't reach homeCore
at all, use **Can't come back to this page from NuHeat?** on the plugin's
page: NuHeat opens in a new tab, lands on an address that won't load, and you
paste that address back.

**A sign-in lasts while homeCore keeps running.** NuHeat ends one only if it
goes unused for 15 days, so sign in again if homeCore was off that long.

## On Home

Each thermostat is a device, `nuheat_<serial>`, with the app's own card: the
temperature and the target ("70.7°F · 75.2°F"), and in its details a
target slider, **Resume the schedule**, **Hold a temperature** (for up to 23
hours) and **Hold indefinitely**. A new target on a thermostat that is on a
permanent hold stays permanent; otherwise it holds for a while and the
schedule takes over again (or permanently, if **A new target holds
indefinitely** is on).

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

Temperatures are °C in homeCore and shown in each person's own units.

## Alerts

A thermostat that reports a fault, most often a sensor, raises a
**Thermostat fault** alert (an error, on by default), in the thermostat's own
words. It clears when the fault does.

## Settings

| Setting | |
|---|---|
| Check every | how often to ask NuHeat (default 2 minutes) |
| Only these serial numbers | leave empty for every thermostat on the account |
| Area | where the thermostats land in homeCore |
| A new target holds indefinitely | off: a new target holds for a while |
| Hold for | how long a hold lasts when nothing says (1 to 23 hours) |
| Never go above / below | limits for the floor covering. **Worth setting:** NuHeat will heat a floor to 30 °C / 86 °F, and engineered hardwood is usually rated to about 27 °C / 80 °F |
| Your own client id | only if NuHeat issued you a client of your own |

## Not covered

NuHeat's API doesn't allow editing a schedule (its schedule endpoints are
switched off), so schedules stay in the NuHeat app. Energy use and away mode
across several thermostats are not offered yet.
