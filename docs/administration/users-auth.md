---
id: users-auth
title: Users & Authentication
sidebar_label: Users & Auth
sidebar_position: 1
---

# Users & Authentication

homeCore authenticates REST and WebSocket callers with JWTs (HS256) or
API keys. Each route requires a scope, and a caller's scopes come from
its role.

In the web app, people are managed under Settings › People, API keys
under Settings › People › Keys, and your own sessions under Me › Signed
in. Everything on this page can also be done over the API, as shown below.

## First login

On first boot, when the user store is empty, homeCore creates an `admin`
account with a random password. It writes the password to
`INITIAL_ADMIN_PASSWORD` at the root of homeCore's home directory (mode
`0600`) and prints it once in the startup banner.

Delete that file after you log in. homeCore never writes it again.

`[auth].initial_admin_password_file` moves the file. A relative path
resolves against homeCore's home, and an empty string turns the file off
(the password then appears only in the log banner).

## Roles

There are eight roles, each a fixed set of scopes. You can't define your
own. The wire form is `snake_case` (`device_operator`), which is what the
API accepts and returns.

| Role | What it is for |
|---|---|
| `admin` | Everything, including users, plugins, and API keys belonging to other people |
| `user` | Read everything, command devices, author automations, scenes and areas. No user or plugin management, no audit log |
| `household_member` | Someone who lives in the house: sees what `read_only` sees, commands devices and runs scenes, and changes nothing shared (no renaming, moving or deleting devices, no helpers or modes) |
| `read_only` | Read devices, automations, scenes, and areas. No plugins, no audit log |
| `observer` | `read_only` plus `plugins:read` and `audit:read`. A good default for status screens and monitoring services |
| `device_operator` | `observer` plus `devices:write`. Drives devices but cannot author automation logic, which suits a wall panel or kiosk account |
| `rule_editor` | `observer` plus authoring automations, scenes, and areas, and running scenes. Cannot command devices |
| `service_operator` | `user` plus `audit:read`. The usual scope set for a service account |

### Scopes by role

| Scope | admin | user | household_member | read_only | observer | device_operator | rule_editor | service_operator |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `devices:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `automations:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `scenes:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `areas:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `content:read` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `devices:command` | ✓ | ✓ | ✓ | | | ✓ | | ✓ |
| `scenes:run` | ✓ | ✓ | ✓ | | | | ✓ | ✓ |
| `devices:write` | ✓ | ✓ | | | | ✓ | | ✓ |
| `automations:write` | ✓ | ✓ | | | | | ✓ | ✓ |
| `scenes:write` | ✓ | ✓ | | | | | ✓ | ✓ |
| `areas:write` | ✓ | ✓ | | | | | ✓ | ✓ |
| `content:write` | ✓ | ✓ | | | | | ✓ | ✓ |
| `plugins:read` | ✓ | | | | ✓ | ✓ | ✓ | |
| `plugins:write` | ✓ | | | | | | | |
| `audit:read` | ✓ | | | | ✓ | ✓ | ✓ | ✓ |
| `users:read` | ✓ | | | | | | | |
| `users:write` | ✓ | | | | | | | |
| `api_keys:admin` | ✓ | | | | | | | |

`devices:command` lets a caller command a device without being able to
rename, move or delete it; `devices:write` also allows commanding.
Likewise `scenes:run` activates a scene, and `scenes:write` covers that
too. `content:read` and `content:write` cover content a client keeps for
the house, such as widget templates, icon rules and uploaded images.

A `403 Forbidden` means the caller authenticated but the role does not
carry the scope the route requires. `GET /api/v1/auth/roles` returns this
table from the running server; the web app reads it from there rather
than keeping its own copy.

Managing your *own* API keys needs no scope, since authenticating as
yourself is enough. `api_keys:admin` is for managing keys owned by
someone else.

These routes are public and need no authentication: `GET /health`,
`GET /system/versions`, `POST /auth/login`, `POST /auth/refresh`,
`POST /auth/logout` (holding the refresh token is the proof), and
`POST /webhooks/{path}`. For webhooks the path segment *is* the shared
secret, so treat it as one. The plugin-runtime enrollment endpoints are
also outside the token system and have their own checks.

`GET /metrics` sits outside the token system too. It is gated by
`[metrics].whitelist` instead and returns 403 to everyone by default. See
[Metrics](./metrics.md).

The event stream, the log stream, and the plugin-command SSE stream all
require a credential, but take it as a `?token=` query parameter, because
a browser cannot set headers on a WebSocket upgrade or an `EventSource`
request. The parameter accepts either a JWT or an API key.

## Logging in

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}' | jq -r .token)
```

The response carries both tokens, plus a `user` object describing who
signed in:

```json
{
  "token": "eyJhbGci…",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "…",
  "refresh_expires_in": 2592000
}
```

Send the access token on every later request:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" | jq
```

Login is rate-limited per source IP: five attempts in sixty seconds, then
HTTP 429 with `Retry-After`. Behind a reverse proxy that does not forward
the client IP, this becomes a global cap. Pass the real IP through, or
rate-limit at the proxy instead.

