---
id: users-auth
title: Users & Authentication
sidebar_label: Users & Auth
sidebar_position: 1
---

# Users & Authentication

Every REST and WebSocket caller signs in with a JWT (HS256) or an API key.
Each route needs a scope, and a person's scopes come from their role.

In the web app, people are managed under **Settings › People & access**.
That screen links to **API keys** and **Displays**, and has **+ Add a
person**. Your own sessions, PIN and keys are on **Me**, under **Signed
in**, **PIN for displays** and **API keys**. Everything on this page can
also be done over the API, as shown below.

## First login

When homeCore starts with an empty user store, it creates an `admin`
account with a random password. It writes the password to
`INITIAL_ADMIN_PASSWORD` at the root of homeCore's home directory (mode
`0600`) and prints it once in the startup log.

Sign in, change the password, and delete the file. homeCore never writes
it again.

`[auth].initial_admin_password_file` puts the file somewhere else. A
relative path resolves against homeCore's home. An empty string turns the
file off, and the password then appears only in the log.

## Roles

There are eight roles. Each is a fixed set of scopes, and you can't make
your own. The API takes and returns the `snake_case` name
(`device_operator`).

| Role | What it is for |
|---|---|
| `admin` | Everything, including people, plugins, displays, backups, logs and other people's API keys |
| `user` | Reads the house, commands devices, and writes devices, automations, scenes, rooms and app content. No plugins, no people, no audit log |
| `household_member` | Someone who lives in the house. Reads everything `read_only` reads, commands devices and runs scenes, and changes nothing shared: no renaming, moving or deleting devices, no helpers or modes |
| `read_only` | Reads devices, automations, scenes, rooms and app content. No plugins, no audit log |
| `observer` | `read_only` plus `plugins:read` and `audit:read`. Suits status screens and monitoring services |
| `device_operator` | `observer` plus `devices:write` and `devices:command`. Drives and edits devices, but can't author automations |
| `rule_editor` | `observer` plus authoring automations, scenes, rooms and app content, and running scenes. Can't command devices |
| `service_operator` | `user` plus `audit:read`. The usual role for a service account |

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

What the less obvious scopes cover:

- `devices:command` commands a device. `devices:write` does that too, and
  also renames, moves and deletes devices and makes helpers and modes.
- `scenes:run` activates a scene. `scenes:write` also allows it.
- `content:read` and `content:write` cover what the web app keeps for the
  house, such as widget templates, icon rules and uploaded pictures.
- Alerts: reading them needs `devices:read`, acknowledging one needs
  `devices:command`, and alert rules and ignores need
  `automations:write`. Pressing a plugin's alert button also needs
  `plugins:write`.
- `plugins:write` covers installing and running plugins, plugin runtimes,
  plugin settings, plugin log levels and the server's log level.

Some admin routes check for an admin instead of a single scope: people,
displays, backups and restores, `homecore.toml` (**Settings ›
Configuration**), restarts, logs and the connection list. A person passes
these with the `admin` role. An API key passes them when it carries
`users:write`.

A `403 Forbidden` means the caller signed in fine but lacks what the route
needs. `GET /api/v1/auth/roles` returns the role table from the running
server, and the web app reads it from there.

Keys made before the dashboards and skins left core may still list
`dashboards:read`, `dashboards:write`, `skins:read` or `skins:write`.
Nothing checks them any more. homeCore ignores them, leaves them out of
listings, and drops them when a key is edited.

### Public routes

These need no credential: `GET /health`, `GET /system/versions`,
`POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` (holding the
refresh token is the proof) and `POST /webhooks/{path}`. A webhook's path
segment is its shared secret, so treat it as one.

A plugin runtime checks in, reads its placements and downloads plugins
with its own key, the one homeCore showed when the runtime was added. See
[Plugin runtimes](../plugins/runtimes).

`GET /api/v1/metrics` uses `[metrics].whitelist` instead of a credential
and answers 403 to everyone by default. See [Metrics](./metrics.md).

