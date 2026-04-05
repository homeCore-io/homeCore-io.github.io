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

# When [[broker.clients]] entries are present, the broker requires credentials.
# Leave empty for open-access (development / trusted networks).
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
# Directory containing rule TOML files. Hot-reloaded on any file change.
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
rotation   = "daily"   # "daily" | "hourly" | "weekly" | "never"
max_size_mb = 100
compress   = true
format     = "json"

# [logging.syslog]
# enabled   = false
# transport = "udp"   # "udp" | "tcp"
# host      = "192.168.1.100"
# port      = 514
# protocol  = "rfc5424"   # "rfc5424" | "rfc3164"
# facility  = "daemon"
# app_name  = "homecore"

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
| `whitelist` | array of strings | `[]` | IP addresses/CIDR ranges that bypass JWT auth |

### `[broker]`

| Key | Type | Default | Description |
|---|---|---|---|
| `host` | string | `"0.0.0.0"` | Broker bind address |
| `port` | integer | `1883` | Plain-text MQTT port |
| `tls_port` | integer | — | TLS MQTT port (requires `cert_path` and `key_path`) |
| `cert_path` | string | — | Path to TLS certificate file (PEM) |
| `key_path` | string | — | Path to TLS private key file (PEM) |

`[[broker.clients]]` entries:

| Key | Description |
|---|---|
| `id` | Client ID (used as MQTT username) |
| `password` | Plain-text password (hashed internally) |
| `allow_pub` | Documentation of allowed publish topics |
| `allow_sub` | Documentation of allowed subscribe topics |

> **Note:** The embedded broker enforces connection-level credentials but does not enforce per-topic ACL. `allow_pub`/`allow_sub` are documentation only. For strict topic ACL, use an external broker.

### `[auth]`

| Key | Type | Default | Description |
|---|---|---|---|
| `jwt_secret` | string | random | HS256 signing secret. Set a fixed value so tokens survive restarts. |
| `token_expiry_hours` | integer | `24` | JWT lifetime |

### `[location]`

Required for `SunEvent` and `SunEvent` offset triggers.

| Key | Type | Description |
|---|---|---|
| `latitude` | float | Decimal degrees, e.g. `38.9072` |
| `longitude` | float | Decimal degrees, e.g. `-77.0369` |
| `timezone` | string | IANA timezone name, e.g. `"America/New_York"` |

### `[scheduler]`

| Key | Type | Default | Description |
|---|---|---|---|
| `catchup_window_minutes` | integer | `15` | On restart, fire missed time-based triggers that occurred within this many minutes. Set `0` to disable. |

### `[startup]`

| Key | Type | Default | Description |
|---|---|---|---|
| `plugin_ready_delay_secs` | integer | `10` | Grace period before mode manager publishes initial states. Prevents command-before-subscribe race with plugins. |

### `[engine]`

| Key | Type | Default | Description |
|---|---|---|---|
| `drain_timeout_secs` | integer | `10` | Time to wait for in-flight rule tasks on shutdown before force-stopping |
| `fire_history_limit` | integer | `500` | Maximum evaluation records stored per rule |

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
