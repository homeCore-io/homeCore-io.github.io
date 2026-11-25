---
id: hc-mcp
title: "hc-mcp: MCP Server"
sidebar_label: hc-mcp (MCP Server)
sidebar_position: 1
---

# hc-mcp

`hc-mcp` is the [Model Context Protocol](https://modelcontextprotocol.io) server for homeCore. It gives an MCP client (Claude Desktop, Claude Code and others) typed tools to inspect a running homeCore, command devices, edit automations and run plugin actions. It is written in Python and lives at [homeCore-io/hc-mcp](https://github.com/homeCore-io/hc-mcp).

The same package runs two ways:

| Mode | Command | Who uses it |
|---|---|---|
| MCP server | `hc-mcp` (stdio) | You, from an MCP client on your own machine, with an API key you made |
| Assistant plugin | `hc-mcp plugin <config.toml>` | Everyone in the house, through the **Ask** button in the homeCore app. Installed from the Catalog into a Python runtime |

Both serve tools from one list (`hc_mcp/registry.py`), so a tool added there shows up in both unless it says otherwise. To install and set up the Assistant as an operator, see [Assistant](../plugins/assistant.md). This page covers how it works.

## Tools

The MCP server has 50 tools: 35 that only read, and 15 that change things. Each write tool belongs to a category that you switch on with `HC_MCP_ALLOW_WRITE`. The server also serves homeCore's skills as prompts and resources (see [Skills](#skills)).

### Read-only (always on, 35 tools)

| Tool | Endpoint | Purpose |
|---|---|---|
| `system_health` | `GET /system/status` | First stop for overall health |
| `broker_diagnose` | aggregated | Broker and plugin-heartbeat check: active and offline plugins, and any with a heartbeat older than 120 seconds |
| `list_plugins` | `GET /plugins` | Status of every plugin |
| `plugin_status(plugin_id)` | `GET /plugins/:id` | One plugin in detail |
| `plugin_capabilities(plugin_id)` | `GET /plugins/:id/capabilities` | Declared actions and device schemas |
| `list_plugin_actions` | capabilities of every plugin | Every plugin's declared actions in one flat list |
| `list_devices` | `GET /devices` | All registered devices and their state |
| `device_state(device_id)` | `GET /devices/:id` and `/schema` | One device's current state and schema |
| `device_history(device_id, ...)` | `GET /devices/:id/history` | Time series, optionally for one attribute and time window |
| `list_rules` | `GET /automations` | All automations |
| `get_rule(rule_id)` | `GET /automations/:id` | One automation's full body |
| `rule_firings(rule_id, limit)` | `GET /automations/:id/history` | Recent firing history |
| `rule_test(rule_id, at)` | `POST /automations/:id/test` | Dry-run a rule against current state, or as of a time |
| `test_draft_rule(rule)` | `POST /automations/test` | Dry-run a rule body before saving it |
| `recent_events(limit, ...)` | `GET /events` | Tail of the event ring buffer, optionally by type or device |
| `correlation_trace(correlation_id)` | `GET /events`, filtered here | Follow one command through its state changes and rule firings |
| `core_logs` | `GET /logs` | The newest lines of homeCore's log, by level, target, time or text (admin) |
| `plugin_logs(plugin_id, ...)` | `GET /logs` | The same, for one plugin (admin) |
| `find_recent_errors` | `GET /logs` | WARN and ERROR lines from core and every plugin (admin) |
| `query_plugin_action` | `POST /plugins/:id/query` | Run a plugin action that only reads |
| `plugin_health` | `GET /plugins` | Every plugin's health and notices, the ones needing attention first |
| `list_alerts` | `GET /alerts` | What needs attention now |
| `audit_log` | `GET /audit` | Who changed what |
| `paused_rules` | `GET /automations/paused` | Automations another automation has paused |
| `stale_rule_refs` | `GET /automations/stale-refs` | Automations naming devices that no longer exist |
| `hub_variables` | `GET /automations/variables` | The variables automations have set |
| `orphaned_devices` | `GET /devices/orphaned` | Devices no plugin manages any more |
| `vocabulary_check` | `GET /system/vocabulary-check` | Commands and conditions a device won't take, and why |
| `system_versions` | `GET /system/versions` | Which version of everything is running |
| `plugin_runtimes` | `GET /plugin-runtimes` | Runtimes, their health, and which plugins run where (admin) |
| `list_backups` | `GET /system/backups` | The scheduled backups homeCore keeps (admin) |
| `list_scenes` | `GET /scenes` | The house's scenes, by id and name |
| `list_rooms` | `GET /areas` | The house's rooms, by id and name |
| `list_skills` | none (shipped with hc-mcp) | The skills hc-mcp carries and their files |
| `read_skill(name, file)` | none (shipped with hc-mcp) | One file of a skill; `file` defaults to `SKILL.md` |

`correlation_trace` filters on the client side, so it only sees what is still in the event ring buffer (the last 1000 events).

### Device commands (category `device_commands`)

| Tool | Endpoint | Effect |
|---|---|---|
| `command_device(device_id, command)` | `PATCH /devices/:id/state` | Turn things on or off, set brightness, lock doors, and so on |
| `bulk_command(commands)` | one call per device | Send many commands, 8 at a time, with success reported per device |
| `run_scene(scene_id)` | `POST /scenes/:id/activate` | Run a scene |
| `room_lights(room_id, on)` | `POST /areas/:id/on` or `/off` | A room's lights only, restored as they were |
| `acknowledge_alert(alert_id)` | `POST /alerts/:id/acknowledge` | Mark an alert seen; it stays until it clears |

### Rule changes (category `rule_mutations`)

| Tool | Endpoint | Effect |
|---|---|---|
| `enable_rule(rule_id)` | `PATCH /automations/:id` | Set enabled to true (safe to repeat) |
| `disable_rule(rule_id)` | `PATCH /automations/:id` | Set enabled to false; the rule stays on disk |
| `delete_rule(rule_id)` | `DELETE /automations/:id` | Remove the rule for good |
| `create_rule(rule)` | `POST /automations` | Add a rule from a full body |
| `update_rule(rule_id, rule)` | `PUT /automations/:id` | Replace an existing rule entirely |
| `resume_rule(rule_id)` | `DELETE /automations/:id/pause` | Undo another automation's pause |

### Plugin actions (category `plugin_actions`)

| Tool | Endpoint | Effect |
|---|---|---|
| `invoke_plugin_action(plugin_id, action, params)` | `POST /plugins/:id/command` | Run an action that doesn't stream |
| `await_streaming_plugin_action(plugin_id, action, params)` | POST, then SSE | Run a streaming action and return its final result |
| `plugin_control(plugin_id, op)` | `POST /plugins/:id/start`, `/stop` or `/restart` | Start, stop or restart a plugin homeCore runs |
| `set_plugin_log_level(plugin_id, level)` | `PATCH /plugins/:id` | Change how much a plugin logs; lasts until changed back |

`await_streaming_plugin_action` collects the progress, item and warning events and stops at a terminal stage (`complete`, `error`, `canceled` or `timeout`). It waits up to `timeout_secs` (default 90, at most 600). See [Capabilities → In hc-mcp](../plugins/capabilities#in-hc-mcp) for the full result shape.

### Tools only the Assistant has

The chat leaves out `list_skills` (it already knows the skills by name) and the admin tools (the three log tools, `plugin_runtimes` and `list_backups`), because the plugin's own key is never an admin's. It adds two tools of its own:

| Tool | Category | What it does |
|---|---|---|
| `show_devices` | read | Draws device cards in the chat |
| `suggest_replies` | read | Offers replies the person can tap |

## The MCP server

### Install

```bash
git clone https://github.com/homeCore-io/hc-mcp
cd hc-mcp
python3 -m venv .venv
.venv/bin/pip install -e .
```

It needs Python 3.11 or newer.

### Configure with `hc-mcp setup`

`hc-mcp setup` creates an API key on a running homeCore and writes the config file to `~/.config/hc-mcp/config.toml` with mode 0600. It needs admin rights for that one call, by either of two routes:

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

By default the key gets `areas:read`, `automations:read`, `automations:write`, `audit:read`, `devices:command`, `devices:read`, `plugins:read`, `plugins:write`, `scenes:read` and `scenes:run`: the scope behind each write category, so switching one on works. Nothing is written until you switch a category on. The log tools, `plugin_runtimes` and `list_backups` also need `users:write`, which makes the key an admin's and is left out on purpose; add it with `--scopes` if you want them.

### Manual config

To make the key yourself, create one in the web app (**Settings › People & access › API keys**) or with `hc-cli` on the homeCore host:

```bash
hc-cli api-key create --label hc-mcp \
    --scopes areas:read,automations:read,automations:write,audit:read,devices:command,devices:read,plugins:read,plugins:write,scenes:read,scenes:run
```

Then write `~/.config/hc-mcp/config.toml`:

```toml
[homecore]
base_url     = "http://127.0.0.1:8080"
api_key      = "hc_sk_..."   # from above
timeout_secs = 5
```

hc-mcp looks for its config at `--config`, then `HC_MCP_CONFIG`, then the default path. `HC_MCP_BASE_URL`, `HC_MCP_API_KEY` and `HC_MCP_TIMEOUT_SECS` override single values. With no API key at all it exits and tells you to run `hc-mcp setup`.

### Turn on write tools

Each write category is switched on separately. For example, `device_commands` lets Claude turn on lights without letting it edit rules.

```jsonc
"env": {
  // any subset; add "security" for locks and doors; "all" enables everything
  "HC_MCP_ALLOW_WRITE": "device_commands,rule_mutations,plugin_actions"
}
```

Calling a write tool whose category is off returns a `PermissionError` that says what to set. Both checks apply: the category must be on in hc-mcp, and the API key must hold the scope homeCore requires for the call.

A change that touches a device that counts for security (locks, doors, windows, covers, garages, alarms, or any device marked Security) also needs `security` in the list. That covers a device command, a scene or automation that names one, and a plugin action that names one or belongs to a plugin that owns one. Read-only actions never count. `all` includes it.

### Connect a Claude client

For Claude Code, add the server to `~/.claude.json` for yourself, or to `.mcp.json` at a project's root for that project alone:

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

For Claude Desktop, the same shape goes in `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, or the equivalent file on other platforms.

To try it outside a client, run `.venv/bin/hc-mcp --help`. The server speaks MCP over stdio, so the MCP inspector or any conforming client can drive it.

## The Assistant plugin

The Assistant is hc-mcp running as the homeCore plugin `plugin.mcp`. It needs core v0.1.110 or later, app v0.1.74 or later, and a [Python runtime](../plugins/runtimes). The runtime starts it with `python -m hc_mcp.plugin <config.toml>`; `hc-mcp plugin <config.toml>` does the same by hand.

### Access

homeCore writes the plugin's config file (its `[homecore]` table holds the broker login) and mints the plugin its own REST key on every start, because the manifest lists `api_scopes`. There is nothing to paste besides the Claude API key. homeCore never gives a plugin `users:write` or `api_keys:admin`.

homeCore also adds the verified caller to every action. The chat offers a person a tool only when all three hold:

1. The tool's category is switched on in the Assistant's settings. Reading is always on.
2. The person asking holds the tool's scopes (and the admin role, for an admin-only tool).
3. The plugin's own key holds them too.

A household member can therefore ask questions and turn things on and off, but can't change automations.

### Settings

An admin sets these in **Settings › Plugins › Assistant**. The plugin keeps them in `settings.json` in its data folder, readable only by its own user, and never sends the key back to a browser.

| Setting | Default | Choices |
|---|---|---|
| Claude API key | none | From console.anthropic.com |
| Model | Claude Sonnet 5.5 | Claude Sonnet 5.5, Claude Opus 5.5, Claude Haiku 4.5 |
| Control devices | on | Category `device_commands` |
| Make and change automations | on | Category `rule_mutations` |
| Locks, doors and security | off | A device command, scene, automation or plugin action that touches a device marked Security needs this as well |
| Ask before every change | on | When off, changes run without a confirm card |
| Keep each person's chats for | 30 days | 30 days, 7 days, or Don't keep |

Other plugins' actions (`plugin_actions`) are off and not on the settings page yet.

### Confirm cards and new automations

A tool that changes something stops on a confirm card that says what will happen, unless "Ask before every change" is off. The card waits up to 10 minutes for an answer. A new automation is shown as When / Only if / Do, with buttons for "Save and turn on" and "Save, turned off", or you can reply asking for changes. One reply runs at most 12 rounds of tool calls.

### The chat stream

The chat is the plugin's streaming action `chat`, declared `requires_role: signed_in`, so anyone signed in may use it. Its screen (`hc-mcp-chat`, in the slot `app.assistant`) starts a reply with `host.stream` and answers a confirm card with `host.respond`. Everything rides on the ordinary stream stages:

- `progress` with `data.kind == "text"` carries reply text as it is written.
- `item` adds or updates a part of the reply: a step chip, device cards, tap replies, what happened to a change, or a note.
- `awaiting_user` with `data.kind == "confirm"` is the confirm card.
- `complete` carries the whole reply as stored, so the screen can redraw it exactly.

[`docs/chat-events.md`](https://github.com/homeCore-io/hc-mcp/blob/develop/docs/chat-events.md) in the repo lists every field. The settings page is `hc-mcp-settings` (slot `plugin.page`). Both screens are plain custom elements in `ui/`, with no build step.

The plugin's other actions are `chats`, `chat_get` and `chat_delete` (for anyone signed in), and `settings_get`, `settings_set` and `test_key` (admins).

### Where it keeps things

Settings and one folder of chats per person go in the plugin's data folder: `HC_MCP_DATA_DIR`, else `[assistant].data_dir` in the config, else (in a runtime) `.../plugins/plugin.mcp/data` so an upgrade keeps it, else `hc-mcp-data` beside the config file. Chats never go to homeCore. Questions, and the house details needed to answer them, go to Anthropic.

The plugin never exits over a missing key, an API failure or REST access that hasn't arrived. It logs the problem, raises a notice on its page and says so in the chat.

### Releasing it

Bump the version in `pyproject.toml` and `hc_mcp/__init__.py`, merge to `main` and tag `v<version>`. The release workflow calls hc-scripts' `python-release.yml`, which builds the runtime artifact (the plugin, the SDK and every dependency as wheels, for x86_64 and aarch64), installs it offline and starts it against a broker, then publishes the release and lists it in the registry, where the Catalog finds it. To build the artifact by hand:

```bash
hc-scripts/build-python-artifact.sh --plugin clients/hc-mcp --sdk sdks/hc-plugin-sdk-py
```

## Skills

hc-mcp ships a copy of homeCore's [skills](./skills.md) from [homeCore-io/skills](https://github.com/homeCore-io/skills): `dev-environment`, `install-and-setup` and `plugin-development` (v0.1.3 and later).

- An MCP client sees each skill as a prompt, to start a conversation with.
- Every file of a skill can be read as a `homecore-skill://<skill>/<file>` resource, for example `homecore-skill://plugin-development/references/python.md`.
- `list_skills` lists them and `read_skill` reads one.

The Assistant knows the skills by name and reads the one that fits (with `read_skill`) when someone asks how to do something. The copy lives in `hc_mcp/skills`; `scripts/sync-skills.sh` refreshes it after the skills repo changes.

## How the plugin action tools use capabilities

hc-mcp doesn't hard-code which actions exist. It reads each plugin's [capability manifest](../plugins/capabilities) when asked:

1. Claude calls `list_plugin_actions`. The result lists every declared action with `plugin_id`, `action_id`, `label`, `description`, `params`, `requires_role`, `stream`, `cancelable` and `timeout_ms`.
2. Claude picks an action and calls the matching tool. `invoke_plugin_action` handles actions whose manifest sets `stream: false`. `await_streaming_plugin_action` handles `stream: true`: it POSTs the action, reads the SSE stream at `/plugins/:id/command/:request_id/stream`, gathers the progress, item and warning events, and stops at a terminal stage.
3. Each tool checks the `plugin_actions` category and looks the action up in the manifest, so a call of the wrong kind fails with a clear error before anything is sent.

A new plugin action needs no change to hc-mcp. It shows up in the next `list_plugin_actions` call.

hc-mcp can't answer an `awaiting_user` prompt from another plugin's streaming action; it reports the prompt as a warning. If an action needs a choice from the user, declare it as a parameter in the manifest so the choice can be passed up front.

## Current limitations

- The only transport is stdio. An HTTP/SSE transport, for a client on another machine or a long-running sidecar, is planned but not built.
- There is no host access: no tools that need the host itself (`journalctl`, `docker logs`, reading config files, restarting services). That design is on hold.
- There is no live MQTT tap. A tool that subscribes to MQTT for a while (`mqtt_tap`) is deferred.

## Roadmap

- Phase 3: plugin scaffolding (`scaffold_plugin`, `check_plugin`).
- Phase 4: `mqtt_tap`, `rule_graph`, anomaly detection, and audit and migration helpers.
- Tools that know how homeCore is installed (local, Docker, remote) and use `systemctl` or `docker` where appropriate. Deferred while the scope is revised.
- An HTTP/SSE transport for long-running sidecars and remote clients.

The full design is in [`DESIGN.md`](https://github.com/homeCore-io/hc-mcp/blob/develop/DESIGN.md).
