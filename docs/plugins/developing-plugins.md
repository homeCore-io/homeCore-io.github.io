---
id: developing-plugins
title: Developing Plugins
sidebar_label: Developing Plugins
sidebar_position: 2
---

# Developing Plugins

You can write a plugin in any language with an MQTT client library. homeCore
has SDKs for Rust, Python, Node.js and .NET.

:::tip The whole process, end to end
[`docs/plugin-development.md`](https://github.com/homeCore-io/homeCore/blob/main/docs/plugin-development.md)
in the homeCore repository walks through a plugin from an empty directory to
a release, with pointers to working examples. This page is the reference for
each part. [Capabilities & Actions](./capabilities),
[Screens and Cards](./plugin-screens) and
[Alerts from Plugins](./plugin-alerts) cover those topics in full, and the
[Overview](./overview) has the MQTT topics and the management API.
:::

The Rust SDK and every Rust plugin live in the homeCore repository, at
`sdk/rust` and `plugins/<name>`. The Python, Node.js and .NET SDKs are
repositories of their own.

## Installing an SDK

None of the SDKs is on a package registry (crates.io, PyPI, npm or NuGet).
Install from a local checkout or a git tag.

### Rust

A plugin inside the homeCore repository is a workspace member next to the
SDK and depends on it by path:

```toml
[dependencies]
plugin-sdk-rs = { path = "../../sdk/rust" }
tokio         = { version = "1", features = ["full"] }
serde_json    = "1"
anyhow        = "1"
```

An SDK change reaches every plugin on the next `cargo build`, and the
repository's `cargo fmt`, `clippy` and `test` cover homeCore, the SDK and
every plugin together, so a change that breaks a plugin fails at once.

For a Rust plugin outside the homeCore repository, pin a core release tag,
the newest when you start (v0.1.114 at the time of writing, with SDK 0.6.5).
The SDK re-exports `hc-types`, the types plugins and homeCore share, so the
tag keeps them from changing under you:

```toml
plugin-sdk-rs = { git = "https://github.com/homeCore-io/homeCore", tag = "v0.1.114" }
```

No `path` key is needed. Cargo finds `plugin-sdk-rs` by package name among
the repository's workspace members.

### Python, Node.js and .NET

With the SDK cloned beside your plugin, point the plugin at the checkout:

| | From your plugin's directory |
|---|---|
| Python | `pip install -e ../../sdks/hc-plugin-sdk-py` |
| Node.js | `npm install ../../sdks/hc-plugin-sdk-js` |
| .NET | `dotnet add reference ../../sdks/hc-plugin-sdk-dotnet/HomeCoreSdk.csproj` |

Python's `-e` and npm's directory install link to the checkout, so an SDK
change takes effect without a reinstall. .NET builds the SDK from source as
part of your build.

To pin a release instead:

| | |
|---|---|
| Python | `pip install git+https://github.com/homeCore-io/hc-plugin-sdk-py@v0.5.6` |
| Node.js | `npm install github:homeCore-io/hc-plugin-sdk-js#v0.4.6` |
| .NET | clone at `v0.4.6` beside your project, then `dotnet add reference …/HomeCoreSdk.csproj` |

These were the newest tags at the time of writing; each SDK's releases list
the current one. NuGet can't install from git, which is why .NET clones. Keep
a .NET plugin's project in its own folder beside the SDK's, never inside it,
or the SDK's project builds your files into the library.

In a `pyproject.toml`, depend on `homecore-plugin-sdk` and tell uv where it is:

```toml
[project]
dependencies = ["homecore-plugin-sdk>=0.5.6"]

[tool.uv.sources]
homecore-plugin-sdk = { git = "https://github.com/homeCore-io/hc-plugin-sdk-py", tag = "v0.5.6" }
```

## Startup, in the order it has to happen

Every plugin does the same things in the same order:

```text
config (argv[1]) → logging → connect → enable_management(...)
  .with_capabilities(manifest)          // its actions
  .with_config_schema / descriptor      // its settings form
  .with_alert_kinds(...)                // alerts it can raise
  .with_ui_dir(dir, version)            // its own screens and cards
  .with_stop_handler(...)               // what to do on the way out
→ start the event loop (run_managed) → register devices → publish state
```

homeCore passes the config file's path as the only argument. The plugin reads
`[homecore]` from it to log in to the broker; the rest of the file is the
plugin's own.

### Start the event loop before you register

In Rust, `run` or `run_managed` drives the MQTT connection. Until one of them
is running, nothing you publish leaves the process. Publishes queue, and the
queue holds 64 messages.

Registering one device costs four of them: register, subscribe, state and
availability. A plugin that registers its devices and then calls
`run_managed` works with three devices and hangs at startup with seventeen,
because it never reaches the line that drains the queue. There is no error
and no log line. Against a real broker, a plugin registering 40 devices got
through 12 when it registered first, and all 40 when it started the loop
first. Every shipped plugin starts the loop first.

Starting early loses nothing. A command for a device you haven't registered
can't arrive, because the subscription that would carry it doesn't exist yet.

Plugins usually retry their first connection a few times and then exit;
homeCore's supervisor takes over from there (see
[Supervision](./overview#supervision)).

## Rust SDK (`plugin-sdk-rs`)

The quickest start is `plugins/hc-plugin-template`: a working virtual-light
plugin, small enough to read in one sitting, with the management protocol, a
config schema and descriptor, a capability action, a notice, a stop handler
and its own screens already wired up. Its `src/main.rs` comments are the
startup contract.

```sh
cp -r plugins/hc-plugin-template plugins/hc-mything
$EDITOR Cargo.toml          # add "plugins/hc-mything" to [workspace] members
```

Then rename the package and binary in its `Cargo.toml`, the `plugin_id` in
its config, and the `Descriptor::new` id in `config.rs`.

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

    // Take handles BEFORE starting the loop: `run` consumes the client.
    let publisher = client.device_publisher();

    // Start the event loop FIRST. Commands arrive on this callback, which is
    // synchronous, so hand slow work to a task over a channel.
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
    // appears in homeCore and updates its state, but every command goes
    // nowhere because nothing listens on its cmd topic.
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
`enable_management`. That lets homeCore see its heartbeat, change its
settings and log level, and show its actions.

`register_device_detailed` takes the same arguments plus a `DeviceHardware`
(`manufacturer`, `model`, `sw_version`, and `behind(parent_id)` for the
bridge or controller the device sits behind). homeCore shows these to the
person looking at a device and acts on none of them. Fields you leave out
keep what homeCore already has, so you can report firmware after the first
poll.

### Publishing state

```rust
// Full state (retained; replaces the previous state).
publisher
    .publish_state("my_device_001", &json!({
        "temperature": 22.8,     // always °C; the app converts for the person
        "humidity": 44.5,
        "battery_pct": 87
    }))
    .await?;

// Partial (JSON merge patch: only the fields given).
publisher
    .publish_state_partial("my_device_001", &json!({ "temperature": 22.8 }))
    .await?;

// After a command, attach what caused the change so the app and the
// audit log can say so.
publisher
    .publish_state_for_command("my_device_001", &new_state, &command_payload, "my-plugin")
    .await?;
```

### Handling commands

homeCore never writes device state. A command arrives on
`homecore/devices/{id}/cmd`, the plugin does whatever the device needs, and
then publishes what actually happened. That is how the app can show a light
as off after a command the bulb refused.

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
            // try_send, not send: dropping a command under load is better
            // than blocking the MQTT event loop behind it.
            let _ = tx.try_send((device_id, payload));
        },
        mgmt,
    )
    .await
