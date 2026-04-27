---
id: broker
title: MQTT Broker
sidebar_label: MQTT Broker
sidebar_position: 3
---

# MQTT Broker

HomeCore embeds a full MQTT broker ([rumqttd](https://github.com/bytebeamio/rumqtt)) — no separate Mosquitto or EMQX process needed. The broker starts automatically when HomeCore starts.

## Topic schema

All communication between HomeCore and plugins uses a canonical MQTT topic layout:

```
# Device state  (plugin → broker → HomeCore)
homecore/devices/{device_id}/state            retained=true, full state JSON
homecore/devices/{device_id}/state/partial    JSON merge-patch (high-frequency updates)

# Commands  (HomeCore → broker → plugin)
homecore/devices/{device_id}/cmd              {"action":"set","brightness":128}

# Availability  (plugin heartbeat, retained)
homecore/devices/{device_id}/availability     "online" | "offline"

# Device schema (plugin capability registration)
homecore/devices/{device_id}/schema           JSON Schema

# Plugin registration
homecore/plugins/{plugin_id}/register         capability payload

# Events (HomeCore → any subscriber)
homecore/events/{event_type}                  rule_fired, scene_activated, etc.

# System
homecore/system/status                        broker health (retained)
```

## Default configuration (no auth)

Without any `[[broker.clients]]` entries, the broker accepts any connection without credentials:

```toml
[broker]
host = "0.0.0.0"
port = 1883
```

Suitable for development and fully trusted networks.

## Password authentication

When one or more `[[broker.clients]]` entries are present, the broker requires credentials. Every connecting client must use `username = client_id` and the matching password.

```toml
[broker]
host = "0.0.0.0"
port = 1883

# Always required when auth is enabled
[[broker.clients]]
id       = "internal.core"
password = "a-strong-random-password"
allow_pub = ["homecore/#"]
allow_sub = ["homecore/#"]

[[broker.clients]]
id       = "plugin.hue"
password = "hue-plugin-password"
allow_pub = ["homecore/devices/hue_+/state", "homecore/plugins/hue/+"]
allow_sub = ["homecore/devices/hue_+/cmd"]

[[broker.clients]]
id       = "plugin.yolink"
password = "yolink-plugin-password"
allow_pub = ["homecore/devices/yolink_+/state", "homecore/plugins/yolink/+"]
allow_sub = ["homecore/devices/yolink_+/cmd"]
```

Then in each plugin's `config/config.toml`:

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.hue"
password    = "hue-plugin-password"
```

:::caution Topic ACL limitation
The embedded rumqttd 0.19 broker enforces **connection-level** credentials but does **not** enforce per-topic publish/subscribe ACL. A plugin that authenticates successfully can technically publish to any topic.

`allow_pub` / `allow_sub` fields serve as documentation and can be exported to generate external broker config. For strict topic isolation in production, use an external broker (Mosquitto, EMQX) and point HomeCore's MQTT client at it.

See [External Mosquitto deployment](#external-mosquitto-deployment) below for the full recipe.
:::

## External Mosquitto deployment

For deployments where topic isolation matters — containers, remote plugins, third-party code, or anything going through a security review — run HomeCore against an external Mosquitto broker. The `allow_pub` / `allow_sub` patterns you already have in `[[broker.clients]]` are converted to a Mosquitto ACL file that Mosquitto actually enforces.

### Generate the config

```bash
hc-cli broker generate-mosquitto-config \
  --config /etc/homecore/homecore.toml \
  --out-dir ./mosquitto-config
```

This produces three files in `mosquitto-config/`:

- `mosquitto.conf` — listener + references to ACL + passwd files.
- `aclfile` — generated from every `[[broker.clients]]` entry. Each client's `allow_pub` patterns become `topic write …` rules; `allow_sub` patterns become `topic read …`.
- `passwd.setup.sh` — helper script. Edit each `CHANGE_ME_<ID>` placeholder to the plaintext password from the matching `[[broker.clients]]` entry, then run the script inside an `eclipse-mosquitto` container to produce the hashed `passwd` file.

### Deploy

For a native systemd deployment (no Docker), follow the
[Systemd Deployment guide](./systemd-deployment) — it walks through
the same `hc-cli broker generate-mosquitto-config` flow end to end.

For Docker, the runnable example lives at `core/docker/docker-compose.external-broker.yml`:

```bash
docker compose -f docker-compose.external-broker.yml run --rm passwd-setup
docker compose -f docker-compose.external-broker.yml up -d
```

Then in your `homecore.toml` set:

```toml
[broker]
external_url = "mqtt://mosquitto:1883"
```

HomeCore will skip the embedded broker and connect to Mosquitto as any other client. Plugins connect using their existing `plugin_id` + `password` credentials — only the enforcement location changes.

See `mqttAuthzPlan.md` at the repo root for the full design plus rollout plan.

## TLS

Enable a TLS listener alongside the plain-text port:

```toml
[broker]
host      = "0.0.0.0"
port      = 1883        # plain-text (keep for local plugins on 127.0.0.1)
tls_port  = 8883        # TLS (for remote plugins or untrusted networks)
cert_path = "/etc/homecore/broker.crt"
key_path  = "/etc/homecore/broker.key"
```

If the certificate or key file is missing at startup, the TLS listener is skipped with a warning and only the plain-text port opens.

### Generate a self-signed certificate (development)

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout /etc/homecore/broker.key \
  -out    /etc/homecore/broker.crt \
  -days   3650 -nodes \
  -subj   "/CN=homecore-broker"
```

For a named host (clients can verify the hostname):

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout broker.key \
  -out    broker.crt \
  -days   365 -nodes \
  -subj   "/CN=homecore.local" \
  -addext "subjectAltName=DNS:homecore.local,IP:192.168.1.10"
```

### Production: Let's Encrypt

```bash
certbot certonly --standalone -d homecore.yourdomain.com
```

Then in config:

```toml
cert_path = "/etc/letsencrypt/live/homecore.yourdomain.com/fullchain.pem"
key_path  = "/etc/letsencrypt/live/homecore.yourdomain.com/privkey.pem"
```

## Combined auth + TLS example

```toml
[broker]
host      = "0.0.0.0"
port      = 1883
tls_port  = 8883
cert_path = "/etc/homecore/broker.crt"
key_path  = "/etc/homecore/broker.key"

[[broker.clients]]
id       = "internal.core"
password = "strong-internal-password"
allow_pub = ["homecore/#"]
allow_sub = ["homecore/#"]

[[broker.clients]]
id       = "plugin.zwave"
password = "zwave-secret"
allow_pub = ["homecore/devices/zwave_+/state", "homecore/plugins/zwave/+"]
allow_sub = ["homecore/devices/zwave_+/cmd"]
```

## Connecting with MQTT clients

Any standard MQTT client can connect to the embedded broker:

```bash
# Subscribe to all device state changes (mosquitto_sub)
mosquitto_sub -h localhost -p 1883 -t "homecore/devices/+/state" -v

# Publish a command
mosquitto_pub -h localhost -p 1883 \
  -t "homecore/devices/light.living_room/cmd" \
  -m '{"on":true,"brightness":200}'
```

## Retained messages

Device state is published with `retain=true`. New MQTT subscribers (including new HomeCore instances after restart) receive the last-known state for every device immediately upon subscribing, without waiting for the next update.

This means HomeCore's state bridge always has an up-to-date picture of all devices at startup, even if no plugins are actively publishing.
