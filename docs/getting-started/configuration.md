---
id: configuration
title: Configuration Reference
sidebar_label: Configuration
sidebar_position: 3
---

# Configuration Reference

HomeCore is configured with a single TOML file. By default it looks for `config/homecore.toml` relative to the base directory (current working directory, or `--home` / `HOMECORE_HOME`).

```bash
# Config resolution order:
# 1. --config /path/to/file
# 2. HOMECORE_CONFIG env var
# 3. {base_dir}/config/homecore.toml
```

## Full annotated example

```toml
# ── Server ────────────────────────────────────────────────────────────────────
[server]
host = "0.0.0.0"
port = 8080

# IP addresses or CIDR ranges that bypass JWT authentication entirely.
# Requests from these IPs are granted Admin-level access without a token.
# Useful for trusted LAN clients (dashboards, scripts on localhost).
# When a Bearer token IS present, JWT validation always runs regardless of whitelist.
whitelist = ["127.0.0.1", "192.168.1.0/24"]

# ── MQTT Broker ───────────────────────────────────────────────────────────────
[broker]
host = "0.0.0.0"
port = 1883

# Optional TLS listener (runs alongside plain-text port)
# tls_port  = 8883
# cert_path = "/etc/homecore/broker.crt"
# key_path  = "/etc/homecore/broker.key"

# Use an external broker (e.g. Mosquitto) instead of the embedded rumqttd.
# When set, HomeCore connects as a client and skips its own listener bind.
# Required for topic-level authz enforcement — see Administration → Broker
# for the rumqttd-vs-Mosquitto split and `hc-cli broker generate-mosquitto-config`.
# external_url = "mqtt://mosquitto.local:1883"

# When [[broker.clients]] entries are present, the embedded broker requires
# credentials on CONNECT. The `allow_pub` / `allow_sub` patterns are
# metadata-only on rumqttd — they are NOT enforced at publish/subscribe time.
# For per-topic enforcement, deploy with external Mosquitto and run
# `hc-cli broker generate-mosquitto-config` to convert these patterns into
# Mosquitto's ACL file.
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

# ── Authentication ────────────────────────────────────────────────────────────
[auth]
# JWT signing secret. Change this! Use a long random string.
# If not set, a random secret is generated each startup (tokens expire on restart).
jwt_secret           = "change-this-to-a-long-random-string"
token_expiry_hours   = 24

# ── Location (required for solar triggers) ───────────────────────────────────
[location]
latitude  = 38.9072    # Washington D.C. defaults
longitude = -77.0369
timezone  = "America/New_York"

# ── Storage ───────────────────────────────────────────────────────────────────
# Paths are relative to base_dir unless absolute.
[storage]
state_db_path   = "data/state.redb"    # device registry, rules, users, scenes
history_db_path = "data/history.db"   # time-series attribute history

# ── Rules ─────────────────────────────────────────────────────────────────────
[rules]
# Directory containing rule RON files. Hot-reloaded on any file change.
dir = "rules"

# ── Scheduler ─────────────────────────────────────────────────────────────────
[scheduler]
# On restart, fire time-based triggers that occurred within this window.
# Set 0 to disable catch-up entirely.
catchup_window_minutes = 15

# ── Startup ───────────────────────────────────────────────────────────────────
[startup]
# Seconds to wait after startup before mode manager publishes initial modes.
# Gives plugins time to connect and subscribe before receiving cmd messages.
plugin_ready_delay_secs = 10

# ── Modes ─────────────────────────────────────────────────────────────────────
[modes]
# Path to modes.toml file. Hot-reloaded on change.
path = "config/modes.toml"

# ── Calendar ──────────────────────────────────────────────────────────────────
# [calendar]
# dir = "calendars"          # directory of .ics files; hot-reloaded
# expansion_days = 400       # how far ahead to expand recurring events

# ── Notifications ─────────────────────────────────────────────────────────────
[notify]
[[notify.channels]]
name      = "telegram"
type      = "telegram"
bot_token = "123456789:ABCDEFxxxxxxxxxxxxxxxxxxxxxxx"
chat_id   = "-1001234567890"

[[notify.channels]]
name     = "pushover"
type     = "pushover"
api_key  = "your-pushover-app-key"
user_key = "your-pushover-user-key"

[[notify.channels]]
name = "email-alerts"
type = "email"
from = "homecore@yourdomain.com"
to   = ["you@yourdomain.com"]
[notify.channels.smtp]
host     = "smtp.yourdomain.com"
port     = 587
username = "homecore@yourdomain.com"
password = "smtp-password"
starttls = true

# ── Logging ───────────────────────────────────────────────────────────────────
[logging]
level        = "info"
time_display = "local"   # "local" | "utc"

[logging.targets]
hc_core        = "info"
hc_api         = "info"
hc_broker      = "warn"
hc_mqtt_client = "info"

[logging.stderr]
enabled = true
format  = "pretty"   # "pretty" | "compact" | "json"
ansi    = true

[logging.file]
enabled    = false
dir        = "logs"
prefix     = "homecore"
rotation   = "daily"     # "daily" | "hourly" | "weekly" | "never"
max_size_mb = 100
compress   = true
format     = "json"
prune_after_days = 30    # delete rotated files older than N days; 0 = never prune

# Per-plugin tracing logs forwarded to the broker on
# `homecore/plugins/<id>/logs` are merged into core's /logs/stream by
# the StateBridge. Default forwarding level is "info" — bump to "debug"
# for a single misbehaving plugin via the management API or here.
[logging.plugin_forward]
default_level = "info"   # trace | debug | info | warn | error

# [logging.syslog]
# enabled   = false
# transport = "udp"   # "udp" | "tcp"
# host      = "192.168.1.100"
# port      = 514
# protocol  = "rfc5424"   # "rfc5424" | "rfc3164"
# facility  = "daemon"
# app_name  = "homecore"

# ── Web Admin UI ──────────────────────────────────────────────────────────────
[web_admin]
enabled = false              # serve pre-built Leptos/WASM admin UI
# dist_path = "ui/dist"     # path to trunk build output, relative to home dir

# ── Engine ────────────────────────────────────────────────────────────────────
[engine]
drain_timeout_secs = 10   # time to wait for in-flight rule tasks on shutdown
fire_history_limit = 500  # max evaluation records per rule

# ── Plugins (managed) ────────────────────────────────────────────────────────
# Each [[plugins]] entry defines a managed plugin that HomeCore supervises.
# [[plugins]]
# id      = "plugin.hue"
# binary  = "plugins/hc-hue/bin/hc-hue"    # relative to HOMECORE_HOME
# config  = "plugins/hc-hue/config/config.toml"
# enabled = true

# [[plugins]]
# id      = "plugin.wled"
# binary  = "plugins/hc-wled/bin/hc-wled"
# config  = "plugins/hc-wled/config/config.toml"
# enabled = true

# ── Ecosystem profiles ────────────────────────────────────────────────────────
# [ecosystem]
# profiles_dir = "config/profiles"   # directory of .toml profile files
```

