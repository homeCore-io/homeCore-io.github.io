---
id: developing-plugins
title: Developing Plugins
sidebar_label: Developing Plugins
sidebar_position: 2
---

# Developing Plugins

Plugins can be written in any language that has an MQTT client library. HomeCore provides first-class SDKs for Rust, Python, and Node.js.

## Rust SDK (`plugin-sdk-rs`)

### Add to Cargo.toml

```toml
[dependencies]
hc-plugin-sdk = { path = "../homeCore/core/plugins/plugin-sdk-rs" }
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

## Python SDK (`plugin-sdk-py`)

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

## Node.js SDK (`plugin-sdk-js`)

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