```

Every SDK subscribes per device, never to a wildcard, so a plugin receives
commands only for the devices it owns. In Rust that is the explicit
`subscribe_commands()` call; in Python, Node.js and .NET, registering a device
subscribes for you.

:::note The embedded broker doesn't enforce topic ACLs
The embedded broker checks each plugin's login but not which topics it uses,
so a misbehaving plugin could subscribe outside its own devices. If you can't
rely on every plugin behaving (third-party code, compliance), run homeCore
with an external Mosquitto broker, which enforces the `allow_pub` and
`allow_sub` patterns in `[[broker.clients]]`. See
[External Mosquitto deployment](../administration/broker#external-mosquitto-deployment).
:::

### Notices

A notice puts a plugin's problem on its page in the app instead of only in
its log.

```rust
use plugin_sdk_rs::types::PluginNotice;

let notices = client.notices();

notices.raise(
    PluginNotice::error("bridge_unreachable", "The bridge stopped answering")
        .with_remedy("Check that the bridge is powered on and reachable"),
);

notices.clear("bridge_unreachable");   // when it answers again
```

`PluginNotice` also has `warning` and `info`. The SDK sends the full set with
every heartbeat, and homeCore replaces what it held.

A notice describes current state. It stays up while the condition holds, so
check it again after each discovery sweep, reconnect and config change. A
plugin that raises `no_devices_configured` at startup and never checks again
still shows it after the devices arrive. Every SDK has notices.

### Stopping

homeCore, and a plugin runtime, stop a plugin with SIGTERM and kill it 2
seconds later. Every SDK answers SIGTERM and Ctrl-C itself: it runs the
plugin's stop hook, marks every registered device offline, reports the plugin
offline, disconnects and exits. Put what has to happen on the way out in the
hook (leave a heater off, sign out of a device's session). It gets 1 second.
Don't install a SIGTERM handler of your own; it races the SDK's.

| SDK | Stop hook |
|---|---|
| Rust | `mgmt.with_stop_handler(\|\| async { ... })` |
| Python | override `on_stop()` |
| Node.js | override `onStop()` (may return a promise) |
| .NET | set `OnStop` |

A plugin homeCore started also exits on its own within a few seconds if that
homeCore is killed or crashes. The SDKs read `HOMECORE_SUPERVISED` for this.

### Removing devices that are gone

When a device disappears from a plugin's source (a Hue bulb deleted from the
bridge, a Z-Wave node excluded, an entry removed from the config), its
homeCore record should go too. The SDK keeps track; the plugin says what is
live after each sync.

```rust
// 1. Opt in once at startup, next to the config file.
let client = PluginClient::connect(cfg)
    .await?
    .with_device_persistence(
        Path::new(&config_path)
            .parent()
            .unwrap_or(Path::new("."))
            .join(".published-device-ids.json"),
    );

// 2. After a sync you trust, with the full live set:
let live: HashSet<String> = my_upstream
    .list_devices()
    .iter()
    .map(|d| d.hc_id())
    .collect();
let report = publisher.reconcile_devices(live).await?;
// report.stale_unregistered: devices unregistered because they're not in `live`
// report.unknown_in_live:    ids you passed but never registered (usually none)
```

`with_device_persistence(path)` saves every registered and unregistered id to
a file and loads it at startup, so the plugin remembers devices from earlier
runs. `reconcile_devices(live)` unregisters every remembered id that isn't in
`live` and saves the new set. The SDK puts the plugin id into the file name
(`.published-device-ids.plugin.hue.json`), so plugins whose configs share a
directory don't retire each other's devices.

Call it only after a sync that fully succeeded. Reconciling after a partial
fetch deletes healthy devices behind a hub that happened not to answer; the
usual guard is an `all_sources_succeeded` flag across the per-source loop. A
plugin whose devices report irregularly (battery sensors that go quiet for
hours, as with hc-ecowitt) should keep the persistence and skip reconciling.

| | Enable | Reconcile |
|---|---|---|
| Rust | `with_device_persistence(path)` | `reconcile_devices(live)` |
| Python | `enable_device_persistence(path)` | `reconcile_devices(live)` |
| Node.js | `enableDevicePersistence(path)` | `reconcileDevices(live)` |
| .NET | `EnableDevicePersistence(path)` | `ReconcileDevicesAsync(live)` |

An admin can also delete every device a plugin owns with
`DELETE /api/v1/plugins/{id}/devices`, or **Delete all its devices…** on the
plugin's Devices tab. The plugin stays installed and registers anything still
live on its next sync.

### What the plugin has learned

Some plugins learn things at runtime that must survive a restart, such as the
key a Hue bridge hands out when it is paired. In Rust, `persist_state(delta)`
(or `state_writer()`, a handle you can keep after `run_managed` takes the
client) sends a change to homeCore on `homecore/plugins/{id}/state/set`.
homeCore merges it into its database (a top-level key set to `null` is
deleted) and publishes the whole document retained on
`homecore/plugins/{id}/state`. `with_state_handler` on the management handle
receives that document shortly after each connect and whenever it changes.
This is Rust only.

### Where the house is

homeCore publishes the house's latitude and longitude (its `[location]`
setting) retained on `homecore/system/location`, and its time zone on
`homecore/system/tz`. A Rust plugin reads the location with
`plugin_sdk_rs::house_location()`, or `wait_house_location(timeout)` once
`run_managed` has started. hc-weather uses it to report the weather "at home"
without asking for the address again.

### Reading other plugins' devices

Most plugins listen only to their own devices. A plugin like hc-thermostat
also needs the state of devices other plugins own, such as temperature
sensors from YoLink and Ecowitt.

```rust
// Subscribe to another plugin's device state (restored after a reconnect).
client.subscribe_state("yolink_sensor_a").await?;
client.subscribe_state("ecowitt_outdoor_temp").await?;

// Keep a publisher: `run_managed_with_state` consumes the client.
let publisher = client.device_publisher();

// Two callbacks: commands for our devices, state from the others.
client.run_managed_with_state(
    move |device_id, payload| {
        // Commands on OUR devices
    },
    move |device_id, payload| {
        // State from OTHER devices we subscribed to
    },
    mgmt,
).await?;

