---
id: quickstart
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 2
---

# Quick Start

Get HomeCore running with a working automation in under 10 minutes.

## 1. Start the server

From the repository root:

```bash
cd /path/to/homeCore/core
cargo run -p homecore
```

Watch for the startup output:

```
INFO homecore: Admin account created — temporary password: AbCdEf12GhIj34Kl
INFO hc_api: API server starting addr="0.0.0.0:8080"
```

**Copy the admin password now.** It is displayed only once.

HomeCore uses the current directory as its base. On first run it creates:
- `data/state.redb` — device registry and rule storage
- `data/history.db` — time-series history

## 2. Log in and get a token

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"AbCdEf12GhIj34Kl"}' | jq -r .token)

echo $TOKEN   # should print a JWT string
```

Save your password for the session:

```bash
echo 'export HC_PASS="AbCdEf12GhIj34Kl"' > /tmp/hc-dev.env
```

Re-authenticate any time with:

```bash
source /tmp/hc-dev.env
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"$HC_PASS\"}" | jq -r .token)
```

## 3. Check the system

```bash
# API health
curl http://localhost:8080/health

# List devices (empty on first run)
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" | jq

# System status
curl -s http://localhost:8080/api/v1/system/status \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 4. Start the virtual device (optional but useful for testing)

In a second terminal:

```bash
cargo run -p virtual-device -- --broker 127.0.0.1 --port 1883 --id plugin.virtual
```

The virtual device registers itself and publishes state. Check it appeared:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" | jq '.[].name'
```

## 5. Watch the live event stream

In a third terminal (install `websocat` once with `cargo install websocat`):

```bash
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN"
```

Leave this running — you'll see events appear in real time as you interact with the API.

## 6. Create your first automation rule

This rule fires whenever `light.virtual_01` turns on and sends a notification:

```bash
RULE_ID=$(curl -s -X POST http://localhost:8080/api/v1/automations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Virtual light on alert",
    "enabled": true,
    "priority": 10,
    "trigger": {
      "type": "DeviceStateChanged",
      "device": "lab.virtual_light",
      "attribute": "on"
    },
    "conditions": [],
    "actions": [
      {
        "type": "Notify",
        "channel": "log",
        "message": "Virtual light turned on!"
      }
    ]
  }' | jq -r .id)

echo "Created rule: $RULE_ID"
```

## 7. Trigger the rule

Command the virtual light to turn on:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/light.virtual_01/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'
```

Watch the event stream — you'll see `device_state_changed` followed immediately by `rule_fired`.

In the server terminal you'll see:
```
INFO hc_core::engine  Rule firing rule_name="Virtual light on alert"
INFO hc_core::executor  NOTIFY: Virtual light turned on!
```

## 8. Check rule fire history

```bash
curl -s http://localhost:8080/api/v1/automations/$RULE_ID/history \
  -H "Authorization: Bearer $TOKEN" | jq
```

This shows the last 20 evaluations with full condition/action traces.

## 9. Dry-run the rule (test without executing)

```bash
curl -s -X POST http://localhost:8080/api/v1/automations/$RULE_ID/test \
  -H "Authorization: Bearer $TOKEN" | jq
```

Returns what would fire without actually executing any actions.

## Next steps

- [Configuration reference](./configuration) — understand all the config options
- [Rules overview](../rules/overview) — understand triggers, conditions, and actions
- [Connect a real device](../plugins/overview) — integrate Hue, YoLink, Z-Wave, etc.
- [Virtual devices](../devices/virtual-devices) — timers, switches, and modes for complex automations

## Resetting to a clean state

```bash
# Stop the server (Ctrl-C)
rm -rf data/
# Restart — generates a new admin password
cargo run -p homecore
```
