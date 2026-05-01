---
id: binary-releases
title: Binary Releases
sidebar_label: Binary Releases
sidebar_position: 2
---

# Binary Releases

HomeCore publishes pre-built static binaries for every tagged release.
For most users this is the fastest path: download a tarball, extract it,
run.

There are three flavors of release archive, all sharing the same
top-level `homecore/` layout so they merge cleanly.

| Flavor | Filename | Contents |
|---|---|---|
| **Core** | `homecore-core-vX.Y.Z-linux-{x86_64,aarch64}.tar.gz` | `homecore` binary + Web UI bundle + config templates + service templates |
| **Plugin** | `<plugin>-vX.Y.Z-linux-{x86_64,aarch64}.tar.gz` | Single plugin fragment under `homecore/plugins/<name>/` |
| **Appliance** | `homecore-appliance-vX.Y.Z-linux-{x86_64,aarch64}.tar.gz` | Core + every plugin merged into one tree |

Every archive ships a matching `.sha256` sidecar. Statically linked
against musl — no glibc, no OpenSSL, no system dependencies.

---

## Where to download

Each component repo publishes its own GitHub Releases page:

- Core: [`homeCore-io/homeCore/releases`](https://github.com/homeCore-io/homeCore/releases)
- Plugins: each `homeCore-io/hc-<name>/releases` (hue, yolink, lutron, …)
- Appliance: published alongside core releases

Workflow-dispatch and `develop`-branch builds also produce these
tarballs — they're attached as GitHub Actions artifacts (90-day
retention) but not as Releases. Useful for tracking the latest develop
build between formal releases:

```bash
gh run list -R homeCore-io/homeCore --workflow release.yml --limit 5
gh run download -R homeCore-io/homeCore <run-id> -n linux-x86_64
```

---

## Verifying the download

```bash
sha256sum -c homecore-core-v0.1.0-linux-x86_64.tar.gz.sha256
# homecore-core-v0.1.0-linux-x86_64.tar.gz: OK
```

If the check fails, do not extract.

---

## Layout — extract is the install

Every flavor extracts to a top-level `homecore/` directory, so you pick
the parent dir yourself.

### Core archive

```
homecore/
├── bin/
│   └── homecore                     # static musl binary
├── config/
│   ├── homecore.toml.example        # copy to homecore.toml and edit
│   └── profiles/                    # ecosystem profiles (Tasmota, Shelly, …)
├── ui/
│   └── dist/                        # Leptos Web UI WASM bundle
├── scripts/
│   └── service-templates/
│       └── homecore.service         # systemd unit template
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

`tar -xf` a plugin fragment over an existing core install — the
`homecore/plugins/hc-hue/` subtree merges in without disturbing
unrelated files.

### Appliance archive

Core + every plugin fragment pre-merged. Single tarball, ready to run.

---

## Quickstart

```bash
# Pick where HomeCore should live; this is the parent of `homecore/`.
mkdir -p ~/homecore-install
cd ~/homecore-install

# Pull the appliance archive for x86_64.
curl -fsSLO https://github.com/homeCore-io/homeCore/releases/download/v0.1.0/homecore-appliance-v0.1.0-linux-x86_64.tar.gz
curl -fsSLO https://github.com/homeCore-io/homeCore/releases/download/v0.1.0/homecore-appliance-v0.1.0-linux-x86_64.tar.gz.sha256
sha256sum -c homecore-appliance-v0.1.0-linux-x86_64.tar.gz.sha256

# Extract. Produces ./homecore/
tar -xzf homecore-appliance-v0.1.0-linux-x86_64.tar.gz

# Copy the example config and start core.
cd homecore
cp config/homecore.toml.example config/homecore.toml
$EDITOR config/homecore.toml
./bin/homecore --config config/homecore.toml
```

---

## Mixing flavors

You can install core + a subset of plugins instead of the full
appliance. Order doesn't matter — each fragment lands under
`homecore/plugins/<name>/`:

```bash
# Core only
tar -xzf homecore-core-v0.1.0-linux-x86_64.tar.gz

# Add a couple of plugins later
tar -xzf hc-hue-v0.1.0-linux-x86_64.tar.gz
tar -xzf hc-yolink-v0.1.0-linux-x86_64.tar.gz
```

Then enable each plugin in `homecore/config/homecore.toml` under its
own `[[plugins]]` block — see
[Configuration](./configuration) for the schema.

---

## systemd registration

The core archive ships a systemd unit template at
`homecore/scripts/service-templates/homecore.service`. Edit the paths
inside to match where you extracted, then:

```bash
sudo cp homecore/scripts/service-templates/homecore.service \
    /etc/systemd/system/homecore.service
sudo systemctl daemon-reload
sudo systemctl enable --now homecore.service
sudo journalctl -u homecore.service -f   # tail the logs
```

For Docker-based deployments, see [Docker](./docker) instead — those
ship as compose bundles rather than tarballs.

---

## Architectures

Both `linux-x86_64` (amd64) and `linux-aarch64` (arm64) tarballs are
published per release. Both are statically linked musl binaries built
inside the same `rust:alpine` Docker image, so behaviour is uniform
across host distributions.

macOS and Windows builds are not currently published — run the Docker
appliance image, or build from source.

---

## Building from source

If you'd rather build it yourself, see
[Installation](./installation) — that path is also kept current for
plugin developers who need a working dev environment.
