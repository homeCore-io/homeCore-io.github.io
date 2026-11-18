---
id: alerts
title: Alerts
sidebar_label: Alerts
sidebar_position: 2
---

# Alerts

An alert is something in the house that needs attention: a leak, smoke, a jammed lock, a device or plugin that is offline, a low battery, or a condition you defined yourself. homeCore works out the alerts itself, so every screen shows the same list and nothing depends on a screen being open. The web app shows them on the **Alerts** page, and you set up your own under **Settings › Alerts**.

homeCore recalculates the whole set whenever something relevant changes and every 30 seconds, then announces the difference. A new alert, or one whose wording changed, is an `alert_raised` event. One whose condition ended is `alert_cleared`. Because the set is worked out whole each time, a missed event or a restart can't leave a stale alert behind.

## Kinds of alert

| Kind | Raised when | Severity |
|---|---|---|
| `wet` | A device reports `water_detected` (or the older `leak` or `wet`) as true | critical |
| `smoke` | A device reports `smoke` or `smoke_detected` as true | critical |
| `jammed` | A device reports `jammed: true`, or a `last_alert` that mentions a jam | critical |
| `offline` | A device has been unavailable for 5 minutes, or a plugin homeCore runs has been down for 1 minute | warning |
| `low_battery` | A battery is at or below the `[battery]` threshold, until it climbs past the recovery band, or a device reports `battery_low: true` | warning |
| `rule` | One of your time rules matches (see below) | the rule's |
| `plugin` | A plugin says one of its declared alerts is true, such as a firmware update | `info`, `warning` or `error`, as the plugin declared |

See [Battery monitoring](../devices/battery-monitoring.md) for the battery threshold, and [Alerts from Plugins](../plugins/plugin-alerts.md) for how plugins declare and report theirs.

"How long" counts from the device's `attributes_changed_at`, which survives restarts, so a rule like "unlocked for 30 minutes" keeps its place. Being offline has no stored time, so it counts from when homeCore first saw the device offline after starting.

## The alert record

```json
{
  "id": "rule:3b0d9f3e-6a52-4f1e-9b8c-2f7a1c0d4e55:yolink_garage_door",
  "kind": "rule",
  "device_id": "yolink_garage_door",
  "rule_id": "3b0d9f3e-6a52-4f1e-9b8c-2f7a1c0d4e55",
  "message": "Garage Door open after 22:00",
  "reason": "Open after 22:00",
  "severity": "warning",
  "raised_at": "2026-03-28T22:00:00Z",
  "device_plugin_id": "plugin.yolink"
}
```

| Field | Description |
|---|---|
| `id` | Stays the same while the condition lasts: `wet:{device}`, `rule:{rule}:{device}` |
| `kind` | One of the kinds above |
| `device_id` | The device it is about. For a plugin that is down, or a plugin's alert about itself, the plugin's ID. |
| `rule_id` | The time rule that raised it |
| `message` | In words, with the device's name |
| `reason` | The same without the name, for the device's own card |
| `severity` | `warning` or `critical` for homeCore's own kinds. A plugin's is `info`, `warning` or `error`. |
| `raised_at` | When the condition began, as near as homeCore knows |
| `acknowledged` | Who marked it seen (`by`) and when (`at`) |
| `plugin_id`, `topic`, `key` | For a plugin's alert: which plugin, which of its kinds, and what this one is about (a version number, say) |
| `action` | For a plugin's alert: the one button it offers, such as "Update…" |
| `device_plugin_id` | The plugin the device belongs to, for every kind |

## Reading and acting on alerts

```bash
# What needs attention now, most serious first
curl -s http://localhost:8080/api/v1/alerts \
  -H "Authorization: Bearer $TOKEN" | jq

# Mark one as seen
curl -s -X POST http://localhost:8080/api/v1/alerts/wet:yolink_d88b4c0400064300/acknowledge \
  -H "Authorization: Bearer $TOKEN" | jq

# Press a plugin alert's button (202)
curl -s -X POST http://localhost:8080/api/v1/alerts/ALERT_ID/press \
  -H "Authorization: Bearer $TOKEN" | jq
```

