---
id: installation
title: Installation
sidebar_label: Installation
sidebar_position: 3
---

# Installation

HomeCore is a single Rust binary with its MQTT broker, databases and
HTTP server built in. A basic install depends on no external services.

There are three ways to install it, in order of preference:

1. **[Binary release](./binary-releases).** A pre-built static tarball
   you extract and run. This is the right choice for almost everyone.
2. **[Docker](./docker).** Core (`hc-core`) and the web app
   (`hc-web-svelte`) as two containers, wired together by compose.
3. **Build from source.** For plugin authors and core developers. This
   page covers that path.

If you only want to run HomeCore, go to
[Binary Releases](./binary-releases) instead.

---

## Build from source

A source build makes sense when:

- You want to run an unreleased commit, such as a fix on `develop`
  before it ships.
- You're writing a plugin and need a working dev environment.
- You're debugging core itself.

Otherwise, the pre-built tarballs are quicker.

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Rust toolchain | stable | [rustup.rs](https://rustup.rs). CI and the release images build with Rust 1.99. |
| C compiler | any | Some dependencies compile bundled C code (SQLite, zstd, aws-lc). |
| pkg-config | any | Usually pre-installed |
| Git | any | For cloning the repo |

OpenSSL headers are not needed. HomeCore uses rustls for TLS.

Optional but useful:
- `jq` for reading API responses in the shell
- `websocat` for connecting to the WebSocket event stream (`cargo install websocat`)
- `just`, since core and most plugins ship a Justfile with `check` and
  `build` recipes (plugins also have `package`) (`cargo install just`)

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup update stable
```

### Install system dependencies (Debian/Ubuntu)

```bash
sudo apt-get update && sudo apt-get install -y build-essential pkg-config git
```

### Install system dependencies (RHEL/Fedora)

```bash
sudo dnf install -y gcc make pkg-config git
```

### Clone + build

```bash
git clone https://github.com/homeCore-io/homeCore.git
cd homeCore

# Build (debug — fast compile, slower binary)
cargo build

# Build (release — slower compile, fastest binary — production-equivalent)
cargo build --release
```

The binary is at `target/debug/homecore` or `target/release/homecore`.

The repository root is a Cargo workspace. It contains the server
(`homecore/`), its crates, the Rust plugin SDK and every Rust plugin, so
`cargo build` at the root builds all of them. To build only the server,
use `cargo build -p homecore`.

For a full dev environment with core, plugins and the web app side by
side, clone the workspace with `hc-scripts/workspace-clone.sh` and run
`hc-scripts/run-dev.sh`. In that layout the homeCore repository is
checked out as `core/`. See
[Core Development → Workspace](../development/workspace).

---

## Installation layout

HomeCore uses one base directory for everything. By default that is the
current working directory; `--home` or `HOMECORE_HOME` changes it
([see below](#override-paths-with-environment-variables)). Data, config,
logs and rules all live under it, with no hidden directories or files
scattered around the system.

Core serves the API and no web UI. The web app (`hc-web-svelte`) runs
separately and passes `/api/v1` through to core; see [Docker](./docker).

Recommended layout (this matches what the binary-release tarball
extracts to, plus what core creates on first start):

```
homecore/
├── bin/
│   └── homecore              ← the binary
├── INITIAL_ADMIN_PASSWORD    ← written on first start; delete after first login
├── config/
│   ├── homecore.toml         ← main config file
│   ├── modes.toml            ← modes (created on first start)
│   ├── plugins/              ← plugin configs and installed-plugin records
│   ├── calendars/            ← .ics calendars
│   └── profiles/             ← ecosystem profiles (Tasmota, Shelly, …)
├── plugins/                  ← plugin binaries
├── rules/                    ← automation rule RON files (hot-reloaded)
├── data/                     ← state.redb, history.db, jwt_secret
├── backups/                  ← automatic backups (daily by default)
└── logs/                     ← homecore.log and rotated files
```

At startup core creates `config/profiles`, `config/calendars`,
`config/plugins`, `data`, `logs` and `rules` if they are missing.

### Install to a parent directory

```bash
# Pick where HomeCore should live; this is the parent of `homecore/`.
mkdir -p ~/homecore-install/homecore/{bin,config,rules}
cd ~/homecore-install

# Copy the binary you just built
cp /path/to/homeCore/target/release/homecore homecore/bin/

# Copy the example config
cp /path/to/homeCore/config/homecore.toml.example homecore/config/homecore.toml
$EDITOR homecore/config/homecore.toml

# Run from the install directory
cd homecore
./bin/homecore --config config/homecore.toml
```

Use the example config as your starting point. Without a config file,
core uses its built-in defaults, which bind the MQTT broker to `0.0.0.0`
with no credentials, and core refuses to start that way. The example
binds the broker to `127.0.0.1`.

For a system-wide install at `/opt/homecore` with a dedicated user
under systemd, the binary-release archive includes a unit template; see
[Binary Releases → systemd registration](./binary-releases#systemd-registration).
A source build can use the same unit from
`scripts/service-templates/homecore.service`, or run
`scripts/install-service.sh`, which fills in the template for you.

---

## Verifying the install

On first start HomeCore creates an `admin` account with a random
password. It prints the password in a banner in the log and writes it
to `INITIAL_ADMIN_PASSWORD` in the base directory:

```
WARN homecore:   Default admin account created.
WARN homecore:   Username : admin
WARN homecore:   Password : AbCdEf12GhIj34Kl
WARN homecore:   Saved to : /home/you/homecore-install/homecore/INITIAL_ADMIN_PASSWORD
WARN homecore:   Change this password immediately after first login!
INFO hc_api: HomeCore API server starting addr=0.0.0.0:8080
```

Sign in, change the password, and delete the file. Core writes the
password only when no users exist. If you lose it before changing it,
stop core and delete `data/`; the next start creates a new admin
account and password. Deleting `data/` also deletes the device
registry, users and history.

Confirm the API is up:

```bash
curl http://localhost:8080/api/v1/health
# {"status":"ok","version":"0.1.96"}
```

---

## Override paths with environment variables

| Variable | Default | Description |
|---|---|---|
| `HOMECORE_HOME` | current working directory | Base directory for all data, config, rules |
| `HOMECORE_CONFIG` | `$HOMECORE_HOME/config/homecore.toml` | Override config file path only. A relative path is resolved against the base directory. |
| `RUST_LOG` | unset | Log filter directives. When set, it overrides the levels in `[logging]`. |

Or use command-line flags:

```bash
homecore --home /opt/homecore
homecore --config /etc/homecore/homecore.toml
```

Priority order for the base directory: `--home` flag, then
`HOMECORE_HOME`, then the current directory. For the config file:
`--config`, then `HOMECORE_CONFIG`, then `config/homecore.toml` under
the base directory.

---

## Next steps

- **[Quickstart](./quickstart)**: first login, a test device, a first rule.
- **[Configuration](./configuration)**: the full `homecore.toml` reference.
- **[Plugins → Overview](../plugins/overview)**: choose which device
  ecosystems HomeCore should talk to.
