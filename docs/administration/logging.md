---
id: logging
title: Logging
sidebar_label: Logging
sidebar_position: 2
---

# Logging

homeCore logs with `tracing`. It can write to stderr, a rolling file, a
separate rules file and remote syslog at the same time, each in its own
format, and it keeps recent lines in memory for the live log.

## Outputs at a glance

| Output | Default | Best for |
|---|---|---|
| stderr | on, pretty format | Development, the systemd journal, Docker logs |
| file | on, JSON, in `logs/` under homeCore's home | Looking back after a problem, log aggregators |
| rules file | off | Following what the rule engine did, without other noise |
| syslog | off | Central collection (Graylog, Loki, rsyslog) |

:::note File logging defaults
With no `[logging.file]` table in `homecore.toml`, file logging is on, in
JSON. If you add a `[logging.file]` table, set `enabled = true` yourself:
inside a table, `enabled` defaults to `false` and `format` to `"pretty"`.
:::

## In the web app

**Settings › Logs** shows the live log from homeCore and its plugins, with
a filter by source and level. **Settings › System** has "How much homeCore
writes to its log", with presets, **Custom** for a filter string, and
**Keep it after a restart**, which also writes the level to
`homecore.toml`. Each plugin's page shows that plugin's own log and lets an
admin change its log level.

## Quick level override

The `RUST_LOG` environment variable is the quickest way to change
verbosity. homeCore applies it after the config, so it wins for stderr and
the log file. Syslog keeps its own level.

```bash
# Default: info from every crate
cargo run -p homecore

# Debug from the rule engine only
RUST_LOG=info,hc_core=debug cargo run -p homecore

# Debug from the rule engine and the MQTT client
RUST_LOG=info,hc_core=debug,hc_mqtt_client=debug cargo run -p homecore

# The rule evaluation loop and the action executor
RUST_LOG=info,hc_core::engine=debug,hc_core::executor=debug cargo run -p homecore

# Everything, broker internals included (very noisy)
RUST_LOG=trace cargo run -p homecore

# Errors only
RUST_LOG=error cargo run -p homecore
```

For a service, set it in the unit (`Environment="RUST_LOG=…"`) or in the
container's environment.

## Configuration reference

Everything below lives under `[logging]` in `homecore.toml`.

### `[logging]`: global defaults

```toml
[logging]
# error | warn | info | debug | trace
level = "info"

# "local": local time with UTC offset (default)
# "utc":   UTC with a Z suffix
time_display = "local"
```

`time_display` applies to stderr, the log files and syslog timestamps.

### `[logging.targets]`: per-crate overrides

```toml
[logging.targets]
hc_core        = "debug"   # rule engine, scheduler, state bridge, action executor
hc_api         = "info"    # HTTP/WebSocket handlers
hc_auth        = "warn"    # JWT, password hashing
hc_state       = "info"    # device registry, history
hc_mqtt_client = "debug"   # MQTT connection, topic routing
hc_broker      = "warn"    # embedded broker (noisy at debug)
hc_topic_map   = "debug"   # ecosystem profile matching
hc_notify      = "info"    # notification channels
hc_scripting   = "warn"    # Rhai script execution
```

Keys are Rust target names, so hyphens in crate names become underscores.
Modules work too:

```toml
[logging.targets]
"hc_core::engine"       = "debug"   # rule evaluation loop only
"hc_core::executor"     = "debug"   # action execution only
"hc_core::state_bridge" = "debug"   # MQTT to event bus state bridge only
```

### `[logging.stderr]`: console output

```toml
[logging.stderr]
enabled = true
format  = "pretty"   # "pretty" | "compact" | "json"
ansi    = true       # set false for the systemd journal or Docker
```

If every output is off, homeCore falls back to plain stderr so logs always
go somewhere.

### `[logging.file]`: rolling log file

```toml
[logging.file]
enabled          = true
dir              = "logs"         # created if missing
prefix           = "homecore"
rotation         = "daily"        # "daily" | "hourly" | "weekly" | "never"
max_size_mb      = 100            # also rotate at this size (0 = time only)
compress         = true           # gzip rotated files right after rotation
prune_after_days = 5              # delete rotated logs older than this (0 = never)
format           = "json"         # "json" | "compact" | "pretty"
```

`dir` defaults to `logs` under homeCore's home, and a relative path
resolves against the home directory. `max_size_mb` defaults to 100,
`compress` to `true` and `prune_after_days` to 0 (never prune).

The active file is always `<prefix>.log` and is never compressed. Rotated
files are named like this:

- Daily: `homecore.2026-03-27.log.gz`
- Hourly: `homecore.2026-03-27_14.log.gz`