// Later, from a task holding the publisher:
publisher.unsubscribe_state("ecowitt_outdoor_temp").await?;
```

`run_managed_with_state` replaces `run_managed`. `DevicePublisher` has
`subscribe_state` and `unsubscribe_state` too, so a background task can
change the list while the plugin runs. Python (`subscribe_state` and
`on_state`), Node.js (`subscribeState` and `onState`) and .NET
(`SubscribeStateAsync` and `OnState`) can do this as well.

The Rust SDK can also follow other devices' availability
(`subscribe_availability` with `with_availability_handler`, called with
`(device_id, online)`) and schemas (`subscribe_schema` with
`with_schema_handler`).

Such a plugin needs `allow_sub = ["homecore/devices/+/state"]`, which is
broader than the usual plugin's, when the broker enforces topic ACLs. See
[hc-thermostat](./thermostat) for a complete example.

## Python SDK (`hc-plugin-sdk-py`)

[Install it](#installing-an-sdk) first. Subclass `PluginBase`, implement
`on_command`, and start it with `from_config()`, which reads `[homecore]`
from the config file homeCore passes as `sys.argv[1]`. The API is
synchronous: the SDK runs paho-mqtt's loop for you, so background work goes
in a thread. It needs Python 3.11 or later; plugin runtimes run 3.12.

```python
from homecore_plugin_sdk import PluginBase

DEVICE_ID = "light.virtual_py_01"
CAPABILITIES = {
    "on":             {"type": "boolean"},
    "brightness_pct": {"type": "number", "minimum": 0, "maximum": 100},
}


class MyPlugin(PluginBase):
    PLUGIN_ID = "plugin.my-light"   # from_config() takes the id from the file

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self._on = False
        self._level = 50.0  # kept while off, so {"on": true} restores it

    def _state(self) -> dict:
        # A light that is on never reports 0 %; one that is off reports 0 %.
        return {"on": self._on, "brightness_pct": self._level if self._on else 0}

    def on_connect(self) -> None:
        # Runs again after every reconnect, so register here, not in __init__.
        self.enable_management(version="0.1.0")
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
        # Publish what you actually applied, with what caused it.
        self.publish_state_for_command(
            device_id, self._state(), payload, fallback_source="my-plugin"
        )


if __name__ == "__main__":
    MyPlugin.from_config().run()
```

`read_own_config()` returns the whole config file for your own settings. When
you run a plugin by hand without a config file, the constructor arguments and
then `HC_BROKER_HOST`, `HC_BROKER_PORT` and `HC_PLUGIN_PASSWORD` fill in.
`examples/virtual_light.py` in the SDK repository is a complete plugin. To
ship one through the Catalog, see
[Releasing a Python plugin](#releasing-a-python-plugin).

## Node.js SDK (`hc-plugin-sdk-js`)

[Install it](#installing-an-sdk) first. Extend `PluginBase`, implement
`onCommand` and call `run()`. It has the same shape as the Python SDK, built
on mqtt.js 5, and needs Node.js 18 or later. It has no config loader, so read
`[homecore]` from the file yourself with any TOML parser:

```javascript
const fs = require('fs');
const { parse } = require('smol-toml');
const { PluginBase } = require('homecore-plugin-sdk');

// homeCore starts a plugin as `<binary> <config path>`.
const configPath = process.argv[2];
const hc = parse(fs.readFileSync(configPath, 'utf8')).homecore || {};

const DEVICE_ID = 'light.virtual_js_01';
const CAPABILITIES = {
  on:             { type: 'boolean' },
  brightness_pct: { type: 'number', minimum: 0, maximum: 100 },
};

class MyPlugin extends PluginBase {
  constructor(options = {}) {
    super(options);
    this._on = false;
    this._level = 50; // kept while off, so {"on": true} restores it
  }

  _state() {
    // A light that is on never reports 0 %; one that is off reports 0 %.
    return { on: this._on, brightness_pct: this._on ? this._level : 0 };
  }

