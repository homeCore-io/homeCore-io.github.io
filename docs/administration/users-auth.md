---
id: users-auth
title: Users & Authentication
sidebar_label: Users & Auth
sidebar_position: 1
---

# Users & Authentication

HomeCore uses JWT (HS256) for REST API authentication and per-user role-based access control.

## Roles

| Role | Description |
|---|---|
| `Admin` | Full access — can manage users, plugins, all devices and automations |
| `User` | Read and write access to devices, automations, scenes, areas — cannot manage users or plugins |
| `ReadOnly` | Read-only access to everything |

## Scope reference

Every protected API route enforces a specific scope. A `403 Forbidden` response means the JWT lacks the required scope.

| Scope | Endpoints |
|---|---|
| `devices:read` | `GET /devices`, `GET /devices/{id}`, `GET /devices/{id}/history`, `GET /events` |
| `devices:write` | `PATCH /devices/{id}/state`, `PATCH /devices` (bulk), `DELETE /devices/{id}`, `DELETE /devices` (bulk) |
| `automations:read` | `GET /automations`, `GET /automations/{id}`, `POST /automations/{id}/test`, `GET /automations/export`, `GET /automations/groups`, `GET /automations/{id}/history` |
| `automations:write` | `POST /automations`, `PUT /automations/{id}`, `PATCH /automations/{id}`, `PATCH /automations`, `DELETE /automations/{id}`, `POST /automations/import`, `POST /automations/{id}/clone`, group CRUD |
| `areas:read` | `GET /areas` |
| `areas:write` | `POST /areas`, `PUT /areas/{id}/devices` |
| `scenes:read` | `GET /scenes` |
| `scenes:write` | `POST /scenes`, `POST /scenes/{id}/activate` |
| `plugins:read` | `GET /plugins` |
| `plugins:write` | `DELETE /plugins/{id}` |
| `users:write` | `POST /auth/users`, `PUT /auth/users/{id}`, `DELETE /auth/users/{id}` |

Public routes (no auth required): `GET /health`, `POST /auth/login`, `POST /webhooks/{path}`, `GET /api/v1/events/stream` (token in query param).

## Logging in

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_PASSWORD"}' | jq -r .token)
```

Use the token in subsequent requests:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Managing users

### List users

```bash
curl -s http://localhost:8080/api/v1/auth/users \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Create a user

```bash
# Dashboard user — read only
curl -s -X POST http://localhost:8080/api/v1/auth/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"dashboard","password":"secret","role":"ReadOnly"}' | jq

# Automation manager — can write automations but not manage users
curl -s -X POST http://localhost:8080/api/v1/auth/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"automation-mgr","password":"secret","role":"User"}' | jq
```

### Change a user's password or role

```bash
curl -s -X PUT http://localhost:8080/api/v1/auth/users/USERNAME \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"new-password","role":"User"}' | jq
```

### Delete a user

```bash
curl -s -X DELETE http://localhost:8080/api/v1/auth/users/USERNAME \
  -H "Authorization: Bearer $TOKEN"
```

## IP whitelist bypass

Requests from whitelisted IPs are granted Admin-level access without a JWT:

```toml
# config/homecore.toml
[server]
whitelist = ["127.0.0.1", "192.168.1.0/24"]
```

**Important:** When a `Bearer` token IS present in the request, JWT validation runs regardless of the whitelist. The whitelist only applies to requests without any token.

This makes it safe to add your LAN subnet — dashboard apps on the same network get Admin access, but any app that presents a token is still validated normally.

## WebSocket authentication

Browsers cannot set custom headers during a WebSocket upgrade, so the JWT is passed as a query parameter:

```
ws://homecore.local/api/v1/events/stream?token=<jwt>
```

The token is validated **before** the WebSocket upgrade is accepted. Invalid or missing tokens return HTTP 401 and the connection is never established.

## Token lifetime

Tokens expire after `token_expiry_hours` (default: 24 hours). After expiry, re-authenticate to get a new token. There is no token refresh endpoint — just log in again.

If `jwt_secret` changes (or HomeCore restarts without a fixed secret), all existing tokens are immediately invalidated.

## Setting a persistent JWT secret

By default, if no `jwt_secret` is configured, a random secret is generated at startup. This means **all tokens expire on restart**.

For production, set a fixed secret:

```toml
[auth]
jwt_secret = "use-openssl-rand-hex-32-for-this"
```

Generate a strong secret:

```bash
openssl rand -hex 32
```
