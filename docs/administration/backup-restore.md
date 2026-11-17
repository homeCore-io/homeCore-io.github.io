---
id: backup-restore
title: Backup & Restore
sidebar_label: Backup & Restore
sidebar_position: 4
---

# Backup & Restore

A homeCore backup is one zip file. You can make one when you like,
homeCore also makes them on a schedule, and either kind can be checked
and restored over the API or in the web app under **Settings › Data &
backups**.

Every backup and restore endpoint is for admins: a person with the
`admin` role, or an API key that carries `users:write`.

## What's in a backup

| Path in the archive | Contents |
|---|---|
| `state.redb` | Devices, people, API keys (display and plugin keys too), PINs, scenes, rooms, alert rules, plugin runtimes and other state |
| `history.db` | Attribute history (SQLite) |
| `config/homecore.toml` | Main configuration |
| `config/modes.toml` | Mode configuration, if present |
| `config/mode_definitions.json` | Criteria mode definitions, if present |
| `rules/*.ron` | Automation rule files (legacy `.toml` rule files too) |
| `plugins/<plugin_id>/config.toml` | Each plugin's config file, if present |
| `calendars/*` | Calendar files (`.ics` and their `.meta.json`) |

Plugin configs are stored by plugin id, so a backup from one machine
restores on another even if the files lived elsewhere. On restore, each
goes to the path the running machine's `[[plugins]]` table gives for that
id. A plugin that table doesn't list, such as one installed from the
Catalog, or any plugin on a fresh machine, gets its config at
`config/plugins/<plugin_id>.toml`, which is where an installed plugin
reads it first. Only ids starting with `plugin.` are restored this way,
and a config file alone doesn't start a plugin: it still has to be
installed. Before v0.1.97, a restore skipped the config of any plugin not
listed in `[[plugins]]`, even though `?check=true` reported it as
restored.

Not included:

- The web app's own data: its pages, displays' page settings, each
  person's Home, the house's look and the pictures library. The app
  keeps these in its own `/data`. On the **Back up** card, **save them
  too** downloads a copy, and the **Restore** card can put a saved copy
  back.
- The audit log (`audit.db`). Copy it yourself if you want to keep it.
- The JWT signing secret (`data/jwt_secret`). Restoring onto a new
  machine works, but tokens from the old one aren't accepted there, so
  everyone signs in again. API keys and display keys keep working,
  because they live in `state.redb`.
- Installed plugin programs under `plugins/`. Reinstall them from the
  Catalog after restoring onto a fresh machine.
- Log files and earlier backups.

## Backing up now

`POST /api/v1/system/backup` builds the archive and returns it as
`application/zip`, named `homecore-backup-<timestamp>.zip`. In the app,
it is **Back up now**.

```bash
# Download a backup to the current directory
curl -s -X POST http://localhost:8080/api/v1/system/backup \
  -H "Authorization: Bearer $TOKEN" \
  -o homecore-backup-$(date +%Y%m%d-%H%M%S).zip

# List what's in it
unzip -l homecore-backup-20260328-143022.zip
```

homeCore keeps running while it backs up. It reads the database files as
they are on disk and zips them, with no separate snapshot step.

Each backup is recorded in the audit log as `system.backup_created`, and
`GET /system/status` reports the latest as `last_backup_at`.

## Scheduled backups

homeCore backs itself up on the schedule in `[backup]`:

```toml
[backup]
every_hours = 24        # default; 0 turns the schedule off
keep        = 7         # newest N are kept, older ones deleted
dir         = "backups" # relative to homeCore's home
```

A scheduled backup is the same archive, saved as
`homecore-backup-<UTC time>.zip` in `dir`. A restart doesn't add an extra
one: the next is due a full interval after the newest file already in the
folder. If one fails, homeCore logs a warning and tries again an hour
later. In the app, the schedule is under **Settings › Configuration ›
Backups**, and the kept files are listed on the **Back up** card.

These files sit on the same disk as homeCore. Keep a copy somewhere else
too.

```bash
# The schedule, the folder, and each kept file (name, bytes, created_at)
curl -s http://localhost:8080/api/v1/system/backups \
  -H "Authorization: Bearer $TOKEN" | jq

# Download one
curl -s http://localhost:8080/api/v1/system/backups/homecore-backup-20261018T030000Z.zip \
  -H "Authorization: Bearer $TOKEN" -o latest.zip
```

## Copying backups off the machine

To pull backups to another machine, use an API key instead of a stored
password. The backup endpoint needs an admin, so the key must carry
`users:write`, which only an admin's key can hold:

