---
id: metrics
title: Metrics
sidebar_label: Metrics
sidebar_position: 5
---

# Metrics

homeCore exposes a Prometheus-compatible metrics endpoint at
`GET /api/v1/metrics`. It takes no token. Access is controlled by source
IP instead, through `[metrics].whitelist`, and the whitelist is empty by
default, so the endpoint returns 403 to everyone until you open it.

## Allowing a scraper

List the address of each Prometheus server (or other scraper) in
`homecore.toml` and restart homeCore:

```toml
[metrics]
whitelist = ["10.0.0.5/32"]
```

Entries can be single addresses or CIDR ranges, IPv4 or IPv6. Unlike
`[auth].whitelist`, ranges are accepted here, because this endpoint is
read-only and grants nothing else. homeCore never opens the endpoint on
its own based on the networks the host is on.

A denied request gets a 403 whose body names the caller's IP and the
exact line to add. homeCore also logs at startup whether the endpoint is
closed or which addresses may scrape it.

## Quick check

From a whitelisted host:

```bash
curl http://localhost:8080/api/v1/metrics
```

## Exposed metrics

| Metric | Type | Description |
|---|---|---|
| `homecore_uptime_seconds` | Gauge | Seconds since homeCore started |
| `homecore_devices_total` | Gauge | Registered devices, including timers, switches and modes |
| `homecore_rules_total` | Gauge | Automation rules (enabled and disabled) |
| `homecore_rules_enabled_total` | Gauge | Enabled rules only |
| `homecore_plugins_total` | Gauge | Registered plugins |
| `homecore_rule_fires_total` | Counter | Rule fires since startup |
| `homecore_device_state_changes_total` | Counter | `DeviceStateChanged` events since startup |
| `homecore_scene_activations_total` | Counter | Scene activations since startup |
| `homecore_events_total` | Counter | Internal bus events, labelled by `type` |
| `homecore_ws_connects_total` | Counter | WebSocket connections accepted, labelled by `endpoint` (`events_stream` or `logs_stream`) |
| `homecore_ws_disconnects_total` | Counter | WebSocket disconnects, labelled by `endpoint` and `reason` |

Gauges are refreshed on every scrape. The disconnect `reason` label is one
of `client_close`, `socket_closed`, `recv_error`, `pong_timeout`,
`ping_send_failed`, `event_send_failed` or `bus_closed`. A rising
`pong_timeout` rate usually points at a network or proxy problem, while
`client_close` is just people closing tabs.

## Prometheus scrape config

```yaml
# prometheus.yml
scrape_configs:
  - job_name: homecore
    static_configs:
      - targets: ['homecore.local:8080']
    metrics_path: /api/v1/metrics
    scrape_interval: 30s
```

## Grafana dashboard suggestions

| Panel | Query |
|---|---|
| Uptime | `homecore_uptime_seconds / 3600` (hours) |
| Devices | `homecore_devices_total` |
| Rule fires / 5 min | `rate(homecore_rule_fires_total[5m]) * 300` |
| State changes / 5 min | `rate(homecore_device_state_changes_total[5m]) * 300` |
| Events / 5 min | `sum(rate(homecore_events_total[5m])) * 300` |
| WebSocket drops by reason | `sum by (reason) (rate(homecore_ws_disconnects_total[5m]))` |

## Running Prometheus and Grafana locally (Docker)

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
`[metrics].whitelist`. If you're unsure what that is, scrape once and read
the 403 body, which names it.

Then:
1. Open Grafana at `http://localhost:3000` (admin/admin)
2. Add a Prometheus data source: `http://prometheus:9090`
3. Build dashboards with the queries above

## Security note

The metrics expose device counts, rule counts and plugin numbers. Keep the
whitelist to the hosts that actually scrape. If homeCore sits behind a
reverse proxy, homeCore sees the proxy's address, so whitelisting the
proxy opens the endpoint to everyone who can reach the proxy. In that
case restrict `/api/v1/metrics` at the proxy too.
