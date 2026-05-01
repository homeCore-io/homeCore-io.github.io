---
id: dev-workflow
title: Dev Workflow
sidebar_label: Dev Workflow
sidebar_position: 2
---

# Dev Workflow

## Standard dev session

For multi-component work (core + plugins + UI together), the easiest
launcher is `hc-scripts/run-dev.sh` from the workspace root:

```bash
./hc-scripts/run-dev.sh             # build all + run core (debug)
./hc-scripts/run-dev.sh --release   # release build
./hc-scripts/run-dev.sh --webui     # also `trunk serve` hc-web-leptos on :3000
./hc-scripts/run-dev.sh --no-build  # skip cargo, use existing binaries
./hc-scripts/run-dev.sh --no-pull   # skip `git pull` in every repo
```

The script:
1. Pulls all 14+ component repos (core + 11 plugins + sdks + clients).
2. Runs `cargo update` against each meta-layout workspace
   (`plugins/`, `clients/`, `sdks/`, plus core).
3. Builds plugins via the meta-layout (`cargo build --manifest-path
   plugins/Cargo.toml -p <name>`) — binaries land at
   `plugins/target/debug/<name>` (the shared workspace target dir,
   not per-plugin).
4. Builds homecore.
5. Optionally builds + serves hc-web-leptos via `trunk serve`.
6. Runs `homecore --config core/config/homecore.dev.toml`.

The dev config's `[[plugins]]` blocks point at
`../plugins/target/debug/<name>` so homecore launches whatever
`run-dev.sh` just built. **If a code change doesn't seem to take
effect after restart, the most common cause is a stale binary at the
old per-plugin target path** — the meta-layout reshape moved outputs
to the shared dir.

For tighter loops on a single component, you can also run cargo
directly. Three terminal windows is enough:

### Terminal 1 — the server

```bash
cd homeCore/core
cargo run -p homecore
```

HomeCore uses the **current working directory** as its base. Running
from `core/` picks up `config/homecore.toml` and writes data to
`data/` right there.

On first run, copy the admin password from the startup output.

To restart after a code change: `Ctrl-C`, then `cargo run -p homecore`
again. Only changed crates recompile.

### Terminal 2 — virtual device (optional)

Start after the server is up:

```bash
cargo run -p virtual-device -- --broker 127.0.0.1 --port 1883 --id plugin.virtual
```

### Terminal 3 — API calls

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}' | jq -r .token)
```

### Optional: Terminal 4 — live event stream

```bash
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN"
```

### Typical loop

1. Make a code change
2. `Ctrl-C` in Terminal 1
3. `cargo run -p homecore` (only changed crates recompile)
4. Re-test with `curl` in Terminal 3
5. Check Terminal 1 for log output

## Pre-PR check (`just check`)

Every Rust component (core + each plugin) ships an aligned `Justfile`
with the same recipes. From the component's repo root:

```bash
just                # default: list all recipes
just check          # fmt + clippy + test — mirrors what CI runs
```

The clippy invocation matches `hc-scripts/.github/workflows/rust-ci.yml`
exactly:

```bash
cargo clippy --all-targets --all-features -- \
    -D warnings \
    -A clippy::too_many_arguments \
    -A clippy::type_complexity \
    -A clippy::result_large_err
```

So if `just check` passes locally, CI passes too. The three allowed
lints are stylistic-only allowances — see
`hc-scripts/.github/workflows/rust-ci.yml` for the rationale on each.

### Recipe reference

| Recipe | What it runs | When to use |
|---|---|---|
| `just` (default) | `just --list` | See available recipes |
| `just check` | `fmt` → `clippy` → `test` | Before pushing |
| `just fmt` | `cargo fmt --all -- --check` | CI-equivalent format check |
| `just fmt-fix` | `cargo fmt --all` | Apply formatting in place |
| `just clippy` | The CI-mirror clippy command above | Lint pass |
| `just test` | `cargo test --all-features` | Test pass |
| `just build` | `cargo build` | Debug build |
| `just build-release` | `cargo build --release` | Release build |
| `just run` | `cargo run -- --config config/config.dev.toml` | Run the plugin against your dev config |
| `just clean` | `cargo clean` | Wipe the target/ tree |
| `just package` | `../../hc-scripts/build-archive.sh --kind plugin --name <self> --build` | Produce a `dist/<name>-<ver>-<plat>.tar.gz` fragment |

The `package` recipe wraps `hc-scripts/build-archive.sh` — same script
CI uses to produce release tarballs. `BIN_NAME` auto-derives from the
directory name, so the same Justfile ships byte-identical to every
plugin without per-repo customization. Override the script path with
`HC_SCRIPTS=/path/to/hc-scripts just package` if your checkout doesn't
follow the meta-layout.

Install `just` once if needed:

```bash
cargo install just
```

## Cargo commands reference

For tighter feedback loops on a single crate, fall back to `cargo`
directly:

```bash
# Fastest feedback — check compiles without building
cargo check --workspace
cargo check -p hc-core        # single crate

