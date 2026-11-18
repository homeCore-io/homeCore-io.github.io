---
id: architecture
title: Architecture
sidebar_label: Architecture
sidebar_position: 3
---

# Architecture

## Overview

homeCore is a set of Rust crates wired together in the `homecore` binary.
`core/homecore/src/main.rs` is the composition root: it reads the config,
starts each subsystem in a fixed order and hands the API its handles.
Plugins are separate processes that talk to core over MQTT. The web app
runs in its own process, the UI server, and reaches core over HTTP.

```
Plugins (child processes of core, or in a plugin runtime)
Topic-mapped devices (Tasmota, Shelly, Zigbee2MQTT, ...)
    │
    ▼
MQTT broker (embedded rumqttd, or an external broker)
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

### Processes

| Process | What it is | Talks to core over |
|---|---|---|
| `homecore` | Broker, rule engine, state store, REST and WebSocket API, plugin supervisor | n/a |
| Rust plugins | Child processes `homecore` starts from `[[plugins]]` or installs from the Catalog | MQTT, plus REST when the plugin asks for a key |
| `hc-runtime-host` | A container the operator runs. It hosts Python plugins (and later other languages) | MQTT and REST, with the key an admin pasted into it |
| UI server (`hc-web-svelte`) | Node server that serves the web app and passes `/api/v1` and the event stream through to core | HTTP and WebSocket |
| `hc-tui`, `hc-mcp`, scripts | API clients | HTTP and WebSocket |

### Startup order

`main.rs` numbers its steps in comments. In short:

1. Resolve the base directory (`--home`, then `HOMECORE_HOME`, then the
   current directory) and the config path (`--config`, then
   `HOMECORE_CONFIG`, then `<home>/config/homecore.toml`). Apply a staged
   restore if `POST /system/restore` left one.
2. Start logging.
3. Start the embedded broker, unless `[broker] external_url` names an
   external one.
4. Create core's own MQTT client (`internal.core`) and open the state
   store.
5. Create the two event buses, then spawn the listeners that must exist
   before any plugin connects: the plugin registry listener, the
   management channel, plugin API access and the plugin state listener.
6. Load rules, alerts, the device type catalog and topic-mapper profiles.
7. Run `Core::start()` (state bridge, rule engine, scheduler, managers),
   then the MQTT event loop.
8. Once the MQTT client confirms its `homecore/#` subscription, start the
   plugins.
9. Build `AppState` and serve the API until shutdown.

On shutdown `main.rs` exits with code 0, or with `hc_api::RESTART_EXIT_CODE`
when the shutdown came from `POST /system/restart`, so a supervisor such as
systemd starts it again.

---

## Dual event bus

The runtime carries two `EventBus` instances. Both are `tokio::broadcast`
channels of `Event`.

| Bus | Populated by | Contains | Consumed by |
|---|---|---|---|
| `internal_bus` | `hc-mqtt-client` | `Event::MqttMessage` (every raw MQTT packet) | `state_bridge`, rule engine (for `MqttMessage` triggers), glue/timer/mode managers (device commands), `hc-api`'s raw-bus listeners |
| `pub_bus` | `state_bridge`, scheduler, managers, alert engine, API | Typed events: `DeviceStateChanged`, `DeviceAvailabilityChanged`, `RuleFired`, `Custom` (including `system_started` and `scheduler_tick`), `ModeChanged`, `TimerStateChanged`, alert and plugin events, and more | Rule engine, WebSocket event stream, `hc-api` event log, `hc-influx` |

`internal_bus` carries raw MQTT traffic, which is high volume and low
level. `pub_bus` carries events that already mean something, so a
consumer of typed events never sees raw packets. The rule engine
subscribes to both: `MqttMessage` triggers come from `internal_bus` and
every other trigger from `pub_bus`.

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
falls behind gets `RecvError::Lagged(n)`. The engine logs a warning and
carries on, so a slow consumer never blocks the fast path. `publish`
ignores the send error a bus with no subscribers returns.

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
switches to a loop over the two buses alone. A closed channel would
otherwise win every poll and starve them.

