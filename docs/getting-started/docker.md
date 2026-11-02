---
id: docker
title: Docker Deployment
sidebar_label: Docker
sidebar_position: 5
---

# Docker Deployment

HomeCore runs as two containers.

```
browser ─▶ host:3001 ─▶ hc-web-svelte:3000 ─┬─ /            the web app
                                            └─ /api/v1/* ──▶ hc-core:8080 ──▶ plugins (child processes)
                                                                │
                                                                └─ embedded MQTT broker
```

| Image | What it is |
|---|---|
| `ghcr.io/homecore-io/hc-core` | The REST/WebSocket API and the embedded MQTT broker. |
| `ghcr.io/homecore-io/hc-web-svelte` | The web app. Its Node server serves the app, passes `/api/v1/*` and the event stream through to core on the same origin, keeps sign-ins in httpOnly cookies, and stores the app's own data (pages, layouts, displays) in `/data`. |

Plugins are not containers. Install them from the web app (Plugins →
Add): core downloads a signed artifact from the
[plugin registry](https://github.com/homeCore-io/registry), verifies its
signature, and runs it as a child process. Adding hardware support never
means editing a compose file.

The reference compose files live in
[`homeCore-io/docker`](https://github.com/homeCore-io/docker); the file
below is its `compose.yml` with the comments left out. You can clone the
repository instead of writing the file yourself.

:::note The old Flutter UI
Before the docker repository's November 2026 update, its stack ran the
Flutter UI (`hc-web`) on port 3000. That UI is retired and doesn't work
with core v0.1.94 or later. If your compose file still has an `hc-web`
service, delete it; the app is on port 3001.
:::

---

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
# drops privileges to match — no chown needed.
mkdir homecore-data

docker compose up -d

# First-boot admin password:
cat homecore-data/INITIAL_ADMIN_PASSWORD
```

Open `http://<host-ip>:3001`, sign in as `admin`, change the password,
and delete `INITIAL_ADMIN_PASSWORD`. Then go to Plugins → Add.

The network is declared explicitly so the stack behaves the same when a
manager such as Portainer or Dockhand deploys it. On Docker's default
`bridge` network, service names don't resolve, and the app can't find
`homecore`.

---

## Which compose file

The docker repository has three variants:

| File | Networking | Use it when |
|---|---|---|
| `compose.yml` | bridge | Start here. |
| `compose.host.yml` | host | You have Hue, Sonos, WLED, Roku or Ecowitt, or discovery found nothing. |
| `compose-dev.yml` | bridge | You want the `:dev` images. |

The deciding factor is **discovery**. Hue, Sonos, WLED and Roku find
devices over mDNS and SSDP, which are multicast, and a Docker bridge
network does not carry multicast. On a bridge network those plugins
install and run without errors and then find nothing, which looks like a
broken plugin when it is really a networking choice. Sonos also serves
UPnP event callbacks and must advertise an address the speakers can
reach, and a NATed container IP isn't one.

Ecowitt has the same problem for two reasons. Gateway discovery is a UDP
broadcast to `255.255.255.255:45000`, and a bridge network doesn't
forward broadcast either. And to *receive* uploads, the gateway opens a
connection **to** homeCore on `[ecowitt].listen_port` (default `8888`),
which the bridge compose file does not publish. Setting
`bind_addr = "0.0.0.0"` is enough on bare metal, but not here.

Ecowitt has a way around this that the others lack: set
`[ecowitt].gateway_ip` and the plugin polls the gateway over ordinary
outbound HTTP, which works on the bridge network.

Plugins that only make ordinary outbound TCP or HTTP connections (YoLink,
Lutron, Caseta, ISY, Z-Wave) work fine on the bridge setup, because
outbound connections NAT out of a container without help.

`compose.host.yml` works on Linux only. Docker Desktop on macOS and
Windows runs containers inside a VM, so host networking there doesn't
reach the LAN's multicast traffic.

With host networking there are no port mappings. The app listens on
`PORT` (default `3001`, from `HC_WEB_PORT`) and reaches core at
`http://127.0.0.1:8080`, because compose service names don't resolve on
the host network.

---

## Why the app proxies the API

The web app calls `/api/v1` as a relative path, and core sends no CORS
headers. The API therefore has to be on the same origin as the app, and
the app's own server is what makes that happen. It is required, not an
optional convenience layer.

`HC_CORE_URL` tells the app's server where core is. In the compose file
it is `http://homecore:8080`, the compose service name. Outside compose,
use the host's address, for example `http://192.168.1.50:8080`.

The app's server never forwards a request that carries no credential,
except sign-in, token refresh and `/api/v1/health`. That matters if you
use core's deprecated `[auth].whitelist`: every request through the app
arrives from the app container's address, so forwarding anonymous
requests from a whitelisted container would make anyone who can reach
the app an admin.

---

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
├── rules/                   # automation RON files, hot-reloaded
├── backups/                 # automatic backups (daily by default)
└── logs/
```

The app keeps its own data in the `app-data` named volume, mounted at
`/data`. HomeCore's backup does not include it; save it from the app (Settings → Data & backups).

There is no config bind-mount. On first boot the image copies its
default config to `config/homecore.toml` inside `homecore-data`, and that
default works as shipped: core serves no UI, declares no plugins, and
points at the signed registry. To change settings, edit that file and run
`docker compose restart homecore`. After first boot the file is yours and
the image never overwrites it.

An earlier compose file did mount `homecore.toml` from the clone. When
deployed without the repository, Docker created a *directory* at that
path, and the seed copy had nowhere to go
(`cp: can't create '/homecore/config/homecore.toml/config.toml'`). If you
still have an old compose file with that mount, delete the mount.

### File ownership

Running `mkdir homecore-data` as yourself is the whole setup. The
entrypoint starts as root, reads the owner UID of the mount, and
`su-exec`s to it before writing anything. If the directory doesn't exist,
Docker creates it owned by root, and the entrypoint chowns it to
`HOMECORE_UID:HOMECORE_GID` (default `1000:1000`).

---

## The MQTT broker

Core embeds an MQTT broker on port 1883. The default config binds it to
loopback, and the compose file does not publish it. Plugins are child
processes of core in the same network namespace, so nothing outside the
container needs to reach it.

Publish the port only if LAN devices such as Tasmota, Shelly or ESPHome
publish to the broker directly. In that case also set
`[broker] host = "0.0.0.0"` and add `[[broker.clients]]` credentials.
Core **refuses to start** if the broker binds a non-loopback address with
no clients configured, rather than run an open broker.
`HC_ALLOW_ANONYMOUS_REMOTE_BROKER=1` overrides that check if you really
mean it.

On a fresh data directory you can also set `HC_BROKER_BIND` in the core
container's environment. The entrypoint writes it into `[broker] host`
when it seeds the config, and ignores it once the config exists.

---

## Image tags

| Tag | Meaning |
|---|---|
| `:latest` | Most recent tagged release. What `compose.yml` tracks. |
| `:0.1.96` | A specific release, immutable. Image tags drop the `v`. |
| `:dev` | The latest build from a manual run of the release workflow on `develop`. Mutable. |
| `:dev-<sha7>` | A specific develop build, immutable. |

Pushes to `develop` no longer build images on their own. A `:dev` image
exists only when someone runs the release workflow by hand.

The compose files set `pull_policy: always`, so `docker compose up`
fetches the newest image for the configured tag. That matters on `:dev`.
On an immutable release tag the pull costs almost nothing.

To pin the stack, set both image versions explicitly. Don't expect the
numbers to match: core and the app are released on their own schedules,
so `hc-core` and `hc-web-svelte` versions are routinely far apart.
[Release notes](../release-notes) list which app version shipped
alongside each core release.

---

## External Mosquitto (optional, for stronger MQTT authz)

The embedded `rumqttd` broker enforces authentication on `CONNECT` only.
The `allow_pub` / `allow_sub` patterns are metadata and aren't enforced
at publish or subscribe time. `hc-cli` can turn your `[[broker.clients]]`
entries into a Mosquitto configuration with a matching ACL file:

```bash
hc-cli broker generate-mosquitto-config \
    --config homecore-data/config/homecore.toml \
    --out-dir mosquitto-config/
```

`hc-cli` is not in the core image or the release tarball. Build it from
the homeCore repository (`cargo build -p hc-cli`).

Then point core at the broker with `[broker] external_url` (for example
`"mqtt://mosquitto:1883"`). Core skips its embedded broker and logs in as
`internal.core` with the password from `[[broker.clients]]`. Each
plugin's own config must point at the same broker. Before v0.1.97 core
ignored `external_url` and always started its embedded broker. See
[External Mosquitto deployment](../administration/broker.md#external-mosquitto-deployment)
for the full setup.

---

## Backup and restore

Core's persistent data is the bind-mounted directory. Stop, snapshot,
restart:

```bash
docker compose stop
tar -czf homecore-backup-$(date +%Y%m%d).tar.gz homecore-data
docker compose start
```

For a structured backup that leaves out runtime state, use the API. It
works through the app's proxy or against core directly:

```bash
curl -s -X POST http://localhost:3001/api/v1/system/backup \
    -H "Authorization: Bearer $TOKEN" \
    -o homecore-backup.zip
```

Core also makes one on its own, daily by default, in
`homecore-data/backups/`. See
[Administration → Backup & Restore](../administration/backup-restore) for
the full workflow.

---

## Upgrading

```bash
docker compose pull          # newest image at the configured tag
docker compose up -d         # recreates containers; the bind-mount is preserved
```

Installed plugins are upgraded separately, from the web app. They live in
the data directory, not the image, so pulling a new core doesn't change
them.

Before upgrading, read the [release notes](../release-notes) for any
upgrade steps.

---

## Health checks

```bash
docker compose ps            # both services "running"

curl http://localhost:3001/api/v1/health     # through the app's proxy
curl http://localhost:8080/api/v1/health     # core directly
# {"status":"ok","version":"0.1.96"}
```

Check both. If core answers and the proxied call doesn't, the problem is
the app's `HC_CORE_URL`, not homeCore. The app's own server answers
`GET /ui/health` with `{"ok":true}`.

---

## What used to be here

An **appliance image** (`homecore-appliance`) once baked core and every
plugin into one container. Earlier versions of this page also described
per-plugin compose fragments (`compose.hue.yaml` and similar) and
per-plugin images (`ghcr.io/homecore-io/hc-hue`, …). After that, the web
UI was the Flutter app `hc-web`, served by nginx.

All of that is retired. Plugins ship as signed registry artifacts
installed at runtime, the two-container stack above replaces the
appliance, and `hc-web-svelte` replaces the Flutter app. Existing
appliance images remain in GHCR, so anything still running one keeps
working, but no new ones are published.
