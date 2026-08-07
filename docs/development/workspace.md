---
id: workspace
title: Workspace Layout
sidebar_label: Workspace Layout
sidebar_position: 1
---

# Workspace Layout

## Repository structure

The workspace root (`homeCore/`) is not a git repository — each
subdirectory under it is its own git repo, and `workspace.toml` lists
them. The big one is `core/`, which holds the server, its crates, the
Rust SDK and every Rust plugin as members of a single cargo workspace.

```
homeCore/
├── workspace.toml              ← authoritative repo list
│
├── hc-scripts/                 ← workspace-clone.sh, run-dev.sh, build-archive.sh,
│                                  reusable GitHub Actions workflows (rust-ci.yml,
│                                  rust-release.yml)
│
├── core/                       ← THE monorepo (git repo: homeCore-io/homeCore)
│   ├── Cargo.toml              ← virtual workspace: server + 17 crates + SDK + 13 plugins
│   ├── Cargo.lock              ← one lockfile for all of it
│   ├── config/
│   │   ├── homecore.toml.example   ← committed; user-tracked TOMLs are gitignored
│   │   ├── homecore.dev.toml       ← dev config (plugin binaries at target/debug/<name>)
│   │   ├── modes.toml          ← solar + named boolean mode definitions
│   │   └── profiles/examples/  ← reference profiles (Shelly, Tasmota, Zigbee2MQTT, …)
│   ├── homecore/               ← the server binary — a member like any other
│   │   ├── src/main.rs
│   │   └── tests/              ← integration tests
│   ├── crates/
│   │   ├── hc-types/           ← shared types (also the plugin ABI)
│   │   ├── hc-broker/          ← rumqttd embedded broker
│   │   ├── hc-mqtt-client/     ← rumqttc async client → internal event bus
│   │   ├── hc-topic-map/       ← pattern-based topic translation, Rhai transforms
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
│   ├── sdk/rust/               ← the Rust plugin SDK (crate `plugin-sdk-rs`)
│   ├── plugins/                ← every Rust plugin, as workspace members
│   │   ├── hc-yolink/          ← YoLink cloud MQTT bridge
│   │   ├── hc-lutron/          ← Lutron RadioRA2 telnet
│   │   ├── hc-caseta/          ← Lutron Caseta
│   │   ├── hc-sonos/           ← Sonos UPnP
│   │   ├── hc-hue/             ← Philips Hue
│   │   ├── hc-wled/            ← WLED LED controllers
│   │   ├── hc-zwave/           ← zwave-js WebSocket bridge
│   │   ├── hc-isy/             ← ISY/IoX (Insteon, Z-Wave gateway)
│   │   ├── hc-thermostat/      ← virtual thermostat (sensors + actuator)
│   │   ├── hc-ecowitt/         ← Ecowitt weather stations
│   │   ├── hc-roku/            ← Roku TVs and players (ECP)
│   │   ├── hc-captest/         ← capability-spec conformance test plugin
│   │   └── hc-plugin-template/ ← the starting point for a new plugin
│   └── rules/examples/         ← documented rule patterns
│
├── plugins/                    ← plugins that are NOT Rust, so not members above
│   └── hc-matter/              ← Matter bridge (TypeScript, matter.js)
│
├── clients/                    ← UI and API consumers
│   ├── hc-web/                 ← Flutter web dashboard — THE web UI
│   ├── hc-tui/                 ← Terminal UI (ratatui)
│   ├── hc-mcp/                 ← MCP server (Python)
│   └── hc-web-leptos/          ← retired Leptos/WASM admin, kept for reference
│
└── sdks/                       ← the non-Rust plugin SDKs
    ├── hc-plugin-sdk-py/       ← Python SDK
    ├── hc-plugin-sdk-js/       ← Node.js SDK
    └── hc-plugin-sdk-dotnet/   ← .NET SDK
```

---

## One workspace, one lockfile

Everything Rust that ships together builds together. `cargo build`,
`cargo test`, `cargo clippy` and `cargo fmt` at `core/`'s root cover the
server, all 17 crates, the SDK and all thirteen plugins in one pass.

**What this buys:**

- Edit `crates/hc-types/src/...` → every plugin picks it up on the next
  build, with no commit, tag or reinstall in between.
- A change that breaks a plugin fails in that same CI run, rather than
  weeks later at the plugin's next release. `hc-types` is the plugin
  ABI, so this matters more than it sounds.
- One `Cargo.lock`, so the revision that builds is the revision that
  ships. Cloning `core/` gets you a tree that compiles.
