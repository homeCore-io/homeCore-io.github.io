---
id: installation
title: Installation
sidebar_label: Installation
sidebar_position: 1
---

# Installation

HomeCore is a single Rust binary that embeds everything it needs — MQTT broker, database, and HTTP server. There are no external service dependencies for a basic install.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Rust toolchain | 1.80+ stable | [rustup.rs](https://rustup.rs) |
| Git | any | For cloning the repo |
| OpenSSL dev headers | any | `libssl-dev` on Debian/Ubuntu, `openssl-devel` on RHEL |
| pkg-config | any | Usually pre-installed |

**Optional but recommended:**
- `jq` — for parsing API responses in the shell
- `websocat` — for connecting to the WebSocket event stream (`cargo install websocat`)

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup update stable
```

### Install system dependencies (Debian/Ubuntu)

```bash
sudo apt-get update && sudo apt-get install -y build-essential pkg-config libssl-dev git
```

### Install system dependencies (RHEL/Fedora)

```bash
sudo dnf install -y gcc pkg-config openssl-devel git
```

## Build from source

```bash
# Clone the repository
git clone https://github.com/jeubanks/homeCore.git
cd homeCore/core

# Build (debug — fast compile, slower binary)
cargo build

# Build (release — slower compile, fastest binary — use for production)
cargo build --release
```

The binary is at `target/debug/homecore` or `target/release/homecore`.

## Installation layout

HomeCore uses the **current working directory** as its base. All data, config, logs, and rules are written relative to wherever you run the binary from. There are no hidden directories or scattered system files.

Recommended layout:

```
/opt/homecore/
├── bin/
│   └── homecore          ← the binary
├── config/
│   └── homecore.toml     ← main config file
├── rules/                ← automation rule TOML files (hot-reloaded)
├── data/                 ← created automatically: state.redb, history.db
└── logs/                 ← created automatically when logging.file is enabled
```

### Install to /opt/homecore

```bash
# Create directories
sudo mkdir -p /opt/homecore/{bin,config,rules,logs}

# Copy the binary
sudo cp target/release/homecore /opt/homecore/bin/

# Copy the example config
sudo cp config/homecore.toml /opt/homecore/config/

# Run from the install directory
cd /opt/homecore
./bin/homecore
```

## Verifying the install

On first startup HomeCore prints a temporary admin password and starts listening:

```
INFO homecore: HomeCore starting
INFO homecore: Admin account created — temporary password: AbCdEf12GhIj34Kl
INFO hc_api: API server starting addr="0.0.0.0:8080"
```

**Save the admin password** — it is shown once. If you lose it, wipe `data/` and restart to generate a new one.

Confirm the API is up:

```bash
curl http://localhost:8080/health
# {"status":"ok","version":"0.1.0"}
```

## Running as a systemd service

Create `/etc/systemd/system/homecore.service`:

```ini
[Unit]
Description=HomeCore home automation
After=network.target
Wants=network.target

[Service]
Type=simple
User=homecore
Group=homecore
WorkingDirectory=/opt/homecore
ExecStart=/opt/homecore/bin/homecore
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=homecore
Environment=RUST_LOG=info

[Install]
WantedBy=multi-user.target
```

```bash
# Create a dedicated user
sudo useradd -r -s /bin/false -d /opt/homecore homecore
sudo chown -R homecore:homecore /opt/homecore

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable homecore
sudo systemctl start homecore

# Check status
sudo systemctl status homecore
sudo journalctl -u homecore -f
```

## Override paths with environment variables

| Variable | Default | Description |
|---|---|---|
| `HOMECORE_HOME` | current working directory | Base directory for all data, config, rules |
| `HOMECORE_CONFIG` | `$HOME/config/homecore.toml` | Override config file path only |
| `RUST_LOG` | `info` | Log level (overrides config) |

Or use command-line flags:

```bash
homecore --home /opt/homecore
homecore --config /etc/homecore/homecore.toml
```

Priority order for `home`: `--home` CLI arg → `HOMECORE_HOME` env → current directory.
