---
id: configuration
title: Configuration Reference
sidebar_label: Configuration
sidebar_position: 3
---

# Configuration Reference

homeCore reads one TOML file. By default that is `config/homecore.toml`
under the base directory (the current working directory, or whatever
`--home` or `HOMECORE_HOME` names).

```bash
# Config resolution order:
# 1. --config /path/to/file
# 2. HOMECORE_CONFIG env var
# 3. {base_dir}/config/homecore.toml
```

A relative `--config` or `HOMECORE_CONFIG` path is resolved against the
base directory. So are relative paths inside the file, unless a section
says otherwise.

Start from `config/homecore.toml.example`. Two things to know before you
edit:

- If the file is missing or fails to parse, core logs a warning and uses
  built-in defaults for every section. Those defaults bind the MQTT broker
  to `0.0.0.0` with no logins, which core [refuses to start with](#broker),
  so a typo usually shows up as that error.
- Unknown keys are ignored without a warning. Check spelling against the
  tables below.

Admins can also edit this file in the web app, in **Settings ›
Configuration**. It shows the settings as a form, with the raw TOML and a
restart button. Most changes take effect after a restart. The API behind it
is `GET` and `PUT /api/v1/system/config`.

## Full annotated example

```toml
# ── Server ────────────────────────────────────────────────────────────────────
[server]
host = "0.0.0.0"
port = 8080

# ── MQTT Broker ───────────────────────────────────────────────────────────────
[broker]
# Loopback keeps the broker private to this host; plugins run here too.
# Bind 0.0.0.0 only if plugin runtimes or LAN devices (Tasmota, Shelly,
# ESPHome) need it, and then add [[broker.clients]] below, or core refuses
# to start.
host = "127.0.0.1"
port = 1883
# v5_port = 1884   # MQTT v5 listener (the default); 0 turns it off

# Optional TLS listener (runs alongside the plain-text port)
# tls_port  = 8883
# cert_path = "/etc/homecore/broker.crt"
# key_path  = "/etc/homecore/broker.key"

# Use an external broker (Mosquitto, EMQX) instead of the embedded one.
# external_url = "mqtt://192.168.1.20:1883"

# With [[broker.clients]] entries, the embedded broker asks every client for
# a login. The `allow_pub` / `allow_sub` patterns are NOT enforced by the
# embedded broker. `hc-cli broker generate-mosquitto-config` turns them into
# a Mosquitto ACL file; see Administration › Broker.
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
# Nothing here is required. The signing secret is generated once and kept in
# <state-db-parent>/jwt_secret (0600), so tokens survive restarts with no
# configuration. An inline `jwt_secret` still works and wins, but it is
# deprecated and logs a warning.
token_expiry_hours        = 24     # access token lifetime
refresh_token_expiry_days = 30     # refresh token lifetime
audit_retention_days      = 365

# Addresses that get FULL ADMIN with no token at all. Deprecated. Single
# addresses only: an entry covering a range (such as a /24) is skipped with a
# warning.
# whitelist = ["127.0.0.1"]

# The replacement: an admin-only Unix socket for same-host tools (hc-cli),
# allowed by file permissions instead of network address.
# [auth.admin_uds]
# enabled = true
# path    = "/run/homecore/admin.sock"
# group   = "homecore-admin"
# mode    = "0660"

# ── Location (needed for sunrise and sunset) ─────────────────────────────────
[location]
latitude  = 38.9072
longitude = -77.0369
timezone  = "America/New_York"
# temperature_unit = "°F"   # for notifications and alert messages; default °C

# ── Storage ───────────────────────────────────────────────────────────────────
# Paths are relative to base_dir unless absolute.
[storage]
state_db_path   = "data/state.redb"   # device registry, rules, users, scenes
history_db_path = "data/history.db"   # time-series attribute history

# ── Rules ─────────────────────────────────────────────────────────────────────
[rules]
# Folder of rule RON files. Reloaded on any change.
dir = "rules"

# ── Scheduler ─────────────────────────────────────────────────────────────────
[scheduler]
# On restart, fire time triggers that were missed within this window.
# 0 turns catch-up off.
catchup_window_minutes = 15

# ── Startup ───────────────────────────────────────────────────────────────────
[startup]
# Seconds to wait after startup before modes publish their first states,
# so plugins have time to connect and subscribe.
plugin_ready_delay_secs = 10

# ── Modes ─────────────────────────────────────────────────────────────────────
# Not a section here. Modes live in <base_dir>/config/modes.toml, a fixed
# path that is reloaded on change. See the modes.toml reference below.

# ── Calendars ─────────────────────────────────────────────────────────────────
# [calendars]
# dir = "config/calendars"   # folder of .ics files; reloaded on change
# expansion_days = 400       # how far ahead to expand repeating events

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
smtp_host = "smtp.example.com"
smtp_port = 587
username  = "homecore@example.com"
password  = "smtp-password"
from      = "homecore@example.com"
to        = ["you@example.com"]
starttls  = true

# ── Alerts ────────────────────────────────────────────────────────────────────
# Where core sends the alerts it raises itself (wet, smoke, jammed, offline).
# Unset: alerts show in the app but aren't sent.
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
prune_after_days = 30    # delete rotated files older than N days; 0 = never

# A second log file for the rule engine alone, so the rule trace isn't mixed
# in with everything else.
[logging.rules_file]
enabled          = false
dir              = "logs"
prefix           = "rules"
rotation         = "daily"
prune_after_days = 30

# Each plugin's log is sent over the broker on `homecore/plugins/<id>/logs`
# and merged into core's /logs/stream. Set a plugin's level in the app
# (Settings › Plugins, then the plugin) or with PATCH /api/v1/plugins/{id},
# not in this file.

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
# path. Off by default, and left off in the standard install, where the web
# app runs in its own container.
[web_admin]
enabled = false
# dist_path = "ui/dist"     # bundle directory, relative to the home dir

# ── Shutdown ──────────────────────────────────────────────────────────────────
[shutdown]
drain_timeout_secs = 10   # wait this long for running rule actions, then stop

# ── Plugins you run from your own path ───────────────────────────────────────
# Plugins installed from the Catalog don't go here. Each [[plugins]] entry is
# a plugin you unpacked or built yourself for homeCore to supervise.
# [[plugins]]
# id      = "plugin.hue"
# binary  = "plugins/hc-hue/bin/hc-hue"    # relative to HOMECORE_HOME
# config  = "plugins/hc-hue/config/config.toml"
# enabled = true

# ── Ecosystem profiles ────────────────────────────────────────────────────────
# Topic maps for devices that speak their own dialect (Tasmota, Shelly,
# Zigbee2MQTT). Reference profiles ship in config/profiles/examples/.
[profiles]
dir = "config/profiles"

# ── Prometheus metrics ────────────────────────────────────────────────────────
# GET /api/v1/metrics is allowed by source address, and the list is empty by
# default, so every caller gets 403. This grants nothing but the metrics
# text, and ranges are allowed.
[metrics]
whitelist = ["127.0.0.1/32"]

# ── Plugin registry ───────────────────────────────────────────────────────────
# Both must be set for the Catalog and installs to work; otherwise those
# endpoints return 503.
[registry]
url        = "https://homecore.io/registry/index.json"
public_key = "d64zXOo99GE+uYAPbtbIwLUJHtBaACJB73cUppj93I8="

# ── InfluxDB v2 export (optional) ─────────────────────────────────────────────
# Sends numeric and boolean device attributes to InfluxDB, one measurement
# per attribute. include_devices is opt-in: an empty list exports nothing,
# and ["*"] exports everything. The queue is bounded and drops the oldest
# points instead of slowing down the house.
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
| `host` | string | `"0.0.0.0"` | Address the HTTP and WebSocket API binds |
| `port` | integer | `8080` | Port it listens on |

### `[broker]`

The MQTT broker. By default core runs its embedded broker, and core's own
MQTT client connects to it on `127.0.0.1` at `port`. With `external_url`
set, core uses that broker instead and doesn't start the embedded one.

| Key | Type | Default | Description |
|---|---|---|---|
| `host` | string | `"0.0.0.0"` | Broker bind address. The example config sets `"127.0.0.1"`. |
| `port` | integer | `1883` | Plain-text MQTT v3.1.1 port |
| `v5_port` | integer | `1884` | Plain-text MQTT v5 port, for devices such as Shelly Gen2/Gen3. `0` turns it off. |
| `tls_port` | integer | none | TLS MQTT port (needs `cert_path` and `key_path`) |
| `cert_path` | string | none | TLS certificate file (PEM) |
| `key_path` | string | none | TLS private key file (PEM) |
| `external_url` | string | none | An external broker (Mosquitto, EMQX) as `mqtt://host:port`, used instead of the embedded one. The port defaults to `1883`. `tcp://host:port` and a bare `host:port` also work. `mqtts://` is refused at startup. The settings form calls it "External broker". |

Core refuses to start when `host` isn't a loopback address and there are no
`[[broker.clients]]` entries, because that would be an open broker on the
network. Bind `127.0.0.1`, add logins, or, on a network you have closed off
some other way, set the environment variable
`HC_ALLOW_ANONYMOUS_REMOTE_BROKER=1`. Core then logs an error at startup and
carries on. A broker port that is already in use also stops core at
startup, with an error naming the port.

The Plugin runtimes screen in the app (Settings › Plugins › Plugin runtimes)
can open the broker for you: **Open the broker to the network** sets
`host = "0.0.0.0"`, adds a login for core if there is none, and restarts.

When `external_url` is set, `host`, `port`, `v5_port` and the TLS keys go
unused, and the open-broker check doesn't apply. Core's own client logs in
as `internal.core` with that entry's password from `[[broker.clients]]`.
Plugins installed from the Catalog are given the external address; point
plugins you already have at it in their own settings. See
[External Mosquitto deployment](../administration/broker#external-mosquitto-deployment).

`[[broker.clients]]` entries:

| Key | Type | Description |
|---|---|---|
| `id` | string | Client ID, used as the MQTT username |
| `password` | string | Plain-text password |
| `allow_pub` | array of strings | Topic patterns it may publish to (MQTT wildcards `+` and `#` work) |
| `allow_sub` | array of strings | Topic patterns it may subscribe to |

Core's own client uses the entry with `id = "internal.core"`, so once you
add any clients, add that one too. With clients listed, the broker also
accepts the logins core makes itself: each plugin runtime's, and the one in
each installed plugin's settings.

:::warning
The embedded broker checks logins but does not enforce per-topic access: it records `allow_pub` and `allow_sub` and ignores them. `hc-cli broker generate-mosquitto-config` turns them into a Mosquitto ACL file; see [the broker deployment guide](../administration/broker#external-mosquitto-deployment).
:::

### `[storage]`

| Key | Type | Default | Description |
|---|---|---|---|
| `state_db_path` | string | `"data/state.redb"` | The redb state database (devices, rules, users, scenes, plugin runtimes, battery latches). Relative to `HOMECORE_HOME`. |
| `history_db_path` | string | `"data/history.db"` | The SQLite history database. |

### `[profiles]`

| Key | Type | Default | Description |
|---|---|---|---|
| `dir` | string | `"config/profiles"` | Folder of ecosystem profile TOML files (Tasmota, Shelly, Zigbee2MQTT and others) that map their topics to homeCore's. Core also reads the device type registry from `device-types.toml` in this folder. |

Topic maps belong in these profile files. A `[[topic_map]]` block in
`homecore.toml` is not read. See [Topic mapper](../development/topic-mapper).

### `[rules]`

| Key | Type | Default | Description |
|---|---|---|---|
| `dir` | string | `"rules"` | Folder of `.ron` rule files (old `.toml` rules still load). Reloaded on change. |

### `[auth]`

| Key | Type | Default | Description |
|---|---|---|---|
| `jwt_secret` | string | unset | **Deprecated.** An inline signing secret. If set, it wins over `jwt_secret_file` and logs a warning. |
| `jwt_secret_file` | string | `<parent-of-state_db_path>/jwt_secret` | A `0600` file holding the signing secret. Generated on first start so tokens survive restarts. |
| `token_expiry_hours` | integer | `24` | Access token lifetime in hours. |
| `refresh_token_expiry_days` | integer | `30` | Refresh token lifetime. Each `/auth/refresh` replaces the token, and reusing an old one ends the whole session. |
| `audit_retention_days` | integer | `365` | Days of audit history to keep. Older entries are removed every 6 hours. |
| `whitelist` | array of strings | `[]` | **Deprecated.** Source addresses that skip sign-in and get admin access. IPv4 and IPv6, written bare (`"192.168.1.20"`) or as a single-host prefix (`"192.168.1.20/32"`, `"::1/128"`). An entry covering a range is skipped with a warning. Use `[auth.admin_uds]` for same-host tools instead. |
| `initial_admin_password_file` | string | `<base_dir>/INITIAL_ADMIN_PASSWORD` | Where the first-boot admin password is written, `0600`. A relative path is resolved against the base directory. Set `""` to only log the password. Written only when no users exist. |

`[auth.admin_uds]` is a Unix socket for admin tools on the same host. It
replaces `whitelist`.

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `false` | Listen on the admin socket. |
| `path` | string | `"/run/homecore/admin.sock"` | Socket path. |
| `group` | string | `"homecore-admin"` | Group that owns the socket. Its members can connect. |
| `mode` | string (octal) | `"0660"` | File permissions on the socket. An invalid value turns the socket off with a warning. |
| `allowed_uids` | array of integers | `[]` | Extra user IDs allowed to connect. Core's own user is always allowed. |

### `[location]`

Needed for sunrise and sunset triggers and solar modes.

| Key | Type | Description |
|---|---|---|
| `latitude` | float | Decimal degrees, such as `38.9072` |
| `longitude` | float | Decimal degrees, such as `-77.0369` |
| `timezone` | string | IANA time zone name, such as `"America/New_York"` |
| `temperature_unit` | string | `"°C"` or `"°F"` (`"C"`, `"F"`, `"celsius"` and `"fahrenheit"` also work). What notifications and alert messages show temperatures in. Devices and rules always keep °C. Unset or unreadable means °C. |

If the section is missing, core uses latitude `38.9072` and longitude
`-77.0369`. `timezone` sets every time people see, in logs and the API's
local times; storage stays in UTC. If it is unset or can't be read, core
uses UTC and logs why at startup.

The app's own setting, Settings › System › Units and region, sets the
household's temperature unit for the app and for notifications too.

### `[battery]`

Settings for the battery watcher. It raises `device_battery_low` and
`device_battery_recovered` events from device state changes. It latches at
`threshold_pct` and clears at `threshold_pct + recover_band_pct`, so a
battery hovering at the line doesn't flap. See
[Battery monitoring](../devices/battery-monitoring.md).

| Key | Type | Default | Description |
|---|---|---|---|
| `threshold_pct` | float | `20.0` | Battery percentage at or below which it latches. |
| `recover_band_pct` | float | `5.0` | Added to the threshold to clear the latch. |
| `notify_channel` | string | unset | A notification channel. When set, each low battery is sent there, with no rule needed. |
| `notify_on_recovered` | bool | `false` | With `notify_channel` set, also send a message when a battery recovers. |

```toml
[battery]
threshold_pct       = 20.0
recover_band_pct    = 5.0
# notify_channel       = "all"
# notify_on_recovered  = false
```

### `[alerts]`

What core does with the alerts it raises itself, such as wet, smoke, jammed
or offline.

| Key | Type | Default | Description |
|---|---|---|---|
| `notify_channel` | string | unset | A notification channel (or `"all"`) to send each built-in alert to. Unset means alerts show in the app but aren't sent. Low battery uses `[battery].notify_channel` instead. |

### `[backup]`

Backups core makes on a schedule. Each is the same zip archive that
`POST /api/v1/system/backup` and Settings › Data & backups produce; see
[Backup & Restore](../administration/backup-restore).

| Key | Type | Default | Description |
|---|---|---|---|
| `every_hours` | integer | `24` | How often to make one. `0` turns scheduled backups off. |
| `keep` | integer | `7` | How many to keep. Older ones are deleted. |
| `dir` | string | `"backups"` | Where they go, relative to the base directory. |

`GET /api/v1/system/backups` lists the kept backups, and
`GET /api/v1/system/backups/{name}` downloads one.

### `[scheduler]`

| Key | Type | Default | Description |
|---|---|---|---|
| `catchup_window_minutes` | integer | `15` | On restart, fire missed time triggers (`SunEvent`, `TimeOfDay`) from within this many minutes. `0` turns it off. |

### `[startup]`

| Key | Type | Default | Description |
|---|---|---|---|
| `plugin_ready_delay_secs` | integer | `10` | How long modes wait before publishing their first states, so plugins have subscribed before commands arrive. Raise it if a plugin is slow to start. |

### `[shutdown]`

| Key | Type | Default | Description |
|---|---|---|---|
| `drain_timeout_secs` | integer | `10` | Seconds to wait for running rule actions to finish on shutdown before stopping anyway. |

### `[logging]`

Top-level keys:

| Key | Type | Default | Description |
|---|---|---|---|
| `level` | string | `"info"` | Global log level (`error`, `warn`, `info`, `debug`, `trace`). |
| `targets` | table of string to string | `{}` | Levels per module, keyed by Rust module path with underscores (such as `hc_core = "debug"`). Same syntax as `RUST_LOG`. |
| `time_display` | string | `"local"` | Timestamps in `"local"` time or `"utc"`. |

When the `RUST_LOG` environment variable is set, it overrides these levels
for stderr and file output. Settings › System in the app can also change
core's log level while it runs.

`[logging.stderr]`:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Write to stderr. |
| `format` | string | `"pretty"` | `"pretty"`, `"compact"` or `"json"`. |
| `ansi` | bool | `true` | Color codes (set `false` when writing to the systemd journal). |

`[logging.file]` controls the rolling log file:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Write a rolling log file. |
| `dir` | string | `"logs"` | Log folder (created if missing). |
| `prefix` | string | `"homecore"` | The current file is `<prefix>.log`. Rotated files become `<prefix>.<period>.log` (for daily rotation, `homecore.YYYY-MM-DD.log`). |
| `rotation` | string | `"daily"` | `"daily"`, `"hourly"`, `"weekly"` or `"never"`. |
| `max_size_mb` | integer | `100` | Also rotate at this size, whichever comes first. `0` turns size rotation off. |
| `compress` | bool | `true` | Gzip rotated files. |
| `prune_after_days` | integer | `0` | Delete rotated files older than this many days. `0` keeps them all. |
| `format` | string | `"json"` | `"json"`, `"compact"` or `"pretty"`. |

These defaults apply when `homecore.toml` has no `[logging.file]` table.
Once you add the table, `enabled` defaults to `false` and `format` to
`"pretty"`, so set both yourself. The example config does.

`[logging.rules_file]` is a separate log for the rule engine. It records
only `hc_core` at `debug`, whatever the global level, and is off by
default. It takes the same keys as `[logging.file]`, with its own defaults
(prefix `"rules"`, format `"pretty"`), and uses the `[logging.file]` folder
when `dir` is unset.

`[logging.stream]` controls the live `/api/v1/logs/stream` WebSocket that
Settings › Logs reads:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Turn the stream on. |
| `ring_buffer_size` | integer | `500` | Recent lines kept for new viewers. |

`[logging.syslog]` sends logs to a syslog server:

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `false` | Turn syslog output on. |
| `transport` | string | `"udp"` | `"udp"` (recommended) or `"tcp"`. |
| `host` | string | `"127.0.0.1"` | Syslog server. |
| `port` | integer | `514` | Syslog port. |
| `protocol` | string | `"rfc5424"` | `"rfc5424"` or `"rfc3164"`. |
| `facility` | string | `"user"` | Syslog facility name (`daemon`, `local0` to `local7`, …). |
| `app_name` | string | `"homecore"` | App name in each message. |
| `level` | string | global level | Level for syslog only. For example, send `warn` and above to the server while keeping `debug` locally. |

### `[notify]`

Channels go in a list under `[[notify.channels]]`. A rule's `Notify` action
names a channel by its `name`. The reserved name `"all"` sends to every
channel. Settings › Notifications in the app lists the channels, sends a
test, and shows which automations use each.

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

The built-in types are `email` (SMTP), `pushover` and `telegram`. Optional
fields:

- `email`: `smtp_port` defaults to `587` and `starttls` to `true`. Set
  `starttls = false` for implicit TLS on port 465.
- `pushover`: `device` (send to one device), `priority` (`-2` to `2`), and
  for emergency priority, `retry` (seconds, at least 30, default 60) and
  `expire` (seconds, at most 10800, default 3600).
- `telegram`: `markdown = true` sends messages as MarkdownV2.

A Telegram channel still set to the placeholder `CHANGE_ME` stops core from
starting, so a forgotten placeholder shows up at once. Other channels that
fail to start are logged and skipped, and the rest of the system carries on.

### `[web_admin]`

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `false` | Serve a folder of static files from core's root path. |
| `dist_path` | string | none | The folder, relative to `HOMECORE_HOME`. |

When it's on, core serves that folder at `/`. API routes under `/api/v1`
come first, and anything else falls back to `index.html`.

It is off by default, and the standard install leaves it off. The web app
is [`hc-web-svelte`](../web-ui/overview.md), which runs in its own container
and passes `/api/v1` through to core. This section stays as a generic
static mount for anyone hosting their own bundle.

### `[calendars]`

| Key | Type | Default | Description |
|---|---|---|---|
| `dir` | string | `"config/calendars"` | Folder of `.ics` calendar files. Reloaded on change. You can also add calendars in Settings › Data & backups. |
| `expansion_days` | integer | `400` | How many days ahead to expand repeating events. |

### Helpers (glue devices)

Helper definitions can also live in `<base>/config/glue.toml`, a fixed path
that `homecore.toml` can't change. Devices listed there are created at
startup if they don't already exist. Most people add helpers in Settings ›
Helpers instead. See [Virtual devices](../devices/virtual-devices.md) for
the file format.

### `[[plugins]]`

Each entry declares a plugin for homeCore to supervise: start it, watch its
heartbeat, stop and restart it, and hand it its settings.

You rarely need one. A plugin installed from the Catalog records itself in
`config/plugins/managed.toml`, which homeCore owns; your `homecore.toml` is
never touched. At startup, the plugins core runs are the entries here plus
the managed records, minus any that have been uninstalled. A managed record
wins when both name the same id, so uninstalling a plugin declared here
sticks without homeCore editing your file. Plugins on a
[plugin runtime](../plugins/runtimes.md) never appear here.

Write a `[[plugins]]` block for a plugin you built or unpacked yourself and
want run from a path you control.

| Key | Type | Description |
|---|---|---|
| `id` | string | Plugin ID (matches the plugin's `plugin_id` setting) |
| `binary` | string | Path to the plugin binary (relative to `HOMECORE_HOME`) |
| `config` | string | Path to the plugin's config file (relative to `HOMECORE_HOME`), passed to the plugin as its first argument |
| `enabled` | boolean | Whether the plugin starts automatically. Defaults to `true`. |

On first start, core copies each plugin's config file into its own store at
`config/plugins/<id>.toml` and from then on gives the plugin that copy. The
`config` path stays the import source, and `homecore.toml` isn't rewritten.
When a plugin's settings change, from the app or the file, core restarts the
plugin to use them. A change to only its `[logging] level`, or only to
comments or spacing, doesn't restart it; the app sends a new log level to the
running plugin instead.

### `[metrics]`

| Key | Type | Default | Description |
|---|---|---|---|
| `whitelist` | array of strings | `[]` | Source addresses or CIDR ranges allowed to read `GET /api/v1/metrics`. Empty, the default, means every caller gets `403`. IPv4 and IPv6. |

Metrics show device, rule and plugin counts, so opening them is always a
step you take yourself. The `403` response names the exact line to add. See
[Metrics](../administration/metrics.md).

### `[registry]`

| Key | Type | Default | Description |
|---|---|---|---|
| `url` | string | none | URL (or local path, or `file://`) of the signed `index.json`. |
| `public_key` | string | none | Base64 ed25519 public key that signs the index. |

Both must be set, or the Catalog can't load and `/registry/plugins` and
`/plugins/install` return `503`. Core checks the index signature and each
artifact's SHA-256 before unpacking anything. See
[Plugins](../plugins/overview.md).

### `[plugin_runtimes]`

Plugin runtimes are containers you run yourself that host plugins written
in Python. You add one on the **Plugin runtimes** screen (a button on
**Settings › Plugins**), which shows the key to paste into it. See
[Plugin Runtimes](../plugins/runtimes.md).

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Off makes the runtime endpoints return 404. |

Older files may still have `mode`, `whitelist_only` and pending or denial
limits from when runtimes asked to join. They are ignored and can be
deleted.

### `[influx]`

Optional InfluxDB v2 export of device state. Off unless `enabled = true`.

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `false` | Turn the export on. |
| `url` | string | none | InfluxDB base URL. Writes go to `<url>/api/v2/write`. |
| `token` | string | none | API token with write access to the bucket. |
| `org` / `bucket` | string | none | InfluxDB organization and bucket. |
| `include_devices` | array of strings | `[]` | Device ID patterns to export. Opt-in: empty exports nothing, and `["*"]` exports everything. |
| `exclude_attributes` | array of strings | `[]` | Attributes to leave out (such as `last_seen`). |
| `export_bools` | bool | `true` | Write boolean attributes as `0` and `1`. |
| `flush_interval_secs` | integer | `10` | Send a batch at least this often, even when it isn't full. |
| `batch_size` | integer | `1000` | Most points per write. |
| `channel_capacity` | integer | `10000` | How many points can wait. When it's full, the oldest are dropped. |

Each attribute is written as its own measurement, with one field called
`value` and a `device_id` tag. Area, plugin and device type are not tags;
join them from homeCore's device data if you need them.

## modes.toml reference

Modes live in a separate file, `config/modes.toml` under the base
directory, which core reloads when it changes. The API and Settings › Modes
write to the same file. `mode_night` and `mode_day` are built in: core
writes them on first start if they're missing, and the API won't delete
them.

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

How solar modes behave:

- `mode_night` is on from sunset to sunrise and off in daylight.
- Offsets move the change: `on_offset_minutes = -30` turns night mode on 30
  minutes before sunset.
- Each mode is also a device (plugin `core.mode`) with an `on` attribute, so
  rules can trigger on it and the devices API lists it.

The mode API:

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

`PATCH /api/v1/modes/{id}` changes a mode's name, and for a solar mode its
events and offsets. It doesn't switch a mode on or off; use the device
state call for that.

## Environment variables

Core reads only a few environment variables. Everything else, including the
signing secret and location, comes from the config file.

| Variable | Effect |
|---|---|
| `HOMECORE_HOME` | Base directory (see [Installation](./installation#override-paths-with-environment-variables)). |
| `HOMECORE_CONFIG` | Config file path. |
| `RUST_LOG` | Log filter; overrides the `[logging]` levels. |
| `HC_ALLOW_ANONYMOUS_REMOTE_BROKER` | Set to `1` to allow a non-loopback broker with no clients (see [`[broker]`](#broker)). |

The Docker image's entrypoint reads a few more (`HOMECORE_UID`,
`HOMECORE_GID`, `HC_BROKER_BIND`); see [Docker](./docker). The web app's
server has its own; see the
[Web UI overview](../web-ui/overview#ui-server-settings).
