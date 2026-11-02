---
id: dev-workflow
title: Dev Workflow
sidebar_label: Dev Workflow
sidebar_position: 2
---

# Dev Workflow

## Toolchain

Use the Rust version CI and the release builds use (1.99.1 at the time of
writing; `rust_version` in hc-scripts' `rust-ci.yml` and `rust-release.yml`).
A newer local toolchain has a different clippy lint set, so code that passes
locally can fail CI. You also need Node.js 24 for plugin screens and the web
app, and `just`, `gh` and `jq` for the recipes and release steps.

homeCore picks its base directory from `--home`, then `HOMECORE_HOME`, then
the current directory (see `core/homecore/src/main.rs`). If your shell sets
`HOMECORE_HOME`, a bare `cargo run -p homecore` uses it wherever you start
it from.

## Running core

### A sandbox, not the house

Test against a sandbox homeCore: its own `--home` and `--config`, its own
broker port, and plugins pointed at stand-ins (small local emulators of
the device) instead of real hardware. Never test against the real house.
That means no discovery from a sandbox, since it would find real devices,
and no commands to real devices. Section 9 of
[`core/docs/plugin-development.md`](https://github.com/homeCore-io/homeCore/blob/develop/docs/plugin-development.md)
has the details.

The workspace `Justfile` has recipes for a local sandbox in
`<workspace>/sandbox/`. That directory is a real `HOMECORE_HOME` (config,
registry, redb state, `INITIAL_ADMIN_PASSWORD`), not build output, and no
`clean` recipe touches it.

```bash
just sandbox         # build the homecore binary (incremental), then run it on the sandbox
just sandbox-run     # run the existing binary without building
just sandbox-build   # build the whole workspace, reinstall the sandbox's plugins, then run
```

All three run `core/target/debug/homecore` with `--home sandbox` and
`--config sandbox/homecore.toml`. `sandbox-build` calls
`sandbox/reinstall-plugins.sh`, which you provide in your sandbox.

For a one-off throwaway instance, point `--home` at an empty directory:

```bash
cargo run -p homecore -- --home /tmp/hc-dev
```

Reset it by deleting its data:

```bash
rm -rf /tmp/hc-dev/data/
cargo run -p homecore -- --home /tmp/hc-dev
```

On first run, copy the admin password from the startup output (it is
also written to `INITIAL_ADMIN_PASSWORD` in the home directory).

### `run-dev.sh`

`hc-scripts/run-dev.sh` is the older all-in-one launcher, run from the
workspace root:

```bash
./hc-scripts/run-dev.sh             # pull, update, build, run (debug)
./hc-scripts/run-dev.sh --release   # release build
./hc-scripts/run-dev.sh --no-build  # skip cargo, use existing binaries
./hc-scripts/run-dev.sh --no-pull   # skip `git pull` in every repo
./hc-scripts/run-dev.sh --no-update # skip `cargo update`
```

What it does:

1. Runs `git pull --ff-only` in hc-scripts itself, `core/`, each
   `sdks/hc-plugin-sdk-*` checkout, and each git repo under `clients/`.
   It finds these by scanning directories; it does not read
   `workspace.toml`.
2. Runs `cargo update` on `core/Cargo.toml`, which rewrites `Cargo.lock`.
   Pass `--no-update` (or `--no-pull`) when you do not want that.
3. Builds the `homecore` binary only (`cargo build --bin homecore`). It
   does not build the plugins, so run `cargo build --workspace` (or
   `just build`) first if plugin code changed.
4. Starts the server from `core/target/<profile>/` with `--home core`
   and `--config config/homecore.dev.toml`.

The dev config's `[[plugins]]` blocks point at `target/debug/<name>`,
relative to `HOMECORE_HOME` (here `core/`), so homecore launches whatever
the last workspace build produced.

:::caution run-dev.sh is not sandboxed
It starts a real homeCore with the real plugin configs, so it connects to
whatever hubs, bridges and cloud accounts those configs name. Do not use
it to test anything destructive. Use a sandbox instead.
:::

Its `--webui` flag starts the retired Flutter app's dev proxy. It is not
the flag you want for UI work; see [Web UI development](#web-ui-development).

### A typical loop

Run the server in one terminal:

```bash
cd homeCore/core
cargo run -p homecore -- --home /tmp/hc-dev
```

Log in from another and keep the token:

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}' | jq -r .token)
```

Optionally, watch the live event stream in a third:

```bash
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN"
```

Then:

1. Make a code change.
2. `Ctrl-C` the server.
3. Run `cargo run -p homecore -- --home /tmp/hc-dev` again. Only changed
   crates recompile.
4. Re-test with `curl`.
5. Read the server's log output.

For devices to automate against without hardware, use core's own glue
devices (virtual switches, timers and the rest); see
[Virtual devices](../devices/virtual-devices.md).

## Pre-PR check (`just check`)

There are three Justfiles, and their clippy settings differ from CI's,
so read this section before trusting a local green.

| Where | `just check` runs |
|---|---|
| Workspace root (`Justfile`, a symlink to `hc-scripts/Justfile.workspace`) | `check-core` (core's `just check`), then `fmt`, `clippy --locked` and `test --locked` for the standalone Rust clients `hc-tui` and `hc-web-leptos` |
| `core/Justfile` | `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets` with `-D clippy::correctness -D clippy::suspicious` and three `-A` allowances, `cargo test --workspace` |
| `core/plugins/hc-*/Justfile` | `cargo fmt --all -- --check`, `cargo clippy --all-targets --all-features -- -D warnings` with three `-A` allowances, `cargo test --all-features` |

CI (`hc-scripts/.github/workflows/rust-ci.yml`) runs this at core's root:

```bash
cargo fmt --all --check
cargo clippy --all-targets --all-features -- \
    -D warnings \
    -A clippy::type_complexity
cargo test --all-features
```

That is stricter than any of the Justfiles. Core's Justfile does not deny
warnings at all, and the plugin Justfiles still allow
`clippy::too_many_arguments` and `clippy::result_large_err`, which CI
stopped allowing. To reproduce CI before pushing, run the three commands
above from `core/` with the toolchain CI uses (see Toolchain above).

Other workspace recipes:

| Recipe | What it does |
|---|---|
| `just check-core` | core's `just check` |
| `just check-plugin <name>` | `fmt`, `clippy` and `test` for one workspace member (`-p <name>`) |
| `just check-clients` | the standalone Rust clients only |
| `just fmt` / `just clippy` / `just test` | one step across core and the Rust clients |
| `just build` / `just build-release` | debug or release build of everything Rust |
| `just clean` | `cargo clean` for core and the Rust clients |
| `just clean-release` | `cargo clean --release` only |
| `just clean-all` | `clean`, plus the Flutter build cache, `logs/*.log` and the devenv/direnv caches |
| `just deploy-local [args]` | build and install a production-like layout with `hc-scripts/deploy.sh` (default destination `/var/tmp/homeCore`) |

### Inside a plugin directory

Each plugin under `core/plugins/` keeps a Justfile with these recipes:

| Recipe | What it runs |
|---|---|
| `just` (default) | `just --list` |
| `just check` | `fmt`, then `clippy`, then `test` |
| `just fmt` / `just fmt-fix` | `cargo fmt --all -- --check` / `cargo fmt --all` |
| `just clippy` | the clippy command from the table above |
| `just test` | `cargo test --all-features` |
| `just build` / `just build-release` | `cargo build` / `cargo build --release` |
| `just run` | `cargo run -- --config config/config.dev.toml` |
| `just clean` | `cargo clean` |
| `just package` | `$HC_SCRIPTS/build-archive.sh --kind plugin --name <self> --build` |

Because the plugin is a workspace member, some of these act on the whole
workspace, not the plugin: `cargo fmt --all` formats every member, and
`cargo clean` empties core's shared `target/`.

`just package` wraps `hc-scripts/build-archive.sh`. `BIN_NAME` comes from
the directory name, so the same Justfile works for every plugin. The
default `HC_SCRIPTS` is `../../hc-scripts`, which from
`core/plugins/<name>/` resolves to `core/hc-scripts`, a path that does
not exist in this layout. Pass the real location:

```bash
HC_SCRIPTS=../../../hc-scripts just package
```

## Cargo commands reference

For a single crate, call `cargo` directly from `core/`:

```bash
# Fastest feedback: type-check without building
cargo check --workspace
cargo check -p hc-core        # single crate

# Build
cargo build --workspace
cargo build --release          # optimized binaries

# Run
cargo run -p homecore
cargo run -p homecore --release

# Test
cargo test --workspace
cargo test -p hc-auth          # single crate
cargo test -p hc-core          # rule engine tests
cargo test -p hc-api           # API crate tests
cargo test -p homecore --test integration_test   # full-stack integration test
cargo test -p hc-core repeat_until               # tests whose names contain this
cargo test --workspace -- --nocapture            # show println! output

# Watch for changes (install once: cargo install cargo-watch)
cargo watch -x "check -p hc-core"
cargo watch -x "test -p hc-api"
```

## Tests

```bash
cd core
cargo test --all-features            # the whole workspace, unit + integration
cargo test -p hc-core                # one crate
cargo test -p homecore --test integration_test   # one integration binary
```

There are several hundred test functions in core's crates and server
alone, and well over a thousand once the plugins and SDK are counted. Any
number written here would go stale quickly, so treat `cargo test` as the
count. What the layers cover:

| Layer | What its tests are for |
|---|---|
| `hc-auth` | Password hashing, JWT issue/validate/expire/tamper, role→scope mapping, refresh rotation and reuse detection |
| `hc-types` | The rule vocabulary, derived from the enums and snapshotted in `docs/rule-vocabulary.json`, so a client's mirror can be checked against the real thing |
| `hc-core` | Trigger matching, condition evaluation, the action executor (Delay, RepeatUntil, Parallel), the scheduler |
| `hc-state` | Device registry round-trips, history queries |
| `hc-api` | Scope guards, handler helpers |
| `homecore/tests/` | The full stack: MQTT → state bridge → rule fires; scope enforcement, API keys and sessions; atomic rule import; plugin-runtime enrollment; streaming; and the OpenAPI-vs-router check |

Plugins and SDKs carry their own suites. `hc-captest` exists to assert
the capability spec end to end against a running core.

## Web UI development

The web app is
[hc-web-svelte](https://github.com/homeCore-io/hc-web-svelte), in its own
repo at `clients/hc-web-svelte`. It needs Node.js, not cargo.

```bash
cd clients/hc-web-svelte
npm install
cp .env.example .env    # HC_CORE_URL defaults to http://127.0.0.1:8080
npm run dev             # http://localhost:5180
```

The dev server mounts the same pass-through to core that the production
UI server uses (`server/proxy.js`), so `/api/v1` and the event stream
reach core on the app's own origin, with sessions held in httpOnly
cookies. Point `HC_CORE_URL` at a sandbox core, not the house.

Before pushing, run the same checks CI does (hc-scripts' `node-ci.yml`):

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build && npm run budget
```

The repo's README covers the production server and the container image.

### The retired clients

`[web_admin]` in `homecore.toml` still exists and still serves a
directory of static files from core's root path through the
`hc-web-admin` crate. It was built for the Leptos/WASM admin that core
used to bake in. That client is retired, the setting defaults to off, and
the standard deployment leaves it off.

The Flutter app (`clients/hc-web-flutter`) is retired as well. Some
workspace tooling still refers to it: `just hc-web-dev`,
`just clean-flutter` and `run-dev.sh --webui`. None of these is needed for
current UI work.

## Debugging with RUST_LOG

`RUST_LOG` adds to the `[logging]` level and per-target settings in
`homecore.toml` and wins on conflict:

```bash
# Rule engine internals
RUST_LOG=info,hc_core::engine=debug,hc_core::executor=debug cargo run -p homecore

# MQTT traffic
RUST_LOG=info,hc_mqtt_client=debug cargo run -p homecore

# State bridge
RUST_LOG=info,hc_core::state_bridge=debug cargo run -p homecore

# Everything (very noisy)
RUST_LOG=trace cargo run -p homecore

# All rule-engine related
RUST_LOG=info,hc_core=debug,hc_mqtt_client=debug,hc_broker=warn cargo run -p homecore
```

## Common compiler errors

### "cannot borrow `self` as mutable because it is also borrowed as immutable"

This usually means a reference is held across an `.await`. Clone the
value before the await:

```rust
// ❌ fails
let name = &self.state.get_name();
self.state.update().await?;  // borrow problem

// ✅ fix
let name = self.state.get_name().clone();
self.state.update().await?;
```

### "future cannot be sent between threads safely" / `Send` bound

An `async fn` passed to `tokio::spawn` captures a non-`Send` type (such
as `Rc` or `RefCell`). Use `Arc<Mutex<>>` instead, or restructure so the
non-`Send` value is dropped before the first `await`.

### "the trait bound is not satisfied for `Box<dyn Future>`"

Recursive async functions need `Box::pin`. The executor's
`run_single_action` is written this way:

```rust
fn run_action(action: Action) -> Pin<Box<dyn Future<Output = Result<()>> + Send>> {
    Box::pin(async move {
        match action {
            Action::Parallel { actions } => {
                for a in actions {
                    run_action(a).await?;   // ← recursive call OK inside Box::pin
                }
            }
            // ...
        }
        Ok(())
    })
}
```

### Deadlock in `RwLock`

Do not hold a write lock across an `await`. If anything awaited needs
the same lock, the task waits on itself. Take what you need, drop the
lock, then do the async work:

```rust
// ❌ deadlock
let mut rules = self.rules.write().await;
rules.push(new_rule);
persist_to_db(&new_rule).await?;  // deadlock — write lock still held

// ✅ fix
{
    let mut rules = self.rules.write().await;
    rules.push(new_rule.clone());
}  // lock dropped here
persist_to_db(&new_rule).await?;
```

## Adding a new REST endpoint

The short version (the full checklist is in
[Adding Features](./adding-features.md#adding-a-new-rest-endpoint)):

1. Write the handler in `crates/hc-api/src/handlers.rs`, or in a file of
   its own for a new resource type.
2. Register the route in `router()` in `crates/hc-api/src/lib.rs`, in
   `public` if it needs no auth and `protected` otherwise.
3. Guard it with a scope extractor from `crates/hc-api/src/auth_middleware.rs`.
4. Document it in `core/docs/openapi.yaml`.
   `homecore/tests/openapi_covers_router_test.rs` fails if the spec and
   the router disagree.
5. Run `cargo test -p homecore --test openapi_covers_router_test`.

## Adding a new action type

1. Add the variant to the `Action` enum in `crates/hc-types/src/rule.rs`.
2. Add its match arm to `run_single_action()` in
   `crates/hc-core/src/executor.rs`.
3. Write unit tests in `executor.rs`; the `RepeatUntil` and `Delay` tests
   are good templates.
4. Regenerate the rule vocabulary snapshot:
   `UPDATE_VOCABULARY=1 cargo test -p hc-types --features schema`.
5. Add it to the action reference in `docs/devNotes.md` and to this
   site's [Actions](../rules/actions.md) page.

## Integration test

```bash
cargo test -p homecore --test integration_test
```

`homecore/tests/integration_test.rs` builds a small homeCore in-process:

1. Starts the embedded broker on a free port.
2. Opens a state store in temp files (`/tmp/hc-test-<port>.redb` and
   `.db`) and writes a rule into it directly.
3. Starts the MQTT client and `Core` (state bridge and rule engine),
   subscribing to the event bus before anything is published.
4. Connects an MQTT client named `virtual-device` and publishes
   `{"on": true}` to `homecore/devices/test_light/state`.
5. Asserts that `DeviceStateChanged` and `RuleFired` both arrive on the
   bus.

The same file also checks that a rule's second trigger fires it and that
a plugin's capability manifest reaches the bus. To add a scenario, add a
`#[tokio::test]` function there, or a new file in `homecore/tests/`.

## Branches, CI and releases

Work lands on `develop`, and releases are cut from `main`.
CI (`core/.github/workflows/ci.yml`) runs on pushes to both branches and
on pull requests into either. Besides the Rust checks, it builds every
plugin's `ui/` that has a `package.json`. When `develop` goes red, the
shared workflow opens a tracking issue in the repo and closes it when CI
recovers. A weekly `canary.yml` runs the same checks against the latest
stable Rust. It gates nothing; a red canary is a preview of what the next
toolchain bump will demand.

The reusable workflows in hc-scripts are referenced as `@main` by every
repo, so a change to them is live for the whole org once it merges to
hc-scripts' `main`.

Day-to-day pushes to `develop` need no ceremony. Cutting a release does:

- **Tag only after CI on the release commit is green.** Push `develop`,
  merge to `main`, push, watch the run, then tag. A local `just check` is
  not CI (see [above](#pre-pr-check-just-check)). To prove the whole
  pipeline before choosing a version, run
  `gh workflow run release.yml --ref develop` (add `-f plugin=hc-<name>`
  for a plugin): it builds and archives without creating a Release.
- The tag names the component. `v<version>` releases the server
  (tarball, checksum, and the `ghcr.io` `hc-core` image).
  `hc-<name>-v<version>` releases one plugin as a signed registry
  artifact. A core release that changes plugins tags them on the same
  commit.
- A server release bumps two files: `homecore/Cargo.toml` and
  `info.version` in `docs/openapi.yaml`, then refresh `Cargo.lock`. A
  test fails if they disagree, so run the checks after the bump, not
  before.
- A plugin release bumps `version` in the plugin's `Cargo.toml`.
- **Every release gets an entry in
  [Release Notes](../release-notes.md)**, written as part of cutting it,
  for the people running a house: what they can now do, what they must
  change on upgrade, and what is deliberately unchanged. A round with
  nothing an operator would notice still gets an entry saying so.

If a tag's artifacts are already published and CI then fails, fix
forward with a new version rather than moving the tag.
`hc-scripts/README.md` and the workspace `AGENTS.md` have the history
behind these rules.
