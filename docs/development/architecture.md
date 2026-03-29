---
id: architecture
title: Architecture
sidebar_label: Architecture
sidebar_position: 3
---

# Architecture

## Overview

HomeCore is built as a set of independent Rust crates wired together in the `homecore` binary. All device communication flows through MQTT. All runtime state flows through two internal event buses.

```
Physical devices
    │
    ▼
MQTT broker (rumqttd, embedded)
    │
    ▼  homecore/devices/{id}/state  (retained)
hc-mqtt-client  ──────────────────────────────────►  internal_bus
    │                                                 (Event::MqttMessage)
    │
    ▼
state_bridge  ──── reads redb, computes diff ──────► pub_bus
                                                      (Event::DeviceStateChanged)
                                                             │
                                                             ▼
                                                       RuleEngine
                                                       ┌──────────────┐
                                                       │ DashMap cache│
                                                       │ trigger match│
                                                       │ conditions   │
                                                       │ actions      │
                                                       └──────────────┘
                                                             │
                                                             ▼
                                                       pub_bus.publish(RuleFired)
                                                       MQTT cmd topics
                                                       Notify / CallService
```

---

## Dual event bus

The core runtime carries two `EventBus` instances — both are `tokio::broadcast` channels wrapping `Event`.

| Bus | Populated by | Contains | Consumed by |
|---|---|---|---|
| `internal_bus` | `hc-mqtt-client` | `Event::MqttMessage` (every raw MQTT packet) | `state_bridge`, rule engine (for `MqttMessage` triggers) |
| `pub_bus` | `state_bridge`, scheduler, managers | Typed events: `DeviceStateChanged`, `RuleFired`, `Custom`, `SystemStarted`, `DeviceAvailabilityChanged`, `ModeChanged`, `TimerStateChanged` | Rule engine, API WebSocket broadcaster, `hc-api` event log |

**Why two buses?**

The `internal_bus` carries raw MQTT traffic — high volume, low-level. The `pub_bus` carries semantically enriched events. Separating them lets the rule engine subscribe efficiently to both without mixing protocols. The `MqttMessage` trigger reads `internal_bus`; all other triggers read `pub_bus`.

### EventBus implementation

```rust
#[derive(Clone)]
pub struct EventBus {
    tx: broadcast::Sender<Event>,
}

impl EventBus {
    pub fn new(capacity: usize) -> Self { ... }
    pub fn subscribe(&self) -> broadcast::Receiver<Event> { ... }
    pub fn publish(&self, event: Event) -> Result<()> { ... }
}
```

Capacity defaults to 512 for `pub_bus` and 1024 for `internal_bus`. Slow consumers that fall behind receive `RecvError::Lagged(n)` — the engine logs a warning and continues rather than blocking the fast path.

### Engine subscription

The engine runs a `tokio::select!` loop receiving from both buses:

```rust
let mut internal_rx = self.internal_bus.subscribe();
let mut pub_rx      = self.pub_bus.subscribe();

loop {
    tokio::select! {
        biased;
        _ = shutdown.changed() => break,

        result = pub_rx.recv() => {
            // DeviceStateChanged, Custom, RuleFired, etc.
            handle_pub_event(event).await;
        }
        result = internal_rx.recv() => {
            // MqttMessage — only for MqttMessage triggers
            handle_internal_event(event).await;
        }
    }
}
```

The `biased` selector ensures the shutdown signal is always checked first.

---

## State bridge (`state_bridge.rs`)

The state bridge is the translation layer between raw MQTT and the typed event world.

**Flow for each incoming MQTT message:**

1. Receive `Event::MqttMessage` from `internal_bus`
2. Match topic against `homecore/devices/{device_id}/state` (or `/state/partial`)
3. Parse JSON payload
4. Apply ecosystem router transforms (if a matching profile is loaded)
5. Read current device state from redb (`StateStore`)
6. Compute `changed` — the set of attributes whose values actually differ
7. Write new state to redb
8. **Only if `!changed.is_empty()`**: publish `Event::DeviceStateChanged` to `pub_bus`