### `[logging.rules_file]`: rule engine log

A separate file that gets only `hc_core` output (the rule engine, action
executor and scheduler) at debug, whatever the global level. It records
trigger evaluations, condition checks and actions without broker, API and
state messages mixed in.

```toml
[logging.rules_file]
enabled          = true
dir              = "logs"       # defaults to the [logging.file] dir
prefix           = "rules"      # active: rules.log; rotated: rules.YYYY-MM-DD.log
rotation         = "daily"
max_size_mb      = 100
compress         = true
prune_after_days = 5
format           = "pretty"     # "json" for log aggregators
```

It is off by default, and its `format` defaults to `"pretty"`.

### `[logging.syslog]`: remote syslog

```toml
[logging.syslog]
enabled   = false
transport = "udp"       # "udp" | "tcp"
host      = "192.168.1.100"
port      = 514
protocol  = "rfc5424"   # "rfc5424" | "rfc3164"
facility  = "daemon"
app_name  = "homecore"
level     = "warn"      # optional; defaults to [logging].level
```

Defaults for keys you leave out: `transport = "udp"`,
`host = "127.0.0.1"`, `port = 514`, `protocol = "rfc5424"`,
`facility = "user"`, `app_name = "homecore"`.

### `[logging.stream]`: buffer for the live log

```toml
[logging.stream]
enabled          = true
ring_buffer_size = 500   # recent lines kept for new subscribers
```

With `enabled = false`, `GET /logs` and `/logs/stream` return 503.

## Common recipes

### Development: verbose rule engine, quiet broker

```toml
[logging]
level = "info"
time_display = "local"

[logging.targets]
hc_core        = "debug"
hc_mqtt_client = "debug"
hc_broker      = "warn"

[logging.stderr]
enabled = true
format  = "pretty"
ansi    = true
```

### Production: JSON file plus remote warnings

```toml
[logging]
level = "info"

[logging.stderr]
enabled = false   # no console when running as a service

[logging.file]
enabled          = true
dir              = "/var/log/homecore"
rotation         = "daily"
format           = "json"
compress         = true
prune_after_days = 7

[logging.syslog]
enabled   = true
transport = "udp"
host      = "192.168.1.50"
port      = 514
level     = "warn"   # only warnings and above go to the remote server
```

### systemd journal

```toml
[logging.stderr]
enabled = true
format  = "compact"
ansi    = false   # no color codes in the journal
```

### Grafana Loki or Graylog from the file

```toml
[logging.file]
enabled  = true
dir      = "/var/log/homecore"
format   = "json"    # the parser needs structured fields
rotation = "hourly"
```

## Log targets

| Crate | Target name | What it covers |
|---|---|---|
| `hc-core` | `hc_core` | Rule engine, scheduler, state bridge, executor, helpers, modes, alerts |
| `hc-api` | `hc_api` | HTTP handlers, WebSocket streams, auth middleware |
| `hc-auth` | `hc_auth` | JWT issuing and checking, password hashing |
| `hc-state` | `hc_state` | Device registry (redb), history (SQLite), audit store |
| `hc-mqtt-client` | `hc_mqtt_client` | MQTT connection, subscriptions, topic routing |
| `hc-broker` | `hc_broker` | Embedded rumqttd broker |
| `hc-topic-map` | `hc_topic_map` | Ecosystem profile matching, payload transforms |
| `hc-notify` | `hc_notify` | Email, Pushover and Telegram channels |
| `hc-scripting` | `hc_scripting` | Rhai script execution |

## Changing the level while running

You can change the server's log filter without a restart. `level` is a
full filter string in `RUST_LOG` syntax, and it replaces the current one.
Setting it needs `plugins:write`, which only `admin` carries. Reading it
needs any sign-in.

```bash
# Debug for the rule engine, info for everything else
curl -s -X PUT http://localhost:8080/api/v1/system/log-level \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"level":"info,hc_core=debug"}'

# Read the current filter
curl -s http://localhost:8080/api/v1/system/log-level \
  -H "Authorization: Bearer $TOKEN" | jq
```

The response is `{"level": "..."}`, or `{"ok": true, "level": "..."}`
after a change. An invalid filter returns 400. Changes are recorded in the
audit log as `system.log_level_changed`.

The change lasts until homeCore restarts. It is a gate in front of every
output: raising it to `debug` puts debug lines in the live log, while
stderr, the log file and syslog still apply their own configured levels.
To get debug lines into those, change `[logging]` or set `RUST_LOG` and
restart. **Keep it after a restart** in the app does the `[logging]` part
for you.

### A plugin's log level

```bash
curl -s -X PATCH http://localhost:8080/api/v1/plugins/plugin.hue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"log_level":"debug"}'
```

