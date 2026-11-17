---
id: broker
title: MQTT Broker
sidebar_label: MQTT Broker
sidebar_position: 3
---

# MQTT Broker

homeCore embeds an MQTT broker ([rumqttd](https://github.com/bytebeamio/rumqtt))
that starts with the server. For a single host or a homelab it is all you
need, with no separate broker to run.

The embedded broker checks logins but does not enforce per-topic publish
and subscribe rules. That is a limit of rumqttd. When topic rules matter
(containers, remote plugins, third-party code, a security review), run an
external Mosquitto and point homeCore at it with `[broker] external_url`.
`hc-cli broker generate-mosquitto-config` turns your `[[broker.clients]]`
entries into a Mosquitto ACL file; see
[External Mosquitto deployment](#external-mosquitto-deployment) below.

| Mode | Login checked | Topic rules enforced | When to use |
|---|---|---|---|
| Embedded rumqttd (default) | yes | no | One host, trusted network |
| External Mosquitto | yes | yes | Several hosts, third-party plugins, production |

## Listeners

| Key | Default | Notes |
|---|---|---|
| `host` | `"0.0.0.0"` | Address every listener binds to. The shipped `homecore.toml` sets `"127.0.0.1"` |
| `port` | `1883` | MQTT v3.1.1, plain text. homeCore's own client connects here on `127.0.0.1` |
| `v5_port` | `1884` | A second listener for MQTT v5 devices, such as Shelly Plus and Pro. `0` turns it off |
| `tls_port` | unset | Optional TLS listener. Needs `cert_path` and `key_path` |

None of these open when `external_url` is set, because the embedded broker
doesn't start.

## Topics

homeCore and its plugins use this layout:

```
# Device state (plugin to homeCore)
homecore/devices/{device_id}/state            retained, full state JSON
homecore/devices/{device_id}/state/partial    JSON merge patch (frequent updates)

# Commands (homeCore to plugin)
homecore/devices/{device_id}/cmd              {"brightness_pct":50} or {"action":"toggle"}

# Availability (retained)
homecore/devices/{device_id}/availability     "online" | "offline"

# Device schema and device alerts
homecore/devices/{device_id}/schema           JSON Schema
homecore/devices/{device_id}/alerts

# Plugin registration
homecore/plugins/{plugin_id}/register         capability payload

# Events (homeCore to any subscriber)
homecore/events/{event_type}                  rule_fired, scene_activated, ...

# System (homeCore to plugins, retained)
homecore/system/tz                            the house's IANA time zone
homecore/system/location                      the house's coordinates
```

Plugins also use more topics under `homecore/plugins/{plugin_id}/`,
including `status`, `heartbeat`, `logs`, `capabilities`, `alerts`,
`manage/cmd`, `manage/response` and `commands/{request_id}/events`. The
plugin SDKs handle those. `{plugin_id}` is the full id, such as
`plugin.hue`.

## Without credentials (loopback only)

With no `[[broker.clients]]` entries, the broker accepts any connection
with no login. homeCore allows that only when the broker listens on
loopback:

```toml
[broker]
host = "127.0.0.1"
port = 1883
```

The shipped config does this. It suits one machine running homeCore and
its plugins.

If `host` is anything else (including the default `0.0.0.0`) and there
are no `[[broker.clients]]` entries, homeCore refuses to start and says
how to fix it: bind to `127.0.0.1` or add credentials. If you have
isolated the network some other way and accept the risk, the environment
variable `HC_ALLOW_ANONYMOUS_REMOTE_BROKER=1` lets it start, with an error
in the log.

## Opening the broker to the network

A [plugin runtime](../plugins/runtimes) in a container or on another
computer has to reach the broker. When the broker only listens on
loopback, **Settings › Plugins › Plugin runtimes** says "Runtimes can't
reach the broker yet" and offers **Open the broker to the network**.
Confirming it (**Open and restart**):

- sets `[broker] host = "0.0.0.0"` in `homecore.toml`, keeping its
  comments;
- adds an `internal.core` entry to `[[broker.clients]]` with a random
  password, if there are no client entries yet;
- restarts homeCore, after which every connection needs a login.

It needs `plugins:write`, is recorded as `broker.opened_to_network`, and
works only when homeCore was started with `--config`. Otherwise, set the
same two things by hand and restart. The API versions are
`GET /api/v1/plugin-runtimes/broker` (where the broker listens and whether
the network can reach it) and `POST /api/v1/plugin-runtimes/broker/open`.

## Logins

When `[[broker.clients]]` has one or more entries, the broker asks every
connection for a username and password. It accepts:

1. any `[[broker.clients]]` entry, with `id` as the username;
2. a plugin listed in `[[plugins]]`, or installed or placed by homeCore,
   using the `plugin_id` and `password` from the `[homecore]` table of its
   own config file;
3. a plugin runtime, with the key homeCore made when the runtime was
   added.

Logins 2 and 3 are checked against homeCore's current state. A plugin's
login works as soon as it is installed and stops when it is removed, and
you don't need a `[[broker.clients]]` entry for each plugin. Add one only
for clients homeCore doesn't know about, such as a device, a script, or a
plugin you start yourself.

```toml
[broker]
host = "0.0.0.0"
port = 1883

# Required as soon as any client is listed: homeCore's own login
[[broker.clients]]
id       = "internal.core"
password = "a-strong-random-password"
allow_pub = ["homecore/#"]
allow_sub = ["homecore/#"]

# A client homeCore doesn't start, such as a script
[[broker.clients]]
id       = "script.energy"
password = "another-strong-password"
allow_pub = ["homecore/devices/energy_+/state"]
allow_sub = ["homecore/devices/energy_+/cmd"]
```

homeCore's own client connects as `internal.core`, so that entry is
required once any client is listed. The passwords sit in plaintext in
`homecore.toml`, so protect the file.

A plugin's own config carries its login:

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.hue"
password    = "hue-plugin-password"
```

homeCore writes this table, with a random password, when it installs a
plugin.

:::caution Topic rules aren't enforced by the embedded broker
The embedded rumqttd (0.20) checks logins but not per-topic publish and
subscribe rules. A client that logs in can publish to any topic.

`allow_pub` and `allow_sub` record intent, and `hc-cli` exports them to an
external broker's ACL. For real topic isolation you need an external
broker; see the next section.
:::


## External Mosquitto deployment

Mosquitto enforces topic rules. The `allow_pub` and `allow_sub` patterns
in `[[broker.clients]]` convert to a Mosquitto ACL file.

To run homeCore against an external broker (Mosquitto or EMQX), set
`external_url`, in `homecore.toml` or on **Settings › Configuration**:

```toml
[broker]
external_url = "mqtt://192.168.1.20:1883"

[[broker.clients]]
id       = "internal.core"
password = "a-strong-random-password"
allow_pub = ["homecore/#"]
allow_sub = ["homecore/#"]
```

When `external_url` is set:

- The embedded broker doesn't start, so `host`, `port`, `v5_port` and the
  TLS settings are unused.
- homeCore's own client logs in to that address as `internal.core`, with
  the password from that entry. Without the entry it connects with no
  login, which a Mosquitto with anonymous access off refuses.
- Plugins homeCore installs after the change get that address in their
  settings.
- Plugins already installed keep the `broker_host` and `broker_port` in
  their own config. Point each one at the external broker. Their
  `plugin_id` and `password` stay the same.
- Mosquitto knows only what is in its password and ACL files. Every
  plugin and runtime needs a `[[broker.clients]]` entry with the same
  password as its own config, so `hc-cli` can write it into those files.

The port defaults to 1883 when the URL leaves it out. `tcp://host:port`
and a bare `host:port` work too. homeCore refuses to start with
`mqtts://` or `ssl://`, because its own MQTT client has no TLS. Use
`mqtt://` on a trusted network, or a TLS proxy on the same host.

`external_url` needs v0.1.97 or later. Earlier versions ignored it,
always started the embedded broker, and connected to `127.0.0.1`.

### Generate the Mosquitto files

```bash
hc-cli broker generate-mosquitto-config \
  --config /etc/homecore/homecore.toml \
  --out-dir ./mosquitto-config
```

`--config` defaults to `config/homecore.toml` and `--out-dir` to
`mosquitto-config`. `--listener-port` (default 1883) sets the port in
`mosquitto.conf`, and `--force` overwrites existing files.

It writes three files:

- `mosquitto.conf`: a listener with anonymous access off, pointing at the
  ACL and password files under `/mosquitto/config/`.
- `aclfile`: one block per `[[broker.clients]]` entry. `allow_pub`
  patterns become `topic write …` and `allow_sub` patterns become
  `topic read …`. `internal.core` always gets `readwrite` on
  `homecore/#` and `$SYS/#`.
- `passwd.setup.sh`: a helper script. Replace each `CHANGE_ME_<ID>`
  placeholder with the plaintext password from the matching entry, then
  run it where `mosquitto_passwd` is available (an `eclipse-mosquitto`
  container works) to produce the hashed `passwd` file.

Plugins publish under `homecore/plugins/{plugin_id}/` at more than one
level, so give each plugin `homecore/plugins/plugin.<name>/#` in both
lists, plus its device topics.

### Deploy

For a native systemd setup, the
[Systemd Deployment guide](./systemd-deployment) walks through the whole
flow.

With Docker, the core repository has an example at
`core/docker/docker-compose.external-broker.yml`:

```bash
docker compose -f docker-compose.external-broker.yml run --rm passwd-setup
docker compose -f docker-compose.external-broker.yml up -d
```

There the broker is the `mosquitto` service:

```toml
[broker]
external_url = "mqtt://mosquitto:1883"
```

Keep the `internal.core` entry: homeCore logs in to Mosquitto with it,
and `hc-cli` builds the ACL and password files from the same entries.

A plugin installed from the Catalog gets a new password in
`config/plugins/<plugin_id>.toml`. Add a `[[broker.clients]]` entry with
that password and regenerate the Mosquitto files, or Mosquitto refuses
the plugin.

## TLS

Add a TLS listener next to the plain-text port:

```toml
[broker]
host      = "0.0.0.0"
port      = 1883        # plain text, for local plugins on 127.0.0.1
tls_port  = 8883        # TLS, for remote plugins or untrusted networks
cert_path = "/etc/homecore/broker.crt"
key_path  = "/etc/homecore/broker.key"
```

`cert_path` and `key_path` are PEM files. Relative paths resolve against
homeCore's home. If either file is missing at startup, homeCore skips the
TLS listener with a warning and opens only the plain-text listeners.

### Self-signed certificate (development)

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout /etc/homecore/broker.key \
  -out    /etc/homecore/broker.crt \
  -days   3650 -nodes \
  -subj   "/CN=homecore-broker"
```

With the address clients will use, so they can verify it:

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout broker.key \
  -out    broker.crt \
  -days   365 -nodes \
  -subj   "/CN=homecore.example.com" \
  -addext "subjectAltName=DNS:homecore.example.com,IP:192.168.1.10"
```

### Let's Encrypt

```bash
certbot certonly --standalone -d homecore.example.com
```

Then:

```toml
cert_path = "/etc/letsencrypt/live/homecore.example.com/fullchain.pem"
key_path  = "/etc/letsencrypt/live/homecore.example.com/privkey.pem"
```

## Logins and TLS together

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
```

## Connecting with MQTT clients

Any MQTT client can connect. Add `-u` and `-P` once the broker asks for
logins:

```bash
# Watch every device's state
mosquitto_sub -h localhost -p 1883 -t "homecore/devices/+/state" -v

# Send a command
mosquitto_pub -h localhost -p 1883 \
  -t "homecore/devices/light.living_room/cmd" \
  -m '{"on":true,"brightness_pct":80}'
```

## Retained messages

Device state and availability are published retained. A new subscriber,
including homeCore after a restart, gets the last known state of every
device as soon as it subscribes, so homeCore has a current picture of the
house at startup even before plugins publish again.
