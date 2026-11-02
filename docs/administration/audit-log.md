---
id: audit-log
title: Audit log
sidebar_label: Audit log
sidebar_position: 5
---

# Audit log

homeCore keeps an audit log of administrative actions taken through its
REST API: who acted, what they changed, and when. Use it to answer
questions like "who turned the porch rule off?" or "has anyone been
guessing passwords?".

## What gets recorded

Two kinds of event are recorded.

Sign-ins and account activity: successful and failed logins, token
refreshes (including a reused refresh token), signing out, ending
sessions, user creation and deletion, password and role changes, display
PINs, and API key creation, changes, rotation and revocation.

Changes to how the house works: rules (create, update, delete, copy,
import, run, repoint) and rule groups, devices, helpers and modes, rooms,
scenes, alert rules and alert acknowledgements, plugins (install, start,
stop, restart, config changes, running a plugin action, removing its
devices), plugin-runtime approvals, displays, calendars, backups and
restores, homeCore's settings, restarts, and log level changes.

Each change entry names what changed (the rule, device, room or scene as
it was called at the time, so a removed one can still be identified) and
which fields the change touched. Field *values* are not recorded, because
a plugin's settings can hold passwords. The exception is `enabled`, the
change people ask about most often.

Commanding a device, activating a scene and testing a rule are uses, not
changes, and are not recorded. Reads are not recorded either.

Recording is best-effort. If writing an entry fails, homeCore logs a
warning and the original operation still goes ahead, so a database
problem in the audit log never blocks a legitimate change.

## Storage

The log lives in its own SQLite database, separate from the device state
and history databases:

```
data/audit.db          # default, sibling of state.redb / history.db
```

It is created next to `history.db`. Keeping it in a separate file means
its retention is independent of the rest.

The audit log is **not** included in backups made by
[`POST /system/backup`](backup-restore) or the scheduled backups. A backup
holds what the house is; the audit log records what happened to it. If you
want to keep audit history, copy `audit.db` yourself.

A background task runs every six hours and deletes entries older than
`[auth].audit_retention_days` (default 365).

## Entry shape

Each row carries:

| Field | Description |
|---|---|
| `id` | Auto-incrementing row id |
| `ts` | UTC timestamp of the action |
| `actor_type` | One of `user`, `api_key`, `local_admin`, `ip_whitelist`, `system`, `anonymous` |
| `actor_id` | UUID of the user or API key, when there is one |
| `actor_label` | Human-readable identifier (username, key label, or IP) |
| `event_type` | Dotted event name, e.g. `automation.updated`, `auth.login`, `plugin.restarted` |
| `scope_used` | The scope that authorised the action |
| `target_kind` / `target_id` | What was acted on (e.g. `kind="automation"`, `id="<uuid>"`) |
| `correlation_id` | Links related events from a single request chain |
| `ip` / `user_agent` | Where the request came from |
| `result` | `success`, `denied`, or `error` |
| `detail` | Free-form JSON for context (fields touched, counts, error messages) |

Not every event fills every field. Many entries leave `scope_used`,
`correlation_id`, `ip` and `user_agent` empty.

`actor_type` records how the request was authenticated:

- `user`: a JWT issued by `/auth/login`
- `api_key`: `Authorization: Bearer hc_sk_...`
- `local_admin`: a connection over the admin Unix socket
- `ip_whitelist`: a request admitted by the deprecated `[auth].whitelist`
- `system`: homeCore itself, for example a scheduled backup
- `anonymous`: requests made before authentication; failed logins land here

A failed login is recorded as `auth.login` with result `denied`.

## Querying

### REST

`GET /api/v1/audit` returns entries newest first. It requires the
`audit:read` scope, which the `admin`, `observer`, `device_operator`,
`rule_editor` and `service_operator` roles carry.

Query parameters (all optional):

| Param | Description |
|---|---|
| `actor_id` | Filter by actor UUID |
| `actor_type` | `user`, `api_key`, `local_admin`, `ip_whitelist`, `system`, `anonymous` |
| `event_type` | Exact event name. A trailing `*` matches a prefix (`auth.*` is every sign-in kind), and a leading `!` negates (`!auth.*` is everything else) |
| `target_kind` | `automation`, `scene`, `device`, `area`, `plugin`, `user`, etc. |
| `target_id` | Exact target id |
| `result` | `success`, `denied`, `error` |
| `from` | RFC3339 lower bound (inclusive) |
| `to` | RFC3339 upper bound (inclusive) |
| `limit` | Default 100 |
| `offset` | For pagination |

An unknown `actor_type` or `result`, or a malformed timestamp, returns
400.

```bash
# Successful rule edits in the past 24 hours
curl -s "http://localhost:8080/api/v1/audit?event_type=automation.updated&result=success&from=$(date -u -d '24 hours ago' --iso-8601=seconds)" \
  -H "Authorization: Bearer $TOKEN" | jq

# All login failures in the past week
curl -s "http://localhost:8080/api/v1/audit?event_type=auth.login&result=denied&from=$(date -u -d '7 days ago' --iso-8601=seconds)" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Web app

The [web app](../web-ui/overview.md) has an Audit page under Settings ›
System › Audit. You can filter by who acted, a start date, and what kind
of event (everything, changes only, sign-ins, or refused), and search by
name, room or address. Each row expands to show its detail, repeats by
the same person within a day are grouped, and an **Older** button loads
further back.

Device and automation pages link to the Audit page with an
`?about=device:<id>` or `?about=automation:<id>` parameter, which shows
the history of that one thing.

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

Access is gated by the `audit:read` scope. Out of the box:

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

Roles are fixed sets of scopes and cannot be edited. To let someone read
the audit log, give them a role that carries `audit:read`. An API key can
carry it only if its owner's role does. See
[Users & Authentication](./users-auth.md).

## Retention

By default 365 days of history is kept. The pruner runs every 6 hours and
deletes anything older than the cutoff. To change it:

```toml
[auth]
audit_retention_days = 90
```

Backups don't include `audit.db`. For long-term archival, copy that file
on your own schedule.

## Implementation notes

- Storage is SQLite (via `rusqlite`) in WAL mode. Indexes cover the common
  filter columns (`ts`, `actor_id`, `event_type`, and
  `target_kind`+`target_id`).
- Changes are recorded by one layer over the protected API routes, after
  the request succeeds. Routes whose handler writes its own, more detailed
  entry (accounts, keys, displays, calendars, backups, settings) are left
  to that handler.
- Recording is best-effort and does not block the original operation. If
  you need stricter guarantees, forward logs to an external syslog server
  as well (see [Logging](./logging.md)).
