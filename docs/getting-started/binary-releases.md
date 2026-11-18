---
id: binary-releases
title: Binary Releases
sidebar_label: Binary releases
sidebar_position: 2
---

# Binary Releases

Every tagged release of core and of each Rust plugin comes as a pre-built
static binary: download a tarball, extract it, and run it.

:::note Most people should use Docker
The tarballs hold core only. The web app, which is where you install
plugins, add people and set up the house, is not in them. The
[Docker stack](./docker) runs core and the web app together and is the
recommended install. Use a tarball when you want core outside a container,
and run the web app beside it (see
[Web UI overview](../web-ui/overview#getting-it)).
:::

There are two kinds of release archive. Both extract to the same top-level
`homecore/` directory, so you can extract one over the other.

| Kind | Filename | Contents |
|---|---|---|
| Core | `homecore-core-vX.Y.Z-linux-x86_64.tar.gz` | `homecore` binary, config template, ecosystem profiles, service templates |
| Plugin | `<plugin>-vX.Y.Z-linux-x86_64.tar.gz` | One plugin under `homecore/plugins/<name>/` |

Every archive has a matching `.sha256` file. The binaries are statically
linked against musl, so the host needs no glibc, OpenSSL or other system
libraries.

A plugin release also carries a `plugin.<name>-X.Y.Z-linux-x86_64.tar.zst`.
That is the signed registry artifact core installs when you add a plugin
from the web app's Catalog. You can also install it by hand (see
[Adding plugins](#adding-plugins)).

Python plugins, such as the Assistant, have no tarball here. They install
from the Catalog into a [plugin runtime](../plugins/runtimes).

## Where to download

Core and every Rust plugin are released from one repository,
[`homeCore-io/homeCore`](https://github.com/homeCore-io/homeCore/releases).
The tag says which component a release is for:

| Tag | Component |
|---|---|
| `v0.1.114` | Core |
| `hc-hue-v0.2.9`, `hc-yolink-v0.1.22`, … | That plugin |

Plugins and core are versioned separately, so their numbers don't line up.
Plugin releases land in the same list, so the release GitHub marks as
"Latest" is often a plugin. Pick the newest `v*` tag when you want core.

Only the newest three releases of each component are kept on GitHub, and
the registry offers the same three. Older git tags remain, so you can still
build an older version from source.

The older per-plugin repositories (`homeCore-io/hc-hue` and so on) are
archived. New plugin versions come only from `homeCore-io/homeCore`.

Running the release workflow by hand (`workflow_dispatch`) builds the same
tarballs, versioned `dev-<sha>`, and attaches them to the run as GitHub
Actions artifacts instead of a Release. Ordinary pushes to `develop` run CI
only. To fetch a hand-run build:

```bash
gh run list -R homeCore-io/homeCore --workflow release.yml --limit 5
gh run download -R homeCore-io/homeCore <run-id> -n linux-x86_64
```

## Checking the download

```bash
sha256sum -c homecore-core-v0.1.114-linux-x86_64.tar.gz.sha256
# homecore-core-v0.1.114-linux-x86_64.tar.gz: OK
```

If the check fails, don't extract the archive.

## Layout

Every archive extracts to a top-level `homecore/` directory, so you choose
the parent directory yourself. There is no install step after extracting.

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
├── plugins/                         # empty in the core archive; plugin archives add to it
├── README.md
├── LICENSE-APACHE
└── LICENSE-MIT
```

### Plugin archive

```
homecore/
└── plugins/
    └── hc-hue/
        ├── bin/
        │   └── hc-hue
        └── config/
            └── config.toml.example
```

Extracting a plugin archive over a core install adds
`homecore/plugins/hc-hue/` and leaves everything else alone.

## Quickstart

```bash
# Pick where homeCore should live; this is the parent of `homecore/`.
mkdir -p ~/homecore-install
cd ~/homecore-install

# Download the core archive for x86_64.
curl -fsSLO https://github.com/homeCore-io/homeCore/releases/download/v0.1.114/homecore-core-v0.1.114-linux-x86_64.tar.gz
curl -fsSLO https://github.com/homeCore-io/homeCore/releases/download/v0.1.114/homecore-core-v0.1.114-linux-x86_64.tar.gz.sha256
sha256sum -c homecore-core-v0.1.114-linux-x86_64.tar.gz.sha256

# Extract. Produces ./homecore/
tar -xzf homecore-core-v0.1.114-linux-x86_64.tar.gz

# Copy the example config and start core.
cd homecore
cp config/homecore.toml.example config/homecore.toml
$EDITOR config/homecore.toml
./bin/homecore --config config/homecore.toml
```

Start from the example file. With no config file, core uses built-in
defaults that bind the MQTT broker to `0.0.0.0` with no logins, and core
refuses to start that way. The example binds the broker to `127.0.0.1`.

On first start, core prints the generated admin password in a log banner
and writes it to `homecore/INITIAL_ADMIN_PASSWORD`. Delete that file once
you have signed in and changed the password.

## Adding plugins

Most people should install plugins from the web app
(**Settings › Plugins › Catalog**). Core downloads a signed artifact from
the plugin registry, checks it, and handles updates for you.

On a host that can't reach the registry, download the plugin's `.tar.zst`
from its release and hand it to core. Core treats it the same way as a
registry install:

```bash
curl -s -X POST http://localhost:8080/api/v1/plugins/install \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path": "/abs/path/to/plugin.hue-0.2.9-linux-x86_64.tar.zst"}'
```

You can also unpack a plugin tarball by hand, for a build you want to pin
and run from a path you control. Order doesn't matter; each one lands under
`homecore/plugins/<name>/`:

```bash
# Core only
tar -xzf homecore-core-v0.1.114-linux-x86_64.tar.gz

# Add a couple of plugins later
tar -xzf hc-hue-v0.2.9-linux-x86_64.tar.gz
tar -xzf hc-yolink-v0.1.22-linux-x86_64.tar.gz
```

Then declare each one in `homecore/config/homecore.toml` in its own
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
your `homecore.toml`. You write a `[[plugins]]` block only for a plugin you
unpacked or built yourself. See [Configuration](./configuration#plugins) for
the details.

## systemd registration

The core archive includes a systemd unit template at
`homecore/scripts/service-templates/homecore.service`. It has three
placeholders: `@@USER@@`, `@@GROUP@@` and `@@INSTALL_DIR@@`. Replace them
with the service account and the absolute path of your `homecore/`
directory, then install it:

```bash
sudo cp homecore/scripts/service-templates/homecore.service \
    /etc/systemd/system/homecore.service
sudo systemctl daemon-reload
sudo systemctl enable --now homecore.service
sudo journalctl -u homecore.service -f   # follow the logs
```

The unit restarts core when it exits with an error (`Restart=on-failure`).
A restart from the web app or the API (`POST /api/v1/system/restart`)
exits with code 75, so systemd starts it again. See
[systemd deployment](../administration/systemd-deployment) for a fuller
walkthrough.

## Architectures

Only `linux-x86_64` (amd64) is published. The binaries are statically
linked against musl and built in a `rust:alpine` image, so they behave the
same on any distribution.

There is no `linux-aarch64` (arm64) build of core or the Rust plugins right
now. The release pipeline builds amd64 only, and adding arm64 back is a
small change to the workflow. macOS and Windows builds aren't published
either; build from source there.

## Building from source

To build homeCore yourself, see [Installation](./installation). That page
is also where plugin developers set up a working environment.
