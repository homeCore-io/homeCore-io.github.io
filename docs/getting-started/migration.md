---
id: migration
title: Migration & Fresh Install
sidebar_label: Migration
sidebar_position: 5
---

# Migration & Fresh Install

This guide covers moving homeCore from one machine to another, with its
devices, rules, users, history and plugin settings. For a clean install
with nothing to migrate, follow the same steps and skip the backup and
restore.

The move is built on homeCore's own backup and restore. You take a
backup on the old machine, install homeCore on the new one, and hand it
the backup to put in place on its next start.

---

## Overview

| What | How it moves |
|---|---|
| Core binary | Installed fresh on the new machine |
| Plugins | Reinstalled on the new machine, before the restore |
| Device registry, users, scenes, areas (`state.redb`) | In the backup archive |
| History (`history.db`) | In the backup archive |
| `homecore.toml`, `modes.toml`, `mode_definitions.json` | In the backup archive |
| Rules (`rules/*.ron`) | In the backup archive |
| Calendars (`config/calendars/`) | In the backup archive |
| Plugin settings (including credentials) | In the backup archive, one per plugin |
| JWT signing secret (`data/jwt_secret`) | Not in the backup. Copy it by hand if you want old access tokens to stay valid. |
| Audit log | Not in the backup |
| The web app's own data (pages, layouts, displays) | Not in homeCore's backup. Save it from the app (Settings → Data & backups). |

The archive also contains the plugin settings files, so treat it as a
secret.

---

## Step 1: Back up the old machine

With homeCore running on the old machine, take a backup through the API
(or from the web app, Settings → Data & backups). This needs an admin
token:

```bash
# On the OLD machine
TOKEN="your-admin-token"

curl -s -X POST http://localhost:8080/api/v1/system/backup \
  -H "Authorization: Bearer $TOKEN" \
  --output homecore-backup-$(date +%Y%m%d).zip

# Check what's inside
unzip -l homecore-backup-$(date +%Y%m%d).zip
```

homeCore also makes backups on its own, daily by default, in `backups/`
under its home directory. The newest of those works too.

Optionally, copy the JWT secret from the old machine's data directory
(`data/jwt_secret`, or `homecore-data/data/jwt_secret` under Docker).

Note which plugins are installed (the Plugins page in the web app, or
`GET /api/v1/plugins`). You'll install the same ones on the new machine.

Transfer the archive to the new machine:

```bash
scp homecore-backup-*.zip user@new-machine:~/
```

---

## Step 2: Install homeCore on the new machine

Use whichever install path suits the new machine:

- **[Binary release](./binary-releases)**: extract the core archive and
  copy `config/homecore.toml.example` to `config/homecore.toml`. A good
  location is `/opt/homecore`.
- **[Docker](./docker)**: create the compose file and an empty
  `homecore-data` directory.
