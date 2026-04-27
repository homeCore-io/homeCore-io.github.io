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

### Add to Cargo.toml

```toml
[dependencies]
hc-plugin-sdk = { path = "../homeCore/sdks/hc-plugin-sdk-rs" }
tokio = { version = "1", features = ["full"] }
serde_json = "1"
```

### Minimal plugin

```rust
use hc_plugin_sdk::{PluginClient, PluginConfig, DevicePublisher};
use serde_json::json;

#[tokio::main]
async fn main() {
    let config = PluginConfig {
        plugin_id:   "plugin.my-device".into(),
        broker_host: "127.0.0.1".into(),
        broker_port: 1883,
        password:    "".into(),
    };

    let mut client = PluginClient::new(config).await.unwrap();

    // Register a device
    client.register_device(json!({
        "device_id":   "my_device_001",
        "plugin_id":   "plugin.my-device",
        "name":        "My Device",
        "area":        "living_room",
        "device_type": "sensor",
        "capabilities": {
            "temperature": {"type": "number"},
            "humidity":    {"type": "number"}
        }
    })).await.unwrap();

    // Publish initial state
    client.publish_state("my_device_001", json!({
        "temperature": 72.5,
        "humidity": 45.0
    })).await.unwrap();

    // Set device online
    client.set_availability("my_device_001", true).await.unwrap();

    // Subscribe to commands
    client.subscribe_commands("my_device_001", |cmd| {
        println!("Received command: {cmd}");
        // Apply the command to physical device...
    }).await.unwrap();

    // Keep running
    client.run().await;
}
```

### Publishing state updates

```rust
// Full state update (replaces previous state)
client.publish_state("my_device_001", json!({
    "temperature": 73.0,
    "humidity": 44.5,
    "battery": 87
})).await?;

// Partial update (JSON merge-patch — only changed fields)
client.publish_partial_state("my_device_001", json!({
    "temperature": 73.0   // humidity and battery unchanged
})).await?;
```

### Handling commands

```rust
client.subscribe_commands("my_device_001", |cmd: serde_json::Value| {
    if let Some(on) = cmd.get("on").and_then(|v| v.as_bool()) {
        // Apply on/off to physical device
        set_relay(on);

        // Publish the new state back
        client.publish_state("my_device_001", json!({"on": on})).await?;
    }
    Ok(())
}).await?;
```

The Rust SDK includes `DevicePublisher` for spawned tasks and full management protocol support (heartbeat, remote config, dynamic log level).

:::note Plugin isolation via per-device subscriptions
The SDK uses per-device topic subscriptions — not wildcards. Each call to `subscribe_commands()` subscribes to `homecore/devices/{device_id}/cmd` for that specific device. A plugin only receives commands for devices it has explicitly subscribed to — which keeps well-behaved plugins from stomping on each other by convention.

**Trust boundary caveat:** on the default embedded rumqttd broker, per-topic ACLs are not enforced. A misbehaving or hostile plugin could subscribe outside its declared patterns. Deployments that cannot rely on plugin correctness (containers, third-party code, compliance scenarios) should run HomeCore with an external Mosquitto broker, which enforces the same `allow_pub` / `allow_sub` patterns declared in `[[broker.clients]]`. See [External Mosquitto deployment](../administration/broker#external-mosquitto-deployment) and `mqttAuthzPlan.md` in the repo root.
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
config rearrangements without dropping the whole state DB. The
homeCore Leptos admin UI exposes this as a **Wipe all devices**
button on each plugin's detail page.

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

```python
from hc_plugin_sdk import PluginClient, PluginConfig
import asyncio
import json

async def main():
    config = PluginConfig(
        plugin_id="plugin.my-sensor",
        broker_host="127.0.0.1",
        broker_port=1883,
        password=""
    )

    client = await PluginClient.connect(config)

    # Register device
    await client.register_device({
        "device_id": "my_sensor_001",
        "plugin_id": "plugin.my-sensor",
        "name": "Temperature Sensor",
        "device_type": "sensor",
        "capabilities": {
            "temperature": {"type": "number"}
        }
    })

    # Publish state
    await client.publish_state("my_sensor_001", {"temperature": 72.5})
    await client.set_availability("my_sensor_001", True)

    # Handle commands
    async def on_command(device_id: str, cmd: dict):
        print(f"Command for {device_id}: {cmd}")

    await client.subscribe_commands("my_sensor_001", on_command)
    await client.run_forever()

asyncio.run(main())
```

The Python SDK provides a `PluginBase` class with env var config support and uses paho-mqtt under the hood.

---

## Node.js SDK (`hc-plugin-sdk-js`)

```javascript
const { PluginClient } = require('hc-plugin-sdk');

async function main() {
  const client = new PluginClient({
    pluginId: 'plugin.my-device',
    brokerHost: '127.0.0.1',
    brokerPort: 1883,
    password: ''
  });

  await client.connect();

  await client.registerDevice({
    device_id: 'my_device_001',
    plugin_id: 'plugin.my-device',
    name: 'My Device',
    device_type: 'light',
    capabilities: {
      on: { type: 'boolean' },
      brightness: { type: 'integer', minimum: 0, maximum: 255 }
    }
  });

  await client.publishState('my_device_001', { on: false, brightness: 0 });
  await client.setAvailability('my_device_001', true);

  client.onCommand('my_device_001', async (cmd) => {
    console.log('Command:', cmd);
    // apply to device...
    await client.publishState('my_device_001', { on: cmd.on });
  });
}

main().catch(console.error);
```

The Node.js SDK provides a `PluginBase` class using mqtt.js v5.

---

## .NET Core SDK (`hc-plugin-sdk-dotnet`)

```csharp
using HcPluginSdk;

var config = new PluginConfig
{
    PluginId = "plugin.my-device",
    BrokerHost = "127.0.0.1",
    BrokerPort = 1883,
    Password = ""
};

await using var client = new PluginClient(config);
await client.ConnectAsync();

// Register a device
await client.RegisterDeviceAsync(new DeviceRegistration
{
    DeviceId = "my_device_001",
    PluginId = "plugin.my-device",
    Name = "My Device",
    DeviceType = "sensor",
    Capabilities = new Dictionary<string, object>
    {
        ["temperature"] = new { type = "number" },
        ["humidity"] = new { type = "number" }
    }
});

// Publish state
await client.PublishStateAsync("my_device_001", new
{
    temperature = 72.5,
    humidity = 45.0
});

await client.SetAvailabilityAsync("my_device_001", true);

// Handle commands
client.OnCommand("my_device_001", async (cmd) =>
{
    Console.WriteLine($"Received command: {cmd}");
});

// Keep running
await client.RunAsync();
```

The .NET SDK uses MQTTnet 4.x, provides an async Task-based API, and supports the management protocol (heartbeat, remote config, dynamic log level).

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
the SDKs, the Leptos client, or hc-mcp — the framework is fully
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

## Building a Docker image for a plugin

Use the generic `plugins/Dockerfile.plugin` template:

```bash
cd my-plugin
docker build \
  -f ../Dockerfile.plugin \
  --build-arg PLUGIN_NAME=hc-my-plugin \
  -t hc-my-plugin:latest \
  .
```

The container runs the plugin binary with `config/config.toml` as the argument. Mount the config directory to inject your configuration:

```yaml
# docker-compose entry
hc-my-plugin:
  image: hc-my-plugin:latest
  network_mode: host
  volumes:
    - ./docker/plugin-configs/hc-my-plugin.toml:/opt/plugin/config/config.toml:ro
  restart: unless-stopped
```

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
