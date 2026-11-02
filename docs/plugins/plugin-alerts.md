---
id: plugin-alerts
title: Alerts from Plugins
sidebar_label: Alerts from Plugins
sidebar_position: 5
---

# Alerts from Plugins

A plugin can raise **alerts** about its devices, such as "firmware 17.0.0 is
out", "restarted by itself" or "the hub needs its button pressed". They join
the house's own alerts (water, smoke, offline) in the alert list. They can be
sent to a notification channel, and automations can start on them, check
them and act on them.

**Notices or alerts?** Notices are about the plugin itself and appear on its
page ("no devices configured"). Alerts are about its devices, or about the
plugin's link to a system, and they are meant for the household.

## Declare the kinds

Every kind of alert a plugin can raise is declared on its capability manifest.
That way Settings › Alerts can list it before it has ever happened, and
someone can turn it on or off or send it somewhere.

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

- `severity` is `info`, `warning` or `error`. **A plugin can't raise a
  critical alert.** Those are homeCore's own (smoke, water), and a plugin that
  asks for `critical` gets `error`.
- Use `default_on: false` for news that isn't a problem. Such an alert shows
  only after someone turns it on in Settings › Alerts.

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

**Alerts describe current state.** Each call is the whole list for that
device: an alert you stop sending has cleared, and an empty list clears them
all. Set them when something changes, not on a timer. The list is retained,
and the SDK sends it again after every reconnect.

- `key` says what this alert is about within its kind (`17.0.0`). A different
  key is a different alert, so "skip this version" can skip one and still
  show the next.
- `reason`, the second argument to `PluginAlert::new`, is the alert without
  the device's name, for the device's card. `message` replaces the default
  "`{name}`: `{reason}`" sentence when you want other words.
- `.severity(...)` overrides the kind's declared severity for this one alert,
  still capped at `error`. `since` says when the condition began, if the
  plugin knows; otherwise homeCore uses the time it first heard of it.
- An `action` puts a button on the alert. It runs one of the device's actions
  (the default target) or one of the plugin's (`target: plugin`), with
  `params`. `confirm` asks first.
- `set_plugin_alerts` raises alerts about the plugin itself rather than a
  device.

The Python, Node.js and .NET SDKs have the same calls (`set_alerts` /
`setAlerts` / `SetAlertsAsync`), and declare the kinds on their
`Capabilities`.

## What the household does with them

- **Settings › Alerts** lists each plugin's kinds: whether to show it, and
  which notification channel to send it to.
- **The alert list** shows them with their buttons. People can mark one seen,
  skip one (a plugin alert, by its key), or ignore alerts like it for a while.
- **Automations** can start when an alert is raised, clears, is marked seen
  or has been active for a while. They can check whether alerts like it are
  active (or none are), and act on them: press an alert's button, wait until
  it clears, mark it seen or skip it, including for each active alert in
  turn. Messages can use `{alert.device}`, `{alert.key}` and the other alert
  fields. **Do something…** on any alert creates such an automation; see
  [Alerts that start automations](../rules/alert-automations.md). Setting a
  kind to *Show it: Off* means homeCore doesn't raise it at all, so the
  automations it would start keep waiting.

WLED's "install firmware updates at night" automation works this way. At
03:00 it goes through each active *Firmware update available* alert, presses
its button and waits for the alert to clear. If a controller doesn't come
back, it stops and says so.
