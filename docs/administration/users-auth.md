---
id: users-auth
title: Users & Authentication
sidebar_label: Users & Auth
sidebar_position: 1
---

# Users & Authentication

homeCore authenticates REST and WebSocket callers with JWTs (HS256) or
API keys, and authorises each route against a scope granted by the
caller's role.

## First login

On first boot — meaning the user store is empty — homeCore creates an
`admin` account, writes the generated password to
`INITIAL_ADMIN_PASSWORD` next to the state database (mode `0600`), and
prints it once in the startup banner.

Delete that file after you log in. homeCore never writes it again.

## Roles

Seven roles, each a fixed bundle of scopes. The wire form is
`snake_case` (`device_operator`), which is what the API accepts and
returns.

| Role | What it is for |
|---|---|
| `admin` | Everything, including users, plugins, and API keys belonging to other people |
| `user` | Read everything, command devices, author automations/scenes/areas. No user or plugin management, no audit log |
| `read_only` | Read devices, automations, dashboards, scenes, and areas. Nothing else — no plugins, no audit |
| `observer` | `read_only` plus `plugins:read` and `audit:read`. A good default for dashboards and observability services |
| `device_operator` | `observer` plus `devices:write` — drives devices but cannot author automation logic. The shape a wall panel or kiosk account wants |
| `rule_editor` | `observer` plus authoring automations, scenes, and areas. Cannot command devices |
| `service_operator` | `user` plus `audit:read`. The usual envelope for a service account |

### Scopes by role

| Scope | admin | user | read_only | observer | device_operator | rule_editor | service_operator |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `devices:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `automations:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `dashboards:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `scenes:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `areas:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `devices:write` | ✓ | ✓ | | | ✓ | | ✓ |
| `automations:write` | ✓ | ✓ | | | | ✓ | ✓ |
| `dashboards:write` | ✓ | ✓ | | | | ✓ | ✓ |
| `scenes:write` | ✓ | ✓ | | | | ✓ | ✓ |
| `areas:write` | ✓ | ✓ | | | | ✓ | ✓ |
| `plugins:read` | ✓ | | | ✓ | ✓ | ✓ | |
| `plugins:write` | ✓ | | | | | | |
| `audit:read` | ✓ | | | ✓ | ✓ | ✓ | ✓ |
| `users:read` | ✓ | | | | | | |
| `users:write` | ✓ | | | | | | |
| `api_keys:admin` | ✓ | | | | | | |

A `403 Forbidden` means the caller authenticated fine but the role does
not carry the scope the route requires. `GET /api/v1/auth/roles` returns
this table from the running server, which is what the web UI reads rather
than mirroring it.

Managing your *own* API keys needs no scope — authenticating as yourself
is sufficient. `api_keys:admin` is only for managing keys owned by
someone else.

Public routes, no authentication at all: `GET /health`,
`GET /system/versions`, `POST /auth/login`, `POST /auth/refresh`, and
`POST /webhooks/{path}` — where the path segment *is* the shared secret,
so treat it as one.

`GET /metrics` sits outside the token system too, gated instead by
`[metrics].whitelist` and returning 403 to everyone by default. See
[Metrics](./metrics.md).

The event stream, the log stream, and the plugin-command SSE stream all
require a token, but take it as a `?token=` query parameter — a browser
cannot set headers on a WebSocket upgrade or an `EventSource` request.

## Logging in

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}' | jq -r .token)
```

The response carries both tokens:

```json
{
  "token": "eyJhbGci…",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "…",
  "refresh_expires_in": 2592000
}
```

Use the access token on every subsequent request:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" | jq
```

Login is rate-limited per source IP: five attempts in sixty seconds, then
HTTP 429 with `Retry-After`. Behind a reverse proxy that does not forward
the client IP this becomes a global cap — pass the real IP through, or
rate-limit at the proxy instead.

## Refreshing

Access tokens are short-lived; refresh tokens last
`refresh_token_expiry_days` (default 30).

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}" | jq
```

Refresh tokens are **single-use and rotating**: each successful refresh
returns a new one and invalidates the old. If an already-used token is
presented again, homeCore treats it as theft and revokes the whole chain
it belongs to, so a stolen token cannot outlive its owner's next refresh.

## Managing users

```bash
# List
curl -s http://localhost:8080/api/v1/auth/users \
  -H "Authorization: Bearer $TOKEN" | jq

# Create — a dashboard account that can read and see plugin health
curl -s -X POST http://localhost:8080/api/v1/auth/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"dashboard","password":"at-least-8-chars","role":"observer"}' | jq

# Create — a wall panel that drives devices but cannot edit rules
curl -s -X POST http://localhost:8080/api/v1/auth/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"kitchen-panel","password":"at-least-8-chars","role":"device_operator"}' | jq
```