This needs `plugins:write`. homeCore sends the level to the running plugin
at once and writes it to `[logging] level` in the plugin's own config file,
so it holds after a restart. A plugin in a runtime keeps its config file
there, so for those only the running plugin changes. The change is
recorded as `plugin.log_level_changed`.

## Reading logs over the API

Both endpoints are for admins: a person with the `admin` role, or an API
key that carries `users:write`. They read the same in-memory buffer
(`[logging.stream].ring_buffer_size`, default 500 lines), which also holds
lines forwarded by plugins.

### Live stream (WebSocket)

```bash
# Everything at info and above
websocat "ws://localhost:8080/api/v1/logs/stream?token=$TOKEN"

# Warnings and above
websocat "ws://localhost:8080/api/v1/logs/stream?token=$TOKEN&level=warn"

# One module
websocat "ws://localhost:8080/api/v1/logs/stream?token=$TOKEN&target=hc_core"
```

| Parameter | Description |
|---|---|
| `token` | JWT or API key (required) |
| `level` | Minimum level, default `info` |
| `target` | Only lines whose target starts with this |
| `plugin_id` | Only lines forwarded by this plugin, including its SDK and libraries |
| `history` | Buffered lines to send first, default 50, maximum 500 |
| `client_id` | Optional label shown in the connection list |

The stream sends the buffered lines first, then new ones as they happen.
`GET /api/v1/ws/connections` (admin) lists every open event and log
stream.

### Recent lines (REST)

`GET /api/v1/logs` returns the same buffer as JSON, oldest first, for
scripts and `curl | jq`:

```bash
curl -s "http://localhost:8080/api/v1/logs?level=warn&limit=200" \
  -H "Authorization: Bearer $TOKEN" | jq '.lines[]'
```

It takes `level`, `target` and `plugin_id` like the stream, plus `since`
(an RFC3339 time, for polling) and `limit` (default 100, maximum 1000).
The response is `{"count": N, "lines": [...]}`.

## Plugin logging

Each plugin writes and rotates its own log file, apart from the homeCore
server. Rust plugins share one `[logging]` schema from the plugin SDK, set
in the plugin's own config file:

```toml
[logging]
level             = "info"   # stderr level; RUST_LOG overrides it
rotation          = "daily"  # daily | hourly | weekly | never
max_size_mb       = 100      # also rotate at this size (0 = time only)
compress          = true     # gzip rotated files in a background thread
prune_after_days  = 5        # delete rotated logs older than this (0 = never)
log_forward_level = "info"   # lowest level forwarded to core over MQTT
```

| Option | Default | Description |
|---|---|---|
| `level` | `"info"` | Stderr level when `RUST_LOG` isn't set. Takes any tracing filter, such as `"debug"` or `"hc_hue=debug,rumqttc=warn"` |
| `rotation` | `"daily"` | Time-based rotation: `daily`, `hourly`, `weekly` or `never` |
| `max_size_mb` | `100` | Size-based rotation, whichever of size and time comes first. `0` turns size rotation off |
| `compress` | `true` | Gzip rotated files right after rotation. The active file is never compressed |
| `prune_after_days` | `0` | Delete rotated `.log` and `.log.gz` files older than this many days, at startup and after each rotation. `0` never deletes |
| `log_forward_level` | `"info"` | Lowest level forwarded to homeCore. Forwarded lines appear in the app's logs and in `/api/v1/logs/stream`. `"off"` stops forwarding |

The Python, Node.js and .NET SDKs have their own logging setup. They also
forward lines to homeCore.

### Forwarding over MQTT

Plugins forward their log lines to homeCore over MQTT with QoS 0, so
forwarding never holds up the plugin.

Topic: `homecore/plugins/{plugin_id}/logs`

The payload has the same shape as core's own log lines:

```json
{
  "timestamp": "2026-04-07T12:00:00Z",
  "level": "INFO",
  "target": "hc_yolink::bridge",
  "message": "Device registered",
  "fields": {"device_id": "yolink_front_door"}
}
```

homeCore adds these to the same buffer as its own lines, so they appear
in `/api/v1/logs`, `/api/v1/logs/stream` and the app.

Plugin log files are named like the server's:

| File | Description |
|---|---|
| `logs/hc-{plugin}.log` | Active log, never compressed |
| `logs/hc-{plugin}.2026-03-27.log.gz` | Rotated daily file |
| `logs/hc-{plugin}.2026-03-27_14.log.gz` | Rotated hourly file |
| `logs/hc-{plugin}.2026-03-27.1.log.gz` | Second size-triggered rotation in the same period |

A plugin config with no `[logging]` section gets the defaults in the
table above.
