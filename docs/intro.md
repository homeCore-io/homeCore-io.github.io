---
id: intro
title: HomeCore
sidebar_label: Introduction
sidebar_position: 1
slug: /
---

# HomeCore

**HomeCore** is a local-first home automation platform written in Rust. It runs on your own hardware. You don't need a cloud account, an internet connection or a subscription for it to work.

## What it emphasises

- **Rust and async I/O.** Core is built on Tokio, so it talks to many devices at once without blocking.
- **MQTT as the device fabric.** Plugins publish device state on MQTT topics, and HomeCore sends commands the same way. No transport is hardwired.
- **An embedded MQTT broker.** `rumqttd` is built into the binary, so a basic install needs no separate broker.
- **Rules as data.** Automations are RON files that HomeCore reloads when they change. You can also create, edit and delete them through the API.
- **Local operation.** Sunrise and sunset come from the latitude and longitude in your config, and all automation logic runs offline.

## Architecture at a glance

```
Physical devices (Zigbee, Z-Wave, WiFi, cloud APIs)
    ↕ MQTT
Embedded MQTT broker (rumqttd — no separate process)
    ↕ rumqttc client
HomeCore kernel
  ├── State bridge       — MQTT → typed events
  ├── Rule engine        — triggers / conditions / actions
  ├── Scheduler          — time, cron, solar, calendars
  ├── Mode manager       — named boolean modes + solar modes
  ├── Glue devices       — timers, switches, virtual state for rules
  ├── Plugin supervisor  — install, spawn, health, config, notices
  └── REST + WS API      — everything over HTTP/WebSocket
Plugins (separate processes, any language)
  ├── hc-hue, hc-yolink, hc-lutron, hc-caseta, hc-sonos
  ├── hc-zwave, hc-wled, hc-isy, hc-roku, hc-ecowitt
  ├── hc-thermostat, hc-nuheat, hc-weather
  └── Your plugin (Rust/Python/Node/.NET SDK)
```

## Key design principles

1. **MQTT as the device fabric.** Every device communicates over MQTT topics. Plugins publish state and HomeCore publishes commands.
2. **Rules are data.** Automations are RON files reloaded at runtime. Creating, editing or deleting a rule through the API needs no restart.
3. **API first.** Every operation is available over REST or WebSocket. The [web app](./web-ui/overview) (`hc-web-svelte`) is one more API consumer, with its own repository and its own container. [hc-tui](./tools/hc-tui) and [hc-mcp](./tools/hc-mcp) use the same API.
4. **No cloud dependency.** Solar times are calculated from your configured location, and automation logic runs offline.
5. **Side-effect-free conditions.** Rule conditions only read state. That is what makes dry runs and test mode safe.
6. **Plugin isolation at the MQTT layer, with a limit.** Each plugin can have its own broker credential and declared topic patterns in `[[broker.clients]]`. The embedded `rumqttd` broker checks credentials on CONNECT, but it does not enforce the per-topic `allow_pub` / `allow_sub` patterns. The [broker guide](./administration/broker#external-mosquitto-deployment) covers what that means for your deployment.

## License

All HomeCore repositories are dual-licensed under **MIT** and **Apache-2.0**. You may use either license.

## Quick navigation

| I want to… | Go to |
|---|---|
| Install and run for the first time | [Installation](./getting-started/installation) |
| Get something working in a few minutes | [Quick Start](./getting-started/quickstart) |
| Understand the full config file | [Configuration](./getting-started/configuration) |
| Write my first automation rule | [Rules Overview](./rules/overview) |
| Connect a specific device | [Plugins](./plugins/overview) |
| Run HomeCore in Docker | [Docker](./getting-started/docker) |
| Move HomeCore to a new machine | [Migration](./getting-started/migration) |
| Build a plugin | [Plugin Development](./plugins/developing-plugins) |
| Contribute to the core | [Dev Workflow](./development/dev-workflow) |
