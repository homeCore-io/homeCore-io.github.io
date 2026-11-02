---
id: workspace
title: Workspace Layout
sidebar_label: Workspace Layout
sidebar_position: 1
---

# Workspace Layout

## Repository structure

The workspace root (`homeCore/`) is not a git repository. Each
subdirectory under it is its own git repo, and `workspace.toml` lists
them. The largest is `core/`, which holds the server, its crates, the
Rust SDK and every Rust plugin as members of a single cargo workspace.

```
homeCore/
├── workspace.toml              ← authoritative repo list (symlink into hc-scripts/)
├── Justfile                    ← workspace recipes (symlink to hc-scripts/Justfile.workspace)
│
├── hc-scripts/                 ← workspace-clone.sh, run-dev.sh, deploy.sh,
│                                  build-archive.sh, reusable GitHub Actions workflows
│                                  (rust-ci.yml, rust-release.yml, node-ci.yml, …)
│
├── core/                       ← THE monorepo (git repo: homeCore-io/homeCore)
│   ├── Cargo.toml              ← virtual workspace: server + 17 crates + SDK + 15 plugins
│   ├── Cargo.lock              ← one lockfile for all of it
│   ├── config/
│   │   ├── homecore.toml.example   ← reference config
│   │   ├── homecore.dev.toml       ← dev config (plugin binaries at target/debug/<name>)
│   │   ├── modes.toml          ← solar + named boolean mode definitions
│   │   └── profiles/examples/  ← reference topic-mapper profiles (Shelly, Tasmota, Zigbee2MQTT, …)
│   ├── homecore/               ← the server binary, a member like any other
│   │   ├── src/main.rs
│   │   └── tests/              ← integration tests
│   ├── crates/
│   │   ├── hc-types/           ← shared types (also the plugin ABI)
│   │   ├── hc-broker/          ← rumqttd embedded broker
│   │   ├── hc-mqtt-client/     ← rumqttc async client → internal event bus
│   │   ├── hc-topic-map/       ← pattern-based topic translation for non-plugin devices
│   │   ├── hc-core/            ← rule engine, scheduler, state bridge, glue devices
│   │   ├── hc-state/           ← device registry (redb), history (SQLite), schemas
│   │   ├── hc-api/             ← axum HTTP + WebSocket
│   │   ├── hc-auth/            ← JWT HS256, Argon2id, MQTT creds, API keys
│   │   ├── hc-scripting/       ← Rhai sandboxed runtime
│   │   ├── hc-logging/         ← tracing setup, rolling files, log stream
│   │   ├── hc-notify/          ← Pushover, email, Telegram
│   │   ├── hc-config/          ← config model + the descriptor the UI's forms read
│   │   ├── hc-influx/          ← optional InfluxDB v2 export of device state
│   │   ├── hc-time/            ← configured-timezone helpers (never `chrono::Local`)
│   │   ├── hc-api-types/       ← request/response types shared with Rust clients
│   │   ├── hc-web-admin/       ← optional static-file mount for a pre-built UI
│   │   └── hc-cli/             ← admin CLI (issuance, broker config gen, …)
│   ├── runtime-host/           ← hc-runtime-host: hosts plugins written in other languages
│   ├── sdk/rust/               ← the Rust plugin SDK (crate `plugin-sdk-rs`)
│   ├── sdk/ui/                 ← `@homecore/plugin-ui`: types for a plugin's own screens
│   └── plugins/                ← every Rust plugin, as workspace members
│       ├── hc-yolink/          ← YoLink cloud MQTT bridge
│       ├── hc-lutron/          ← Lutron RadioRA2 telnet
│       ├── hc-caseta/          ← Lutron Caseta
│       ├── hc-sonos/           ← Sonos UPnP
│       ├── hc-hue/             ← Philips Hue
│       ├── hc-wled/            ← WLED LED controllers
│       ├── hc-zwave/           ← zwave-js WebSocket bridge
│       ├── hc-isy/             ← ISY/IoX (Insteon, Z-Wave gateway)
│       ├── hc-thermostat/      ← virtual thermostat (sensors + actuator)
│       ├── hc-ecowitt/         ← Ecowitt weather stations
│       ├── hc-roku/            ← Roku TVs and players (ECP)
│       ├── hc-nuheat/          ← NuHeat Signature floor-heating thermostats
│       ├── hc-weather/         ← Open-Meteo weather + national weather service warnings
│       ├── hc-captest/         ← capability-spec conformance test plugin
│       └── hc-plugin-template/ ← the starting point for a new plugin
│
├── plugins/                    ← plugins that are NOT Rust, so not members above
│   └── hc-matter/              ← Matter bridge (TypeScript, matter.js)
├── plugins-py/                 ← every Python plugin, one repo (homeCore-io/hc-plugins-py)
│
├── clients/                    ← UI and API consumers
│   ├── hc-web-svelte/          ← the web app (SvelteKit) and its UI server
│   ├── hc-tui/                 ← Terminal UI (ratatui)
│   ├── hc-mcp/                 ← MCP server (Python)
│   ├── hc-web-flutter/         ← retired Flutter app, kept for reference
│   ├── hc-web-lit/             ← retired, kept for reference
│   └── hc-web-leptos/          ← retired Leptos/WASM admin, kept for reference
│
├── sdks/                       ← the non-Rust plugin SDKs
│   ├── hc-plugin-sdk-py/       ← Python SDK
│   ├── hc-plugin-sdk-js/       ← Node.js SDK
│   └── hc-plugin-sdk-dotnet/   ← .NET SDK
│
└── homeCore-io.github.io/      ← this documentation site
```

