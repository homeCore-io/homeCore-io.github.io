---
id: backup-restore
title: Backup & Restore
sidebar_label: Backup & Restore
sidebar_position: 4
---

# Backup & Restore

## What's in a backup

HomeCore stores everything in two database files and a set of config/rules files:

| File | Contents |
|---|---|
| `data/state.redb` | Device registry, users, scenes, areas, rule storage metadata |
| `data/history.db` | Time-series attribute history (SQLite) |
| `config/homecore.toml` | Main configuration |
| `config/modes.toml` | Mode definitions |
| `rules/*.toml` | All automation rule files |

## Backup via API

`POST /api/v1/system/backup` streams a zip archive containing all of the above. Requires Admin role.

```bash
# Download backup to current directory
curl -s http://localhost:8080/api/v1/system/backup \
  -H "Authorization: Bearer $TOKEN" \
  -o homecore-backup-$(date +%Y%m%d-%H%M%S).zip

# Verify contents
unzip -l homecore-backup-20260328-143022.zip
```

The backup runs while HomeCore is live — no shutdown needed. The databases are snapshotted using their native copy mechanisms (redb snapshot, SQLite hot backup).

## Automated daily backup

```bash
#!/bin/bash
# /etc/cron.daily/homecore-backup

BACKUP_DIR="/var/backups/homecore"
KEEP_DAYS=30
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"backup","password":"'"$HC_BACKUP_PASS"'"}' | jq -r .token)

mkdir -p "$BACKUP_DIR"
curl -s http://localhost:8080/api/v1/system/backup \
  -H "Authorization: Bearer $TOKEN" \
  -o "$BACKUP_DIR/homecore-$(date +%Y%m%d).zip"

# Prune old backups
find "$BACKUP_DIR" -name "homecore-*.zip" -mtime +$KEEP_DAYS -delete
```

Create a dedicated backup user with Admin role (Admin is required for the backup endpoint):

```bash
curl -s -X POST http://localhost:8080/api/v1/auth/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"backup","password":"strong-backup-password","role":"Admin"}'
```

## Restore from backup

HomeCore must be stopped before restoring:

```bash
# Stop HomeCore
sudo systemctl stop homecore
# (or Ctrl-C if running in a terminal)

# Extract backup
unzip homecore-backup-20260328.zip -d /tmp/hc-restore

# Copy files to the install directory
cp /tmp/hc-restore/data/state.redb  /opt/homecore/data/
cp /tmp/hc-restore/data/history.db  /opt/homecore/data/
cp /tmp/hc-restore/config/*.toml    /opt/homecore/config/
cp /tmp/hc-restore/rules/*.toml     /opt/homecore/rules/

# Restart
sudo systemctl start homecore
```

:::caution
Restoring overwrites the current device registry, rules, and user accounts. Make a backup of the current state first if there's any chance you need it.
:::

## Manual database management

### Wipe everything (start fresh)

```bash
rm -rf data/
# Restart — new admin password generated
```

### Wipe only the device/rule state (keep history)

```bash
rm data/state.redb
# Restart — devices and rules are gone, history preserved
```

### Wipe only the time-series history

```bash
rm data/history.db
# Restart — history cleared, devices and rules intact
```

### Integration test cleanup

If a test crashes mid-run, clean up leftover test databases:

```bash
rm -f /tmp/hc-test-*.redb /tmp/hc-test-*.db
```

## Safety notes

- `state.redb` uses redb's copy-on-write design — the file is always consistent even if HomeCore crashes mid-write. Never truncate or partially overwrite it.
- `history.db` is SQLite with WAL mode. The `-wal` and `-shm` sidecar files are safe to delete when HomeCore is stopped, but should be left alone while it's running.
- Rule files in `rules/` are plain TOML. Back them up with any file copy tool. They are hot-reloaded — changes take effect within 200 ms without restart.