Users are addressed by **UUID**, not username — `GET /auth/users` gives
you the id:

```bash
# Change a role
curl -s -X PATCH http://localhost:8080/api/v1/auth/users/$UID/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"read_only"}' | jq

# Reset someone's password (admin)
curl -s -X PATCH http://localhost:8080/api/v1/auth/users/$UID/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_password":"new-password"}' | jq

# Change your own
curl -s -X POST http://localhost:8080/api/v1/auth/change-password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"old","new_password":"new-password"}' | jq

# Delete
curl -s -X DELETE http://localhost:8080/api/v1/auth/users/$UID \
  -H "Authorization: Bearer $TOKEN"
```

Passwords are stored as Argon2id (m=64 MiB, t=3, p=4) with a per-password
salt. The minimum length is 8 characters.

### Changing a password ends every session

A password change or admin reset bumps the user's `token_version`, which
invalidates every access token already issued to them, and revokes their
refresh tokens outright. Whoever holds a stolen token loses it at that
moment — which is the point — but it also means changing your own
password signs out your other browsers and any script using that
account's token.

A WebSocket that is *already* connected is authorised at upgrade time and
runs until it disconnects. It cannot reconnect.

## API keys

For scripts and services, an API key is better than a stored password: it
carries a subset of your scopes, can expire, can be pinned to source
CIDRs, and can be revoked on its own.

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "label": "grafana",
        "scopes": ["devices:read"],
        "expires_in_days": 365,
        "allowed_cidrs": ["10.0.0.42/32"]
      }' | jq
```

The plaintext key (`hc_sk_…`) is returned **once**, at creation. It is
stored hashed with Argon2id and cannot be recovered — rotate it
(`POST /auth/api-keys/{id}/rotate`) if it is lost.

Use it exactly like a JWT:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer hc_sk_…" | jq
```

Requested scopes must be a subset of the owner's. Revoke with
`DELETE /auth/api-keys/{id}`.

## The IP whitelist — tokenless admin, deprecated

Any request whose source IP matches `[auth].whitelist` is granted **full
Admin access with no token at all**:

```toml
[auth]
whitelist = ["127.0.0.1/32", "10.0.10.14/32"]
```

:::danger List individual addresses, never a subnet
`whitelist = ["10.0.10.0/24"]` hands unauthenticated admin to every
device on that subnet — the TV, the doorbell, a guest's laptop, and
anything that joins later. Write out the specific hosts that need it.

Note also that this applies to **core's own port**, wherever that is. If
a reverse proxy fronts homeCore, the proxy's port can look
authentication-only while core's port is wide open to the whitelist. Check
what is actually listening, not just the address you browse to.
:::

A `Bearer` token, when present, always wins: whitelisted callers who
present a token get their real claims, which is what makes
identity-sensitive endpoints like change-password behave correctly.

This option is deprecated and logs a warning on every use. Prefer either:

- **`[auth.admin_uds]`** — an admin-only Unix socket for same-host tooling
  (`hc-cli`), authorised by filesystem permissions instead of network
  identity:

  ```toml
  [auth.admin_uds]
  enabled = true
  path    = "/run/homecore/admin.sock"
  group   = "homecore-admin"
  mode    = "0660"
  ```

- **an API key** with only the scopes the caller actually needs.

## WebSocket authentication

```
ws://homecore.local:8080/api/v1/events/stream?token=<jwt>
```

The token is validated **before** the upgrade is accepted, including its
`token_version`, so a session invalidated by a password change cannot
open a stream. An invalid or missing token returns HTTP 401 and no
WebSocket is established.

## Token lifetime and the signing secret

`[auth].token_expiry_hours` (default 24) sets the access-token lifetime;
`refresh_token_expiry_days` (default 30) the refresh token's.

The HS256 signing secret is **generated once and persisted**, to
`<state-db-parent>/jwt_secret` with mode `0600`, so tokens survive
restarts with no configuration at all. Point `[auth].jwt_secret_file`
somewhere else if you want it elsewhere.

Setting `[auth].jwt_secret` inline still works and takes precedence, but
is deprecated and warns at startup — it puts a secret in a config file for
no benefit over the managed one.

Deleting the secret file invalidates every issued token, which is the
blunt instrument if you ever need it.

## Audit log

Every administrative action — logins, failed logins, user changes, key
creation, config writes — is recorded. See
[Audit log](./audit-log.md). Retention is `[auth].audit_retention_days`
(default 365), pruned by a background task every six hours.
