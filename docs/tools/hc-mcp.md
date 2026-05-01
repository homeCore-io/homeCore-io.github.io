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
HomeCore instance, command devices, edit automations, and invoke plugin
actions**.

The repo lives at [homeCore-io/hc-mcp](https://github.com/homeCore-io/hc-mcp).

---

## Tool surface

27 tools across read-only inspection, device commands, rule edits, and
plugin action dispatch. Read tools are always on; write tools are
opt-in per category via `HC_MCP_ALLOW_WRITE`.

### Read-only (always on, 20 tools)

| Tool | Endpoint | Purpose |
|---|---|---|
| `system_health` | `GET /system/status` | First-stop overall health |
| `broker_diagnose` | aggregated | MQTT broker + plugin heartbeat sanity check |
| `list_plugins` | `GET /plugins` | Status of every plugin |
| `plugin_status(plugin_id)` | `GET /plugins/:id` | One plugin in detail |
| `plugin_capabilities(plugin_id)` | `GET /plugins/:id/capabilities` | Declared actions + device schemas |
| `list_devices` | `GET /devices` | All registered devices + state |
| `device_state(device_id)` | `GET /devices/:id` | Single device + schema |
| `device_history(device_id, ...)` | `GET /devices/:id/history` | Time-series for an attribute |
| `list_rules` | `GET /automations` | All automations |
| `get_rule(rule_id)` | `GET /automations/:id` | One automation full body |
| `rule_firings(rule_id, limit)` | `GET /automations/:id/history` | Recent fire history |
| `rule_test(rule_id)` | `POST /automations/:id/test` | Dry-run a rule against current state |
| `recent_events(limit, ...)` | `GET /events` | Tail of the event ring buffer |
| `correlation_trace(correlation_id)` | client-side filter | Walk a single command's lifecycle |
| `core_logs(lines, level, grep)` | `WS /logs/stream` | Tail homeCore's structured logs |
| `plugin_logs(plugin_id, lines, ...)` | `WS /logs/stream` | Same, filtered to one plugin |
| `find_recent_errors(lines)` | `WS /logs/stream` | WARN/ERROR across core + every plugin |
| `list_plugin_actions` | (caps fanout) | Flatten every plugin manifest into one list |
| (read-side of `invoke_plugin_action`) | — | The dispatcher itself is write-gated; discovery is free |

### Device commands (gate: `device_commands`)

| Tool | Endpoint | Effect |
|---|---|---|
| `command_device(device_id, command)` | `PATCH /devices/:id/state` | Turn things on/off, set brightness, lock doors, etc. |
| `bulk_command(commands)` | fan-out | Apply many commands in parallel; per-device success reported |

### Rule mutations (gate: `rule_mutations`)

| Tool | Endpoint | Effect |
|---|---|---|
| `enable_rule(rule_id)` | `PATCH /automations/:id` | Flip enabled to true (idempotent) |
| `disable_rule(rule_id)` | `PATCH /automations/:id` | Flip enabled to false — rule stays on disk |
| `delete_rule(rule_id)` | `DELETE /automations/:id` | Permanently remove; affects referenced rules |
| `create_rule(rule)` | `POST /automations` | Add a new rule from a full body |
| `update_rule(rule_id, rule)` | `PUT /automations/:id` | Full replace of an existing rule |

### Plugin actions (gate: `plugin_actions`)

| Tool | Endpoint | Effect |
|---|---|---|
| `invoke_plugin_action(plugin_id, action, params)` | `POST /plugins/:id/command` | Non-streaming manifest action |
| `await_streaming_plugin_action(plugin_id, action, params)` | POST + SSE | Streaming action; returns aggregated terminal payload |

`await_streaming_plugin_action` consumes events along the way (progress,
item, warning) and stops on a terminal stage (`complete | error |
canceled | timeout`) — see
[Capabilities → In hc-mcp](../plugins/capabilities#in-hc-mcp) for the
full result shape.

---

## Install

### From source (recommended)

```bash
git clone https://github.com/homeCore-io/hc-mcp
cd hc-mcp
python3 -m venv .venv
.venv/bin/pip install -e .
```

Python ≥ 3.11 (for the stdlib `tomllib` + modern type syntax).

### Configure with `hc-mcp setup`

The packaged setup subcommand provisions an API key against a running
homeCore and writes the config file at `~/.config/hc-mcp/config.toml`
(0600). Two auth paths into homeCore:

```bash
# Option A: use an existing admin JWT
.venv/bin/hc-mcp setup --base-url http://127.0.0.1:8080 \
    --admin-token "$(cat ~/admin-jwt.txt)"

# Option B: log in with username + password (issues a JWT, then a key)
.venv/bin/hc-mcp setup --base-url http://127.0.0.1:8080 \
    --username admin --password '...'
```

Re-running with `--rotate` issues a fresh key; `--force` overwrites
without rotating (useful for manual paste flows).

### Manual config fallback

If you'd rather provision the key yourself:

```bash
# On the homeCore host:
hc-cli api-key issue --owner mcp-service --role observer
# Add --role user (or higher) if you intend to enable write categories.
```

Then write `~/.config/hc-mcp/config.toml`:

```toml
[homecore]
base_url     = "http://127.0.0.1:8080"
api_key      = "hc_sk_..."   # from above
timeout_secs = 5
```

`HC_MCP_BASE_URL` / `HC_MCP_API_KEY` env vars override the config file.

---

## Enable write tools

Each write category opts in independently — for example,
`device_commands` lets Claude turn on lights without permitting rule
edits.

```jsonc
"env": {
  // any subset; "all" enables everything
  "HC_MCP_ALLOW_WRITE": "device_commands,rule_mutations,plugin_actions"
}
```

Calling a gated tool without the category enabled returns a
`PermissionError` explaining what to set. The API key issued in setup
must also carry sufficient core role for the operation — Observer can
only read; User can act on devices/plugins; Admin can mutate auth +
restart things.

---

## Wire into a Claude client

### Claude Code

`~/.claude.json` (or per-project `.claude/settings.json`):

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

Drop the `env` line for read-only access.

### Claude Desktop

Same shape at
`~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or the platform equivalent.

---

## How `invoke_plugin_action` and `await_streaming_plugin_action` interact with capabilities

`hc-mcp` doesn't hard-code what actions exist — it discovers them at
call time by reading each plugin's [capability manifest](../plugins/capabilities).
The flow:

1. Claude calls `list_plugin_actions`. Result is a flat list of every
   declared action with `plugin_id`, `action_id`, `label`,
   `description`, `params` schema, `requires_role`, `stream` flag, etc.
2. Claude picks an action and calls the appropriate dispatcher:
   - `invoke_plugin_action` for actions whose manifest sets `stream: false`.
   - `await_streaming_plugin_action` for actions whose manifest sets
     `stream: true`. The tool POSTs the action, then consumes the SSE
     stream at `/plugins/:id/command/:request_id/stream`, aggregating
     progress / item / warning events and stopping on a terminal stage.
3. Each dispatcher checks the `plugin_actions` write gate, looks up the
   action in the manifest to short-circuit shape mismatches with a clear
   error, and surfaces the response.

When you ship a new plugin action, **no hc-mcp changes are needed** —
it appears in the next `list_plugin_actions` call automatically.

`awaiting_user` events from streaming actions surface as warnings —
hc-mcp can't currently respond to them mid-stream. If your action gates
on user input, expose it as params on the action manifest instead so
the dispatcher can accept the choice up-front.

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

## Current limitations

- **stdio transport only.** HTTP/SSE (so Claude Desktop on a different
  machine can connect over Tailscale or a sidecar container can serve
  long-running) is on the roadmap but not yet shipped.
- **No install-aware substrate.** Tools that would need direct host
  access (`journalctl`, `docker logs`, config-file reads, service
  restarts) are not implemented. The substrate-aware design is parked
  pending scope review — see the roadmap.
- **No live MQTT tap.** A persistent MQTT client tool (`mqtt_tap`) is a
  Phase 4 advanced item.

## Roadmap

- **Phase 3** — plugin scaffolding (`scaffold_plugin`, `check_plugin`).
- **Phase 4 (advanced)** — `mqtt_tap`, `rule_graph`, anomaly detection,
  audit/migration helpers.
- **Install-aware substrate** — DEFERRED; would route tools across
  local / docker / remote installs by detecting install method and
  using subprocess (systemctl, docker) where appropriate. Pending scope
  revision before resuming.
- **HTTP/SSE transport** — would unlock long-running sidecar topology
  and remote-LLM-client connections.

The full design spec lives at
[`clients/hc-mcp/DESIGN.md`](https://github.com/homeCore-io/hc-mcp/blob/develop/DESIGN.md).