The event stream (`/events/stream`), the log stream (`/logs/stream`) and a
plugin action's progress stream take the credential as a `?token=` query
parameter, because a browser can't set headers on a WebSocket upgrade or
an `EventSource`. The parameter accepts a JWT or an API key.

## Signing in

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}' | jq -r .token)
```

The response:

```json
{
  "token": "eyJhbGci…",
  "token_type": "Bearer",
  "expires_in": 86400,
  "refresh_token": "…",
  "refresh_expires_in": 2592000,
  "user": { "id": "…", "username": "admin", "role": "admin", "created_at": "…", "has_pin": false }
}
```

Send the access token on every later request:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" | jq
```

`GET /auth/me` says who a credential belongs to and which scopes it
carries. For an API key, those are the key's own scopes, which can be
fewer than its owner's role allows.

Login is limited per source IP to five requests in 60 seconds. After that
it answers HTTP 429 with `Retry-After`. Behind a reverse proxy that hides
the client's address, every request comes from the proxy and the limit
applies to everyone at once. Pass the real IP through, or rate-limit at
the proxy.

## Refreshing

Access tokens last `[auth].token_expiry_hours` (default 24). Refresh
tokens last `[auth].refresh_token_expiry_days` (default 30).

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH\"}" | jq
```

A refresh token works once. Each refresh returns a new one and retires
the old one. If a used token comes back, homeCore treats it as stolen,
revokes every token in that chain, and records `auth.refresh.reuse` in the
audit log.

## Sessions and signing out

Each sign-in starts a session, held by its refresh token. In the app they
are listed on **Me › Signed in**, with **Sign out everywhere** below.

- `GET /auth/sessions` lists your own sessions: the user agent, when it
  started, when it was last active, when it expires, and which one is
  `current`.
- `DELETE /auth/sessions/{id}` ends one session.
- `POST /auth/sessions/end-all` signs you out everywhere, this session
  included. Your API keys keep working.
- `POST /auth/logout` with `{"refresh_token": "…"}` ends the session that
  token belongs to. It always answers 204, so it can't be used to test
  tokens.

An ended session can't refresh, and its access tokens stop working at
once. homeCore remembers ended sessions across a restart.

## Managing people

```bash
# List
curl -s http://localhost:8080/api/v1/auth/users \
  -H "Authorization: Bearer $TOKEN" | jq

# A status screen that reads the house and sees plugin health
curl -s -X POST http://localhost:8080/api/v1/auth/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"dashboard","password":"at-least-8-chars","role":"observer"}' | jq

# Someone who lives in the house
curl -s -X POST http://localhost:8080/api/v1/auth/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"alex","password":"at-least-8-chars","role":"household_member"}' | jq
```

A wall tablet should be a [display](#displays-and-pins), not an account.

People are addressed by UUID. `GET /auth/users` gives you the id:

```bash
# Change a role
curl -s -X PATCH http://localhost:8080/api/v1/auth/users/$UID/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"read_only"}' | jq

# Set someone's password (admin)
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

Passwords are stored as Argon2id (m=64 MiB, t=3, p=4) with a salt per
password. The minimum length is 8 characters.

homeCore always keeps at least one admin. Demoting or deleting the only
admin returns `409 Conflict`. Deleting your own account returns `400`.
People have no email address, so there's no reset link. If someone
forgets their password, an admin sets a new one.

`hc-cli user list|show|create|delete|set-role` does the same from the
command line.

### What a password or role change does

A password change, an admin setting a password, a role change, and
**Sign out everywhere** all bump the person's `token_version`. Every
access token issued to them before that stops working, and their refresh
tokens are revoked. Changing your own password signs you out everywhere,
including the browser you changed it in, so sign in again afterwards.
After a role change, the person's new tokens carry the new role.

A role change also narrows the person's API keys to scopes the new role
still has. Deleting a person revokes their keys. A password change leaves
keys alone. None of this touches display keys or plugin keys.

