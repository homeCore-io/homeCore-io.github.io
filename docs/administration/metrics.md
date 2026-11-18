---
id: metrics
title: Metrics
sidebar_label: Metrics
sidebar_position: 5
---

# Metrics

homeCore serves Prometheus metrics at `GET /api/v1/metrics`. The endpoint
takes no token. Access goes by source IP, through `[metrics].whitelist`,
and the whitelist is empty by default, so every caller gets 403 until you
add one.

## Allowing a scraper

List each Prometheus server (or other scraper) in `homecore.toml` and
restart homeCore:

```toml
[metrics]
whitelist = ["192.168.1.5/32"]
```

Entries can be single addresses or CIDR ranges, IPv4 or IPv6. Ranges are
fine here, unlike in `[auth].whitelist`, because this endpoint is read
only and grants nothing else. homeCore never opens it by itself based on
the networks the machine is on.

A refused request gets a 403 whose body names the caller's IP and the
exact line to add. At startup homeCore logs whether the endpoint is
closed or which addresses may scrape it.

## Quick check

From a whitelisted machine:

```bash
curl http://<homecore-host>:8080/api/v1/metrics
```

## Metrics

| Metric | Type | Description |
|---|---|---|
| `homecore_uptime_seconds` | Gauge | Seconds since homeCore started |
| `homecore_devices_total` | Gauge | Devices in the registry, including helpers and modes |
| `homecore_rules_total` | Gauge | Automation rules, on and off |
| `homecore_rules_enabled_total` | Gauge | Rules that are on |
| `homecore_plugins_total` | Gauge | Registered plugins |
| `homecore_rule_fires_total` | Counter | Rule fires since startup |
| `homecore_device_state_changes_total` | Counter | Device state changes since startup |
| `homecore_scene_activations_total` | Counter | Scene activations since startup |
| `homecore_events_total` | Counter | Internal events, labeled by `type` |
| `homecore_ws_connects_total` | Counter | WebSocket connections accepted, labeled by `endpoint` (`events_stream` or `logs_stream`) |
| `homecore_ws_disconnects_total` | Counter | WebSocket disconnects, labeled by `endpoint` and `reason` |

Gauges are read fresh on every scrape. The disconnect `reason` is one of
`client_close`, `socket_closed`, `recv_error`, `pong_timeout`,
`ping_send_failed`, `event_send_failed` or `bus_closed`. A rising
`pong_timeout` rate usually means a network or proxy problem, while
`client_close` is people closing tabs.

## Prometheus scrape config

```yaml
# prometheus.yml
scrape_configs:
  - job_name: homecore
    static_configs:
      - targets: ['<homecore-host>:8080']
    metrics_path: /api/v1/metrics
    scrape_interval: 30s
```

## Grafana panels

| Panel | Query |
|---|---|
| Uptime | `homecore_uptime_seconds / 3600` (hours) |
| Devices | `homecore_devices_total` |
| Rule fires / 5 min | `rate(homecore_rule_fires_total[5m]) * 300` |
| State changes / 5 min | `rate(homecore_device_state_changes_total[5m]) * 300` |
| Events / 5 min | `sum(rate(homecore_events_total[5m])) * 300` |
| WebSocket drops by reason | `sum by (reason) (rate(homecore_ws_disconnects_total[5m]))` |

## Prometheus and Grafana in Docker

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

Add the address homeCore sees for the Prometheus container to
`[metrics].whitelist`. If you aren't sure what it is, scrape once and read
the 403 body, which names it.

Then:

1. Open Grafana at `http://localhost:3000` (admin/admin).
2. Add a Prometheus data source: `http://prometheus:9090`.
3. Build panels with the queries above.

## Security

The metrics show device, rule and plugin counts. Keep the whitelist to the
machines that scrape. Behind a reverse proxy, homeCore sees the proxy's
address, so whitelisting the proxy opens the endpoint to everyone who can
reach the proxy. In that case also restrict `/api/v1/metrics` at the
proxy.
