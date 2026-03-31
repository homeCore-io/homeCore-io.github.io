---
id: workspace
title: Workspace Layout
sidebar_label: Workspace Layout
sidebar_position: 1
---

# Workspace Layout

## Repository structure

The workspace root (`homeCore/`) is not a git repository. Each subdirectory is its own independent git repo. `workspace.toml` lists all repos.

```
homeCore/
├── workspace.toml              ← authoritative repo list
├── scripts/
│   ├── run-dev.sh              ← build all + start server (debug)
│   ├── deploy.sh               ← build + install to /var/tmp/homeCore
│   └── workspace-clone.sh      ← clone all repos in workspace.toml
│
├── core/                       ← main HomeCore server (git repo: homeCore-io/homeCore)
│   ├── Cargo.toml              ← workspace Cargo manifest
│   ├── Cargo.lock
│   ├── config/
│   │   ├── homecore.toml       ← main config (production)
│   │   ├── homecore.dev.toml   ← dev config (plugin paths: ../plugins/hc-*/target/debug/*)
│   │   ├── modes.toml          ← solar + named boolean mode definitions
│   │   └── profiles/           ← ecosystem profiles (Shelly, Tasmota, Zigbee2MQTT, etc.)
│   │       └── examples/       ← reference profiles (not auto-loaded)
│   ├── crates/
│   │   ├── hc-types/           ← shared types: Event, DeviceState, Rule, MqttMessage
│   │   ├── hc-broker/          ← rumqttd embedded broker + TLS config
│   │   ├── hc-mqtt-client/     ← rumqttc async client → internal event bus
│   │   ├── hc-topic-map/       ← pattern-based topic translation, Rhai transforms
│   │   ├── hc-core/            ← rule engine, scheduler, state bridge, virtual devices
│   │   ├── hc-state/           ← device registry (redb), history (SQLite), schemas
│   │   ├── hc-api/             ← axum HTTP + WebSocket server, all REST handlers
│   │   ├── hc-auth/            ← JWT HS256, Argon2id passwords, MQTT bcrypt creds
│   │   ├── hc-scripting/       ← Rhai sandboxed runtime (conditions + action scripts)
│   │   ├── hc-logging/         ← tracing setup, rolling files, log stream ring buffer
│   │   └── hc-notify/          ← notification delivery (Pushover, email, Telegram)
│   ├── src/                    ← homecore binary crate (main.rs)
│   ├── plugins/
│   │   ├── plugin-sdk-rs/      ← Rust plugin SDK
│   │   ├── plugin-sdk-py/      ← Python plugin SDK
│   │   ├── plugin-sdk-js/      ← Node.js plugin SDK
│   │   └── examples/
│   │       ├── virtual-device/ ← software-only test device (Rust)
│   │       └── http-poller/    ← generic HTTP polling adapter (Rust)
│   ├── rules/                  ← live automation rules (TOML, hot-reloaded)
│   │   └── examples/           ← documented rule patterns
│   ├── tests/
│   │   └── integration_test.rs ← end-to-end: virtual device → rule → command
│   └── docs/
│       └── devNotes.md         ← developer reference (detailed implementation notes)
│
├── plugins/                    ← device adapter plugins (each is its own git repo)
│   ├── hc-yolink/
│   ├── hc-lutron/
│   ├── hc-sonos/
│   ├── hc-hue/
│   ├── hc-wled/
│   ├── hc-zwave/
│   ├── hc-isy/
│   └── hc-plugin-template/
│
└── clients/                    ← UI and API consumers (each is its own git repo)
    ├── hc-web/                 ← Flutter web dashboard
    ├── hc-web-svelte/          ← Svelte web client
    ├── hc-tui/                 ← Terminal UI (ratatui)
    └── hc-mcp/                 ← MCP server for Claude integration
```

## Crate dependency order

Understanding this chain matters: changing a lower crate causes everything above it to recompile.

```
hc-types          ← shared types only; no deps on other hc-* crates
  ├── hc-auth     ← JWT, passwords, user model
  ├── hc-broker   ← embedded MQTT broker
  ├── hc-state    ← redb device registry + SQLite history
  ├── hc-scripting← Rhai runtime
  └── hc-topic-map← topic translation + Rhai transforms
        └── hc-mqtt-client  ← MQTT client → event bus
              └── hc-core   ← rule engine, scheduler, state bridge
                    └── hc-api  ← axum HTTP/WS server
                          └── homecore (binary)
```

**Rule of thumb:** Change only `hc-api` → only `hc-api` and `homecore` recompile (~5s). Change `hc-types` → everything recompiles (~60s).

## Technology stack

| Concern | Library | Version |
|---|---|---|
| Async runtime | `tokio` | 1 |
| Embedded MQTT broker | `rumqttd` | 0.19 |
| MQTT client | `rumqttc` | 0.24 |
| HTTP + WebSocket API | `axum` | 0.7 |
| Device registry | `redb` | 2 |
| Time-series history | `rusqlite` (bundled) | 0.31 |
| Scripting | `rhai` | 1 |
| Serialization | `serde` + `serde_json` | 1 |
| Config | `toml` | 0.8 |
| JWT auth | `jsonwebtoken` | - |
| Password hashing | `argon2` | - |
| OpenAPI generation | `utoipa` | 4 |
| File watching | `notify` | 6 |
| Error handling | `anyhow` (bins) + `thiserror` (libs) | - |
| Logging | `tracing` + `tracing-appender` | - |
