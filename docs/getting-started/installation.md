---
id: installation
title: Installation
sidebar_label: Installation
sidebar_position: 3
---

# Installation

HomeCore is a single Rust binary that embeds everything it needs — MQTT
broker, database, and HTTP server. There are no external service
dependencies for a basic install.

There are three install paths, listed in order of preference:

1. **[Binary release](./binary-releases)** — pre-built static tarball,
   ready to extract and run. **The right choice for almost everyone.**
2. **[Docker](./docker)** — single appliance image or compose bundle
   with per-plugin fragments.
3. **Build from source** — for plugin authors and core developers.
   That's what this page covers.

If you just want to run HomeCore, head to
[Binary Releases](./binary-releases) instead.

---

## Build from source

Source builds are useful when:

- You want to run an unreleased commit (e.g. a fix on `develop` before
  it ships).
- You're authoring a new plugin and need a working dev environment.
- You're debugging core itself.

For everything else, the pre-built tarballs are fastest.

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Rust toolchain | stable | [rustup.rs](https://rustup.rs) |
| Git | any | For cloning the repo |
| OpenSSL dev headers | any | Only required for builds linking dynamically; the published static binaries don't need this on the host |
| pkg-config | any | Usually pre-installed |

**Optional but recommended:**
- `jq` — for parsing API responses in the shell
- `websocat` — for connecting to the WebSocket event stream (`cargo install websocat`)
- `just` — every plugin ships a Justfile with `check` / `build` /
  `package` recipes (`cargo install just`)

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

### Clone + build

```bash
git clone https://github.com/homeCore-io/homeCore.git
cd homeCore/core

# Build (debug — fast compile, slower binary)
cargo build

# Build (release — slower compile, fastest binary — production-equivalent)
cargo build --release
```

The binary is at `target/debug/homecore` or `target/release/homecore`.

For a multi-component dev environment (core + plugins + UI together),
clone the meta-layout repos and run `hc-scripts/run-dev.sh` — see
[Core Development → Workspace](../development/workspace).

---

## Installation layout

HomeCore uses the **current working directory** as its base. All data,
config, logs, and rules are written relative to wherever you run the
binary from. There are no hidden directories or scattered system files.

Recommended layout (matches what binary-release tarballs extract to):

```
homecore/
├── bin/
│   └── homecore          ← the binary
├── config/
│   ├── homecore.toml     ← main config file
│   └── profiles/         ← ecosystem profiles (Tasmota, Shelly, …)
├── ui/
│   └── dist/             ← Web UI WASM bundle (core archive ships this; source builds need a separate trunk build)
├── plugins/              ← per-plugin fragments (bin/ + config/) merge in here
├── rules/                ← automation rule RON files (hot-reloaded)
├── data/                 ← created automatically: state.redb, history.db
└── logs/                 ← created automatically when logging.file is enabled
```

### Install to a parent directory

```bash
# Pick where HomeCore should live; this is the parent of `homecore/`.
mkdir -p ~/homecore-install/homecore/{bin,config,rules}
cd ~/homecore-install

# Copy the binary you just built
cp /path/to/homeCore/core/target/release/homecore homecore/bin/

# Copy the example config
cp /path/to/homeCore/core/config/homecore.toml.example homecore/config/homecore.toml
$EDITOR homecore/config/homecore.toml

# Run from the install directory
cd homecore
./bin/homecore --config config/homecore.toml
```

For a system-wide install at `/opt/homecore` with a dedicated user
under systemd, the binary-release archive ships a unit template — see
[Binary Releases → systemd registration](./binary-releases#systemd-registration).
Source builds can copy that same unit and point its `WorkingDirectory`
+ `ExecStart` at wherever you placed the build.

---

## Verifying the install

On first startup HomeCore prints a temporary admin password and starts
listening:

```
INFO homecore: HomeCore starting
INFO homecore: Admin account created — temporary password: AbCdEf12GhIj34Kl
INFO hc_api: API server starting addr="0.0.0.0:8080"
```

**Save the admin password** — it is shown once. If you lose it, wipe
`data/` and restart to generate a new one.

Confirm the API is up:

```bash
curl http://localhost:8080/health
# {"status":"ok","version":"0.1.0"}
```

---

## Override paths with environment variables

| Variable | Default | Description |
|---|---|---|
| `HOMECORE_HOME` | current working directory | Base directory for all data, config, rules |
| `HOMECORE_CONFIG` | `$HOMECORE_HOME/config/homecore.toml` | Override config file path only |
| `RUST_LOG` | `info` | Log level (overrides config) |

Or use command-line flags:

```bash
homecore --home /opt/homecore
homecore --config /etc/homecore/homecore.toml
```

Priority order for `home`: `--home` CLI arg → `HOMECORE_HOME` env →
current directory.

---

## Next steps

- **[Quickstart](./quickstart)** — first login, add a device, write a rule.
- **[Configuration](./configuration)** — full `homecore.toml` reference.
- **[Plugins → Overview](../plugins/overview)** — pick which device
  ecosystems you want HomeCore to talk to.
