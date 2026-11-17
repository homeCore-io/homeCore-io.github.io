---
id: migration
title: Migration & Fresh Install
sidebar_label: Migration
sidebar_position: 5
---

# Migration & Fresh Install

This guide moves homeCore from one machine to another, with its devices,
rules, users, history and plugin settings. For a clean install with nothing
to move, follow the same steps and skip the backup and restore.

The move uses homeCore's own backup and restore. You take a backup on the
old machine, install homeCore on the new one, and hand it the backup. It
puts the files in place on its next start.

## What moves and how

| What | How it moves |
|---|---|
| Core | Installed fresh on the new machine |
| Plugins | Reinstalled on the new machine, before or after the restore |
| Device registry, users, scenes, areas, plugin runtimes (`state.redb`) | In the backup |
| History (`history.db`) | In the backup |
| `homecore.toml`, `modes.toml`, `mode_definitions.json` | In the backup |
| Rules (`rules/*.ron`) | In the backup |
| Calendars (`config/calendars/`) | In the backup |
| Plugin settings, credentials included | In the backup, one file per plugin |
| `config/glue.toml` and your own profiles in `config/profiles/` | Not in the backup. Copy them by hand if you use them. |
| JWT signing secret (`data/jwt_secret`) | Not in the backup. Copy it by hand if you want old access tokens to keep working. |
| Audit log | Not in the backup |
| The web app's data (pages, everyone's Home, displays, looks, pictures) | Not in homeCore's backup. Save it from the app (see step 1). |
| UI extensions | Not in either backup. Install them again from the Catalog. |

The archive holds the plugins' settings files, passwords and keys included,
so keep it somewhere safe.

## Step 1: Back up the old machine

In the web app, open **Settings › Data & backups** and choose
**Back up now**. Then use the "save them too" link under it to save the
app's own data as well.

Or take homeCore's backup through the API with an admin token:

```bash
# On the OLD machine
TOKEN="your-admin-token"

curl -s -X POST http://localhost:8080/api/v1/system/backup \
  -H "Authorization: Bearer $TOKEN" \
  --output homecore-backup-$(date +%Y%m%d).zip

# Check what's inside
unzip -l homecore-backup-$(date +%Y%m%d).zip
```

homeCore also makes backups by itself, daily by default, in `backups/`
under its home directory. The newest of those works too.

If you want, copy the JWT secret from the old machine's data directory
(`data/jwt_secret`, or `homecore-data/data/jwt_secret` under Docker).

Note which plugins are installed (Settings › Plugins, or
`GET /api/v1/plugins`). You'll install the same ones on the new machine.

Copy the archive to the new machine:

```bash
scp homecore-backup-*.zip user@new-machine:~/
```

## Step 2: Install homeCore on the new machine

Use whichever install suits the new machine:

- [Docker](./docker): create the compose file and an empty `homecore-data`
  directory. This is the usual choice.
- [Binary release](./binary-releases): extract the core archive and copy
  `config/homecore.toml.example` to `config/homecore.toml`. `/opt/homecore`
  is a good place for it.
