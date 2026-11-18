---
id: nuheat
title: NuHeat
sidebar_label: NuHeat
sidebar_position: 14
---

import PluginFacts from '@site/src/components/PluginFacts';

# NuHeat (`hc-nuheat`)

<PluginFacts
  mark="Nu"
  kind="climate"
  summary="Connects NuHeat Signature floor heating thermostats to homeCore through NuHeat's cloud."
  version="0.1.3"
  runs="Under core (Rust)"
  talks="NuHeat's cloud"
  account="NuHeat account"
  devices={["thermostat"]}
  source="https://github.com/homeCore-io/homeCore/tree/develop/plugins/hc-nuheat"
  setup="#install-and-set-up"
/>

This plugin connects NuHeat Signature floor-heating thermostats through
NuHeat's cloud. A Signature talks only to NuHeat, so the plugin reads and
writes everything through NuHeat's API and checks it on a timer. Each
thermostat on your NuHeat account becomes a homeCore thermostat. It reports
its temperature (the floor's or the room's, depending on how the thermostat is
set up), its target, whether it is heating, and whether it is following its
own schedule. You can set the target, hold it for a few hours or
indefinitely, and hand control back to the schedule.

## Before you start

You need the NuHeat account that the NuHeat app uses, with your thermostats
already added to it. The machine running homeCore needs internet access to
reach NuHeat. Nothing on your network needs to be opened, and you don't need
to register anything with NuHeat: the plugin signs in as homeCore's NuHeat
client, which NuHeat registered for everyone to use.

## Install and set up

1. Install **Nuheat Signature** from Settings › Plugins › Catalog.
2. Open its page (Settings › Plugins › NuHeat) and press **Link NuHeat
   account**.
3. Sign in on NuHeat's own site. homeCore never sees your password.

NuHeat then sends your browser to `homecore.io/oauth/nuheat/callback`, a page
that passes NuHeat's answer back to your own homeCore and does nothing else.
This works only when you opened the plugin's page at a home-network address: localhost, a
private IPv4 address, an IPv6 unique local address, or a name ending in
`.local`, `.home.arpa` or `.internal`. It sends NuHeat's answer nowhere else.

If you reach homeCore some other way, such as a public name or a VPN address,
open **Can't come back to this page from NuHeat?** on the plugin's page and
press **Open NuHeat in a new tab**. After you sign in, that tab lands on an
address starting `http://127.0.0.1:8127/nuheat/callback` that won't load.
That is expected. Copy the whole address from the address bar, paste it into
the plugin's page and press **Link**.

The plugin finds every thermostat on the account on its next check. You can
limit it to some of them with **Only these serial numbers**.

A sign-in lasts as long as homeCore keeps running. NuHeat ends one only after
15 days without use, so you need to sign in again only if homeCore has been
off that long. The plugin keeps its sign-in in homeCore's own plugin state,
never in the config file, so restarts don't sign it out.

## Settings

All settings are in the generic form below the plugin's page. A normal setup
leaves the account section empty.

| Setting | Key | Default | What it does |
|---|---|---|---|
| Check every | `nuheat.poll_interval_secs` | 120 s | How often to ask NuHeat for every thermostat (30 to 3600 s). A floor changes temperature slowly, so this mostly decides how soon a change made in the NuHeat app shows up. |
| Only these serial numbers | `nuheat.only_serials` | empty | Leave empty for every thermostat on the account. |
| Area | `nuheat.area` | none | The area the thermostats land in. |
| A new target holds indefinitely | `nuheat.setpoint_holds_permanently` | off | Off: a new target holds for a while, then the schedule takes over. On: it holds until something changes it. Turn it on if you don't use the NuHeat schedule. |
| Hold for | `nuheat.default_hold_hours` | empty | How long a hold lasts when the command doesn't say (1 to 23 hours). Empty lets NuHeat resume at the next scheduled event. Hidden while the setting above is on. |
| Temperatures in this form | `nuheat.config_scale` | °C | Whether you type the two limits below in °C or °F. It changes nothing else. |
| Never go above | `nuheat.max_setpoint` | empty | The warmest target the plugin will send. Anything higher is held at this value. Empty means the thermostat's own maximum. |
| Never go below | `nuheat.min_setpoint` | empty | The coolest target the plugin will send. Empty means the thermostat's own minimum. |
| Your own client id | `nuheat.auth.client_id` | empty | Only if NuHeat issued you a client of your own. Setting it shows three more fields: **Your own client secret**, **Return address** and **Copy-the-address return**. |
| Logging | `logging.*` | `info`, daily | Log level, the level forwarded to homeCore, and rotation of the plugin's own log file. |

