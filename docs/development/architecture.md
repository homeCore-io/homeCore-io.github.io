---
id: architecture
title: Architecture
sidebar_label: Architecture
sidebar_position: 3
---

# Architecture

## Overview

HomeCore is a set of Rust crates wired together in the `homecore` binary
(`core/homecore/src/main.rs`, the composition root). Devices talk to it
over MQTT, and runtime state moves between components on two internal
event buses.

```
Physical devices
    │
    ▼
MQTT broker (rumqttd, embedded)
    │
    ▼  homecore/devices/{id}/state  (retained)
hc-mqtt-client  ──────────────────────────────────►  internal_bus
                                                      (Event::MqttMessage)
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

The runtime carries two `EventBus` instances. Both are `tokio::broadcast`
channels of `Event`.

| Bus | Populated by | Contains | Consumed by |
|---|---|---|---|
| `internal_bus` | `hc-mqtt-client` | `Event::MqttMessage` (every raw MQTT packet) | `state_bridge`, rule engine (for `MqttMessage` triggers), glue/timer/mode managers (device commands), `hc-api`'s raw-bus listeners |
| `pub_bus` | `state_bridge`, scheduler, managers, alert engine, API | Typed events: `DeviceStateChanged`, `DeviceAvailabilityChanged`, `RuleFired`, `Custom` (including `system_started` and `scheduler_tick`), `ModeChanged`, `TimerStateChanged`, alert and plugin events, and more | Rule engine, WebSocket event stream, `hc-api` event log, `hc-influx` |

The `internal_bus` carries raw MQTT traffic: high volume and low level.
The `pub_bus` carries events that already mean something. Keeping them
apart means a consumer of typed events never sees raw packets. The rule
engine subscribes to both: `MqttMessage` triggers are fed from
`internal_bus` and every other trigger from `pub_bus`.

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

`main.rs` creates both buses with a capacity of 1024. A consumer that
falls behind receives `RecvError::Lagged(n)`. The engine logs a warning
and carries on rather than blocking the fast path.

### Engine subscription

The engine runs a `tokio::select!` loop over both buses and the shutdown
signal:

```rust
let mut internal_rx = self.internal_bus.subscribe();
let mut pub_rx      = self.pub_bus.subscribe();