## Refreshing

Access tokens last `token_expiry_hours` (default 24). Refresh tokens last
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

## Sessions and signing out

Each sign-in starts a session, held by its refresh token.

- `GET /auth/sessions` lists your own sessions: the user agent, when it
  started, when it was last active, and which one is `current`.
- `DELETE /auth/sessions/{id}` ends one session.
- `POST /auth/sessions/end-all` ends all of yours, including the one you
  are using.
- `POST /auth/logout` with `{"refresh_token": "…"}` ends the session that
  token belongs to. It always answers 204, so it can't be used to test
  tokens.

An ended session can't refresh, and its access tokens stop working
immediately, not when they expire. homeCore remembers ended sessions
across a restart.

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

Users are addressed by **UUID**, not username. `GET /auth/users` gives
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

homeCore always keeps at least one admin. Demoting or deleting the only
admin returns `409 Conflict`, and you cannot delete your own account.
Users have no email address, so there is no reset-link flow: an admin
resetting the password is the way back in for someone who forgot theirs.

### Changing a password or role ends every session

A password change, an admin reset, or a role change bumps the user's
`token_version`. That invalidates every access token already issued to
them, and their refresh tokens are revoked outright. Whoever holds a
stolen token loses it at that moment. It also means that changing your
own password signs out your other browsers and any script using that
account's token. After a role change, the person signs in again and gets
tokens with the new role's scopes.

A role change also narrows that person's API keys to scopes the new role
still allows. Deleting a user revokes their API keys. Display keys (for
wall tablets) belong to the house rather than to the person who made them,
and neither change touches them.

A WebSocket that is *already* connected was authorised at upgrade time and
runs until it disconnects. It cannot reconnect with the old token.

## API keys

For scripts and services, an API key is better than a stored password. It
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
stored as a hash and cannot be recovered. If it is lost, rotate it with
`POST /auth/api-keys/{id}/rotate`, which issues a new secret and keeps the
id, label, scopes and expiry.

Use it exactly like a JWT:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer hc_sk_…" | jq
```

Requested scopes must be a subset of the owner's. `PATCH /auth/api-keys/{id}`
changes the label, scopes, expiry or CIDRs, and `DELETE /auth/api-keys/{id}`
revokes the key. A key can only make or change keys if it carries
`api_keys:admin` itself.

`hc-cli api-key create|list|show|update|rotate|revoke` does the same from
the command line.

## The IP whitelist (tokenless admin, deprecated)

Any request whose source IP matches `[auth].whitelist` is granted **full
admin access with no token at all**:

```toml
[auth]
whitelist = ["127.0.0.1/32", "192.168.1.14/32"]
```

:::danger Only individual addresses are accepted
Each entry must be a single host: a bare IP (`192.168.1.14`) or a full-length
prefix (`192.168.1.14/32`, `::1/128`). homeCore skips any entry that covers a
range, such as `192.168.1.0/24`, and logs a warning at startup. A range would
hand unauthenticated admin to every device on that subnet: the TV, the
doorbell, a guest's laptop, and anything that joins later.

This applies to **core's own port**, wherever that is. If a reverse proxy
fronts homeCore, the proxy's port can look authentication-only while
core's port is open to whitelisted hosts. Check what is actually
listening, not just the address you browse to.
:::

A `Bearer` token, when present, always wins. Whitelisted callers who
present a token get their real claims, which is what makes
identity-sensitive endpoints like change-password behave correctly.

This option is deprecated and logs a warning on every use. Prefer one of:

- **`[auth.admin_uds]`**, an admin-only Unix socket for same-host tooling
  (`hc-cli`), authorised by filesystem permissions instead of network
  identity. The process's own UID can always connect; `allowed_uids` adds
  others.

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

The token (a JWT or an API key) is validated **before** the upgrade is
accepted, including its `token_version`, so a session invalidated by a
password change cannot open a stream. An invalid or missing token returns
HTTP 401 and no WebSocket is established.

## Token lifetime and the signing secret

`[auth].token_expiry_hours` (default 24) sets the access-token lifetime,
and `refresh_token_expiry_days` (default 30) the refresh token's.

The HS256 signing secret is **generated once and persisted** to
`<state-db-parent>/jwt_secret` (normally `data/jwt_secret`) with mode
`0600`, so tokens survive restarts with no configuration at all. Set
`[auth].jwt_secret_file` to keep it somewhere else.

Setting `[auth].jwt_secret` inline still works and takes precedence, but
it is deprecated and warns at startup. It puts a secret in a config file
for no benefit over the managed one.

Deleting the secret file invalidates every issued token, if you ever need
to do that.

## Audit log

Sign-ins, failed sign-ins, account and key changes, settings writes, and
changes to rules, devices, rooms, scenes and plugins are all recorded. See
[Audit log](./audit-log.md). Retention is `[auth].audit_retention_days`
(default 365), pruned by a background task every six hours.
