---
id: alert-automations
title: Alerts that start automations
sidebar_label: Alerts and automations
sidebar_position: 8
---

# Alerts that start automations

Any alert can start an automation. That includes homeCore's own alerts (something wet, smoke, a device offline, a lock jammed, a low battery), your alert rules ("the freezer warmer than −10 °C for 15 minutes") and any plugin's alerts ("firmware update available"). The alert itself already tells people, through the rule's **Tell** setting in **Settings › Alerts**. Use an automation for anything else: turn the water off, flash a light, run a scene, or send the alert to another channel.

## Making one with "Do something…"

On the Alerts page, every alert has **Do something…** next to **Seen** and **Ignore…**. In **Settings › Alerts**, each of your rules, each of homeCore's own kinds and each plugin's kind of alert has **+ Do something…** as well.

The dialog asks two things. **For** picks which alerts: this one alone (this sensor, this rule, this device's plugin alert), any like it ("any YoLink leak sensor", including ones you add later, or "this plugin's alert on any of its devices"), or something broader ("anything wet in the house", "anything this serious or worse"). **When it** picks *happens*, *ends* or *is still on after N min*, where N is 10 unless you change it.

**Make the automation** opens the [automation editor](./editor.md) with a new automation whose moment is already filled in and marked *from the alert*. It is an ordinary trigger, so you can widen it or change "happens" to "ends" like any other. Under *What should happen?* the editor suggests a few steps to start from: set a device, run a scene, or send to another channel.

A message can include the alert's words as `{alert.message}`. The other placeholders are `{alert.device}`, `{alert.device_id}`, `{alert.reason}`, `{alert.severity}`, `{alert.kind}`, `{alert.key}`, `{alert.raised_at}` (as `HH:MM` in the house's time) and `{alert.id}`. They work in `Notify` messages and titles and in `LogMessage`.

Nothing is saved until you press **Save**.

## Seeing what an alert starts

- On the Alerts page, an alert that starts automations says so, for example "Starts 1 automation: Flash the garage light".
- In **Settings › Alerts**, a **When it happens** line under each rule and each kind of alert lists the automations it starts. homeCore works this out from the automations' triggers, so automations written by hand (in the editor, in RON or over the API) are listed too. Automations that watch a device directly ("when the leak sensor's `water_detected` turns true") are not listed, because they don't depend on the alert.
- In **Settings › Automations**, each automation an alert starts says "Started by the alert" and names it, and the **Started by alerts** filter shows only those.

## When the alert is turned off, ignored or deleted

| You… | Its automations… |
|---|---|
| turn an alert rule off | wait. They can't run, because the alert can't happen. Each one says its alert is turned off. Turn the rule back on and they are live again. |
| set a plugin's kind of alert to **Show it** off | wait in the same way. |
| ignore the alert (**Ignore…** on the Alerts page) | wait while the ignore lasts. Each one says its alert is ignored. |
| delete an alert rule | you're asked first (see below). |
| delete the automation | the alert stays, and its **When it happens** list loses that name. |

An automation that also has another trigger, one that can still happen, isn't waiting. It runs on that trigger.

"Ends" triggers also run when an alert is withdrawn because its rule was turned off or the alert was ignored, so clean-up automations still do their job.

### Deleting an alert rule that starts automations

homeCore asks what should happen to them:

- **Delete the rule and its automations** deletes the automations that only this rule started.
- **Delete the rule, keep the automations turned off** keeps their steps but turns them off. Each one says "Its alert was deleted. Choose another trigger or delete it." They can't be turned on until they have another trigger. Once they do, they run again.

Either way, an automation that also has another trigger keeps running on that one. Only the deleted rule's trigger is removed.

A rule that starts nothing is deleted without the question.

## In a rule file

The trigger is one of the alert triggers (`AlertRaised`, `AlertCleared`, `AlertAcknowledged`, `AlertActiveFor`) with a filter. Each field you set narrows it, and an empty filter matches any alert:

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

| Field | Matches |
|---|---|
| `kind` | `wet`, `smoke`, `offline`, `jammed`, `low_battery`, `rule` (an alert rule's) or `plugin` (a plugin's). |
| `plugin_id` | That plugin's alerts and homeCore's own alerts about its devices. `wet` with `plugin.yolink` means any YoLink leak sensor. A filter with only `plugin_id` also matches that plugin's devices going offline or wet. |
| `topic` | A plugin's kind of alert, such as `firmware_update`. |
| `key` | What one plugin alert is about, such as a version (`17.0.0`). |
| `device_ids` | Only these devices' alerts. Each takes a canonical name, a unique display name or a raw device ID. |
| `rule_id` | Only this alert rule's. If the rule is deleted and the automation kept, this reads `DELETED:{id}`. |
| `min_severity` | Only alerts this serious or worse: `info`, `warning`, `error` or `critical`. |

The same filter is used by the `AlertActive` and `NoAlertActive` conditions and by the `ForEachAlert` and `IgnoreAlerts` steps. See [Conditions](./conditions.md) and [Actions](./actions.md#alert-actions).

Over the API, `GET /api/v1/alerts/automations` lists every automation an alert starts, what can start each trigger and whether it is waiting. `GET /api/v1/alert-rules/{id}/automations` lists what deleting a rule would touch. `DELETE /api/v1/alert-rules/{id}?automations=delete|disable` deletes a rule that starts automations. Without `automations`, the answer is `409` with the list, and nothing changes.
