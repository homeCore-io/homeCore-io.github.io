---
id: deployment-checklist
title: Production Deployment Checklist
sidebar_label: Deployment Checklist
sidebar_position: 6
---

# Production Deployment Checklist

Things to check when you move from a test setup to the homeCore that runs
your house.

## People, keys and secrets

- [ ] Sign in with the password in `INITIAL_ADMIN_PASSWORD` (at the root
  of homeCore's home), change it, and delete the file
- [ ] Leave `[auth] jwt_secret` unset. homeCore makes a signing secret on
  first start and keeps it in `data/jwt_secret` (mode `0600`), so tokens
  survive restarts. The inline setting is deprecated
- [ ] Give each person their own account with the narrowest role that
  fits (`household_member` for most of the family), and delete test
  accounts
  ```bash
  curl -X POST http://localhost:8080/api/v1/auth/users \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"username":"alex","password":"...","role":"household_member"}'
  ```
- [ ] Keep more than one admin you can sign in as, since homeCore has no
  password reset by email
- [ ] Make wall tablets displays (**Settings › Displays**), not accounts.
  A display can use the house but never change it
- [ ] Use API keys with only the scopes they need for scripts and
  services, and limit each to the address it runs from (see
  [Users & Authentication](./users-auth.md#api-keys))
- [ ] Look over **Settings › People & access › API keys** for keys nobody
  uses any more, and revoke them
- [ ] If you add `[[broker.clients]]` entries, give each a strong
  password, starting with `internal.core`
- [ ] Replace placeholder notification credentials in
  `[[notify.channels]]` (Telegram `bot_token` and `chat_id`, Pushover
  `api_token` and `user_key`, email `password`). homeCore refuses to start
  with a Telegram channel still set to `CHANGE_ME`

## Network and TLS

- [ ] Keep `[broker].host = "127.0.0.1"` unless devices, plugins or
  plugin runtimes on other machines need MQTT. Binding elsewhere needs
  `[[broker.clients]]` credentials, or homeCore refuses to start.
  **Open the broker to the network** on the Plugin runtimes screen does
  both for you
- [ ] Turn on TLS for MQTT if plugins connect over an untrusted network
  ```toml
  [broker]
  tls_port  = 8883
  cert_path = "/etc/homecore/broker.crt"
  key_path  = "/etc/homecore/broker.key"
  ```
- [ ] Set `[broker] v5_port = 0` if nothing needs the MQTT v5 listener
  (it listens on 1884 by default)
- [ ] Empty `[auth] whitelist` if you can. It grants admin with no token,
  is deprecated, and takes only single addresses. Use `[auth.admin_uds]`
  or API keys instead
- [ ] Put homeCore and the web app behind a reverse proxy with HTTPS if
  they're reachable from outside your LAN, and make the proxy pass the
  client's real IP so the login limit works per client

## Location

- [ ] Set `[location]` to your latitude, longitude and time zone. Solar
  triggers use the coordinates, and the time zone sets the times people
  see
- [ ] Set the household temperature unit (`[location].temperature_unit`,
  or **Settings › System › Units and region**) so messages and alerts use
  it

## Alerts

- [ ] Set `[alerts] notify_channel` to a channel (or `all`) if you want
  homeCore's own alerts (wet, smoke, jammed, offline, a plugin that isn't
  running) sent somewhere. Unset, they're only shown in the app
- [ ] Set `[battery] notify_channel` for low battery messages

## Storage

- [ ] Use absolute paths for `[storage] state_db_path` and
  `history_db_path`, or set homeCore's home explicitly (`--home` or
  `HOMECORE_HOME`), so paths don't depend on the working directory
- [ ] Keep the data directory on persistent storage (not tmpfs)
- [ ] Set file permissions so only the homeCore user can read and write
  the data directory

## Logging

- [ ] Check file logging. homeCore writes JSON logs to `logs/` under its
  home by default. To put them elsewhere:
  ```toml
  [logging.file]
  enabled          = true
  dir              = "/var/log/homecore"
  prefix           = "homecore"
  rotation         = "daily"
  prune_after_days = 30
  ```
- [ ] Set `prune_after_days` so old logs don't fill the disk (the
  default, `0`, keeps them forever)
