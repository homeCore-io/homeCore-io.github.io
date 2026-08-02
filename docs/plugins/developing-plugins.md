---
id: developing-plugins
title: Developing Plugins
sidebar_label: Developing Plugins
sidebar_position: 2
---

# Developing Plugins

Plugins can be written in any language that has an MQTT client library. HomeCore provides first-class SDKs for Rust, Python, Node.js, and .NET Core.

SDKs live in the `sdks/` directory of the workspace, each as an independent git repo.

## Rust SDK (`hc-plugin-sdk-rs`)

The fastest start is
[hc-plugin-template](https://github.com/homeCore-io/hc-plugin-template) — a
working virtual-light plugin, small enough to read in one sitting, with the
management protocol, a capability action, and a notice already wired up.

```sh
gh repo create my-plugin --template homeCore-io/hc-plugin-template
```

### Add to Cargo.toml

The crate is named `plugin-sdk-rs`. Pin it by tag: it re-exports core's
`hc-types`, which is the plugin ABI, so an unpinned dependency means your
build changes when core does.

```toml
[dependencies]
plugin-sdk-rs = { git = "https://github.com/homeCore-io/hc-plugin-sdk-rs", tag = "v0.3.10" }
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

    let publisher = client.device_publisher();

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

    // Owns the process from here. Commands arrive on this callback, which is
    // synchronous — hand slow work to a task over a channel.
    client
        .run(|device_id, payload| {
            println!("Command for {device_id}: {payload}");
        })
        .await
}
```

A real plugin calls `run_managed` rather than `run`, passing the handle from
`enable_management`, so core can heartbeat it, restart it, push configuration,
and render its actions as buttons.

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

Notices and capability actions are Rust-only today. The Python, Node.js, and
.NET SDKs cover registration, state, availability, the management protocol, and
log forwarding.

:::note Plugin isolation via per-device subscriptions
The SDK uses per-device topic subscriptions — not wildcards. Each call to `subscribe_commands()` subscribes to `homecore/devices/{device_id}/cmd` for that specific device. A plugin only receives commands for devices it has explicitly subscribed to — which keeps well-behaved plugins from stomping on each other by convention.

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

Subclass `PluginBase`, implement `on_command`, call `run()`. The API is
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

Extend `PluginBase`, implement `onCommand`, call `run()`. Same shape as the
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

The Rust SDK is the reference implementation, and two features are only there:

- **Notices** — the self-clearing problem reports the web UI renders on a
  plugin's card. Elsewhere you can log a problem, but not surface it there.
- **Capability actions** — the plugin's action manifest, which the UI turns
  into buttons and hc-mcp can call. Device *capability schemas* work in every
  SDK; it is the plugin-level action manifest that is Rust-only.

Registration, state publishing, availability, the management protocol, and log
forwarding are the same across all four.

---

## Management protocol

Plugins built with the official SDKs can opt into the management protocol, which enables:

- **Heartbeat monitoring** — the plugin publishes to `homecore/plugins/{id}/heartbeat` every 30-60 seconds. HomeCore marks the plugin offline after 90 seconds without a heartbeat.
- **Remote configuration** — HomeCore can push config changes via `homecore/plugins/{id}/manage/cmd` with `set_config`.
- **Dynamic log level** — change the plugin's log verbosity at runtime via `set_log_level` without restarting.
- **Health checks** — `ping` command with `pong` response.
- **Log forwarding** — plugin logs are published to `homecore/plugins/{id}/logs` over MQTT, making them visible in the admin UI Activity page alongside core logs. Configurable minimum level via `log_forward_level` in the plugin's `[logging]` config.

All four SDKs (Rust, Python, Node.js, .NET) handle the management protocol automatically when enabled.

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

All SDKs provide the same core capabilities:

| Feature | Rust | Python | Node.js | .NET |
|---|---|---|---|---|
| Publish state (full + partial) | ✅ | ✅ | ✅ | ✅ |
| Device registration (typed + full) | ✅ | ✅ | ✅ | ✅ |
| Device schema publishing | ✅ | ✅ | ✅ | ✅ |
| Availability publishing | ✅ | ✅ | ✅ | ✅ |
| Event publishing | ✅ | ✅ | ✅ | ✅ |
| Command handling | ✅ | ✅ | ✅ | ✅ |
| Plugin status | ✅ | ✅ | ✅ | ✅ |
| Management protocol | ✅ | ✅ | ✅ | ✅ |
| Log forwarding (MQTT) | ✅ | ✅ | ✅ | ✅ |
| Command change metadata | ✅ | ✅ | ✅ | ✅ |
| Auto-reconnect | ✅ | ✅ | ✅ | ✅ |
| Cross-device state subscription | ✅ | — | — | — |
| Device persistence + reconcile | ✅ | — | — | — |

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

```
my-plugin/
├── Cargo.toml           # [package] name = "hc-my-plugin"
├── .gitignore
├── config/
│   └── config.toml      # default config (not committed if contains secrets)
├── config.example.toml  # committed example without secrets
├── src/
│   └── main.rs
└── README.md
```

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

Tagging `v0.1.0` in a plugin repo does all of this: the shared release
workflow builds a static musl binary, packages the `.tar.zst`, attaches it to
the GitHub Release, notifies the registry, and then polls the *served* index
until the entry appears — so a green release means an installable plugin, not
just a successful build.

There used to be a `plugins/Dockerfile.plugin` template for building a plugin
into its own container, run with `network_mode: host` against core's broker.
That shape is retired and the template is gone. If you need a plugin on a
different host, the SDK still supports it — point `broker_host` /
`broker_port` in the plugin's `[homecore]` config at core's broker, and expose
the broker accordingly.

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

Use the virtual-device example as a reference for the full SDK lifecycle:

```bash
cargo run -p virtual-device -- --broker 127.0.0.1 --port 1883 --id plugin.virtual
```

Test that your plugin's devices appear:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.plugin_id == "plugin.my-device") | .name]'
```

Write a rule that reacts to your device's state changes and verify it fires in the event stream.
