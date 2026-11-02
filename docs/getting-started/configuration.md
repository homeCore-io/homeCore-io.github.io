---
id: configuration
title: Configuration Reference
sidebar_label: Configuration
sidebar_position: 3
---

# Configuration Reference

HomeCore reads one TOML file. By default that is `config/homecore.toml`
under the base directory (the current working directory, or whatever
`--home` / `HOMECORE_HOME` names).

```bash
# Config resolution order:
# 1. --config /path/to/file
# 2. HOMECORE_CONFIG env var
# 3. {base_dir}/config/homecore.toml
```

A relative `--config` or `HOMECORE_CONFIG` path is resolved against the
base directory. So are relative paths inside the file, unless a section
says otherwise.

Start from `config/homecore.toml.example`. Two behaviours are worth
knowing before you edit:

- If the file is missing, or fails to parse, core logs a warning and
  runs with built-in defaults for every section. Those defaults bind the
  MQTT broker to `0.0.0.0` with no credentials, which core
  [refuses to start with](#broker), so a typo usually shows up as that
  error.
- Unknown keys are ignored without a warning. Check spelling against
  the tables below.

Admins can also read and edit this file from the web app, which uses
`GET` / `PUT /api/v1/system/config`. Most changes take effect after a
restart.

## Full annotated example

```toml
# ── Server ────────────────────────────────────────────────────────────────────
[server]
host = "0.0.0.0"
port = 8080

# ── MQTT Broker ───────────────────────────────────────────────────────────────
[broker]
# Loopback keeps the broker private to this host; plugins run here too.
# Bind 0.0.0.0 only if LAN devices (Tasmota, Shelly, ESPHome) publish to it,
# and then add [[broker.clients]] below, or core refuses to start.
host = "127.0.0.1"
port = 1883
# v5_port = 1884   # MQTT v5 listener (the default); 0 turns it off

# Optional TLS listener (runs alongside plain-text port)
# tls_port  = 8883
# cert_path = "/etc/homecore/broker.crt"
# key_path  = "/etc/homecore/broker.key"

# When [[broker.clients]] entries are present, the embedded broker requires
# credentials on CONNECT. The `allow_pub` / `allow_sub` patterns are
# metadata-only on rumqttd — they are NOT enforced at publish/subscribe time.
# `hc-cli broker generate-mosquitto-config` converts them into a Mosquitto
# ACL file; see Administration → Broker.
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
# Nothing here is required. The HS256 signing secret is generated once and
# persisted to <state-db-parent>/jwt_secret (0600), so tokens survive
# restarts with no configuration at all. Setting `jwt_secret` inline still
# works, takes precedence, and warns at startup — it is deprecated.
token_expiry_hours        = 24     # access token lifetime
refresh_token_expiry_days = 30     # refresh token lifetime
audit_retention_days      = 365

# Addresses that get FULL ADMIN with no token at all. Deprecated. Single
# addresses only: an entry covering a range (e.g. a /24) is skipped with a
# warning.
# whitelist = ["127.0.0.1"]

# The replacement: an admin-only Unix socket for same-host tooling (hc-cli),
# authorised by filesystem permissions rather than network identity.
# [auth.admin_uds]
# enabled = true
# path    = "/run/homecore/admin.sock"
# group   = "homecore-admin"
# mode    = "0660"

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
# Not a section here. Modes are defined in <base_dir>/config/modes.toml —
# a fixed path, hot-reloaded on change. See the modes.toml reference
# further down.

# ── Calendars ─────────────────────────────────────────────────────────────────
# [calendars]
# dir = "config/calendars"   # directory of .ics files; hot-reloaded
# expansion_days = 400       # how far ahead to expand recurring events

# ── Notifications ─────────────────────────────────────────────────────────────
[notify]
[[notify.channels]]
name      = "telegram"
type      = "telegram"
bot_token = "123456789:ABCDEFxxxxxxxxxxxxxxxxxxxxxxx"
chat_id   = "-1001234567890"

[[notify.channels]]
name      = "pushover"
type      = "pushover"
api_token = "your-pushover-app-token"
user_key  = "your-pushover-user-key"

[[notify.channels]]
name      = "email-alerts"
type      = "email"
smtp_host = "smtp.yourdomain.com"
smtp_port = 587
username  = "homecore@yourdomain.com"
password  = "smtp-password"
from      = "homecore@yourdomain.com"
to        = ["you@yourdomain.com"]
starttls  = true

# ── Alerts ────────────────────────────────────────────────────────────────────
# Where core sends the alerts it raises itself (wet, smoke, jammed, offline).
# Unset: alerts are shown in the app but not sent.
# [alerts]
# notify_channel = "all"

# ── Automatic backups ─────────────────────────────────────────────────────────
[backup]
every_hours = 24     # 0 = no scheduled backups
keep        = 7      # older ones are deleted
dir         = "backups"

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

# A second log file dedicated to rule-engine output, so the rule trace
# does not have to be grepped out of everything else.
[logging.rules_file]
enabled          = false
dir              = "logs"
prefix           = "rules"
rotation         = "daily"
prune_after_days = 30

# Per-plugin tracing logs are forwarded to the broker on
# `homecore/plugins/<id>/logs` and merged into core's /logs/stream. The
# level is set per plugin at runtime — Plugins → the plugin → log level,
# or PATCH /api/v1/plugins/{id} — not in this file.

# [logging.syslog]
# enabled   = false
# transport = "udp"   # "udp" | "tcp"
# host      = "192.168.1.100"
# port      = 514
# protocol  = "rfc5424"   # "rfc5424" | "rfc3164"
# facility  = "daemon"
# app_name  = "homecore"

# ── Web Admin UI ──────────────────────────────────────────────────────────────
# Optional static-file mount: serves a pre-built UI bundle from core's root
# path. Off by default and left off in the standard deployment, where the
# web app runs in its own container. Originally built for the retired
# Leptos client.
[web_admin]
enabled = false
# dist_path = "ui/dist"     # bundle directory, relative to the home dir

# ── Shutdown ──────────────────────────────────────────────────────────────────
[shutdown]
drain_timeout_secs = 10   # wait this long for in-flight rule actions, then stop

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
# Topic maps for devices that speak their own dialect (Tasmota, Shelly,
# Zigbee2MQTT). Reference profiles ship in config/profiles/examples/.
[profiles]
dir = "config/profiles"

# ── Prometheus metrics ────────────────────────────────────────────────────────
# GET /api/v1/metrics is gated by source IP, and the list is empty by default,
# which means every caller gets 403. Unlike [auth].whitelist this grants
# nothing but the metrics text, and ranges are allowed.
[metrics]
whitelist = ["127.0.0.1/32"]

# ── Plugin registry ───────────────────────────────────────────────────────────
# Both fields must be set for browse + install to work; otherwise those
# endpoints return 503.
[registry]
url        = "https://homecore.io/registry/index.json"
public_key = "d64zXOo99GE+uYAPbtbIwLUJHtBaACJB73cUppj93I8="

# ── InfluxDB v2 export (optional) ─────────────────────────────────────────────
# Streams numeric and boolean device attributes to InfluxDB as line protocol,
# one measurement per attribute. include_devices is OPT-IN by design: an empty
# list exports nothing. ["*"] exports everything, which with chatty sensors is
# a lot — the channel is bounded and drops oldest rather than back-pressuring
# the event bus.
# [influx]
# enabled             = true
# url                 = "http://192.168.1.20:8086"
# token               = "REPLACE_WITH_INFLUX_API_TOKEN"
# org                 = "homecore"
# bucket              = "devices"
# flush_interval_secs = 10
# batch_size          = 1000
# channel_capacity    = 10000
# include_devices     = ["sensor.*", "thermostat.*"]
# exclude_attributes  = ["last_seen", "uptime"]
# export_bools        = true
```

## Section reference

### `[server]`

| Key | Type | Default | Description |
|---|---|---|---|
| `host` | string | `"0.0.0.0"` | Bind address for the HTTP/WebSocket API |
| `port` | integer | `8080` | Listen port |

### `[broker]`

The embedded MQTT broker. Core always runs it, and core's own MQTT
client connects to it on `127.0.0.1` at `port`.

| Key | Type | Default | Description |
|---|---|---|---|
| `host` | string | `"0.0.0.0"` | Broker bind address. The example config sets `"127.0.0.1"`. |
| `port` | integer | `1883` | Plain-text MQTT v3.1.1 port |
| `v5_port` | integer | `1884` | Plain-text MQTT v5 port, for devices such as Shelly Gen2/Gen3. `0` disables it. |
| `tls_port` | integer | none | TLS MQTT port (requires `cert_path` and `key_path`) |
| `cert_path` | string | none | Path to TLS certificate file (PEM) |
| `key_path` | string | none | Path to TLS private key file (PEM) |

Core refuses to start when `host` is not a loopback address and there
are no `[[broker.clients]]` entries, because that would be an open
broker reachable from the network. Either bind `127.0.0.1`, add
credentials, or, on a network you have isolated some other way, set
the environment variable `HC_ALLOW_ANONYMOUS_REMOTE_BROKER=1` (core then
logs an error at startup and continues).

There is no setting for pointing core at an external broker. A
`[broker] external_url` key that some older pages mention is not read.

`[[broker.clients]]` entries:

| Key | Type | Description |
|---|---|---|
| `id` | string | Client ID (used as MQTT username) |
| `password` | string | Plain-text password |
| `allow_pub` | array of strings | Allowed publish topic patterns (MQTT wildcards `+`/`#` supported) |
| `allow_sub` | array of strings | Allowed subscribe topic patterns |

Core's internal client uses the entry with `id = "internal.core"`, so
once you add any clients, add that one too.

:::warning
The embedded broker enforces connection credentials but **does not enforce per-topic ACLs**. `allow_pub` and `allow_sub` are metadata only. `hc-cli broker generate-mosquitto-config` converts them to a Mosquitto ACL file; see [the broker deployment guide](../administration/broker#external-mosquitto-deployment).
:::

### `[storage]`

| Key | Type | Default | Description |
|---|---|---|---|
| `state_db_path` | string | `"data/state.redb"` | Path to the redb state database (devices, rules, users, audit, battery latches). Relative to `HOMECORE_HOME`. |
| `history_db_path` | string | `"data/history.db"` | Path to the SQLite time-series history DB. |

### `[profiles]`

| Key | Type | Default | Description |
|---|---|---|---|
| `dir` | string | `"config/profiles"` | Directory of ecosystem profile TOML files (Tasmota, Shelly, Zigbee2MQTT, etc.) used by the topic mapper. Core also reads the device type registry from `device-types.toml` in this directory. |

### `[rules]`

| Key | Type | Default | Description |
|---|---|---|---|
| `dir` | string | `"rules"` | Directory of `.ron` rule files (legacy `.toml` rules still load). Hot-reloaded on change. |

### `[auth]`

| Key | Type | Default | Description |
|---|---|---|---|
| `jwt_secret` | string | _unset_ | **Deprecated.** Inline HS256 secret. If set, overrides `jwt_secret_file` and emits a warning. Prefer the file-managed default. |
| `jwt_secret_file` | string | `<parent-of-state_db_path>/jwt_secret` | Path to a `0600` file holding the persistent JWT secret. Generated on first startup so issued tokens survive restarts. |
| `token_expiry_hours` | integer | `24` | Access JWT lifetime in hours. |
| `refresh_token_expiry_days` | integer | `30` | Refresh token lifetime. Each `/auth/refresh` rotates the token; reusing an old one revokes the whole session. |
| `audit_retention_days` | integer | `365` | Days of audit history to keep. A background task prunes older entries every 6 hours. |
| `whitelist` | array of strings | `[]` | **Deprecated.** Source addresses that bypass JWT auth and receive Admin access. IPv4 and IPv6, written bare (`"192.168.1.20"`) or as a single-host prefix (`"192.168.1.20/32"`, `"::1/128"`). An entry covering a range is skipped with a warning. Prefer `[auth.admin_uds]` for same-host tooling. |
| `initial_admin_password_file` | string | `<base_dir>/INITIAL_ADMIN_PASSWORD` | Where the first-boot admin password is written, `0600`. A relative path is resolved against the base directory. Set to `""` to skip the file and only log the password. Written only when no users exist. |

`[auth.admin_uds]` is a Unix domain socket listener for same-host admin
tooling. It replaces `whitelist`.

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `false` | Listen on the admin UDS. |
| `path` | string | `"/run/homecore/admin.sock"` | Socket path. |
| `group` | string | `"homecore-admin"` | POSIX group that owns the socket. Its members can connect. |
| `mode` | string (octal) | `"0660"` | Filesystem permissions on the socket. An invalid value disables the socket with a warning. |
| `allowed_uids` | array of integers | `[]` | Extra UIDs allowed to connect. The process UID is always allowed. |

### `[location]`

Required for `SunEvent` triggers and solar modes.

| Key | Type | Description |
|---|---|---|
| `latitude` | float | Decimal degrees, e.g. `38.9072` |
| `longitude` | float | Decimal degrees, e.g. `-77.0369` |
| `timezone` | string | IANA timezone name, e.g. `"America/New_York"` |

If the section is missing, core uses latitude `38.9072` and longitude
`-77.0369`. `timezone` drives every user-facing timestamp (logs and the
API's local times); storage stays in UTC. If it is unset or can't be
parsed, core uses UTC and logs why at startup.

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
| `notify_channel` | string | _unset_ | Optional notification channel name. When set, the watcher sends a notification on each low edge, with no rule required. |
| `notify_on_recovered` | bool | `false` | When `true` and `notify_channel` is set, recovery edges also notify. |

```toml
[battery]
threshold_pct       = 20.0
recover_band_pct    = 5.0
# notify_channel       = "all"
# notify_on_recovered  = false
```

### `[alerts]`

What core does with the alerts it raises itself, such as wet, smoke,
jammed or offline.

| Key | Type | Default | Description |
|---|---|---|---|
| `notify_channel` | string | _unset_ | A notification channel (or `"all"`) to send each built-in alert to. Unset means alerts are shown but not sent. Low battery uses `[battery].notify_channel` instead. |

### `[backup]`

Backups core makes on its own schedule. Each is the same zip archive
`POST /api/v1/system/backup` produces; see
[Backup & Restore](../administration/backup-restore).

| Key | Type | Default | Description |
|---|---|---|---|
| `every_hours` | integer | `24` | How often to make one. `0` turns scheduled backups off. |
| `keep` | integer | `7` | How many to keep. Older ones are deleted. |
| `dir` | string | `"backups"` | Where they are kept, relative to the base directory. |

Kept backups are listed by `GET /api/v1/system/backups` and downloaded
with `GET /api/v1/system/backups/{name}`.

### `[scheduler]`

| Key | Type | Default | Description |
|---|---|---|---|
| `catchup_window_minutes` | integer | `15` | On restart, fire missed time-based triggers (`SunEvent`, `TimeOfDay`) that fell within this many minutes. Set `0` to disable. |

### `[startup]`

| Key | Type | Default | Description |
|---|---|---|---|
| `plugin_ready_delay_secs` | integer | `10` | Grace period before the mode manager publishes initial states, so plugins have subscribed before commands arrive. Raise it if a plugin is slow to start. |

### `[shutdown]`

| Key | Type | Default | Description |
|---|---|---|---|
| `drain_timeout_secs` | integer | `10` | Seconds to wait for in-flight rule action tasks to finish on graceful shutdown before force-stopping. |

### `[logging]`

Top-level keys:

| Key | Type | Default | Description |
|---|---|---|---|
| `level` | string | `"info"` | Global log level (`error`, `warn`, `info`, `debug`, `trace`). |
| `targets` | table of string→string | `{}` | Per-target overrides keyed by Rust module path with underscores (e.g. `hc_core = "debug"`). Same syntax as `RUST_LOG` directives. |
| `time_display` | string | `"local"` | Timestamp display: `"local"` or `"utc"`. |

The `RUST_LOG` environment variable, when set, takes precedence over
these levels for stderr and file output.

`[logging.stderr]`:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Emit to stderr. |
| `format` | string | `"pretty"` | `"pretty"`, `"compact"`, or `"json"`. |
| `ansi` | bool | `true` | ANSI color codes (set `false` when piping to the systemd journal). |

`[logging.file]` controls rolling file output:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Enable rolling file output. |
| `dir` | string | `"logs"` | Log directory (created if missing). |
| `prefix` | string | `"homecore"` | The active file is `<prefix>.log`; rotated files become `<prefix>.<period>.log` (for daily rotation, `homecore.YYYY-MM-DD.log`). |
| `rotation` | string | `"daily"` | `"daily"`, `"hourly"`, `"weekly"`, or `"never"`. |
| `max_size_mb` | integer | `100` | Size limit before rotation, combined with `rotation` (whichever comes first). `0` disables size-based rotation. |
| `compress` | bool | `true` | Gzip rotated files (background thread). |
| `prune_after_days` | integer | `0` | Delete rotated files older than N days. `0` = never prune. |
| `format` | string | `"json"` | `"json"`, `"compact"`, or `"pretty"`. |

`[logging.rules_file]` is a separate rule-engine log that captures only
`hc_core` at `debug`, whatever the global level. It is disabled by
default. It takes the same keys as `[logging.file]`, with its own
defaults (prefix `"rules"`, format `"pretty"`), and uses the
`[logging.file]` directory when `dir` is unset.

`[logging.stream]` controls the live `/api/v1/logs/stream` WebSocket:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Enable the streaming endpoint. |
| `ring_buffer_size` | integer | `500` | Recent log lines retained for new subscribers. |

`[logging.syslog]` forwards logs to a syslog server:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `false` | Enable syslog output. |
| `transport` | string | `"udp"` | `"udp"` (recommended) or `"tcp"`. |
| `host` | string | `"127.0.0.1"` | Syslog server. |
| `port` | integer | `514` | Syslog port. |
| `protocol` | string | `"rfc5424"` | `"rfc5424"` or `"rfc3164"`. |
| `facility` | string | `"user"` | Syslog facility name (`daemon`, `local0` to `local7`, …). |
| `app_name` | string | `"homecore"` | App name in each message. |
| `level` | string | global level | Level for syslog only, e.g. send `warn` and above remotely while keeping `debug` locally. |

### `[notify]`

Channels are declared as a list under `[[notify.channels]]`. The `name` is what a rule's `Notify` action refers to. The reserved name `"all"` sends to every registered channel.

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

Built-in providers are `email` (SMTP), `pushover` and `telegram`. Optional fields:

- `email`: `smtp_port` defaults to `587` and `starttls` to `true`. Set `starttls = false` for implicit TLS on port 465.
- `pushover`: `device` (send to one device), `priority` (`-2` to `2`), and for emergency priority `retry` (seconds, at least 30, default 60) and `expire` (seconds, at most 10800, default 3600).
- `telegram`: `markdown = true` sends messages as MarkdownV2.

A Telegram channel still set to the example placeholder `CHANGE_ME` stops core from starting, so a forgotten placeholder is caught at boot. Other channels that fail to initialise are logged and skipped without blocking the rest of the system.

### `[web_admin]`

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `false` | Serve a directory of static files from core's root path, via tower-http `ServeDir`. |
| `dist_path` | string | none | The bundle directory, relative to `HOMECORE_HOME`. |

When enabled, core serves that bundle at `/`. API routes under `/api/v1`
take priority, and anything unmatched falls back to `index.html`.

It is off by default and the standard deployment leaves it off. The web
app is [`hc-web-svelte`](../web-ui/overview.md), which runs in its own
container and passes `/api/v1` through to core. This section was built
for the Leptos client that core used to bundle, and it remains as a
generic static mount for anyone self-hosting a bundle.

### `[calendars]`

| Key | Type | Default | Description |
|---|---|---|---|
| `dir` | string | `"config/calendars"` | Directory of `.ics` calendar files. Hot-reloaded on file changes. |
| `expansion_days` | integer | `400` | How many days ahead to expand recurring events into individual occurrences. |

### Glue devices

Glue device definitions live at `<base>/config/glue.toml`, a fixed path that `homecore.toml` can't change. Devices listed there are created at startup if they don't already exist. See [Virtual / glue devices](../devices/virtual-devices.md) for the file format (timers, switches, counters and more).

### `[[plugins]]`

Each entry declares a plugin for homeCore to supervise: spawn it, watch its
heartbeat, start, stop and restart it, and push its configuration.

You rarely need to write one. A registry install records itself in
`config/plugins/managed.toml`, which homeCore owns and rewrites; your
`homecore.toml` is never touched. At boot, the plugins core runs are the
static entries plus the managed records, minus any ids that have been
uninstalled. A managed record wins when both name the same id, so
uninstalling a statically declared plugin sticks (it leaves a tombstone)
without homeCore editing your file.

Write a `[[plugins]]` block for a plugin you built or unpacked yourself and
want supervised from a path you control.

| Key | Type | Description |
|---|---|---|
| `id` | string | Plugin ID (matches the plugin's `plugin_id` config) |
| `binary` | string | Path to the plugin binary (relative to `HOMECORE_HOME`) |
| `config` | string | Path to the plugin config file (relative to `HOMECORE_HOME`), passed to the plugin as its first argument |
| `enabled` | boolean | Whether the plugin should be started automatically. Defaults to `true`. |

On first start, core copies each plugin's config file into its own store
at `config/plugins/<id>.toml` and from then on hands the plugin that
copy. The `config` path stays the import source, and `homecore.toml` is
not rewritten.

### `[metrics]`

| Key | Type | Default | Description |
|---|---|---|---|
| `whitelist` | array of strings | `[]` | Source IPs or CIDR ranges allowed to scrape `GET /api/v1/metrics`. Empty, the default, means every caller gets `403`. IPv4 and IPv6. |

Opening the endpoint is always an explicit step. Metrics expose device,
rule and plugin counts, and opening them by default to whatever subnet
the host sits on would widen the attack surface without anyone noticing.
The `403` body names the exact line to add. See
[Metrics](../administration/metrics.md).

### `[registry]`

| Key | Type | Default | Description |
|---|---|---|---|
| `url` | string | none | URL (or local path / `file://`) of the signed `index.json`. |
| `public_key` | string | none | Base64 ed25519 public key that signs the index. |

**Both** must be set, or `/registry/plugins` and `/plugins/install` return
`503`. Core verifies the index signature and each artifact's SHA-256 before
unpacking anything. See [Plugins](../plugins/overview.md).

### `[plugin_runtimes]`

Controls how a container-hosted plugin runtime (for plugins written in
other languages) may enroll with core. The operator runs the container;
core never manages it. These settings only govern joining.

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Master switch. Off means the enrollment endpoints return 404. |
| `mode` | string | `"open"` | `"open"`: a runtime may ask, and an admin approves a matching code. `"token"`: only an admin-issued token enrolls, and nothing is ever pending. |
| `whitelist_only` | bool | `true` | Accept enrollment requests only from `[auth].whitelist` sources. |
| `pending_ttl_mins` | integer | `15` | How long a pending request stays answerable. |
| `max_pending` | integer | `5` | Cap on simultaneous pending requests. |
| `max_denials` | integer | `3` | Denials one identity may collect before it has to wait. |
| `denial_cooldown_mins` | integer | `60` | How long that wait is. |

### `[influx]`

Optional InfluxDB v2 export of device state. Off unless `enabled = true`.

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `false` | Turn the exporter on. |
| `url` | string | none | InfluxDB base URL; writes go to `<url>/api/v2/write`. |
| `token` | string | none | API token with write access to the bucket. |
| `org` / `bucket` | string | none | Influx organisation and bucket. |
| `include_devices` | array of strings | `[]` | Device-id patterns to export. **Opt-in**: empty exports nothing. `["*"]` exports everything. |
| `exclude_attributes` | array of strings | `[]` | Attributes to drop (e.g. `last_seen`). |
| `export_bools` | bool | `true` | Write boolean attributes as `0`/`1`. |
| `flush_interval_secs` | integer | `10` | Flush even when the batch is not full. |
| `batch_size` | integer | `1000` | Maximum points per write. |
| `channel_capacity` | integer | `10000` | Bounded backlog. When it is full, the oldest events are dropped rather than slowing the event bus. |

Each attribute is written as its own measurement, with a single field
called `value` and a `device_id` tag. Area, plugin and device type are
not added as tags; join them from HomeCore's device data if you need
them.

---

## modes.toml reference

Modes live in a separate file, `config/modes.toml` under the base
directory, which core reloads when it changes. API calls that create or
change modes write to the same file. `mode_night` and `mode_day` are
built in: core writes them on first start if they are missing, and the
API won't delete them.

```toml
# Solar modes follow sun events, with optional offsets in minutes
[[modes]]
id        = "mode_night"
name      = "Night Mode"
kind      = "solar"
on_event  = "Sunset"
off_event = "Sunrise"
# on_offset_minutes  = -30   # negative = before the event
# off_offset_minutes = 0

[[modes]]
id        = "mode_day"
name      = "Day Mode"
kind      = "solar"
on_event  = "Sunrise"
off_event = "Sunset"

# Manual modes are on/off flags set by you, the API or rules
[[modes]]
id   = "mode_away"
name = "Away"
kind = "manual"

[[modes]]
id   = "mode_vacation"
name = "Vacation"
kind = "manual"
```

| Key | Description |
|---|---|
| `id` | Mode id. Must start with `mode_` when created through the API. Rules refer to it. |
| `name` | Display name. |
| `kind` | `"solar"` or `"manual"`. |
| `on_event` / `off_event` | Solar only: `Sunrise`, `Sunset`, `SolarNoon`, `CivilDawn` or `CivilDusk`. |
| `on_offset_minutes` / `off_offset_minutes` | Solar only: minutes after the event (negative for before). Default `0`. |

**Solar mode behavior:**
- `mode_night` is on from sunset to sunrise and off during daylight.
- Offsets move the transition: `on_offset_minutes = -30` turns night mode on 30 minutes *before* sunset.
- Each mode is also a device (plugin `core.mode`) with an `on` attribute, so rules can trigger on it and the devices API lists it.

**Mode API:**

```bash
# Get all modes
curl -s http://localhost:8080/api/v1/modes -H "Authorization: Bearer $TOKEN" | jq

# Create a manual mode
curl -s -X POST http://localhost:8080/api/v1/modes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": "mode_away", "name": "Away", "kind": "manual"}'

# Turn a mode on (modes are devices)
curl -s -X PATCH http://localhost:8080/api/v1/devices/mode_away/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'

# Adjust a solar offset (minutes relative to the sun event)
curl -s -X PATCH http://localhost:8080/api/v1/modes/mode_night \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on_offset_minutes": -30}'
```

`PATCH /api/v1/modes/{id}` changes a mode's name, and for a solar mode
its events and offsets. It does not switch a mode on or off; use the
device state call for that.

## Environment variables

Core reads only a few environment variables. Everything else, including
the JWT secret and location, comes from the config file.

| Variable | Effect |
|---|---|
| `HOMECORE_HOME` | Base directory (see [Installation](./installation#override-paths-with-environment-variables)). |
| `HOMECORE_CONFIG` | Config file path. |
| `RUST_LOG` | Log filter; overrides `[logging]` levels. |
| `HC_ALLOW_ANONYMOUS_REMOTE_BROKER` | Set to `1` to allow a non-loopback broker with no clients (see [`[broker]`](#broker)). |

The Docker image's entrypoint reads a few more (`HOMECORE_UID`,
`HOMECORE_GID`, `HC_BROKER_BIND`); see [Docker](./docker).
