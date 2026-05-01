---
id: docker
title: Docker Deployment
sidebar_label: Docker
sidebar_position: 5
---

# Docker Deployment

HomeCore ships two Docker distributions:

- **Compose bundle** — `hc-core` plus per-plugin containers, each
  opt-in via Compose `include:`. The recommended shape for production
  with many devices.
- **Appliance image** — single container with `hc-core` + every active
  plugin baked in. Convenient for try-it-out and small homes; flip
  plugins on by editing the seeded config.

Both publish to GitHub Container Registry under `ghcr.io/homecore-io/`.
Both bind-mount a single host directory and seed the rest themselves —
no env-var ritual, no pre-chown.

The compose files live at
[`docker/`](https://github.com/homeCore-io/homeCore/tree/develop/docker)
in the homeCore repo: `compose.yaml`, `compose.appliance.yaml`, and
per-plugin `compose.<name>.yaml` fragments.

---

## Quick start — compose bundle

```bash
# Grab the compose files
curl -fsSLO https://raw.githubusercontent.com/homeCore-io/homeCore/main/docker/compose.yaml
# Plus any plugin fragments you want
curl -fsSLO https://raw.githubusercontent.com/homeCore-io/homeCore/main/docker/compose.hue.yaml
curl -fsSLO https://raw.githubusercontent.com/homeCore-io/homeCore/main/docker/compose.sonos.yaml

# Edit compose.yaml, uncomment the plugins under `include:`
$EDITOR compose.yaml

# Create the data dir as your user. The entrypoint detects the owner
# and drops privileges to match — no chown needed.
mkdir homecore-data

docker compose up -d

# First-boot admin password is in the volume:
cat homecore-data/INITIAL_ADMIN_PASSWORD

# Web UI:
xdg-open http://localhost:8080
```

The `compose.yaml` base file looks like this:

```yaml
include:
  # - compose.hue.yaml
  # - compose.sonos.yaml
  # - compose.yolink.yaml
  # - compose.lutron.yaml
  # - compose.wled.yaml
  # - compose.isy.yaml
  # - compose.zwave.yaml
  # - compose.caseta.yaml
  # - compose.thermostat.yaml
  # - compose.ecowitt.yaml

services:
  homecore:
    image: ghcr.io/homecore-io/hc-core:0.1.0
    container_name: homecore
    restart: unless-stopped
    pull_policy: always
    network_mode: host
    environment:
      RUST_LOG: info
    volumes:
      - ./homecore-data:/homecore
```

Each plugin fragment follows the same shape — its own image, its own
single bind-mount data directory, host networking. Plugins talk to the
core's embedded MQTT broker on `127.0.0.1:1883`.

---

## Quick start — appliance image

A single container with core + all 10 active plugins baked in. Every
plugin starts **disabled**; flip the ones you want on after first boot
by editing `homecore-data/config/homecore.toml`.

```bash
curl -fsSLO https://raw.githubusercontent.com/homeCore-io/homeCore/main/docker/compose.appliance.yaml

mkdir homecore-data
docker compose -f compose.appliance.yaml up -d

cat homecore-data/INITIAL_ADMIN_PASSWORD

# Edit the plugins block — set `enabled = true` on whichever you want
$EDITOR homecore-data/config/homecore.toml

docker compose -f compose.appliance.yaml restart
```

Image: `ghcr.io/homecore-io/homecore-appliance:0.1.0`.

The appliance is the easiest way to evaluate against real hardware —
one container, one config, every plugin available. Production
deployments with many devices typically migrate to the compose bundle
where each plugin is its own container.

---

## Network mode

Both shapes default to `network_mode: host`. This is required for:

- **mDNS discovery** (Hue, WLED, Caseta).
- **SSDP discovery** (Sonos).
- LAN devices reaching the embedded MQTT broker on port 1883.

On Docker Desktop (macOS / Windows) host networking is limited. If you
don't run discovery-based plugins you can switch to bridge with
explicit port mappings — both compose files include commented hints:

```yaml
# network_mode: bridge
# ports:
#   - "8080:8080"   # web UI / API
#   - "1883:1883"   # MQTT (only if external devices publish to it)
```

---

## Persistence

Each service bind-mounts **one host directory** to `/homecore` inside
the container. The entrypoint:

1. Detects the owner of the bind-mount (or your `user:` override).
2. Drops privileges to that user before writing anything.
3. Seeds `config/`, `data/`, `rules/`, `logs/` on first boot.
4. Drops `INITIAL_ADMIN_PASSWORD` at the root.

```
homecore-data/
├── INITIAL_ADMIN_PASSWORD     # one-time, plain-text. Change after first login.
├── config/
│   ├── homecore.toml          # main config — edit + `docker compose restart`
│   └── profiles/              # ecosystem profiles
├── data/
│   ├── state.redb             # device registry
│   └── history.db             # time-series
├── rules/                     # automation RON files (hot-reloaded)
├── logs/
├── jwt_secret                 # generated; do not commit
└── ui                         # symlink to the bundled UI inside the image
```

Plugin services bind-mount their own data dirs (e.g. `hc-hue-data/`)
that hold each plugin's `config.toml` plus its
`.published-device-ids.json` sidecar. Per-plugin subdirs prevent the
SDK's sidecar files from colliding.

---

## Image registry

| Image | Repo |
|---|---|
| `ghcr.io/homecore-io/hc-core` | core only |
| `ghcr.io/homecore-io/homecore-appliance` | appliance (core + plugins baked in) |
| `ghcr.io/homecore-io/hc-<plugin>` | per-plugin (hue, yolink, sonos, …) |

Tags:

- `:vX.Y.Z` — immutable release.
- `:dev` — rolling latest develop build.
- `:dev-<7sha>` — immutable per-commit.

`pull_policy: always` is set in the compose files so `docker compose
up` always picks up the newest image at the configured tag — important
during pre-release iteration on `:dev`. On a tagged release the tag is
immutable so the pull is a cheap no-op.

---

## External Mosquitto (optional, for stronger MQTT authz)

The embedded `rumqttd` broker enforces authentication on `CONNECT` only
— `allow_pub` / `allow_sub` patterns are metadata, not enforced at
publish/subscribe time. For deployments where plugins are on different
hosts or run third-party code, route MQTT through Mosquitto instead:

```bash
hc-cli broker generate-mosquitto-config \
    --config homecore-data/config/homecore.toml \
    --out mosquitto/
```

That writes a Mosquitto config + ACL file derived from your
`[[broker.clients]]` entries. Then run Mosquitto in a sidecar container
and point `[broker]` at it via `external_url = "mqtt://mosquitto:1883"`.
Full plan at
[`mqttAuthzPlan.md`](https://github.com/homeCore-io/homeCore/blob/develop/mqttAuthzPlan.md).

---

## Backup and restore

Persistent data is the bind-mount directory. Stop, snapshot the
directory, restart:

```bash
docker compose stop
tar -czf homecore-backup-$(date +%Y%m%d).tar.gz homecore-data
docker compose start
```

For a structured backup that excludes runtime state, use the API:

```bash
curl -s http://localhost:8080/api/v1/system/backup \
    -H "Authorization: Bearer $TOKEN" \
    -o homecore-backup.zip
```

See [Administration → Backup & Restore](../administration/backup-restore)
for the full backup/restore workflow.

---

## Upgrading

```bash
docker compose pull          # picks up the newest matching tag
docker compose up -d         # recreates containers (data volume preserved)
```

Across a major version (e.g. 0.1 → 0.2), check
[Migration](./migration) for any one-time data-format steps.

---

## Health checks

```bash
docker compose ps
# Should show all services as "running"

curl http://localhost:8080/api/v1/health
# {"status":"ok","version":"0.1.0"}
```

For deeper troubleshooting, hc-mcp's `system_health` and
`broker_diagnose` tools work equally well against a Docker install —
see [hc-mcp](../tools/hc-mcp).