:::warning Set a floor limit
**Never go above** is worth setting. NuHeat will heat a floor to 30 °C
(86 °F), and engineered hardwood is usually rated to about 27 °C (80 °F).
NuHeat's app enforces no limit of its own. With the limit set, the app's
target slider stops at it and a rule with a bad number in it can't overheat
the floor.
:::

## Devices

Each thermostat is a `thermostat` device with the id `nuheat_<serial>`,
named as it is in the NuHeat app. The app draws it with its standard
thermostat card, which shows the temperature and the target. The details add
a target slider and the three actions below.

| Attribute | Values |
|---|---|
| `temperature` | the thermostat's reading (floor or air, as it is set up), °C |
| `setpoint` | the target, °C, writable |
| `hvac_action` | `heating` or `idle` |
| `hvac_mode` | always `heat` |
| `schedule_mode` | `auto` (following its schedule), `hold` (for now) or `permanent_hold`, writable |
| `hold_until` | when a temporary hold ends, in UTC |
| `error_state` | the thermostat's own fault text, or null |
| `serial_number` | the thermostat's serial number |

homeCore stores temperatures in °C, and the app shows each person their own
units. A thermostat NuHeat can't reach shows as offline.

Setting the target with an attribute write makes a temporary hold,
unless the thermostat is already on a permanent hold or **A new target holds
indefinitely** is on, in which case it stays permanent.

```json
{"setpoint": 22.5}
```

`heat_setpoint` and `target_temperature` are accepted in place of `setpoint`.
To go back to the schedule, write `{"schedule_mode": "auto"}`.

The device also has three actions:

| Action | In the app | Parameters |
|---|---|---|
| `resume_schedule` | Resume the schedule | none |
| `hold_temperature` | Hold a temperature | `setpoint` (°C), `hours` (1 to 23, optional) |
| `set_permanent_hold` | Hold indefinitely | `setpoint` (°C) |

```json
{"action": "hold_temperature", "setpoint": 24, "hours": 3}
```

A hold longer than 23 hours is refused before it reaches NuHeat. After every
command the plugin reads the thermostat again and publishes what NuHeat
reports, so a command NuHeat refuses doesn't leave the app showing something
the floor isn't doing.

## Actions

These are on the plugin's page and in the plugin's action list.

| Action | Who can run it | What it does |
|---|---|---|
| Link NuHeat account (`link_account`) | admin | Signs in by the copy-the-address route, as a step-by-step action. Times out after 10 minutes. |
| Start signing in, Finish signing in (`begin_link`, `complete_link`) | admin | The two steps the plugin's page uses to sign in. |
| Sign out (`sign_out`) | admin | Forgets the sign-in. Thermostats stay in homeCore, without readings, until you link again. |
| Refresh now (`refresh`) | user | Asks NuHeat for every thermostat now instead of waiting. |
| Show status (`status`) | read-only | Whether it's signed in, as whom, since when, and which thermostats it found. |

## Alerts

When a thermostat reports a fault (most often a sensor), the plugin raises a
**Thermostat fault** alert (`thermostat_fault`) in the thermostat's own words,
after its name. It is an error, it is on by default, and it clears when the
fault does.

The plugin also shows notices on its page:

| Notice | When |
|---|---|
| `not_linked` | not signed in, or NuHeat ended the sign-in |
| `auth_rejected` | NuHeat refused the sign-in |
| `api_unreachable` | NuHeat's cloud can't be reached |
| `rate_limited` | NuHeat asked the plugin to slow down |
| `no_thermostats` | the account has none, or none match **Only these serial numbers** |
| `implausible_reading` | a reading came back that no floor could reach, so the plugin didn't publish it |

## Screens and cards

The plugin's page shows whether it is signed in, the account and when it
signed in, and each thermostat with its reading, target and any fault. A
thermostat's name opens its device. The page has **Link NuHeat account**
(**Sign in again** once linked), **Refresh now**, **Sign out** and the
copy-the-address fallback. Thermostats have no card of their own; the app
draws them from their schema.

## Troubleshooting

- The page says it isn't signed in after homeCore was off for a while. NuHeat
  ends a sign-in after 15 days without use. Press **Sign in again**.
- NuHeat can't send you back to homeCore. You opened the page at an address
  that isn't on your home network. Use the copy-the-address fallback.
- A target stops short of what a rule asked for. The rule asked for more than
  **Never go above** allows, and the plugin held it at the limit.
- A thermostat shows as offline. NuHeat can't reach it. Check its Wi-Fi in
  the NuHeat app.
- When homeCore stops or restarts the plugin, the plugin marks its
  thermostats offline before it exits. They come back on its first check.

## Known limits

NuHeat's API doesn't allow schedule editing (its schedule endpoints are
switched off), so schedules stay in the NuHeat app. Energy use, and away mode
across several thermostats, aren't supported yet. NuHeat has no push to the
plugin, so changes made in the NuHeat app appear on the next check.
