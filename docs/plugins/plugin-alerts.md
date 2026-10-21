---
id: plugin-alerts
title: Alerts from Plugins
sidebar_label: Alerts from Plugins
sidebar_position: 5
---

# Alerts from Plugins

A plugin can raise **alerts** about its devices — "firmware 17.0.0 is out",
"restarted by itself", "the hub needs its button pressed" — which join the
house's own alerts (water, smoke, offline) in the alert list, can be sent to a
notification channel, and can start, gate and drive automations.

**Notices or alerts?** Notices are about the plugin itself and live on its
page ("no devices configured"). Alerts are about its devices, or about the
plugin's link to a system, and are for the household.

## Declare the kinds

Every kind of alert a plugin can raise is declared on its capability manifest,
so Settings › Alerts can list it — and someone can turn it on or off, or send
it somewhere — before it has ever happened.

```rust
use plugin_sdk_rs::types::{AlertSeverity, PluginAlertKind};

let mgmt = mgmt.with_alert_kinds([
    PluginAlertKind {
        topic: "firmware_update".into(),
        label: "Firmware update available".into(),
        description: Some("A newer release for the controller's own build".into()),
        severity: AlertSeverity::Info,
        default_on: false,        // news, not a problem: off until someone wants it
    },
    PluginAlertKind {
        topic: "restarted".into(),
        label: "Restarted by itself".into(),
        description: None,
        severity: AlertSeverity::Warning,
        default_on: true,
    },
]);
```

- `severity` is `info`, `warning` or `error`. **A plugin can't raise a critical
  alert** — those are homeCore's own (smoke, water); one asking for it gets
  `error`.
- `default_on: false` for news that isn't a problem: it shows only once
  someone turns it on in Settings › Alerts.

## Say what is true now

```rust
use plugin_sdk_rs::types::{AlertAction, AlertActionTarget, PluginAlert};

publisher.set_alerts("wled_eaves", &[
    PluginAlert::new("firmware_update", "Firmware 17.0.0 is out")
        .key("17.0.0")
        .action(AlertAction {
            label: "Update…".into(),
            id: "install_firmware".into(),     // a device action on this device
            target: AlertActionTarget::Device,
            params: serde_json::json!({ "version": "17.0.0" }),
            confirm: true,
        }),
]).await?;
```

**Alerts are current state, not events.** Each call is the whole list for that
device: an alert you stop sending has cleared, and an empty list clears them
all. Set them when something changes, not on a timer — the list is retained
and said again after every reconnect.

- `key` says what this one is about within its kind (`17.0.0`); a different key
  is a different alert, so "skip this version" can skip one and still show the
  next.
- `reason` is the alert without the device's name, for its card; `message`
  overrides the "`{device}`: `{reason}`" sentence when you want other words.
- An `action` puts a button on the alert. It runs one of the device's actions
  (the default target) or one of the plugin's (`target: plugin`), with
  `params`; `confirm` asks first.
- `set_plugin_alerts` raises alerts about the plugin itself rather than a
  device.

The Python, Node.js and .NET SDKs have the same calls (`set_alerts` /
`setAlerts` / `SetAlertsAsync`, and declaring the kinds on their
`Capabilities`).

## What the household does with them

- **Settings › Alerts** lists each plugin's kinds: show it or not, and send it
  to a notification channel.
- **The alert list** shows them with their buttons; people can mark one seen,
  skip one (a plugin alert, by its key), or ignore alerts like it for a while.
- **Automations** can start when an alert is raised, clears, is marked seen or
  has been active for a while; check whether alerts like it are active (or
  none are); and act on them — press an alert's button, wait until it clears,
  mark it seen, skip it — including for each active alert in turn.
  `{alert.device}`, `{alert.key}` and the rest can be used in messages.
  **Do something…** on any alert makes one — see
  [Alerts that start automations](../rules/alert-automations.md). Setting a
  kind to *Show it: Off* leaves the automations it starts waiting.

WLED's "install firmware updates at night" is exactly that: at 03:00, for each
active *Firmware update available* alert, press its button and wait for it to
clear — and stop, and say so, if a controller doesn't come back.
