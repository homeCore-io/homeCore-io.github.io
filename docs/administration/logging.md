---
id: logging
title: Logging
sidebar_label: Logging
sidebar_position: 2
---

# Logging

HomeCore uses `tracing` for structured logging. Three independent outputs can run simultaneously, each with its own format and level filter.

## Outputs at a glance

| Output | Default | Best for |
|---|---|---|
| **stderr** | enabled, pretty format | Development, systemd journal |
| **file** | disabled | Production, post-mortem analysis, log aggregators |
| **syslog** | disabled | Centralised aggregation (Graylog, Loki, rsyslog) |

## Quick level override

The fastest way to change log verbosity is the `RUST_LOG` environment variable. It always takes highest precedence over config:

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

### `[logging]` — global defaults

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

### `[logging.targets]` — per-crate overrides

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

Sub-module granularity:

```toml
[logging.targets]
"hc_core::engine"   = "debug"   # rule evaluation loop only
"hc_core::executor" = "debug"   # action execution only
"hc_core::bridge"   = "debug"   # MQTT→EventBus state bridge only
```

### `[logging.stderr]` — console output

```toml
[logging.stderr]
enabled = true
format  = "pretty"   # "pretty" | "compact" | "json"
ansi    = true       # set false for systemd journal / Docker
```

### `[logging.file]` — rolling log file

```toml
[logging.file]
enabled     = false
dir         = "logs"              # created automatically
prefix      = "homecore"
rotation    = "daily"             # "daily" | "hourly" | "weekly" | "never"
max_size_mb = 100                 # rotate when file exceeds this (0 = size-only rotation off)
compress    = true                # gzip rotated files immediately after rotation
format      = "json"              # "json" | "compact" | "pretty"
```

Active file is always `<prefix>.log` (never compressed). Rotated files follow:
- Daily: `homecore.2026-03-27.log.gz`
- Hourly: `homecore.2026-03-27_14.log.gz`

### `[logging.syslog]` — remote syslog

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

## Common recipes

### Development — verbose rule engine, quiet broker

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

### Production — structured file + remote warnings

```toml
[logging]
level = "info"

[logging.stderr]
enabled = false   # no console when running as a service

[logging.file]
enabled   = true
dir       = "/var/log/homecore"
rotation  = "daily"
format    = "json"
compress  = true

[logging.syslog]
enabled   = true
transport = "udp"
host      = "192.168.1.50"
port      = 514
level     = "warn"   # only warnings and above go to remote
```

### systemd — journal-friendly

```toml
[logging.stderr]
enabled = true
format  = "compact"
ansi    = false   # no ANSI codes in journal
```

### Grafana Loki / Graylog via file

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

Change log levels at runtime without restart (Admin required):

```bash
# Temporarily enable debug for rule engine
curl -s -X PATCH http://localhost:8080/api/v1/system/log-level \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target":"hc_core","level":"debug"}'
```

## Live log stream (WebSocket)

```bash
# Tail all logs at info+
websocat "ws://localhost:8080/api/v1/logs/stream?token=$TOKEN"

# Filter to warn and above
websocat "ws://localhost:8080/api/v1/logs/stream?token=$TOKEN&level=warn"

# Filter to a specific module
websocat "ws://localhost:8080/api/v1/logs/stream?token=$TOKEN&module=hc_core"
```

The log stream replays the last 100 buffered log lines on connect, then streams new lines in real time.