  onConnect() {
    // Runs again after every reconnect.
    this.enableManagement({ version: '0.1.0', configPath });
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

new MyPlugin({
  pluginId:   hc.plugin_id,   // homeCore made the password for this id
  brokerHost: hc.broker_host,
  brokerPort: hc.broker_port,
  password:   hc.password,
}).run();
```

`examples/virtual_light.js` in the SDK repository is a complete plugin.
Node.js plugins are not in the Catalog yet; see
[Node.js and .NET plugins](#nodejs-and-net-plugins).

## .NET SDK (`hc-plugin-sdk-dotnet`)

[Install it](#installing-an-sdk) first. The SDK targets .NET 8. Like Node.js,
it has no config loader; the SDK's README reads `[homecore]` with Tomlyn and
fills `PluginOptions` from it.

```csharp
using HomeCore.PluginSdk;

var configPath = args[0];   // homeCore starts a plugin as `<binary> <config path>`
var client = new PluginClient(new PluginOptions
{
    PluginId = "plugin.my-device",   // from [homecore] plugin_id
    // BrokerHost, BrokerPort and Password from [homecore] as well
});

client.OnConnected += async () =>
{
    // Runs again after a reconnect. Registering also subscribes to commands.
    await client.EnableManagementAsync(new ManagementOptions
    {
        Version = "0.1.0",
        ConfigPath = configPath,
    });
    await client.RegisterDeviceFullAsync("my_device_001", "My Device", deviceType: "sensor");
    await client.PublishAvailabilityAsync("my_device_001", true);
    await client.PublishStateAsync("my_device_001", new { temperature = 22.5 }); // °C
};

client.OnCommand += async (deviceId, payload) =>
{
    // Do whatever the device needs, then publish what actually happened.
    await client.PublishStateForCommandAsync(deviceId, new { temperature = 22.5 }, payload, "my-plugin");
};

await client.ConnectAsync();
await client.RunAsync();
```

Options you leave unset fall back to `HC_BROKER_HOST`, `HC_BROKER_PORT` and
`HC_PLUGIN_PASSWORD`. The SDK reconnects after a dropped connection (1
second, doubling up to 30) and fires `OnConnected` again; `OnDisconnected`
says the connection went.

## Choosing a language

The four SDKs cover the same core: devices, state, commands, the management
protocol, notices, actions (streaming included), who called, the plugin's own
REST access, alerts, its own screens, and stopping cleanly. Some newer
features are in the Rust SDK only; the [matrix](#sdk-feature-matrix) lists
them. The Rust SDK is the reference, and new protocol features land there
first. Only Rust and Python plugins can be released to the Catalog so far.

### SDK feature matrix

| Feature | Rust | Python | Node.js | .NET |
|---|---|---|---|---|
| Devices: registration, schema, state (full and partial), availability, events | yes | yes | yes | yes |
| Commands, per-device subscription, provenance | yes | yes | yes | yes |
| Management protocol, log forwarding, auto-reconnect | yes | yes | yes | yes |
| Notices | yes | yes | yes | yes |
| Actions, immediate and streaming | yes | yes | yes | yes |
| Who called (`caller`), `signed_in` actions | yes | yes | yes | yes |
| Own REST access (`api_scopes`, `api_access`) | yes | yes | yes | yes |
| Alerts (alert kinds, `set_alerts`) | yes | yes | yes | yes |
| Own screens and cards (`with_ui_dir`) | yes | yes | yes | yes |
| Device persistence and reconcile | yes | yes | yes | yes |
| Other devices' state (`subscribe_state`) | yes | yes | yes | yes |
| Devices offline on SIGTERM, with a stop hook | yes | yes | yes | yes |
| Files sent to actions (`upload_chunk`) | yes | no | no | no |
| Pictures it keeps (`with_files_dir`) | yes | no | no | no |
| Actions answered asynchronously (`with_async_handler`) | yes | no | no | no |
| Other devices' availability and schemas | yes | no | no | no |
| Learned state kept by homeCore (`persist_state`) | yes | no | no | no |
| The house's location (`house_location`) | yes | no | no | no |
| Typed config descriptor builders, conformance checks | yes | no | no | no |
| Released to the Catalog | yes | yes | no | no |

## Management protocol

With management enabled, the SDK publishes a heartbeat to
`homecore/plugins/{id}/heartbeat` at the interval you choose (60 seconds in
the first-party plugins; homeCore marks a plugin offline after 90 seconds
without one) and answers homeCore's management commands itself: `ping`,
`get_config`, `set_config`, `set_log_level`, `api_access`, `cancel`,
`respond` and `ui_file`. The [Overview](./overview#management-protocol) lists
them.

Log lines go to `homecore/plugins/{id}/logs`, so they show up in
Settings › Logs and on the plugin's **Log** tab beside homeCore's own.
In Rust, add the SDK's `MqttLogLayer` to your tracing subscriber and connect
it once the client exists (the template shows how). The minimum level it
forwards is `log_forward_level` in `[logging]` for plugins using the SDK's
logging config; the template names its own setting `forward_level`. Python
has `enable_log_forwarding(min_level)`, Node.js `enableLogForwarding(minLevel)`
and .NET `EnableLogForwarding`.

`set_log_level` changes the level while the plugin runs. homeCore sends it
when someone changes the level on the plugin's page, and also saves it in the
plugin's `[logging] level`. A Rust plugin needs a `LogLevelHandle` passed to
`enable_management` for this; without one, the change waits for a restart.
Node.js calls `onLogLevel(level)` when it changes.

:::caution Secrets in forwarded logs
Forwarded log lines go to an MQTT topic anything on the broker can subscribe
to. The Rust and .NET SDKs replace the values of fields whose names look
secret with `<redacted>`. .NET also puts every template argument into the
message text, so `LogInformation("connecting with {ApiKey}", key)` would leak
the key there; the .NET SDK scrubs those values out of the message as well.
The Python and Node.js SDKs forward lines as they are. None of them can help
with a secret you put into a message yourself, so don't log secrets.
:::

## Configuration: schema and descriptor

An admin configures your plugin on its page in the web app. What they see
comes from two documents you publish on the capability manifest. Publish
neither and they get a TOML text box.

| | What it is | Who writes it |
|---|---|---|
| Config schema | JSON Schema of your config: which fields exist, of what type | Derived from your config structs |
| Config descriptor | How to show them: sections, units, help text, secrets, conditions | You |

Publish both. The schema says which fields exist and is what homeCore
validates against; the descriptor says how to show them. homeCore serves them
at `GET /api/v1/plugins/{id}/config/schema` and `/config/descriptor`. The app
writes only what changed and keeps the file's comments, and homeCore restarts
the plugin when its file changes.

```rust
let mgmt = match config::config_schema() {
    Some(schema) => mgmt.with_config_schema(schema),
    None => mgmt,
};
let mgmt = mgmt.with_config_descriptor(config::config_descriptor());
```

Both ride on the capability manifest, so the plugin must call
`with_capabilities` as well. An empty manifest is fine.

The descriptor is built with typed builders, so a mistyped field kind fails
to compile instead of silently never showing:

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
`note`, `link` and `import`. A field can take its values from a live source:
`Source::core_resource` (so a form edits the device registry instead of your
TOML) or `Source::plugin_action`.

:::warning A published descriptor is the whole form
The app draws your descriptor instead of a form from the schema. A config
field the descriptor leaves out can't be edited at all, even though the
schema declares it and your plugin reads it. hc-sonos once shipped a
descriptor without its logging section, and those settings vanished from the
page.

Guard against it with a test. Every shipped plugin has this one:

```rust
#[test]
fn descriptor_covers_every_schema_field() {
    let missing = plugin_sdk_rs::config_descriptor::missing_schema_coverage(
        &config_schema().unwrap(),
        &config_descriptor(),
        &["homecore.plugin_id"],   // deliberate omissions, with a reason
    );
    assert!(missing.is_empty(), "missing from the descriptor: {missing:?}");
}
```

The third argument lists deliberate omissions, so each one is a line someone
wrote and a reviewer can see.
:::

A hidden section (`.hidden()`) still counts as covering its fields. Use it for
values homeCore writes at install, like the broker host and password.

Every Rust plugin puts schema derivation behind a cargo feature:

```toml
[features]
default = ["schema"]
schema  = ["dep:schemars", "plugin-sdk-rs/schema"]
```

Give your config section `#[serde(default)]` and a `Default` impl. Otherwise
a freshly installed plugin crash-loops on "missing field" before it can
publish its schema.

In the other SDKs both documents go on the capabilities: `config_schema` and
`config_descriptor` on the Python `Capabilities` dataclass, `configSchema`
and `configDescriptor` in the Node.js `Capabilities` options, and
`ConfigSchema` and `ConfigDescriptor` on the .NET record. There you pass plain
objects, so a mistyped field kind shows up only as a field the app doesn't
draw. Python's `on_set_config`, Node's `onSetConfig` and .NET's `OnSetConfig`
let a plugin accept settings that arrive as an object over `set_config`.

## Capability manifest

A plugin declares its own actions on a manifest. The web app lists them on
the plugin's page and hc-mcp offers them as tools.
[Plugin Capabilities & Actions](./capabilities) has the full spec: fields,
roles, `caller`, REST access, stages and protocol. Below is how to wire
actions up in Rust.

### Sync action

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
            // Always declare one. The default is 5 seconds, which fails
            // most actions that talk to hardware.
            timeout_ms: Some(20_000),
            // true for an action that can't be undone or interrupts the
            // house (a reboot, forgetting devices): screens ask first.
            danger: false,
        }],
        ..Default::default() // plugin_id is filled in by the SDK; no api_scopes
    })
    .with_custom_handler(move |cmd| match cmd["action"].as_str()? {
        "rescan_devices" => {
            rescan_tx.try_send(()).ok();
            Some(serde_json::json!({ "status": "ok" }))
        }
        _ => None,
    });
```

`with_custom_handler` runs synchronously and must not block. Answer an action
that waits on a device with `with_async_handler` instead: return
`Some(future)` for the actions it handles, and the future's value is the
reply. Each request runs on its own task, so a slow one holds up nothing
else. `Caller::from_cmd(cmd)` reads who asked in either handler.

In Python, Node.js and .NET, pass a `Capabilities` to `enable_management` /
`enableManagement` / `ManagementOptions` and answer actions in `on_action` /
`onAction` / `OnAction` (or `OnActionWithCaller`).

### Streaming action

For long flows that report progress, ask the person questions and can be
canceled. Use `with_streaming_action` and the methods on `StreamContext`:

```rust
use plugin_sdk_rs::{StreamContext, StreamingAction};
use serde_json::{json, Value};

