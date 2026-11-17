---
id: intro
title: homeCore
sidebar_label: Introduction
sidebar_position: 1
slug: /
---

# homeCore

homeCore is home automation that runs on your own hardware. Core is written in Rust. It needs no cloud account, no subscription, and no internet connection to run the house.

A normal install is two containers: core, which holds the devices, rules and the API, and the web app, which is what the household and the admins use. Plugins connect core to your hardware, and you install them from the app's Catalog.

## How it fits together

```
Physical devices (Zigbee, Z-Wave, Wi-Fi, hubs, cloud APIs)
    ↕
Plugins (separate processes)
  ├── Rust plugins core runs itself: hc-hue, hc-lutron, hc-caseta, hc-yolink,
  │   hc-zwave, hc-sonos, hc-wled, hc-roku, hc-isy, hc-ecowitt, hc-reolink,
  │   hc-mysa, hc-nuheat, hc-thermostat, hc-weather
  ├── Python plugins in a plugin runtime, such as the Assistant (hc-mcp)
  └── Your own (Rust, Python, Node or .NET SDK)
    ↕ MQTT
Embedded MQTT broker (rumqttd, inside core)
    ↕
homeCore core
  ├── State bridge: MQTT messages become typed device events
  ├── Rule engine: triggers, conditions, actions
  ├── Scheduler: times, cron, sunrise and sunset, calendars
  ├── Modes: day, night and your own on/off modes
  ├── Helpers: timers, switches, counters and other virtual devices
  ├── Plugin supervisor: install, start, watch, configure
  └── REST and WebSocket API
    ↕ /api/v1
Web app (hc-web-svelte), hc-tui, the Assistant, your scripts
```

## How it works

- Every device talks over MQTT. Plugins publish device state, and core sends commands back the same way. Core has its own broker built in, so a basic install needs nothing else.
- Rules are RON files in a folder. Core reloads them when they change, and the API and the app can create, edit and delete them without a restart.
- Everything goes through the API. The [web app](./web-ui/overview) is one client of it, with its own repository and container. [hc-tui](./tools/hc-tui) and [hc-mcp](./tools/hc-mcp) use the same API, and so can your own scripts.
- Sunrise and sunset come from the latitude and longitude in your config, so time rules work offline.
- Rule conditions only read state. That is why a dry run or test of a rule is safe.
- Each plugin can have its own broker login in `[[broker.clients]]`. The embedded broker checks logins when a client connects, but it does not enforce the per-topic `allow_pub` and `allow_sub` lists. If you need that, run Mosquitto instead; the [broker guide](./administration/broker#external-mosquitto-deployment) explains how.

## License

All homeCore repositories are dual licensed under MIT and Apache-2.0. You may use either one.

## Where to go next

| I want to… | Go to |
|---|---|
| Install homeCore (the usual way) | [Docker](./getting-started/docker) |
| See the other ways to install | [Installation](./getting-started/installation) |
| Try the API in a few minutes | [Quick Start](./getting-started/quickstart) |
| Learn the app | [Web UI overview](./web-ui/overview) |
| Understand the config file | [Configuration](./getting-started/configuration) |
| Write my first automation | [Rules overview](./rules/overview) |
| Connect a kind of device | [Plugins](./plugins/overview) |
| Move homeCore to a new machine | [Migration](./getting-started/migration) |
| Build a plugin | [Plugin development](./plugins/developing-plugins) |
| Work on core itself | [Dev workflow](./development/dev-workflow) |
