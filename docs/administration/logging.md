---
id: logging
title: Logging
sidebar_label: Logging
sidebar_position: 2
---

# Logging

homeCore uses `tracing` for structured logging. It can write to stderr, a
rolling file, a separate rules file, and remote syslog at the same time,
each with its own format, and it keeps recent lines in memory for the live
log stream.

## Outputs at a glance

| Output | Default | Best for |
|---|---|---|
| **stderr** | enabled, pretty format | Development, systemd journal, Docker logs |
| **file** | enabled in the shipped config, JSON, in `logs/` under homeCore's home | Post-mortem analysis, log aggregators |
| **rules file** | disabled | Following what the rule engine did, without other noise |
| **syslog** | disabled | Central aggregation (Graylog, Loki, rsyslog) |

:::note File logging defaults
If `homecore.toml` has no `[logging.file]` table at all, file logging is
on, in JSON. If you add a `[logging.file]` table, set `enabled = true`
explicitly: inside a table, `enabled` defaults to `false` and `format` to
`"pretty"`.
:::

## Quick level override

The quickest way to change log verbosity is the `RUST_LOG` environment
variable. Its directives are applied after the config, so they win for
stderr and the log file (syslog uses its own level):

```bash
# Default — info from all crates
cargo run -p homecore

# Debug from the rule engine only
RUST_LOG=info,hc_core=debug cargo run -p homecore

# Debug from rule engine + MQTT client
RUST_LOG=info,hc_core=debug,hc_mqtt_client=debug cargo run -p homecore

# Deep dive — rule evaluation loop + action executor
RUST_LOG=info,hc_core::engine=debug,hc_core::executor=debug cargo run -p homecore

# Everything (very noisy — broker internals included)
RUST_LOG=trace cargo run -p homecore

# Silence all but errors
RUST_LOG=error cargo run -p homecore
```

## Configuration reference

All settings live under `[logging]` in `config/homecore.toml`.

### `[logging]`: global defaults

```toml
[logging]
# Global default level for all crates
# error | warn | info | debug | trace
level = "info"

# Timestamp timezone
# "local" — local system time with UTC offset (default)
# "utc"   — UTC with Z suffix
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
Sub-module granularity works too:

```toml
[logging.targets]
"hc_core::engine"   = "debug"   # rule evaluation loop only
"hc_core::executor" = "debug"   # action execution only
"hc_core::bridge"   = "debug"   # MQTT→EventBus state bridge only
```

### `[logging.stderr]`: console output

```toml
[logging.stderr]
enabled = true
format  = "pretty"   # "pretty" | "compact" | "json"
ansi    = true       # set false for systemd journal / Docker
```

If every output is disabled, homeCore falls back to plain stderr so there
is always somewhere for logs to go.

### `[logging.file]`: rolling log file

```toml
[logging.file]
enabled          = false
dir              = "logs"         # created automatically
prefix           = "homecore"
rotation         = "daily"        # "daily" | "hourly" | "weekly" | "never"
max_size_mb      = 100            # rotate when file exceeds this (0 = size-only rotation off)
compress         = true           # gzip rotated files immediately after rotation
prune_after_days = 5              # delete rotated logs older than N days (0 = never prune)
format           = "json"         # "json" | "compact" | "pretty"
```

`dir` defaults to `logs` under homeCore's home; a relative path resolves
against the home directory. `max_size_mb` defaults to 100, `compress` to
`true` and `prune_after_days` to 0 (never prune).

The active file is always `<prefix>.log` and is never compressed. Rotated
files are named like this:

- Daily: `homecore.2026-03-27.log.gz`
- Hourly: `homecore.2026-03-27_14.log.gz`

### `[logging.rules_file]`: rule engine log

A separate file that receives only `hc_core` output (the rule engine,
action executor and scheduler), filtered at `hc_core=debug`. It gives you
a record of trigger evaluations, condition checks and actions without the
broker, API and state messages mixed in.

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

It is off by default. Its `format` defaults to `"pretty"`.

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
level     = "warn"      # optional override; defaults to global [logging].level
```

Defaults when a key is left out: `transport = "udp"`, `host =
"127.0.0.1"`, `port = 514`, `protocol = "rfc5424"`, `facility = "user"`,
`app_name = "homecore"`.

### `[logging.stream]`: in-memory buffer for the live stream

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

### Production: structured file plus remote warnings

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
prune_after_days = 7    # auto-delete logs older than 7 days

[logging.syslog]
enabled   = true
transport = "udp"
host      = "192.168.1.50"
port      = 514
level     = "warn"   # only warnings and above go to remote
```

### systemd: journal-friendly

```toml
[logging.stderr]
enabled = true
format  = "compact"
ansi    = false   # no ANSI codes in journal
```

### Grafana Loki or Graylog via file

```toml
[logging.file]
enabled  = true
dir      = "/var/log/homecore"
format   = "json"    # structured fields are required for parsing
rotation = "hourly"
```

## Log target reference

| Crate | Target name | What it covers |
|---|---|---|
| `hc-core` | `hc_core` | Rule engine, scheduler, state bridge, executor, timer/switch/mode managers |
| `hc-api` | `hc_api` | HTTP handlers, WebSocket stream, auth middleware |
| `hc-auth` | `hc_auth` | JWT issuance/validation, password hashing |
| `hc-state` | `hc_state` | Device registry (redb), time-series history (SQLite) |
| `hc-mqtt-client` | `hc_mqtt_client` | MQTT connection, subscriptions, topic routing |
| `hc-broker` | `hc_broker` | Embedded rumqttd broker internals |
| `hc-topic-map` | `hc_topic_map` | Ecosystem profile matching, payload transforms |
| `hc-notify` | `hc_notify` | Email, Pushover, Telegram notification channels |
| `hc-scripting` | `hc_scripting` | Rhai script execution |

## Log level API

You can change the server's log filter at runtime without a restart. The
body's `level` is a full filter directive string, in the same syntax as
`RUST_LOG`, and it replaces the current one. Setting it requires the
`plugins:write` scope, which only `admin` carries.

```bash
# Debug for the rule engine, info for everything else
curl -s -X PUT http://localhost:8080/api/v1/system/log-level \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"level":"info,hc_core=debug"}'