let mgmt = mgmt.with_streaming_action(StreamingAction::new(
    "include_node",
    move |ctx: StreamContext, _params: Value| async move {
        ctx.progress(Some(0), Some("starting"), Some("Press the button on each device")).await?;

        // ... wait for device events, send an item per node ...
        ctx.item_add(json!({ "node_id": 14, "status": "added" })).await?;
        ctx.item_update(json!({ "node_id": 14, "status": "ready" })).await?;

        // Ask, then wait for the person's answer.
        ctx.emit_awaiting_user_with_schema(
            "Reply when finished",
            json!({ "done": { "type": "boolean", "default": true } }),
        ).await?;
        let _ = ctx.await_respond().await?;

        // Always end with an ending stage.
        ctx.complete(json!({ "nodes_added": [14] })).await
    },
));
```

The stage methods (`progress`, `item_add`, `item_update`, `item_remove`,
`awaiting_user`, `warning`, `complete`, `error`, `canceled`) build the
envelope and publish it on the stream topic. `progress_with_data` and
`awaiting_user_with_data` attach `data` for a plugin's own screen. Check
`ctx.is_canceled()` in loops (or await `ctx.wait_canceled()` in a
`tokio::select!`), and call `ctx.canceled()` yourself once you have stopped.
`awaiting_user_with_schema` asks and waits in one call; use
`emit_awaiting_user_with_schema` with `await_respond` when the action has
other work to do while it waits. `ctx.caller()` says who started the run.

The Z-Wave plugin's `inclusion.rs` is a thorough example of all of these.
`plugins/hc-captest/` has a small demo of each convention.

### Files sent to an action

`POST /api/v1/plugins/{id}/upload/{action}` sends a file of up to 32 MiB to
one of your actions, such as a firmware image or a backup to restore.
homeCore checks the action's role, sends the file to the plugin in pieces
over the management channel (`upload_chunk`), and then runs the action. The
SDK passes the action a `file_path` param: a local file, which it removes
once the action has replied, so copy it first if a streaming action keeps
working with it. Query parameters arrive as params, as strings. From a
plugin's own screen, use `host.upload(action, file, params)`. This is Rust
only for now; hc-wled's `install_firmware_file` is the example.

```rust
"install_firmware_file" => {
    let path = cmd["file_path"].as_str().unwrap_or_default();
    let image = std::fs::read(path)?;
    // ...check it is what you expect before acting on it
}
```

## Alerts

Alerts about your devices (a firmware update, a device that restarted by
itself) go into the house's alert list, can be sent to a notification channel
and can drive automations. Declare the kinds with `with_alert_kinds`, then
report which are true now with `set_alerts(device_id, [...])`. Send the whole
list each time; one you stop sending has cleared. See
[Alerts from Plugins](./plugin-alerts).

## Its own screens and cards

A plugin can carry web components for its page, its devices' panel, the
automation editor's form for a step on its devices, its devices' cards, cards
of its own that a household adds to a page, drawings for the looks, and a
helper anyone can open from the app's top bar. It serves them itself with
`with_ui_dir`. Pictures it fetches while running (channel icons, say) are
served with `with_files_dir`. See [Screens and Cards](./plugin-screens).

How the built screens reach an installed plugin depends on the language:

- Rust: the release builds `ui/` and packs `ui/dist` as `ui/` beside the
  binary in the plugin's `.tar.zst` (`ui = "ui"` in its `plugin.toml`).
  `plugin_sdk_rs::ui::find_dir` finds it there.
- Python: the screens go inside the wheel, as package data in a `ui/` folder
  in your package, where the SDK's `ui.find_dir(__file__)` looks. hc-mcp does
  it with hatchling:

  ```toml
  [tool.hatch.build.targets.wheel.force-include]
  "ui" = "hc_mcp/ui"
  ```

## Raw MQTT (any language)

You can write a plugin in any language with any MQTT client by following the
topic protocol directly.

### 1. Connect to the broker

```
host: 127.0.0.1
port: 1883
client_id: plugin.my-device
username:  plugin.my-device   (same as client_id)
password:  your-password       (if broker auth enabled, else empty)
```

Set an MQTT Last Will that publishes `offline` to each device's availability
topic, or publish it yourself before you disconnect.

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

Publish `online` or `offline` to `homecore/devices/my_device_001/availability`
with `retain=true`.

### 5. Subscribe to commands

Subscribe to `homecore/devices/my_device_001/cmd`. A payload has one of two
shapes: a write to a writable attribute, `{"on": true}`, or a declared
action, `{"action": "toggle"}`. It is never `{"command": …}`. Apply it to the
device, then publish the new state.

For heartbeats, settings and actions, follow the
[management protocol](./overview#management-protocol).

## Declaring a device

Registering a device tells homeCore it exists. The device schema tells every
client what to draw for it, and it is the part most plugins skip.

A client won't offer a control the plugin hasn't declared. A device without a
schema still works (state flows, commands arrive), but it shows as a row of
raw JSON that nobody can operate. In one real house, before schemas were
taken seriously, 77 of 184 devices published no schema, including every
scene, fan and timer.

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

The schema is published retained on `homecore/devices/{id}/schema`, so it
survives the plugin being down. Republish it when the set of attributes
changes; a sensor that gains a reading gains an attribute.

### Typed registration writes the same slot

Registering with a `device_type` can also resolve a built-in schema for that
type, if the house has a `config/profiles/device-types.toml` (homeCore ships
an example at `config/profiles/examples/device-types.toml`, not loaded by
default). That catalog exists so a Tasmota or Shelly device with no plugin
behind it can name a type instead of writing a schema. The resolution runs on
every registration that carries a `device_type`, yours included, and stores
the result where your own schema goes. The two aren't merged; the last write
wins.

So publish your schema after the registration it belongs to, as the template
does. A plugin that registers again later (to refresh a device's name, say)
should publish its schema again with it.

### An attribute

| Field | What it is for |
|---|---|
| `kind` | `bool`, `integer`, `float`, `string`, `enum`, `color_xy`, `color_rgb`, `color_temp`, `json`. This picks the control. |
| `writable` | Whether a write reaches the device. A read-only attribute drawn as a slider misleads people until they drag it. |
| `display_name` | What a person reads. Without it, the attribute name is used. |
| `unit` | `%`, `°C`, `lux`, `W`. It must be true of the value; see [Names and units](#names-and-units). |
| `min` / `max` / `step` | The range the command path actually clamps to. |
| `options` | For `enum`: the values, each optionally with a label and an icon. Also [names the numbers](#name-your-numbers) of an integer. |
| `states` | For `bool`: what each of its two states is called. |
| `category` | `diagnostic` or `config`: what a reading is for, when it isn't what the device is for. |

### Both names of a boolean

A boolean attribute stands for two events. A client given only `open` offers
one row, and catching the door closing then needs a Not wrapped around the
trigger, a logic gate standing in for a word the device already has.

```rust
states: Some(BoolStates {
    when_true:  StateLabel::verbed("open", "opens"),
    when_false: StateLabel::verbed("closed", "closes"),
})
```

Each state has two forms because English won't derive one from the other:
`open` gives "opens", but `locked` gives "locks" and `motion` gives "detects
motion". A condition reads the adjective ("while the door is open"); a
trigger reads the verb ("when the door opens").

### Which readings are the point of the device

A door lock reports whether it is locked. It also reports battery, signal
strength and firmware. Showing all four the same way buries the one people
came for.

- `category: diagnostic` is health and identity: battery, RSSI, firmware, IP
  address, model, a `*_unit` sibling, anything `supports_*`.
- `category: config` is a setting that shapes behavior instead of reporting
  it.
- No category means a primary reading, the ordinary case.

`AttributeCategory::for_name` holds the shared list and fills in the common
names for you:

```rust
for (name, attr) in attributes.iter_mut() {
    if attr.category.is_none() {
        attr.category = AttributeCategory::for_name(name);
    }
}
```

Set it yourself for anything only your plugin can know. An ISY sensor's
`unit` is metadata about its `value`, and no shared list can tell that.

`DeviceSchema.primary` ranks the remaining readings, most important first.
You usually don't set it: homeCore works it out from the device's
`device_type` when it serves the schema, so a `temperature_sensor` leads with
`temperature`. Declare it only when you know better than the type does.

### Things a device does

An attribute write is `{"source": "Netflix"}`. An action is
`{"action": "launch_app", "app": "Netflix"}`. Both reach the plugin on the
same `cmd` topic:

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

Give every action a `sentence`. A client that can't phrase a payload shows
raw JSON in the rule list. `icon` is a name (`scene`, `remote`, `snowflake`)
that each client maps to its own icon set. An action can also declare its
params (`Param`), the attribute it writes (`writes`), a `confirm` prompt and
a `requires_role` (`device_actions::Role`).

Declare an action only if the command path really accepts it, and back that
with a test (see [Let the build check it](#let-the-build-check-it)). A
control that does nothing is worse than none.

### A device that takes pictures

A camera keeps its newest picture in the plugin's files folder
(`with_files_dir`) and names it in a `snapshot` attribute, a path there with
a new name each time. It takes a fresh one on a `take_snapshot` action. A
rule's Notify step can then send the picture (`picture_from`) with nothing
more to do. hc-reolink is the example.

### Publishing state without deleting your own work

`publish_state` replaces the retained document. `publish_state_partial`
merges into it.

If anything else publishes to the same device (a slow info refresher, a
second task, a facet merged into a main device), a full publish deletes what
the other one wrote, and the next refresh puts it back. One WLED controller
kept producing `device_state_changed` events listing sixteen attributes, in
both directions, forever: its light state was published whole on every
WebSocket push while sixteen hardware facts were merged in every five
minutes. Use a partial for anything that is one publisher's share of a
device.

Publish the whole state once, then partials. Publish `null` instead of
dropping a key you sometimes can't read.

### Never publish a value that changes by itself

An `uptime` counter turns every poll into a state change for a device that
did nothing. Two Rokus reporting that time had passed once made up 111 of the
last 200 events in a whole house. Leave such values out. A reboot already
shows up as availability dropping, and homeCore records `last_seen` for every
device. The same goes for an on-device clock and any field that ticks between
reads.

### An action that repairs must republish the declaration

Most plugins publish a device only the first time they see it, through
something like a `registry.ensure_*` that returns false for a device this
process has already seen. That suits a periodic loop and fails the button
someone presses when a device looks wrong: *Rescan devices* reads the bridge
again and republishes nothing.

homeCore can lose a schema while your plugin still believes it published
one. An unregister deletes the device and its schema, a restore from an older
backup predates it, and a typed registration can overwrite it. Five of
homeCore's own plugins had this bug. Each was fixed the same way: a pass
someone started forgets what it published, so it publishes everything again
once.

```rust
// Set by the manifest action, read by the pass that follows.
if force_republish {
    registry.forget_publications();
}
```

Don't republish on the periodic path. Each publish is cheap, but on a timer
it is one `device_schema_changed` event per device per tick. If your plugin
receives reports instead of polling, set a flag that the next report reads,
and say so in the action's description.

### Name your numbers

A number that is a choice (a preset, an effect, a scene slot) is shown by
name everywhere when its attribute has `options`:

```json
"preset_id": { "kind": "integer", "writable": true, "display_name": "Preset",
  "options": [{ "value": "14", "label": "Halloween 1" }, { "value": "16", "label": "Halloween Solid" }] }
