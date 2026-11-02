---
id: quickstart
title: Quick Start
sidebar_label: Quick Start
sidebar_position: 2
---

# Quick Start

This walkthrough gets HomeCore running with a working automation in about
ten minutes. It uses a virtual switch, so you don't need any hardware.

## 1. Start the server

From a clone of the homeCore repository, build the server and give it a
scratch home directory with the example config:

```bash
cd /path/to/homeCore
cargo build -p homecore

mkdir -p ~/hc-quickstart/config
cp config/homecore.toml.example ~/hc-quickstart/config/homecore.toml
./target/debug/homecore --home ~/hc-quickstart
```

If you installed a [binary release](./binary-releases), run
`./bin/homecore --config config/homecore.toml` from your `homecore/`
directory instead. The rest of the steps are the same.

A separate home keeps the walkthrough's data out of the repository. The
repository's own `config/homecore.toml` is a working house config that
declares real plugins, so running the server from the repo root without
`--home` would try to start them.

Watch for the first-start banner:

```
WARN homecore:   Default admin account created.
WARN homecore:   Username : admin
WARN homecore:   Password : AbCdEf12GhIj34Kl
WARN homecore:   Saved to : /home/you/hc-quickstart/INITIAL_ADMIN_PASSWORD
INFO hc_api: HomeCore API server starting addr=0.0.0.0:8080
```

The password is also in `~/hc-quickstart/INITIAL_ADMIN_PASSWORD`. Core
creates it only on the first start, when no users exist.

On first run, HomeCore creates its working files under the home
directory, including:
- `data/state.redb`: device registry, users and other state
- `data/history.db`: time-series history
- `config/modes.toml`: the built-in `mode_night` and `mode_day` modes

## 2. Log in and get a token

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"AbCdEf12GhIj34Kl"}' | jq -r .token)

echo $TOKEN   # should print a JWT string
```

Access tokens last 24 hours by default (`[auth].token_expiry_hours`).
To make signing in again easier, keep the password in a file for the
session:

```bash
echo 'export HC_PASS="AbCdEf12GhIj34Kl"' > /tmp/hc-dev.env
```

Then re-authenticate with:

```bash
source /tmp/hc-dev.env
TOKEN=$(curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"$HC_PASS\"}" | jq -r .token)
```

## 3. Check the system

```bash
# API health (no token needed)
curl http://localhost:8080/api/v1/health

# List devices (no plugin devices yet on a fresh home)
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" | jq

# System status
curl -s http://localhost:8080/api/v1/system/status \
  -H "Authorization: Bearer $TOKEN" | jq
```

## 4. Create a virtual switch

Glue devices are virtual devices that live inside core. Create a switch
to experiment with:

```bash
curl -s -X POST http://localhost:8080/api/v1/glue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "switch", "id": "quickstart", "name": "Quickstart Switch"}' | jq
```

Core adds the type prefix to the id, so the device is
`switch_quickstart`, with an `on` attribute that starts as `false`.
Check that it appeared:

```bash
curl -s http://localhost:8080/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" | jq '.[].device_id'
```

## 5. Watch the live event stream

In a second terminal (install `websocat` once with `cargo install websocat`):

```bash
websocat "ws://localhost:8080/api/v1/events/stream?token=$TOKEN"
```

Leave it running. Events appear here as you work through the next steps.

## 6. Create your first automation rule

This rule fires when `switch_quickstart` turns on and writes a line to
the log:

```bash
RULE_ID=$(curl -s -X POST http://localhost:8080/api/v1/automations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Quickstart switch on",
    "enabled": true,
    "priority": 10,
    "trigger": {
      "DeviceStateChanged": {
        "device_id": "switch_quickstart",
        "attribute": "on",
        "to": true
      }
    },
    "conditions": [],
    "actions": [
      {
        "action": {
          "LogMessage": {
            "message": "Quickstart switch turned on!",
            "level": "Info"
          }
        }
      }
    ]
  }' | jq -r .id)

echo "Created rule: $RULE_ID"
```

Core assigns the rule's id and saves the rule as a RON file in `rules/`.

## 7. Trigger the rule

Turn the switch on:

```bash
curl -s -X PATCH http://localhost:8080/api/v1/devices/switch_quickstart/state \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"on": true}'
```

The event stream shows a `device_state_changed` event followed by
`rule_fired`, and the server log shows the message from the
`LogMessage` action, logged by `hc_core::executor`.

## 8. Check rule fire history

```bash
curl -s http://localhost:8080/api/v1/automations/$RULE_ID/history \
  -H "Authorization: Bearer $TOKEN" | jq
```

This returns the rule's most recent firings (up to 20), with the
condition and action trace for each.

## 9. Dry-run the rule (test without executing)

```bash
curl -s -X POST http://localhost:8080/api/v1/automations/$RULE_ID/test \
  -H "Authorization: Bearer $TOKEN" | jq
```

The response says whether the conditions pass and which actions would
run, without running any of them.

## Next steps

- [Configuration reference](./configuration): every config option
- [Rules overview](../rules/overview): triggers, conditions and actions
- [Connect a real device](../plugins/overview): Hue, YoLink, Z-Wave and more
- [Virtual devices](../devices/virtual-devices): timers, switches and modes for more involved automations

## Resetting to a clean state

```bash
# Stop the server (Ctrl-C), then remove the scratch home
rm -rf ~/hc-quickstart
```

Recreate it as in step 1. The next start generates a new admin password.
