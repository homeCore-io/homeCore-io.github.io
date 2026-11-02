---
id: backup-restore
title: Backup & Restore
sidebar_label: Backup & Restore
sidebar_position: 4
---

# Backup & Restore

A homeCore backup is a zip file. You can take one on demand, homeCore
makes them on a schedule by itself, and either kind can be checked and
restored through the API or the web app (Settings › Data & backups).

All backup and restore endpoints require the `admin` role.

## What's in a backup

| Path in the archive | Contents |
|---|---|
| `state.redb` | Device registry, users, API keys, scenes, areas, and other state (redb) |
| `history.db` | Time-series attribute history (SQLite) |
| `config/homecore.toml` | Main configuration |
| `config/modes.toml` | Mode configuration, if present |
| `config/mode_definitions.json` | Criteria-mode definitions, if present |
| `rules/*.ron` | Automation rule files (legacy `.toml` rule files too) |
| `plugins/<plugin_id>/config.toml` | Each registered plugin's config file, if present |
| `calendars/*` | Calendar files (`.ics` and their `.meta.json`) |

Plugin configs are stored by plugin id rather than by path, so a backup
taken on one host restores correctly on another even if the config files
live elsewhere. On restore, each one goes to the path the running host's
`[[plugins]]` table gives for that id.

Not included:

- the audit log (`audit.db`), which records what happened to the house
  rather than what the house is. Copy it separately if you want to keep it.
- the JWT signing secret (`data/jwt_secret`). Restoring onto a new host
  works, but tokens issued by the old host won't be accepted, so everyone
  signs in again.
- log files.

## Backup on demand

`POST /api/v1/system/backup` builds the archive and returns it as
`application/zip`, named `homecore-backup-<timestamp>.zip`.

```bash
# Download a backup to the current directory
curl -s -X POST http://localhost:8080/api/v1/system/backup \
  -H "Authorization: Bearer $TOKEN" \
  -o homecore-backup-$(date +%Y%m%d-%H%M%S).zip

# Check its contents
unzip -l homecore-backup-20260328-143022.zip
```

The backup runs while homeCore is live, with no shutdown needed. homeCore
reads the database files as they are on disk and zips them; there is no
separate snapshot step.

Each backup is recorded in the audit log as `system.backup_created`, and
`GET /system/status` reports the most recent one as `last_backup_at`.

## Scheduled backups

homeCore backs itself up on a schedule set by the `[backup]` section:

```toml
[backup]
every_hours = 24        # default; 0 turns the schedule off
keep        = 7         # newest N are kept, older ones deleted
dir         = "backups" # relative to homeCore's home
```

Each scheduled backup is the same archive as an on-demand one, saved as
`homecore-backup-<UTC timestamp>.zip` in `dir`. A restart doesn't add an
extra one: the next is due a full interval after the newest file already
in the folder. If a scheduled backup fails, homeCore logs a warning and
tries again an hour later.

These files sit on the same disk as homeCore. Keep a copy somewhere else
as well.

To work with the kept backups:

```bash
# The schedule, the folder, and each kept file (name, bytes, created_at)
curl -s http://localhost:8080/api/v1/system/backups \
  -H "Authorization: Bearer $TOKEN" | jq

# Download one
curl -s http://localhost:8080/api/v1/system/backups/homecore-backup-20261018T030000Z.zip \
  -H "Authorization: Bearer $TOKEN" -o latest.zip
```

## Copying backups off the machine

To pull backups to another host, use an API key on an admin account
rather than storing a password in a script:

```bash
#!/bin/bash
# /etc/cron.daily/homecore-backup

BACKUP_DIR="/var/backups/homecore"
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"
curl -s -X POST http://localhost:8080/api/v1/system/backup \
  -H "Authorization: Bearer $HC_BACKUP_KEY" \
  -o "$BACKUP_DIR/homecore-$(date +%Y%m%d).zip"

# Prune old backups
find "$BACKUP_DIR" -name "homecore-*.zip" -mtime +$KEEP_DAYS -delete
```

The backup endpoint checks for the `admin` role, so the key's owner must
be an admin. See [Users & Authentication](./users-auth.md#api-keys) for
creating keys.

## Restore

A restore never overwrites the live databases while homeCore is running.
It is done in two steps: homeCore checks the archive and **stages** it as
`restore-pending.zip` beside the state database, then puts the files in
place the next time it starts, before it opens anything.

### Check first

`?check=true` reads the archive and reports what it would restore and what
it would skip, without changing anything:

```bash
curl -s -X POST "http://localhost:8080/api/v1/system/restore?check=true" \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @homecore-backup-20260328.zip | jq
```

The response lists `restored`, `skipped` and `taken_at` (when the backup
was made). An archive without a `state.redb` is refused as not being a
homeCore backup.

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

`POST /system/restart` shuts homeCore down cleanly (exit code 0) and
relies on whatever supervises it to start it again. Docker's
`restart: unless-stopped` does that. A systemd unit with
`Restart=on-failure` does not restart a process that exited cleanly, so
on systemd use `sudo systemctl restart homecore` instead, or set
`Restart=always` in the unit.

The request body for `/system/restore` is the raw zip bytes, not JSON or
base64. Archives larger than 500 MiB are rejected with 413. The kept-backup
restore also accepts `?check=true`.

At the next start homeCore extracts the staged archive, then renames it to
`restore-applied.zip` so it isn't applied twice. The last applied archive
stays there for you to inspect. Staging is recorded in the audit log as
`system.restore_staged`.

:::caution
Restoring overwrites the current device registry, rules, settings and
user accounts. Take a backup of the current state first if there's any
chance you'll need it.
:::

## Manual database management

These commands assume you are in homeCore's home directory and homeCore is
stopped.

### Wipe everything (start fresh)

```bash
rm -rf data/
# Restart — new admin password generated
```

This also removes the JWT signing secret, so every existing token stops
working.

### Wipe only the device state (keep history)

```bash
rm data/state.redb
# Restart — devices, users and scenes are gone; rule files and history stay
```

This removes devices, users and API keys, scenes, and areas. homeCore
creates a new `admin` account on the next start. Rule files in `rules/`
are untouched and load again.

### Wipe only the time-series history

```bash
rm data/history.db
# Restart — history cleared, devices and rules intact
```

### Integration test cleanup

If an integration test crashes mid-run, remove its leftover databases:

```bash
rm -f /tmp/hc-test-*.redb /tmp/hc-test-*.db
```

## Safety notes

- `state.redb` uses redb's copy-on-write design, so the file stays
  consistent even if homeCore crashes mid-write. Never truncate or
  partially overwrite it.
- `audit.db` is SQLite in WAL mode. Its `-wal` and `-shm` sidecar files
  belong to the database; leave them alone while homeCore is running.
- Rule files in `rules/` are plain RON. Back them up with any file copy
  tool. They are hot-reloaded: homeCore picks up changes about 200 ms
  after the last write, without a restart.