## Section reference

### `[server]`

| Key | Type | Default | Description |
|---|---|---|---|
| `host` | string | `"0.0.0.0"` | Bind address for the HTTP/WebSocket API |
| `port` | integer | `8080` | Listen port |

### `[broker]`

| Key | Type | Default | Description |
|---|---|---|---|
| `host` | string | `"0.0.0.0"` | Embedded-broker bind address (ignored when `external_url` is set) |
| `port` | integer | `1883` | Plain-text MQTT v3 port |
| `v5_port` | integer | `1884` | Plain-text MQTT v5 port. Set to `null` to disable. |
| `tls_port` | integer | — | TLS MQTT port (requires `cert_path` and `key_path`) |
| `cert_path` | string | — | Path to TLS certificate file (PEM) |
| `key_path` | string | — | Path to TLS private key file (PEM) |
| `external_url` | string | — | Connect to an external broker (e.g. `mqtt://mosquitto:1883`) instead of running the embedded one. Required for per-topic ACL enforcement; see [Administration → Broker](../administration/broker). |

`[[broker.clients]]` entries:

| Key | Type | Description |
|---|---|---|
| `id` | string | Client ID (used as MQTT username) |
| `password` | string | Plain-text password (hashed internally) |
| `allow_pub` | array of strings | Allowed publish topic patterns (MQTT wildcards `+`/`#` supported) |
| `allow_sub` | array of strings | Allowed subscribe topic patterns |