- [ ] Quiet noisy modules with `[logging.targets]` (`hc_broker = "warn"`
  is a good start)

## Backups

- [ ] Check the schedule suits you. By default homeCore makes a backup
  every 24 hours and keeps the newest 7 in `backups/` (`[backup]
  every_hours`, `keep`, `dir`)
- [ ] Copy backups off the machine too
  ```bash
  # Needs an admin's token, or an admin's API key carrying users:write
  curl -s -X POST http://localhost:8080/api/v1/system/backup \
    -H "Authorization: Bearer $TOKEN" \
    -o /backups/homecore-$(date +%Y%m%d).zip
  ```
- [ ] Save the web app's own data as well (**save them too** on
  **Settings › Data & backups**). homeCore's backup doesn't include it
- [ ] Copy `data/audit.db` if you want to keep audit history; it isn't in
  homeCore's backups
- [ ] Check that a backup restores on a clean install before relying on
  it (`POST /api/v1/system/restore?check=true` shows what it would
  restore)

See [Backup & Restore](./backup-restore.md).

## Plugins

- [ ] Install plugins from the Catalog (**Settings › Plugins**), so
  homeCore makes their broker logins and keeps their settings in
  `config/plugins/`
- [ ] With an external Mosquitto, give each plugin a `[[broker.clients]]`
  entry with narrow topic patterns (the embedded broker records but
  doesn't enforce them; see [MQTT Broker](./broker.md))
- [ ] Point any `[[plugins]] binary` paths you set by hand at release
  builds, not `target/debug/`
- [ ] Look over plugin configs for test settings (fast polling, debug
  endpoints)

## Systemd (Linux)

For a full recipe with a hardened unit, see the
[Systemd Deployment guide](./systemd-deployment).

The short version:

- [ ] Install the service with `scripts/install-service.sh` (from the
  core repository; `--install-dir` defaults to `/opt/homecore`, `--user`
  to the current user), or copy
  `scripts/service-templates/homecore.service` and replace its
  `@@USER@@`, `@@GROUP@@` and `@@INSTALL_DIR@@` placeholders
- [ ] Enable it: `systemctl enable homecore`
- [ ] Keep `Restart=on-failure`. Restarts from the web app or
  `POST /api/v1/system/restart` exit with code 75, so systemd starts
  homeCore again (before v0.1.97 they exited with 0 and needed
  `Restart=always`)
- [ ] If your unit came from a template older than v0.1.97, delete its
  `ExecReload=/bin/kill -HUP $MAINPID` line. homeCore has no `SIGHUP`
  handler, so `systemctl reload homecore` stops it
- [ ] Check it starts after a reboot

## Docker

See the [Docker guide](/docs/getting-started/docker) for the full setup.
The main points:

- [ ] Keep homeCore's home on a persistent mount at `/homecore` (config,
  data, rules, plugins, backups). The shipped compose file uses
  `./homecore-data`
- [ ] Keep the app's `/data` volume too; it holds the app's pages,
  displays, Homes and pictures
- [ ] Publish port `8080` (API) and the app's port (`3001` in the shipped
  compose file). Publish `1883` (MQTT) only if devices or runtimes outside
  the container need it. The broker answers there only once it is open to
  the network
- [ ] Use `restart: unless-stopped`

## Upgrading

- [ ] Back up first, and read the [release notes](../release-notes) for
  upgrade steps
- [ ] Docker: `docker compose pull`, then `docker compose up -d`
- [ ] systemd: replace the `homecore` and `hc-cli` binaries, then
  `sudo systemctl restart homecore`
- [ ] Update plugins from **Settings › Plugins** (**Update all**). They
  live in homeCore's home, so upgrading core doesn't change them

## After deploying

- [ ] `GET /api/v1/health` returns 200
- [ ] `GET /api/v1/system/status` shows the plugin and device counts you
  expect, and `last_backup_at` fills in after the first backup
- [ ] `GET /api/v1/metrics` answers your scraper's address, after you add
  it to `[metrics].whitelist` (see [Metrics](./metrics.md))
- [ ] Devices report state when you expect
- [ ] Test a rule: `POST /api/v1/automations/{id}/test`
- [ ] A test message arrives on at least one notification channel
  (`POST /api/v1/notify/test`)