- **[Build from source](./installation#build-from-source)**: for running
  an unreleased build.

The restore brings back `homecore.toml` from the old machine, so there
is no need to tune the new config yet.

---

## Step 3: First start and plugins

Start homeCore once. Because it has no users yet, it creates an `admin`
account and writes the password to `INITIAL_ADMIN_PASSWORD` in its home
directory (and prints it in the log). Sign in with that.

Then install the same plugins the old machine had, from the web app
(Plugins → Add). A restore only writes plugin settings for plugins the
machine knows about, so install them first.

For a plugin you installed by hand (an unpacked tarball or your own
build), copy its directory under `plugins/` from the old machine. Its
`[[plugins]]` block comes back with `homecore.toml` in the restore.

---

## Step 4: Restore the backup

Get a token on the new machine (with the temporary admin password), then
ask homeCore what the archive would restore, without changing anything:

```bash
# On the NEW machine
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<temporary password>"}' | jq -r '.token')

curl -s -X POST "http://localhost:8080/api/v1/system/restore?check=true" \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @homecore-backup-YYYYMMDD.zip | jq
```

The response lists what would be `restored` and what would be
`skipped`. A plugin's settings show up as skipped when that plugin isn't
installed yet.

Then stage the restore:

```bash
curl -s -X POST http://localhost:8080/api/v1/system/restore \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @homecore-backup-YYYYMMDD.zip
```

The request body is the raw zip file. homeCore doesn't overwrite its
live databases while it runs. It stages the archive as
`restore-pending.zip` next to the state database and puts the files in
place on its next start, before it opens anything. Restart it to finish:

- **Docker:** `docker compose restart homecore`
- **systemd:** `sudo systemctl restart homecore`
- **Run by hand:** stop it (Ctrl-C) and start it again.

`POST /api/v1/system/restart` also works under Docker. Under the systemd
unit described below it does not, because the unit restarts homeCore
only after a failure and an API restart exits cleanly.

If you copied `jwt_secret`, do the restart as a stop and a start, and put
the file in the new `data/` directory while homeCore is stopped.

After the restart, sign in with your old accounts. The temporary admin
password no longer applies, because the restored `state.redb` brings
back the old machine's users. Delete `INITIAL_ADMIN_PASSWORD`.

Then open each plugin's page and check its settings. In v0.1.96 the
restore applied at startup matches plugin settings against the
`[[plugins]]` blocks in the config that was in place *before* the
restore, so settings for registry-installed plugins (and for any plugin
not declared there) are skipped, even when the `?check=true` response
listed them as restored. homeCore prints the `restored` and `skipped`
lists to stderr (the journal, or `docker logs`) when it applies the
restore. If a plugin's settings are missing, re-enter them; the archive keeps a copy of each at `plugins/<id>/config.toml`:

```bash
unzip -p homecore-backup-YYYYMMDD.zip plugins/plugin.hue/config.toml
```

See [Backup & Restore](../administration/backup-restore) for the details
of both endpoints.

---

## Step 5: Review the config for the new machine

The restored `config/homecore.toml` is the old machine's. Check it
against the new one:

```toml
[server]
host = "0.0.0.0"
port = 8080

[location]
latitude  = 38.9072    # confirm this is still correct
longitude = -77.0369
timezone  = "America/New_York"

[broker]
host = "127.0.0.1"     # 0.0.0.0 only with [[broker.clients]] credentials

[[plugins]]
id      = "plugin.yolink"
binary  = "plugins/hc-yolink/bin/hc-yolink"    # relative to HOMECORE_HOME
config  = "plugins/hc-yolink/config/config.toml"
enabled = true
# one block per hand-installed plugin
```

Things to verify:
- Any `[[plugins]]` blocks: the `binary` and `config` paths must exist
  on the new machine, relative to `HOMECORE_HOME` (for example
  `/opt/homecore`). Plugins installed from the registry don't appear
  here.
- Absolute paths elsewhere in the file (storage, logs, TLS certificates)
  must exist on the new machine.
- Plugin settings: hub IP addresses and similar values may need changing
  if the new machine is on a different network segment. Edit them from
  each plugin's page in the web app.

Restart homeCore after editing `homecore.toml`.

---

## Step 6: Install as a systemd service

Skip this step under Docker. For a binary install, use the unit template
in the core archive at `scripts/service-templates/homecore.service`. From
a source checkout, `scripts/install-service.sh` fills in the same
template for you. By hand:

```bash
INSTALL_DIR="/opt/homecore"
SERVICE_USER="homecore"

# Create a dedicated service user (recommended)
sudo useradd --system --no-create-home --shell /usr/sbin/nologin $SERVICE_USER
sudo chown -R $SERVICE_USER:$SERVICE_USER "$INSTALL_DIR"

# Install the service unit
sudo cp "$INSTALL_DIR/scripts/service-templates/homecore.service" \
        /etc/systemd/system/homecore.service

# Fill in the placeholders
sudo sed -i \
  -e "s|@@USER@@|$SERVICE_USER|g" \
  -e "s|@@GROUP@@|$SERVICE_USER|g" \
  -e "s|@@INSTALL_DIR@@|$INSTALL_DIR|g" \
  /etc/systemd/system/homecore.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable homecore
sudo systemctl start homecore

# Check status and follow logs
sudo systemctl status homecore
sudo journalctl -u homecore -f
```

If you started homeCore by hand for steps 3 and 4, stop it before
starting the service. See
[systemd deployment](../administration/systemd-deployment) for more.

---

## Step 7: Verify

```bash
# Health check (no auth required)
curl http://localhost:8080/api/v1/health

# Sign in with an account from the old machine
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' | jq -r '.token')

# Compare device and rule counts with the old machine
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/system/status | jq '{devices_total, rules_total, plugins_active}'

# Confirm plugins are active
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/plugins | jq '.[] | {plugin_id, status}'

# Watch the event stream for live device updates from plugins
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN"
```

---

## Fresh install (no migration)

Skip steps 1 and 4. After installing:

1. Edit `config/homecore.toml` and set `[location]` (latitude,
   longitude, timezone). The JWT secret is generated for you.
2. Start homeCore and sign in as `admin` with the password from
   `INITIAL_ADMIN_PASSWORD`. Change it, then delete the file.
3. Install plugins from the web app (Plugins → Add) and fill in each
   plugin's settings: hub addresses, API keys, credentials.
4. Install the systemd service (step 6) if you aren't using Docker.

---

## Checklist

```
[ ] Backup archive created and checked on the old machine
[ ] jwt_secret copied (optional)
[ ] Web app data saved (Settings → Data & backups)
[ ] Archive transferred to the new machine
[ ] homeCore installed on the new machine and started once
[ ] Same plugins installed on the new machine
[ ] Restore checked with ?check=true, then staged
[ ] homeCore restarted; old accounts sign in
[ ] homecore.toml reviewed (location, broker, plugin paths)
[ ] Plugin settings checked for the new network
[ ] systemd service installed and enabled (non-Docker)
[ ] Health check passes
[ ] Device and rule counts match the old machine
[ ] All plugins showing active status
[ ] Event stream showing live device updates
```
