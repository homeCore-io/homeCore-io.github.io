---
id: workspace
title: Workspace Layout
sidebar_label: Workspace Layout
sidebar_position: 1
---

# Workspace Layout

## Repository structure

The workspace root (`homeCore/`) is not a git repository. Each
subdirectory is its own independent git repo. `workspace.toml` lists
all repos. There are also three **per-category meta-layout
workspaces** at `plugins/Cargo.toml`, `clients/Cargo.toml`, and
`sdks/Cargo.toml` — these are local-dev only (not in any git repo) and
absorb every member underneath them into a shared workspace for one
Cargo.lock per category. See [Meta-layout](#meta-layout) below.

```
homeCore/
├── workspace.toml              ← authoritative repo list
├── plugins/Cargo.toml          ← meta-layout: every plugin as a workspace member
├── clients/Cargo.toml          ← meta-layout: the Rust clients (hc-tui)
├── sdks/Cargo.toml             ← meta-layout: hc-plugin-sdk-rs
├── .cargo/config.toml          ← profile + (no patches — those are per-category)
│
├── hc-scripts/                 ← workspace-clone.sh, run-dev.sh, build-archive.sh,
│                                  reusable GitHub Actions workflows (rust-ci.yml,
│                                  rust-release.yml)
│
├── core/                       ← main HomeCore server (git repo: homeCore-io/homeCore)
│   ├── Cargo.toml              ← internal workspace (16 crates)
│   ├── Cargo.lock
│   ├── config/
│   │   ├── homecore.toml.example   ← committed; user-tracked TOMLs are gitignored
│   │   ├── homecore.dev.toml       ← dev config (plugin binary paths point at
│   │   │                              `../plugins/target/debug/<name>` — the shared
│   │   │                              meta-layout target dir)
│   │   ├── modes.toml          ← solar + named boolean mode definitions
│   │   └── profiles/examples/  ← reference profiles (Shelly, Tasmota, Zigbee2MQTT, …)
│   ├── crates/
│   │   ├── hc-types/           ← shared types
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
│   ├── src/                    ← homecore binary (main.rs)
│   ├── rules/examples/         ← documented rule patterns
│   └── tests/                  ← integration tests
│
├── plugins/                    ← device adapter plugins (each is its own git repo)
│   ├── hc-yolink/              ← YoLink cloud MQTT bridge
│   ├── hc-lutron/              ← Lutron RadioRA2 telnet
│   ├── hc-caseta/              ← Lutron Caséta
│   ├── hc-sonos/               ← Sonos UPnP
│   ├── hc-hue/                 ← Philips Hue
│   ├── hc-wled/                ← WLED LED controllers
│   ├── hc-zwave/               ← zwave-js WebSocket bridge
│   ├── hc-isy/                 ← ISY/IoX (Insteon, Z-Wave gateway)
│   ├── hc-thermostat/          ← virtual thermostat (sensors + actuator)
│   ├── hc-ecowitt/             ← Ecowitt weather stations
│   ├── hc-roku/                ← Roku TVs and players (ECP)
│   └── hc-captest/             ← capability-spec conformance test plugin
│
├── clients/                    ← UI and API consumers
│   ├── hc-web/                 ← Flutter web dashboard — THE web UI
│   ├── hc-tui/                 ← Terminal UI (ratatui)
│   ├── hc-mcp/                 ← MCP server (Python)
│   └── hc-web-leptos/          ← retired Leptos/WASM admin, kept for reference
│
└── sdks/                       ← Plugin SDKs
    ├── hc-plugin-sdk-rs/       ← Rust SDK (used by every Rust plugin)
    ├── hc-plugin-sdk-py/       ← Python SDK
    ├── hc-plugin-sdk-js/       ← Node.js SDK
    └── hc-plugin-sdk-dotnet/   ← .NET SDK
```

---

## Meta-layout

Each component (core + plugins + sdks + clients) is its own GitHub
repo with its own `Cargo.toml`. Standalone CI clones must build
without the meta-layout, so committed `Cargo.toml` files use **git
deps with `branch = "main"`** for cross-repo references.

For local development that's friction — every cross-repo edit would
need a commit and push before another component picked it up. The
meta-layout solves it by absorbing every member into a parent
workspace **at category level**:

| Workspace manifest | Members | Why |
|---|---|---|
| `plugins/Cargo.toml` | The 12 released + test plugin path-members | Shared `[patch]` for `hc-types`, `hc-logging`, `plugin-sdk-rs` |
| `clients/Cargo.toml` | The Rust clients — `hc-tui` (and the retired `hc-web-leptos`) | Shared `[patch]` for `hc-types`. hc-web is Flutter and hc-mcp is Python, so neither is a member |
| `sdks/Cargo.toml` | `hc-plugin-sdk-rs` | Shared `[patch]` for `hc-types`, `hc-logging` |
| `core/Cargo.toml` | core's 16 internal crates | Already its own workspace; per-repo `[patch]` for `hc-captest`'s transitive `hc-types` |

The meta-layout files are **local-only** — they aren't in any git
repo. New contributors set up the meta-layout by hand-copying from an
existing tree (or via a future `hc-scripts` setup script).

**What this buys:**
- Edit `core/crates/hc-types/src/...` → every plugin and client picks
  up the change immediately on next `cargo build`.
- Per-repo `Cargo.lock` files stay quiescent during local dev — only
  the per-category lockfiles are touched.
- Standalone CI clones don't see the meta-layout; they fall back to
  single-package mode and write their own `Cargo.lock` cleanly.
- No `[[patch.unused]]` churn (an earlier global-patches setup
  produced one entry per unused patch in every Cargo.lock — the
  per-category split eliminated it).

**Build outputs land in the shared workspace target dir.** When you
run `cargo build` from inside `plugins/hc-hue/` (or via
`run-dev.sh`'s `--manifest-path plugins/Cargo.toml -p hc-hue`), the
binary lands at `plugins/target/debug/hc-hue` — *not* the per-plugin
`plugins/hc-hue/target/debug/hc-hue`. `core/config/homecore.dev.toml`
points at the shared path. If you ever see "code edits don't take
effect after plugin restart", check that you didn't end up running an
old per-plugin binary.

**Adding a new plugin?** Add it to `plugins/Cargo.toml` workspace
members, and make sure its committed `Cargo.toml` has no `[workspace]`
sentinel (cargo would reject the parent absorption).

**Adding a new cross-repo dep?** Add a path entry to the relevant
workspace's `[patch]` block (`plugins/`, `clients/`, or `sdks/`).
Don't touch `.cargo/config.toml`.

### The non-Rust SDKs

The meta-layout is a cargo mechanism, so it covers `hc-plugin-sdk-rs` and
nothing else. A Python, Node.js or .NET plugin points at its SDK's checkout
directly, from the plugin's own directory:

```bash
pip install -e ../../sdks/hc-plugin-sdk-py
npm install ../../sdks/hc-plugin-sdk-js
dotnet add reference ../../sdks/hc-plugin-sdk-dotnet/HomeCoreSdk.csproj
```

All three link rather than copy — pip's `-e`, npm's directory install, and a
.NET project reference — so an SDK edit is live in the plugin without a
reinstall, the same property the `[patch]` block gives Rust.

**None of the SDKs is published to a package registry.** Not crates.io, PyPI,
npm or NuGet. Outside the workspace they install from a git tag; see
[Installing an SDK](../plugins/developing-plugins#installing-an-sdk).

The full design + history is at
[`claude-notes/project_cross_repo_deps.md`](https://github.com/homeCore-io/homeCore/blob/develop/claude-notes/project_cross_repo_deps.md)
in the homeCore repo.

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
| Embedded MQTT broker | `rumqttd` | 0.20 |
| MQTT client | `rumqttc` | 0.25 |
| HTTP + WebSocket API | `axum` | 0.7 |
| Device registry | `redb` | 2 |
| Time-series history | `rusqlite` (bundled) | 0.31 |
| Scripting | `rhai` | 1 |
| Serialization | `serde` + `serde_json` | 1 |
| Config | `toml` | 0.8 |
| JWT auth | `jsonwebtoken` | - |
| Password hashing | `argon2` | - |
| OpenAPI spec | hand-maintained `core/docs/openapi.yaml` (3.1.0), checked against the router by `tests/openapi_covers_router_test.rs` | — |
| File watching | `notify` | 6 |
| Error handling | `anyhow` (bins) + `thiserror` (libs) | - |
| Logging | `tracing` + `tracing-appender` | - |
