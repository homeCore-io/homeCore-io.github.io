---
id: developing-plugins
title: Developing Plugins
sidebar_label: Developing Plugins
sidebar_position: 2
---

# Developing Plugins

Plugins can be written in any language that has an MQTT client library. HomeCore provides first-class SDKs for Rust, Python, Node.js, and .NET Core.

**The Rust SDK and every Rust plugin live inside the homeCore repository**, at
`sdk/rust` and `plugins/<name>`. The Python, Node.js and .NET SDKs are separate
repositories, cloned into `sdks/` alongside `core/`.

## Installing an SDK

**None of the SDKs is published to a package registry** — not crates.io, PyPI,
npm, or NuGet. So there is no `pip install homecore-plugin-sdk`; installing
means the local checkout or a git tag.

### Rust

Nothing to install. Your plugin is a workspace member of the homeCore repo
beside the SDK, and depends on it by path:

```toml
[dependencies]
plugin-sdk-rs = { path = "../../sdk/rust" }
```

An SDK edit is live in every plugin on the next `cargo build`, and the repo-root
`cargo fmt` / `clippy` / `test` cover core, the SDK and all thirteen plugins
together — so a change that breaks a plugin fails at once rather than at that
plugin's next release.

:::note This replaced a much more complicated arrangement
Rust plugins used to be separate repositories, each pinning `hc-plugin-sdk-rs`
by git tag, redirected to a local checkout by a `[patch]` table in a
`plugins/Cargo.toml` meta-workspace. That is all gone — the plugin repos are
archived read-only and the meta-workspace no longer exists. Instructions
mentioning any of it predate the monorepo.
:::

For a Rust plugin developed *outside* the homeCore repo, pin the core release
tag — the SDK re-exports `hc-types`, which is the plugin ABI:

```toml
plugin-sdk-rs = { git = "https://github.com/homeCore-io/homeCore", tag = "v0.1.29" }
```

No `path` key is needed: cargo finds `plugin-sdk-rs` by package name among the
repo's workspace members.

### Python, Node.js and .NET

These SDKs are still their own repositories. With `core/` and `sdks/` cloned
side by side, point your plugin at the checkout:

| | From your plugin's directory |
|---|---|
| Python | `pip install -e ../../sdks/hc-plugin-sdk-py` |
| Node.js | `npm install ../../sdks/hc-plugin-sdk-js` |
| .NET | `dotnet add reference ../../sdks/hc-plugin-sdk-dotnet/HomeCoreSdk.csproj` |

Python's `-e` and npm's directory install both link rather than copy, so an SDK
edit is live without a reinstall. .NET builds the SDK from source as part of
your build.

From a release instead:

| | |
|---|---|
| Python | `pip install git+https://github.com/homeCore-io/hc-plugin-sdk-py@v0.2.0` |
| Node.js | `npm install github:homeCore-io/hc-plugin-sdk-js#v0.2.0` |
| .NET | clone at the tag, then `dotnet add reference …/HomeCoreSdk.csproj` |

NuGet has no git-install equivalent, which is why .NET clones.

---

## Rust SDK (`plugin-sdk-rs`)

The fastest start is `plugins/hc-plugin-template` — a working virtual-light
plugin, small enough to read in one sitting, with the management protocol, a
config schema and descriptor, a capability action, and a notice already wired
up.

```sh
cp -r plugins/hc-plugin-template plugins/hc-mything
$EDITOR Cargo.toml          # add "plugins/hc-mything" to [workspace] members
```

Then rename the package and binary in its `Cargo.toml`, the `plugin_id` in its
config, and the `Descriptor::new` id in `config.rs`.

### Add to Cargo.toml

