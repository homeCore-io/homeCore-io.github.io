---
id: mysa
title: Mysa
sidebar_label: Mysa
sidebar_position: 15
---

# Mysa (`hc-mysa`)

This plugin connects Mysa thermostats through Mysa's cloud (the Mysa Consumer
API). Each thermostat you share with homeCore becomes a homeCore thermostat
that reports its temperature, humidity, mode and targets. You can change the
mode and the targets, and use whichever of fan, swing, keypad lock and display
brightness your model has. The plugin asks Mysa what each thermostat can do
and offers only those controls. It has been tried on Mysa baseboard
thermostats.

## Before you start

You need the Mysa account that the Mysa app uses, with your thermostats
already added to it. The machine running homeCore needs internet access to
reach Mysa. Nothing on your network needs to be opened, and you don't need to
register anything with Mysa: the plugin signs in as homeCore's Mysa client,
which Mysa registered for everyone to use.

Only one homeCore can be linked to a Mysa account. Mysa keeps only the newest
sign-in, so two homeCores on the same account sign each other out.

## Install and set up

1. Install **Mysa** from Settings › Plugins › Catalog.
2. Open its page (Settings › Plugins › Mysa) and press **Link Mysa
   account**.
3. Sign in on Mysa's own site. homeCore never sees your password. Mysa's
   consent page names the app "homeCore", published by Simplex Technology.
   Choose the thermostats to share and press **Allow**.

If you opened the plugin's page at a home-network address, Mysa sends you
back through `homecore.io/oauth/mysa/callback`, a page that only passes
Mysa's answer on to your own homeCore, and you land back on the plugin's page,
linked. A home-network address is localhost, a private IPv4 address, an IPv6
unique local address, or a name ending in `.local`, `.home.arpa` or
`.internal`. The page sends Mysa's answer to no other address.

If you reach homeCore any other way, such as a public name or a VPN address,
you sign in by pasting instead. Mysa opens in a new tab, and after you press
**Allow** that tab ends on an address starting
`http://127.0.0.1:8127/mysa/callback` that won't load. That is expected. Copy
the whole address from the address bar, paste it into the plugin's page and
press **Link** within a minute, because Mysa's code expires 60 seconds after
it's issued. From a home-network address you can still choose this route
under **Can't come back to this page from Mysa?**.

The plugin lists your shared thermostats on its first check.

:::note Sign in again every 30 days
Mysa ends a sign-in 30 days after you make it, however much it's used. The
plugin's page shows the date, and five days before it the plugin raises a
reminder. Press **Sign in again** on the plugin's page to start another 30
days.
:::

The plugin keeps its sign-in in homeCore's own plugin state, never in the
config file, so restarts don't sign it out.

## Settings

All settings are in the generic form below the plugin's page. Nothing in the
account section needs filling in for a normal setup.

| Setting | Key | Default | What it does |
|---|---|---|---|
| Check every | `mysa.poll_interval_secs` | 60 s | How often to read every thermostat (30 to 3600 s). One call reads them all. |
| Only these Mysa device ids | `mysa.only_devices` | empty | Leave empty for every thermostat the account shared. |
| Area | `mysa.area` | none | The area the thermostats land in. |
| Your own client id | `mysa.auth.client_id` | empty | Only if Mysa issued you a client of your own. Setting it shows **Return address** and **Copy-the-address return**. |
| Logging | `logging.*` | `info`, daily | Log level, the level forwarded to homeCore, and rotation of the plugin's own log file. |

## Devices

Each thermostat is a `thermostat` device with the id `mysa_<id>`, where `<id>`
is Mysa's device id in lowercase. The app draws it with its standard
thermostat card and details.

| Attribute | Values |
|---|---|
| `temperature` | the room temperature, °C |
| `humidity` | %, where the thermostat measures it |
| `hvac_mode` | `off`, `heat`, `cool`, `auto`, `dry`, `fan_only` or `emergency_heat`, as the model allows; writable |
| `heat_setpoint`, `cool_setpoint` | the targets, °C, writable; in auto, the band |
| `fan_mode`, `fan_speed` | where the model has a fan; writable |
| `swing_vertical`, `swing_horizontal` | swing positions, where the model has them; writable |
| `keypad_lockout` | `0` for unlocked, or the lock level; writable |
| `display_brightness`, `display_idle_brightness` | 0 to 100 %, in steps of 5, where the model lets you set them; writable |
| `model` | Mysa's model name, such as `BB-V2-0` |

