---
id: docker
title: Docker Deployment
sidebar_label: Docker
sidebar_position: 5
---

# Docker Deployment

The Docker stack is the recommended way to run homeCore. It runs core and
the web app together, and the web app is where you install plugins, add
people and set up the house. The [binary release](./binary-releases) tarball
holds core alone, with no web app.

homeCore runs as two containers:

```
browser ─▶ host:3001 ─▶ hc-web-svelte:3000 ─┬─ /            the web app
                                            └─ /api/v1/* ──▶ hc-core:8080 ──▶ plugins (child processes)
                                                                │
                                                                └─ embedded MQTT broker
```

| Image | What it is |
|---|---|
| `ghcr.io/homecore-io/hc-core` | The REST/WebSocket API and the embedded MQTT broker. |
| `ghcr.io/homecore-io/hc-web-svelte` | The web app. Its Node server serves the app, passes `/api/v1/*` and the event stream through to core on the same origin, keeps sign-ins in httpOnly cookies, and stores the app's own data (pages, displays, looks, pictures, extensions) in `/data`. |
| `ghcr.io/homecore-io/hc-runtime-python` | Optional. A [plugin runtime](../plugins/runtimes) for plugins written in Python, such as the [Assistant](../plugins/assistant). Run it beside the stack or on another machine. |

