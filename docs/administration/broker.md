---
id: broker
title: MQTT Broker
sidebar_label: MQTT Broker
sidebar_position: 3
---

# MQTT Broker

homeCore embeds a full MQTT broker ([rumqttd](https://github.com/bytebeamio/rumqtt))
that starts automatically with the server. For evaluation, homelab and
small deployments this is enough, with no separate broker process to
manage.

The embedded rumqttd authenticates connections but does **not** enforce
per-topic publish/subscribe ACLs. That is a limitation of rumqttd, not a
homeCore setting. Where per-topic enforcement matters (containers, remote
plugins, third-party code, or a security review), the alternative is an
external Mosquitto broker. `hc-cli broker generate-mosquitto-config`
converts your existing `[[broker.clients]]` entries into a Mosquitto ACL
file; see [External Mosquitto deployment](#external-mosquitto-deployment)
below, including its current limitation.

| Mode | Authn (CONNECT) | Authz (per-topic ACL) | When to use |
|---|---|---|---|
| Embedded `rumqttd` (default) | ✓ enforced | ✗ metadata only | Single host, trusted network, evaluation |
| External Mosquitto | ✓ enforced | ✓ enforced | Multi-host, third-party plugins, prod |

## Listeners

| Key | Default | Notes |
|---|---|---|
| `host` | `"0.0.0.0"` | Address every listener binds to. The shipped `homecore.toml` sets `"127.0.0.1"` |
| `port` | `1883` | MQTT v3.1.1, plain text. homeCore's own client connects here on `127.0.0.1` |
| `v5_port` | `1884` | A second, MQTT v5 listener for devices that need it (for example Shelly Plus/Pro). `0` turns it off |
| `tls_port` | unset | Optional TLS listener; needs `cert_path` and `key_path` |

## Topic schema

All communication between homeCore and plugins uses this MQTT topic
layout:

```
# Device state  (plugin → broker → HomeCore)
homecore/devices/{device_id}/state            retained=true, full state JSON
homecore/devices/{device_id}/state/partial    JSON merge-patch (high-frequency updates)

# Commands  (HomeCore → broker → plugin)
homecore/devices/{device_id}/cmd              {"brightness_pct":50} or {"action":"toggle"}

# Availability  (plugin heartbeat, retained)
homecore/devices/{device_id}/availability     "online" | "offline"

# Device schema (plugin capability registration)
homecore/devices/{device_id}/schema           JSON Schema

# Plugin registration
homecore/plugins/{plugin_id}/register         capability payload

# Events (HomeCore → any subscriber)
homecore/events/{event_type}                  rule_fired, scene_activated, etc.

# System (HomeCore → plugins, retained)
homecore/system/tz                            the house's IANA time zone
homecore/system/location                      the house's coordinates
```

Plugins also use further topics under `homecore/plugins/{plugin_id}/`
(status, heartbeat, logs, management commands); the plugin SDK handles
those.

## Without credentials (loopback only)

With no `[[broker.clients]]` entries, the broker accepts any connection
without credentials. homeCore only allows that when the broker is bound
to loopback:

```toml
[broker]
host = "127.0.0.1"
port = 1883
```

This is what the shipped config does. It suits a single host where core
and its plugins run on the same machine.

If `host` is a non-loopback address (including the default `0.0.0.0`)
and there are no `[[broker.clients]]` entries, homeCore **refuses to
start** and explains how to fix it. Either bind to `127.0.0.1` or add
credentials. If you have isolated the network some other way and accept
the risk, setting the environment variable
`HC_ALLOW_ANONYMOUS_REMOTE_BROKER=1` lets it start, with an error logged.

## Password authentication

When one or more `[[broker.clients]]` entries are present, the broker
requires credentials on every connection. Each client connects with
`username = client_id` and the matching password.

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

homeCore's own client connects as `internal.core`, so that entry is
required as soon as any client is listed. Passwords are written in
plaintext in `homecore.toml`; protect the file accordingly.

Then in each plugin's `config/config.toml`:

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.hue"
password    = "hue-plugin-password"
```

:::caution Topic ACL limitation
The embedded rumqttd broker (0.20) enforces **connection-level**
credentials but does **not** enforce per-topic publish/subscribe ACLs. A
plugin that authenticates can publish to any topic.

`allow_pub` and `allow_sub` document intent, and `hc-cli` can export them
to an external broker's config. For real topic isolation you need an
external broker; see the next section.
:::

## External Mosquitto deployment

Mosquitto enforces topic ACLs. The `allow_pub` / `allow_sub` patterns you
already have in `[[broker.clients]]` can be converted to a Mosquitto ACL
file.

:::warning homeCore cannot yet use an external broker
In homeCore 0.1.96, `homecore.toml` has no setting that points core at an
external broker. The `[broker] external_url` key mentioned by `hc-cli`
and the sample compose file is not read by the server: homeCore always
starts its embedded broker and connects its own client to `127.0.0.1`
on `[broker].port`. The steps below generate a working Mosquitto setup,
but core itself will not switch to it until that setting exists.
:::

### Generate the config

```bash
hc-cli broker generate-mosquitto-config \
  --config /etc/homecore/homecore.toml \
  --out-dir ./mosquitto-config
```

`--config` defaults to `config/homecore.toml` and `--out-dir` to
`mosquitto-config`. `--listener-port` (default 1883) sets the port written
into `mosquitto.conf`, and `--force` overwrites existing files.

This produces three files in `mosquitto-config/`:

- `mosquitto.conf`: a listener with anonymous access off, plus references
  to the ACL and password files.
- `aclfile`: generated from every `[[broker.clients]]` entry. Each
  client's `allow_pub` patterns become `topic write …` rules and its
  `allow_sub` patterns become `topic read …`. `internal.core` always gets
  `readwrite` on `homecore/#` and `$SYS/#`.
- `passwd.setup.sh`: a helper script. Replace each `CHANGE_ME_<ID>`
  placeholder with the plaintext password from the matching
  `[[broker.clients]]` entry, then run the script somewhere
  `mosquitto_passwd` is available (an `eclipse-mosquitto` container works)
  to produce the hashed `passwd` file.

### Deploy

For a native systemd setup (no Docker), the
[Systemd Deployment guide](./systemd-deployment) walks through the same
`hc-cli broker generate-mosquitto-config` flow end to end.

For Docker, the example lives at `core/docker/docker-compose.external-broker.yml`:

```bash
docker compose -f docker-compose.external-broker.yml run --rm passwd-setup
docker compose -f docker-compose.external-broker.yml up -d
```

The compose file and `hc-cli` then tell you to set:

```toml
[broker]
external_url = "mqtt://mosquitto:1883"
```

As the warning above says, the current server ignores this key. Plugins
would keep their existing `plugin_id` and `password` credentials; only
where they are checked would change.

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

`cert_path` and `key_path` are PEM files. Relative paths resolve against
homeCore's home directory. If either file is missing at startup, the TLS
listener is skipped with a warning and only the plain-text listeners
open.

### Generate a self-signed certificate (development)

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout /etc/homecore/broker.key \
  -out    /etc/homecore/broker.crt \
  -days   3650 -nodes \
  -subj   "/CN=homecore-broker"
```

For a named host (so clients can verify the hostname):

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

## Combined auth and TLS example

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

Any standard MQTT client can connect to the embedded broker. Add `-u` and
`-P` if you have configured `[[broker.clients]]`:

```bash
# Subscribe to all device state changes (mosquitto_sub)
mosquitto_sub -h localhost -p 1883 -t "homecore/devices/+/state" -v

# Publish a command
mosquitto_pub -h localhost -p 1883 \
  -t "homecore/devices/light.living_room/cmd" \
  -m '{"on":true,"brightness_pct":80}'
```

## Retained messages

Device state is published with `retain=true`. A new MQTT subscriber,
including homeCore itself after a restart, receives the last-known state
of every device as soon as it subscribes, without waiting for the next
update.

So homeCore's state bridge has a current picture of every device at
startup, even if no plugin is actively publishing.