In `core/config/`, `homecore.local.toml` and the `plugins/` directory are
gitignored because they can hold credentials. A fresh machine gets every
repo in the list with `./hc-scripts/workspace-clone.sh`, which reads
`workspace.toml` and clones whatever is missing.

---

## One workspace, one lockfile

Everything Rust that ships together builds together. `cargo build`,
`cargo test`, `cargo clippy` and `cargo fmt` at `core/`'s root cover the
server, all 17 crates, the runtime host, the SDK and every plugin in one
pass.

What this gets you:

- Edit `crates/hc-types/src/...` and every plugin picks it up on the next
  build. There is no commit, tag or reinstall in between.
- A change that breaks a plugin fails in the same CI run, not weeks later
  at the plugin's next release. `hc-types` is the plugin ABI, so this
  catches real breakage.
- One `Cargo.lock`, so the revision that builds is the revision that
  ships. Cloning `core/` gets you a tree that compiles.
- Feature unification is honest. A plugin that only compiled because a
  sibling happened to enable a feature fails here; that is how hc-hue's
  missing `schema` feature was caught.

To add a new plugin, create its directory under `core/plugins/` and add it
to `[workspace] members` in `core/Cargo.toml`. Nothing else needs
registering: CI and the release pipeline derive what they need from the
directory.

:::note This replaced a three-workspace arrangement
Plugins, clients and SDKs used to be separate git repos absorbed by a
local-only "meta-layout" workspace (`plugins/Cargo.toml`,
`clients/Cargo.toml`, `sdks/Cargo.toml`) carrying `[patch]` tables that
redirected git dependencies to local checkouts. Committed manifests
pinned git tags, and the patches made local edits visible.

It worked, but a plugin's real dependency graph only existed on a
developer's machine. The meta-workspaces also hijacked the shipped
`Cargo.lock` and silently unified features, so a green local build proved
little. Folding the Rust tree into one repo removed the mechanism
entirely. The old plugin repos and `hc-plugin-sdk-rs` are archived
read-only. Their releases still back registry entries, so they are kept
rather than deleted.