```

Pickers offer "Halloween 1", triggers read `preset becomes "Halloween 1"`, and
you need no screen of your own. Options may differ per device and change over
time: build each device's schema with its own names and republish it when
they change, and only then. hc-wled's `schema_named` does this.

### Read and write the same name

The command path and the schema must agree, attribute by attribute:

| Published | Accepted | Result |
|---|---|---|
| `preset_id` | `preset` | A client reads the value, writes it back, nothing happens |
| `enabled` | `enable` | Same |
| `effect_id` | `effect` | Same |

All three shipped. If you must keep an old spelling for existing rules,
accept both and declare the one you publish.

### Names and units

Everything a device reports or accepts has one name, one meaning and one
unit. The table is `hc_types::device_vocabulary::TERMS` in the homeCore
repository; read it before naming an attribute.

- Use a name from the table when the idea matches, in its unit and range:
  `on`, `brightness_pct` (0 to 100, decimals allowed), `color_temp` (kelvin),
  `color_xy`, `color_rgb`, `transition_ms`, `position` (100 is open),
  `locked`, `open` (`true` is open), `motion`, `occupied`, `temperature`,
  `humidity`, `illuminance` (lux), `setpoint`, `heat_setpoint`,
  `cool_setpoint`, `hvac_mode`, `hvac_action`, `fan_mode`, `power_w`,
  `energy_kwh`, `battery_pct`, `volume`, `muted`, `media_title`,
  `media_position` and the rest of the table.
- Your own idea gets your own name, never one of these with a different
  meaning. A WLED preset is `preset_id`; a raw 0 to 255 level is not
  `brightness`.
- Convert at the edge. Publish in the table's unit and convert back when
  commanding the device. Temperatures are °C, rain mm, pressure hPa and wind
  m/s, whatever the device reports or the person prefers. Showing °F is the
  app's job, from each person's setting; a plugin has no unit setting. Write
  each conversion as a function with a test at each end of the scale: a
  dimmer's lowest step must not read as 0 % (off), and 100 % must reach the
  device's maximum (99 on Z-Wave, 254 on Zigbee and Matter, 255 on WLED). The
  template's `pct_from_level` and `level_from_pct` show how.
- Declare a temperature with `AttributeSchema::temperature()` (or
  `.celsius()` on a setpoint). `conformance::check_state_temperatures` fails
  one with no unit.
- A number names its unit as a suffix (`_pct`, `_ms`, `_secs`, `_w`, `_kwh`)
  unless it is a term whose unit the table sets (`temperature`, `humidity`,
  `volume`, `position` and so on). Fades are `_ms`.
- Commands have two shapes and no others: a write to a writable attribute,
  `{"on": true}`, or a declared action, `{"action": "start", …}`. Read
  `action`, never `command`.
- `{"on": true}` restores the last level where the device can. `0` % means
  off, and a light that is on never reports `0` %.

### Device type field

Register a `device_type` so clients can choose cards and controls, and keep
scenes out of device lists.

Publish what the device is, not the protocol you reach it over. For a long
time every Z-Wave node registered as `device_type: "zwave"`, so a lock, four
outlets, a door sensor and a motion sensor arrived looking the same.

Ask the bridge; it usually knows. zwave-js sends `deviceClass.generic` and
`.specific` on every node, and Hue, Lutron and Caséta each report a device
kind of their own. Where the bridge's answer is ambiguous, look at what the
device reports: Z-Wave calls both a door sensor and a motion sensor a
"Notification Sensor", but one publishes a contact and the other motion.

Say nothing instead of guessing. Leaving out `device_type` keeps whatever
homeCore already has, so a device that hasn't finished its interview can
register without a type and get one on the next registration. A rename
handler knows the new name and nothing else, so it should leave the type
out too.

Common values:

| `device_type` | Description |
|---|---|
| `light` | Dimmable or color light |
| `switch` | On/off switch or outlet |
| `sensor` | Temperature, humidity, door, motion and the like |
| `thermostat` | HVAC control |
| `lock` | Door lock |
| `cover` | Blinds, shade, garage door |
| `media_player` | Speaker, TV |
| `camera` | Camera |
| `scene` | Scene activator (kept out of device control lists) |
| `pico` | Button-only remote that reports button events |
| `timer` | Virtual countdown timer |

## Let the build check it

Most of the checklist below is `plugin_sdk_rs::conformance`, and a plugin that
breaks it fails `cargo test`:

```rust
#[cfg(test)]
mod conformance_tests {
    #[test]
    fn the_declaration_follows_the_rules() {
        plugin_sdk_rs::conformance::check_all(&device_schema(), &capabilities())
            .assert_ok();
    }

