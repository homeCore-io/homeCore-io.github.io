---
id: deployment-checklist
title: Production Deployment Checklist
sidebar_label: Deployment Checklist
sidebar_position: 6
---

# Production Deployment Checklist

Things to check when moving from a development setup to the instance that
runs your home.

## Secrets and credentials

- [ ] Sign in with the generated admin password from
  `INITIAL_ADMIN_PASSWORD` (at the root of homeCore's home), change it,
  and delete the file
- [ ] Leave `[auth] jwt_secret` unset. homeCore generates a signing secret
  on first start and keeps it in `data/jwt_secret` (mode `0600`), so
  tokens survive restarts. The inline setting is deprecated
- [ ] Give each person their own account with the narrowest role that
  fits, and delete any dev accounts
  ```bash
  curl -X POST http://localhost:8080/api/v1/auth/users \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"username":"alex","password":"...","role":"household_member"}'
  ```
- [ ] Use API keys with only the scopes they need for scripts and
  services, not stored passwords (see [Users & Authentication](./users-auth.md#api-keys))
- [ ] Set strong passwords for all `[[broker.clients]]` entries, one per
  plugin plus one for `internal.core`
- [ ] Replace placeholder notification credentials in
  `[[notify.channels]]` (Telegram `bot_token` and `chat_id`, Pushover
  `api_token` and `user_key`, email `password`). homeCore refuses to start
  with a Telegram channel still set to `CHANGE_ME`

## Network and TLS

- [ ] Keep `[broker].host = "127.0.0.1"` unless devices or plugins on other
  hosts need MQTT. If you bind to another address, add
  `[[broker.clients]]` credentials; without them homeCore refuses to start
- [ ] Enable TLS on the MQTT broker if plugins connect over an untrusted
  network
  ```toml
  [broker]
  tls_port  = 8883
  cert_path = "/etc/homecore/broker.crt"
  key_path  = "/etc/homecore/broker.key"
  ```
- [ ] Set `[broker] v5_port = 0` if nothing needs the MQTT v5 listener
  (it listens on 1884 by default)
- [ ] Empty `[auth] whitelist` if you can. It grants admin with no token,
  is deprecated, and only accepts individual addresses. Use
  `[auth.admin_uds]` or API keys instead
- [ ] Put the REST API behind a reverse proxy (nginx, Caddy) with HTTPS if
  it is reachable beyond your LAN, and make sure the proxy passes the
  client's real IP so login rate limiting works per client

## Location

- [ ] Set `[location]` to your actual latitude, longitude and time zone.
  Solar triggers depend on the coordinates, and the time zone sets
  user-facing timestamps

## Storage

- [ ] Use absolute paths for `state_db_path` and `history_db_path`, or set
  homeCore's home explicitly (`--home` or `HOMECORE_HOME`), so paths don't
  depend on the working directory
- [ ] Keep the data directory on persistent storage (not tmpfs)
- [ ] Set filesystem permissions so only the homecore user can read and
  write the data directory

## Logging

- [ ] Check file logging. The shipped config already writes JSON logs to
  `logs/` under homeCore's home; to put them elsewhere:
  ```toml
  [logging.file]
  enabled          = true
  dir              = "/var/log/homecore"
  prefix           = "homecore"
  rotation         = "daily"
  prune_after_days = 30
  ```
- [ ] Set `prune_after_days` so old logs don't fill the disk (the default,
  `0`, keeps them forever)
- [ ] Set module-level log targets to cut noise (`hc_broker = "warn"` is a
  good default)

## Backups

- [ ] Confirm the built-in schedule suits you. By default homeCore makes a
  backup every 24 hours and keeps the newest 7 in `backups/` (`[backup]
  every_hours`, `keep`, `dir`)
- [ ] Copy backups off the machine as well
  ```bash
  # API backup (requires an admin token or an admin's API key)
  curl -s -X POST http://localhost:8080/api/v1/system/backup \
    -H "Authorization: Bearer $TOKEN" \
    -o /backups/homecore-$(date +%Y%m%d).zip
  ```
- [ ] If you want to keep audit history, copy `data/audit.db` too; it is
  not in homeCore's backups
- [ ] Check that a backup restores on a clean instance before relying on
  it (`POST /api/v1/system/restore?check=true` shows what it would
  restore)

See [Backup & Restore](./backup-restore.md).

## Plugins

- [ ] Give each plugin its own `[[broker.clients]]` entry with
  least-privilege topic patterns (the embedded broker records but does
  not enforce them; see [MQTT Broker](./broker.md))
- [ ] Point plugin `binary` paths at release builds, not `target/debug/`
- [ ] Review plugin configs for dev-only settings (polling intervals,
  debug endpoints)

## Systemd (Linux)

For a full recipe with a hardened unit file, see the
[Systemd Deployment guide](./systemd-deployment).

Quick version:

- [ ] Install the service with `scripts/install-service.sh`, or copy
  `scripts/service-templates/homecore.service` and replace its
  `@@USER@@`, `@@GROUP@@` and `@@INSTALL_DIR@@` placeholders
- [ ] Enable the service: `systemctl enable homecore`
- [ ] Use `Restart=always` if you want restarts from the web app or
  `POST /api/v1/system/restart` to bring homeCore back (it exits with code
  0, which `Restart=on-failure` treats as a clean stop)
- [ ] Verify it starts on reboot

## Docker

See the [Docker guide](/docs/getting-started/docker) for the full setup.
Key points:

- [ ] Mount a persistent volume at `/homecore`, homeCore's home in the
  container (config, data, rules, backups)
- [ ] Expose port `8080` (HTTP), and `1883` (MQTT) only if devices outside
  the container need the broker
- [ ] Use `--restart unless-stopped`

## Post-deploy verification

- [ ] `GET /api/v1/health` returns 200
- [ ] `GET /api/v1/system/status` shows the expected plugin and device
  counts, and `last_backup_at` fills in after the first backup
- [ ] `GET /api/v1/metrics` returns Prometheus metrics from your scraper's
  address (after adding it to `[metrics].whitelist`; see [Metrics](./metrics.md))
- [ ] Devices report state within expected intervals
- [ ] Test a rule: `POST /api/v1/automations/{id}/test`
- [ ] Check that notifications arrive on at least one channel