The crate is named `plugin-sdk-rs`. See
[Installing an SDK](#installing-an-sdk).

```toml
[dependencies]
plugin-sdk-rs = { path = "../../sdk/rust" }
tokio         = { version = "1", features = ["full"] }
serde_json    = "1"
anyhow        = "1"
```

### Minimal plugin

```rust
use plugin_sdk_rs::{PluginClient, PluginConfig};
use serde_json::json;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let client = PluginClient::connect(PluginConfig {
        broker_host: "127.0.0.1".into(),
        broker_port: 1883,
        plugin_id: "plugin.my-device".into(),
        password: String::new(),
    })
    .await?;

    // Take handles BEFORE starting the loop — `run` consumes the client.
    let publisher = client.device_publisher();

    // Start the event loop FIRST. Commands arrive on this callback, which is
    // synchronous — hand slow work to a task over a channel. See
    // "Start the event loop before you register" below.
    let event_loop = tokio::spawn(async move {
        client
            .run(|device_id, payload| {
                println!("Command for {device_id}: {payload}");
            })
            .await
    });

    // Register the device.
    publisher
        .register_device_full(
            "my_device_001",
            "My Device",
            Some("sensor"),
            Some("living_room"),
            Some(json!({
                "temperature": { "type": "number" },
                "humidity":    { "type": "number" }
            })),
        )
        .await?;

    // Subscribing to commands is a SEPARATE call. Skip it and the device
    // appears in homeCore, updates its state, and silently ignores every
    // command — nothing is listening on its cmd topic.
    publisher.subscribe_commands("my_device_001").await?;

    publisher
        .publish_state("my_device_001", &json!({ "temperature": 72.5, "humidity": 45.0 }))
        .await?;
    publisher.publish_availability("my_device_001", true).await?;

    // Returns only when the loop stops.
    event_loop.await?
}
```

A real plugin calls `run_managed` rather than `run`, passing the handle from
`enable_management`, so core can heartbeat it, restart it, push configuration,
and render its actions as buttons.

### Start the event loop before you register

`run` / `run_managed` is what *drives* the MQTT connection. Until one of them is
polling, nothing you publish leaves the process — it queues, and the queue holds
64 messages.

Registering one device costs four of them: register, subscribe, state,
availability. So a plugin that registers its devices and *then* calls
`run_managed` works fine with three devices and **hangs at startup with
seventeen**, never reaching the line that would have drained the queue. There is
no error and no log line; it simply stops, on a machine that differs from yours
only in how many devices are configured.

Measured against a real broker, a plugin registering 40 devices gets through 12
of them in the register-first order, and all 40 when the loop is spawned first.
Every shipped plugin spawns it first.

Nothing is lost by starting early: a command for a device you have not
registered cannot arrive, because the subscription that would carry it does not
exist until you make it.

### Publishing state updates

```rust
// Full state (retained — replaces the previous state).
publisher
    .publish_state("my_device_001", &json!({
        "temperature": 73.0,
        "humidity": 44.5,
        "battery": 87
    }))
    .await?;

// Partial (JSON merge-patch — only the fields given).
publisher
    .publish_state_partial("my_device_001", &json!({ "temperature": 73.0 }))
    .await?;

// After a command, attach provenance so the UI and the audit log can say
// what caused the change instead of showing an anonymous update.
publisher
    .publish_state_for_command("my_device_001", &new_state, &command_payload, "my-plugin")
    .await?;
```

### Handling commands

homeCore never writes device state. A command arrives on
`homecore/devices/{id}/cmd`, the plugin does whatever the device needs, and the
plugin publishes what *actually happened*. That is why the UI can correctly
show a light as off after a command the bulb refused.

```rust
let (tx, mut rx) = tokio::sync::mpsc::channel::<(String, serde_json::Value)>(64);

tokio::spawn(async move {
    while let Some((device_id, payload)) = rx.recv().await {
        if let Some(on) = payload.get("on").and_then(|v| v.as_bool()) {
            set_relay(on).await;                       // talk to the device
            publisher                                   // then publish the truth
                .publish_state_for_command(&device_id, &json!({ "on": on }), &payload, "my-plugin")
                .await
                .ok();
        }
    }
});

client
    .run_managed(
        move |device_id, payload| {
            // try_send, not send: dropping a command under load beats blocking
            // the MQTT event loop behind it.
            let _ = tx.try_send((device_id, payload));
        },
        mgmt,
    )
    .await
```

### Notices

A notice is how a plugin's problem reaches the operator's screen rather than
only the log. They render on the plugin's card in the web UI.

```rust
use plugin_sdk_rs::types::PluginNotice;

let notices = client.notices();

notices.raise(
    PluginNotice::error("bridge_unreachable", "The bridge stopped answering")
        .with_remedy("Check that the bridge is powered on and reachable"),
);

notices.clear("bridge_unreachable");   // when it answers again
```

**A notice is state, not a log line.** It stays up while the condition holds,
so re-evaluate after each discovery sweep, reconnect, and config change rather
than deciding once at startup — a plugin that raises `no_devices_configured` at
boot and never looks again is still showing it after the user's devices arrive.

Notices and capability actions are available in every SDK.

:::note Plugin isolation via per-device subscriptions
Every SDK uses per-device topic subscriptions — not wildcards. A plugin subscribes to `homecore/devices/{device_id}/cmd` for each device it owns, and receives commands for nothing else, which keeps well-behaved plugins from stomping on each other by convention. In Rust that is an explicit `subscribe_commands()` call; in Python, Node.js and .NET registering the device does it for you.

**Trust boundary caveat:** on the default embedded rumqttd broker, per-topic ACLs are not enforced. A misbehaving or hostile plugin could subscribe outside its declared patterns. Deployments that cannot rely on plugin correctness (containers, third-party code, compliance scenarios) should run HomeCore with an external Mosquitto broker, which enforces the same `allow_pub` / `allow_sub` patterns declared in `[[broker.clients]]`. See [External Mosquitto deployment](../administration/broker#external-mosquitto-deployment).
:::

### Cross-restart device cleanup

When a device disappears from a plugin's authoritative source — a Hue
bulb deleted from the bridge, a Z-Wave node excluded, an entry removed
from `[[devices]]` — its homeCore record needs to go away too. The SDK
handles persistence and the diff so plugins only need to declare what's
live each cycle.

```rust
// 1. Opt in once at startup (typically next to config.toml).
let client = PluginClient::connect(cfg)
    .await?
    .with_device_persistence(
        Path::new(&config_path)
            .parent()
            .unwrap_or(Path::new("."))
            .join(".published-device-ids.json"),
    );

// 2. After a healthy sync where you know the full live set:
let live: HashSet<String> = my_upstream
    .list_devices()
    .iter()
    .map(|d| d.hc_id())
    .collect();
let report = publisher.reconcile_devices(live).await?;
// report.stale_unregistered: Vec<String>
//   = devices unregistered because they're not in `live`
// report.unknown_in_live: Vec<String>
//   = ids you passed but never registered (usually empty)
```

**What the SDK does:**

- `with_device_persistence(path)` mirrors every `register_device_full` /
  `unregister_device` call to a JSON file. On startup, the file is
  loaded so the in-memory tracker isn't blank — that's how a plugin
  knows about devices it registered in a previous session.
- `reconcile_devices(live)` computes `tracked - live`, calls
  `unregister_device` for each stale id, and writes the new live set
  back to disk.

**What plugins must decide:**

- **When to call.** Only when the upstream sync actually succeeded.
  Calling reconcile after a partial fetch will wipe live devices behind
  a temporarily-unreachable upstream. The typical pattern is an
  `all_bridges_succeeded` (or equivalent) flag tracked across the
  per-source loop.
- **Whether to call at all.** Plugins whose upstream has irregular
  reporting cadence (battery sensors that go quiet for hours, e.g.
  hc-ecowitt) should opt into persistence but skip auto-reconcile —
  the false-positive risk is worse than the zombie-device cost.
  Operators can clean up zombies with the core endpoint
  `DELETE /api/v1/plugins/:id/devices` when needed.

**The same thing in the other SDKs.** Identical semantics, idiomatic names:

| | Enable | Reconcile |
|---|---|---|
| Rust | `with_device_persistence(path)` | `reconcile_devices(live)` |
| Python | `enable_device_persistence(path)` | `reconcile_devices(live)` |
| Node.js | `enableDevicePersistence(path)` | `reconcileDevices(live)` |
| .NET | `EnableDevicePersistence(path)` | `ReconcileDevicesAsync(live)` |

All four scope the snapshot filename by plugin id
(`.published-device-ids.plugin.hue.json`), because deployments keep every
plugin's config in one directory and every plugin derives the path the same way
— unscoped, two plugins share one file and retire each other's devices.

**Manual bulk wipe.** Independent of SDK reconcile, an admin can call:

```text
DELETE /api/v1/plugins/<plugin_id>/devices
```

…to delete every device whose `plugin_id` matches. The plugin stays
registered; on its next sync cycle it re-registers anything still
live. Useful for clearing zombies left over from development churn or
config rearrangements without dropping the whole state DB. It is an
API-only operation — the web UI does not surface a button for it.

### Cross-device consumer plugins

Most plugins own their devices and only observe their own command topics. A
**cross-device consumer** plugin also needs to *observe state from other
plugins' devices* — e.g. a virtual thermostat aggregating temperature
readings from YoLink and Ecowitt sensors.

The Rust SDK supports this directly:

```rust
// Subscribe to another plugin's device state (tracked for reconnect).
client.subscribe_state("yolink_sensor_a").await?;
client.subscribe_state("ecowitt_outdoor_temp").await?;

// Drive the event loop with TWO callbacks: own cmd + external state.
client.run_managed_with_state(
    move |device_id, payload| {
        // Commands on OUR devices (homecore/devices/thermostat_+/cmd)
    },
    move |device_id, payload| {
        // State from OTHER devices we subscribed to
    },
    mgmt,
).await?;

// Later, at runtime:
client.unsubscribe_state("ecowitt_outdoor_temp").await?;
```

`run_managed_with_state` is a drop-in replacement for `run_managed`. Use
`run_managed` when you don't need external state. The corresponding
`DevicePublisher::subscribe_state` / `unsubscribe_state` methods let
background tasks adjust subscriptions dynamically (e.g. when a user
changes the sensor list via a runtime command).

**Broker ACL:** cross-device consumers need `allow_sub = ["homecore/devices/+/state"]`
— broader than the typical plugin ACL. See the [thermostat plugin](./thermostat)
Setup section for a complete example.

See [`hc-thermostat`](./thermostat) for a reference implementation.

---

## Python SDK (`hc-plugin-sdk-py`)

[Install it](#installing-an-sdk) first. Subclass `PluginBase`, implement `on_command`, call `run()`. The API is
synchronous — the SDK drives paho-mqtt's loop for you, so background work goes
in a thread.

```python
from homecore_plugin_sdk import PluginBase

DEVICE_ID = "light.virtual_py_01"
CAPABILITIES = {
    "on":         {"type": "boolean"},
    "brightness": {"type": "integer", "minimum": 0, "maximum": 255},
}


class MyPlugin(PluginBase):
    PLUGIN_ID = "plugin.my-sensor"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._state = {"on": False, "brightness": 128}

    def on_connect(self) -> None:
        # Called once the broker connection is up — register here, not in
        # __init__, so a reconnect re-registers too.
        self.register_device(DEVICE_ID, "Virtual Light", CAPABILITIES, area="living_room")
        self.publish_availability(DEVICE_ID, True)
        self.publish_state(DEVICE_ID, dict(self._state))
        self.publish_plugin_status("active")

    def on_command(self, device_id: str, payload: dict) -> None:
        self._state.update({k: v for k, v in payload.items() if k in CAPABILITIES})
        # Publish what you actually applied, with provenance attached.
        self.publish_state_for_command(
            device_id, dict(self._state), payload, fallback_source="my-plugin"
        )


MyPlugin(broker_host="127.0.0.1", broker_port=1883).run()
```

Configuration comes from constructor arguments, then the environment
(`HC_BROKER_HOST`, `HC_BROKER_PORT`, `HC_PLUGIN_PASSWORD`), then defaults.
Requires Python 3.11+. See `examples/virtual_light.py` in the SDK repo for a
complete plugin.

---

## Node.js SDK (`hc-plugin-sdk-js`)

[Install it](#installing-an-sdk) first. Extend `PluginBase`, implement `onCommand`, call `run()`. Same shape as the
Python SDK, on mqtt.js v5.

```javascript
const { PluginBase } = require('homecore-plugin-sdk');

const DEVICE_ID = 'light.virtual_js_01';
const CAPABILITIES = {
  on:         { type: 'boolean' },
  brightness: { type: 'integer', minimum: 0, maximum: 255 },
};

class MyPlugin extends PluginBase {
  constructor(options = {}) {
    super({ pluginId: 'plugin.my-device', ...options });
    this._state = { on: false, brightness: 128 };
  }

  onConnect() {
    this.registerDevice(DEVICE_ID, 'Virtual Light', CAPABILITIES, 'living_room');
    this.publishAvailability(DEVICE_ID, true);
    this.publishState(DEVICE_ID, { ...this._state });
    this.publishPluginStatus('active');
  }

  onCommand(deviceId, payload) {
    Object.assign(this._state, payload);
    this.publishStateForCommand(deviceId, { ...this._state }, payload, 'my-plugin');
  }
}

new MyPlugin({ brokerHost: '127.0.0.1', brokerPort: 1883 }).run();
```

Requires Node.js 18+. See `examples/virtual_light.js` in the SDK repo.

---

## .NET SDK (`hc-plugin-sdk-dotnet`)

[Install it](#installing-an-sdk) first.

```csharp
using HomeCore.PluginSdk;

var client = new PluginClient(new PluginOptions { PluginId = "plugin.my-device" });

client.OnCommand += (deviceId, payload) => {
    Console.WriteLine($"Command for {deviceId}: {payload}");
};

await client.ConnectAsync();
await client.RegisterDeviceFullAsync("my_device_001", "My Device", deviceType: "sensor");

// Separate from registration — without it the device appears in homeCore and
// silently ignores every command.
await client.SubscribeCommandsAsync("my_device_001");

await client.PublishStateAsync("my_device_001", new { temperature = 72.5 });
await client.PublishAvailabilityAsync("my_device_001", true);
await client.RunAsync();
```

Configuration falls back to `HC_BROKER_HOST`, `HC_BROKER_PORT`, and
`HC_PLUGIN_PASSWORD` when the options are not set.

---

## Choosing a language

All four SDKs do the same job — every feature in the
[matrix](#sdk-feature-matrix) below is in all of them. Pick the language you
would rather write the device integration in.

The Rust SDK remains the reference implementation, and new protocol features
land there first.

:::caution Logging secrets in .NET
Every SDK redacts field *values* whose names look secret. In Rust and Python a
field passed alongside the message stays out of the message text, so that is
enough. **.NET renders every template argument into the message**, so
`LogInformation("connecting with {ApiKey}", key)` would publish the key in the
text as well — the .NET SDK therefore also scrubs those values out of the
rendered message. None of it helps with a secret you interpolate yourself, so
the rule in every language is still: do not log secrets.
:::

---

## Management protocol

Plugins built with the official SDKs can opt into the management protocol, which enables:

- **Heartbeat monitoring** — the plugin publishes to `homecore/plugins/{id}/heartbeat` every 30-60 seconds. HomeCore marks the plugin offline after 90 seconds without a heartbeat.
- **Remote configuration** — HomeCore can push config changes via `homecore/plugins/{id}/manage/cmd` with `set_config`.
- **Dynamic log level** — change the plugin's log verbosity at runtime via `set_log_level` without restarting.
- **Health checks** — `ping` command with `pong` response.
- **Log forwarding** — plugin logs are published to `homecore/plugins/{id}/logs` over MQTT, making them visible in the admin UI Activity page alongside core logs. Configurable minimum level via `log_forward_level` in the plugin's `[logging]` config.

All four SDKs (Rust, Python, Node.js, .NET) handle the management protocol automatically when enabled.

## Configuration: schema and descriptor

An operator configures your plugin from its page in the web UI. What they see
there is decided by two documents you publish on the capability manifest — and
if you publish neither, they get a raw TOML textarea.

| | What it is | Who writes it |
|---|---|---|
| **Config schema** | JSON Schema of your config: what fields exist, of what type | Derived from your config structs |
| **Config descriptor** | How to *present* them: sections, units, help text, secrets, conditionals | You, by hand |

Publish both. The schema stays authoritative for existence and for core-side
validation; the descriptor annotates intent. Core serves them at
`GET /plugins/{id}/config/schema` and `GET /plugins/{id}/config/descriptor`.

```rust
let mgmt = match config::config_schema() {
    Some(schema) => mgmt.with_config_schema(schema),
    None => mgmt,
};
let mgmt = mgmt.with_config_descriptor(config::config_descriptor());
```

The descriptor is built with typed builders, so a mistyped field kind is a
compile error rather than a field that silently never renders:

```rust
use plugin_sdk_rs::config_descriptor::{Cond, Descriptor, Field, Section};

Descriptor::new("plugin.example")
    .title("Example")
    .section(
        Section::new("api", "HTTP API")
            .field(Field::toggle("api.enabled").label("Enable HTTP API").default(true))
            .field(
                Field::port("api.port")
                    .label("Port")
                    .default(8080)
                    .visible_when(Cond::truthy("api.enabled")),
            ),
    )
    .section(
        Section::new("connection", "Connection")
            .hidden()
            .field(Field::secret("homecore.password").label("Broker password")),
    )
    .build()
```

Field kinds include `toggle`, `text`, `host`, `port`, `url`, `secret`, `int`,
`number`, `duration`, `enumeration`, `select`, `list`, `table`, `note` and
`link`. A `table` can bind to a live core resource (`Source::core_resource`) so
a form edits the device registry rather than your TOML.

:::warning A published descriptor is authoritative
The editor renders your descriptor **instead of** deriving a form from the
schema. So a config field the descriptor omits is not merely unlabelled — it is
uneditable, while the schema still declares it and your plugin still reads it.
hc-sonos shipped a descriptor missing its logging section once, and those
settings simply vanished from the page.

Guard it with a test. Every shipped plugin has this one, and
`missing_schema_coverage` is in the SDK for it:

```rust
#[test]
fn descriptor_covers_every_schema_field() {
    let missing = plugin_sdk_rs::config_descriptor::missing_schema_coverage(
        &config_schema().unwrap(),
        &config_descriptor(),
        &["homecore.plugin_id"],   // justified omissions, with a reason
    );
    assert!(missing.is_empty(), "missing from the descriptor: {missing:?}");
}
```

The third argument is an explicit allow-list, so an intentional omission is a
line someone had to write and can be reviewed, rather than an oversight.
:::

Hiding a section (`.hidden()`) still counts as covering its fields — use that
for values core writes at install, like the broker host and password, rather
than leaving them out.

Schema derivation is behind a cargo feature in every Rust plugin, so it can be
compiled out:

```toml
[features]
default = ["schema"]
schema  = ["dep:schemars", "plugin-sdk-rs/schema"]
```

**In the other SDKs**, both documents ride the capability manifest exactly the
same way — `config_schema` / `config_descriptor` on the Python `Capabilities`
dataclass, `configSchema` / `configDescriptor` in the Node.js constructor
options, `ConfigSchema` / `ConfigDescriptor` on the .NET record. What is
Rust-only is the *typed authoring*: the `Descriptor` / `Section` / `Field`
builders and `missing_schema_coverage`. Elsewhere you hand over a plain
dict/object, so a mistyped field kind is caught by the editor not rendering it
rather than by the compiler — which makes the coverage habit more important
there, not less.

## Capability manifest

Plugins declare plugin-specific actions in a typed manifest; the admin
UI renders Actions buttons from it and hc-mcp exposes the entries as
tools. Adding a new action **doesn't require any changes** to core,
the SDKs, the web UI, or hc-mcp — the framework is fully
data-driven.

See the dedicated [Plugin Capabilities & Actions](./capabilities) page
for the full spec, manifest fields, stage vocabulary, and protocol.
The short version below shows how to wire it up from the Rust SDK.

### Sync (non-streaming) action

For a fire-and-forget command. Add a `with_capabilities` arm and
handle the action through `with_custom_handler`:

```rust
let mgmt = client
    .enable_management(
        60,
        Some(env!("CARGO_PKG_VERSION").to_string()),
        Some(config_path.to_string()),
        Some(log_level_handle),
    )
    .await?
    .with_capabilities(hc_types::Capabilities {
        spec: "1".into(),
        plugin_id: String::new(),  // SDK fills from configured plugin_id
        actions: vec![hc_types::Action {
            id: "rescan_devices".into(),
            label: "Rescan devices".into(),
            description: Some("Refresh inventory from the cloud.".into()),
            params: None,
            result: None,
            stream: false,
            cancelable: false,
            concurrency: hc_types::Concurrency::default(),
            item_key: None,
            item_operations: None,
            requires_role: hc_types::RequiresRole::User,
            timeout_ms: None,
        }],
    })
    .with_custom_handler(move |cmd| match cmd["action"].as_str()? {
        "rescan_devices" => {
            rescan_tx.try_send(()).ok();
            Some(serde_json::json!({ "status": "ok" }))
        }
        _ => None,
    });
```

### Streaming action

Long-running flows that emit live progress, accept user prompts, and
handle cancel. Use `with_streaming_action` and the `StreamContext`'s
helper methods:

```rust
use plugin_sdk_rs::{StreamContext, StreamingAction};
use serde_json::{json, Value};

let mgmt = mgmt.with_streaming_action(StreamingAction::new(
    "include_node",
    move |ctx: StreamContext, _params: Value| async move {
        ctx.progress(Some(0), Some("starting"), Some("Press the button on each device")).await?;

        // ... wait for device events, emit item_add per node ...
        ctx.item_add(json!({ "node_id": 14, "status": "added" })).await?;
        ctx.item_update(json!({ "node_id": 14, "status": "ready" })).await?;

        // Wait for user "done" via awaiting_user / await_respond.
        ctx.emit_awaiting_user_with_schema(
            "Reply when finished",
            json!({ "done": { "type": "boolean", "default": true } }),
        ).await?;
        let _ = ctx.await_respond().await?;

        // Always end with a terminal stage.
        ctx.complete(json!({ "nodes_added": [14] })).await
    },
)));
```

The stage helpers (`progress`, `item_add` / `item_update` /
`item_remove`, `awaiting_user`, `warning`, `complete`, `error`,
`canceled`) handle the envelope shape and the
`stream_topic` for you. Check `ctx.is_canceled()` in cooperative
loops; pair `emit_awaiting_user_with_schema` with `await_respond`
when the closure also needs to process other async work concurrently.

The Z-Wave plugin's `inclusion.rs` is a comprehensive worked example
covering all the patterns; the `hc-captest` plugin in
`plugins/hc-captest/` has six minimal-but-complete demos exercising
every convention.

## SDK feature matrix

| Feature | Rust | Python | Node.js | .NET |
|---|---|---|---|---|
| Publish state (full + partial) | ✅ | ✅ | ✅ | ✅ |
| Device registration (typed + full) | ✅ | ✅ | ✅ | ✅ |
| Device schema publishing | ✅ | ✅ | ✅ | ✅ |
| Availability publishing | ✅ | ✅ | ✅ | ✅ |
| Event publishing | ✅ | ✅ | ✅ | ✅ |
| Command handling | ✅ | ✅ | ✅ | ✅ |
| Per-device command subscription | ✅ | ✅ | ✅ | ✅ |
| Plugin status | ✅ | ✅ | ✅ | ✅ |
| Management protocol | ✅ | ✅ | ✅ | ✅ |
| Command change metadata | ✅ | ✅ | ✅ | ✅ |
| Auto-reconnect | ✅ | ✅ | ✅ | ✅ |
| Notices | ✅ | ✅ | ✅ | ✅ |
| Capability actions (immediate) | ✅ | ✅ | ✅ | ✅ |
| Capability actions (streaming) | ✅ | ✅ | ✅ | ✅ |
| Cross-device state subscription | ✅ | ✅ | ✅ | ✅ |
| Log forwarding (MQTT) | ✅ | ✅ | ✅ | ✅ |
| Device persistence + reconcile | ✅ | ✅ | ✅ | ✅ |

See [Plugin Overview: Management Protocol](./overview#plugin-management-protocol) for the full MQTT topic reference and API endpoints.

---

## Raw MQTT (any language)

You can write a plugin in any language using any MQTT client library. Follow the topic protocol directly:

### 1. Connect to broker

```
host: 127.0.0.1
port: 1883
client_id: plugin.my-device
username:  plugin.my-device   (same as client_id)
password:  your-password       (if broker auth enabled, else empty)
```

### 2. Register a device

Publish to `homecore/plugins/plugin.my-device/register`:

```json
{
  "device_id":   "my_device_001",
  "plugin_id":   "plugin.my-device",
  "name":        "My Device",
  "area":        "living_room",
  "device_type": "sensor",
  "capabilities": {
    "temperature": {"type": "number"},
    "battery":     {"type": "integer", "minimum": 0, "maximum": 100}
  }
}
```

### 3. Publish state (retained)

Publish to `homecore/devices/my_device_001/state` with `retain=true`:

```json
{"temperature": 72.5, "battery": 87}
```

### 4. Publish availability (retained)

Publish to `homecore/devices/my_device_001/availability` with `retain=true`:

```
online
```

or when disconnecting (use MQTT Last Will):

```
offline
```

### 5. Subscribe to commands

Subscribe to `homecore/devices/my_device_001/cmd`.

Incoming payload is a JSON object with device-specific fields. Apply them to the physical device, then publish the new state back.

## Plugin file structure conventions

A Rust plugin is a directory under `plugins/` in the homeCore repo, and a
workspace member:

```
plugins/hc-my-plugin/
├── Cargo.toml                  # [package] name = "hc-my-plugin"
├── config/
│   └── config.toml.example     # committed example, no secrets
├── src/
│   ├── main.rs                 # connect → manage → describe → run → register
│   └── config.rs               # the config structs, schema and descriptor
└── README.md
```

Add `"plugins/hc-my-plugin"` to `[workspace] members` in the repo-root
`Cargo.toml`. That is the only registration step: CI, formatting, clippy and
tests already run over every member, and the release workflow derives everything
it needs from the directory name.

In a real install you never place `config.toml` yourself — core seeds it at
`config/plugins/<plugin_id>.toml`, hands the path to your process as `argv[1]`,
and restarts the plugin when an operator edits it. The committed
`config.toml.example` is for running the binary by hand during development.

`config.toml` structure:

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.my-device"
password    = ""

[my_device]
# plugin-specific settings
host     = "192.168.1.x"
username = "admin"
password = "change-me"
```

## Distributing a plugin

Plugins do **not** ship as container images. They ship as signed `.tar.zst`
artifacts in the [plugin registry](https://github.com/homeCore-io/registry):
a `plugin.toml` manifest plus the binary, ed25519-signed, indexed at
`https://homecore.io/registry/index.json`.

Core downloads the artifact, verifies the signature against the public key in
its `[registry]` config, unpacks it to
`$HOMECORE_HOME/plugins/<id>/<version>/`, seeds a config with generated MQTT
credentials, and runs the binary as a child process it supervises and
restarts. Users install with Plugins → Add in the web UI.

Releasing is one tag on the homeCore repo. Bump your plugin's `Cargo.toml` on
`develop`, merge to `main`, and push `hc-my-plugin-v0.1.0`. The shared workflow
recognises the `hc-<name>-v<version>` shape, builds a static musl binary,
packages the `.tar.zst`, attaches it to the GitHub Release, notifies the
registry, and then polls the *served* index until the entry appears — so a green
release means an installable plugin, not just a successful build. A plain
`v<version>` tag releases the server instead.

There is no per-plugin workflow to copy, and no SDK tag to push first.

There used to be a `plugins/Dockerfile.plugin` template for building a plugin
into its own container, run with `network_mode: host` against core's broker.
That shape is retired and the template is gone. If you need a plugin on a
different host, the SDK still supports it — point `broker_host` /
`broker_port` in the plugin's `[homecore]` config at core's broker, and expose
the broker accordingly.

## Declaring a device

Registering a device tells homeCore it exists. The **device schema** tells
every client what to draw for it, and it is the half most plugins skip.

A client will not offer a control the plugin has not promised. So a device
without a schema still works — state flows, commands arrive — and appears as a
row of raw JSON that nobody can operate. Measured on the reference house before
this was taken seriously: **77 of 184 devices published no schema**, including
every scene, fan and timer. Each one was a plugin that registered and stopped.

```rust
use plugin_sdk_rs::types::schema::{
    AttributeKind, AttributeSchema, BoolStates, DeviceSchema, StateLabel,
};

let mut attributes = HashMap::new();
attributes.insert("on".into(), AttributeSchema {
    kind: AttributeKind::Bool,
    writable: true,
    display_name: Some("Power".into()),
    states: Some(BoolStates {
        when_true:  StateLabel::verbed("on", "turns on"),
        when_false: StateLabel::verbed("off", "turns off"),
    }),
    ..Default::default()
});
attributes.insert("brightness_pct".into(), AttributeSchema {
    kind: AttributeKind::Integer,
    writable: true,
    display_name: Some("Brightness".into()),
    unit: Some("%".into()),
    min: Some(0.0), max: Some(100.0), step: Some(1.0),
    ..Default::default()
});

publisher.register_device_schema(&device_id, &DeviceSchema {
    attributes,
    ..Default::default()
}).await?;
```

The schema is published **retained**, so it survives the plugin being down and
a client connecting later still knows what the device means. Republish it when
the set of attributes changes — a sensor that gains a reading gains an
attribute.

### Typed registration writes the same slot

Registering with a `device_type` can resolve a **built-in** schema for that
type, if the operator has a `config/profiles/device-types.toml`. That catalog
exists for the topic-mapper — so a Tasmota or Shelly device with no plugin
behind it can name a type instead of hand-writing a schema — but the resolution
runs on every registration that carries a `device_type`, yours included, and
stores the result where your own schema goes. The two are not additive: the
last write wins.

Publish your schema **after** the registration it belongs to, which is what the
template does. And know that a *re*-registration re-resolves the built-in one:
a plugin that re-registers periodically (to refresh a device's identity, say)
against a core with a type registry will overwrite its own schema each time
unless it republishes alongside.

Your own schema is the better path for anything with attributes worth
describing. The built-in resolution exists so a plugin that says only
`device_type: "light"` still gets something.

### An attribute

| Field | What it is for |
|---|---|
| `kind` | `bool`, `integer`, `float`, `string`, `enum`, `color_xy`, `color_rgb`, `color_temp`, `json`. This is what picks the control. |
| `writable` | Whether a write reaches the device. **A read-only attribute rendered as a slider is a lie the user discovers by dragging it.** |
| `display_name` | What a person reads. Absent falls back to the attribute name. |
| `unit` | `%`, `°C`, `lux`, `W`. Must be *true* — see below. |
| `min` / `max` / `step` | The range the command path actually clamps to. |
| `options` | For `enum`: the values, optionally with a label and an icon each. |
| `states` | For `bool`: what both of its states are called. |
| `category` | `diagnostic` or `config` — what a reading is *for*, when it is not what the device is for. |

### Both names of a boolean

A boolean attribute is **two events, not one**. A client given only `open`
offers one row, and catching the door closing needs a Not gate wrapped round
the trigger — so `closed` reads as "open, but Not", a logic gate standing in
for a word the device already has.

```rust
states: Some(BoolStates {
    when_true:  StateLabel::verbed("open", "opens"),
    when_false: StateLabel::verbed("closed", "closes"),
})
```

Two forms because English will not derive one from the other: `open` → "opens",
but `locked` → "locks" and `motion` → "detects motion". A condition reads the
adjective ("while the door is open"), a trigger reads the verb ("when the door
opens").

### Which readings are the point of the device

A door lock reports whether it is locked. It also reports battery, signal
strength and firmware. Rendering all four the same way buries the one an
operator came for.

- **`category: diagnostic`** — health and identity: battery, RSSI, firmware,
  ip, model, a `*_unit` sibling, anything `supports_*`.
- **`category: config`** — a setting that shapes behaviour rather than
  reporting it.
- **Absent** — primary. The ordinary case.

Do not repeat the list by hand. `AttributeCategory::for_name` holds the
cross-plugin lexicon and fills the common names for you:

```rust
for (name, attr) in attributes.iter_mut() {
    if attr.category.is_none() {
        attr.category = AttributeCategory::for_name(name);
    }
}
```

Set it explicitly for anything only your plugin can know — an ISY sensor's
`unit` is metadata about its `value`, and no shared list can tell.

`DeviceSchema.primary` ranks what is left, most important first. **You usually
do not set it**: homeCore derives it from the device's `device_type` when it
serves the schema, so a `temperature_sensor` leads with `temperature` and a
multi-sensor reporting motion leads with `motion`. Declare it only when you
know better than the type does.

### Things a device *does*

An attribute write is `{"source": "Netflix"}`. An action is
`{"action": "launch_app", "app": "Netflix"}`. Both reach the plugin on the same
`cmd` topic, so declaring actions costs no new transport:

```rust
use plugin_sdk_rs::device_actions::{with_actions, Action, Param};

let schema = with_actions(&schema, vec![
    Action::new("activate")
        .label("Activate the scene")
        .category("Scenes")
        .icon("scene")
        .sentence("activate {device}"),
]);
publisher.register_device_schema_json(&device_id, &schema).await?;
```

`sentence` is load-bearing rather than decoration: a client that cannot phrase
a payload shows the user raw JSON in their rule list. `icon` is a semantic name
(`scene`, `remote`, `snowflake`), not a font codepoint — each client maps it to
its own set.

**Declare an action only if the command dispatcher really takes it.** The
mirror of the promise is a test: every arm of your dispatcher is either
declared or deliberately excluded. Without it the declaration drifts and a
client renders a control that does nothing — worse than not offering it.

### Publishing state without deleting your own work

`publish_state` **replaces** the retained document. `publish_state_partial`
merges into it.

If anything else publishes to the same device — a slow info refresher, a second
task, a facet compacted onto a primary — a full publish deletes what the other
one wrote, and the next refresh puts it back. That churn is not theoretical:
one WLED controller produced a `device_state_changed` listing sixteen
attributes, in both directions, forever, because its light state was published
whole every WebSocket push while sixteen hardware facts were merged on a
five-minute tick.

Use a partial for anything that is one publisher's half of a device.

### Never publish a value that changes by itself

An `uptime` counter makes **every poll a state change** for a device that did
nothing. Two Rokus reporting that time had passed accounted for 111 of the last
200 events in the whole house.

Drop them. A reboot is already visible as availability dropping, and homeCore
records `last_seen` for every device. The same applies to an on-device clock,
and to any field that ticks on its own between reads.

### Read and write the same name

The command path and the schema must agree, attribute by attribute:

| Published | Accepted | Result |
|---|---|---|
| `preset_id` | `preset` | A client reads the value, writes it back, nothing happens |
| `enabled` | `enable` | Same |
| `effect_id` | `effect` | Same |

All three of those shipped. If you must keep an old spelling for existing
rules, accept both and declare the one you publish.

## Before you release a plugin

Each of these has been a real bug in a shipped homeCore plugin. Most are one
line to check and invisible until someone is looking at the device.

**The device**

- [ ] Every device registers a `device_type`. A WLED controller had none for
      its whole life, so every client filtering by type skipped it.
- [ ] Every device publishes a schema — including the ones that feel too
      simple to need one. A scene that takes `activate` and reports nothing
      still declares that: an empty attribute set is a statement, and "no
      schema" is a different one.

**The attributes**

- [ ] Every attribute you publish is declared, under the name you publish it.
- [ ] Every attribute you declare is one you publish, or one the command path
      accepts.
- [ ] Every boolean has `states`, both sides named.
- [ ] Every `unit` is true of the value. A 0-5 battery level declared `%`
      rendered a healthy sensor as "2%".
- [ ] Every `min`/`max` matches what the command path clamps to.
- [ ] Housekeeping carries `category`; ask `AttributeCategory::for_name`
      before writing your own list.
- [ ] Names are `snake_case`, no dots. Nothing treats a dot specially, but no
      other plugin uses one and a client humanising `led.count` renders
      "Led.count".

**The publishing**

- [ ] Partial publishes for anything that is one publisher's half of a device.
- [ ] No self-changing values in state — no uptime, no device clock.
- [ ] The schema is republished when the set of attributes changes.
- [ ] Availability is published, and set false when the device is unreachable.

**The plugin**

- [ ] Config section is `#[serde(default)]` with a `Default` impl, or a
      freshly installed plugin crash-loops on "missing field" before it can
      publish its config schema.
- [ ] `config_schema` and `config_descriptor` both published; the descriptor
      covers every schema field (`missing_schema_coverage` tests it).
- [ ] Commands are subscribed as well as registered — forgetting
      `subscribe_commands` gives a device whose state updates and whose
      commands go nowhere.

**The check that catches most of it**

Read the device back off a running homeCore. Every defect above is invisible in
the source and obvious here:

```bash
curl -s "$CORE/api/v1/devices?include_schema=true" \
  | jq '.[] | select(.plugin_id=="plugin.mine")
        | {id: .device_id, type: .device_type,
           declared: (.schema.attributes // {} | keys),
           published: (.attributes | keys),
           primary: .schema.primary}'
```

Anything in `published` that is not in `declared` is a value nobody can
operate. Anything in `declared` that never appears in `published` is a control
that does nothing.

## Device type field

Register a `device_type` string to help UIs categorize devices correctly and filter scenes from device lists:

| `device_type` | Description |
|---|---|
| `light` | Dimmable/color light |
| `switch` | On/off switch or outlet |
| `sensor` | Temperature, humidity, door, motion, etc. |
| `thermostat` | HVAC control |
| `lock` | Door lock |
| `cover` | Blinds, shade, garage door |
| `media_player` | Speaker, TV |
| `scene` | Scene activator (device_type prevents it from appearing in device control lists) |
| `pico` | Button-only remote (read-only, reports button events) |
| `timer` | Virtual countdown timer |

## Testing your plugin

`plugins/hc-plugin-template` is the reference for the full SDK lifecycle — it
publishes virtual lights and needs no hardware:

```bash
cargo run -p hc-plugin-template -- plugins/hc-plugin-template/config/config.toml
```

Run it against a homeCore whose broker is on `127.0.0.1:1883`, or point
`[homecore] broker_host`/`broker_port` at one elsewhere. Copy in extra
`[[template.devices]]` entries to see how your plugin behaves with a realistic
device count — that is how the event-loop ordering above shows itself.

Test that your plugin's devices appear:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.plugin_id == "plugin.my-device") | .name]'
```

Write a rule that reacts to your device's state changes and verify it fires in the event stream.
