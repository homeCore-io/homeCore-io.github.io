---
id: audit-log
title: Audit log
sidebar_label: Audit log
sidebar_position: 5
---

# Audit log

Every administrative mutation that flows through HomeCore's REST API
is recorded in a tamper-evident audit log: who acted, what they
changed, when, and from where. The log is the foundation for security
reviews, compliance audits, and post-incident analysis.

## What gets recorded

The recorder fires on every authenticated mutation: rule create / update / delete, scene activations, mode toggles, plugin restart / deregister, user CRUD, role changes, dashboard edits, scope changes, backup / restore, and auth events (login success / failure, refresh, logout).

Reads are not audited by default — the volume would dwarf the actionable events. The recorder is designed to be safe: failures inside `record_audit` are logged as warnings but do **not** abort the originating operation, so a transient SQLite hiccup never blocks a legitimate mutation.

## Storage

The log lives in its own SQLite database, separate from the device
state and history DBs:

```
data/audit.db          # default, sibling of state.redb / history.db
```

A separate file means audit retention can be tuned independently and
backup tooling can include or exclude it as policy requires (the
built-in [`POST /system/backup`](backup-restore) bundles all three).

A background task runs every six hours and prunes entries older than
`[auth].audit_retention_days` (default 365). Set the value to `0` to
disable pruning entirely.

## Entry shape

Each row carries:

| Field | Description |
|---|---|
| `id` | Auto-incrementing row id |
| `ts` | UTC timestamp of the action |
| `actor_type` | One of `user`, `api_key`, `local_admin`, `ip_whitelist`, `system`, `anonymous` |
| `actor_id` | UUID of the user / API key (when applicable) |
| `actor_label` | Human-readable identifier (username, key name, or IP) |
| `event_type` | Snake-case event name, e.g. `rule.created`, `auth.login`, `plugin.restarted` |
| `scope_used` | The JWT scope that authorised the action |
| `target_kind` / `target_id` | What was acted upon (e.g. `kind="rule"`, `id="<uuid>"`) |
| `correlation_id` | Links related events from a single request chain |
| `ip` / `user_agent` | Where the request came from |
| `result` | `success`, `failure`, or `denied` |
| `detail` | Free-form JSON for context (changed fields, error messages) |

`actor_type` distinguishes how the request was authenticated:

- **`user`** — JWT issued via `/auth/login`
- **`api_key`** — `Authorization: Bearer hc_sk_...`
- **`local_admin`** — Connected over the admin UDS
- **`ip_whitelist`** — Bypassed JWT via the deprecated CIDR whitelist
- **`system`** — The recorder itself, e.g. background prune jobs
- **`anonymous`** — Pre-auth attempts (failed logins land here)

## Querying

### REST

`GET /api/v1/audit` returns recent entries newest-first. Requires
the `audit:read` scope (granted to the `Admin`, `Observer`, and
`ServiceOperator` preset roles).

Query parameters (all optional):

| Param | Description |
|---|---|
| `actor_id` | Filter by actor UUID |
| `actor_type` | `user`, `api_key`, `local_admin`, `ip_whitelist`, `system`, `anonymous` |
| `event_type` | Exact event name |
| `target_kind` | `rule`, `scene`, `plugin`, `user`, etc. |
| `target_id` | Exact target id |
| `result` | `success`, `failure`, `denied` |
| `from` | RFC3339 lower bound (inclusive) |
| `to` | RFC3339 upper bound (inclusive) |
| `limit` | Default 100 |
| `offset` | For pagination |

```bash
# Last 50 successful rule edits in the past 24 hours
curl -s "http://localhost:8080/api/v1/audit?event_type=rule.updated&result=success&from=$(date -u -d '24 hours ago' --iso-8601=seconds)" \
  -H "Authorization: Bearer $TOKEN" | jq

# All login failures in the past week
curl -s "http://localhost:8080/api/v1/audit?event_type=auth.login&result=failure&from=$(date -u -d '7 days ago' --iso-8601=seconds)" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Web UI

The bundled [Leptos admin](../web-ui/overview.md) has an Audit page
with filter controls for each query field, infinite scroll for
pagination, and a JSON detail expand on each row. Direct deep links
preserve filter state via URL query params, so a security finding
can be shared by URL.

### `hc-cli`

```bash
hc-cli audit --event-type rule.deleted --since 24h
```

Output is JSON or a table depending on the global `--output` setting.

## Per-role visibility

Audit access is scope-gated, not role-gated, so any role with
`audit:read` can query. Out of the box that's:

| Role | `audit:read` |
|---|---|
| `Admin` | yes (all scopes) |
| `Observer` | yes |
| `ServiceOperator` | yes |
| `RuleAuthor` | no |
| `DeviceOperator` | no |
| `Guest` | no |
| `Disabled` | no |

Scope grants on custom roles can be edited via `PATCH /users/{id}` or
the Admin page.

## Retention

By default 365 days of history is kept. The pruner runs every 6 hours
and deletes anything older than the cutoff. Tune via:

```toml
[auth]
audit_retention_days = 90    # 0 to disable pruning
```

For long-term archival, run `POST /system/backup` periodically and
keep the resulting archives — they include `audit.db` alongside the
state and history databases.

## Implementation notes

- Storage is SQLite via `rusqlite`. Indexes cover the common filter
  columns (`ts`, `actor_id`, `event_type`, `target_kind+target_id`) so
  even multi-million-row logs query in tens of milliseconds.
- Recording is best-effort and does not block the originating
  operation. If you need stricter guarantees (e.g. financial-grade
  immutability) the file-level approach via syslog forwarding is the
  recommended path.
- The `correlation_id` field links events from a single request chain
  — useful when one API call spawns multiple downstream mutations
  (e.g. a rule import that creates a rule, links it to a group, and
  enables it).