### `raw_bus` on AppState

`AppState` in `hc-api` carries two `EventBus` handles. Pick the right one
when you add a background task:

| Field | Production value | Subscribers |
|---|---|---|
| `event_bus` | `pub_bus` (typed events only) | event log, WS event stream, plugin-registry listener, plugin API access, plugin-offline injector, metrics counter |
| `raw_bus` | `internal_bus` (`Event::MqttMessage` only) | plugin-stream SSE bridge, terminal observer, StreamCache populator, plugin state listener |

A new task in `hc-api` that filters `Event::MqttMessage` should
subscribe to `state.raw_bus`. One that watches typed events
(`PluginCapabilities`, `RuleFired`, `DeviceStateChanged` and so on)
should subscribe to `state.event_bus`.

In production these are distinct channels. `AppState::new` takes an
`AppStateParams`, whose `raw_bus` is optional. Left unset, it defaults to
a clone of `event_bus`, which suits a test harness with one merged bus.

:::caution Subscriber-spawn timing
`tokio::broadcast` doesn't replay history to a late subscriber, so
anything published before a subscriber existed is lost to it. Listeners
that must see retained messages (capability manifests in particular) have
to be spawned before the publisher fires. That means
`spawn_plugin_registry_listener` and `plugin_access::spawn_plugin_api_access`
must run before plugins spawn, and `core.start()` (which spawns
`state_bridge`) must run before `mqtt_client.run()`. `main.rs` does both
in that order now, so keep it if you rearrange the file.
:::

---

## Plugin streaming substrate

