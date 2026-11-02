---
id: system-status
title: System Status
sidebar_label: System Status
sidebar_position: 6
---

# System Status

## GET /api/v1/system/status

Returns the running version, uptime, counts, database sizes and the time
of the last backup. Any authenticated caller can read it; no particular
scope is needed.

```bash
curl -s http://localhost:8080/api/v1/system/status \
  -H "Authorization: Bearer $TOKEN" | jq
```

Example response:

```json
{
  "version": "0.1.96",
  "uptime_seconds": 86400,
  "started_at": "2026-11-01T08:00:00Z",
  "rules_total": 67,
  "rules_enabled": 61,
  "devices_total": 142,
  "plugins_active": 4,
  "state_db_bytes": 4194304,
  "history_db_bytes": 52428800,
  "timezone": "America/New_York",
  "last_backup_at": "2026-11-02T03:00:00Z"
}
```

| Field | Description |
|---|---|
| `version` | homeCore binary version |
| `uptime_seconds` | Seconds since the last start |
| `started_at` | When homeCore last started (UTC) |
| `rules_total` | Rules loaded (enabled and disabled) |
| `rules_enabled` | Rules currently enabled and evaluating |
| `devices_total` | Devices in the registry |
| `plugins_active` | Plugins whose status is `active` |
| `state_db_bytes` | Size of `data/state.redb` in bytes |
| `history_db_bytes` | Size of `data/history.db` in bytes |
| `timezone` | The time zone homeCore is using |
| `last_backup_at` | Time of the most recent backup in the audit log, or `null` |

`last_backup_at` is read from the audit log, which is pruned after
`[auth].audit_retention_days`. So `null` means no backup has been recorded
in that window, which isn't the same as never having had one.

Two public endpoints need no token: `GET /api/v1/health` returns
`{"status":"ok","version":"..."}`, and `GET /api/v1/system/versions`
lists the versions of the installed components.

## Stale device reference detection

`GET /api/v1/automations/stale-refs` returns rules that reference devices
no longer in the registry. Use it to find broken automations after
removing a device or changing a plugin.

```bash
curl -s http://localhost:8080/api/v1/automations/stale-refs \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## Dynamic log level

You can change the server's log filter at runtime without a restart:

```bash
curl -s -X PUT http://localhost:8080/api/v1/system/log-level \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"level": "info,hc_core=debug"}'
```

See [Logging: Log level API](./logging#log-level-api) for details.

---

## Graceful shutdown

homeCore handles `SIGINT` and `SIGTERM` with a graceful shutdown:

1. The signal is received and logged.
2. The rule engine stops taking new events and waits for in-flight action
   tasks to finish.
3. If those tasks don't finish within `drain_timeout_secs`, it stops
   anyway.
4. The HTTP server stops accepting new connections and drains existing
   ones.
5. The process exits.

A stop by signal exits with code 0.

`POST /api/v1/system/restart` (admin only) runs the same shutdown and
exits with code 75 (`EX_TEMPFAIL`), leaving it to the supervisor to start
homeCore again. systemd's `Restart=on-failure`, launchd's `KeepAlive` and
Docker's restart policies all restart on that code; see
[Systemd Deployment](./systemd-deployment). Before v0.1.97 it exited with
code 0, which `Restart=on-failure` treats as a clean stop.

### Configuration

```toml
# homecore.toml
[shutdown]
drain_timeout_secs = 10   # default: 10 seconds
```

### Sending a shutdown signal

```bash
# By process name
pkill homecore

# By PID
kill -SIGTERM $(pgrep homecore)

# Graceful from systemd
sudo systemctl stop homecore
```

### Checking for a clean shutdown in the logs

```
INFO homecore: Received SIGINT — initiating graceful shutdown
INFO hc_core::engine: Rule engine: shutdown signal received — stopping event loop
INFO hc_core::scheduler: Scheduler: shutdown signal received — stopping
INFO hc_core::engine: Rule engine stopped
INFO hc_api: API server: shutdown signal received — draining connections
```

If you see `shutdown drain timed out — forcing stop`, an in-flight action
(a slow HTTP call, for example) didn't finish within the drain window.
That is usually harmless. If you have rules with long-running external
calls, increase `drain_timeout_secs`.
