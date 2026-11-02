---
id: developing-plugins
title: Developing Plugins
sidebar_label: Developing Plugins
sidebar_position: 2
---

# Developing Plugins

You can write a plugin in any language that has an MQTT client library.
HomeCore provides SDKs for Rust, Python, Node.js and .NET.

:::tip The whole process, end to end
[`docs/plugin-development.md`](https://github.com/homeCore-io/homeCore/blob/main/docs/plugin-development.md)
in the homeCore repository walks through building a plugin from start to
release: devices, actions, settings, alerts, its own screens and cards,
testing and releasing, with pointers to working examples. This page is the
reference for each part. [Screens and Cards](./plugin-screens) and
[Alerts from Plugins](./plugin-alerts) cover those two topics in full.
:::

**The Rust SDK and every Rust plugin live inside the homeCore repository**, at
`sdk/rust` and `plugins/<name>`. The Python, Node.js and .NET SDKs are separate
repositories, cloned into `sdks/` alongside `core/`.

## Installing an SDK

**None of the SDKs is published to a package registry** (crates.io, PyPI,
npm or NuGet). There is no `pip install homecore-plugin-sdk`; you install from
a local checkout or a git tag.

### Rust

Nothing to install. Your plugin is a workspace member of the homeCore repo,
next to the SDK, and depends on it by path:

```toml
[dependencies]
plugin-sdk-rs = { path = "../../sdk/rust" }
tokio         = { version = "1", features = ["full"] }
serde_json    = "1"
anyhow        = "1"
```

An SDK edit reaches every plugin on the next `cargo build`, and the repo-root
`cargo fmt` / `clippy` / `test` cover core, the SDK and every plugin together.
A change that breaks a plugin therefore fails immediately, not at that
plugin's next release.

:::note This replaced a much more complicated arrangement
Rust plugins used to be separate repositories, each pinning `hc-plugin-sdk-rs`
by git tag, redirected to a local checkout by a `[patch]` table in a
`plugins/Cargo.toml` meta-workspace. All of that is gone: the plugin repos are
archived read-only and the meta-workspace no longer exists. Instructions that
mention any of it predate the monorepo.
:::

For a Rust plugin developed *outside* the homeCore repo, pin a core release
tag. The SDK re-exports `hc-types`, which is the plugin ABI, so the tag keeps
it from changing under you:

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

Python's `-e` and npm's directory install both link to the checkout rather
than copying it, so an SDK edit takes effect without a reinstall. .NET builds
the SDK from source as part of your build.

To pin a release instead:

| | |
|---|---|
| Python | `pip install git+https://github.com/homeCore-io/hc-plugin-sdk-py@v0.2.0` |
| Node.js | `npm install github:homeCore-io/hc-plugin-sdk-js#v0.2.0` |
| .NET | clone at the tag, then `dotnet add reference …/HomeCoreSdk.csproj` |

NuGet has no equivalent of a git install, which is why .NET clones.

---

## Rust SDK (`plugin-sdk-rs`)

The quickest start is `plugins/hc-plugin-template`: a working virtual-light
plugin, small enough to read in one sitting, with the management protocol, a
config schema and descriptor, a capability action, a notice and its own
screens already wired up.

```sh
cp -r plugins/hc-plugin-template plugins/hc-mything
$EDITOR Cargo.toml          # add "plugins/hc-mything" to [workspace] members
```

Then rename the package and binary in its `Cargo.toml`, the `plugin_id` in its
config, and the `Descriptor::new` id in `config.rs`. The dependencies are the
ones shown under [Installing an SDK](#installing-an-sdk).

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
        .publish_state("my_device_001", &json!({ "temperature": 22.5, "humidity": 45.0 }))
        .await?;
    publisher.publish_availability("my_device_001", true).await?;

    // Returns only when the loop stops.
    event_loop.await?
}
```

A real plugin calls `run_managed` instead of `run`, passing the handle from
`enable_management`. That lets core heartbeat it, restart it, push
configuration and show its actions.

### Start the event loop before you register

`run` / `run_managed` is what drives the MQTT connection. Until one of them is
polling, nothing you publish leaves the process. Publishes queue, and the
queue holds 64 messages.

Registering one device costs four of them: register, subscribe, state and
availability. So a plugin that registers its devices and *then* calls
`run_managed` works with three devices and **hangs at startup with
seventeen**, because it never reaches the line that would drain the queue.
There is no error and no log line. It simply stops, on a machine that differs
from yours only in how many devices are configured.

Measured against a real broker, a plugin registering 40 devices gets through
12 of them when it registers first, and all 40 when it spawns the loop first.
Every shipped plugin spawns it first.

Starting early loses nothing. A command for a device you have not registered
can't arrive, because the subscription that would carry it doesn't exist
until you make it.

### Publishing state updates

```rust
// Full state (retained — replaces the previous state).
publisher
    .publish_state("my_device_001", &json!({
        "temperature": 22.8,     // °C, always — the app shows °F
        "humidity": 44.5,
        "battery_pct": 87
    }))
    .await?;

// Partial (JSON merge-patch — only the fields given).
publisher
    .publish_state_partial("my_device_001", &json!({ "temperature": 22.8 }))
    .await?;

// After a command, attach provenance so the UI and the audit log can say
// what caused the change instead of showing an anonymous update.
publisher
    .publish_state_for_command("my_device_001", &new_state, &command_payload, "my-plugin")
    .await?;
```

### Handling commands

homeCore never writes device state. A command arrives on
`homecore/devices/{id}/cmd`, the plugin does whatever the device needs, and
then the plugin publishes what actually happened. That is why the UI can show
a light as off after a command the bulb refused.

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

A notice puts a plugin's problem on the operator's screen instead of only in
the log. The web UI shows notices as banners on the plugin's page.

```rust
use plugin_sdk_rs::types::PluginNotice;

let notices = client.notices();

notices.raise(
    PluginNotice::error("bridge_unreachable", "The bridge stopped answering")
        .with_remedy("Check that the bridge is powered on and reachable"),
);

notices.clear("bridge_unreachable");   // when it answers again
```

`PluginNotice` also has `warning` and `info` constructors. The SDK sends the
full set with every heartbeat, and core replaces what it held.

**A notice describes current state.** It stays up while the condition holds,
so re-evaluate it after each discovery sweep, reconnect and config change
instead of deciding once at startup. A plugin that raises
`no_devices_configured` at boot and never checks again is still showing it
after the user's devices have arrived.

Notices and capability actions are available in every SDK.

:::note Plugin isolation via per-device subscriptions
Every SDK subscribes per device, never to a wildcard. A plugin subscribes to `homecore/devices/{device_id}/cmd` for each device it owns and receives commands for nothing else, so well-behaved plugins don't interfere with each other. In Rust that is an explicit `subscribe_commands()` call; in Python, Node.js and .NET, registering the device does it for you.

**Trust boundary caveat:** the default embedded rumqttd broker does not enforce per-topic ACLs, so a misbehaving or hostile plugin could subscribe outside its declared patterns. Deployments that can't rely on plugin correctness (containers, third-party code, compliance requirements) should run HomeCore with an external Mosquitto broker, which enforces the same `allow_pub` / `allow_sub` patterns declared in `[[broker.clients]]`. See [External Mosquitto deployment](../administration/broker#external-mosquitto-deployment).
:::

### Cross-restart device cleanup

When a device disappears from a plugin's source of truth (a Hue bulb deleted
from the bridge, a Z-Wave node excluded, an entry removed from `[[devices]]`),
its homeCore record should go too. The SDK handles the persistence and the
diff; the plugin only declares what is live on each cycle.

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

What the SDK does:

- `with_device_persistence(path)` mirrors every `register_device_full` /
  `unregister_device` call to a JSON file. On startup it loads the file, so the
  in-memory tracker starts with the devices registered in a previous session.
- `reconcile_devices(live)` computes `tracked - live`, calls
  `unregister_device` for each stale id, and writes the new live set back to
  disk.

What the plugin has to decide:

- **When to call it.** Only when the upstream sync actually succeeded.
  Reconciling after a partial fetch deletes live devices that sit behind a
  temporarily unreachable upstream. The usual pattern is an
  `all_bridges_succeeded` flag (or equivalent) tracked across the per-source
  loop.
- **Whether to call it at all.** A plugin whose upstream reports irregularly
  (battery sensors that go quiet for hours, as with hc-ecowitt) should enable
  persistence but skip automatic reconciling. There, a false positive costs
  more than a leftover device. Operators can clear leftovers with
  `DELETE /api/v1/plugins/:id/devices` when needed.

The other SDKs do the same thing under their own naming conventions:

| | Enable | Reconcile |
|---|---|---|
| Rust | `with_device_persistence(path)` | `reconcile_devices(live)` |
| Python | `enable_device_persistence(path)` | `reconcile_devices(live)` |
| Node.js | `enableDevicePersistence(path)` | `reconcileDevices(live)` |
| .NET | `EnableDevicePersistence(path)` | `ReconcileDevicesAsync(live)` |

All four insert the plugin id into the snapshot's filename
(`.published-device-ids.plugin.hue.json`). Deployments keep every plugin's
config in one directory and every plugin derives the path the same way, so
without the id two plugins would share one file and retire each other's
devices.

**Manual bulk wipe.** Separately from SDK reconciling, an admin can call:

```text
DELETE /api/v1/plugins/<plugin_id>/devices
```

This deletes every device whose `plugin_id` matches. The plugin stays
registered, and on its next sync cycle it re-registers anything still live.
It is useful for clearing leftovers from development or config
rearrangements without dropping the whole state database. In the web UI it is
the **Delete all its devices…** button on the plugin's Devices tab.

### Cross-device consumer plugins

Most plugins own their devices and only listen on their own command topics. A
**cross-device consumer** also needs the state of other plugins' devices. A
virtual thermostat that aggregates temperature readings from YoLink and
Ecowitt sensors is one example.

The Rust SDK supports this directly:

```rust
// Subscribe to another plugin's device state (tracked for reconnect).
client.subscribe_state("yolink_sensor_a").await?;
client.subscribe_state("ecowitt_outdoor_temp").await?;

// Keep a publisher: `run_managed_with_state` consumes the client.
let publisher = client.device_publisher();

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

// Later, at runtime, from a task holding the publisher:
publisher.unsubscribe_state("ecowitt_outdoor_temp").await?;
```

`run_managed_with_state` is a drop-in replacement for `run_managed`; use
`run_managed` when you don't need external state. `DevicePublisher` has
`subscribe_state` / `unsubscribe_state` too, so background tasks can change
the subscriptions at runtime (when a user edits the sensor list through an
action, say).

To hear whether those devices are online, subscribe with
`DevicePublisher::subscribe_availability` and handle the updates with
`ManagementHandle::with_availability_handler`, which is called with
`(device_id, online)`. This part is Rust-only.

**Broker ACL:** cross-device consumers need `allow_sub = ["homecore/devices/+/state"]`,
which is broader than the usual plugin ACL. See the Setup section of the
[thermostat plugin](./thermostat) for a complete example, and
[`hc-thermostat`](./thermostat) as a reference implementation.

---

## Python SDK (`hc-plugin-sdk-py`)

[Install it](#installing-an-sdk) first. Subclass `PluginBase`, implement
`on_command`, call `run()`. The API is synchronous: the SDK drives paho-mqtt's
loop for you, so background work goes in a thread.

```python
from homecore_plugin_sdk import PluginBase

DEVICE_ID = "light.virtual_py_01"
CAPABILITIES = {
    "on":             {"type": "boolean"},
    "brightness_pct": {"type": "number", "minimum": 0, "maximum": 100},
}


class MyPlugin(PluginBase):
    PLUGIN_ID = "plugin.my-sensor"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._on = False
        self._level = 50.0  # kept while off, so {"on": true} restores it

    def _state(self) -> dict:
        # A light that is on never reports 0 %; one that is off reports 0 %.
        return {"on": self._on, "brightness_pct": self._level if self._on else 0}

    def on_connect(self) -> None:
        # Called once the broker connection is up — register here, not in
        # __init__, so a reconnect re-registers too.
        self.register_device(DEVICE_ID, "Virtual Light", CAPABILITIES, area="living_room")
        self.publish_availability(DEVICE_ID, True)
        self.publish_state(DEVICE_ID, self._state())
        self.publish_plugin_status("active")

    def on_command(self, device_id: str, payload: dict) -> None:
        # Two shapes only: an attribute write, or {"action": ...}.
        if payload.get("action") == "toggle":
            self._on = not self._on
        if "on" in payload:
            self._on = bool(payload["on"])
        if "brightness_pct" in payload:
            pct = max(0.0, min(100.0, float(payload["brightness_pct"])))
            self._on = pct > 0           # 0 % is off
            if pct > 0:
                self._level = pct
        # Publish what you actually applied, with provenance attached.
        self.publish_state_for_command(
            device_id, self._state(), payload, fallback_source="my-plugin"
        )


MyPlugin(broker_host="127.0.0.1", broker_port=1883).run()
```

Configuration comes from constructor arguments, then the environment
(`HC_BROKER_HOST`, `HC_BROKER_PORT`, `HC_PLUGIN_PASSWORD`), then defaults.
Requires Python 3.11+. See `examples/virtual_light.py` in the SDK repo for a
complete plugin.

---

## Node.js SDK (`hc-plugin-sdk-js`)

[Install it](#installing-an-sdk) first. Extend `PluginBase`, implement
`onCommand`, call `run()`. It has the same shape as the Python SDK, built on
mqtt.js v5.

```javascript
const { PluginBase } = require('homecore-plugin-sdk');

const DEVICE_ID = 'light.virtual_js_01';
const CAPABILITIES = {
  on:             { type: 'boolean' },
  brightness_pct: { type: 'number', minimum: 0, maximum: 100 },
};

class MyPlugin extends PluginBase {
  constructor(options = {}) {
    super({ pluginId: 'plugin.my-device', ...options });
    this._on = false;
    this._level = 50; // kept while off, so {"on": true} restores it
  }

  _state() {
    // A light that is on never reports 0 %; one that is off reports 0 %.
    return { on: this._on, brightness_pct: this._on ? this._level : 0 };
  }

  onConnect() {
    this.registerDevice(DEVICE_ID, 'Virtual Light', CAPABILITIES, 'living_room');
    this.publishAvailability(DEVICE_ID, true);
    this.publishState(DEVICE_ID, this._state());
    this.publishPluginStatus('active');
  }

  onCommand(deviceId, payload) {
    // Two shapes only: an attribute write, or {"action": ...}.
    if (payload.action === 'toggle') this._on = !this._on;
    if ('on' in payload) this._on = !!payload.on;
    if ('brightness_pct' in payload) {
      const pct = Math.max(0, Math.min(100, Number(payload.brightness_pct)));
      this._on = pct > 0; // 0 % is off
      if (pct > 0) this._level = pct;
    }
    this.publishStateForCommand(deviceId, this._state(), payload, 'my-plugin');
  }
}

new MyPlugin({ brokerHost: '127.0.0.1', brokerPort: 1883 }).run();
```

Requires Node.js 18+. See `examples/virtual_light.js` in the SDK repo.

---

## .NET SDK (`hc-plugin-sdk-dotnet`)

[Install it](#installing-an-sdk) first. The SDK targets .NET 8.

```csharp
using HomeCore.PluginSdk;

var client = new PluginClient(new PluginOptions { PluginId = "plugin.my-device" });

client.OnConnected += async () =>
{
    // Register here, not before connecting — this runs again after a reconnect.
    // Registering also subscribes to the device's commands.
    await client.RegisterDeviceFullAsync("my_device_001", "My Device", deviceType: "sensor");
    await client.PublishAvailabilityAsync("my_device_001", true);
    await client.PublishStateAsync("my_device_001", new { temperature = 22.5 }); // °C
};

client.OnCommand += async (deviceId, payload) =>
{
    Console.WriteLine($"Command for {deviceId}: {payload}");
    // Do whatever the device needs, then publish what actually happened.
    await client.PublishStateForCommandAsync(deviceId, new { temperature = 22.5 }, payload, "my-plugin");
};

await client.ConnectAsync();
await client.RunAsync();
```

Configuration falls back to `HC_BROKER_HOST`, `HC_BROKER_PORT` and
`HC_PLUGIN_PASSWORD` when the options are not set.

---

## Choosing a language

The four SDKs cover the same core features: devices, state, commands, the
management protocol, notices, capability actions (including streaming),
alerts and a plugin's own screens. A few newer features are in the Rust SDK
only; the [matrix](#sdk-feature-matrix) below lists them. Otherwise, pick the
language you would rather write the device integration in.

The Rust SDK is the reference implementation, and new protocol features land
there first.

:::caution Secrets in forwarded logs
Forwarded log lines go to an MQTT topic anything on the broker can subscribe
to. The Rust and .NET SDKs replace the values of fields whose names look
secret with `<redacted>`. **.NET renders every template argument into the
message**, so `LogInformation("connecting with {ApiKey}", key)` would put the
key in the text as well; the .NET SDK therefore also scrubs those values out
of the rendered message. The Python and Node.js SDKs forward log lines as
they are, without redaction. None of this helps with a secret you interpolate
into a message yourself, so in every language the rule is the same: don't log
secrets.
:::

---

## Management protocol

Plugins built with the SDKs can opt into the management protocol, which gives
them:

- **Heartbeat monitoring.** The plugin publishes to
  `homecore/plugins/{id}/heartbeat` at the interval it chose (60 seconds in
  the first-party plugins). HomeCore marks the plugin offline after 90 seconds
  without a heartbeat.
- **Remote configuration.** HomeCore reads and writes the plugin's config file
  with `get_config` / `set_config` on `homecore/plugins/{id}/manage/cmd`.
- **Dynamic log level.** `set_log_level` changes the plugin's log verbosity at
  runtime, without a restart.
- **Health checks.** A `ping` command, answered with `status: "ok"`.
- **Log forwarding.** Plugin log lines are published to
  `homecore/plugins/{id}/logs`, so they show up in the web UI's log
  (Settings › Logs, and the plugin's Log tab) next to core's own. The minimum
  level forwarded is `log_forward_level` in the `[logging]` section for
  plugins that use the SDK's logging config (the template names its own
  setting `forward_level`).

All four SDKs (Rust, Python, Node.js, .NET) handle the management protocol
automatically once it is enabled.

## Configuration: schema and descriptor

An operator configures your plugin from its page in the web UI. What they see
there comes from two documents you publish on the capability manifest. If you
publish neither, they get a raw TOML textarea.

| | What it is | Who writes it |
|---|---|---|
| **Config schema** | JSON Schema of your config: what fields exist, of what type | Derived from your config structs |
| **Config descriptor** | How to *present* them: sections, units, help text, secrets, conditionals | You, by hand |

Publish both. The schema stays authoritative for which fields exist and for
core-side validation; the descriptor adds how to present them. Core serves
them at `GET /plugins/{id}/config/schema` and
`GET /plugins/{id}/config/descriptor`.

```rust
let mgmt = match config::config_schema() {
    Some(schema) => mgmt.with_config_schema(schema),
    None => mgmt,
};
let mgmt = mgmt.with_config_descriptor(config::config_descriptor());
```

Both ride on the capability manifest, so the plugin must call
`with_capabilities` as well (an empty manifest is fine).

The descriptor is built with typed builders, so a mistyped field kind is a
compile error instead of a field that silently never renders:

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
`number`, `duration`, `enumeration`, `select`, `list`, `map`, `table`,
`note`, `link` and `import`. A field can draw its values from a live source:
`Source::core_resource` (so a form edits the device registry rather than your
TOML) or `Source::plugin_action`.

:::warning A published descriptor is authoritative
The editor renders your descriptor **instead of** deriving a form from the
schema. A config field the descriptor leaves out is therefore not just
unlabelled; it can't be edited at all, even though the schema still declares
it and your plugin still reads it. hc-sonos once shipped a descriptor missing
its logging section, and those settings vanished from the page.

Guard against it with a test. Every shipped plugin has this one, and the SDK
provides `missing_schema_coverage` for it:

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
line someone had to write and a reviewer can see.
:::

A hidden section (`.hidden()`) still counts as covering its fields. Use it for
values core writes at install, like the broker host and password, rather than
leaving them out.

Every Rust plugin puts schema derivation behind a cargo feature, so it can be
compiled out:

```toml
[features]
default = ["schema"]
schema  = ["dep:schemars", "plugin-sdk-rs/schema"]
```

**In the other SDKs**, both documents ride on the capability manifest in the
same way: `config_schema` / `config_descriptor` on the Python `Capabilities`
dataclass, `configSchema` / `configDescriptor` in the options of the Node.js
`Capabilities` constructor, and `ConfigSchema` / `ConfigDescriptor` on the
.NET record. Only the typed authoring is Rust-only: the `Descriptor` /
`Section` / `Field` builders and `missing_schema_coverage`. Elsewhere you pass
a plain dict or object, so a mistyped field kind shows up only as a field the
editor doesn't render. The coverage habit matters even more there.

## Capability manifest

Plugins declare plugin-specific actions in a typed manifest. The web UI lists
them on the plugin's page and hc-mcp exposes them as tools. Adding an action
needs no change to core, the SDKs, the web UI or hc-mcp.

See [Plugin Capabilities & Actions](./capabilities) for the full spec,
manifest fields, stage vocabulary and protocol. The examples below show how to
wire actions up with the Rust SDK.

### Sync (non-streaming) action

For an action that replies once. Declare it with `with_capabilities` and
answer it in `with_custom_handler`:

```rust
use plugin_sdk_rs::types::{Action, Capabilities, Concurrency, RequiresRole};

let mgmt = client
    .enable_management(
        60,
        Some(env!("CARGO_PKG_VERSION").to_string()),
        Some(config_path.to_string()),
        Some(log_level_handle),
    )
    .await?
    .with_capabilities(Capabilities {
        spec: "1".into(),
        plugin_id: String::new(),  // SDK fills from configured plugin_id
        actions: vec![Action {
            id: "rescan_devices".into(),
            label: "Rescan devices".into(),
            description: Some("Refresh inventory from the cloud.".into()),
            params: None,
            result: None,
            stream: false,
            cancelable: false,
            concurrency: Concurrency::default(),
            item_key: None,
            item_operations: None,
            requires_role: RequiresRole::User,
            // Always declare one. Core's default window is 5000ms, which
            // fails any action that talks to hardware — and an inherited
            // default is not a decision anybody can see.
            timeout_ms: Some(20_000),
            // true for an action that can't be undone or interrupts the
            // house (a reboot, forgetting devices): screens ask first.
            danger: false,
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

`with_custom_handler` runs synchronously and must not block. An action that
has to wait on a device should be answered with `with_async_handler`
instead: return `Some(future)` for the actions it handles, and the future's
value becomes the reply. Each request already runs on its own task, so a slow
one holds up nothing else.

### Streaming action

For long-running flows that emit live progress, ask the user questions and
can be cancelled. Use `with_streaming_action` and the helper methods on
`StreamContext`:

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
));
```

The stage helpers (`progress`, `item_add` / `item_update` / `item_remove`,
`awaiting_user`, `warning`, `complete`, `error`, `canceled`) build the
envelope and publish it on the stream topic for you. Check `ctx.is_canceled()`
in cooperative loops (or await `ctx.wait_canceled()` inside a
`tokio::select!`), and call `ctx.canceled()` yourself once you have stopped.
`awaiting_user_with_schema` emits the prompt and waits for the answer; use
`emit_awaiting_user_with_schema` with `await_respond` when the closure has
other async work to do while it waits.

The Z-Wave plugin's `inclusion.rs` is a thorough worked example covering all
of these patterns. `plugins/hc-captest/` has six small but complete demos,
one per convention.

### Files sent to an action

`POST /api/v1/plugins/{id}/upload/{action}` sends a file (up to 32 MiB) to one
of your manifest actions, such as a firmware image or a backup to restore.
homeCore checks the action's role, sends the file to the plugin in pieces
over the management channel, and then runs the action as usual. The SDK
passes the action a `file_path` param: a local file, which it removes once the
action has replied (copy it first if a streaming action keeps working with
it). Query parameters arrive as params, as strings. From a plugin's own
screen, use `host.upload(action, file, params)`. This is Rust SDK only for
now.

```rust
"install_firmware_file" => {
    let path = cmd["file_path"].as_str().unwrap_or_default();
    let image = std::fs::read(path)?;
    // ...check it is what you expect before acting on it
}
```

## Alerts

Alerts about your devices (a firmware update, a device that restarted by
itself) join the house's alert list, can be sent to a notification channel
and can drive automations. Declare the kinds with `with_alert_kinds`, then
report which are true now with `set_alerts(device_id, [...])`. Send the whole
list each time; one you stop sending has cleared. See
[Alerts from Plugins](./plugin-alerts).

## Its own screens and cards

A plugin can carry web components for its page, its devices' panel, the
automation editor's form for a step on its devices, its devices' cards on
Home and the rooms, and cards of its own that a household adds to a page. It
serves them itself with `with_ui_dir`. Pictures it fetches while running
(channel icons, say) are served with `with_files_dir`. See
[Screens and Cards](./plugin-screens).

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
| Alerts (alert kinds, `set_alerts`) | ✅ | ✅ | ✅ | ✅ |
| Own screens and cards (`with_ui_dir`) | ✅ | ✅ | ✅ | ✅ |
| Files sent to actions | ✅ | ❌ | ❌ | ❌ |
| Pictures it keeps (`with_files_dir`) | ✅ | ❌ | ❌ | ❌ |
| Actions answered asynchronously (`with_async_handler`) | ✅ | ❌ | ❌ | ❌ |
| Other devices' availability (`subscribe_availability`) | ✅ | ❌ | ❌ | ❌ |

See [Plugin Overview: Management Protocol](./overview#plugin-management-protocol) for the full MQTT topic reference and API endpoints.

---

## Raw MQTT (any language)

You can write a plugin in any language with any MQTT client library by
following the topic protocol directly.

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
    "battery_pct": {"type": "number", "minimum": 0, "maximum": 100}
  }
}
```

### 3. Publish state (retained)

Publish to `homecore/devices/my_device_001/state` with `retain=true`:

```json
{"temperature": 22.5, "battery_pct": 87}
```

### 4. Publish availability (retained)

Publish to `homecore/devices/my_device_001/availability` with `retain=true`:

```
online
```

or, when disconnecting (use an MQTT Last Will):

```
offline
```

### 5. Subscribe to commands

Subscribe to `homecore/devices/my_device_001/cmd`.

An incoming payload has one of two shapes: a write to a writable attribute,
`{"on": true}`, or a declared action, `{"action": "toggle"}`. It is never
`{"command": …}`. Apply it to the physical device, then publish the new state
back.

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
tests already run over every member, and the release workflow derives
everything it needs from the directory name. A plugin with its own screens
also has a `ui/` folder (see [Screens and Cards](./plugin-screens)).

In a real install you never place `config.toml` yourself. Core seeds it at
`config/plugins/<plugin_id>.toml`, passes the path to your process as
`argv[1]`, and restarts the plugin when an operator edits it. The committed
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

Plugins don't ship as container images. They ship as signed `.tar.zst`
artifacts in the [plugin registry](https://github.com/homeCore-io/registry):
a `plugin.toml` manifest plus the binary, ed25519-signed, indexed at
`https://homecore.io/registry/index.json`.

Core downloads the artifact, verifies the signature against the public key in
its `[registry]` config, and unpacks it to
`$HOMECORE_HOME/plugins/<id>/<version>/`. It then seeds a config with
generated MQTT credentials and runs the binary as a child process that it
supervises and restarts. Users install with Plugins → Add in the web UI.

A plugin's own screens go in the same package. When your plugin has
`ui/package.json`, the release builds it and packs `ui/dist` as `ui/` beside
the binary (`ui = "ui"` in `plugin.toml`), and homeCore installs it there for
the plugin to serve. Commit `ui/package-lock.json`.

Releasing takes one tag on the homeCore repo. Bump the version in your
plugin's `Cargo.toml` on `develop`, merge to `main`, wait for CI to pass, and
push `hc-my-plugin-v0.1.0`. The shared workflow recognises the
`hc-<name>-v<version>` shape. It builds a static musl binary, packages the
`.tar.zst`, attaches it to the GitHub Release and notifies the registry. It
then polls the *served* index until the entry appears, so a green release
means an installable plugin, not just a successful build. A plain
`v<version>` tag releases the server instead.

There is no per-plugin workflow to copy, and no SDK tag to push first.

There used to be a `plugins/Dockerfile.plugin` template for building a plugin
into its own container, run with `network_mode: host` against core's broker.
That approach is retired and the template is gone. If you need a plugin on a
different host, the SDK still supports it: point `broker_host` /
`broker_port` in the plugin's `[homecore]` config at core's broker, and
expose the broker accordingly.

## Declaring a device

Registering a device tells homeCore it exists. The **device schema** tells
every client what to draw for it, and it is the part most plugins skip.

A client won't offer a control the plugin has not declared. A device without
a schema still works (state flows, commands arrive), but it appears as a row
of raw JSON that nobody can operate. On the reference house, before schemas
were taken seriously, **77 of 184 devices published no schema**, including
every scene, fan and timer. Each came from a plugin that registered the
device and stopped there.

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

The schema is published **retained**, so it survives the plugin being down,
and a client that connects later still knows what the device means. Republish
it when the set of attributes changes; a sensor that gains a reading gains an
attribute.

### Typed registration writes the same slot

Registering with a `device_type` can resolve a **built-in** schema for that
type, if the operator has a `config/profiles/device-types.toml`. That catalog
exists for the topic mapper, so that a Tasmota or Shelly device with no
plugin behind it can name a type instead of hand-writing a schema. The
resolution runs on every registration that carries a `device_type`, yours
included, and stores the result where your own schema goes. The two are not
merged: the last write wins.

Publish your schema **after** the registration it belongs to, as the template
does. Also note that a *re*-registration resolves the built-in schema again. A
plugin that re-registers periodically (to refresh a device's identity, say)
against a core with a type catalog overwrites its own schema each time unless
it republishes the schema alongside.

Your own schema is the better path for anything with attributes worth
describing. The built-in resolution exists so a plugin that says only
`device_type: "light"` still gets something.

### An attribute

| Field | What it is for |
|---|---|
| `kind` | `bool`, `integer`, `float`, `string`, `enum`, `color_xy`, `color_rgb`, `color_temp`, `json`. This is what picks the control. |
| `writable` | Whether a write reaches the device. **A read-only attribute rendered as a slider misleads the user until they drag it.** |
| `display_name` | What a person reads. When absent, the attribute name is used. |
| `unit` | `%`, `°C`, `lux`, `W`. Must be *true*; see below. |
| `min` / `max` / `step` | The range the command path actually clamps to. |
| `options` | For `enum`: the values, optionally with a label and an icon each. Also used to [name the numbers](#name-your-numbers) of an integer. |
| `states` | For `bool`: what each of its two states is called. |
| `category` | `diagnostic` or `config`: what a reading is *for*, when it is not what the device is for. |

### Both names of a boolean

A boolean attribute stands for **two events**. A client given only `open`
offers one row, and catching the door closing then needs a Not gate wrapped
around the trigger. `closed` ends up as "open, but Not", a logic gate standing
in for a word the device already has.

```rust
states: Some(BoolStates {
    when_true:  StateLabel::verbed("open", "opens"),
    when_false: StateLabel::verbed("closed", "closes"),
})
```

Each state has two forms because English won't derive one from the other:
`open` gives "opens", but `locked` gives "locks" and `motion` gives "detects
motion". A condition reads the adjective ("while the door is open"); a trigger
reads the verb ("when the door opens").

### Which readings are the point of the device

A door lock reports whether it is locked. It also reports battery, signal
strength and firmware. Showing all four the same way buries the one the
operator came for.

- **`category: diagnostic`**: health and identity, such as battery, RSSI,
  firmware, IP address, model, a `*_unit` sibling, anything `supports_*`.
- **`category: config`**: a setting that shapes behaviour rather than
  reporting it.
- **Absent**: a primary reading. The ordinary case.

Don't repeat the list by hand. `AttributeCategory::for_name` holds the
cross-plugin list and fills in the common names for you:

```rust
for (name, attr) in attributes.iter_mut() {
    if attr.category.is_none() {
        attr.category = AttributeCategory::for_name(name);
    }
}
```

Set it explicitly for anything only your plugin can know. An ISY sensor's
`unit` is metadata about its `value`, and no shared list can tell that.

`DeviceSchema.primary` ranks the remaining readings, most important first.
**You usually don't set it**: homeCore derives it from the device's
`device_type` when it serves the schema, so a `temperature_sensor` leads with
`temperature` and a multi-sensor reporting motion leads with `motion`. Declare
it only when you know better than the type does.

### Things a device *does*

An attribute write is `{"source": "Netflix"}`. An action is
`{"action": "launch_app", "app": "Netflix"}`. Both reach the plugin on the
same `cmd` topic, so declaring actions needs no new transport:

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

`sentence` matters: a client that can't phrase a payload shows the user raw
JSON in their rule list. `icon` is a semantic name (`scene`, `remote`,
`snowflake`), not a font codepoint; each client maps it to its own icon set.
An action can also declare its params (`Param`), the attribute it writes
(`writes`), a `confirm` prompt and a `requires_role`.

**Declare an action only if the command dispatcher really accepts it.** Back
the declaration with a test: every arm of your dispatcher is either declared
or deliberately excluded. Without one, the declaration drifts and a client
shows a control that does nothing, which is worse than not offering it.

### Publishing state without deleting your own work

`publish_state` **replaces** the retained document. `publish_state_partial`
merges into it.

If anything else publishes to the same device (a slow info refresher, a
second task, a facet merged into a primary device), a full publish deletes
what the other one wrote, and the next refresh puts it back. This has
happened: one WLED controller kept producing `device_state_changed` events
listing sixteen attributes, in both directions, indefinitely. Its light state
was published whole on every WebSocket push while sixteen hardware facts were
merged in on a five-minute tick.

Use a partial for anything that is one publisher's share of a device.

### Never publish a value that changes by itself

An `uptime` counter turns **every poll into a state change** for a device that
did nothing. Two Rokus reporting that time had passed once accounted for 111
of the last 200 events in the whole house.

Leave such values out. A reboot already shows up as availability dropping, and
homeCore records `last_seen` for every device. The same goes for an on-device
clock and any field that ticks on its own between reads.

### An action that repairs must repair the declaration

Most plugins publish a device only the first time they see it, through
something like a `registry.ensure_*` that returns false for a device this
process has already seen. That is right for a periodic loop and wrong for the
button an operator presses when a device looks wrong: *Rescan devices* re-reads
the bridge and republishes nothing.

**homeCore can lose a schema while your plugin still believes it published
one.** An unregister deletes the device *and* its schema, a restore from an
older backup predates it, and a typed registration can overwrite it. If your
repair action doesn't republish, the only fix left is restarting the plugin,
which is what empties its in-memory registry.

Five of homeCore's own plugins had this bug. Each was fixed the same way: an
operator-initiated pass forgets what it published, so the next pass publishes
everything again exactly once.

```rust
// Set by the manifest action, read by the pass that follows.
if force_republish {
    registry.forget_publications();
}
```

Don't republish on the periodic path. Everything published is an upsert
against a retained topic, so publishing again costs nothing when nothing is
wrong, but on a timer it is churn: one `device_schema_changed` event per
device per tick.

If your plugin receives reports rather than polling, set a flag that the next
inbound report reads, and say so in the action's description: there is
nothing to describe until the hardware reports.

### Name your numbers

A number that is a choice (a preset, an effect, a scene slot) is shown by name
everywhere when its attribute has `options`:

```json
"preset_id": { "kind": "integer", "writable": true, "display_name": "Preset",
  "options": [{ "value": "14", "label": "Halloween 1" }, { "value": "16", "label": "Halloween Solid" }] }
```

Pickers offer "Halloween 1", triggers read "preset becomes “Halloween 1”", and
you need no screen of your own for it. Options may differ per device and
change over time: build each device's schema with its own names and republish
it when they change (and only then). hc-wled's `schema_named` does exactly
this.

### Read and write the same name

The command path and the schema must agree, attribute by attribute:

| Published | Accepted | Result |
|---|---|---|
| `preset_id` | `preset` | A client reads the value, writes it back, nothing happens |
| `enabled` | `enable` | Same |
| `effect_id` | `effect` | Same |

All three of those shipped. If you must keep an old spelling for existing
rules, accept both and declare the one you publish.

### Names and units

**One name, one meaning, one unit** for everything a device reports or
accepts. The table is `hc_types::device_vocabulary::TERMS` in the homeCore
repository; read it before naming an attribute.

- **Use a name from the table when the idea matches**, in its unit and range:
  `on`, `brightness_pct` (0 to 100, decimals allowed), `color_temp` (kelvin),
  `color_xy`, `color_rgb`, `transition_ms`, `position` (100 = open), `locked`,
  `open` (`true` = open), `motion`, `occupied`, `temperature`, `humidity`,
  `illuminance` (lux), `setpoint` / `heat_setpoint` / `cool_setpoint`,
  `hvac_mode`, `hvac_action`, `fan_mode`, `power_w`, `energy_kwh`,
  `battery_pct`, `volume`, `muted`, `media_title`, `media_position`, and the
  rest of the table.
- **Your own idea gets your own name**, never one of these with a different
  meaning. A WLED preset is `preset_id`; a raw 0 to 255 level is not
  `brightness`.
- **Convert at the edge.** Publish in the table's unit, and convert back when
  commanding the device. Temperatures are **°C**, rain **mm**, pressure
  **hPa** and wind **m/s**, whatever the device reports or the person
  prefers. Showing °F is the app's job, based on each person's setting; a
  plugin has no unit setting. Write each conversion as a function with a test
  at each end of the scale: a dimmer's lowest step must not read as 0 % (off),
  and 100 % must reach the device's maximum (99 on Z-Wave, 254 on Zigbee and
  Matter, 255 on WLED). The Rust template's `pct_from_level` /
  `level_from_pct` show how.
- **Units in names.** A number names its unit as a suffix (`_pct`, `_ms`,
  `_secs`, `_w`, `_kwh`) unless it is a term whose unit the table sets
  (`temperature`, `humidity`, `volume`, `position`, …). Fades are `_ms`.
- **Two command shapes, no others.** A write to a writable attribute,
  `{"on": true}`, or a declared action, `{"action": "start", …}`. Read
  `action`, never `command`.
- **`{"on": true}` restores the last level** where the device can. `0` %
  means off; a light that is on never reports `0` %.

## Let the build check it for you

Most of the checklist below doesn't need remembering. It is
`plugin_sdk_rs::conformance`, and a plugin that breaks it fails `cargo test`:

```rust
#[cfg(test)]
mod conformance_tests {
    #[test]
    fn the_declaration_follows_the_rules() {
        plugin_sdk_rs::conformance::check_all(&device_schema(), &capabilities())
            .assert_ok();
    }

    /// The routed list is written by hand on purpose — it is the one thing
    /// the SDK cannot see, because it lives inside your `match`.
    #[test]
    fn every_action_is_both_advertised_and_routed() {
        plugin_sdk_rs::conformance::check_actions_routed(&capabilities(), &["say_hello"])
            .assert_ok();
    }
}
```

`hc-plugin-template` ships with both, so a plugin copied from it starts out
conformant. For a schema built as JSON (with `with_actions`, say),
`check_device_schema_json` applies the same rules.

What the checks catch, each of which has been a real bug in a shipped plugin:

| Check | What it catches |
| --- | --- |
| `check_device_schema` | a boolean naming one state or neither; an enum with no options; a dotted or non-snake_case name; housekeeping declared as a reading; `min` above `max`; an action with no sentence, or one that never names the device; an action claiming to write an attribute the schema does not declare |
| `check_manifest` | an action with no label, or no `timeout_ms` (core's 5 s default fails anything that talks to hardware) |
| `check_actions_routed` | an action advertised but not routed (a button that does nothing) and one routed but not advertised (a capability nobody can find) |
| `check_writables` | an attribute declared writable that your command path ignores, a control the user only discovers is fake by using it |

`check_writables` takes your dispatcher as a closure, since only your plugin
knows what a payload does:

```rust
plugin_sdk_rs::conformance::check_writables(&device_schema(), |name| {
    !translate_command(&json!({ name: sample_value(name) })).is_empty()
})
.assert_ok();
```

This works the same way as `config_descriptor::missing_schema_coverage` does
for configuration: the SDK holds the rule and your test calls it, so the rule
can't go stale in a document nobody re-reads.

## Before you release a plugin

Each of these has been a real bug in a shipped homeCore plugin. **The items
marked ✓ are checked by `conformance` above**; the rest only you can check.

**The device**

- [ ] Every device registers a `device_type`. A WLED controller had none for
      its whole life, so every client filtering by type skipped it.
- [ ] Every device publishes a schema, including the ones that seem too simple
      to need one. A scene that takes `activate` and reports nothing still
      declares that. An empty attribute set says something, and "no schema"
      says something different.

**The attributes**

- [ ] Every attribute you publish is declared, under the name you publish it.
- [ ] Every attribute you declare is one you publish, or one the command path
      accepts.
- [ ] ✓ Every boolean has `states`, with both sides named.
- [ ] Every `unit` is true of the value. A 0-5 battery level declared `%`
      showed a healthy sensor as "2%".
- [ ] Shared ideas use the [shared names and units](#names-and-units),
      converted inside the plugin (temperatures °C, `brightness_pct` 0 to 100,
      `color_temp` kelvin), with a test at each end of every conversion.
- [ ] Commands are read as an attribute write or `{"action": …}`, never
      `{"command": …}`.
- [ ] ✓ Every `min`/`max` is a valid range, and matches what the command path clamps to.
- [ ] ✓ Housekeeping carries `category`; ask `AttributeCategory::for_name`
      before writing your own list.
- [ ] ✓ Names are `snake_case`, with no dots. Nothing treats a dot specially,
      but no other plugin uses one, and a client humanising `led.count` shows
      "Led.count".

**The publishing**

- [ ] Your repair action republishes declarations, not only state.
- [ ] Partial publishes for anything that is one publisher's share of a device.
- [ ] No self-changing values in state: no uptime, no device clock.
- [ ] The schema is republished when the set of attributes changes.
- [ ] Availability is published, and set false when the device is unreachable.

**The plugin**

- [ ] The config section is `#[serde(default)]` with a `Default` impl.
      Otherwise a freshly installed plugin crash-loops on "missing field"
      before it can publish its config schema.
- [ ] `config_schema` and `config_descriptor` are both published, and the
      descriptor covers every schema field (`missing_schema_coverage` tests it).
- [ ] Commands are subscribed as well as registered. Forgetting
      `subscribe_commands` gives a device whose state updates and whose
      commands go nowhere.

**Its screens**, if it has any

- [ ] They use `host` for everything (not the app's own modules or its API
      paths) and fall back cleanly; the app shows its generic screens when a
      plugin's won't load.
- [ ] Cards list the `forms` they support, use `hc-tile`, and look right at
      half a phone's width.
- [ ] Checked in light and dark, on a test homeCore, never the real house.
- [ ] `ui/` builds from a clean checkout (`npm ci && npm run build`) and
      writes `dist/manifest.json`.

**The check that catches most of it**

Read the device back from a running homeCore. Every defect above is invisible
in the source and obvious here:

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

Register a `device_type` string so UIs can categorize devices correctly and
keep scenes out of device lists.

**Publish what the device *is*, not the protocol you reach it over.** Until
recently every Z-Wave node in homeCore registered as `device_type: "zwave"`,
so a lock, four outlets, a door sensor and a motion sensor arrived
indistinguishable, and every client filtering or ranking by type had nothing
to work with.

**Ask the bridge; it usually knows.** zwave-js had been sending
`deviceClass.generic` / `.specific` on every node all along. Hue, Lutron and
Caséta all report a device kind of their own. Reading it is nearly always
better than a config field somebody has to fill in.

**Where the bridge's answer is ambiguous, look at what the device reports.**
Z-Wave describes a door sensor and a motion sensor identically (both are
"Notification Sensor"); the only difference is that one publishes a contact
and the other publishes motion.

**Say nothing rather than guess.** Omitting `device_type` leaves whatever
homeCore already stored alone. A device that has not finished its interview
can register without a type now and be typed on the next registration, with
no special handling. The same applies to any registration that doesn't know
the type: a rename handler knows the new name and nothing else, and
re-asserting a type there undoes what the informed registration worked out.

The common values:

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

`plugins/hc-plugin-template` is the reference for the full SDK lifecycle. It
publishes virtual lights and needs no hardware:

```bash
cp plugins/hc-plugin-template/config/config.toml.example \
   plugins/hc-plugin-template/config/config.toml
cargo run -p hc-plugin-template -- plugins/hc-plugin-template/config/config.toml
```

Run it against a homeCore whose broker is on `127.0.0.1:1883`, or point
`[homecore] broker_host`/`broker_port` at one elsewhere. Add more
`[[template.devices]]` entries to see how your plugin behaves with a realistic
device count; that is where the event-loop ordering problem described above
shows up.

Check that your plugin's devices appear:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.plugin_id == "plugin.my-device") | .name]'
```

Then write a rule that reacts to your device's state changes and check that
it fires in the event stream.

Test on a sandbox homeCore (its own `--home`, `--config` and broker port),
with small stand-ins for the real devices, never against a real house. Don't
run discovery from a sandbox, since it would find real devices.
