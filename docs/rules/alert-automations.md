---
id: alert-automations
title: Alerts that start automations
sidebar_label: Alerts → automations
sidebar_position: 8
---

# Alerts that start automations

Every alert can start an automation — homeCore's own (something wet, smoke, a
device offline, a lock jammed, a battery low), one of your **alert rules**
("the freezer warmer than −10 °C for 15 minutes"), or any plugin's ("firmware
update available"). Telling someone stays with the alert itself (Alert rules ›
Tell); an automation is for everything else: turn the water off, flash a light,
run a scene, send it to another channel.

## Making one: "Do something…"

On **Alerts**, every alert has **Do something…** beside *Seen* and *Ignore…*.
In **Settings › Alert rules** each rule, each of homeCore's own kinds and each
plugin's kind of alert has **+ Do something…** too.

It asks two things:

- **For** — which alerts:
  - *only this one* — this sensor, this rule, this device's plugin alert;
  - *any like it* — "any YoLink leak sensor" (those you add later included),
    "any of your alert rules", "this plugin's alert on any of its devices";
  - *broader* — "anything wet in the house", "anything this serious or worse".
- **When it** — *happens*, *ends*, or *is still on after N minutes*.

**Make the automation** opens the automation editor with a new automation
whose trigger is already chosen and marked *from the alert*. It is an ordinary
trigger: widen it, or change "happens" to "ends", like any other. The *Do*
part offers a few to start from — set a device, run a scene, send to another
channel. The alert's words can go in any message: `{alert.message}` (and
`{alert.device}`, `{alert.reason}`, `{alert.severity}`, `{alert.key}`).

Nothing is saved until you press **Save**.

## Seeing what an alert starts

- On **Alerts**, an alert that starts automations says so: *Starts 1
  automation: Freezer — flash garage light*.
- In **Settings › Alert rules**, under each rule, each of homeCore's own kinds
  and each plugin's kind of alert, **When it happens:** lists the automations
  it starts. homeCore works this out from the automations' triggers, so ones
  written by hand (or in RON, or over the API) are listed too. Automations
  that watch a device directly — "when the leak sensor's `water_detected`
  turns true" — are not: they don't depend on the alert.
- In **Automations**, each one an alert starts says *Started by the alert
  "Freezer warming up"*, and the **Started by alerts** filter shows just
  those.

## When the alert is turned off, ignored or deleted

| You… | Its automations… |
|---|---|
| turn an alert rule **off** | wait: they don't run, because the alert can't happen. Each says *Waiting — its alert "…" is turned off*. Turn the rule on and they're live again. |
| set a plugin's kind of alert to **Show it: Off** | wait, the same way. |
| **ignore** the alert (Alerts › Ignore…) | wait, the same way, while the ignore lasts. |
| **delete** an alert rule | you're asked first (below). |
| delete the **automation** | the alert stays; its *When it happens* list loses that name. |

An automation with another trigger that can still happen isn't waiting — it
runs on that one.

### Deleting an alert rule that starts automations

homeCore asks what becomes of them:

- **Delete the rule and its automations** — the automations it alone started
  go too.
- **Delete the rule, keep the automations turned off** — they keep their
  steps, turned off, and say *Its alert was deleted — choose another trigger
  or delete it*. They can't be turned on until they're given another trigger;
  once they are, they run again.

Either way, an automation that also has another trigger keeps running on that
one; only the deleted rule's trigger is removed.

A rule that starts nothing is deleted without the question.

## In a rule file

The trigger is an alert trigger with a filter; every field narrows it:

```ron
// "When any YoLink leak sensor has been wet for 5 minutes"
trigger: AlertActiveFor(
    filter: AlertFilter(
        kind: Some(wet),
        plugin_id: Some("plugin.yolink"),
    ),
    minutes: 5,
),
```

- `kind` — `wet`, `smoke`, `offline`, `jammed`, `low_battery`, `rule`
  (an alert rule's) or `plugin` (a plugin's).
- `plugin_id` — that plugin's alerts, **and** homeCore's own about its
  devices: `wet` with `plugin.yolink` is any YoLink leak sensor.
- `topic`, `key` — a plugin's kind of alert, and what one is about.
- `device_ids` — only these devices'.
- `rule_id` — only this alert rule's. After the rule is deleted and the
  automation kept, it reads `DELETED:{id}`.
- `min_severity` — only this serious or worse.

The API: `GET /api/v1/alerts/automations` lists every automation an alert
starts, with what can start each trigger and whether it is waiting;
`GET /api/v1/alert-rules/{id}/automations` lists what deleting a rule would
touch; `DELETE /api/v1/alert-rules/{id}?automations=delete|disable` deletes
one that starts automations (without `automations` the answer is 409 and
nothing changes). See the OpenAPI spec.