The guard in step 8 is critical for startup performance. On restart, the MQTT broker replays retained messages for all registered devices. Without the guard, every retained message would publish a spurious `DeviceStateChanged` even when the stored state is identical — causing the rule engine to evaluate all rules for every device at startup (O(devices × rules) work per restart).

### Availability handling

Availability topics (`homecore/devices/{id}/availability`) are also handled by the bridge. They publish `Event::DeviceAvailabilityChanged { device_id, available }` to `pub_bus`.

---

## Rule engine (`engine.rs`)

### In-memory device cache

The engine never reads redb during condition evaluation. Instead, it maintains an `Arc<DashMap<String, HashMap<String, JsonValue>>>` (device_id → attributes) that is:

- Pre-populated at startup from the state store via `spawn_blocking`
- Updated synchronously on every `DeviceStateChanged` event **before** rule evaluation begins

This means `DeviceState` conditions resolve in ~10 µs (DashMap lookup) rather than ~2–5 ms (redb + `spawn_blocking`).

### RwLock early release

The rules `Arc<RwLock<Vec<Rule>>>` is held only long enough to clone the current rule list into a local snapshot. All trigger matching and condition evaluation run against the snapshot after the lock is released. Hot-reload never blocks rule evaluation.

```rust
// Hold lock briefly, clone snapshot
let rules_snapshot = {
    let guard = self.rules.read().await;
    guard.clone()
};
// Lock released here — hot-reload can now proceed
for rule in &rules_snapshot {
    evaluate_rule(rule, &event, &device_cache).await;
}
```

### Fire history ring buffer

The engine records the last 20 evaluation attempts for every rule in `Arc<DashMap<Uuid, VecDeque<RuleFiring>>>`. Each `RuleFiring` contains:

- `timestamp` — when the rule was evaluated
- `trigger_type` — which trigger variant fired
- `trigger_context` — the event data (device_id, attribute, value, etc.)
- `outcome` — `Fired`, `ConditionFailed`, `Cooldown`, `Paused`, `RequiredExpressionFailed`, `TriggerGateFailed`, or `Skipped`
- `conditions` — per-condition trace with `actual`, `expected`, and `reason`
- `actions` — per-action outcome trace
- `eval_ms` — time spent evaluating conditions

The ring buffer is pre-populated at startup from the database so history survives restarts. The API exposes it via `GET /api/v1/automations/{id}/history`.

### ExecutorContext

Each rule firing creates an `ExecutorContext` that carries all state needed by the action executor:

```rust
pub struct ExecutorContext {
    pub rule_id:         Uuid,
    pub state:           StateStore,
    pub publish:         Option<PublishHandle>,
    pub notify:          Option<Arc<NotificationService>>,
    pub event_bus:       Option<EventBus>,          // pub_bus
    pub device_cache:    Arc<DashMap<...>>,
    pub delay_registry:  Arc<DashMap<String, Arc<tokio::sync::Notify>>>,
    pub rule_vars:       Arc<DashMap<(Uuid, String), JsonValue>>,
    pub priv_bools:      Arc<DashMap<(Uuid, String), bool>>,
    pub capture_store:   Arc<DashMap<(Uuid, String), HashMap<...>>>,
    pub hub_vars:        Arc<DashMap<String, JsonValue>>,
    pub trigger_context: TriggerContext,
}
```

The executor is pure async Rust — it does not call back into the engine. Actions that need to publish to MQTT do so via `publish: PublishHandle`. Actions that need to emit events do so via `event_bus`.

### Concurrency model

- Each rule firing is dispatched as a `tokio::spawn` task (non-blocking from the select loop).
- An `Arc<AtomicUsize>` (`in_flight`) tracks running tasks for graceful shutdown.
- Per-rule `run_mode` (`Single` or `Queued`) uses a per-rule `Arc<AtomicUsize>` to enforce the policy.
- `Delay` actions yield their task without blocking other firings.
- `Parallel { actions }` runs sub-actions via `tokio::join!` within the same task.
- Cancellable delays register a `tokio::sync::Notify` in `delay_registry` keyed by a label; `CancelDelays` looks up and triggers the notify.

### Graceful shutdown

When the shutdown `watch::Receiver<bool>` fires:

