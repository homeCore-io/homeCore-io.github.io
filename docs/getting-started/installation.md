---
id: installation
title: Installation
sidebar_label: Installation
sidebar_position: 3
---

# Installation

homeCore's core is a single Rust binary with its MQTT broker, databases and
HTTP server built in. A basic install needs no other services.

There are three ways to install it. Most people should use the first:

1. [Docker](./docker): download one compose file and run it. It starts
   core (`hc-core`) and the web app (`hc-web-svelte`) together. The web app
   is where you install plugins, add people and set up the house.
2. A [binary release](./binary-releases) is a pre-built static tarball of
   core that you extract and run. It has no web app; run that separately,
   for example from its container image (see
   [Web UI overview](../web-ui/overview#getting-it)).
3. Building from source is for plugin authors and core developers. The
   rest of this page covers it.

Plugins written in Python, such as the [Assistant](../plugins/assistant),
also need a [plugin runtime](../plugins/runtimes), a separate container you
can add to any of these.

## Build from source

Build from source when you want to run a commit that isn't released yet,
write a plugin, or debug core itself. Otherwise the pre-built releases are
quicker.

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Rust toolchain | stable | [rustup.rs](https://rustup.rs). CI and the release images build with Rust 1.99. |
| C compiler | any | Some dependencies compile bundled C code (SQLite, zstd, aws-lc). |
| pkg-config | any | Usually already installed |
| Git | any | For cloning the repo |

You don't need OpenSSL headers. homeCore uses rustls for TLS.

Also useful:

- `jq` for reading API responses in the shell
- `websocat` for the WebSocket event stream (`cargo install websocat`)
- `just` (`cargo install just`). Core and most plugins have a Justfile with
  `check` and `build` recipes, and plugins also have `package`.

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup update stable
```

### Install system packages (Debian/Ubuntu)

```bash
sudo apt-get update && sudo apt-get install -y build-essential pkg-config git
```

### Install system packages (RHEL/Fedora)

```bash
sudo dnf install -y gcc make pkg-config git
```

### Clone and build

```bash
git clone https://github.com/homeCore-io/homeCore.git
cd homeCore

# Debug build: quick to compile, slower to run
cargo build

# Release build: slower to compile, what the releases ship
cargo build --release
```

The binary is at `target/debug/homecore` or `target/release/homecore`.

The repository root is a Cargo workspace. It holds the server
(`homecore/`), its crates, the Rust plugin SDK and every Rust plugin, so
`cargo build` at the root builds all of them. To build only the server,
run `cargo build -p homecore`.

For a full dev setup with core, plugins and the web app side by side, clone
the workspace with `hc-scripts/workspace-clone.sh` and run
`hc-scripts/run-dev.sh`. In that layout the homeCore repository is checked
out as `core/`. See [Core Development › Workspace](../development/workspace).

## Installation layout

homeCore keeps everything under one base directory. By default that is the
current working directory; `--home` or `HOMECORE_HOME` changes it
([see below](#override-paths-with-environment-variables)). Data, config,
logs and rules all live there, with nothing hidden elsewhere on the system.

Core serves the API and no web UI. The web app (`hc-web-svelte`) runs
separately and passes `/api/v1` through to core; see [Docker](./docker).

This is the layout the binary-release tarball extracts to, plus what core
creates on first start:

```
homecore/
├── bin/
│   └── homecore              ← the binary
├── INITIAL_ADMIN_PASSWORD    ← written on first start; delete after first login
├── config/
│   ├── homecore.toml         ← main config file
│   ├── modes.toml            ← modes (created on first start)
│   ├── glue.toml             ← optional: helpers to create at startup
│   ├── plugins/              ← plugin configs and installed-plugin records
│   ├── calendars/            ← .ics calendars
│   └── profiles/             ← ecosystem profiles (Tasmota, Shelly, …)
├── plugins/                  ← plugin binaries
├── rules/                    ← automation rule RON files (reloaded on change)
├── data/                     ← state.redb, history.db, jwt_secret
├── backups/                  ← automatic backups (daily by default)
└── logs/                     ← homecore.log and rotated files
```

At startup core creates `config/profiles`, `config/calendars`,
`config/plugins`, `data`, `logs` and `rules` if they are missing.

### Install to a directory of your choice

```bash
# Pick where homeCore should live; this is the parent of `homecore/`.
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

Start from the example config. With no config file, core uses built-in
defaults that bind the MQTT broker to `0.0.0.0` with no logins, and core
refuses to start that way. The example binds the broker to `127.0.0.1`.

For a system-wide install at `/opt/homecore` under systemd, the binary
release includes a unit template; see
[Binary Releases › systemd registration](./binary-releases#systemd-registration).
A source build can use the same unit from
`scripts/service-templates/homecore.service`, or run
`scripts/install-service.sh`, which fills in the template for you.

## Checking the install

On first start homeCore creates an `admin` account with a random password.
It prints the password in a banner in the log and writes it to
`INITIAL_ADMIN_PASSWORD` in the base directory:

```
WARN homecore:   Default admin account created.
WARN homecore:   Username : admin
WARN homecore:   Password : AbCdEf12GhIj34Kl
WARN homecore:   Saved to : /home/you/homecore-install/homecore/INITIAL_ADMIN_PASSWORD
WARN homecore:   Change this password immediately after first login!
INFO hc_api: homeCore API server starting addr=0.0.0.0:8080
```

Sign in, change the password, and delete the file. Core writes the password
only when no users exist. If you lose it before changing it, stop core and
delete `data/`, and the next start creates a new admin account and
password. Deleting `data/` also deletes the device registry, users and
history.

Check that the API is up:

```bash
curl http://localhost:8080/api/v1/health
# {"status":"ok","version":"0.1.114"}
```

## Override paths with environment variables

| Variable | Default | Description |
|---|---|---|
| `HOMECORE_HOME` | current working directory | Base directory for data, config and rules |
| `HOMECORE_CONFIG` | `$HOMECORE_HOME/config/homecore.toml` | Config file path. A relative path is resolved against the base directory. |
| `RUST_LOG` | unset | Log filter. When set, it overrides the levels in `[logging]`. |

Or use command-line flags:

```bash
homecore --home /opt/homecore
homecore --config /etc/homecore/homecore.toml
```

For the base directory, `--home` wins, then `HOMECORE_HOME`, then the
current directory. For the config file, `--config` wins, then
`HOMECORE_CONFIG`, then `config/homecore.toml` under the base directory.

## Next steps

- [Quick Start](./quickstart): first login, a test device and a first rule
  through the API.
- [Configuration](./configuration): the full `homecore.toml` reference.
- [Plugins](../plugins/overview): pick which kinds of devices homeCore
  should talk to.