loop {
    tokio::select! {
        biased;
        changed = shutdown.changed() => { /* break on shutdown */ }

        result = internal_rx.recv() => {
            // MqttMessage, for MqttMessage triggers
            self.handle_event(&event).await;
        }
        result = pub_rx.recv() => {
            // DeviceStateChanged, Custom, RuleFired, etc.
            self.handle_event(&event).await;
        }
    }
}
```

`biased` makes the loop check the shutdown signal first. If the shutdown
sender has been dropped (no external shutdown was wired), the engine
switches to a loop over the two buses alone, because a closed channel
would otherwise win every poll and starve them.

### `raw_bus` on AppState

`AppState` in `hc-api` carries two `EventBus` handles, and the difference
matters when you add a background task:

| Field | Production value | Subscribers |
|---|---|---|
| `event_bus` | `pub_bus` (typed events only) | event log, WS event stream, plugin-registry listener, plugin-offline injector, metrics counter |
| `raw_bus` | `internal_bus` (`Event::MqttMessage` only) | plugin-stream SSE bridge, terminal observer, StreamCache populator |

A new task in `hc-api` that filters `Event::MqttMessage` should
**subscribe to `state.raw_bus`**. One that watches typed events
(`PluginCapabilities`, `RuleFired`, `DeviceStateChanged` and so on)
should **subscribe to `state.event_bus`**.

In production these are distinct channels. `AppState::new` takes an
`AppStateParams`, whose `raw_bus` is optional. Left unset it defaults to
a clone of `event_bus`, which is what a test harness with one merged bus
wants.

:::caution Subscriber-spawn timing
`tokio::broadcast` does **not** replay history to a late subscriber.
Anything published before a subscriber existed is lost to it. Listeners
that must see retained messages (capability manifests in particular) have
to be spawned **before** the publisher fires. Concretely,
`spawn_plugin_registry_listener` must run before plugins spawn, and
`core.start()` (which spawns `state_bridge`) must run before
`mqtt_client.run()`. Both are wired correctly today; keep this in mind
when reordering `main.rs`.
:::

---

## Plugin streaming substrate

Plugins report live progress for long-running actions ("include Z-Wave
device", "pair Hue bridge") through a frozen six-stage protocol:
`progress`, `item`, `awaiting_user`, `warning`, `complete` and `error`,
plus the synthetic `canceled` and `timeout` stages that core injects.
Events travel on plain MQTT topics:

```
homecore/plugins/{plugin_id}/commands/{request_id}/events
```

The plugin SDK's `StreamContext` handles the envelope shape and the
retain-then-clear-on-terminal lifecycle. The
[capabilities page](../plugins/capabilities) has the spec.

### SSE bridge (`handlers::get_plugin_stream_sse`)

The web app opens an `EventSource` against
`GET /api/v1/plugins/{id}/command/{request_id}/stream`. The handler is on
the **public** router on purpose, because browsers can't set
`Authorization` on an `EventSource`. It accepts `?token=<jwt>`, an
`Authorization: Bearer` header for programmatic clients, or the IP
whitelist, and requires the `plugins:read` scope.

Inside, it subscribes to `state.raw_bus`, filters for `Event::MqttMessage`
on the target topic and forwards each one as an SSE `event: stream`
chunk. It closes on the first terminal stage.

### StreamCache

A fast streaming action can finish emitting before the HTTP client has
received the `request_id` and opened the SSE connection. The broker
can't help: under the clear-on-terminal contract, the retained event is
already wiped by the time the client subscribes.

`streaming::StreamCache` covers this by mirroring stream events
in-process. `spawn_stream_cache_populator(raw_bus, cache)` subscribes to
`raw_bus` and appends every stream-topic event to a per-`request_id`
buffer (at most 256 events). Entries are garbage-collected 60 seconds
after their terminal stage. When the SSE handler opens, it:

1. Subscribes to `raw_bus` first, so it doesn't miss live events.
2. Reads the cached snapshot for this `request_id`.
3. Replays the cached events to the client.
4. Forwards live events, skipping any whose `ts` was already in the
   snapshot.

The retained last event stays the resilience floor; the cache adds a
short replay window on top. A late subscriber sees the history it missed
and then catches up to live.

### Terminal observer + timeout injection

`streaming::spawn_terminal_observer` subscribes to `raw_bus` and releases
the `StreamingRegistry` slot as soon as a terminal stage lands on any
stream topic. That is what makes `concurrency: "single"` work: a second
invocation of the same action sees the slot free as soon as the first
one finishes.

`streaming::schedule_timeout` arms a per-request deadline from the
manifest's `timeout_ms`. If it fires before the plugin emits a terminal
stage, core publishes a synthetic `stage: "timeout"` event onto the
stream topic so the SSE consumer still gets a clean ending.

---

## State bridge (`state_bridge.rs`)

The state bridge translates raw MQTT into typed events. It runs as a
supervised task: if it exits or panics, `Core::start()` restarts it after
a second.

For each `Event::MqttMessage` it receives from `internal_bus`:

1. If the topic is a `homecore/devices/{id}/cmd` that a loaded
   topic-mapper profile claims, it relays the command to the device's
   native topic and stops there.
2. Otherwise it offers the message to the ecosystem router (the
   [topic mapper](./topic-mapper.md)). A match becomes a state or
   availability update for the mapped device ID.
3. Otherwise it routes canonical topics (see the table below).
4. For a state update, it reads the device's current state from redb
   (`StateStore`), applies the new attributes, and computes `changed`,
   the set of attributes whose values actually differ.
5. It writes the new state to redb.
6. **Only if `!changed.is_empty()`** does it publish
   `Event::DeviceStateChanged` to `pub_bus`.

The guard in step 6 keeps restarts cheap. On restart the broker replays
retained messages for every registered device. Without the guard, each
replayed message would publish a spurious `DeviceStateChanged` even when
the stored state is identical, and the rule engine would evaluate every
rule for every device at startup.

### Topic routing: `state` vs `state/partial`

The router matches on `(parts[3], parts.get(4))`, not just `parts[3]`,
because `topic.split('/')` puts `state` and `partial` in separate parts.
A match of `parts[3]` against `"state/partial"` would never fire, and
every per-attribute partial publish would go through the full-replace
branch and wipe `device.attributes`. The routing is:

| Topic | `parts[3]` | `parts[4]` | Handler |
|---|---|---|---|
| `…/state` | `"state"` | `None` | `handle_state(partial=false)` (full replace) |
| `…/state/partial` | `"state"` | `Some("partial")` | `handle_state(partial=true)` (merge) |
| `…/availability` | `"availability"` | `None` | `handle_availability` |
| `…/schema` | `"schema"` | `None` | `handle_device_schema` |

`homecore/devices/{id}/alerts` is handled before these (an empty payload
clears a device's alerts), and the bridge also handles plugin topics such
as `homecore/plugins/{id}/heartbeat`, `…/alerts`, `…/manage/response`
and `…/logs`.

Partial merge uses `apply_partial_merge_patch`: a JSON `null` in the
patch **deletes** that attribute from the stored state. Plugins that emit
per-attribute updates must filter out null values unless they mean to
remove the attribute.

### Availability handling

Availability topics (`homecore/devices/{id}/availability`) are handled by
the bridge too, which publishes
`Event::DeviceAvailabilityChanged { device_id, available }` to
`pub_bus`.

---

## Rule engine (`engine.rs`)

### In-memory device cache

The engine does not read redb during condition evaluation. It keeps an
`Arc<DashMap<String, HashMap<String, JsonValue>>>` (device ID to
attributes) that is:

- pre-populated at startup from the state store, and
- updated on every `DeviceStateChanged` event **before** rule evaluation
  begins.

So a `DeviceState` condition is a DashMap lookup, with no redb read and
no `spawn_blocking`.

### RwLock early release

The engine holds the rules `Arc<RwLock<Vec<Rule>>>` only long enough to
clone the current list into a local snapshot. Trigger matching and
condition evaluation run against the snapshot after the lock is
released, so hot-reload never waits on rule evaluation.

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

The engine records the most recent evaluation attempts for each rule
(`HISTORY_RING_SIZE`, currently 20) in an
`Arc<DashMap<Uuid, VecDeque<RuleFiring>>>`. Each `RuleFiring` contains:

- `timestamp`: when the rule was evaluated
- `trigger_type`: which trigger variant fired
- `trigger_context`: the event data (device ID, attribute, value, and so
  on)
- `outcome`: `Fired`, `ConditionFailed`, `Cooldown`, `Paused`,
  `RequiredExpressionFailed`, `TriggerGateFailed` or `Skipped`
- `conditions`: a per-condition trace with `actual`, `expected` and
  `reason`
- `actions`: a per-action outcome trace
- `eval_ms`: time spent evaluating conditions

At startup `Core::start()` loads the most recent firings from the
database into the buffer, so history survives restarts. The API exposes
it as `GET /api/v1/automations/{id}/history`.

### ExecutorContext

Each rule firing creates an `ExecutorContext` carrying what the action
executor needs. An abridged view (see `crates/hc-core/src/executor.rs`
for every field):

```rust
pub struct ExecutorContext {
    pub publish:        Option<PublishHandle>,
    pub notify:         Option<Arc<NotificationService>>,
    pub event_bus:      Option<EventBus>,          // pub_bus
    pub device_cache:   Arc<DashMap<String, HashMap<String, JsonValue>>>,
    pub delay_registry: Arc<DashMap<String, Arc<tokio::sync::Notify>>>,
    pub pause_state:    Arc<DashMap<Uuid, bool>>,
    pub rule_vars:      Arc<DashMap<(Uuid, String), JsonValue>>,
    pub priv_bools:     Arc<DashMap<(Uuid, String), bool>>,
    pub rules_handle:   Arc<RwLock<Vec<Rule>>>,
    pub trigger_ctx:    TriggerContext,
    pub rule_id:        Uuid,
    pub rule_name:      String,
    pub capture_store:  CaptureStore,
    pub hub_vars:       Arc<DashMap<String, JsonValue>>,
    pub state:          Option<StateStore>,
    pub trace:          Option<Arc<Mutex<Vec<ActionTrace>>>>,
    pub judge:          Option<Judge>,
    pub alerts:         Option<AlertsHandle>,
    // ...
}
```

The executor publishes to MQTT through `publish` and emits events through
`event_bus`. It does not call back into the engine, with one exception:
`judge` lets an if/otherwise step ask any condition the way the rule's
own conditions are decided.

### Concurrency model

- Each rule firing is dispatched as a `tokio::spawn` task, so the select
  loop never blocks on it.
- An `Arc<AtomicUsize>` (`in_flight`) counts running firings for graceful
  shutdown.
- Per-rule `run_mode` (`Parallel`, `Single`, `Restart`, or `Queued` with
  an optional `max_queue`) is enforced with per-rule run state
  (`RuleRuns` in `engine.rs`): an in-flight counter (`Single`, and the
  `max_queue` limit), the newest run's exit flag, which `Restart` sets so
  that run stops at its next step, and a one-permit semaphore that
  `Queued` runs take in turn. A queued run takes a fresh device snapshot
  once it holds the permit.
- `RunRuleActions` passes its call depth on to the called rule's actions,
  so the limit of 10 (`MAX_CALL_DEPTH` in `executor.rs`) holds across
  rules that run each other.
- `RepeatUntil` and `RepeatWhile` take a fresh snapshot from the live
  device cache for each check, as `WaitForExpression` does.
- `Delay` actions sleep inside their own task without blocking other
  firings.
- `Parallel { actions }` spawns each sub-action as its own `tokio::spawn`
  task and waits for all of them.
- A cancellable delay registers a `tokio::sync::Notify` in
  `delay_registry` under `"{rule_id}/{cancel_key}"`; `CancelDelays` looks
  it up and triggers it.

### Graceful shutdown

When the shutdown `watch::Receiver<bool>` fires:

1. The select loop exits.
2. The engine waits up to `drain_timeout_secs` (default 10 s) for
   `in_flight` to reach zero.
3. Tasks still running after that are abandoned, and tokio drops them.

---

## Scheduler (`scheduler.rs`)

The scheduler ticks once a minute and evaluates `TimeOfDay`, `SunEvent`,
`Cron` and `Periodic` triggers, plus `CalendarEvent` triggers when a
calendar store is attached and `AlertActiveFor` triggers. When one is
due it publishes a synthetic `Event::Custom` with
`event_type: "scheduler_tick"` and the rule's ID to `pub_bus`, and the engine fires
that rule. These triggers never match ordinary events.

Solar times are computed locally from the `[location]` latitude and
longitude with the sunrise equation. No cloud API is called.

**Catch-up on restart:** at startup the scheduler checks every enabled
time-based rule against a window (`[scheduler] catchup_window_minutes`,
default 15). Any trigger whose time falls within `(now - window, now]`
fires immediately.

---

## Managers

`Core::start()` spawns several subsystems as independent tokio tasks.
The device managers listen on `internal_bus` for commands on their
devices' `cmd` topics and publish state changes to `pub_bus`.

| Manager | Where | Purpose |
|---|---|---|
| `TimerManager` | `hc-core/src/timer_manager.rs` | Countdown timer devices (`timer_` prefix) with start/pause/resume/cancel/restart commands |
| `GlueManager` | `hc-core/src/glue/` | Core's own helper devices (`plugin_id = "core.glue"`): switches, counters, numbers, selects, text, buttons, date-times, groups, thresholds and schedules. It replaced the old `SwitchManager`. Definitions are seeded from `config/glue.toml`. |
| `ModeManager` | `hc-core/src/mode_manager.rs` | Solar modes (`mode_day`, `mode_night`) and named boolean modes from `modes.toml` |
| Alert engine | `hc-core/src/alerts.rs` | Works out what needs attention and announces changes |
| Battery watcher | `hc-core/src/battery_watcher.rs` | Turns state changes into `DeviceBatteryLow` / `DeviceBatteryRecovered`, with hysteresis |

Timer, glue and mode devices live in the state store (redb) like any
other device, so they survive restarts. See
[Virtual devices](../devices/virtual-devices.md) for how they are used.

---

## PluginManager

Plugin processes are supervised by the `PluginManager` in the server
binary (`homecore/src/plugin_manager.rs`), which `main.rs` starts. It is
not part of `Core::start()`.

### Per-plugin supervisor

Each `[[plugins]]` entry (plus any plugin installed at runtime, recorded
in `config/plugins/managed.toml`) gets its own supervisor task that:

1. spawns the plugin binary as a child process, passing its config path;
2. restarts it after a crash with exponential backoff (2 s up to 60 s),
   resetting the backoff after a run of at least 60 seconds;
3. accepts `Start`, `Stop` and `Restart` commands over a channel, which
   the REST API uses;
4. updates the plugin's record in `AppState` and emits
   `PluginStatusChanged` on every status change.

### MQTT management channel

| Topic | Direction | Purpose |
|---|---|---|
| `homecore/plugins/{id}/heartbeat` | Plugin → Core | Liveness signal, sent every `interval_secs` by the SDK |
| `homecore/plugins/{id}/manage/cmd` | Core → Plugin | Management commands |
| `homecore/plugins/{id}/manage/response` | Plugin → Core | Command responses |

The Rust SDK answers these management actions itself: `ping`,
`get_config`, `set_config`, `set_log_level`, `cancel`, `respond`,
`ui_file`, `plugin_file` and `upload_chunk`. Anything else goes to the
plugin's own handlers.

### Timeout sweep

`AppState::new` in `hc-api` spawns a sweep that runs every 30 seconds.
A plugin that supports management, is not stopped, and has sent no
heartbeat for 90 seconds is marked offline, and `PluginStatusChanged` and
`PluginOffline` events are published on the event bus.

### REST API

- `GET /api/v1/plugins/{id}`: plugin status and details
- `PATCH /api/v1/plugins/{id}`: update plugin metadata
- `DELETE /api/v1/plugins/{id}`: deregister a plugin
- `POST /api/v1/plugins/{id}/start`: start a managed plugin
- `POST /api/v1/plugins/{id}/stop`: stop a managed plugin
- `POST /api/v1/plugins/{id}/restart`: restart a managed plugin
- `GET /api/v1/plugins/{id}/config`: read plugin configuration
- `PUT /api/v1/plugins/{id}/config`: push configuration changes

`core/docs/openapi.yaml` lists the rest (install, commands, queries,
capabilities, UI files and so on).

---

## Rhai scripting boundary

Rhai scripts run synchronously inside `tokio::task::spawn_blocking`, so
they never block the async runtime. The boundary is explicit:

- Conditions and gates (`ScriptExpression`, `required_expression`,
  `trigger_condition`): a synchronous Rhai call that returns `bool`.
- Action scripts (`RunScript`): a synchronous Rhai call that collects
  side effects (device state changes, MQTT publishes, notifications) into
  a buffer, which the executor applies asynchronously after the script
  returns.

The `hc-scripting` crate wraps Rhai (with its `sync` feature) in
`ScriptRuntime`. A fresh runtime is built for each evaluation with a
snapshot of the devices (and hub variables or trigger context where they
apply). The engine caches compiled scripts (`get_or_compile_ast`), so a
script is parsed once, not on every evaluation.

The topic mapper has its own small Rhai engine for profile transforms,
which the server does not currently load any scripts into; see
[Rhai transforms](./topic-mapper.md#rhai-transforms).

---

## Module map

| File | Responsibility |
|---|---|
| `homecore/src/main.rs` | Binary entry point: parse config, wire all crates, start `Core`, the API and the plugins |
| `homecore/src/plugin_manager.rs` | Plugin supervisor, start/stop/restart, crash backoff |
| `crates/hc-core/src/lib.rs` | `Core` builder, `EventBus` definition, `start()` wiring |
| `crates/hc-core/src/engine.rs` | Rule evaluation, DashMap cache, fire history, `RuleEngine::run()` |
| `crates/hc-core/src/executor.rs` | Action dispatch, `ExecutorContext`, all action type implementations |
| `crates/hc-core/src/state_bridge.rs` | MQTT→DeviceStateChanged translation, redb writes |
| `crates/hc-core/src/scheduler.rs` | Time/solar/cron/periodic triggers, catch-up on restart |
| `crates/hc-core/src/timer_manager.rs` | Virtual timer devices |
| `crates/hc-core/src/glue/` | Glue devices: switches, counters, numbers, groups and the rest |
| `crates/hc-core/src/mode_manager.rs` | Solar + boolean mode devices |
| `crates/hc-core/src/rule_loader.rs` | RON rule file loading, UUID write-back, hot-reload watcher |
| `crates/hc-mqtt-client/src/lib.rs` | rumqttc client, `internal_bus` publisher, `PublishHandle` |
| `crates/hc-state/src/lib.rs` | redb device registry, SQLite history, `StateStore` (stores in `*_store.rs`) |
| `crates/hc-api/src/lib.rs` | `AppState`, the axum `router()` |
| `crates/hc-api/src/handlers.rs` | Most REST handler functions (others in `*_handlers.rs`) |
| `crates/hc-api/src/ws.rs` | WebSocket event stream |
| `crates/hc-api/src/streaming.rs` | StreamCache, terminal observer, stream timeouts |
| `crates/hc-topic-map/src/router.rs` | `EcosystemRouter`, field mapping and coercion, outbound commands |
| `crates/hc-topic-map/src/loader.rs` | Profile loading from the profiles directory |
| `crates/hc-auth/src/lib.rs` | JWT issuance/validation, Argon2id passwords, MQTT credentials, roles and scopes |
| `crates/hc-scripting/src/lib.rs` | Rhai engine setup, sandboxing, `ScriptRuntime` |
| `crates/hc-notify/src/lib.rs` | `NotificationService`, Pushover/email/Telegram delivery |
| `crates/hc-broker/src/lib.rs` | rumqttd embedded broker startup, optional TLS, credentials |
| `crates/hc-config/src/lib.rs` | The shape of `homecore.toml`, and its descriptor for the UI |
