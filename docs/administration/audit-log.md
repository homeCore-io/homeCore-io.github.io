---
id: audit-log
title: Audit log
sidebar_label: Audit log
sidebar_position: 5
---

# Audit log

homeCore records administrative actions taken through its REST API: who
acted, what they changed, and when. Use it to find out who turned the
porch rule off, or whether anyone has been guessing passwords.

## What gets recorded

Sign-ins and account activity: successful and failed logins, token
refreshes (and a reused refresh token), signing out, ending sessions,
signing out everywhere, people added and deleted, password and role
changes, PINs set and removed, PIN sign-ins and wrong PINs at a display,
displays made, renamed and removed, and API keys created, changed,
rotated and revoked. That includes the keys homeCore makes for plugins.

Changes to how the house works: rules (create, update, delete, copy,
import, run, repoint, bulk changes) and rule groups, devices, helpers and
modes, rooms (including Room on and Room off, since Room off saves the
room's lights), scenes, alert rules, alert ignores, alert kinds,
acknowledged and pressed alerts, plugins (install, uninstall, start, stop,
restart, turn on or off, settings, log level, running an action, removing
its devices), plugin runtimes (added, removed, key reset), calendars,
backups and restores, homeCore's settings, the temperature unit, a
notification test, opening the broker to the network, restarts, and log
level changes.

Each change entry names what changed (the rule, device, room or scene as
it was called at the time, so a removed one can still be identified) and
which fields the change touched. Field values aren't recorded, because a
plugin's settings can hold passwords. The exception is `enabled`, the
change people ask about most.

Commanding a device, activating a scene and testing a rule are uses, and
aren't recorded. Neither are reads.

Recording is best effort. If writing an entry fails, homeCore logs a
warning and the change still goes ahead, so a problem with the audit
database never blocks a legitimate change.

### Common event types

| Event type | When |
|---|---|
| `auth.login` | A sign-in. Result `denied` for a wrong username or password |
| `auth.refresh` / `auth.refresh.reuse` | A token refresh, or a used refresh token presented again (`denied`, chain revoked) |
| `auth.signed_out`, `auth.session_ended`, `auth.signed_out_everywhere` | Signing out |
| `auth.pin_session` / `auth.pin_failed` | A PIN unlocked a display, or a wrong PIN |
| `user.created`, `user.deleted`, `user.role_changed`, `user.password_changed`, `user.password_reset`, `user.pin_set`, `user.pin_cleared` | Account changes |
| `api_key.created`, `api_key.updated`, `api_key.rotated`, `api_key.revoked` | API keys |
| `display.created`, `display.renamed`, `display.removed` | Displays |
| `automation.*`, `device.*`, `helper.*`, `mode.*`, `area.*`, `scene.*` | Changes to the house |
| `alert_rule.*`, `alert_ignore.*`, `alert_kind.updated`, `alert.acknowledged`, `alert.pressed` | Alerts |
| `plugin.*`, `plugin_runtime.*` | Plugins and runtimes |
| `system.backup_created`, `system.restore_staged`, `system.config_updated`, `system.restart_requested`, `system.log_level_changed` | homeCore itself |
| `broker.opened_to_network` | **Open the broker to the network** on the Plugin runtimes screen |

## Storage

The log has its own SQLite database, next to `history.db`:

```
data/audit.db          # default, sibling of state.redb / history.db
```

A separate file keeps its retention independent of the rest.

Backups don't include `audit.db`, whether made with
[`POST /system/backup`](backup-restore) or on the schedule. A backup holds
what the house is, and the audit log records what happened to it. To keep
audit history, copy `audit.db` yourself.

A background task runs every six hours and deletes entries older than
`[auth].audit_retention_days` (default 365).

## Entry shape

| Field | Description |
|---|---|
| `id` | Row id |
| `ts` | UTC time of the action |
| `actor_type` | `user`, `api_key`, `local_admin`, `system` or `anonymous` (see below) |
| `actor_id` | The person's UUID. For an API key, its owner's UUID |
| `actor_label` | Who acted, such as `user:alex`, `api_key:grafana`, `local_admin:1000`, `system`, or `attempted_username:…` for a failed login |
| `event_type` | Dotted event name, such as `automation.updated` or `auth.login` |
| `scope_used` | The scope that authorized the action, when recorded |
| `target_kind` / `target_id` | What was acted on, such as `automation` and its id |
| `correlation_id` | Links related events from one request, when recorded |
| `ip` / `user_agent` | Where the request came from, when recorded |
| `result` | `success`, `denied` or `error` |
| `detail` | JSON with context: fields touched, counts, names |

Many entries leave `scope_used`, `correlation_id`, `ip` and `user_agent`
empty.

`actor_type` records how the request was authenticated:

- `user`: a person's JWT, from signing in or a PIN
- `api_key`: an `hc_sk_…` key, including display and plugin keys
- `local_admin`: the admin Unix socket, or a request let in by the
  deprecated `[auth].whitelist`
- `system`: homeCore itself, for example a scheduled backup or a plugin
  key it made
- `anonymous`: before authentication; failed logins land here

The filter also accepts `ip_whitelist`, but current versions record
whitelisted requests as `local_admin`.

## Querying

### REST

`GET /api/v1/audit` returns entries newest first. It needs `audit:read`,
which `admin`, `observer`, `device_operator`, `rule_editor` and
`service_operator` carry. The admin socket always passes.

Query parameters, all optional:

| Param | Description |
|---|---|
| `actor_id` | Actor UUID |
| `actor_type` | `user`, `api_key`, `local_admin`, `ip_whitelist`, `system`, `anonymous` |
| `event_type` | Exact name. A trailing `*` matches a prefix (`auth.*` is every sign-in event), and a leading `!` negates (`!auth.*` is everything else) |
| `target_kind` | `automation`, `scene`, `device`, `area`, `plugin`, `user`, and so on |
| `target_id` | Exact target id |
| `result` | `success`, `denied`, `error` |
| `from` | RFC3339 lower bound, inclusive |
| `to` | RFC3339 upper bound, inclusive |
| `limit` | Default 100, maximum 1000 |
| `offset` | For paging |

An unknown `actor_type` or `result`, or a malformed time, returns 400.

```bash
# Successful rule edits in the past 24 hours
curl -s "http://localhost:8080/api/v1/audit?event_type=automation.updated&result=success&from=$(date -u -d '24 hours ago' --iso-8601=seconds)" \
  -H "Authorization: Bearer $TOKEN" | jq

# Failed logins in the past week
curl -s "http://localhost:8080/api/v1/audit?event_type=auth.login&result=denied&from=$(date -u -d '7 days ago' --iso-8601=seconds)" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Web app

The [web app](../web-ui/overview.md) has **Settings › Audit**, also linked
from **Settings › System**. You can filter by who acted, a start date, and
what kind of event (everything, changes only, sign-ins, or refused), and
search by a name, a room or an address. Each row expands to show its
detail, repeats by the same person within a day are grouped, and
**Older** loads further back.

Device and automation pages link to it with `?about=device:<id>` or
`?about=automation:<id>`, which shows the history of that one thing.

### `hc-cli`

```bash
hc-cli audit query --event-type automation.deleted \
  --from "$(date -u -d '24 hours ago' --iso-8601=seconds)"
```

`hc-cli audit query` takes the same filters as the REST endpoint
(`--actor-id`, `--actor-type`, `--event-type`, `--target-kind`,
`--target-id`, `--result`, `--from`, `--to`, `--limit`, `--offset`). Its
`--limit` defaults to 50. Output is a table, or JSON with the global
`--output json`.

## Who can read it

| Role | `audit:read` |
|---|---|
| `admin` | yes |
| `observer` | yes |
| `device_operator` | yes |
| `rule_editor` | yes |
| `service_operator` | yes |
| `user` | no |
| `household_member` | no |
| `read_only` | no |

Roles can't be edited. To let someone read the audit log, give them a
role that carries `audit:read`. An API key can carry it only if its
owner's role does. See [Users & Authentication](./users-auth.md).

## Retention

homeCore keeps 365 days by default. To change it:

```toml
[auth]
audit_retention_days = 90
```

The pruner runs every six hours.

## Implementation notes

- Storage is SQLite in WAL mode, with indexes on `ts`, `actor_id`,
  `event_type`, and `target_kind` with `target_id`.
- One layer over the protected API routes records changes after the
  request succeeds. Routes whose handler writes its own, more detailed
  entry (accounts, keys, displays, calendars, backups, settings,
  uninstalling a plugin, turning one on or off, its log level) are left
  to that handler.
- Recording never blocks the original operation. If you need a second
  copy, forward logs to a syslog server too (see [Logging](./logging.md)).
