---
id: plugin-alerts
title: Alerts from Plugins
sidebar_label: Alerts from Plugins
sidebar_position: 5
---

# Alerts from Plugins

A plugin can raise alerts about its devices: "firmware 17.0.0 is out",
"restarted by itself", "the hub needs its button pressed". They go into the
same alert list as homeCore's own alerts (water, smoke, offline). People can
send them to a notification channel, and automations can start on them, check
them and act on them.

Alerts and notices are different things. A notice is about the plugin itself
("no devices configured", "can't reach the hub") and shows only on the
plugin's page in Settings › Plugins. An alert is about a device, or about the
plugin's link to a system, and it is meant for the household. Notices are
covered in [Developing Plugins](./developing-plugins#notices).

## Declare the kinds

Declare every kind of alert the plugin can raise on its capability manifest.
Settings › Alerts can then list a kind before it has ever happened, so someone
can turn it on or off or pick where it is sent.

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

`severity` is `info`, `warning` or `error`, and `warning` when left out.
Critical alerts belong to homeCore (smoke, water), so a plugin that asks for
`critical` gets `error`. Set `default_on: false` for news that isn't a
problem; that kind stays hidden until someone turns it on in Settings ›
Alerts. Left out, `default_on` is `true`.

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

Alerts describe current state. Each call sends the whole list for that
device: an alert you stop sending has cleared, and an empty list clears them
all. Call it when something changes, not on a timer. The SDK publishes the
list retained on `homecore/devices/{id}/alerts` and sends it again after
every reconnect.

The fields:

- `key` says what this alert is about within its kind (`17.0.0`). A different
  key is a different alert, so a person can skip one version and still see
  the next.
- `reason`, the second argument to `PluginAlert::new`, is the alert without
  the device's name. The device's card shows it. `message` replaces the
  default "`{name}`: `{reason}`" sentence when you want other words.
- `.severity(...)` overrides the kind's severity for this one alert, still
  capped at `error`.
- `since` is when the condition began, if the plugin knows. Otherwise homeCore
  uses the time it first heard of it.
- `action` puts a button on the alert. It runs one of the device's actions
  (the default target) or one of the plugin's own (`target: plugin`), with
  `params`. `confirm` makes the app ask first.

`set_plugin_alerts` raises alerts about the plugin itself instead of a device,
on `homecore/plugins/{id}/alerts`.

The Python, Node.js and .NET SDKs have the same calls (`set_alerts`,
`setAlerts`, `SetAlertsAsync`, and the plugin-level `set_plugin_alerts`,
`setPluginAlerts`, `SetPluginAlertsAsync`). They declare the kinds on their
`Capabilities` (`alert_kinds`, `alertKinds`, `AlertKinds`).

## What the household does with them

Settings › Alerts lists each plugin's kinds, with whether to show each one and
which notification channel gets it. Setting a kind's *Show it* to Off means
homeCore doesn't raise it at all, so automations that start on it keep
waiting.

The alert list shows plugin alerts with their buttons. People can mark one
seen, skip one (by its key), or ignore alerts like it for a while.

Automations can start when an alert is raised, clears, is marked seen or has
been active for a while. They can check whether alerts like it are active,
press an alert's button, wait until it clears, mark it seen or skip it, and do
any of that for each active alert in turn. Messages can use `{alert.device}`,
`{alert.key}` and the other alert fields. **Do something…** on any alert
creates such an automation. See
[Alerts that start automations](../rules/alert-automations.md).

WLED's "install firmware updates at night" automation works this way. At
03:00 it goes through each active *Firmware update available* alert, presses
its button and waits for the alert to clear. If a controller doesn't come
back, it stops and says so.

A plugin's own screens can read homeCore's alerts on its devices through
`host.alerts`. See [Screens and Cards](./plugin-screens#the-host).
