---
id: system-status
title: System Status
sidebar_label: System Status
sidebar_position: 6
---

# System Status

In the web app, **Settings › System** shows the version, health and
storage, with tiles for homeCore, plugins, devices, alerts, the last backup
and storage. It also has the log level, **Units and region**, links to
**Logs**, **Events** and **Audit**, and **Restart homeCore…**. The
endpoints below are what it reads.

## GET /api/v1/system/status

Returns the running version, uptime, counts, database sizes and the time
of the last backup. Anyone signed in can read it; no particular scope is
needed.

```bash
curl -s http://localhost:8080/api/v1/system/status \
  -H "Authorization: Bearer $TOKEN" | jq
```

Example response:

```json
{
  "version": "0.1.114",
  "uptime_seconds": 86400,
  "started_at": "2026-11-16T08:00:00Z",
  "rules_total": 67,
  "rules_enabled": 61,
  "devices_total": 142,
  "plugins_active": 4,
  "state_db_bytes": 4194304,
  "history_db_bytes": 52428800,
  "timezone": "America/New_York",
  "temperature_unit": "°F",
  "last_backup_at": "2026-11-17T03:00:00Z"
}
```

| Field | Description |
|---|---|
| `version` | homeCore's version |
| `uptime_seconds` | Seconds since the last start |
| `started_at` | When homeCore last started (UTC) |
| `rules_total` | Rules loaded, on and off |
| `rules_enabled` | Rules that are on |
| `devices_total` | Devices in the registry |
| `plugins_active` | Plugins whose status is `active` |
| `state_db_bytes` | Size of the state database (`data/state.redb`) |
| `history_db_bytes` | Size of the history database (`data/history.db`) |
| `timezone` | The time zone homeCore uses, from `[location].timezone` (UTC when unset) |
| `temperature_unit` | The household's unit for messages and alerts, `°C` or `°F` |
| `last_backup_at` | Time of the latest backup in the audit log, or `null` |

`last_backup_at` comes from the audit log, which is pruned after
`[auth].audit_retention_days`. So `null` means no backup was recorded in
that window, which isn't the same as never.

## Public endpoints

Two endpoints need no token:

- `GET /api/v1/health` returns `{"status":"ok","version":"..."}`.
- `GET /api/v1/system/versions` lists the installed components'
  versions, from `/opt/homecore/versions.json` when that file exists, and
  otherwise just `{"core": "..."}`.

## Other checks

`GET /api/v1/automations/stale-refs` (needs `automations:read`) returns
rules that point at devices no longer in the registry. Use it after
removing a device or changing a plugin.

```bash
curl -s http://localhost:8080/api/v1/automations/stale-refs \
  -H "Authorization: Bearer $TOKEN" | jq
```

`GET /api/v1/system/vocabulary-check` (needs `devices:read` and
`automations:read`) checks automations, scenes and devices against what
each device accepts and the shared attribute names. It only reports.

`GET /api/v1/ws/connections` (admin) lists every open event and log
stream: who opened it, from where, and when. Use it to tell one client
reconnecting in a loop from many clients.

`GET /api/v1/system/temperature-unit` returns the household's unit, and
an admin changes it with `PUT`, or under **Units and region** in the app.

## Log level

You can change the server's log filter while it runs:

```bash
curl -s -X PUT http://localhost:8080/api/v1/system/log-level \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"level": "info,hc_core=debug"}'
```

See [Logging](./logging#changing-the-level-while-running) for details.

## Shutdown and restart

homeCore shuts down gracefully on `SIGINT` and `SIGTERM`:

1. It logs the signal.
2. The rule engine stops taking new events and waits for running actions
   to finish.
3. If they don't finish within `drain_timeout_secs`, it stops anyway.
4. The HTTP server stops accepting connections and drains the open ones.
5. The process exits with code 0.

Plugins homeCore started stop with it. Since v0.1.107 each one also
exits by itself if the homeCore that started it dies, and plugins built on
current SDKs mark their devices offline when they stop.

`POST /api/v1/system/restart` (admin), or **Restart homeCore…** in the
app, runs the same shutdown and exits with code 75 (`EX_TEMPFAIL`). The
supervisor then starts homeCore again: systemd's `Restart=on-failure`,
launchd's `KeepAlive` and Docker's restart policies all do. See
[Systemd Deployment](./systemd-deployment). Before v0.1.97 it exited with
code 0, which `Restart=on-failure` treats as a clean stop. Restarts are
recorded in the audit log as `system.restart_requested`.

### Configuration

```toml
# homecore.toml
[shutdown]
drain_timeout_secs = 10   # default
```

### Stopping homeCore

```bash
# Under systemd
sudo systemctl stop homecore

# By process
kill -SIGTERM $(pgrep -x homecore)
```

### Checking for a clean shutdown

The log shows `Received SIGTERM` (or `SIGINT`), then the rule engine,
scheduler and API server each reporting that they are stopping, and ends
with `homeCore shutdown sequence complete`.

If you see `shutdown drain timed out`, a running action (a slow HTTP call,
for example) didn't finish within the drain window. That is usually
harmless. If you have rules with slow external calls, raise
`drain_timeout_secs`.
