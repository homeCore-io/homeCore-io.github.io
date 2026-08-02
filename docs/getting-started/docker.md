---
id: docker
title: Docker Deployment
sidebar_label: Docker
sidebar_position: 5
---

# Docker Deployment

HomeCore runs as two containers.

```
browser ─▶ hc-web ─┬─ /            the web UI
                   └─ /api/v1/* ──▶ hc-core ──▶ plugins (child processes)
                                       │
                                       └─ embedded MQTT broker
```

| Image | What it is |
|---|---|
| `ghcr.io/homecore-io/hc-core` | The REST/WebSocket API and the embedded MQTT broker. |
| `ghcr.io/homecore-io/hc-web` | The web UI. nginx serves the app and reverse-proxies `/api/v1/*` to core. |

**Plugins are not containers.** Install them from the UI — Plugins → Add — and
core downloads a signed artifact from the [plugin
registry](https://github.com/homeCore-io/registry), verifies its signature, and
runs it as a child process. Adding hardware support never means editing a
compose file.

The compose files live in
[`homeCore-io/docker`](https://github.com/homeCore-io/docker).

---

## Quick start

```bash
git clone https://github.com/homeCore-io/docker.git homecore-docker
cd homecore-docker

# Create the data dir as your user. The entrypoint detects the owner and
# drops privileges to match — no chown needed.
mkdir homecore-data

docker compose up -d

# First-boot admin password:
cat homecore-data/INITIAL_ADMIN_PASSWORD
```

Open `http://<host-ip>:3000`, log in as `admin`, then Plugins → Add.

---

## Which compose file

| File | Networking | Use it when |
|---|---|---|
| `compose.yml` | bridge | **Start here.** |
| `compose.host.yml` | host | You have Hue, Sonos, WLED or Roku — or discovery found nothing. |
| `compose-dev.yml` | bridge | You want the `:dev` tag, rebuilt on every push to develop. |

The distinction that matters is **discovery**. Hue, Sonos, WLED and Roku find
devices over mDNS and SSDP, which is multicast — and a Docker bridge network
does not carry it. On `compose.yml` those plugins install and run perfectly
happily and then find nothing at all, which looks like a broken plugin rather
than a networking choice. Sonos additionally serves UPnP event callbacks and
must advertise an address the speakers can reach back on, which a NATed
container IP is not.

Plugins that reach out over ordinary TCP or HTTP — YoLink, Lutron, Caseta, ISY,
Z-Wave, Ecowitt — work fine on the bridge setup.

`compose.host.yml` is Linux only. Docker Desktop on macOS and Windows runs
containers inside a VM, so host networking there does not reach the LAN's
multicast traffic.

Under host networking there are no port mappings, so hc-web takes
`WEB_PORT=3000` directly and reaches core at `127.0.0.1:8080` — compose service
names do not resolve on the host network.

---

## Why hc-web proxies the API

The web app calls `/api/v1` as a **relative** path, and core sends no CORS
headers at all. The API therefore has to be same-origin with the app, and the
nginx inside the hc-web image is what makes it so. This is not an optional
convenience layer: point a browser at a bare static build and every API call
returns the SPA's `index.html` instead of JSON.

`HOMECORE_URL` tells that nginx where core is. It defaults to
`http://homecore:8080` — the compose service name.

---

## Persistence

One host directory per container, bind-mounted at `/homecore`:

```
homecore-data/
├── INITIAL_ADMIN_PASSWORD   # one-time, plain text. Delete after first login.
├── config/
│   ├── homecore.toml        # main config
│   ├── plugins/             # per-plugin configs, seeded on install
│   └── profiles/            # ecosystem profiles
├── data/
│   ├── state.redb           # device registry
│   ├── history.db           # time-series
│   └── jwt_secret           # generated; do not commit
├── plugins/<id>/<version>/  # installed plugin binaries; old versions kept
├── rules/                   # automation RON files, hot-reloaded
└── logs/
```

`homecore.toml` is bind-mounted read-only from the repo so it is version
controlled alongside the compose file. Edit it and
`docker compose restart homecore`. Drop the bind-mount to let the image seed its
built-in default instead.

### File ownership

`mkdir homecore-data` as yourself is the whole setup. The entrypoint starts as
root, reads the mount's owner UID, and `su-exec`s to it before writing anything.
If the directory does not exist, Docker creates it root-owned and the entrypoint
chowns it to `HOMECORE_UID:HOMECORE_GID` (default `1000:1000`).

---

## The MQTT broker

Core embeds an MQTT broker on 1883. It is **not published** by default: it binds
loopback, and plugins are children of core in the same network namespace, so
nothing outside the container needs to reach it.

Publish it only if LAN devices — Tasmota, Shelly, ESPHome — publish to it
directly. That also means setting `[broker] host = "0.0.0.0"` and adding
`[[broker.clients]]` credentials. Core **refuses to start** if the broker binds
a non-loopback address with no clients configured, rather than quietly running
an open broker. `HC_ALLOW_ANONYMOUS_REMOTE_BROKER=1` overrides that if you mean
it.

---

## Image tags

| Tag | Meaning |
|---|---|
| `:latest` | Most recent tagged release. What `compose.yml` tracks. |
| `:0.1.6` | A specific release, immutable. |
| `:dev` | Rebuilt on every push to develop. Mutable. |
| `:dev-<sha7>` | A specific develop build, immutable. |

`pull_policy: always` is set in the compose files so `docker compose up` picks
up the newest image at the configured tag — which matters on `:dev`. On an
immutable release tag the pull is a cheap no-op.

To pin the whole stack, `git checkout v0.1.6` in the docker repo and use the
compose file at that tag.

---

## External Mosquitto (optional, for stronger MQTT authz)

The embedded `rumqttd` broker enforces authentication on `CONNECT` only —
`allow_pub` / `allow_sub` patterns are metadata, not enforced at
publish/subscribe time. For deployments where plugins run third-party code or
sit on other hosts, route MQTT through Mosquitto instead:

```bash
hc-cli broker generate-mosquitto-config \
    --config homecore-data/config/homecore.toml \
    --out mosquitto/
```

That writes a Mosquitto config plus an ACL file derived from your
`[[broker.clients]]` entries. Run Mosquitto in a sidecar container and point
`[broker]` at it with `external_url = "mqtt://mosquitto:1883"`. Full plan at
the [MQTT broker guide](../administration/broker.md).

---

## Backup and restore

Persistent data is the bind-mount directory. Stop, snapshot, restart:

```bash
docker compose stop
tar -czf homecore-backup-$(date +%Y%m%d).tar.gz homecore-data
docker compose start
```

For a structured backup that excludes runtime state, use the API:

```bash
curl -s http://localhost:3000/api/v1/system/backup \
    -H "Authorization: Bearer $TOKEN" \
    -o homecore-backup.zip
```

See [Administration → Backup & Restore](../administration/backup-restore) for
the full workflow.

---

## Upgrading

```bash
docker compose pull          # newest image at the configured tag
docker compose up -d         # recreates containers; the bind-mount is preserved
```

Installed plugins are upgraded separately from the UI — they live in the data
directory, not the image, so pulling a new core does not change them.

Across a major version (0.1 → 0.2), check [Migration](./migration) for one-time
data-format steps.

---

## Health checks

```bash
docker compose ps            # both services "running"

curl http://localhost:3000/api/v1/health     # through hc-web's proxy
curl http://localhost:8080/api/v1/health     # core directly
# {"status":"ok","version":"0.1.5"}
```

Checking both is worth the extra second: if core answers and the proxied call
does not, the problem is hc-web's `HOMECORE_URL`, not homeCore.

---

## What used to be here

An **appliance image** (`homecore-appliance`) baked core and every plugin into
one container, and earlier versions of this page described per-plugin compose
fragments (`compose.hue.yaml` and friends) plus per-plugin images
(`ghcr.io/homecore-io/hc-hue`, …).

All of that is retired. Plugins ship as signed registry artifacts installed at
runtime, and the two-container stack above replaces the appliance. Existing
appliance images remain in GHCR so anything still running one keeps working, but
none are published any more.
