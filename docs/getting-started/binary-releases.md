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

There are two flavors of release archive, sharing the same top-level
`homecore/` layout so they merge cleanly.

| Flavor | Filename | Contents |
|---|---|---|
| **Core** | `homecore-core-vX.Y.Z-linux-x86_64.tar.gz` | `homecore` binary + config templates + service templates |
| **Plugin** | `<plugin>-vX.Y.Z-linux-x86_64.tar.gz` | Single plugin fragment under `homecore/plugins/<name>/` |

Every archive ships a matching `.sha256` sidecar. Statically linked
against musl — no glibc, no OpenSSL, no system dependencies.

Two things this does **not** include:

- **A web UI.** Core serves the API. The UI is `hc-web` and runs
  separately — see [Docker](./docker). Core archives used to bundle a
  WASM UI and no longer do.
- **An appliance archive.** `homecore-appliance-*.tar.gz` merged core
  with every plugin into one tree. It is retired; installing plugins
  from the registry through the UI replaces it.

---

## Where to download

Each component repo publishes its own GitHub Releases page:

- Core: [`homeCore-io/homeCore/releases`](https://github.com/homeCore-io/homeCore/releases)
- Plugins: each `homeCore-io/hc-<name>/releases` (hue, yolink, lutron, …)

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
sha256sum -c homecore-core-v0.1.18-linux-x86_64.tar.gz.sha256
# homecore-core-v0.1.18-linux-x86_64.tar.gz: OK
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

## Quickstart

```bash
# Pick where HomeCore should live; this is the parent of `homecore/`.
mkdir -p ~/homecore-install
cd ~/homecore-install

# Pull the core archive for x86_64.
curl -fsSLO https://github.com/homeCore-io/homeCore/releases/download/v0.1.18/homecore-core-v0.1.18-linux-x86_64.tar.gz
curl -fsSLO https://github.com/homeCore-io/homeCore/releases/download/v0.1.18/homecore-core-v0.1.18-linux-x86_64.tar.gz.sha256
sha256sum -c homecore-core-v0.1.18-linux-x86_64.tar.gz.sha256

# Extract. Produces ./homecore/
tar -xzf homecore-core-v0.1.18-linux-x86_64.tar.gz

# Copy the example config and start core.
cd homecore
cp config/homecore.toml.example config/homecore.toml
$EDITOR config/homecore.toml
./bin/homecore --config config/homecore.toml
```

---

## Mixing flavors

Most people should install plugins from the web UI instead — Plugins →
Add — which pulls a signed artifact from the plugin registry and lets core
manage upgrades. Unpacking plugin tarballs by hand is for air-gapped hosts
and for pinning a specific build.

Order doesn't matter; each fragment lands under `homecore/plugins/<name>/`:

```bash
# Core only
tar -xzf homecore-core-v0.1.18-linux-x86_64.tar.gz

# Add a couple of plugins later
tar -xzf hc-hue-v0.1.7-linux-x86_64.tar.gz
tar -xzf hc-yolink-v0.1.8-linux-x86_64.tar.gz
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

The shipped example config deliberately declares **no** plugins. A
registry install records itself separately, in
`config/plugins/managed.toml`, and homeCore never rewrites your
`homecore.toml` — so a `[[plugins]]` block is exactly the thing you write
by hand, for a plugin you unpacked or built yourself. See
[Configuration](./configuration) for the full schema.

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

`linux-x86_64` (amd64) only. Statically linked musl binaries, built inside
a `rust:alpine` Docker image, so behaviour is uniform across host
distributions.

`linux-aarch64` (arm64) is **not currently published**. The release
workflow had an aarch64 matrix entry, but it had been switched off long
enough that no arm64 artifact has shipped in months; rather than keep
advertising a build that was not happening, the pipeline now says amd64 and
means it. Restoring it is a small change to the release workflow.

macOS and Windows builds are not published either — build from source.

---

## Building from source

If you'd rather build it yourself, see
[Installation](./installation) — that path is also kept current for
plugin developers who need a working dev environment.
