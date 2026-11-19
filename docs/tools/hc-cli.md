---
id: hc-cli
title: "hc-cli: Command line"
sidebar_label: hc-cli (Command line)
sidebar_position: 3
description: Script homeCore from a shell. Control devices, scenes, rules and modes, read logs, watch events, and handle keys, users and audit.
---

# hc-cli

`hc-cli` is homeCore's command-line tool. Scripts, cron jobs and shell sessions use it to switch devices, run scenes and rules, read logs and watch events, and administrators use it for API keys, users, the audit log and Mosquitto configuration. It talks to the same REST and WebSocket API as the [web app](../web-ui/overview.md), from the core's own machine or from anywhere on the network.

It's one statically linked Linux x86_64 binary, with no system libraries to install.

---

## Getting it

**In the core image.** `hc-cli` ships in `ghcr.io/homecore-io/hc-core`, so with the [compose file](../getting-started/docker.md) it's already there:

```bash
docker exec homecore hc-cli --help
```

**In the core release archive.** It sits beside `homecore` in `homecore/bin/`. The [systemd guide](../administration/systemd-deployment.md) installs both.

**On its own.** For a machine that runs no core, each `hc-cli-v*` release on [homeCore-io/homeCore](https://github.com/homeCore-io/homeCore/releases) has a small archive with just the tool:

```bash
tar -xzf hc-cli-v0.1.5-linux-x86_64.tar.gz
sudo install -m 0755 hc-cli/bin/hc-cli /usr/local/bin/
```

---

## Connecting

Give it core's address and an API key, as flags or in the environment:

```bash
export HOMECORE_URL=http://192.168.1.10:8080
export HOMECORE_TOKEN=hc_sk_...
hc-cli device list
```

| Flag | Environment | What it is |
|---|---|---|
| `--url` | `HOMECORE_URL` | Core's address, without `/api/v1`. `--host` works too |
| `--token` | `HOMECORE_TOKEN` | An API key, or a token from `hc-cli auth login` |
| `-o`, `--output` | `HOMECORE_OUTPUT` | `human` (the default) or `json` |
| `--config` | | The config file, `~/.config/hc-cli/config.toml` by default |

Make the key in **Settings › People & access › API keys**, or with `hc-cli api-key create`, and give it only the scopes the script needs:

| To | The key needs |
|---|---|
| List and read devices, modes and events | `devices:read` |
| Switch devices and modes | `devices:command` |
| List scenes / activate them | `scenes:read` / `scenes:run` |
| List rules / enable, disable or run them | `automations:read` / `automations:write` |
| Show room names in lists | `areas:read` |
| Read logs | `users:write` (logs are for admins) |

With no URL and no token, `hc-cli` tries the admin socket on the core's own machine (when `[auth.admin_uds]` is turned on), then `http://127.0.0.1:8080` with the token `hc-cli auth login` saved. A token you pass always wins and is never sent to the admin socket, so a script acts as its key.

---

## Devices

```bash
hc-cli device list                       # every device and what it's doing
hc-cli device list --type light --room kitchen
hc-cli device get "Porch light"          # one device, all attributes
hc-cli device attr "Porch light" on      # just the value: true
hc-cli device set "Porch light" on
hc-cli device set "Porch light" on=true brightness_pct=80
hc-cli device set "Porch light" --json '{"on": true, "transition_ms": 2000}'
```

Name a device by its id or its name; names match without regard to case. When two devices share a name, `hc-cli` lists their ids and does nothing. Use an id in scripts.

`set` takes `on`, `off` or `key=value` pairs. A value is read as JSON when it can be (`true`, `80`, `[0.3, 0.4]`) and as text otherwise.

`device attr` prints the bare value, ready for a shell test:

```bash
if [ "$(hc-cli device attr "Front door lock" locked)" = "false" ]; then
    hc-cli device set "Front door lock" locked=true
fi
```

## Scenes, rules and modes

```bash
hc-cli scene list
hc-cli scene activate Evening

hc-cli rule list --disabled
hc-cli rule get "Porch lights at sunset"     # the whole rule, as JSON
hc-cli rule disable "Porch lights at sunset"
hc-cli rule enable "Porch lights at sunset"
hc-cli rule run "Porch lights at sunset"     # as if its trigger fired
hc-cli rule run "Porch lights at sunset" --skip-checks

hc-cli mode list
hc-cli mode get "Night Mode"                 # on or off
hc-cli mode set mode_away on
```

`rule run` checks the rule's conditions first, like a real trigger would. `--skip-checks` runs its actions even when they don't hold.

## Logs

```bash
hc-cli logs                          # the last 100 lines
hc-cli logs -f                       # and keep following
hc-cli logs -n 500 --level warn
hc-cli logs --plugin sonos --since 30m
hc-cli logs --target hc_core::engine -f
```

| Flag | What it does |
|---|---|
| `-f`, `--follow` | Keep printing new lines. A dropped connection is retried and picks up where it left off |
| `-n`, `--lines` | How many recent lines to start with (100; at most 1000) |
| `--level` | The lowest level shown: `error`, `warn`, `info` (default), `debug`, `trace` |
| `--plugin` | One plugin's lines: `sonos`, `hc-sonos` and `plugin.sonos` all work |
| `--target` | Lines whose source starts with this, such as `hc_core::engine` |
| `--since` | Lines after a time: `10m`, `2h`, `1d`, or `2026-11-18T09:00:00Z` |

Logs come from core's memory, which holds the most recent lines (500 unless `[logging.stream] ring_buffer_size` says otherwise). Anything older, or from before a restart, is in core's log files or `docker logs homecore`. Reading logs needs an admin: a person signed in as one, or a key with `users:write`.

## Events

```bash
hc-cli events list -n 20
hc-cli events watch
hc-cli events watch --type device_state_changed,scene_activated
hc-cli events watch --device front_door_lock
```

`events watch` prints each event as it happens until you stop it. If the connection drops, it reconnects and says so on stderr; events in the gap are missed. A key sees the events its scopes allow: device events with `devices:read`, rule events with `automations:read`.

---

## Output for scripts

`-o json` prints JSON from every command. Lists come as one JSON array; `logs` and `events` print one JSON object per line, so each line can go straight to `jq`:

```bash
hc-cli -o json device list | jq -r '.[] | select(.available == false) | .name'
hc-cli -o json events watch --type device_state_changed | jq -c '{device_id, current}'
```

Human output is colored when it goes to a terminal, and plain when piped or when `NO_COLOR` is set.

The exit code says what happened:

| Code | Meaning |
|---|---|
| 0 | Done |
| 1 | Failed, such as a name that matches two things |
| 2 | Bad usage: a missing or unknown argument |
| 3 | Couldn't reach homeCore |
| 4 | Not allowed: a bad token, or a key without the scope |
| 5 | Not found: no device, scene, rule or mode by that id or name |

```bash
hc-cli device set "Porch light" on
case $? in
    3) echo "homeCore is down" ;;
    4) echo "check the key's scopes" ;;
esac
```

---

## Administration

These commands manage homeCore itself. Most need an admin.

| Command | What it does |
|---|---|
| `hc-cli setup` | First-time setup: the admin account, and optionally a service user with a key |
| `hc-cli auth login`, `whoami`, `logout` | Sign in with a password and save the token for later commands |
| `hc-cli api-key create\|list\|show\|update\|rotate\|revoke` | Manage API keys. See [Users and auth](../administration/users-auth.md#api-keys) |
| `hc-cli user list\|show\|create\|delete\|set-role` | Manage people. See [Users and auth](../administration/users-auth.md) |
| `hc-cli audit query` | Search the [audit log](../administration/audit-log.md) |
| `hc-cli broker generate-mosquitto-config` | Turn `[[broker.clients]]` into a Mosquitto config with ACLs. See [the broker guide](../administration/broker.md) |

Every command has `--help`.