Plugins are not containers. Install them from the web app
(**Settings › Plugins › Catalog**). Core downloads a signed artifact from the
[plugin registry](https://github.com/homeCore-io/registry), checks its
signature, and runs it as a child process. You never edit a compose file to
add hardware support.

The reference compose files are in
[`homeCore-io/docker`](https://github.com/homeCore-io/docker). The file
below is its `compose.yml` without the comments. You can clone the
repository instead of writing the file yourself.

## Quick start

Create a directory for the stack and a `compose.yml` in it:

```yaml
services:
  homecore:
    image: ghcr.io/homecore-io/hc-core:latest
    container_name: homecore
    restart: unless-stopped
    pull_policy: always
    environment:
      RUST_LOG: info
    ports:
      - "${HC_API_PORT:-8080}:8080"
      - "${HC_BROKER_PORT:-1883}:1883"
    networks: [homecore]
    volumes:
      - ./homecore-data:/homecore

  app:
    image: ghcr.io/homecore-io/hc-web-svelte:latest
    container_name: hc-web-svelte
    restart: unless-stopped
    pull_policy: always
    depends_on:
      - homecore
    environment:
      HC_CORE_URL: http://homecore:8080
    networks: [homecore]
    ports:
      - "${HC_WEB_PORT:-3001}:3000"
    volumes:
      - app-data:/data

networks:
  homecore:
    driver: bridge

volumes:
  app-data:
```

Then start it:

```bash
# Create the data dir as your user. The entrypoint detects the owner and
# drops privileges to match; no chown needed.
mkdir homecore-data

docker compose up -d

# First-boot admin password:
cat homecore-data/INITIAL_ADMIN_PASSWORD
```

Open `http://<host-ip>:3001`, sign in as `admin`, change the password, and
delete `INITIAL_ADMIN_PASSWORD`. Then open **Settings › Plugins › Catalog**
to install plugins.

The repository's file also has a commented-out `HC_GO2RTC_URL` for the app.
Set it to your go2rtc address to get live video from cameras
([Reolink](../plugins/reolink)). Without it, cameras show snapshots. The
app's other settings are listed in the
[Web UI overview](../web-ui/overview#ui-server-settings).

The network is declared on purpose. A stack manager such as Portainer or
Dockhand deploys the file as it is, and on Docker's default `bridge` network
service names don't resolve, so the app couldn't find `homecore`. Paste the
whole file, `networks:` block included.

:::note The old Flutter UI
Older versions of the docker repository ran the Flutter UI (`hc-web`) on
port 3000. That UI is retired and doesn't work with core v0.1.94 or later.
If your compose file still has an `hc-web` service, delete it; the app is
on port 3001.
:::

## Which compose file

The docker repository has three variants of the stack, plus a file for a
plugin runtime:

| File | Networking | Use it when |
|---|---|---|
| `compose.yml` | bridge | Start here. |
| `compose.host.yml` | host | You have Hue, Sonos, WLED, Roku or Ecowitt, or discovery found nothing. |
| `compose-dev.yml` | bridge | You want the `:dev` images. Its services, data directory (`homecore-data-dev`) and volume carry a `-dev` suffix. Change its ports to run it beside a stable stack. |
| `compose.runtime-python.yml` | bridge | You want Python plugins, such as the Assistant. It runs a [plugin runtime](../plugins/runtimes) with its own page on port 8790, beside the stack or on another machine. |

What decides it is discovery. Hue, Sonos, WLED and Roku find devices over
mDNS and SSDP, which are multicast, and a Docker bridge network does not
carry multicast. On a bridge network those plugins install and run without
errors and then find nothing. It looks like a broken plugin, but the cause
is the network. Sonos also serves UPnP event callbacks and must advertise
an address the speakers can reach, and a container's NATed address isn't
one.

Ecowitt has the same problem for two reasons. Gateway discovery is a UDP
broadcast to `255.255.255.255:45000`, and a bridge network doesn't forward
broadcast either. And to receive uploads, the gateway opens a connection to
homeCore on `[ecowitt].listen_port` (default `8888`), which the bridge
compose file does not publish. Setting `bind_addr = "0.0.0.0"` is enough on
bare metal, but not here. Ecowitt has a way around this: set
`[ecowitt].gateway_ip` and the plugin polls the gateway over ordinary
outbound HTTP, which works on the bridge network.

Plugins that only make outbound TCP or HTTP connections (YoLink, Lutron,
Caseta, ISY, Z-Wave) work fine on the bridge setup.

`compose.host.yml` works on Linux only. Docker Desktop on macOS and Windows
runs containers inside a VM, so host networking there doesn't reach the
LAN's multicast traffic.

With host networking there are no port mappings. The app listens on `PORT`
(default `3001`, from `HC_WEB_PORT`) and reaches core at
`http://127.0.0.1:8080` (the port from `HC_API_PORT`), because compose
service names don't resolve on the host network. Core and its broker bind
whatever `homecore.toml` says.

### Ports

`HC_WEB_PORT` (default 3001) and `HC_API_PORT` (default 8080) move the stack
off a busy host without editing a file:

```sh
HC_WEB_PORT=8800 HC_API_PORT=8801 docker compose up -d
```

On the bridge files they set the published side of each mapping. On
`compose.host.yml`, `HC_WEB_PORT` is the port the app itself binds, and
`HC_API_PORT` only tells the app where core is; core binds whatever
`[server] port` says, so set both to match.

## Why the app proxies the API

The web app calls `/api/v1` as a relative path, and core sends no CORS
headers, so the API has to share the app's origin. The app's own server
provides that, and the app can't work without it.

`HC_CORE_URL` tells the app's server where core is. In the compose file it
is `http://homecore:8080`, the compose service name. Outside compose, use
the host's address, for example `http://192.168.1.50:8080`.

The app's server never forwards a request that carries no credential,
except sign-in, token refresh, `/api/v1/health` and webhooks. That matters
if you use core's deprecated `[auth].whitelist`. Every request through the
app arrives from the app container's address, so forwarding anonymous
requests from a whitelisted container would make anyone who can reach the
app an admin.

## Persistence

Core keeps everything in one host directory, bind-mounted at `/homecore`:

```
homecore-data/
├── INITIAL_ADMIN_PASSWORD   # one-time, plain text. Delete after first login.
├── config/
│   ├── homecore.toml        # main config
│   ├── modes.toml           # modes
│   ├── plugins/             # per-plugin configs, seeded on install
│   └── profiles/            # ecosystem profiles
├── data/
│   ├── state.redb           # device registry
│   ├── history.db           # time-series
│   └── jwt_secret           # generated; do not commit
├── plugins/<id>/<version>/  # installed plugin binaries
├── rules/                   # automation RON files, reloaded on change
├── backups/                 # automatic backups (daily by default)
└── logs/
```

The app keeps its own data in the `app-data` named volume, mounted at
`/data`. homeCore's backup does not include it. Save it from the app:
**Settings › Data & backups**, then "save them too" under Back up.

There is no config bind-mount. On first boot the image copies its default
config to `config/homecore.toml` inside `homecore-data`. That default works
as shipped: core serves no UI, declares no plugins, and points at the signed
registry. To change settings, edit the file (or use Settings › Configuration
in the app) and run `docker compose restart homecore`. After first boot the
file is yours, and the image never overwrites it.

An earlier compose file mounted `homecore.toml` from the clone. Deployed
without the repository, Docker created a directory at that path, and the
first-boot copy failed
(`cp: can't create '/homecore/config/homecore.toml/config.toml'`). If your
compose file still has that mount, delete it.

### File ownership

Running `mkdir homecore-data` as yourself is the whole setup. The entrypoint
starts as root, reads the owner UID of the mount, and `su-exec`s to it
before writing anything. If the directory doesn't exist, Docker creates it
owned by root, and the entrypoint chowns it to `HOMECORE_UID:HOMECORE_GID`
(default `1000:1000`).

## The MQTT broker

Core has an MQTT broker built in, on port 1883. `compose.yml` publishes it
(`HC_BROKER_PORT`, default `1883`), but nothing answers there at first: the
first-boot config binds the broker to loopback inside the container. Plugins
that core runs are child processes in the same container and need nothing
more.

Two things need the broker on the network: [plugin runtimes](../plugins/runtimes)
and LAN devices such as Tasmota, Shelly or ESPHome that publish to it
directly. For a runtime, open **Plugin runtimes** (a button on
**Settings › Plugins**) and choose **Open the broker to the network**. That
sets `[broker] host = "0.0.0.0"`, adds the logins homeCore needs and
restarts core. For LAN devices, set `host = "0.0.0.0"` yourself and add
`[[broker.clients]]` logins for them.

Core refuses to start if the broker binds a non-loopback address with no
clients configured, so it never runs an open broker by accident. If you
really mean it, `HC_ALLOW_ANONYMOUS_REMOTE_BROKER=1` overrides that check.

On a fresh data directory you can also set `HC_BROKER_BIND` in the core
container's environment. The entrypoint writes it into `[broker] host` when
it creates the config, and ignores it once the config exists.

## A plugin runtime

To run Python plugins, add a runtime:

```sh
mkdir runtime-python-data
docker compose -f compose.runtime-python.yml up -d
```

1. In the app, open **Settings › Plugins › Plugin runtimes** and choose
   **Add runtime**. It shows a connection key once. If it says runtimes
   can't reach the broker, choose **Open the broker to the network** there.
2. Open `http://<runtime-host>:8790`, paste the key and choose **Connect**.
   Or set `HC_RUNTIME_KEY` in the compose file before starting it.

Then install Python plugins from the Catalog as usual, and homeCore places
them on the runtime. See [Plugin Runtimes](../plugins/runtimes) for its
settings.

## Image tags

| Tag | Meaning |
|---|---|
| `:latest` | Most recent tagged release. What `compose.yml` tracks. |
| `:0.1.114` | A specific release, which never changes. Image tags drop the `v`. |
| `:dev` | The latest build from a hand run of the release workflow on `develop`. Changes. |
| `:dev-<sha7>` | A specific develop build, which never changes. |

Pushes to `develop` don't build images. A `:dev` image exists only when
someone runs the release workflow by hand.

The compose files set `pull_policy: always`, so `docker compose up` fetches
the newest image for the tag. That matters on `:dev`. On a fixed release
tag the pull costs almost nothing.

To pin the stack, set both image versions. Don't expect the numbers to
match: core and the app are released on their own schedules, so `hc-core`
and `hc-web-svelte` versions are often far apart. The
[release notes](../release-notes) say which core version each app release
needs. The runtime image `hc-runtime-python` is tagged with core's version.

## External Mosquitto (optional, for per-topic access control)

The embedded `rumqttd` broker checks logins when a client connects, and
that's all. The `allow_pub` and `allow_sub` patterns are not enforced when a
client publishes or subscribes. `hc-cli` can turn your `[[broker.clients]]`
entries into a Mosquitto configuration with a matching ACL file:

```bash
hc-cli broker generate-mosquitto-config \
    --config homecore-data/config/homecore.toml \
    --out-dir mosquitto-config/
```

`hc-cli` is not in the core image or the release tarball. Build it from
the homeCore repository (`cargo build -p hc-cli`).

Then point core at that broker with `[broker] external_url` (for example
`"mqtt://mosquitto:1883"`). Core skips its embedded broker and logs in as
`internal.core` with the password from `[[broker.clients]]`. Each plugin's
own config must point at the same broker. See
[External Mosquitto deployment](../administration/broker.md#external-mosquitto-deployment)
for the full setup.

## Backup and restore

Core's data is the bind-mounted directory. Stop, copy, start:

```bash
docker compose stop
tar -czf homecore-backup-$(date +%Y%m%d).tar.gz homecore-data
docker compose start
```

For a backup that leaves out runtime state, use Settings › Data & backups,
or the API. The API works through the app's proxy or against core directly:

```bash
curl -s -X POST http://localhost:3001/api/v1/system/backup \
    -H "Authorization: Bearer $TOKEN" \
    -o homecore-backup.zip
```

Core also makes one by itself, daily by default, in `homecore-data/backups/`.
See [Administration › Backup & Restore](../administration/backup-restore)
for the full workflow. Remember the app's data is separate (see
[Persistence](#persistence)).

## Upgrading

```bash
docker compose pull          # newest image at the configured tag
docker compose up -d         # recreates containers; the bind-mount is kept
```

Installed plugins are updated separately, from Settings › Plugins (Update,
or **Update all** when several are waiting). They live in the data
directory, not the image, so pulling a new core doesn't change them.
Settings › System says when a newer core or app is out.

Before upgrading, read the [release notes](../release-notes) for any
upgrade steps.

## Health checks

The core image has a Docker health check, so `docker compose ps` shows it
as healthy once the API answers.

```bash
docker compose ps            # both services running, homecore healthy

curl http://localhost:3001/api/v1/health     # through the app's proxy
curl http://localhost:8080/api/v1/health     # core directly
# {"status":"ok","version":"0.1.114"}
```

Check both. If core answers and the proxied call doesn't, the problem is
the app's `HC_CORE_URL`, not homeCore. The app's own server answers
`GET /ui/health` with `{"ok":true}`.

## Retired images

An appliance image (`homecore-appliance`) once put core and every plugin in
one container, and there were per-plugin images
(`ghcr.io/homecore-io/hc-hue`, …) and compose fragments. The web UI used to
be the Flutter app `hc-web`, served by nginx. All of that is retired.
Plugins ship as signed registry artifacts installed at runtime, the
two-container stack replaces the appliance, and `hc-web-svelte` replaces the
Flutter app. Old appliance images stay in GHCR, but no new ones are
published.