- [Build from source](./installation#build-from-source): to run a build
  that isn't released yet.

The restore brings back the old `homecore.toml`, so don't bother tuning the
new config yet.

## Step 3: First start and plugins

Start homeCore once. With no users yet, it creates an `admin` account and
writes the password to `INITIAL_ADMIN_PASSWORD` in its home directory (it
also prints it in the log). Sign in with that.

Then install the same plugins the old machine had, from
**Settings › Plugins › Catalog**. You can also do this after the restore.
A restore puts each plugin's settings at `config/plugins/<plugin_id>.toml`,
and an install keeps a settings file it finds there.

For a plugin you installed by hand (an unpacked tarball or your own build),
copy its directory under `plugins/` from the old machine. Its `[[plugins]]`
block comes back with `homecore.toml` in the restore.

## Step 4: Restore the backup

In the app, use **Restore** on Settings › Data & backups. Or, through the
API, get a token on the new machine (with the temporary admin password) and
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

The response lists what would be `restored` and what would be `skipped`.
It matches what the restore does at the next start.

Then stage the restore:

```bash
curl -s -X POST http://localhost:8080/api/v1/system/restore \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @homecore-backup-YYYYMMDD.zip
```

The request body is the raw zip file. homeCore doesn't overwrite its live
databases while it runs. It saves the archive as `restore-pending.zip` next
to the state database and puts the files in place on its next start, before
it opens anything. Restart it to finish:

- Docker: `docker compose restart homecore`
- systemd: `sudo systemctl restart homecore`
- Run by hand: stop it (Ctrl-C) and start it again.

The restart button in the app and `POST /api/v1/system/restart` also work
under Docker and under the systemd unit below. They exit with code 75,
which the unit restarts on.

If you copied `jwt_secret`, restart with a stop and a start, and put the
file in the new `data/` directory while homeCore is stopped.

After the restart, sign in with your old accounts. The temporary admin
password no longer works, because the restored `state.redb` brings back the
old machine's users. Delete `INITIAL_ADMIN_PASSWORD`.

homeCore prints the `restored` and `skipped` lists to stderr (the journal,
or `docker logs`) when it applies the restore.

Finally, put back the app's own data from the file you saved in step 1, on
the same Settings › Data & backups page.

See [Backup & Restore](../administration/backup-restore) for the details of
both endpoints.

## Step 5: Review the config for the new machine

The restored `config/homecore.toml` is the old machine's. Check it against
the new one, in Settings › Configuration or in the file:

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

Things to check:

- Any `[[plugins]]` blocks: the `binary` and `config` paths must exist on
  the new machine, relative to `HOMECORE_HOME` (for example
  `/opt/homecore`). Plugins installed from the Catalog don't appear here.
- Absolute paths elsewhere in the file (storage, logs, TLS certificates)
  must exist on the new machine.
- Plugin settings: hub addresses and similar values may need changing if
  the new machine is on a different network. Edit them on each plugin's
  page in the app.
- Plugin runtimes: they come back with the restore. On
  **Settings › Plugins › Plugin runtimes**, **Show details** gives the
  homeCore address each runtime uses. If that is the old machine's, remove
  the runtime, add it again with the new address, paste the new key into
  the runtime's page, and install its plugins again.

Restart homeCore after editing `homecore.toml`.

## Step 6: Install as a systemd service

Skip this step under Docker. For a binary install, use the unit template in
the core archive at `scripts/service-templates/homecore.service`. From a
source checkout, `scripts/install-service.sh` fills in the same template for
you. By hand:

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

If you started homeCore by hand for steps 3 and 4, stop it before starting
the service. See [systemd deployment](../administration/systemd-deployment)
for more.

## Step 7: Check it works

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

In the app, Settings › System shows the same health and counts, and
Settings › Plugins shows each plugin running.

## Fresh install (nothing to move)

Skip steps 1 and 4. After installing:

1. Set `[location]` (latitude, longitude, timezone) in
   `config/homecore.toml` or Settings › Configuration. The JWT secret is
   generated for you.
2. Start homeCore and sign in as `admin` with the password from
   `INITIAL_ADMIN_PASSWORD`. Change it, then delete the file.
3. Install plugins from **Settings › Plugins › Catalog** and fill in each
   plugin's settings: hub addresses, API keys, logins.
4. Install the systemd service (step 6) if you aren't using Docker.

## Checklist

```
[ ] homeCore backup made and checked on the old machine
[ ] Web app data saved (Settings › Data & backups, "save them too")
[ ] jwt_secret, glue.toml and custom profiles copied (optional)
[ ] Archive copied to the new machine
[ ] homeCore installed on the new machine and started once
[ ] Same plugins installed on the new machine
[ ] Restore checked with ?check=true, then staged
[ ] homeCore restarted; old accounts sign in
[ ] Web app data restored
[ ] homecore.toml reviewed (location, broker, plugin paths)
[ ] Plugin settings checked for the new network
[ ] Plugin runtimes point at the new machine (if any)
[ ] systemd service installed and enabled (non-Docker)
[ ] Health check passes
[ ] Device and rule counts match the old machine
[ ] All plugins running
[ ] Event stream showing live device updates
```
