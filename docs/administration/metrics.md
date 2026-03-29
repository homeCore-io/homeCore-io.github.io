---
id: metrics
title: Metrics
sidebar_label: Metrics
sidebar_position: 5
---

# Metrics

HomeCore exposes a Prometheus-compatible metrics endpoint at `GET /metrics`. No authentication required.

## Quick check

```bash
curl http://localhost:8080/metrics
```

## Exposed metrics

| Metric | Type | Description |
|---|---|---|
| `homecore_uptime_seconds` | Gauge | Seconds since HomeCore started |
| `homecore_devices_total` | Gauge | Total registered devices |
| `homecore_rules_total` | Gauge | Total loaded rules (enabled + disabled) |
| `homecore_rules_enabled` | Gauge | Enabled rules only |
| `homecore_plugins_active` | Gauge | Plugins registered and online |
| `homecore_rule_fires_total` | Counter | Cumulative rule fires since startup |
| `homecore_state_changes_total` | Counter | Cumulative `DeviceStateChanged` events |
| `homecore_scene_activations_total` | Counter | Cumulative scene activations |
| `homecore_events_total` | Counter | Cumulative events on the public bus |

## Prometheus scrape config

```yaml
# prometheus.yml
scrape_configs:
  - job_name: homecore
    static_configs:
      - targets: ['homecore.local:8080']
    metrics_path: /metrics
    scrape_interval: 30s
```

## Grafana dashboard suggestions

| Panel | Query |
|---|---|
| Uptime | `homecore_uptime_seconds / 3600` (hours) |
| Active devices | `homecore_devices_total` |
| Rule fires / 5 min | `rate(homecore_rule_fires_total[5m]) * 300` |
| State changes / 5 min | `rate(homecore_state_changes_total[5m]) * 300` |
| Events / 5 min | `rate(homecore_events_total[5m]) * 300` |

## Running Prometheus + Grafana locally (Docker)

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

Then:
1. Open Grafana at `http://localhost:3000` (admin/admin)
2. Add Prometheus data source: `http://prometheus:9090`
3. Create dashboards using the queries above

## Security note

`GET /metrics` is intentionally unauthenticated so Prometheus can scrape it without managing credentials. If HomeCore is exposed to an untrusted network, either:
- Add a firewall rule to restrict `/metrics` access to your monitoring host
- Put Caddy or nginx in front and add authentication at the proxy layer
