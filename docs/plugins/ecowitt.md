---
id: ecowitt
title: Ecowitt weather stations
sidebar_label: Ecowitt
sidebar_position: 11
---

# Ecowitt weather stations (`hc-ecowitt`)

Bridges Ecowitt weather station gateways and consoles into HomeCore.
Sensors are **dynamically discovered** from the data stream — no
manual sensor listing required.

## Data ingestion

Two ingestion modes; you can run either or both:

| Mode | When to use |
|---|---|
| **HTTP POST receiver** (primary) | The Ecowitt gateway pushes data to the plugin on its configured upload interval. Reliable, low-latency, no polling load. |
| **HTTP GET polling** (optional) | The plugin polls the gateway's `/get_livedata_info` endpoint. Useful as a bootstrap path on startup, or as a fallback if push uploads don't reach the plugin. |

Push mode is preferred. Polling is the right choice when the gateway
sits on a network that can't reach the plugin's listen address (e.g.
strict NAT) but the plugin can reach the gateway.

## Supported sensors

All sensors present in the gateway's data stream are auto-registered
on first observation. Common types include:

- Temperature (indoor / outdoor / soil / water)
- Humidity (indoor / outdoor)
- Barometric pressure (absolute / relative)
- Wind speed and direction
- Rainfall (rate, hourly, daily, monthly, yearly)
- UV index
- Solar radiation
- CO2
- PM2.5 / PM10

Multi-channel sensors (e.g. eight outdoor temperature probes) are
each registered as a separate device.

## Setup

1. **Plugin config** — copy `config/config.toml.example` to
   `config/config.toml`:

   ```toml
   [homecore]
   broker_host = "127.0.0.1"
   broker_port = 1883
   plugin_id   = "plugin.ecowitt"
   password    = ""

   [ecowitt]
   listen_port = 8888

   # Optional: poll mode. Also used as the default target for the
   # discover_gateways / refresh_sensors / get_gateway_info actions.
   # gateway_ip         = "10.0.10.50"
   # poll_interval_secs = 60

   # Optional: explicit IPs to probe alongside the UDP broadcast scan
   # in discover_gateways. Use when consoles live behind a managed
   # switch that doesn't forward UDP broadcast.
   # manual_hosts = ["10.0.20.5", "10.0.30.5"]
   ```

2. **Configure the Ecowitt gateway** to push data to HomeCore. In
   the Ecowitt app, open Device → Customized:

   | Field | Value |
   |---|---|
   | Protocol | `Ecowitt` |
   | Server IP | The IP of the host running `hc-ecowitt` |
   | Path | `/data/report/` |
   | Port | `8888` (or the `listen_port` you configured) |
   | Upload interval | `60` seconds |

   Save and enable the customized upload. Within one upload interval,
   sensors will appear as devices in HomeCore.

3. **Register the plugin** in `homecore.toml`:

   ```toml
   [[plugins]]
   id      = "plugin.ecowitt"
   binary  = "../plugins/hc-ecowitt/target/release/hc-ecowitt"
   config  = "../plugins/hc-ecowitt/config/config.toml"
   enabled = true
   ```

## Plugin actions

`hc-ecowitt` ships a capabilities manifest exposing several
gateway-management actions visible in the Leptos web admin and via
`hc-mcp`:

- `discover_gateways` — UDP broadcast + HTTP probe of `manual_hosts`
- `refresh_sensors` — force-poll the gateway and re-register devices
- `get_gateway_info` — fetch firmware version, MAC, model
- `set_custom_server` — push the plugin's listen URL into the
  gateway's customized upload settings

These hit the gateway's `cgi-bin` endpoints; the target IP is
resolved from `gateway_ip` (when set), the in-memory cache populated
by `discover_gateways`, or `manual_hosts`.

## Network considerations

`discover_gateways` issues a `CMD_BROADCAST` UDP probe on
`255.255.255.255:46000`. On a multi-NIC host this lands on the
default broadcast interface, which may not be the IoT network where
your gateways live. Two fixes:

1. **Pin a multicast/broadcast route** to the IoT interface (see the
   [Sonos discovery notes](sonos#multicast-routing-on-multi-nic-hosts)
   for the technique — same idea, different addresses).
2. **List `manual_hosts`** with the gateway IPs explicitly. The
   plugin probes them via HTTP `GET /get_device_info?` whenever a
   discovery is triggered, bypassing UDP entirely.

## SDK adoption

`hc-ecowitt` is built on `hc-plugin-sdk-rs` and supports the full
management protocol: heartbeat, remote configuration, dynamic log
level, and MQTT log forwarding. The capability manifest lists every
plugin action available to rules and `hc-mcp`.