Mysa doesn't report whether a thermostat is heating at this moment or whether
it is holding, so the card shows neither. homeCore stores temperatures in °C,
and the app shows each person their own units. A thermostat that isn't
connected to Mysa shows as offline.

Send commands as attribute writes. You can write several at once:

```json
{"hvac_mode": "heat", "heat_setpoint": 21.5}
```

Mysa accepts only certain targets for each thermostat (on a baseboard, 5 to
30 °C in half degrees). The plugin moves every target onto that list before
sending it, so each press of + or − moves at least one step. Setting a heat
target switches the thermostat to heat, and a cool target to cool, as the
Mysa app does. A plain `setpoint` is read as the cool target when the
thermostat is cooling and as the heat target otherwise.

Thermostats with a schedule also have two actions:

| Action | In the app | What it does |
|---|---|---|
| `hold` | Hold until the next change | keeps what it's doing now until the schedule's next event |
| `resume_schedule` | Follow the schedule | cancels any hold |

```json
{"action": "resume_schedule"}
```

A thermostat Mysa doesn't describe yet is shown read-only until it does.

### How often it checks

Mysa has no way to tell homeCore about a change, so the plugin asks. One call
a minute reads every thermostat on the account, which is the rate Mysa
expects. It reads what each thermostat can do when it first sees it and again
every six hours. Changes you make in homeCore go out straight away, at most
one every 1.5 seconds to the same thermostat and 12 a minute across the
account. If you change many thermostats at once, the plugin spreads the
changes over the minute instead of refusing them. If Mysa asks it to slow
down, it waits as long as Mysa says and shows that on its page.

## Actions

These are on the plugin's page and in the plugin's action list.

| Action | Who can run it | What it does |
|---|---|---|
| Link Mysa account (`link_account`) | admin | Signs in by the copy-the-address route, as a step-by-step action. Times out after 10 minutes. |
| Start signing in, Finish signing in (`begin_link`, `complete_link`) | admin | The two steps the plugin's page uses to sign in. |
| Sign out (`sign_out`) | admin | Forgets the sign-in. Thermostats stay in homeCore, without readings, until you link again. |
| Refresh now (`refresh`) | user | Asks Mysa for every thermostat now instead of waiting. |
| Show status (`status`) | read-only | Whether it's signed in, until when, and which thermostats it found. |

## Alerts

The plugin raises no alerts. It shows notices on its page instead:

| Notice | When |
|---|---|
| `not_linked` | not signed in, or Mysa ended the sign-in |
| `relink_due` | the sign-in ends within five days |
| `auth_rejected` | Mysa refused the sign-in |
| `missing_permission` | the sign-in doesn't allow something the plugin needs |
| `api_unreachable` | Mysa's cloud can't be reached, or answered with an error |
| `rate_limited` | Mysa asked the plugin to wait |
| `no_thermostats` | the account shared none, or none match **Only these Mysa device ids** |
| `undescribed_thermostat` | Mysa doesn't yet say what a thermostat can do, so it is read-only |
| `not_configured` | the plugin has no client id to sign in with |

## Screens and cards

The plugin's page shows whether it is signed in, when the sign-in ends, and
each thermostat. A thermostat's name opens its device. The page has **Link
Mysa account** (**Sign in again** once linked), **Refresh now**, **Sign out**
and the copy-the-address fallback. Thermostats have no card of their own; the
app draws them from their schema.

## Troubleshooting

- Thermostats stopped updating about a month after you linked. Mysa ended the
  sign-in. Press **Sign in again**.
- Pasting the address fails. Mysa's code lasts 60 seconds. Start again and
  paste sooner.
- `missing_permission` appears. Sign in again and approve everything on
  Mysa's consent page.
- `no_thermostats` appears. Sign in again and share the thermostats on Mysa's
  consent page, or empty **Only these Mysa device ids**.
- `rate_limited` keeps coming back. Raise **Check every**.
- A thermostat you stop sharing is removed from homeCore on the next check.
- When homeCore stops or restarts the plugin, the plugin marks its
  thermostats offline before it exits. They come back on its first check.

## Known limits

Schedules stay in the Mysa app. The plugin can hold a target and hand control
back to the schedule, but it doesn't edit schedules. Energy use isn't shown
yet.
