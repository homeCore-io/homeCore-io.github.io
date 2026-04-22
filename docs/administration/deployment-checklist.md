---
id: deployment-checklist
title: Production Deployment Checklist
sidebar_label: Deployment Checklist
sidebar_position: 6
---

# Production Deployment Checklist

A checklist for moving from a development setup to a production instance.

## Secrets & credentials

- [ ] Set `[auth] jwt_secret` to a long random string (if unset, tokens invalidate on every restart)
  ```bash
  openssl rand -base64 48
  ```
- [ ] Set strong passwords for all `[[broker.clients]]` entries — one per plugin, one for `internal.core`
- [ ] Replace placeholder notification credentials (`bot_token`, `api_key`, `smtp.password`)
- [ ] Create your admin user and delete any dev accounts
  ```bash
  curl -X POST http://localhost:8080/api/v1/auth/users \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"username":"admin","password":"...","role":"Admin"}'
  ```

## Network & TLS

- [ ] Enable TLS on the MQTT broker if plugins connect over an untrusted network
  ```toml
  [broker]
  tls_port  = 8883
  cert_path = "/etc/homecore/broker.crt"
  key_path  = "/etc/homecore/broker.key"
  ```
- [ ] Review `[server] whitelist` — restrict to your actual LAN subnet
- [ ] Put the REST API behind a reverse proxy (nginx, Caddy) with HTTPS if exposed beyond localhost

## Location

- [ ] Set `[location]` to your actual latitude, longitude, and timezone — solar triggers depend on this

## Storage

- [ ] Use absolute paths for `state_db_path` and `history_db_path` so they survive working-directory changes
- [ ] Ensure the data directory is on persistent storage (not tmpfs)
- [ ] Set filesystem permissions so only the homecore user can read/write the data directory

## Logging

- [ ] Enable file logging for production
  ```toml
  [logging.file]
  enabled          = true
  dir              = "/var/log/homecore"
  prefix           = "homecore"
  rotation         = "daily"
  prune_after_days = 30
  ```
- [ ] Set module-level log targets to avoid noise (`hc_broker = "warn"` is a good default)

## Backups

- [ ] Schedule periodic backups via the API or filesystem copy
  ```bash
  # API backup (requires Admin token)
  curl -s http://localhost:8080/api/v1/system/backup \
    -H "Authorization: Bearer $TOKEN" \
    -o /backups/homecore-$(date +%Y%m%d).zip
  ```
- [ ] Verify you can restore from a backup on a clean instance before relying on it

## Plugins

- [ ] Each plugin should have its own `[[broker.clients]]` entry with least-privilege topic ACLs
- [ ] Point plugin `binary` paths to release builds, not `target/debug/`
- [ ] Review plugin configs for dev-only settings (polling intervals, debug endpoints)

## Systemd (Linux)

For a full end-to-end recipe including the external Mosquitto broker
and hardened unit file, see the
[Systemd Deployment guide](./systemd-deployment).

Quick version:

- [ ] Copy `scripts/service-templates/homecore.service`, adjust `ExecStart`,
  `WorkingDirectory`, and `User` fields
- [ ] Enable the service: `systemctl enable homecore`
- [ ] Verify it starts on reboot
- [ ] If you need topic-level MQTT ACLs (containers, third-party plugins,
  compliance), pair HomeCore with external Mosquitto per the systemd
  deployment guide

## Docker

See the [Docker guide](/docs/getting-started/docker) for the full setup. Key points:

- [ ] Mount persistent volumes for `data/` and `config/`
- [ ] Expose ports `8080` (HTTP) and `1883` (MQTT)
- [ ] Use `--restart unless-stopped`

## Post-deploy verification

- [ ] `GET /api/v1/health` returns 200
- [ ] `GET /api/v1/system/status` shows expected plugin and device counts
- [ ] `GET /api/v1/metrics` returns Prometheus metrics
- [ ] Devices report state within expected intervals
- [ ] Fire a test rule: `POST /api/v1/automations/{id}/test`
- [ ] Verify notifications arrive on at least one channel
