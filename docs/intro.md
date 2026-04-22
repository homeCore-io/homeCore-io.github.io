---
id: intro
title: HomeCore
sidebar_label: Introduction
sidebar_position: 1
slug: /
---

# HomeCore

**HomeCore** is a fast, local-first home automation platform written in Rust. It runs entirely on your hardware — no cloud accounts, no internet dependency, no subscription fees.

## What it emphasises

- **Rust, async first.** Built on Tokio for true concurrent I/O across devices.
- **MQTT as the universal fabric.** Plugins publish device state over MQTT topics; HomeCore publishes commands the same way. No hardwired transports.
- **Embedded MQTT broker (rumqttd).** Ships in the binary — no external broker needed for a basic install.
- **Rules as data.** Automations are RON files, hot-reloaded at runtime. Create, edit, and delete them via the API.
- **Fully local.** Solar calculations use local lat/lon. All automation logic runs offline. No cloud accounts, no subscription fees.

## Architecture at a glance

```
Physical devices (Zigbee, Z-Wave, WiFi, cloud APIs)
    ↕ MQTT
Embedded MQTT broker (rumqttd — no separate process)
    ↕ rumqttc client
HomeCore kernel
  ├── State bridge     — MQTT → typed events
  ├── Rule engine      — triggers / conditions / actions
  ├── Scheduler        — time, solar, cron
  ├── Mode manager     — named boolean modes + solar modes
  ├── Timer manager    — countdown timer virtual devices
  ├── Switch manager   — virtual on/off flag devices
  └── REST + WS API    — everything over HTTP/WebSocket
Plugins (separate processes, any language)
  ├── hc-hue, hc-yolink, hc-lutron, hc-sonos
  ├── hc-zwave, hc-wled, hc-isy
  └── Your plugin (Rust/Python/Node/.NET SDK)
```

## Key design principles

1. **MQTT as the device fabric** — every device communicates via MQTT topics. Plugins publish state; HomeCore publishes commands. Nothing is hardwired.
2. **Rules are data** — automations are RON files hot-reloaded at runtime. Create, edit, and delete rules through the API with no restart.
3. **API-first** — every operation is available over REST or WebSocket. The web UI is just another API consumer.
4. **No cloud dependency** — solar calculations use local lat/lon config. All automation logic runs offline.
5. **Side-effect-free conditions** — rule conditions only read state. Dry-run and test mode work because conditions never have side effects.
6. **Plugin isolation at the MQTT layer** — each plugin has its own credential + declared ACL patterns in `[[broker.clients]]`. The embedded rumqttd enforces CONNECT authn; for real per-topic enforcement (containers, third-party plugins, compliance), deploy against an external Mosquitto broker. See [the broker deployment guide](/administration/broker#external-mosquitto-deployment).

## License

All HomeCore repositories are dual-licensed under **MIT** and **Apache-2.0**. You may use either license at your option.

## Quick navigation

| I want to… | Go to |
|---|---|
| Install and run for the first time | [Installation](./getting-started/installation) |
| Get something working in 5 minutes | [Quick Start](./getting-started/quickstart) |
| Understand the full config file | [Configuration](./getting-started/configuration) |
| Write my first automation rule | [Rules Overview](./rules/overview) |
| Connect a specific device | [Plugins](./plugins/overview) |
| Add HomeCore to Docker | [Docker](./getting-started/docker) |
| Build a plugin | [Plugin Development](./plugins/developing-plugins) |
| Contribute to the core | [Dev Workflow](./development/dev-workflow) |