# Build
cargo build --workspace
cargo build --release          # optimized binary

# Run
cargo run -p homecore
cargo run -p homecore --release

# Run virtual device
cargo run -p virtual-device -- --broker 127.0.0.1 --port 1883 --id plugin.virtual

# Test
cargo test --workspace
cargo test -p hc-auth          # single crate
cargo test -p hc-core          # rule engine tests
cargo test -p hc-api           # API + WebSocket auth tests
cargo test -p homecore --test integration_test   # full-stack integration test
cargo test -p hc-core repeat_until               # specific test by name
cargo test --workspace -- --nocapture            # show println! output

# Watch for changes (install once: cargo install cargo-watch)
cargo watch -x "check -p hc-core"
cargo watch -x "test -p hc-api"
```

## Test coverage

| Crate | Tests | Coverage |
|---|---|---|
| `hc-auth` | 11 | Password hashing, JWT issue/validate/expire/tamper/role |
| `hc-core` | 12 | Rule engine trigger matching, executor RepeatUntil/Delay, CallService |
| `hc-api` | 22 | Event log ring buffer, WebSocket auth, scope enforcement |
| `hc-topic-map` | 4 | Pattern matching and transforms |
| `http-poller` | 19 | Path extraction, field_map, JSON↔Dynamic bridge, Rhai transform |
| `homecore` (integration) | 1 | Full stack: virtual device → MQTT → rule fires → command |
| **Total** | **69** | |

## Admin UI development

The Leptos/WASM admin UI (`hc-web-leptos`) has its own dev workflow that coexists with the server.

**Development:** Run `trunk serve` on port 3000 from the `hc-web-leptos` directory. Trunk proxies `/api` requests to HomeCore on port 8080 automatically. Leave `[web_admin] enabled = false` in `homecore.toml` (the default) so the server does not serve static files that conflict with trunk's dev server.

**Production:** Build with `trunk build --release`, copy the `dist/` directory to the deploy location, and enable in `homecore.toml`:

```toml
[web_admin]
enabled   = true
dist_path = "ui/dist"   # relative to HOMECORE_HOME
```

HomeCore serves the built assets via tower-http `ServeDir` with SPA fallback. API routes at `/api/v1` take priority.

**Both can coexist:** Disabling `web_admin` does not affect the trunk dev workflow. You can develop the UI with `trunk serve` while HomeCore runs with `web_admin` disabled, then switch to built-in serving for production.

## Isolated dev environment

Use a throwaway directory to keep state separate from your main installation:

```bash
HOMECORE_HOME=/tmp/hc-dev cargo run -p homecore
# or
cargo run -p homecore -- --home /tmp/hc-dev
```

Reset it cleanly:

```bash
rm -rf /tmp/hc-dev/data/
HOMECORE_HOME=/tmp/hc-dev cargo run -p homecore
```

## Debugging with RUST_LOG

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

Usually means you're holding a reference across an async await point. The fix is to clone the value before the await:

```rust
// ❌ fails
let name = &self.state.get_name();
self.state.update().await?;  // borrow problem

// ✅ fix
let name = self.state.get_name().clone();
self.state.update().await?;
```

### "future cannot be sent between threads safely" / `Send` bound

An `async fn` that captures a non-`Send` type (e.g. `Rc`, `RefCell`) passed to `tokio::spawn`. Either use `Arc<Mutex<>>` instead, or restructure so the non-Send value is dropped before the first `await`.

### "the trait bound is not satisfied for `Box<dyn Future>`"

Recursive async functions need `Box::pin`:

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

Never hold a write lock across an `await`. Take the data you need, drop the lock, then do async work:

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

1. Add handler function in `crates/hc-api/src/handlers.rs` (or a new file for new resource types)
2. Add route in `crates/hc-api/src/lib.rs` `build_router()`
3. Add scope extractor parameter to the handler signature
4. Add `utoipa` `#[utoipa::path(...)]` attribute for OpenAPI generation
5. Register in `openapi.rs` if using the OpenAPI macro router
6. Write a test in `hc-api` module tests

## Adding a new action type

1. Add the variant to `Action` enum in `crates/hc-types/src/rule.rs`
2. Add serde deserialization (usually automatic with `#[serde(tag = "type", rename_all = "snake_case")]`)
3. Add match arm in `executor.rs` `run_single_action()`
4. Write unit tests in `hc-core` module tests
5. Add to the action type reference in `docs/devNotes.md`

## Integration test

The integration test starts a full HomeCore instance on a random port:

```bash
cargo test -p homecore --test integration_test
```

It:
1. Starts HomeCore with an in-memory config (temp files under `/tmp/`)
2. Connects the virtual device plugin
3. Creates a rule via the REST API
4. Publishes a state change via MQTT
5. Asserts the rule fired and the expected command was published

To add a new integration test scenario, add a test function in `tests/integration_test.rs`.
