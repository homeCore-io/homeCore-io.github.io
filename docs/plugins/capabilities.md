---
id: capabilities
title: Plugin Capabilities & Actions
sidebar_label: Capabilities & Actions
sidebar_position: 3
---

# Plugin Capabilities & Actions

Capabilities are how plugins tell HomeCore (and any UI / MCP client) what
plugin-specific commands they support. A plugin publishes a small JSON
manifest at startup; the admin UI reads it to render Actions buttons and
hc-mcp exposes the entries as tools so Claude can invoke them.

The framework is **data-driven**: adding a new action to a plugin
requires zero changes to HomeCore, the SDKs, the Leptos client, or
hc-mcp.

---

## What an action looks like

A plugin publishes a retained manifest once per session:

**Topic:** `homecore/plugins/{plugin_id}/capabilities`

```json
{
  "spec": "1",
  "plugin_id": "plugin.zwave",
  "actions": [
    {
      "id": "include_node",
      "label": "Include Z-Wave device",
      "description": "Put the controller in inclusion mode and add a new node.",
      "params": {},
      "result": { "nodes_added": { "type": "array" } },
      "stream": true,
      "cancelable": true,
      "concurrency": "single",
      "item_key": "node_id",
      "item_operations": ["add", "update"],
      "requires_role": "admin",
      "timeout_ms": 300000
    }
  ]
}
```

| Field | Required | Purpose |
|---|---|---|
| `spec` | yes | Manifest schema version. v1 is `"1"` (frozen). |
| `plugin_id` | yes | Must match the MQTT client id. |
| `actions[]` | yes | May be empty. |
| `actions[].id` | yes | Stable snake_case identifier; what the client calls. |
| `actions[].label` | yes | Human-readable button text. |
| `actions[].description` | no | Helper text shown under the button / in MCP. |
| `actions[].params` | no | JSON-schema-style map (subset only — see below). |
| `actions[].result` | no | Advisory shape of the success payload. |
| `actions[].stream` | no, default `false` | Whether the action emits stage events on a stream topic. |
| `actions[].cancelable` | no, default `false` | UI shows a Cancel button. |
| `actions[].concurrency` | no, default `multi` | `single` rejects a second invocation with `status:"busy"`. |
| `actions[].item_key` | no | Field inside `item.data` the UI dedupes by. |
| `actions[].item_operations` | no | Subset of `["add","update","remove"]`. |
| `actions[].requires_role` | no, default `user` | `admin` / `user` / `read_only`. Core enforces before forwarding. |
| `actions[].timeout_ms` | no | Streaming actions are auto-terminated after this. |

### Params schema subset

Only these JSON-Schema keywords are recognised in v1:
`type` (`"string" | "integer" | "number" | "boolean" | "array" | "object"`),
`default`, `enum`, `required`, `minimum`, `maximum`, `description`.

The Leptos UI auto-renders inputs for these types. Arrays and objects
fall back to a raw-JSON textarea.

---

## Sync vs. streaming

### Sync actions (`stream: false`)

A single request/response. The client POSTs the action and waits for the
plugin's reply.

```bash
curl -s -X POST http://localhost:8080/api/v1/plugins/plugin.yolink/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "rescan_devices"}'

# → {"status":"ok"}
```

### Streaming actions (`stream: true`)

Long-running flows that emit progress and item events. The POST returns
`{request_id, status: "accepted"}` immediately; the client opens an
SSE stream for stage events.

```bash
# 1. Kick off the action
RID=$(curl -s -X POST http://localhost:8080/api/v1/plugins/plugin.zwave/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "include_node"}' | jq -r .request_id)

# 2. Read live stages over SSE (auth via ?token= or Authorization)
curl -sN -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/v1/plugins/plugin.zwave/command/$RID/stream"
```

### The six stage vocabulary (frozen)

| Stage | Terminal? | Meaning |
|---|---|---|
| `progress` | no | UI updates the progress bar / status text. |
| `item` | no | Add / update / remove a row keyed by `item_key`. |
| `awaiting_user` | no | Emit a prompt; UI may show an inline form. |
| `warning` | no | Recoverable issue; flow continues. |
| `complete` | yes | Success terminal. Carries `data` matching `result`. |
| `error` | yes | Unrecoverable failure terminal. |

Two synthetic terminals are injected by core (not by plugins):

| Stage | Origin |
|---|---|
| `canceled` | Action's own `canceled()` call after the user clicks Cancel. |
| `timeout` | Core's manifest `timeout_ms` deadline expired with no terminal. |

