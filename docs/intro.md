---
id: intro
title: HomeCore
sidebar_label: Introduction
sidebar_position: 1
slug: /
---

# HomeCore

**HomeCore** is a fast, local-first home automation platform written in Rust. It runs entirely on your hardware — no cloud accounts, no internet dependency, no subscription fees.

## What makes it different

| Feature | HomeCore | Home Assistant | HomeSeer |
|---|---|---|---|
| Language | Rust | Python | .NET |
| Async model | True async (Tokio) | Single-threaded event loop | Multi-threaded |
| MQTT broker | Embedded (no external process) | Optional add-on | Plugin |
| Device communication | MQTT as universal fabric | Varies | Varies |
| Rule storage | TOML files, hot-reload | YAML/UI | UI only |
| Cloud dependency | None | Optional | Optional |

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
  └── Your plugin (Rust/Python/Node SDK)
```

## Key design principles

1. **MQTT as the device fabric** — every device communicates via MQTT topics. Plugins publish state; HomeCore publishes commands. Nothing is hardwired.
2. **Rules are data** — automations are TOML files hot-reloaded at runtime. Create, edit, and delete rules through the API with no restart.
3. **API-first** — every operation is available over REST or WebSocket. The web UI is just another API consumer.
4. **No cloud dependency** — solar calculations use local lat/lon config. All automation logic runs offline.
5. **Side-effect-free conditions** — rule conditions only read state. Dry-run and test mode work because conditions never have side effects.
6. **Plugin isolation via MQTT ACL** — each plugin gets its own credential, restricting it to its own device topics.

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
