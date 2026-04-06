---
id: yolink
title: YoLink
sidebar_label: YoLink
sidebar_position: 5
---

# YoLink (`hc-yolink`)

The hc-yolink plugin bridges the YoLink cloud MQTT service to HomeCore. YoLink devices (door sensors, motion sensors, temperature sensors, outlets, etc.) are registered as HomeCore devices.

## Prerequisites

- A YoLink account and hub
- Your YoLink MQTT credentials (UAID and secret key — available in the YoLink app under Account settings)

## Configuration

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.yolink"
password    = ""

[yolink]
# MQTT credentials from YoLink app
uaid      = "your-uaid"
secret    = "your-secret-key"
mqtt_host = "mqtt.yosmart.com"
mqtt_port = 8003
```

## Running

```bash
cd /path/to/hc-yolink
./hc-yolink config/config.toml
```

The plugin connects to the YoLink cloud MQTT broker, discovers all devices associated with your account, and registers them with HomeCore.

## Device IDs

YoLink device IDs follow the pattern `yolink_{device_id}` where `device_id` is the YoLink-assigned device identifier (16 hex characters):

```
yolink_d88b4c01000e82eb    ← door sensor
yolink_a3f291b200045c12    ← temperature sensor
yolink_cc8102a3000b7e45    ← smart outlet
```

## Supported device types

| YoLink device | `device_type` | Key attributes |
|---|---|---|
| Door/window sensor | `door_sensor` | `open` (bool), `battery` (int) |
| Motion sensor | `motion_sensor` | `motion` (bool), `battery` (int) |
| Temperature/humidity | `sensor` | `temperature` (float), `humidity` (float), `battery` (int) |
| Smart outlet | `switch` | `on` (bool), `power_w` (float) |
| Leak sensor | `sensor` | `wet` (bool), `battery` (int) |
| Vibration sensor | `sensor` | `vibration` (bool), `battery` (int) |

## Common rule patterns

### Door open alert

```toml
name = "Front door — alert"
enabled = true

[trigger]
type      = "device_state_changed"
device_id = "yolink_d88b4c01000e82eb"
attribute = "open"
to        = true

[[actions]]
type    = "notify"
channel = "telegram"
message = "Front door opened"
```

### Low battery alert

```toml
name = "YoLink — low battery"
enabled = true
cooldown_secs = 86400   # alert once per day max

[trigger]
type      = "device_state_changed"
device_id = "yolink_d88b4c01000e82eb"
attribute = "battery"

[[conditions]]
type      = "device_state"
device_id = "yolink_d88b4c01000e82eb"
attribute = "battery"
op        = "Lt"
value     = 20

[[actions]]
type    = "notify"
channel = "telegram"
message = "YoLink front door sensor battery is low: {{device.battery}}%"
```

## SDK adoption

hc-yolink is built on the official Rust plugin SDK (`hc-plugin-sdk-rs`) and supports the full management protocol: heartbeat monitoring, remote configuration, and dynamic log level.

## Background initial state fetch

On startup, hc-yolink fetches the current state of all devices from the YoLink cloud API. This fetch runs as a non-blocking background task (`tokio::spawn`) so it does not delay plugin startup or MQTT subscription.

The fetch begins after `initial_fetch_delay_secs` (default: 10 seconds) to allow the MQTT connection to stabilize first:

```toml
[yolink]
initial_fetch_delay_secs = 10   # seconds before background getState begins
poll_interval            = 3600  # periodic refresh interval (seconds, default: 3600)
```

:::caution YoLink hub rate sensitivity
The YoLink hub is sensitive to burst API traffic. The background fetch spaces getState calls to avoid overwhelming the hub. If you have many devices, the initial fetch may take a minute or more to complete.
:::

The default `poll_interval` is 3600 seconds (1 hour). Shorter intervals increase API traffic and are generally unnecessary since real-time state updates arrive via the YoLink cloud MQTT stream.

---

## Device name sync

When a device is renamed in the YoLink app, the new name is synced to HomeCore at the next state update from that device. The update only takes effect after a confirmed state message — not immediately on registration. Restarting hc-yolink forces a full re-registration that syncs all names immediately.

## Troubleshooting

| Problem | Solution |
|---|---|
| Plugin fails to connect | Check UAID and secret in config; verify YoLink account credentials |
| Devices not appearing | Check that devices are online in the YoLink app and have been used recently |
| State not updating | YoLink cloud MQTT may have a delay; check YoLink app for offline sensors |
| `online`/`offline` flapping | Check device battery level and WiFi/LoRa range |

## Log rotation

hc-yolink writes logs to `logs/hc-yolink.log`. Rotation and compression are configured in `config/config.toml`:

```toml
[logging]
level       = "info"   # stderr log level; RUST_LOG overrides this
rotation    = "daily"  # daily | hourly | weekly | never
max_size_mb = 100      # rotate when file exceeds this MB (0 = time-only)
compress    = true     # gzip rotated files in a background thread
```

| File | Description |
|---|---|
| `logs/hc-yolink.log` | Active log (always uncompressed) |
| `logs/hc-yolink.2026-03-27.log.gz` | Rotated daily file (compressed) |
| `logs/hc-yolink.2026-03-27.1.log.gz` | Second rotation in same period (size limit hit) |