    /// The routed list is written by hand on purpose: it is the one thing
    /// the SDK can't see, because it lives inside your `match`.
    #[test]
    fn every_action_is_both_advertised_and_routed() {
        plugin_sdk_rs::conformance::check_actions_routed(&capabilities(), &["say_hello"])
            .assert_ok();
    }
}
```

`hc-plugin-template` ships with both, so a plugin copied from it starts out
passing. For a schema built as JSON (with `with_actions`, say),
`check_device_schema_json` applies the same rules.

What the checks catch, each of them a real bug in a shipped plugin:

| Check | What it catches |
| --- | --- |
| `check_device_schema` | a boolean naming one state or neither; an enum with no options; a dotted or non-snake_case name; housekeeping declared as a reading; `min` above `max`; an action with no sentence, or one that never names the device; an action claiming to write an attribute the schema doesn't declare |
| `check_manifest` | an action with no label, or no `timeout_ms` |
| `check_actions_routed` | an action advertised but not routed (a button that does nothing), and one routed but not advertised (a capability nobody can find) |
| `check_writables` | an attribute declared writable that your command path ignores |
| `check_temperatures`, `check_state_temperatures` | a temperature with no unit, or one not in °C |

`check_writables` takes your dispatcher as a closure, since only your plugin
knows what a payload does:

```rust
plugin_sdk_rs::conformance::check_writables(&device_schema(), |name| {
    !translate_command(&json!({ name: sample_value(name) })).is_empty()
})
.assert_ok();
```

## Before you release a plugin

Each of these has been a real bug in a shipped homeCore plugin. Items marked
✓ are checked by `conformance` above; you have to check the rest.

The device:

- [ ] Every device registers a `device_type`. A WLED controller had none for
      its whole life, so every client filtering by type skipped it.
- [ ] Every device publishes a schema, even the ones that seem too simple to
      need one. A scene that takes `activate` and reports nothing still
      declares that.

The attributes:

- [ ] Every attribute you publish is declared, under the name you publish.
- [ ] Every attribute you declare is one you publish or one the command path
      accepts.
- [ ] ✓ Every boolean has `states`, with both sides named.
- [ ] Every `unit` is true of the value. A 0 to 5 battery level declared `%`
      showed a healthy sensor as "2%".
- [ ] Shared ideas use the [shared names and units](#names-and-units),
      converted inside the plugin, with a test at each end of every
      conversion.
- [ ] Commands are read as an attribute write or `{"action": …}`, never
      `{"command": …}`.
- [ ] ✓ Every `min`/`max` is a valid range and matches what the command path
      clamps to.
- [ ] ✓ Housekeeping carries `category`; ask `AttributeCategory::for_name`
      before writing your own list.
- [ ] ✓ Names are `snake_case`, with no dots. A client humanizing `led.count`
      shows "Led.count".

The publishing:

- [ ] Your repair action republishes declarations, not only state.
- [ ] Partial publishes for anything that is one publisher's share of a
      device.
- [ ] No values that change by themselves: no uptime, no device clock.
- [ ] The schema is republished when the set of attributes changes.
- [ ] Availability is published, and set to offline when the device can't be
      reached.

The plugin:

- [ ] The event loop starts before anything is registered, and the plugin
      survives homeCore restarting.
- [ ] The config section is `#[serde(default)]` with a `Default` impl.
- [ ] `config_schema` and `config_descriptor` are both published, and the
      descriptor covers every schema field (`missing_schema_coverage`).
- [ ] Commands are subscribed as well as registered (Rust).
- [ ] Notices are cleared when their condition ends; alerts are current
      state, and news is `default_on: false`.
- [ ] Every action has a `timeout_ms`.
- [ ] The README says what it publishes, its commands, actions, alerts,
      settings and screens.

Its screens, if it has any:

