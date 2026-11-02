---
id: hc-mcp
title: "hc-mcp: MCP Server"
sidebar_label: hc-mcp (MCP Server)
sidebar_position: 1
---

# hc-mcp

`hc-mcp` is the [Model Context Protocol](https://modelcontextprotocol.io) server for HomeCore. It gives an MCP-aware LLM client (Claude Desktop, Claude Code and others) typed tools to **inspect a running HomeCore, command devices, edit automations and run plugin actions**.

The repo lives at [homeCore-io/hc-mcp](https://github.com/homeCore-io/hc-mcp).

---

## Tool surface

There are 27 tools. The 18 read-only tools are always available; the 9 that change things are each switched on by category with `HC_MCP_ALLOW_WRITE`.

### Read-only (always on, 18 tools)

| Tool | Endpoint | Purpose |
|---|---|---|
| `system_health` | `GET /system/status` | First stop for overall health |
| `broker_diagnose` | aggregated | Broker and plugin-heartbeat check: active and offline plugins, and any with a heartbeat older than 120 seconds |
| `list_plugins` | `GET /plugins` | Status of every plugin |
| `plugin_status(plugin_id)` | `GET /plugins/:id` | One plugin in detail |
| `plugin_capabilities(plugin_id)` | `GET /plugins/:id/capabilities` | Declared actions and device schemas |
| `list_plugin_actions` | capabilities of every plugin | Every plugin's declared actions in one flat list |
| `list_devices` | `GET /devices` | All registered devices and their state |
| `device_state(device_id)` | `GET /devices/:id` | One device's current state |
| `device_history(device_id, ...)` | `GET /devices/:id/history` | Time series, optionally for one attribute and time window |
| `list_rules` | `GET /automations` | All automations |
| `get_rule(rule_id)` | `GET /automations/:id` | One automation's full body |
| `rule_firings(rule_id, limit)` | `GET /automations/:id/history` | Recent firing history |
| `rule_test(rule_id)` | `POST /automations/:id/test` | Dry-run a rule against current state |
| `recent_events(limit, ...)` | `GET /events` | Tail of the event ring buffer, optionally by type or device |
| `correlation_trace(correlation_id)` | `GET /events`, filtered here | Follow one command through its state changes and rule firings |
| `core_logs(lines, level, grep)` | `WS /logs/stream` | Tail HomeCore's structured logs |
| `plugin_logs(plugin_id, lines, ...)` | `WS /logs/stream` | The same, for one plugin |
| `find_recent_errors(lines)` | `WS /logs/stream` | WARN and ERROR lines from core and every plugin |

`correlation_trace` filters on the client side, so it only sees what is still in the event ring buffer (the last 1000 events).

### Device commands (gate: `device_commands`)

| Tool | Endpoint | Effect |
|---|---|---|
| `command_device(device_id, command)` | `PATCH /devices/:id/state` | Turn things on or off, set brightness, lock doors, and so on |
| `bulk_command(commands)` | one call per device | Send many commands in parallel, with success reported per device |

### Rule mutations (gate: `rule_mutations`)

| Tool | Endpoint | Effect |
|---|---|---|
| `enable_rule(rule_id)` | `PATCH /automations/:id` | Set enabled to true (safe to repeat) |
| `disable_rule(rule_id)` | `PATCH /automations/:id` | Set enabled to false; the rule stays on disk |
| `delete_rule(rule_id)` | `DELETE /automations/:id` | Remove the rule for good |
| `create_rule(rule)` | `POST /automations` | Add a rule from a full body |
| `update_rule(rule_id, rule)` | `PUT /automations/:id` | Replace an existing rule entirely |

### Plugin actions (gate: `plugin_actions`)

| Tool | Endpoint | Effect |
|---|---|---|
| `invoke_plugin_action(plugin_id, action, params)` | `POST /plugins/:id/command` | Run a non-streaming action |
| `await_streaming_plugin_action(plugin_id, action, params)` | POST, then SSE | Run a streaming action and return its final result |

`await_streaming_plugin_action` collects the progress, item and warning events along the way and stops at a terminal stage (`complete`, `error`, `canceled` or `timeout`). It waits up to `timeout_secs` (default 90, at most 600). See [Capabilities → In hc-mcp](../plugins/capabilities#in-hc-mcp) for the full result shape.

---

## Install

### From source

```bash
git clone https://github.com/homeCore-io/hc-mcp
cd hc-mcp
python3 -m venv .venv
.venv/bin/pip install -e .
```

It needs Python 3.11 or newer.

### Configure with `hc-mcp setup`

The `setup` subcommand creates an API key on a running HomeCore and writes the config file to `~/.config/hc-mcp/config.toml` with mode 0600. It needs admin rights for that one call, by either of two routes:

```bash
# Option A: an existing admin JWT (or set HC_ADMIN_TOKEN)
.venv/bin/hc-mcp setup --base-url http://127.0.0.1:8080 \
    --admin-token "$(cat ~/admin-jwt.txt)"

# Option B: sign in with a username; the password is prompted if you leave it out
.venv/bin/hc-mcp setup --base-url http://127.0.0.1:8080 \
    --username admin
```

The JWT is used only to create the key and isn't stored. Other options:

| Option | Default | Description |
|---|---|---|
| `--label` | `hc-mcp` | Label for the new key |
| `--scopes` | see below | Comma-separated scopes for the key |
| `--expires-days` | no expiry | Key lifetime in days |
| `--config-path` | `~/.config/hc-mcp/config.toml` | Where to write the config |
| `--rotate` | | Issue a new key and overwrite an existing config. The old key is not revoked; do that in the web app or with `DELETE /api/v1/auth/api-keys/{id}`. |
| `--force` | | Overwrite an existing config without prompting |

By default the key gets `areas:read`, `automations:read`, `audit:read`, `devices:read`, `plugins:read`, `plugins:write` and `scenes:read`: enough for the read-only tools and plugin actions. To use the other write tools, add the scopes they need with `--scopes`: `devices:command` for device commands and `automations:write` for rule changes.

### Manual config

To provision the key yourself, create one in the web app (**Me → API keys**, or **Settings → People & access**) or with `hc-cli` on the HomeCore host:

```bash
hc-cli api-key create --label hc-mcp \
    --scopes areas:read,automations:read,audit:read,devices:read,plugins:read,plugins:write,scenes:read
```

Then write `~/.config/hc-mcp/config.toml`:

```toml
[homecore]
base_url     = "http://127.0.0.1:8080"
api_key      = "hc_sk_..."   # from above
timeout_secs = 5
```

hc-mcp looks for its config at `--config`, then `HC_MCP_CONFIG`, then the default path. `HC_MCP_BASE_URL`, `HC_MCP_API_KEY` and `HC_MCP_TIMEOUT_SECS` override individual values.

---

## Enable write tools

Each write category is switched on separately. For example, `device_commands` lets Claude turn on lights without letting it edit rules.

```jsonc
"env": {
  // any subset; "all" enables everything
  "HC_MCP_ALLOW_WRITE": "device_commands,rule_mutations,plugin_actions"
}
```

Calling a gated tool without its category enabled returns a `PermissionError` that says what to set. Both checks apply: the category must be enabled in hc-mcp, and the API key must hold the scope HomeCore requires for the call.

---

## Wire into a Claude client

### Claude Code

For yourself, in `~/.claude.json`, or for one project, in `.mcp.json` at the project root:

```json
{
  "mcpServers": {
    "homecore": {
      "command": "/path/to/hc-mcp/.venv/bin/hc-mcp",
      "env": { "HC_MCP_ALLOW_WRITE": "device_commands,rule_mutations,plugin_actions" }
    }
  }
}
```

Leave out the `env` line for read-only access.

### Claude Desktop

The same shape goes in `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or the equivalent file on other platforms.

---

## How the plugin action tools use capabilities

hc-mcp doesn't hard-code which actions exist. It reads each plugin's [capability manifest](../plugins/capabilities) when asked:

1. Claude calls `list_plugin_actions`. The result lists every declared action with `plugin_id`, `action_id`, `label`, `description`, `params`, `requires_role`, `stream`, `cancelable` and `timeout_ms`.
2. Claude picks an action and calls the matching tool:
   - `invoke_plugin_action` for actions whose manifest sets `stream: false`.
   - `await_streaming_plugin_action` for actions whose manifest sets `stream: true`. It POSTs the action, reads the SSE stream at `/plugins/:id/command/:request_id/stream`, gathers the progress, item and warning events, and stops at a terminal stage.
3. Each tool checks the `plugin_actions` gate and looks the action up in the manifest, so a call of the wrong kind fails with a clear error before anything is sent.

A new plugin action needs no change to hc-mcp: it shows up in the next `list_plugin_actions` call.

hc-mcp can't answer an `awaiting_user` prompt from a streaming action; it reports the prompt as a warning. If an action needs a choice from the user, declare it as a parameter in the manifest so the choice can be passed up front.

---

## Standalone smoke test

Outside an MCP client:

```bash
.venv/bin/hc-mcp --help
```

The server speaks MCP over stdio, so you can drive it with the MCP inspector or any conformant client. Without an API key it exits with a message telling you to run `hc-mcp setup`.

---

## Current limitations

- **stdio transport only.** An HTTP/SSE transport, so a client on another machine or a long-running sidecar could connect, is planned but not built.
- **The log tools need an admin credential sent as `?token=`.** `/logs/stream` is admin-only and reads its credential from the `token` query parameter, while hc-mcp sends its API key as an `Authorization` header. As a result `core_logs`, `plugin_logs` and `find_recent_errors` currently work only when hc-mcp's address is on HomeCore's `[auth].whitelist`.
- **No host access.** Tools that would need the host itself (`journalctl`, `docker logs`, reading config files, restarting services) don't exist; that design is on hold.
- **No live MQTT tap.** A tool that subscribes to MQTT for a while (`mqtt_tap`) is deferred to a later phase.

## Roadmap

- **Phase 3:** plugin scaffolding (`scaffold_plugin`, `check_plugin`).
- **Phase 4:** `mqtt_tap`, `rule_graph`, anomaly detection, and audit and migration helpers.
- **Install-aware tools:** deferred. These would detect how HomeCore is installed (local, Docker, remote) and use `systemctl` or `docker` where appropriate; the scope is being revised first.
- **HTTP/SSE transport:** for long-running sidecars and remote clients.

The full design lives in [`DESIGN.md`](https://github.com/homeCore-io/hc-mcp/blob/develop/DESIGN.md).