> **Important:** The embedded broker enforces connection-level credentials but **does not enforce per-topic ACL**. `allow_pub`/`allow_sub` are metadata only. For strict topic ACL, deploy against an external Mosquitto broker — see [the broker deployment guide](../administration/broker#external-mosquitto-deployment). `hc-cli broker generate-mosquitto-config` converts these patterns to a Mosquitto ACL file automatically.

### `[storage]`

| Key | Type | Default | Description |
|---|---|---|---|
| `state_db_path` | string | `"data/state.redb"` | Path to the redb state database (devices, rules, users, dashboards, audit, battery latches). Relative to `HOMECORE_HOME`. |
| `history_db_path` | string | `"data/history.db"` | Path to the SQLite time-series history DB. |

### `[profiles]`

| Key | Type | Default | Description |
|---|---|---|---|
| `dir` | string | `"config/profiles"` | Directory of ecosystem profile TOML files (Tasmota, Shelly, Zigbee2MQTT, etc.) consumed by the topic mapper. |

### `[rules]`

| Key | Type | Default | Description |
|---|---|---|---|
| `dir` | string | `"rules"` | Directory of `.ron` rule files. Hot-reloaded on change. |

### `[auth]`

| Key | Type | Default | Description |
|---|---|---|---|
| `jwt_secret` | string | _unset_ | **Deprecated.** Inline HS256 secret. If set, overrides `jwt_secret_file` and emits a warning. Prefer the file-managed default. |
| `jwt_secret_file` | string | `<parent-of-state_db_path>/jwt_secret` | Path to a `0600` file holding the persistent JWT secret. Auto-generated on first startup so issued tokens survive restarts. |
| `token_expiry_hours` | integer | `24` | Access JWT lifetime in hours. |
| `refresh_token_expiry_days` | integer | `30` | Refresh token lifetime. Each `/auth/refresh` rotates the token; reuse triggers full chain revocation. |
| `audit_retention_days` | integer | `365` | How many days of audit history to keep. A background task prunes older entries every 6 hours. |
| `whitelist` | array of strings | `[]` | **Deprecated.** IP addresses or CIDR ranges that bypass JWT auth and receive Admin access. Both IPv4 and IPv6 supported (e.g. `["127.0.0.1/32", "::1/128"]`). Prefer `[auth.admin_uds]` for same-host tooling. |

`[auth.admin_uds]` — Unix domain socket listener for same-host admin tooling (replaces `whitelist`):

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Listen on the admin UDS. |
| `path` | string | `/run/homecore/admin.sock` | Socket path. |
| `mode` | integer (octal) | `0o660` | Filesystem permissions on the socket. |
| `allowed_uids` | array of integers | `[]` | UIDs allowed to connect. Empty = only the homecore service UID, resolved at startup. |

### `[location]`

Required for `SunEvent` and `SunEvent` offset triggers.

| Key | Type | Description |
|---|---|---|
| `latitude` | float | Decimal degrees, e.g. `38.9072` |
| `longitude` | float | Decimal degrees, e.g. `-77.0369` |
| `timezone` | string | IANA timezone name, e.g. `"America/New_York"` |

### `[battery]`

Drives the battery alert watcher. The watcher synthesizes
`device_battery_low` and `device_battery_recovered` events from device
state changes, with hysteresis enforced in core (latches at
`threshold_pct`, clears at `threshold_pct + recover_band_pct`). See
[Battery monitoring](../devices/battery-monitoring.md) for the full picture.

| Key | Type | Default | Description |
|---|---|---|---|
| `threshold_pct` | float | `20.0` | Battery percentage at or below which the latch engages. |
| `recover_band_pct` | float | `5.0` | Recovery band added to threshold to clear the latch. Recovery fires at `threshold_pct + recover_band_pct`. |
| `notify_channel` | string | _unset_ | Optional `hc-notify` channel name. When set, the watcher sends a built-in notification on each low edge — no rule required. |
| `notify_on_recovered` | bool | `false` | When `true` and `notify_channel` is set, recovery edges also notify. |

```toml
[battery]
threshold_pct       = 20.0
recover_band_pct    = 5.0
# notify_channel       = "all"
# notify_on_recovered  = false
```

### `[scheduler]`

| Key | Type | Default | Description |
|---|---|---|---|
| `catchup_window_minutes` | integer | `15` | On restart, fire missed time-based triggers that occurred within this many minutes. Set `0` to disable. |

### `[startup]`

| Key | Type | Default | Description |
|---|---|---|---|
| `plugin_ready_delay_secs` | integer | `10` | Grace period before mode manager publishes initial states. Prevents command-before-subscribe race with plugins. |

### `[shutdown]`

| Key | Type | Default | Description |
|---|---|---|---|
| `drain_timeout_secs` | integer | `10` | Seconds to wait for in-flight rule action tasks to finish on graceful shutdown before force-stopping. |

### `[logging]`

Top-level keys:

| Key | Type | Default | Description |
|---|---|---|---|
| `level` | string | `"info"` | Global log level (`error`, `warn`, `info`, `debug`, `trace`). |
| `targets` | table of string→string | `{}` | Per-target overrides keyed by Rust module path with underscores (e.g. `hc_core = "debug"`). Equivalent to RUST_LOG directives. |
| `time_display` | string | `"local"` | Timestamp display: `"local"` or `"utc"`. |

`[logging.stderr]`:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Emit to stderr. |
| `format` | string | `"pretty"` | `"pretty"`, `"compact"`, or `"json"`. |
| `ansi` | bool | `true` | ANSI color codes (set `false` when piping to systemd journal). |

`[logging.file]` — rolling file output:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Enable rolling file output. |
| `dir` | string | `"logs"` | Log directory (created if missing). |
| `prefix` | string | `"homecore"` | Filename prefix; rotated files become `<prefix>.YYYY-MM-DD`. |
| `rotation` | string | `"daily"` | `"daily"`, `"hourly"`, `"weekly"`, or `"never"`. |
| `max_size_mb` | integer | `100` | Max size before rotation. Combined with `rotation` ("whichever first"); `0` disables size-based rotation. |
| `compress` | bool | `true` | Gzip rotated files (background thread). |
| `prune_after_days` | integer | `0` | Delete rotated files older than N days. `0` = never prune. |
| `format` | string | `"json"` | `"json"`, `"compact"`, or `"pretty"`. |

`[logging.rules_file]` — separate rule-engine log capturing only `hc_core` at `debug` regardless of the global level. Disabled by default. Same field set as `[logging.file]` plus its own defaults (prefix `"rules"`, format `"pretty"`).

`[logging.stream]` — live `/api/v1/logs/stream` WebSocket:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Enable the streaming endpoint. |
| `ring_buffer_size` | integer | `500` | Recent log lines retained for new subscribers. |

`[logging.syslog]` — RFC 5424 syslog forwarding:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `false` | Enable syslog output. |
| `transport` | string | `"udp"` | `"udp"` (recommended) or `"tcp"`. |
| `host` | string | `"127.0.0.1"` | Syslog server. |
| `port` | integer | `514` | Syslog port. |

### `[notify]`

Channels are declared as a list under `[[notify.channels]]`. The `name` is referenced from rule `Notify` actions. The reserved name `"all"` fans out to every registered channel.

```toml
[[notify.channels]]
name = "primary_email"
type = "email"
smtp_host = "smtp.example.com"
smtp_port = 587
username  = "automation@example.com"
password  = "..."
from      = "automation@example.com"
to        = ["alerts@example.com"]

[[notify.channels]]
name      = "phone_push"
type      = "pushover"
api_token = "..."
user_key  = "..."

[[notify.channels]]
name      = "telegram"
type      = "telegram"
bot_token = "..."
chat_id   = "..."
```

Built-in providers: `email` (SMTP), `pushover`, `telegram`. Channels that fail to initialise at startup are logged and skipped — they don't block the rest of the system.

### `[web_admin]`

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `false` | Serve the pre-built Leptos/WASM admin UI as static files via tower-http `ServeDir` |
| `dist_path` | string | `"ui/dist"` | Path to the `trunk build` output directory, relative to `HOMECORE_HOME` |

When enabled, HomeCore serves the Leptos admin UI at the root path. API routes at `/api/v1` take priority over static file serving. A SPA fallback returns `index.html` for any unmatched path, enabling client-side routing. Disabled by default so that during development you can use `trunk serve` separately.

See [Web UI overview](../web-ui/overview.md) for what the admin client provides.

### `[calendars]`

| Key | Type | Default | Description |
|---|---|---|---|
| `dir` | string | `"config/calendars"` | Directory of `.ics` calendar files. Hot-reloaded on file changes. |
| `expansion_days` | integer | `400` | How many days forward to expand recurring events into individual occurrences. |

### Glue devices

The path to glue device definitions is fixed at `<base>/config/glue.toml` and is not configurable from `homecore.toml`. See [Virtual / glue devices](../devices/virtual-devices.md) for the file format (timers, switches, counters, modes).

### `[[plugins]]`

Each entry defines a managed plugin that HomeCore supervises. Managed plugins support heartbeat monitoring, start/stop/restart, and remote configuration.

| Key | Type | Description |
|---|---|---|
| `id` | string | Plugin ID (matches the plugin's `plugin_id` config) |
| `binary` | string | Path to the plugin binary (relative to `HOMECORE_HOME`) |
| `config` | string | Path to the plugin config file (relative to `HOMECORE_HOME`) |
| `enabled` | boolean | Whether the plugin should be started automatically |

---

## modes.toml reference

The modes configuration is a separate file (`config/modes.toml`), hot-reloaded when changed.

```toml
# Solar modes — computed from sunrise/sunset with optional offset
[[modes]]
name = "mode_night"
type = "solar"
# on_at_offset  = 0   # minutes after sunset (negative = before)
# off_at_offset = 0   # minutes after sunrise (negative = before)

# Manual boolean modes — toggled via API or rule actions
[[modes]]
name = "mode_away"
type = "manual"
default = false

[[modes]]
name = "mode_vacation"
type = "manual"
default = false

[[modes]]
name = "mode_movie"
type = "manual"
default = false
```

**Solar mode behavior:**
- `mode_night` is `true` from sunset to sunrise, `false` during daylight hours
- Offsets shift the transition point: `on_at_offset = -30` turns night mode on 30 minutes *before* sunset
- Mode state is republished via MQTT as `DeviceStateChanged` at every transition

**Mode API:**

```bash
# Get all mode states
curl -s http://localhost:8080/api/v1/modes -H "Authorization: Bearer $TOKEN" | jq

# Set a manual mode on
curl -s -X PATCH http://localhost:8080/api/v1/modes/mode_away \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Adjust solar offset (minutes relative to sunset/sunrise)
curl -s -X PATCH http://localhost:8080/api/v1/modes/mode_night \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on_at_offset": -30}'
```

## Environment variable overrides

Some sensitive values can be set via environment variables instead of the config file:

```bash
HOMECORE_JWT_SECRET="your-secret"   \
HOMECORE_LAT="38.9072"              \
HOMECORE_LON="-77.0369"             \
HOMECORE_TZ="America/New_York"      \
./bin/homecore
```

These are particularly useful in Docker deployments where secrets should not be baked into config files.
