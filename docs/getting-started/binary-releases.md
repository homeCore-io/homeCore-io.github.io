---
id: binary-releases
title: Binary Releases
sidebar_label: Binary Releases
sidebar_position: 2
---

# Binary Releases

HomeCore publishes pre-built static binaries for every tagged release.
For most people this is the fastest way in: download a tarball, extract
it, and run it.

There are two kinds of release archive. Both use the same top-level
`homecore/` directory, so they merge cleanly when you extract one over
the other.

| Kind | Filename | Contents |
|---|---|---|
| **Core** | `homecore-core-vX.Y.Z-linux-x86_64.tar.gz` | `homecore` binary, config template, ecosystem profiles, service templates |
| **Plugin** | `<plugin>-vX.Y.Z-linux-x86_64.tar.gz` | One plugin fragment under `homecore/plugins/<name>/` |

Every archive has a matching `.sha256` file. The binaries are statically
linked against musl, so the host needs no glibc, OpenSSL or other system
libraries.

A plugin release also carries a `plugin.<name>-X.Y.Z-linux-x86_64.tar.zst`.
That is the signed registry artifact core installs when you add a plugin
from the web app. You can also install it by hand (see
[Adding plugins](#mixing-flavors)).

The archives do not include a web UI. Core serves only the API. The web
app (`hc-web-svelte`) runs separately; see [Docker](./docker).

---

## Where to download

Core and every Rust plugin are released from one repository,
[`homeCore-io/homeCore`](https://github.com/homeCore-io/homeCore/releases).
The tag tells you which component a release is for:

| Tag | Component |
|---|---|
| `v0.1.96` | Core |
| `hc-hue-v0.2.6`, `hc-yolink-v0.1.20`, … | That plugin |

Plugins and core are versioned separately, so their numbers don't line
up. Because plugin releases land in the same list, the release GitHub
marks as "Latest" is often a plugin. Pick the newest `v*` tag when you
want core.

The older per-plugin repositories (`homeCore-io/hc-hue` and so on) are
archived. Their existing releases are still there, but new plugin
versions are published only from `homeCore-io/homeCore`.

A manual run of the release workflow (`workflow_dispatch`) builds the
same tarballs, versioned `dev-<sha>`, and attaches them to the run as
GitHub Actions artifacts instead of a Release. Ordinary pushes to
`develop` run CI only and do not produce these archives. To fetch a
dispatched build:

```bash
gh run list -R homeCore-io/homeCore --workflow release.yml --limit 5
gh run download -R homeCore-io/homeCore <run-id> -n linux-x86_64
```

---

## Verifying the download

```bash
sha256sum -c homecore-core-v0.1.96-linux-x86_64.tar.gz.sha256
# homecore-core-v0.1.96-linux-x86_64.tar.gz: OK
```

If the check fails, don't extract the archive.

---

## Layout: extracting is installing

Every archive extracts to a top-level `homecore/` directory, so you
choose the parent directory yourself.

### Core archive

```
homecore/
├── bin/
│   └── homecore                     # static musl binary
├── config/
│   ├── homecore.toml.example        # copy to homecore.toml and edit
│   └── profiles/                    # ecosystem profiles (Tasmota, Shelly, …)
├── scripts/
│   └── service-templates/
│       ├── homecore.service              # systemd unit template
│       ├── homecore-mosquitto.service
│       └── com.homecore.homecore.plist   # launchd template
├── plugins/                         # empty in core archive — plugin fragments merge here
├── README.md
├── LICENSE-APACHE
└── LICENSE-MIT
```

### Plugin fragment

```
homecore/
└── plugins/
    └── hc-hue/
        ├── bin/
        │   └── hc-hue
        └── config/
            └── config.toml.example
```

Extracting a plugin fragment over an existing core install adds the
`homecore/plugins/hc-hue/` subtree and leaves other files alone.

## Quickstart

```bash
# Pick where HomeCore should live; this is the parent of `homecore/`.
mkdir -p ~/homecore-install
cd ~/homecore-install

# Pull the core archive for x86_64.
curl -fsSLO https://github.com/homeCore-io/homeCore/releases/download/v0.1.96/homecore-core-v0.1.96-linux-x86_64.tar.gz
curl -fsSLO https://github.com/homeCore-io/homeCore/releases/download/v0.1.96/homecore-core-v0.1.96-linux-x86_64.tar.gz.sha256
sha256sum -c homecore-core-v0.1.96-linux-x86_64.tar.gz.sha256

# Extract. Produces ./homecore/
tar -xzf homecore-core-v0.1.96-linux-x86_64.tar.gz

# Copy the example config and start core.
cd homecore
cp config/homecore.toml.example config/homecore.toml
$EDITOR config/homecore.toml
./bin/homecore --config config/homecore.toml
```

Start from the example file rather than an empty config. With no config
file, core falls back to built-in defaults, which bind the MQTT broker
to `0.0.0.0` with no credentials, and core refuses to start in that
state. The example binds the broker to `127.0.0.1`.

On first start, core prints the generated admin password in a log
banner and writes it to `homecore/INITIAL_ADMIN_PASSWORD`. Delete that
file once you have signed in and changed the password.

---

## Mixing flavors

Most people should install plugins from the web app (Plugins → Add).
Core downloads a signed artifact from the plugin registry, verifies it,
and manages upgrades for you.

On a host that can't reach the registry, download the plugin's
`.tar.zst` from its release and hand it to core. Core treats it the
same way as a registry install:

```bash
curl -s -X POST http://localhost:8080/api/v1/plugins/install \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path": "/abs/path/to/plugin.hue-0.2.6-linux-x86_64.tar.zst"}'
```

Unpacking a plugin tarball by hand is the other option, for a build you
want to pin and supervise from a path you control. Order doesn't
matter; each fragment lands under `homecore/plugins/<name>/`:

```bash
# Core only
tar -xzf homecore-core-v0.1.96-linux-x86_64.tar.gz

# Add a couple of plugins later
tar -xzf hc-hue-v0.2.6-linux-x86_64.tar.gz
tar -xzf hc-yolink-v0.1.20-linux-x86_64.tar.gz
```

Then declare each one in `homecore/config/homecore.toml` under its own
`[[plugins]]` block, pointing at where you unpacked it:

```toml
[[plugins]]
id      = "plugin.hue"
binary  = "plugins/hc-hue/bin/hc-hue"
config  = "plugins/hc-hue/config/config.toml"
enabled = true
```

The example config declares no plugins. A registry or `.tar.zst` install
records itself in `config/plugins/managed.toml`, and core never rewrites
your `homecore.toml`. You write a `[[plugins]]` block only for a plugin
you unpacked or built yourself. See [Configuration](./configuration) for
the full schema.

---

## systemd registration

The core archive includes a systemd unit template at
`homecore/scripts/service-templates/homecore.service`. It contains
three placeholders, `@@USER@@`, `@@GROUP@@` and `@@INSTALL_DIR@@`.
Replace them with the service account and the absolute path of your
`homecore/` directory, then install it:

```bash
sudo cp homecore/scripts/service-templates/homecore.service \
    /etc/systemd/system/homecore.service
sudo systemctl daemon-reload
sudo systemctl enable --now homecore.service
sudo journalctl -u homecore.service -f   # tail the logs
```

The unit restarts core only when it exits with an error
(`Restart=on-failure`). A restart requested through the API
(`POST /api/v1/system/restart`) ends the process cleanly, so systemd
does not start it again. Under systemd, restart with
`sudo systemctl restart homecore` instead. See
[systemd deployment](../administration/systemd-deployment) for a fuller
walkthrough.

For Docker, see [Docker](./docker). Those deployments use container
images, not tarballs.

---

## Architectures

Only `linux-x86_64` (amd64) is published. The binaries are statically
linked against musl and built inside a `rust:alpine` Docker image, so
they behave the same across host distributions.

`linux-aarch64` (arm64) is not currently published. The release
workflow used to have an aarch64 matrix entry, but it had been switched
off for months and no arm64 artifact shipped. The pipeline now builds
amd64 only. Restoring arm64 is a small change to the release workflow.

macOS and Windows builds are not published either. Build from source on
those platforms.

---

## Building from source

To build HomeCore yourself, see [Installation](./installation). That
page is also the starting point for plugin developers who need a
working dev environment.