- Feature unification is honest: a plugin that only compiled because a
  sibling happened to enable a feature fails here. That is exactly how
  hc-hue's missing `schema` feature was caught.

**Adding a new plugin?** Create the directory under `core/plugins/` and
add it to `[workspace] members` in `core/Cargo.toml`. That is the whole
registration — CI and the release pipeline both derive what they need
from the directory.

:::note This replaced a three-workspace arrangement
Plugins, clients and SDKs each used to be separate git repos absorbed by
a local-only "meta-layout" workspace (`plugins/Cargo.toml`,
`clients/Cargo.toml`, `sdks/Cargo.toml`) carrying `[patch]` tables that
redirected git dependencies to local checkouts. Committed manifests
pinned git tags; the patches made local edits visible.

It worked, but a plugin's real dependency graph only existed on a
developer's machine, and those meta-workspaces would hijack the shipped
`Cargo.lock` and silently unify features — a green local build proved
little. Folding the Rust tree into one repo removed the mechanism
entirely. The old plugin repos are archived read-only; their releases
still back registry entries, so they are kept rather than deleted.

The design and history are in
[`docs/monorepo-plan.md`](https://github.com/homeCore-io/homeCore/blob/develop/docs/monorepo-plan.md).
:::

### The non-Rust components

`plugins/hc-matter` (TypeScript), `clients/hc-web` (Flutter),
`clients/hc-mcp` (Python) and the three non-Rust SDKs stay separate
repos, for the obvious reason: cargo cannot absorb them. A Python,
Node.js or .NET plugin points at its SDK's checkout directly:

```bash
pip install -e ../../sdks/hc-plugin-sdk-py
npm install ../../sdks/hc-plugin-sdk-js
dotnet add reference ../../sdks/hc-plugin-sdk-dotnet/HomeCoreSdk.csproj
```

All three link rather than copy — pip's `-e`, npm's directory install, and a
.NET project reference — so an SDK edit is live in the plugin without a
reinstall.

**None of the SDKs is published to a package registry.** Not crates.io, PyPI,
npm or NuGet. See
[Installing an SDK](../plugins/developing-plugins#installing-an-sdk).

## The web UI (`hc-web`)

`clients/hc-web/` is a Flutter application targeting the browser, and it
is the web UI. It is not a Cargo workspace member and does not build with
the rest of the tree — `flutter build web` produces the bundle, and its
own Dockerfile wraps that in an nginx image which also proxies `/api/v1`
to core.

`clients/hc-web-leptos/` is the retired Leptos/WASM admin that core used
to bake into its own binary. It is still a workspace member so the tree
keeps building, but nothing ships it. See
[Web UI overview](../web-ui/overview.md).

## Crate dependency order

Understanding this chain matters: changing a lower crate causes everything above it to recompile.

```
hc-types          ← shared types only; no deps on other hc-* crates
  ├── hc-auth     ← JWT, passwords, user model
  ├── hc-broker   ← embedded MQTT broker
  ├── hc-state    ← redb device registry + SQLite history
  ├── hc-scripting← Rhai runtime
  ├── hc-logging  ← tracing setup, rolling files, log stream
  ├── hc-topic-map← topic translation + Rhai transforms
  │     └── hc-mqtt-client  ← MQTT client → event bus
  │           └── hc-core   ← rule engine, scheduler, state bridge
  │                 └── hc-api  ← axum HTTP/WS server
  │                       └── homecore (binary)
  └── sdk/rust (plugin-sdk-rs)  ← re-exports hc-types + hc-logging
        └── plugins/hc-*        ← every Rust plugin
```

**Rule of thumb:** Change only `hc-api` → only `hc-api` and `homecore` recompile (~5s). Change `hc-types` → everything recompiles (~60s), *including all thirteen plugins* — which is the point: `hc-types` is the plugin ABI, and this is where an incompatible change is caught.

## Technology stack

Versions below are the `[workspace.dependencies]` entries in
`core/Cargo.toml`, which is where they are declared once for every member.

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
| JWT auth | `jsonwebtoken` | - |
| Password hashing | `argon2` | 0.5 |
| OpenAPI spec | hand-maintained `core/docs/openapi.yaml` (3.1.0), checked against the router by `tests/openapi_covers_router_test.rs` | — |
| File watching | `notify` | 8 |
| Error handling | `anyhow` (bins) + `thiserror` (libs) | 1 / 2 |
| Logging | `tracing` + `tracing-appender` | - |