### Stage envelope

Every stream event carries a stable shape:

```json
{
  "stage": "progress",
  "request_id": "ab12-…",
  "ts": "2026-04-25T14:00:00Z",
  "percent": 50,
  "label": "interviewing",
  "message": "Interviewing node 14"
}
```

Item events carry an `op` and `data`:

```json
{
  "stage": "item",
  "op": "update",
  "data": { "node_id": 14, "status": "ready", "manufacturer": "Aeotec" }
}
```

Awaiting-user prompts can include a `response_schema` to drive an
inline form:

```json
{
  "stage": "awaiting_user",
  "prompt": "Configure node 14 — set a name and area, or check Skip.",
  "response_schema": {
    "name": { "type": "string" },
    "area": { "type": "string" },
    "skip": { "type": "boolean", "default": false }
  }
}
```

The client replies with a `respond` command:

```bash
curl -s -X POST http://localhost:8080/api/v1/plugins/plugin.zwave/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "respond",
    "target_request_id": "'$RID'",
    "response": { "name": "Family Room Lamp", "area": "Living Room" }
  }'
```

`cancel` works the same way:

```bash
curl -s -X POST http://localhost:8080/api/v1/plugins/plugin.zwave/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "action": "cancel", "target_request_id": "'$RID'" }'
```

---

## In the Leptos admin UI

The plugin detail page renders a generic **Actions** card driven entirely
by the manifest:

- Non-streaming + no params → single **Run** button.
- Non-streaming + params → **Configure…** opens an inline form derived
  from the params schema.
- Streaming → **Run** opens an `<ActionDrawer/>` modal that POSTs the
  command, opens the SSE stream, and renders stages live: progress bar,
  awaiting-user banner with respond form, item list (one row per
  `item_key`, click to expand the full payload), warnings, terminal
  card.

The drawer is **generic** — the same component handles every plugin's
streaming actions. Plugin authors don't write any UI code.

---

## In hc-mcp

The MCP server exposes two tools that map straight to the framework:

- **`list_plugin_actions`** — flattens every plugin's manifest into one
  list. Always available (read-only).
- **`invoke_plugin_action(plugin_id, action, params)`** — POSTs the
  command for **non-streaming** actions and returns the response.
  Hard-fails on streaming actions (use the await variant instead).
  Write-gated behind `HC_MCP_ALLOW_WRITE=plugin_actions`.
- **`await_streaming_plugin_action(plugin_id, action, params, timeout_secs)`**
  — Phase 4b. POSTs a streaming action and consumes the SSE stream
  until a terminal stage, returning an aggregated summary
  `{stage, request_id, data, error, items, warnings,
  progress_history, elapsed_secs, event_count}`. Bounded by
  `timeout_secs` (default 90, max 600). Cannot respond to
  `awaiting_user` prompts — those are surfaced as warnings. Same
  write-gate as `invoke_plugin_action`.

See the [hc-mcp guide](../tools/hc-mcp) for setup.

---

## Adding actions to your plugin

See [Developing Plugins](./developing-plugins#capability-manifest) for
the SDK calls. The short version — Rust:

```rust
let mgmt = client
    .enable_management(60, Some(VERSION.into()), Some(config_path), Some(log_handle))
    .await?
    .with_capabilities(hc_types::Capabilities {
        spec: "1".into(),
        plugin_id: String::new(),  // SDK fills from configured plugin_id
        actions: vec![/* ... */],
    })
    .with_custom_handler(/* sync action dispatch */)
    .with_streaming_action(StreamingAction::new(
        "my_streaming_action",
        |ctx, params| async move { /* emit progress / items / complete */ },
    ));
```

---

## Frozen design decisions

These don't change without bumping `spec` to `"2"`:

1. The six stages are a closed set. Plugin-specific data goes in the
   `data` field, not in new stages.
2. `error` is **always terminal**. Recoverable retries emit `warning`
   and continue; only unrecoverable failures emit `error`.
3. `item.op` is one of `add`/`update`/`remove`. `item_key` is required
   when emitting `item` events.
4. Retained-last-event is the resilience floor — late SSE subscribers
   see the last cached envelope but no full history. The in-process
   StreamCache extends this with a short replay window so fast actions
   don't appear empty when the client is slow to connect.
5. `requires_role` is enforced by core **before** forwarding the
   command. Plugin code never has to check permissions.
6. Adding a new plugin action requires **zero** changes to core,
   SDKs, the Leptos UI, or hc-mcp.

The full spec lives in `pluginCapabilitiesPlan.md` at the repo root.