1. The select loop exits.
2. The engine waits up to `drain_timeout_secs` (default 10 s) for `in_flight` to reach zero.
3. Any tasks still running after the timeout are abandoned (tokio will drop them).

---

## Scheduler (`scheduler.rs`)

The scheduler runs a 1-minute tick loop and evaluates `TimeOfDay`, `SunEvent`, `Cron`, `Periodic`, and `CalendarEvent` triggers. It publishes `Event::SchedulerTick` to `pub_bus` — the engine handles it like any other event.

Solar times are computed locally from the `[location]` lat/lon config using the `sunrise` crate. No cloud API is called.

**Catch-up on restart:** At startup the scheduler checks all enabled time-based rules against a configurable window (`catchup_window_minutes`, default 15). Any trigger whose computed time falls within `(now - window, now]` fires immediately.

---

## Managers

Three subsystems run as independent tokio tasks spawned from `Core::start()`. Each subscribes to `internal_bus` for MQTT commands and publishes to `pub_bus` for state changes.

| Manager | Device prefix | Purpose |
|---|---|---|
| `TimerManager` | `timer_` | Countdown timer devices with start/pause/resume/cancel/restart commands |
| `SwitchManager` | `switch_` | Virtual on/off boolean switches |
| `ModeManager` | `mode_` | Solar modes (`mode_night`, `mode_day`) + named boolean modes from `modes.toml` |

All managers persist their state to redb via `StateStore` so state survives restarts.

---

## Rhai scripting boundary

Rhai scripts run synchronously inside `tokio::task::spawn_blocking` to avoid blocking the async runtime. The boundary is explicit:

- **Condition evaluation** (`ScriptExpression`): sync Rhai call, returns `bool`
- **Action scripts** (`RunScript`): sync Rhai call, collects side effects (device state changes, MQTT publishes, notifications) into a `Vec`, then applies them asynchronously after the script returns
- **Topic mapper transforms**: sync Rhai call, returns a `Dynamic` value for payload reshaping

The `hc-scripting` crate exposes the Rhai engine with the `sync` feature enabled. The engine is reused across evaluations (not recreated per call) for fast startup.

---

## Module map

| File | Responsibility |
|---|---|
| `src/main.rs` | Binary entry point: parse config, wire all crates, start `Core` |
| `crates/hc-core/src/lib.rs` | `Core` builder, `EventBus` definition, `start()` wiring |
| `crates/hc-core/src/engine.rs` | Rule evaluation, DashMap cache, fire history, `RuleEngine::run()` |
| `crates/hc-core/src/executor.rs` | Action dispatch, `ExecutorContext`, all action type implementations |
| `crates/hc-core/src/state_bridge.rs` | MQTT→DeviceStateChanged translation, redb writes |
| `crates/hc-core/src/scheduler.rs` | Time/solar/cron triggers, catch-up on restart |
| `crates/hc-core/src/timer_manager.rs` | Virtual timer devices |
| `crates/hc-core/src/switch_manager.rs` | Virtual switch devices |
| `crates/hc-core/src/mode_manager.rs` | Solar + boolean mode devices |
| `crates/hc-core/src/rule_loader.rs` | TOML rule file loading, UUID write-back, hot-reload watcher |
| `crates/hc-mqtt-client/src/lib.rs` | rumqttc client, `internal_bus` publisher, `PublishHandle` |
| `crates/hc-state/src/lib.rs` | redb device registry, SQLite history, `StateStore` |
| `crates/hc-api/src/lib.rs` | axum router, WebSocket broadcaster, OpenAPI |
| `crates/hc-api/src/handlers.rs` | All REST handler functions |
| `crates/hc-topic-map/src/lib.rs` | `EcosystemRouter`, profile loading, `apply_field_map`, Rhai transforms |
| `crates/hc-auth/src/lib.rs` | JWT issuance/validation, Argon2id passwords, MQTT credentials |
| `crates/hc-scripting/src/lib.rs` | Rhai engine setup, sandboxing, `ScriptRuntime` |
| `crates/hc-notify/src/lib.rs` | `NotificationService`, Pushover/email/Telegram delivery |
| `crates/hc-broker/src/lib.rs` | rumqttd embedded broker startup, TLS config |
