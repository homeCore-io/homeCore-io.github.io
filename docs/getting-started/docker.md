---
id: docker
title: Docker Deployment
sidebar_label: Docker
sidebar_position: 4
---

# Docker Deployment

HomeCore ships with a multi-stage Dockerfile that builds a minimal production image (~100 MB) and a Docker Compose setup for running the full stack with optional plugin containers.

## Quick start

```bash
# From the homeCore root
docker compose up -d

# Watch logs
docker compose logs -f homecore
```

On first start, check logs for the generated admin password:

```bash
docker compose logs homecore | grep "temporary password"
```

## Environment variables

All sensitive config can be passed via environment variables instead of baking them into the image:

| Variable | Description | Example |
|---|---|---|
| `HOMECORE_JWT_SECRET` | JWT signing secret (required in production) | `"a-long-random-string"` |
| `HOMECORE_LAT` | Latitude for solar calculations | `38.9072` |
| `HOMECORE_LON` | Longitude for solar calculations | `-77.0369` |
| `HOMECORE_TZ` | IANA timezone name | `America/New_York` |
| `HOMECORE_DOMAIN` | Domain for Caddy TLS (optional) | `homecore.yourdomain.com` |
| `TZ` | Container timezone | `America/New_York` |
| `RUST_LOG` | Log level override | `info` |

Create a `.env` file in the same directory as `docker-compose.yml`:

```bash
HOMECORE_JWT_SECRET=your-very-long-random-secret-here
HOMECORE_LAT=38.9072
HOMECORE_LON=-77.0369
HOMECORE_TZ=America/New_York
TZ=America/New_York
RUST_LOG=info
```

## Named volumes

| Volume | Contents |
|---|---|
| `homecore-config` | `config/homecore.toml`, `config/modes.toml`, profiles |
| `homecore-data` | `data/state.redb`, `data/history.db` |
| `homecore-rules` | Rule RON files (hot-reloaded) |
| `homecore-logs` | Log files |

To edit config or rules while running:

```bash
# Edit config
docker run --rm -v homecore-config:/config alpine vi /config/homecore.toml

# Or use docker cp
docker cp config/homecore.toml homecore:/opt/homecore/config/
```

## Building the image

```bash
# From the homeCore root
docker build -t homecore:latest -f Dockerfile .

# Or specify the core subdirectory
docker build -t homecore:latest -f core/Dockerfile core/
```

The Dockerfile is multi-stage:
1. **rust-builder** — compiles the Rust binary
2. **flutter-builder** — builds the web UI (if present)
3. **runtime** — minimal Debian image with just the binary, Caddy, and supervisord

## Caddy reverse proxy

The container runs Caddy in front of HomeCore on ports 80/443. Caddy handles:
- HTTP → HTTPS redirect
- WebSocket upgrade pass-through
- TLS via Let's Encrypt (set `HOMECORE_DOMAIN` for automatic certificate provisioning)
- Graceful WebSocket reconnection

For LAN-only use without a domain, Caddy serves HTTP on port 80 and proxies to HomeCore's internal port 8080.

## Plugin containers

Plugins run as separate containers and connect to HomeCore's embedded MQTT broker via `network_mode: host`.

### Start specific plugins

```bash
# All plugins alongside the main stack
docker compose -f docker-compose.yml -f plugins/docker-compose.plugins.yml up -d

# Just HomeCore + Hue plugin
docker compose -f docker-compose.yml up -d homecore
docker compose -f plugins/docker-compose.plugins.yml up -d hc-hue
```

### Plugin config

Each plugin reads its config from `docker/plugin-configs/{plugin}.toml`. Edit these files to set credentials and device addresses before starting.

Example `docker/plugin-configs/hc-hue.toml`:

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.hue"
password    = ""             # set if broker auth is enabled

[hue]
bridge_ip = "192.168.1.100"  # your Hue bridge IP
app_key   = ""               # filled in after first pairing
```

### Building a plugin image

Use the generic plugin Dockerfile template:

```bash
cd plugins/hc-hue
docker build \
  -f ../Dockerfile.plugin \
  --build-arg PLUGIN_NAME=hc-hue \
  -t hc-hue:latest \
  .
```

## Data persistence and backup

Volumes survive container restarts and upgrades. To back up:

```bash
# Stop HomeCore, copy volumes
docker compose stop homecore
docker run --rm \
  -v homecore-data:/data \
  -v homecore-config:/config \
  -v homecore-rules:/rules \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/homecore-backup-$(date +%Y%m%d).tar.gz /data /config /rules
docker compose start homecore
```

Or use the built-in backup API:

```bash
curl -s http://localhost:8080/api/v1/system/backup \
  -H "Authorization: Bearer $TOKEN" \
  -o homecore-backup.zip
```

## Upgrading

```bash
# Pull new image
docker compose pull homecore

# Recreate container (volumes are preserved)
docker compose up -d homecore
```

## Health check

The Compose file includes a health check:

```bash
docker compose ps
# Should show homecore as "healthy" after ~30 seconds
```

The health endpoint:

```bash
curl http://localhost:8080/health
# {"status":"ok","version":"0.1.0"}
```
