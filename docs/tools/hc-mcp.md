---
id: hc-mcp
title: hc-mcp — MCP Server
sidebar_label: hc-mcp (MCP Server)
sidebar_position: 1
---

# hc-mcp

`hc-mcp` is the [Model Context Protocol](https://modelcontextprotocol.io)
server for HomeCore. It exposes typed tools an MCP-aware LLM client
(Claude Desktop, Claude Code, etc.) can call to **inspect a running
HomeCore instance and invoke plugin actions on it**.

The repo lives at [homeCore-io/hc-mcp](https://github.com/homeCore-io/hc-mcp).

---

## What's available

### Read-only (always on)

| Tool | Endpoint | Purpose |
|---|---|---|
| `system_health` | `GET /system/status` | Overall health snapshot |
| `list_plugins` | `GET /plugins` | Status of every plugin |
| `plugin_status(plugin_id)` | `GET /plugins/:id` | One plugin in detail |
| `plugin_capabilities(plugin_id)` | `GET /plugins/:id/capabilities` | Declared actions |
| `list_devices` | `GET /devices` | All registered devices |
| `device_state(device_id)` | `GET /devices/:id` | Single device + schema |
| `device_history(device_id, ...)` | `GET /devices/:id/history` | Time-series for an attribute |
| `list_rules` | `GET /automations` | All automations |
| `get_rule(rule_id)` | `GET /automations/:id` | One automation full body |
| `rule_firings(rule_id, limit)` | `GET /automations/:id/history` | Recent fire history |
| `recent_events(limit)` | `GET /events` | Tail of the event ring buffer |
| `list_plugin_actions` | (caps fanout) | Flatten every plugin manifest into one list |

### Write-gated (require `HC_MCP_ALLOW_WRITE`)

| Tool | Category | Effect |
|---|---|---|
| `invoke_plugin_action` | `plugin_actions` | POST `/plugins/:id/command` for non-streaming manifest actions |
| `await_streaming_plugin_action` | `plugin_actions` | POST a streaming action and consume its SSE stream until a terminal stage |

Set `HC_MCP_ALLOW_WRITE=plugin_actions` (or `all`) in the hc-mcp
environment to enable both. `await_streaming_plugin_action` aggregates
progress / item / warning events along the way and returns them
alongside the terminal payload — see [Capabilities → In hc-mcp](../plugins/capabilities#in-hc-mcp)
for the full result shape.

---

## Install

```bash
cd /path/to/clients/hc-mcp
python3 -m venv .venv
.venv/bin/pip install -e .
```

Python ≥ 3.11 (for the stdlib `tomllib` + modern type syntax).

## Configure

### 1. Issue an API key

On the HomeCore host:

```bash
hc-cli api-key create --label mcp-service \
    --scopes devices:read,plugins:read,automations:read,events:read,audit:read
```

The token is printed once — save it.

For Phase 4a (`invoke_plugin_action`) you also need `plugins:write`.
Issue a separate key for that and only export it from a more-privileged
shell when you intend to invoke actions.

### 2. Write a config file

`~/.config/hc-mcp/config.toml`:

```toml
[homecore]
base_url = "http://127.0.0.1:8080"
api_key  = "hc_sk_..."   # from step 1
timeout_secs = 5
```

Or set `HC_MCP_BASE_URL` / `HC_MCP_API_KEY` env vars instead.

---

## Wire into a Claude client

### Claude Code

Add to `~/.claude.json` (or per-project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "homecore": {
      "command": "/path/to/hc-mcp/.venv/bin/hc-mcp"
    }
  }
}
```

To enable plugin-action invocation, pass the env var through the
config:

```json
{
  "mcpServers": {
    "homecore": {
      "command": "/path/to/hc-mcp/.venv/bin/hc-mcp",
      "env": { "HC_MCP_ALLOW_WRITE": "plugin_actions" }
    }
  }
}
```

### Claude Desktop

Same shape in
`~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or the equivalent on your platform.

---

## How invoke_plugin_action interacts with capabilities

`hc-mcp` doesn't know what actions exist — it discovers them at call
time by reading each plugin's [capability manifest](../plugins/capabilities).
The flow:

1. Claude calls `list_plugin_actions`. Result is a flat list of every
   declared action with `plugin_id`, `action_id`, `label`,
   `description`, `params` schema, `requires_role`, `stream` flag, etc.
2. Claude picks an action and calls `invoke_plugin_action(plugin_id,
   action, params)`.
3. hc-mcp checks the write gate, looks up the action in the plugin's
   manifest to confirm it exists and isn't a streaming action,
   POSTs `/plugins/:id/command`, and returns the response.

When you ship a new plugin action, **no hc-mcp changes are needed** —
it appears in the next `list_plugin_actions` call automatically.

---

## Standalone smoke test

Outside an MCP client:

```bash
.venv/bin/hc-mcp --help
```

The server speaks MCP over stdio; you can drive it with the MCP
inspector or any conformant client. A 401 against a running core with
a dummy key proves your transport, base URL, and auth header are
wired correctly.

---

## Limitations and roadmap

- **stdio only.** HTTP/SSE transport (so Claude Desktop on another
  machine can connect over Tailscale) lands in a follow-up.
- **Read-only by default.** Writes are explicitly gated per category.
- **Streaming actions return an error.** Awaiting their terminal stage
  cleanly through MCP needs design — likely a "watch this request_id"
  variant or progress notifications.
- **No live MQTT tap, no rule mutation, no plugin scaffolding.**
  Those are the targets for later phases (`mqtt_tap`,
  `correlation_trace`, `create_rule`, `scaffold_plugin`).

The full design spec lives at
[`clients/hc-mcp/DESIGN.md`](https://github.com/homeCore-io/hc-mcp/blob/develop/DESIGN.md).
