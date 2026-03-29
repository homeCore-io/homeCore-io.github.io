---
id: http-poller
title: HTTP Poller
sidebar_label: HTTP Poller
sidebar_position: 3
---

# HTTP Poller

The `http-poller` plugin turns any HTTP endpoint into a HomeCore device. It polls at a configured interval, maps response fields to device attributes, and publishes them to HomeCore. No coding required.

## Use cases

- Weather data from a local weather station or API
- NAS/server status (disk usage, CPU temp, etc.)
- Energy monitor readings
- Any JSON HTTP API you want to automate against

## Quick start

```bash
# From the workspace root
cargo run -p http-poller -- config/http-poller.toml
```

## Config file structure

```toml
[homecore]
broker_host = "127.0.0.1"
broker_port = 1883
plugin_id   = "plugin.http-poller"
password    = ""

# One [[devices]] section per polled endpoint
[[devices]]
device_id    = "weather_station"
name         = "Weather Station"
area         = "outdoor"
device_type  = "sensor"
url          = "http://192.168.1.200/api/weather"
method       = "GET"           # GET | POST
poll_interval_secs = 60
timeout_ms   = 5000

# Response mapping — three modes (see below)
[devices.field_map]
temperature = "temp_f"
humidity    = "relative_humidity"
wind_speed  = "wind_mph"
```

## Response mapping modes

### Mode 1: Direct field map (`field_map`)

Maps JSON response fields directly to device attributes.

```toml
# Response: {"temp_f": 72.1, "relative_humidity": 45, "wind_mph": 8.3}
[devices.field_map]
temperature = "temp_f"           # device attr = json key
humidity    = "relative_humidity"
wind_speed  = "wind_mph"
```

Nested JSON paths use dot notation:

```toml
# Response: {"data": {"current": {"temp": 72.1}}}
[devices.field_map]
temperature = "data.current.temp"
```

### Mode 2: Direct path (no mapping)

Publish a specific JSON value directly as a single attribute:

```toml
# Response: {"status": "ok", "load": 0.45}
[devices.path]
path      = "load"
attribute = "cpu_load"
```

### Mode 3: Rhai transform script

Full control over response processing. Write a Rhai function that receives the parsed JSON and returns a map of device attributes.

```toml
[devices.transform]
script = '''
fn transform(data) {
    #{
        temperature: data["main"]["temp"] - 273.15,   // K → °C
        humidity:    data["main"]["humidity"],
        description: data["weather"][0]["description"]
    }
}
'''
```

## OpenWeatherMap example

```toml
[[devices]]
device_id          = "weather_openweathermap"
name               = "Outside Weather"
area               = "outdoor"
device_type        = "sensor"
url                = "https://api.openweathermap.org/data/2.5/weather?q=Washington,DC&appid=YOUR_API_KEY&units=imperial"
poll_interval_secs = 300   # 5 minutes (respect API rate limits)

[devices.field_map]
temperature = "main.temp"
feels_like  = "main.feels_like"
humidity    = "main.humidity"
pressure    = "main.pressure"
wind_speed  = "wind.speed"
description = "weather.0.description"
```

## NAS status example (complex transform)

```toml
[[devices]]
device_id          = "nas_status"
name               = "NAS"
device_type        = "sensor"
url                = "http://192.168.1.100:5000/api/v3/system/info"
method             = "GET"
poll_interval_secs = 60
headers            = {Authorization = "Bearer YOUR_NAS_TOKEN"}

[devices.transform]
script = '''
fn transform(data) {
    let disks = data["disks"];
    let total = 0.0;
    let used  = 0.0;
    for d in disks {
        total += d["total_gb"];
        used  += d["used_gb"];
    }
    #{
        cpu_temp:      data["cpu_temp_c"],
        disk_used_gb:  used,
        disk_total_gb: total,
        disk_pct:      (used / total * 100.0).round(),
        uptime_days:   data["uptime_secs"] / 86400
    }
}
'''
```

## Availability and offline handling

If the HTTP request fails (connection error, timeout, non-2xx status), the device is marked `offline`. When it recovers, it goes back online.

```toml
[[devices]]
# ...
offline_after_failures = 3   # optional: mark offline after this many consecutive failures (default: 1)
```

## React to polled data in rules

```toml
# Alert when outside temp drops below 32°F
name = "Freeze alert"
enabled = true

[trigger]
type      = "device_state_changed"
device_id = "weather_openweathermap"
attribute = "temperature"

[[conditions]]
type      = "device_state"
device_id = "weather_openweathermap"
attribute = "temperature"
op        = "Lt"
value     = 32

[[actions]]
type    = "notify"
channel = "telegram"
message = "Freezing temperature: {{device.temperature}}°F — check pipes!"
```

## Full config reference

```toml
[[devices]]
device_id          = "string"          # unique device ID
name               = "string"          # display name
area               = "string"          # optional
device_type        = "sensor"          # optional
url                = "string"          # required
method             = "GET"             # GET | POST (default: GET)
poll_interval_secs = 60                # polling interval
timeout_ms         = 10000             # request timeout
headers            = {}                # optional HTTP headers as TOML table
body               = ""                # optional request body (POST)
offline_after_failures = 1             # failures before marking offline

# ONE of: field_map, path, or transform
[devices.field_map]                    # mode 1: direct field mapping
attr_name = "json.path"

[devices.path]                         # mode 2: single path
path      = "json.path"
attribute = "attr_name"

[devices.transform]                    # mode 3: Rhai script
script    = "fn transform(data) { ... }"
```