```bash
#!/bin/bash
# /etc/cron.daily/homecore-backup

BACKUP_DIR="/var/backups/homecore"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"
curl -s -X POST http://localhost:8080/api/v1/system/backup \
  -H "Authorization: Bearer $HC_BACKUP_KEY" \
  -o "$BACKUP_DIR/homecore-$(date +%Y%m%d).zip"

# Delete old copies
find "$BACKUP_DIR" -name "homecore-*.zip" -mtime +$KEEP_DAYS -delete
```

Limit the key to the address it runs from with `allowed_cidrs`. See
[Users & Authentication](./users-auth.md#api-keys) for making keys.

## Restore

homeCore never overwrites its databases while it runs. A restore takes two
steps: homeCore checks the archive and stages it as `restore-pending.zip`
next to the state database, then puts the files in place the next time it
starts, before it opens anything.

In the app: on the **Restore** card, **Choose a backup file…** (or
**Put back…** next to a kept backup), read what it brings, then **Put it
back…** and confirm **Put it back and restart**. **Back up now first** is
offered on the same card.

### Check first

`?check=true` reads the archive and reports what it would restore and
what it would skip, changing nothing:

```bash
curl -s -X POST "http://localhost:8080/api/v1/system/restore?check=true" \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @homecore-backup-20260328.zip | jq
```

The response lists `restored`, `skipped` and `taken_at` (when the backup
was made). An archive without `state.redb` is refused as not a homeCore
backup.

### Stage and restart

```bash
# Upload a backup file and stage it
curl -s -X POST http://localhost:8080/api/v1/system/restore \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @homecore-backup-20260328.zip | jq

# Or stage one of the kept backups, without downloading it
curl -s -X POST http://localhost:8080/api/v1/system/backups/homecore-backup-20261018T030000Z.zip/restore \
  -H "Authorization: Bearer $TOKEN" | jq

# Then restart to finish
curl -s -X POST http://localhost:8080/api/v1/system/restart \
  -H "Authorization: Bearer $TOKEN"
```

The body for `/system/restore` is the raw zip, not JSON or base64.
Archives over 500 MiB get 413. The kept-backup restore also takes
`?check=true`.

`POST /system/restart` shuts homeCore down and exits with code 75, and
relies on whatever supervises it to start it again. Docker's restart
policies, launchd's `KeepAlive` and a systemd unit with
`Restart=on-failure` all do. Before v0.1.97 it exited with code 0, which
`Restart=on-failure` treats as a clean stop; on those versions use
`sudo systemctl restart homecore`.

At the next start homeCore extracts the staged archive, then renames it
`restore-applied.zip` so it isn't applied twice. The last applied archive
stays there for you to inspect. Staging is recorded in the audit log as
`system.restore_staged`.

:::caution
A restore replaces the current devices, rules, settings, people and API
keys. Make a backup of the current state first if you might need it.
:::

### Restoring onto a new machine

1. Install homeCore and start it once, so it creates its home directory.
2. Sign in with the first-boot admin password, then restore the backup and
   restart as above. The people and passwords from the backup replace the
   first-boot admin.
3. Reinstall plugins from the Catalog. Their settings come back from the
   backup.
4. Restore the web app's own copy on the **Restore** card, if you saved
   one.
5. If plugin runtimes ran elsewhere, they keep their keys, because the
   runtime records are in `state.redb`. Check they connect on **Settings ›
   Plugins › Plugin runtimes**.

## Managing the databases by hand

These commands assume you are in homeCore's home directory and homeCore is
stopped.

### Start fresh

```bash
rm -rf data/
# Start homeCore: a new admin password is generated
```

This also removes the JWT signing secret, so every existing token stops
working.

### Remove only the state database (keep history)

```bash
rm data/state.redb
# Start homeCore: devices, people and scenes are gone; rule files and history stay
```

This removes devices, people, API keys, displays, scenes, rooms and
plugin runtimes. homeCore creates a new `admin` account on the next
start. Rule files in `rules/` are untouched and load again.

### Remove only the history

```bash
rm data/history.db
# Start homeCore: history cleared, devices and rules intact
```

### Leftovers from a crashed integration test

```bash
rm -f /tmp/hc-test-*.redb /tmp/hc-test-*.db
```

## Safety notes

- `state.redb` is copy-on-write, so the file stays consistent even if
  homeCore crashes mid-write. Never truncate or partly overwrite it.
- `audit.db` is SQLite in WAL mode. Its `-wal` and `-shm` files belong to
  the database; leave them alone while homeCore runs.
- Rule files in `rules/` are plain RON, so any file copy backs them up.
  homeCore reloads them about 200 ms after the last write, without a
  restart.