- [ ] They use `host` for everything (not the app's own modules or API paths)
      and fall back cleanly; the app shows its generic screens when a
      plugin's won't load.
- [ ] Cards list the `forms` they support, use `hc-tile`, and look right at
      half a phone's width.
- [ ] Checked in light and dark, on a test homeCore, never the real house.
- [ ] `ui/` builds from a clean checkout (`npm ci && npm run build`) and
      writes `dist/manifest.json`.

The check that catches most of it is reading the device back from a running
homeCore. Every defect above is invisible in the source and obvious here:

```bash
curl -s "$CORE/api/v1/devices?include_schema=true" \
  | jq '.[] | select(.plugin_id=="plugin.mine")
        | {id: .device_id, type: .device_type,
           declared: (.schema.attributes // {} | keys),
           published: (.attributes | keys),
           primary: .schema.primary}'
```

Anything in `published` that isn't in `declared` is a value nobody can
operate. Anything in `declared` that never appears in `published` is a
control that does nothing.

## Plugin file layout

A Rust plugin is a directory under `plugins/` in the homeCore repository and
a workspace member:

```
plugins/hc-my-plugin/
├── Cargo.toml                  # [package] name = "hc-my-plugin"
├── config/
│   └── config.toml.example     # committed example, no secrets
├── src/
│   ├── main.rs                 # connect → manage → describe → run → register
│   └── config.rs               # the config structs, schema and descriptor
├── ui/                         # its own screens, if any
└── README.md
```

Add `"plugins/hc-my-plugin"` to `[workspace] members` in the repository's
`Cargo.toml`. That is the only registration step: CI, formatting, clippy and
tests already run over every member, and the release workflow works
everything else out from the directory name. Paths in the config are relative
to the config file's folder unless absolute.

In a real install you never place the config file yourself. homeCore writes
it at `config/plugins/<plugin_id>.toml`, passes the path to your process as
`argv[1]`, and restarts the plugin when someone changes it. The committed
`config.toml.example` is for running the binary by hand during development.

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

## Testing your plugin

`plugins/hc-plugin-template` publishes virtual lights and needs no hardware:

```bash
cp plugins/hc-plugin-template/config/config.toml.example \
   plugins/hc-plugin-template/config/config.toml
cargo run -p hc-plugin-template -- plugins/hc-plugin-template/config/config.toml
```

Run it against a homeCore whose broker is on `127.0.0.1:1883`, or point
`[homecore] broker_host` and `broker_port` elsewhere. Add more
`[[template.devices]]` entries to see how your plugin behaves with a
realistic number of devices; that is where the event-loop ordering problem
shows up.

Check that your plugin's devices appear:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.[] | select(.plugin_id == "plugin.my-device") | .name]'
```

Then write a rule that reacts to your device's state and check that it fires
in the event stream.

Test on a sandbox homeCore (its own `--home`, `--config` and broker port)
with small stand-ins for the real devices, never against a real house. Don't
run discovery from a sandbox, since it would find real devices. A sandbox can
run your plugin from a `[[plugins]]` entry pointing at
`target/debug/hc-<name>`, or install the release package with
`POST /api/v1/plugins/install {"path": "/abs/path/to/plugin.tar.zst"}`, which
proves the release layout.

## Distributing a plugin

Plugins ship as `.tar.zst` packages listed in the
[plugin registry](https://github.com/homeCore-io/registry): a `plugin.toml`
manifest plus the binary (and its built `ui/`), or for Python the plugin and
every dependency as wheels. The registry's `index.json` is signed with
ed25519, and each entry pins its package by SHA-256. The packages themselves
are not signed; the signed index is what vouches for them. homeCore installs
from **Settings › Plugins › Catalog**; see
[Installing a plugin](./overview#installing-a-plugin).

### Releasing a Rust plugin

A Rust plugin's id comes from its binary name: `hc-<name>` becomes
`plugin.<name>`, so `hc-my-plugin` is `plugin.my-plugin`. The id the plugin
uses on MQTT must match. In its `Cargo.toml`, `package.description` is the
line under its name in the Catalog, and `[package.metadata.homecore]` holds
`name` (as people see it) and `category` (Lighting, Climate, Media, Hubs,
Weather, Tools, or a new one), which the Catalog groups by.

Releasing takes one tag on the homeCore repository. Bump the version in your
plugin's `Cargo.toml` on `develop`, merge to `main`, wait for CI to pass, and
push `hc-my-plugin-v0.1.0`. The release workflow recognizes the
`hc-<name>-v<version>` shape and refuses a tag that doesn't match the
`Cargo.toml` version. It builds a static binary, builds `ui/` if it has a
`package.json`, packs the `.tar.zst`, attaches it to the GitHub Release and
notifies the registry. It then waits until the served index lists the new
version, so a green release means an installable plugin. A plain
`v<version>` tag releases the server instead. There is no per-plugin workflow
to copy and no SDK tag to push first.

### Releasing a Python plugin

A Python plugin ships as a self-contained package for a
[plugin runtime](./runtimes): the plugin, the SDK and every dependency as
wheels, which the runtime installs offline. Its `pyproject.toml` says what it
is:

```toml
[project]
name = "hc-mything"
version = "0.1.0"
description = "One line for its card in the Catalog"
dependencies = ["homecore-plugin-sdk>=0.5.6"]

[tool.uv.sources]
homecore-plugin-sdk = { git = "https://github.com/homeCore-io/hc-plugin-sdk-py", tag = "v0.5.6" }

[tool.homecore]
id = "plugin.mything"            # required
entrypoint = "hc_mything.plugin" # required: run as `python -m`, given the config path
name = "My Thing"                # the Catalog's display name; the id if left out
category = "Tools"               # the Catalog group
```

`homecore-plugin-sdk` must be in `dependencies`. The runtime installs only
what the plugin declares, and the build refuses a plugin that leaves it out.

The release is hc-scripts' shared `python-release.yml` workflow, called from
your repository's release workflow when you push a tag:

```yaml
jobs:
  release:
    uses: homeCore-io/hc-scripts/.github/workflows/python-release.yml@main
    with:
      plugin_dir: .
      sdk_ref: v0.5.6   # the SDK tag built into the package
    secrets: inherit
```

It builds a package for x86_64 and aarch64 on Python 3.12, installs it into a
clean environment and starts it against a broker before anything is
published, then attaches it to the GitHub Release and notifies the registry.
`sdk_ref` defaults to the SDK tag the workflow currently pins; set it to match
your `pyproject.toml`. [hc-mcp](https://github.com/homeCore-io/hc-mcp), the
Assistant, is the working example: its `pyproject.toml` and
`.github/workflows/release.yml` are a complete Python plugin release.

### Node.js and .NET plugins

Node.js and .NET plugins have no release path to the Catalog yet, and no
plugin runtime runs them. Run one as a `[[plugins]]` entry in `homecore.toml`
([Configuration](../getting-started/configuration#plugins)). homeCore starts
`binary` with the config file's path as its only argument and supervises it
like any other plugin, so point `binary` at something that runs the plugin by
itself: an entry script with a `#!/usr/bin/env node` line, marked executable,
or the program `dotnet publish` makes.

### Getting listed in the Catalog

Only the registry's maintainers can add a plugin to the official registry.
Its index is signed with a key only the registry's own workflows hold. An
entry is added by a release in a homeCore-io repository, or by a maintainer
running the registry's **Publish plugin to registry** workflow with the
package's URL and SHA-256 (and, if needed, `min_core`, the oldest homeCore
the version runs on). If you have written a plugin you'd like listed, publish
its package on a GitHub Release and open an issue or pull request on
[homeCore-io/registry](https://github.com/homeCore-io/registry/issues) with
the link.

Anyone can run a registry of their own: point `[registry] url` and
`public_key` at it.