A WebSocket that is already open was checked when it connected and runs
until it closes. It can't reconnect with the old token.

## API keys

For scripts and services, use an API key instead of a stored password. A
key carries some or all of its owner's scopes, can expire, can be limited
to certain addresses, and can be revoked on its own. In the app, admins
manage every key under **Settings › People & access › API keys** (**In
use** and **Stopped**, with **Change**, **New secret** and **Revoke** on
each). Everyone sees their own on **Me › API keys**.

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "label": "grafana",
        "scopes": ["devices:read"],
        "expires_in_days": 365,
        "allowed_cidrs": ["192.168.1.42"]
      }' | jq
```

The plaintext key (`hc_sk_…`) is in the response once. homeCore stores
only a hash and can't show it again. If it's lost, rotate it with
`POST /auth/api-keys/{id}/rotate`, which issues a new secret and keeps the
id, label, scopes and expiry.

Use it like a JWT:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer hc_sk_…" | jq
```

The rules:

- A key's scopes must be ones its owner's role has, and no more than the
  person making it holds.
- `GET /auth/api-keys` lists your own keys. With `api_keys:admin` it lists
  every key, including display and plugin keys.
- `PATCH /auth/api-keys/{id}` changes the label, scopes, expiry or
  addresses. `DELETE /auth/api-keys/{id}` revokes the key.
- Managing your own keys needs no scope. Managing someone else's needs
  `api_keys:admin`, and so does managing keys while signed in with a key.
- Revoking is final. A revoked key can't be rotated (`409`); make a new
  one. Before v0.1.114, a key in use at the moment it was revoked could
  come back, and so could a deleted key that was edited or rotated just
  afterwards.

`hc-cli api-key create|list|show|update|rotate|revoke` does the same from
the command line.

### Limiting a key to addresses