# Read the current directive string
curl -s http://localhost:8080/api/v1/system/log-level \
  -H "Authorization: Bearer $TOKEN" | jq
```

The response is `{"level": "..."}` (or `{"ok": true, "level": "..."}`
after a change). An invalid directive returns 400.

The change lasts until homeCore restarts. It acts as a global gate in
front of every output: raising it to `debug` makes debug lines appear in
the live log stream, but stderr, the log file and syslog still apply
their own configured levels. To get debug lines into those, change
`[logging]` or set `RUST_LOG` and restart.

## Reading logs over the API

Both endpoints are **admin only**. They read the same in-memory ring
buffer (`[logging.stream].ring_buffer_size`, default 500 lines), which
also holds lines forwarded by plugins.

### Live stream (WebSocket)

```bash
# Tail all logs at info+
websocat "ws://localhost:8080/api/v1/logs/stream?token=$TOKEN"

# Filter to warn and above
websocat "ws://localhost:8080/api/v1/logs/stream?token=$TOKEN&level=warn"

# Filter to a specific module
websocat "ws://localhost:8080/api/v1/logs/stream?token=$TOKEN&target=hc_core"
```

| Parameter | Description |
|---|---|
| `token` | JWT or API key (required) |
| `level` | Minimum level, default `info` |
| `target` | Only lines whose target starts with this prefix |
| `plugin_id` | Only lines forwarded by this plugin, including its SDK and dependencies |
| `history` | Buffered lines to send first, default 50, maximum 500 |

The stream sends the buffered history first, then new lines as they
happen.

### Recent lines (REST)

`GET /api/v1/logs` returns the same buffer as JSON, oldest first, for
scripts and `curl | jq`:

```bash
curl -s "http://localhost:8080/api/v1/logs?level=warn&limit=200" \
  -H "Authorization: Bearer $TOKEN" | jq '.lines[]'
```

It takes `level`, `target` and `plugin_id` like the stream, plus `since`
(an RFC3339 timestamp, for incremental polling) and `limit` (default 100,
maximum 1000). The response is `{"count": N, "lines": [...]}`.

In the web app, the same lines are on Settings › System › Logs, and each
plugin's page shows its own log.

## Plugin logging

Each hc-* plugin writes its own log file and handles its own rotation,
separately from the homeCore server. All Rust plugins share the same
`[logging]` schema (from the plugin SDK), set in the plugin's own
`config/config.toml`:

```toml
[logging]
level             = "info"   # stderr log level; RUST_LOG overrides this
rotation          = "daily"  # daily | hourly | weekly | never
max_size_mb       = 100      # rotate when file exceeds this MB (0 = time-only)
compress          = true     # gzip rotated files in a background thread
prune_after_days  = 5        # delete rotated logs older than N days (0 = never)
log_forward_level = "info"   # min level forwarded to core over MQTT
```

| Option | Default | Description |
|---|---|---|
| `level` | `"info"` | Stderr log level when `RUST_LOG` is not set. Accepts any tracing filter directive, e.g. `"debug"` or `"hc_hue=debug,rumqttc=warn"`. |
| `rotation` | `"daily"` | Time-based rotation strategy: `daily`, `hourly`, `weekly`, or `never`. |
| `max_size_mb` | `100` | Size-based rotation threshold, combined with `rotation` as "whichever comes first". Set `0` to disable size-based rotation. |
| `compress` | `true` | Gzip-compress rotated files in a background thread immediately after rotation. The active log file is never compressed. |
| `prune_after_days` | `0` | Delete rotated `.log` and `.log.gz` files older than this many days. Runs at startup and after each rotation. `0` disables pruning. |
| `log_forward_level` | `"info"` | Minimum level forwarded to homeCore over MQTT. Forwarded lines appear in the web app's logs and in `/api/v1/logs/stream`. Set to `"off"` to stop forwarding. |

A plugin's log level can also be changed from its page in the web app.

### MQTT log forwarding

Plugins forward their tracing output to homeCore over MQTT, so it shows up
alongside core's own logs. Forwarding uses QoS 0 (fire-and-forget) so it
never stalls the plugin's logging.

**Topic:** `homecore/plugins/{plugin_id}/logs`

**Payload format** (the same as core's `LogLine`):

```json
{
  "timestamp": "2026-04-07T12:00:00Z",
  "level": "INFO",
  "target": "hc_yolink::bridge",
  "message": "Device registered",
  "fields": {"device_id": "yolink_front_door"}
}
```

homeCore puts these lines into the same buffer and broadcast channel as
its own, so they appear in `/api/v1/logs`, `/api/v1/logs/stream` and the
web app.

Plugin log files follow the same naming as the server's:

| File | Description |
|---|---|
| `logs/hc-{plugin}.log` | Active log (always uncompressed) |
| `logs/hc-{plugin}.2026-03-27.log.gz` | Rotated daily file (compressed) |
| `logs/hc-{plugin}.2026-03-27_14.log.gz` | Rotated hourly file (compressed) |
| `logs/hc-{plugin}.2026-03-27.1.log.gz` | Second size-triggered rotation in the same period |

If a plugin config has no `[logging]` section, these defaults apply.