The design and history are in
[`docs/monorepo-plan.md`](https://github.com/homeCore-io/homeCore/blob/develop/docs/monorepo-plan.md).
:::

### The non-Rust components

`plugins/hc-matter` (TypeScript), `plugins-py` (Python plugins),
`clients/hc-web-svelte` (SvelteKit), `clients/hc-mcp` (Python) and the
three non-Rust SDKs stay separate repos because cargo cannot absorb them.
`clients/hc-tui` and `clients/hc-web-leptos` are Rust but separate repos
too, each with its own lockfile; the workspace `Justfile` builds and
checks them on their own.

A Python, Node.js or .NET plugin points at its SDK's checkout directly:

```bash
pip install -e ../../sdks/hc-plugin-sdk-py
npm install ../../sdks/hc-plugin-sdk-js
dotnet add reference ../../sdks/hc-plugin-sdk-dotnet/HomeCoreSdk.csproj
```

All three link rather than copy (pip's `-e`, npm's directory install, and
a .NET project reference), so an SDK edit is live in the plugin without a
reinstall.

None of the SDKs is published to a package registry: not crates.io, PyPI,
npm or NuGet. See
[Installing an SDK](../plugins/developing-plugins#installing-an-sdk).

## The web app (`hc-web-svelte`)

`clients/hc-web-svelte/` is the web app: a SvelteKit application plus the
small Node UI server it runs in. The UI server serves the app, passes
`/api/v1` and the event stream through to core on the same origin, and
keeps the UI's own data (pages, themes, files). It is not part of the
cargo workspace and builds with `npm`. Tagged releases publish
`ghcr.io/homecore-io/hc-web-svelte`.

The other directories under `clients/hc-web-*` are retired.
`hc-web-flutter` stopped working with core v0.1.94, when core dropped the
dashboards its pages came from. `hc-web-leptos` is the Leptos/WASM admin
that core used to bake into its own binary; nothing ships it now. See the
[Web UI overview](../web-ui/overview.md).

## Crate dependency order

Changing a crate recompiles everything that depends on it, so it helps to
know the chain. These are the path dependencies declared in each
`Cargo.toml`:

```
hc-types, hc-time, hc-notify    ← no hc-* dependencies
  │
  ├── hc-auth, hc-broker, hc-mqtt-client, hc-topic-map, hc-influx   ← hc-types
  ├── hc-logging, hc-scripting                                      ← hc-types + hc-time
  ├── hc-state                                                      ← hc-types + hc-auth
  ├── hc-config        ← hc-types, hc-logging, hc-notify, hc-influx
  │
  ├── hc-core          ← hc-types, hc-time, hc-notify, hc-scripting, hc-state,
  │     │                hc-mqtt-client, hc-topic-map
  │     └── hc-api     ← hc-core and most of the above, plus hc-api-types, hc-web-admin
  │           └── homecore (binary)
  │
  └── sdk/rust (plugin-sdk-rs)   ← hc-types + hc-logging + hc-time
        ├── plugins/hc-*         ← every Rust plugin
        └── runtime-host
```

Rule of thumb: a change to `hc-api` recompiles only `hc-api` and
`homecore`. A change to `hc-types` recompiles everything, all the plugins
included. That is intended: `hc-types` is the plugin ABI, and this is
where an incompatible change gets caught.

## Technology stack

Versions are the `[workspace.dependencies]` entries in `core/Cargo.toml`,
where they are declared once for every member, unless noted otherwise.

| Concern | Library | Version |
|---|---|---|
| Async runtime | `tokio` | 1 |
| Embedded MQTT broker | `rumqttd` | 0.20 |
| MQTT client | `rumqttc` | 0.25 |
| HTTP + WebSocket API | `axum` | 0.8 |
| Device registry | `redb` | 4 |
| Time-series history | `rusqlite` (bundled) | 0.40 |
| Scripting | `rhai` | 1 |
| Serialization | `serde` + `serde_json` | 1 |
| Config | `toml` | 1 |
| Rule storage | `ron` | 0.12 |
| Schema derivation | `schemars` | 1 |
| JWT auth | `jsonwebtoken` | 11 (declared in `hc-auth`) |
| Password hashing | `argon2` | 0.5 |
| OpenAPI spec | hand-maintained `core/docs/openapi.yaml` (3.1.0), checked against the router by `tests/openapi_covers_router_test.rs` | n/a |
| File watching | `notify` | 8 |
| Error handling | `anyhow` (bins) + `thiserror` (libs) | 1 / 2 |
| Logging | `tracing` + `tracing-appender` | 0.1 / 0.2 |