`allowed_cidrs` takes networks (`192.168.1.0/24`) and single addresses
(`192.168.1.42`). An empty list means any address. With a list, a request
from anywhere else gets `403` ("this API key may not be used from this
address"), checked after the secret, so a wrong address says nothing about
whether a guessed key exists. An entry homeCore can't read is refused when
you save the key.

The address checked is the TCP connection's. Requests that pass through
the web app's server, or any proxy, come from that server's address. The
app only offers the address field when homeCore is v0.1.80 or later, which
is when the check started.

### Plugin keys

A plugin that declares `api_scopes` gets its own key from homeCore every
time it starts, delivered over MQTT. The previous key is deleted then, and
the key goes when the plugin is uninstalled. These keys:

- are labeled `plugin <plugin_id>`, belong to no person, and show in the
  API keys list under their plugin;
- never hold `users:write` or `api_keys:admin`, whatever the plugin asks
  for;
- work only from `127.0.0.0/8` and `::1` when homeCore runs the plugin on
  its own machine. A plugin in a [runtime](../plugins/runtimes) gets a key
  with no address limit.

Their creation is recorded as `api_key.created` by `system`.

### Who may run a plugin action

Plugin actions normally need `plugins:write`, which means an admin. An
action the plugin declares `admin` also needs the admin role, so an API key
with `plugins:write` alone can't run it. An action declared `signed_in` is
open to anyone signed in, household members included (the Assistant's chat
works this way). Only the person who started a `signed_in` action, or an
admin, can read its progress, answer it or cancel it.

homeCore tells the plugin who called (user id, username, role, scopes)
and drops any caller the client tried to send itself.

## Displays and PINs

A display is a screen for the house, such as a kitchen panel or a hall
tablet. It is its own identity and belongs to no person. An admin makes
one under **Settings › Displays** (**Make a display**) and sees its key
once. On the tablet, open the app's `/display` page and enter the key.

```bash
curl -s -X POST http://localhost:8080/api/v1/displays \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hall tablet"}' | jq
```

`GET /displays` lists them with when each was last used,
`PATCH /displays/{id}` renames one, and `DELETE /displays/{id}` removes it.
The tablet is signed out on its next request. All four need an admin.

A display key is an API key marked as a display. It always has exactly
`read_only`'s scopes plus `devices:command` and `scenes:run`, so it can use
the house and never change it. Displays made before v0.1.81 were given
`devices:write`. homeCore now ignores that.

A PIN lets a person unlock the full app on a display, as themselves, for
five minutes:

- Each person sets their own on **Me › PIN for displays**
  (`PUT /auth/pin` with `{"pin": "…", "password": "…"}`). It takes their
  password, is 4 to 8 digits, and must differ from everyone else's PIN,
  because the PIN alone says who is at the display (`409` if taken).
- `DELETE /auth/pin` removes your own. An admin can remove someone else's
  with `DELETE /auth/users/{id}/pin` (**Remove PIN** on their page), but
  can never set one.
- Only a display may trade a PIN for a session, with
  `POST /auth/pin-session`. The session has no refresh token.
- After five wrong PINs in 15 minutes, that display gets `429` until the
  oldest failure ages out.

PIN sign-ins are recorded as `auth.pin_session`, and wrong PINs as
`auth.pin_failed`.

## The IP whitelist (tokenless admin, deprecated)

A request whose source IP matches `[auth].whitelist` gets full admin
access with no token at all:

```toml
[auth]
whitelist = ["127.0.0.1", "192.168.1.14/32"]
```

:::danger Only single addresses are accepted
Each entry must be one host: a bare IP (`192.168.1.14`) or a full-length
prefix (`192.168.1.14/32`, `::1/128`). homeCore skips any entry that
covers a range, such as `192.168.1.0/24`, and logs a warning at startup. A
range would give unauthenticated admin to every device on that subnet,
including the TV, the doorbell, a guest's laptop and anything that joins
later.

This applies to core's own port. If a reverse proxy fronts homeCore, the
proxy can require sign-in while core's port stays open to whitelisted
hosts. Check what is actually listening.
:::

A `Bearer` token, when present, always wins, so a whitelisted caller who
sends a token gets their real identity. The audit log records whitelisted
requests with actor type `local_admin`.

The whitelist is deprecated and logs a warning on every use. Use one of
these instead:

- `[auth.admin_uds]`, an admin-only Unix socket for tools on the same
  machine, such as `hc-cli`:

  ```toml
  [auth.admin_uds]
  enabled = true
  path    = "/run/homecore/admin.sock"   # default
  group   = "homecore-admin"             # default
  mode    = "0660"                       # default
  allowed_uids = []
  ```

  It is off by default. The group and mode decide who can open the socket
  file. homeCore then checks the caller's user id: its own is always
  allowed, and `allowed_uids` adds others. Anyone else gets `403`.

- An API key with only the scopes the caller needs.

## WebSocket authentication

```
ws://<homecore-host>:8080/api/v1/events/stream?token=<jwt-or-api-key>
```

homeCore checks the token before it accepts the upgrade, including a
JWT's `token_version`, so a session ended by a password change can't open
a stream. A missing or invalid token gets HTTP 401 and no WebSocket.

## The signing secret

homeCore generates the HS256 signing secret once and keeps it in
`jwt_secret` next to the state database (normally `data/jwt_secret`), mode
`0600`, so tokens survive restarts with no configuration. Set
`[auth].jwt_secret_file` to keep it somewhere else.

`[auth].jwt_secret` set inline still works and takes precedence. It is
deprecated and warns at startup.

Deleting the secret file invalidates every token homeCore has issued. API
keys keep working, since they don't depend on it.

## Audit log

Sign-ins, failed sign-ins, account, key, display and PIN changes,
settings writes, and changes to rules, devices, rooms, scenes and plugins
are recorded. See [Audit log](./audit-log.md). `[auth].audit_retention_days`
(default 365) sets how long entries are kept.
