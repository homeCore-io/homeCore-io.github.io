---
id: migration
title: Migration & Fresh Install
sidebar_label: Migration
sidebar_position: 5
---

# Migration & Fresh Install

This guide covers moving homeCore from one machine to another — including all data, rules, plugin configs, and running state. The same steps work for a clean VM install without migrating data; just skip the backup/restore sections.

---

## Overview

| What | How |
|---|---|
| Binary + plugins | Rebuilt from source on the new machine |
| Config (`homecore.toml`, `modes.toml`) | Copied from backup or source repo |
| Rules (`rules/*.ron`) | Included in the system backup archive |
| Device state (`state.redb`) | Included in the system backup archive |
| Device history (`history.db`) | Included in the system backup archive |
| Plugin configs (credentials) | Copied manually — **not** included in the backup |

---

## Step 1 — Back up the running system

With homeCore running on the source machine, trigger a backup via the API. The backup is a zip archive containing `state.redb`, `history.db`, `config/`, and `rules/`.

```bash
# On the SOURCE machine
TOKEN="your-admin-token"

curl -s -X POST http://localhost:8080/api/v1/system/backup \
  -H "Authorization: Bearer $TOKEN" \
  --output homecore-backup-$(date +%Y%m%d).zip

# Verify the archive
unzip -l homecore-backup-$(date +%Y%m%d).zip
```

Also copy the plugin configs manually — these contain credentials and are not included in the system backup:

```bash
# On the SOURCE machine — adjust path to your install location
INSTALL_DIR="/var/tmp/homeCore"   # or wherever deploy.sh installed to

tar -czf plugin-configs-$(date +%Y%m%d).tar.gz \
  "$INSTALL_DIR/plugins/hc-yolink/config/config.toml" \
  "$INSTALL_DIR/plugins/hc-lutron/config/config.toml" \
  "$INSTALL_DIR/plugins/hc-sonos/config/config.toml" \
  "$INSTALL_DIR/plugins/hc-hue/config/config.toml" \
  "$INSTALL_DIR/plugins/hc-zwave/config/config.toml" \
  "$INSTALL_DIR/plugins/hc-wled/config/config.toml" \
  "$INSTALL_DIR/plugins/hc-isy/config/config.toml"
```

Transfer both archives to the new machine:

```bash
scp homecore-backup-*.zip plugin-configs-*.tar.gz user@new-machine:~/
```

---

## Step 2 — Prepare the new VM

### Install system dependencies

**Debian / Ubuntu:**
```bash
sudo apt update && sudo apt install -y \
  build-essential pkg-config libssl-dev git curl jq
```

**RHEL / Fedora / Rocky:**
```bash
sudo dnf install -y gcc pkg-config openssl-devel git curl jq
```

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup update stable
```

**Node.js** (required only for `hc-matter`):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## Step 3 — Clone the workspace

Set up SSH access to GitHub, then use the workspace clone script to pull all repos in one step:

```bash
# Clone hc-scripts first — it contains the workspace manifest and tools
git clone git@github.com:homeCore-io/hc-scripts.git
cd hc-scripts

# Clone all repos (core + all plugins + clients) into the workspace
./workspace-clone.sh --dest ~/homeCore
```

This creates the full workspace layout:

```
~/homeCore/
  core/
  plugins/hc-yolink/  hc-lutron/  hc-sonos/  hc-hue/  hc-wled/  ...
  clients/hc-web-leptos/  hc-tui/  hc-web-admin-react/  ...
  sdks/hc-plugin-sdk-rs/  hc-plugin-sdk-py/  hc-plugin-sdk-js/  hc-plugin-sdk-dotnet/
```

---

## Step 4 — Build and install

Use `deploy.sh` to build all components and install them to the destination directory:

```bash
cd ~/homeCore/hc-scripts

# Build everything and install to /opt/homecore
./deploy.sh --all --dest /opt/homecore --sync-config

# Or install to the default location (/var/tmp/homeCore) for testing first
./deploy.sh --all --sync-config
```

`deploy.sh --sync-config` copies the example configs on first run. The destination layout will be:

```
/opt/homecore/
  bin/homecore
  config/
    homecore.toml        ← populated from .example; needs your credentials
    modes.toml
    profiles/
  rules/                 ← copied from source by --sync-config
  data/                  ← restored in Step 5
  logs/
  plugins/
    hc-yolink/bin/  config/  logs/
    hc-lutron/bin/  config/  logs/
    ...
