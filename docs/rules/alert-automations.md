---
id: alert-automations
title: Alerts that start automations
sidebar_label: Alerts → automations
sidebar_position: 8
---

# Alerts that start automations

Any alert can start an automation. That covers homeCore's own alerts (something wet, smoke, a device offline, a lock jammed, a battery low), your **alert rules** ("the freezer warmer than −10 °C for 15 minutes") and any plugin's alerts ("firmware update available"). Telling someone is handled by the alert itself (Alert rules › Tell). An automation is for everything else: turn the water off, flash a light, run a scene, send the alert to another channel.

## Making one: "Do something…"

On **Alerts**, every alert has **Do something…** next to *Seen* and *Ignore…*. In **Settings › Alert rules**, each rule, each of homeCore's own kinds and each plugin's kind of alert has **+ Do something…** as well.

It asks two things:

- **For**: which alerts.
  - *Only this one*: this sensor, this rule, this device's plugin alert.
  - *Any like it*: "any YoLink leak sensor" (including ones you add later), "any of your alert rules", "this plugin's alert on any of its devices".
  - *Broader*: "anything wet in the house", "anything this serious or worse".
- **When it**: *happens*, *ends*, or *is still on after N minutes* (10 unless you change it).

**Make the automation** opens the automation editor with a new automation whose trigger is already filled in and marked *from the alert*. It is an ordinary trigger: you can widen it, or change "happens" to "ends", like any other. Under *What should happen?* the editor offers a few steps to start from: set a device, run a scene, or send to another channel. The alert's words can go in any message as `{alert.message}`. The other placeholders are `{alert.device}`, `{alert.device_id}`, `{alert.reason}`, `{alert.severity}`, `{alert.kind}`, `{alert.key}`, `{alert.raised_at}` and `{alert.id}`.

Nothing is saved until you press **Save**.

## Seeing what an alert starts

- On **Alerts**, an alert that starts automations says so: *Starts 1 automation: Flash the garage light*.
- In **Settings › Alert rules**, a **When it happens:** line under each rule, each of homeCore's own kinds and each plugin's kind of alert lists the automations it starts. homeCore works this out from the automations' triggers, so automations written by hand (in the editor, in RON or over the API) are listed too. Automations that watch a device directly ("when the leak sensor's `water_detected` turns true") are not listed, because they don't depend on the alert.
- In **Automations**, each automation an alert starts says *Started by the alert "Freezer warming up"*, and the **Started by alerts** filter shows only those.

## When the alert is turned off, ignored or deleted

| You… | Its automations… |
|---|---|
| turn an alert rule **off** | wait. They can't run, because the alert can't happen. Each card says *Its alert "…" is turned off*. Turn the rule back on and they are live again. |
| set a plugin's kind of alert to **Show it: Off** | wait, in the same way. |
| **ignore** the alert (Alerts › Ignore…) | wait while the ignore lasts. The card says the alert *is ignored*. |
| **delete** an alert rule | you're asked first (see below). |
| delete the **automation** | the alert stays; its *When it happens* list loses that name. |

An automation that also has another trigger, one that can still happen, isn't waiting. It runs on that trigger.

"Ends" triggers also run when an alert is withdrawn because its rule was turned off or the alert was ignored, so clean-up automations still do their job.

### Deleting an alert rule that starts automations

homeCore asks what should happen to them:

- **Delete the rule and its automations**: the automations it alone started are deleted too.
- **Delete the rule, keep the automations turned off**: they keep their steps but are turned off, and each card says its alert was deleted and asks you to choose another trigger or delete it. They can't be turned on until they have another trigger. Once they do, they run again.

Either way, an automation that also has another trigger keeps running on that one. Only the deleted rule's trigger is removed.

A rule that starts nothing is deleted without the question.

## In a rule file

The trigger is one of the alert triggers (`AlertRaised`, `AlertCleared`, `AlertAcknowledged`, `AlertActiveFor`) with a filter. Each field you set narrows it:

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

- `kind`: `wet`, `smoke`, `offline`, `jammed`, `low_battery`, `rule` (an alert rule's) or `plugin` (a plugin's).
- `plugin_id`: that plugin's alerts, **and** homeCore's own alerts about its devices. `wet` with `plugin.yolink` means any YoLink leak sensor. A filter with only `plugin_id` set also matches that plugin's devices going offline or wet.
- `topic`, `key`: a plugin's kind of alert, and what a particular one is about.
- `device_ids`: only these devices' alerts.
- `rule_id`: only this alert rule's. If the rule is deleted and the automation kept, this reads `DELETED:{id}`.
- `min_severity`: only alerts this serious or worse (`info`, `warning`, `error`, `critical`).

The API: `GET /api/v1/alerts/automations` lists every automation an alert starts, what can start each trigger and whether it is waiting. `GET /api/v1/alert-rules/{id}/automations` lists what deleting a rule would touch. `DELETE /api/v1/alert-rules/{id}?automations=delete|disable` deletes a rule that starts automations; without `automations`, the answer is `409` with the list, and nothing changes. See the OpenAPI spec.
