---
id: system-status
title: System Status
sidebar_label: System Status
sidebar_position: 6
---

# System Status

## GET /api/v1/system/status

Returns current system health, counts, and database sizes. Requires `devices:read` scope.

```bash
curl -s http://localhost:8080/api/v1/system/status \
  -H "Authorization: Bearer $TOKEN" | jq
```

Example response:

```json
{
  "version": "0.1.0",
  "uptime_secs": 86400,
  "devices_total": 142,
  "rules_total": 67,
  "rules_enabled": 61,
  "plugins_active": 4,
  "state_db_bytes": 4194304,
  "history_db_bytes": 52428800
}
```

| Field | Description |
|---|---|
| `version` | HomeCore binary version |
| `uptime_secs` | Seconds since last start |
| `devices_total` | Total devices in the registry |
| `rules_total` | Total rules loaded (enabled + disabled) |
| `rules_enabled` | Rules currently enabled and evaluating |
| `plugins_active` | Plugins with a registered, non-expired heartbeat |
| `state_db_bytes` | Size of `data/state.redb` in bytes |
| `history_db_bytes` | Size of `data/history.db` in bytes |

## Graceful shutdown

HomeCore handles `SIGINT` and `SIGTERM` with a graceful shutdown sequence:

1. Signal received — log the event
2. Rule engine stops accepting new events — waits for in-flight action tasks to complete
3. Drain timeout: if in-flight tasks don't complete within `drain_timeout_secs`, force-stop
4. HTTP server stops accepting new connections — drains existing ones
5. Process exits

### Configuration

```toml
# homecore.toml
[engine]
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

### Verifying clean shutdown in logs

```
INFO homecore: Received SIGINT — initiating graceful shutdown
INFO hc_core::engine: Rule engine: shutdown signal received — stopping event loop
INFO hc_core::scheduler: Scheduler: shutdown signal received — stopping
INFO hc_core::engine: Rule engine stopped
INFO hc_api: API server: shutdown signal received — draining connections
```

If you see `drain timed out — forcing stop`, it means an in-flight action (e.g. a slow HTTP call) didn't complete within the drain window. This is generally harmless but increase `drain_timeout_secs` if you have rules with long-running external calls.

### In-flight tasks metric

```bash
# Check via metrics endpoint while HomeCore is running
curl http://localhost:8080/metrics | grep in_flight
```

A count > 0 means rules are currently executing actions. Wait for this to drop before force-killing.