```

---

## Step 5 — Restore data

### Restore the system backup

```bash
INSTALL_DIR="/opt/homecore"

# Extract the backup archive
unzip ~/homecore-backup-*.zip -d /tmp/homecore-restore

# Copy the databases
cp /tmp/homecore-restore/data/state.redb   "$INSTALL_DIR/data/"
cp /tmp/homecore-restore/data/history.db   "$INSTALL_DIR/data/"

# Copy rules (skip examples)
rsync -av --exclude='examples/' \
  /tmp/homecore-restore/rules/ \
  "$INSTALL_DIR/rules/"

# Copy config (review before overwriting credentials)
cp /tmp/homecore-restore/config/homecore.toml "$INSTALL_DIR/config/homecore.toml"
cp /tmp/homecore-restore/config/modes.toml    "$INSTALL_DIR/config/modes.toml" 2>/dev/null || true
```

### Restore plugin configs

```bash
INSTALL_DIR="/opt/homecore"
tar -xzf ~/plugin-configs-*.tar.gz -C /

# Or manually copy each one
cp /tmp/plugin-configs/hc-yolink/config/config.toml \
   "$INSTALL_DIR/plugins/hc-yolink/config/config.toml"
# repeat for each plugin
```

---

## Step 6 — Update config for the new machine

Open `$INSTALL_DIR/config/homecore.toml` and review:

```toml
[server]
host = "0.0.0.0"
port = 8080

[location]
latitude  = 38.9072    # confirm this is still correct
longitude = -77.0369
timezone  = "America/New_York"

[auth]
# Change the JWT secret if you want to invalidate all old tokens
jwt_secret = "your-long-random-secret"

[[plugins]]
id      = "plugin.yolink"
binary  = "plugins/hc-yolink/bin/hc-yolink"    # relative to HOMECORE_HOME
config  = "plugins/hc-yolink/config/config.toml"
enabled = true
# repeat for each plugin...
```

Key things to verify:
- `jwt_secret` — migrate as-is to keep existing tokens valid, or change to invalidate them
- Plugin `binary` and `config` paths — must be relative to `HOMECORE_HOME` (`/opt/homecore`)
- Plugin credentials inside each `plugins/hc-*/config/config.toml` — IP addresses and API keys may need updating if the new machine is on a different network segment

---

## Step 7 — Install as a systemd service

A service unit template is included in the repo at `core/scripts/service-templates/homecore.service`. Install it:

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

---

## Step 8 — Verify

```bash
INSTALL_DIR="/opt/homecore"

# Health check (no auth required)
curl http://localhost:8080/api/v1/health

# Get a token (admin password printed to journal on first run if no state was restored)
# If state.redb was restored, your existing credentials work
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' | jq -r '.token')

# Confirm device count matches the source system
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/system/status | jq '{devices, rules, plugins}'

# Confirm plugins are active
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/plugins | jq '.[].status'

# Watch the event stream — you should see device state updates from plugins
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN"
```

---

## Fresh install (no migration)

Skip Steps 1 and 5. After `deploy.sh`:

1. Edit `config/homecore.toml` — set `jwt_secret`, `[location]`, and plugin entries
2. Edit each `plugins/hc-*/config/config.toml` — fill in device IPs, API keys, credentials
3. Install the systemd service (Step 7)
4. Start homeCore — admin credentials are printed to the console/journal on first run

---

## Checklist

```
[ ] Backup archive created and verified on source machine
[ ] Plugin configs archived separately
[ ] Archives transferred to new machine
[ ] Rust toolchain installed (rustup stable)
[ ] Workspace cloned via workspace-clone.sh
[ ] deploy.sh ran successfully (all binaries installed)
[ ] state.redb and history.db restored to data/
[ ] Rules restored to rules/
[ ] homecore.toml reviewed (jwt_secret, location, plugin paths)
[ ] Plugin configs restored and credentials verified
[ ] systemd service installed and enabled
[ ] Health check passes
[ ] Device count matches source system
[ ] All plugins showing active status
[ ] Event stream showing live device updates
```