Plugins report live progress for long-running actions ("include Z-Wave
device", "pair Hue bridge") through a fixed protocol of six stages:
`progress`, `item`, `awaiting_user`, `warning`, `complete` and `error`.
Core adds two synthetic stages of its own, `canceled` and `timeout`.
Events travel on plain MQTT topics:

```
homecore/plugins/{plugin_id}/commands/{request_id}/events
```

The plugin SDK's `StreamContext` handles the envelope shape and the
retain-then-clear-on-terminal lifecycle. The
[capabilities page](../plugins/capabilities) has the spec.

### SSE bridge (`handlers::get_plugin_stream_sse`)

A client opens an `EventSource` against
`GET /api/v1/plugins/{id}/command/{request_id}/stream`. The handler sits
on the public router on purpose, because a browser can't set
`Authorization` on an `EventSource`. It accepts `?token=<jwt>`, an
`Authorization: Bearer` header for programmatic clients, or the IP
whitelist, and requires the `plugins:read` scope. Through the UI server,
the browser never builds that URL itself: the UI server adds the
credential on the way through.

Inside, the handler subscribes to `state.raw_bus`, filters for
`Event::MqttMessage` on the target topic and forwards each one as an SSE
`event: stream` chunk. It closes on the first terminal stage.

### StreamCache

A fast streaming action can finish before the HTTP client has received
the `request_id` and opened the SSE connection. The broker can't help:
under the clear-on-terminal contract, the retained event is already gone
by the time the client subscribes.

`streaming::StreamCache` covers this by mirroring stream events in
process. `spawn_stream_cache_populator(raw_bus, cache)` subscribes to
`raw_bus` and appends every stream-topic event to a buffer per
`request_id` (at most 256 events). Entries are dropped 60 seconds after
their terminal stage. When the SSE handler opens, it:

1. Subscribes to `raw_bus` first, so it doesn't miss live events.
2. Reads the cached snapshot for this `request_id`.
3. Replays the cached events to the client.
4. Forwards live events, skipping any whose `ts` was already in the
   snapshot.

The retained last event is still there as a fallback. The cache adds a
short replay window on top, so a late subscriber gets the history it
missed and then follows the live events.

### Terminal observer and timeout injection

`streaming::spawn_terminal_observer` subscribes to `raw_bus` and releases
the `StreamingRegistry` slot as soon as a terminal stage lands on any
stream topic. That is what makes `concurrency: "single"` work: a second
invocation of the same action finds the slot free as soon as the first
one finishes.

`streaming::schedule_timeout` arms a deadline per request from the
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
6. It publishes `Event::DeviceStateChanged` to `pub_bus` only if
   `!changed.is_empty()`.

The guard in step 6 keeps restarts cheap. On restart the broker replays
retained messages for every registered device. Without the guard, each
replayed message would publish a spurious `DeviceStateChanged` even when
the stored state is identical, and the rule engine would evaluate every
rule for every device at startup.

### Topic routing: `state` vs `state/partial`

The router matches on `(parts[3], parts.get(4))`, because
`topic.split('/')` puts `state` and `partial` in separate parts. A match
of `parts[3]` against `"state/partial"` would never fire, and every
per-attribute partial publish would go through the full-replace branch
and wipe `device.attributes`. The routing is:

| Topic | `parts[3]` | `parts[4]` | Handler |
|---|---|---|---|
| `…/state` | `"state"` | `None` | `handle_state(partial=false)` (full replace) |
| `…/state/partial` | `"state"` | `Some("partial")` | `handle_state(partial=true)` (merge) |
| `…/availability` | `"availability"` | `None` | `handle_availability` |
| `…/schema` | `"schema"` | `None` | `handle_device_schema` |

`homecore/devices/{id}/alerts` is handled before these (an empty payload
clears a device's alerts). The bridge also handles plugin topics such as
`homecore/plugins/{id}/heartbeat`, `…/alerts`, `…/manage/response` and
`…/logs`.

Partial merge uses `apply_partial_merge_patch`: a JSON `null` in the
patch deletes that attribute from the stored state. Plugins that emit
per-attribute updates must filter out null values unless they mean to
remove the attribute.

### Availability handling

The bridge also handles availability topics
(`homecore/devices/{id}/availability`) and publishes
`Event::DeviceAvailabilityChanged { device_id, available }` to `pub_bus`.

---

## Rule engine (`engine.rs`)

### In-memory device cache

The engine does not read redb during condition evaluation. It keeps an
`Arc<DashMap<String, HashMap<String, JsonValue>>>` (device ID to
attributes), fills it from the state store at startup, and updates it on
every `DeviceStateChanged` event before rule evaluation begins. A
`DeviceState` condition is therefore a DashMap lookup, with no redb read
and no `spawn_blocking`.

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
// Lock released here: hot-reload can now proceed
for rule in &rules_snapshot {
    evaluate_rule(rule, &event, &device_cache).await;
}
```

### Fire history ring buffer

The engine records the most recent evaluation attempts for each rule
(`HISTORY_RING_SIZE`, currently 20) in an
`Arc<DashMap<Uuid, VecDeque<RuleFiring>>>`. Each `RuleFiring` holds:

- `timestamp`: when the rule was evaluated
- `trigger_type`: which trigger variant fired
- `trigger_context`: the event data (device ID, attribute, value, and so
  on)
- `outcome`: `Fired`, `ConditionFailed`, `Cooldown`, `Paused`,
  `RequiredExpressionFailed`, `TriggerGateFailed` or `Skipped`
- `conditions`: a trace per condition with `actual`, `expected` and
  `reason`
- `actions`: the outcome of each action
- `eval_ms`: time spent evaluating conditions

At startup `Core::start()` loads the most recent firings from the
database into the buffer, so history survives restarts. The API exposes
it as `GET /api/v1/automations/{id}/history`.

### ExecutorContext

Each rule firing creates an `ExecutorContext` with what the action
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
`judge` lets an if/otherwise step decide any condition the same way the
rule's own conditions are decided.

### Concurrency model

- Each rule firing runs as its own `tokio::spawn` task, so the select
  loop never blocks on it.
- An `Arc<AtomicUsize>` (`in_flight`) counts running firings for graceful
  shutdown.
- Each rule's `run_mode` (`Parallel`, `Single`, `Restart`, or `Queued`
  with an optional `max_queue`) is enforced with run state kept per rule
  (`RuleRuns` in `engine.rs`). It holds an in-flight counter (for
  `Single` and the `max_queue` limit), the newest run's exit flag, which
  `Restart` sets so that run stops at its next step, and a semaphore with
  one permit that `Queued` runs take in turn. A queued run takes a fresh
  device snapshot once it holds the permit.
- `RunRuleActions` passes its call depth on to the called rule's actions,
  so the limit of 10 (`MAX_CALL_DEPTH` in `executor.rs`) holds across
  rules that run each other.
- `RepeatUntil` and `RepeatWhile` take a fresh snapshot from the live
  device cache for each check, as `WaitForExpression` does.
- `Delay` actions sleep inside their own task without blocking other
  firings.
- `Parallel { actions }` spawns each sub-action as its own `tokio::spawn`
  task and waits for all of them.
- A cancelable delay registers a `tokio::sync::Notify` in
  `delay_registry` under `"{rule_id}/{cancel_key}"`. `CancelDelays` looks
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
`Cron` and `Periodic` triggers, `AlertActiveFor` triggers, and
`CalendarEvent` triggers when a calendar store is attached. When one is
due it publishes a synthetic `Event::Custom` with
`event_type: "scheduler_tick"` and the rule's ID to `pub_bus`, and the
engine fires that rule. These triggers never match ordinary events.

Solar times are computed locally from the `[location]` latitude and
longitude with the sunrise equation. No cloud API is called.

To catch up after a restart, the scheduler checks every enabled
time-based rule at startup against a window (`[scheduler] catchup_window_minutes`,
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
| `GlueManager` | `hc-core/src/glue/` | Core's own helper devices (`plugin_id = "core.glue"`): switches, counters, numbers, selects, text, buttons, date-times, groups, thresholds and schedules. Definitions are seeded from `config/glue.toml`. |
| `ModeManager` | `hc-core/src/mode_manager.rs` | Solar modes (`mode_day`, `mode_night`) and named boolean modes from `modes.toml` |
| Alert engine | `hc-core/src/alerts.rs` | Works out what needs attention and announces changes |
| Battery watcher | `hc-core/src/battery_watcher.rs` | Turns state changes into `DeviceBatteryLow` / `DeviceBatteryRecovered`, with hysteresis |

Timer, glue and mode devices live in the state store (redb) like any
other device, so they survive restarts. See
[Virtual devices](../devices/virtual-devices.md) for how they are used.

---

## Broker and logins

`hc-broker` wraps an embedded rumqttd. Set `[broker] external_url` and
core starts no broker of its own; its client and the plugins it installs
connect to the external one instead (plain MQTT only, since core's
client does not speak TLS). `hc-cli broker generate-mosquitto-config`
writes a Mosquitto setup from the same config.

The embedded broker checks two kinds of login at CONNECT:

- `[[broker.clients]]` in `homecore.toml`, including `internal.core`,
  which core's own client uses.
- Logins core made itself, answered live by
  `hc_api::plugin_runtimes::BrokerLogins`: each runtime's plugin ID and
  secret (hashed in the store), and the `[homecore] password` in the
  config file of each plugin core installed or placed on a runtime. A
  login works the moment core makes it and stops when core removes it.

The broker starts before the state store opens, so until `BrokerLogins`
is filled in only `[[broker.clients]]` can log in. Nothing else connects
that early.

The embedded broker checks credentials only. `allow_pub` and `allow_sub`
are not enforced at publish or subscribe time. Topic ACLs need an
external Mosquitto broker.

---

## PluginManager

Plugin processes on the core machine are supervised by the
`PluginManager` in the server binary (`homecore/src/plugin_manager.rs`),
which `main.rs` starts. It is not part of `Core::start()`. Plugins in a
[plugin runtime](#plugin-runtimes) are supervised by the runtime host
instead.

### Per-plugin supervisor

Each `[[plugins]]` entry, plus any plugin installed at runtime (recorded
in `config/plugins/managed.toml`), gets its own supervisor task. It:

1. spawns the plugin binary as a child process, passing its config path
   and setting `HOMECORE_SUPERVISED` to core's process ID, so the plugin
   exits if core dies without stopping it first;
2. captures the child's output and logs its last lines when it exits;
3. restarts it after a crash with exponential backoff (2 s up to 60 s),
   resetting the backoff after a run of at least 60 seconds;
4. restarts a plugin that has gone quiet, marking it `not_responding`: no
   first heartbeat within 120 seconds of launch, or none for 300 seconds
   after that;
5. accepts `Start`, `Stop` and `Restart` commands over a channel, which
   the REST API uses;
6. updates the plugin's record in `AppState` and emits
   `PluginStatusChanged` on every status change.

An install from the Catalog reaches the running supervisor through a
channel (`with_plugin_spawn`), so a new plugin starts without a restart.
Editing a plugin's file in `config/plugins/` restarts that plugin.

### MQTT management channel

| Topic | Direction | Purpose |
|---|---|---|
| `homecore/plugins/{id}/heartbeat` | Plugin → Core | Liveness signal, sent every `interval_secs` the plugin gives the SDK (usually 60 seconds) |
| `homecore/plugins/{id}/manage/cmd` | Core → Plugin | Management commands |
| `homecore/plugins/{id}/manage/response` | Plugin → Core | Command responses |

The Rust SDK answers these management actions itself: `ping`,
`get_config`, `set_config`, `set_log_level`, `cancel`, `respond`,
`ui_file`, `plugin_file`, `upload_chunk` and `api_access`. Anything else
goes to the plugin's own handlers.

### Timeout sweep

`AppState::new` in `hc-api` spawns a sweep that runs every 30 seconds.
A plugin that supports management, is not stopped, and has sent no
heartbeat for 90 seconds is marked offline, and `PluginStatusChanged` and
`PluginOffline` events go out on the event bus.

### Who may run an action, and the plugin's own key

`hc-api/src/plugin_access.rs` handles the boundary between people and
plugins.

An action the manifest declares `requires_role: signed_in` is open to
anyone signed in. Every other action needs `plugins:write`, and one
declared `admin` needs the admin role as well.

Core adds the verified caller (uid, username, role, scopes, kind) to
every action it forwards, after dropping any `caller` the client put in
the body, so the plugin knows who asked.

A manifest with `api_scopes` gets the plugin its own API key. Core mints
a new one each time the manifest is published, deletes the previous one,
and sends it with the `api_access` management action. A plugin key never
holds `users:write` or `api_keys:admin`. When core runs the plugin on its
own machine, the key only works from loopback.

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

## Plugin runtimes

A plugin runtime hosts plugins that aren't native binaries. Today that
means Python. The runtime is a container (`ghcr.io/homecore-io/hc-runtime-python`,
published with every core release) running `hc-runtime-host`, a binary
from `core/runtime-host/`. The operator runs it; core never starts or
stops it.

1. An admin adds the runtime in homeCore (`POST /plugin-runtimes`). Core
   makes its login on the spot and shows a connection key once.
2. The operator pastes the key into the runtime's own page (port 8790) or
   sets `HC_RUNTIME_KEY`.
3. The host says hello (`POST /plugin-runtimes/{id}/hello`) with its
   kind, ABI and architecture, then logs in to the broker as an ordinary
   plugin, `plugin.<kind>-<short id>`. It gets heartbeat, notices, log
   forwarding and capability actions from the SDK like any other plugin.
4. Every 30 seconds (`HC_RUNTIME_POLL_SECS`) it fetches its placements and
   converges on them: it downloads each artifact, builds an environment
   per plugin and starts it. Core asks it to `check_in` at once after an
   install, update or uninstall, so a change starts in seconds.

Installing a plugin is placement (`hc-api/src/placement.rs`). Core
resolves the artifact, and if it isn't native it goes to a runtime whose
kind, ABI and architecture match, without the admin choosing where. Each
plugin on a runtime gets its own MQTT login, checked by `BrokerLogins`.
What differs per language (making an environment, installing, launching)
is data in the image's `adapter.toml`, so another language needs a new
base image and no new program.

Core refuses a runtime host older than `MIN_HOST_VERSION` in
`plugin_runtimes.rs`. The design is in
[`core/docs/pluginRuntimesPlan.md`](https://github.com/homeCore-io/homeCore/blob/develop/docs/pluginRuntimesPlan.md).

---

## People, keys and displays

`hc-auth` issues HS256 JWTs and hashes passwords and PINs with Argon2id.
Every caller ends up with a role and a set of scopes, and handlers check
scopes through typed extractors in `hc-api/src/auth_middleware.rs`.

| Caller | Credential | Notes |
|---|---|---|
| A person | Access JWT plus a refresh token | Refresh tokens are single use. Reusing one revokes the session |
| A service | API key (`hc_sk_…`) | Optional expiry and CIDR limits. A revoked key stays revoked |
| A plugin | API key minted by core | See [above](#who-may-run-an-action-and-the-plugins-own-key) |
| A display | API key marked `display` | Holds `display_scopes()`: read the house, command devices, run scenes. Never admin |
| A whitelisted address | none | A request from an `[auth].whitelist` source with no token is treated as admin. Deprecated in favor of the admin socket and API keys |
| The admin socket | Unix socket peer credentials | `[auth.admin_uds]`, used by `hc-cli` |

A display is its own identity, such as a wall tablet. A person at a
display can enter their PIN (`POST /auth/pin-session`) to use the app as
themselves for a few minutes. Only a display may exchange a PIN, and
failures are counted per display.

---

## The UI server

The web app lives in `clients/hc-web-svelte` and runs in its own Node
process, the UI server. Core holds the house's data, and the UI server
handles how it is presented.

- It serves the built app and passes `/api/v1` and the WebSocket event
  stream through to core on the same origin (`server/proxy.js`). Core
  sends no CORS headers, so the app relies on this.
- It keeps the sign-in in httpOnly cookies and adds the access token to
  each request it passes on, so page scripts never hold a credential. A
  display's key lives in its own cookie.
- It never passes on a request that carries no credential, except
  sign-in. Otherwise, if its address were on core's whitelist, anyone who
  could reach it would be admin.
- It stores the UI's own data (pages, layouts, themes, files, displays,
  extensions) under `HC_DATA_DIR`, and passes camera video to go2rtc.

Core can still serve a directory of static files itself through
`hc-web-admin` (`[web_admin]`, off by default). That was built for the
retired Leptos admin, and the standard deployment leaves it off.

---

## Rhai scripting boundary

Rhai scripts run synchronously inside `tokio::task::spawn_blocking`, so
they never block the async runtime:

- Conditions and gates (`ScriptExpression`, `required_expression`,
  `trigger_condition`) are a synchronous Rhai call that returns `bool`.
- Action scripts (`RunScript`) are a synchronous Rhai call that collects
  side effects (device state changes, MQTT publishes, notifications) into
  a buffer. The executor applies the buffer asynchronously after the
  script returns.

The `hc-scripting` crate wraps Rhai (with its `sync` feature) in
`ScriptRuntime`. Each evaluation builds a fresh runtime with a snapshot of
the devices, plus hub variables or trigger context where they apply. The
engine caches compiled scripts (`get_or_compile_ast`), so a script is
parsed once.

The topic mapper has its own small Rhai engine for profile transforms.
The server does not currently load any scripts into it; see
[Rhai transforms](./topic-mapper.md#rhai-transforms).

---

## Module map

| File | Responsibility |
|---|---|
| `homecore/src/main.rs` | Binary entry point: parse config, wire all crates, start `Core`, the API and the plugins |
| `homecore/src/plugin_manager.rs` | Plugin supervisor, start/stop/restart, crash backoff, quiet-plugin restarts |
| `crates/hc-core/src/lib.rs` | `Core` builder, `EventBus` definition, `start()` wiring |
| `crates/hc-core/src/engine.rs` | Rule evaluation, DashMap cache, fire history, `RuleEngine::run()` |
| `crates/hc-core/src/executor.rs` | Action dispatch, `ExecutorContext`, every action type |
| `crates/hc-core/src/state_bridge.rs` | MQTT to `DeviceStateChanged`, redb writes |
| `crates/hc-core/src/scheduler.rs` | Time, solar, cron and periodic triggers, catch-up on restart |
| `crates/hc-core/src/timer_manager.rs` | Virtual timer devices |
| `crates/hc-core/src/glue/` | Glue devices: switches, counters, numbers, groups and the rest |
| `crates/hc-core/src/mode_manager.rs` | Solar and boolean mode devices |
| `crates/hc-core/src/rule_loader.rs` | RON rule file loading, UUID write-back, hot-reload watcher |
| `crates/hc-mqtt-client/src/lib.rs` | rumqttc client, `internal_bus` publisher, `PublishHandle` |
| `crates/hc-state/src/lib.rs` | redb device registry, SQLite history, `StateStore` (stores in `*_store.rs`) |
| `crates/hc-api/src/lib.rs` | `AppState`, the axum `router()` |
| `crates/hc-api/src/handlers.rs` | Most REST handler functions (others in `*_handlers.rs`) |
| `crates/hc-api/src/ws.rs` | WebSocket event stream |
| `crates/hc-api/src/streaming.rs` | StreamCache, terminal observer, stream timeouts |
| `crates/hc-api/src/plugin_access.rs` | Who may run a plugin action, the caller, plugin API keys |
| `crates/hc-api/src/plugin_runtimes.rs` | Runtime logins, `BrokerLogins`, `MIN_HOST_VERSION` |
| `crates/hc-api/src/plugin_runtime_handlers.rs` | Runtime endpoints: add, reset, remove, hello, placements, artifacts |
| `crates/hc-api/src/placement.rs` | Choosing a runtime for a plugin |
| `crates/hc-api/src/plugin_install.rs` | Catalog and file installs |
| `crates/hc-api/src/display_handlers.rs` | Displays and PIN sessions |
| `crates/hc-api/src/management_rpc.rs` | Requests over the plugin management channel |
| `crates/hc-topic-map/src/router.rs` | `EcosystemRouter`, field mapping and coercion, outbound commands |
| `crates/hc-topic-map/src/loader.rs` | Profile loading from the profiles directory |
| `crates/hc-auth/src/lib.rs` | JWT issue and validation, Argon2id passwords, MQTT credentials, roles and scopes |
| `crates/hc-scripting/src/lib.rs` | Rhai engine setup, sandboxing, `ScriptRuntime` |
| `crates/hc-notify/src/lib.rs` | `NotificationService`, Pushover, email and Telegram delivery |
| `crates/hc-broker/src/lib.rs` | rumqttd embedded broker startup, optional TLS, credentials, live logins |
| `crates/hc-config/src/lib.rs` | The shape of `homecore.toml`, and its descriptor for the UI |
| `crates/hc-cli/src/main.rs` | `hc-cli`: setup, users, API keys, broker config generation |
| `runtime-host/src/main.rs` | `hc-runtime-host`: the runtime page, check-in, reconcile, plugin supervision |