Listing needs `devices:read`. Acknowledging and pressing need `devices:command`. An acknowledged alert stays until its condition ends. Acknowledging sends `alert_raised` with `update: true` and then `alert_acknowledged`. homeCore keeps acknowledgements in memory, so after a restart an active alert shows as new again. If the condition ends and comes back, that is a new alert.

Pressing runs the alert's `action`: a device action on the alert's device, or a plugin action. The alert clears when the plugin reports the work is done. An alert with no button answers `409`.

## Time rules

A time rule raises an alert when a device holds a state, optionally only at certain times of day and only after it has lasted a while. "Garage door open after 22:00" and "back door unlocked for 30 minutes" are time rules. Make them in **Settings › Alerts** or through the API:

```bash
curl -s -X POST http://localhost:8080/api/v1/alert-rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Garage open at night",
    "device_ids": ["yolink_garage_door"],
    "attribute": "open",
    "value": true,
    "state_label": "Open",
    "after": "22:00",
    "until": "06:00",
    "for_minutes": 10,
    "severity": "warning",
    "notify": "telegram"
  }' | jq
```

| Field | Description |
|---|---|
| `name` | Required |
| `enabled` | Default `true` |
| `device_ids` | Required: one or more devices |
| `attribute`, `value` | The state that counts |
| `op` | `eq` (default), `ne`, `above` or `below`. `above` and `below` need a number in `value`. |
| `state_label` | The state in the device's own words, for the message |
| `after`, `until` | Local times of day, `HH:MM`. An `until` earlier than `after` runs past midnight. |
| `for_minutes` | Only after the state has lasted this long; at least 1 |
| `severity` | `warning` (default) or `critical` |
| `notify` | A notification channel, or `all`, to tell when one of its alerts is raised. Left out, the alert is shown but not sent. |

`GET /api/v1/alert-rules` lists them, `PUT /api/v1/alert-rules/{id}` replaces one, and `DELETE /api/v1/alert-rules/{id}` deletes one and clears its alerts. Reading needs `automations:read` and changing needs `automations:write`. Deleting a rule that starts automations needs `?automations=delete` or `?automations=disable`; see [Alerts that start automations](../rules/alert-automations.md).

## Ignoring alerts

An ignore hides matching alerts, for good or until a time. It can name a kind, a device, a time rule or a plugin, or combine them (low batteries on one device, say). A plugin ignore can narrow to one `topic`, or to one `key` to skip one version of an update.

```bash
# Ignore low batteries on one device for a week
curl -s -X POST http://localhost:8080/api/v1/alert-ignores \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"kind": "low_battery", "device_id": "zwave_23", "until": "2026-04-04T00:00:00Z", "note": "Replacing it Saturday"}' | jq
```

An ignore must name at least one of `kind`, `device_id`, `rule_id` or `plugin_id`. An ignored alert clears, and the battery notification shortcut skips ignored low batteries. `GET /api/v1/alert-ignores` lists ignores, including expired ones until you remove them, and `DELETE /api/v1/alert-ignores/{id}` shows what it hid again right away. Ignores need `automations:write` to create or remove. An automation can also ignore alerts with the `IgnoreAlerts` action.

## Plugin alert kinds

`GET /api/v1/alerts/kinds` lists every kind of alert the running plugins declared, with whether it is on (`enabled`, from your setting or the plugin's `default_on`) and the channel it is sent to (`notify`). Change one with `PUT /api/v1/alerts/kinds/{plugin_id}/{topic}` and a body of `{"enabled": true, "notify": "pushover"}`. Leave a field out, or send `null`, to go back to the plugin's default.

## Where alerts are sent

An alert is shown in the app either way. It is also sent as a notification when:

- it comes from a time rule with `notify` set,
- it is a plugin kind with `notify` set,
- it is a built-in kind (wet, smoke, jammed, offline) and `[alerts] notify_channel` is set in `homecore.toml`, or
- it is a low battery and `[battery] notify_channel` is set.

```toml
[alerts]
notify_channel = "telegram"   # a channel name, or "all"
```

homeCore skips sending on its first pass after a start, which would otherwise repeat every alert that was already true. Channels are set up on the [Notifications](./notifications.md) page.

Rules can start from alerts with the `AlertRaised` trigger and fill `{alert.message}` and similar placeholders into their messages. See [Alerts that start automations](../rules/alert-automations.md).
