---
id: capabilities
title: Plugin Capabilities & Actions
sidebar_label: Capabilities & Actions
sidebar_position: 3
---

# Plugin Capabilities & Actions

Capabilities are how a plugin tells HomeCore, and any UI or MCP client, which
plugin-specific commands it supports. The plugin publishes a small JSON
manifest when it connects. The web UI reads it to list the plugin's actions,
and hc-mcp exposes the entries as tools so Claude can call them.

Everything is driven by the manifest. Adding an action to a plugin needs no
change to HomeCore, the SDKs, the web UI or hc-mcp.

---

## What an action looks like

A plugin publishes a retained manifest after each connect:

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
| `api_scopes` | no | REST scopes the plugin wants for calling homeCore's own API. homeCore mints it a key with them; see [The plugin's own REST access](#the-plugins-own-rest-access). |
| `actions[].id` | yes | Stable snake_case identifier; what the client calls. |
| `actions[].label` | yes | Human-readable button text. |
| `actions[].description` | no | Helper text shown with the action in the UI and in MCP. |
| `actions[].params` | no | JSON-schema-style map (a subset only, see below). |
| `actions[].result` | no | Advisory shape of the success payload. |
| `actions[].stream` | no, default `false` | Whether the action emits stage events on a stream topic. |
| `actions[].cancelable` | no, default `false` | The UI offers Cancel while it runs. |
| `actions[].concurrency` | no, default `multi` | `single` rejects a second run of a streaming action while one is active (`status:"busy"`). |
| `actions[].item_key` | no | Field inside `item.data` the UI dedupes by. |
| `actions[].item_operations` | no | Subset of `["add","update","remove"]`. |
| `actions[].requires_role` | no, default `user` | `admin` / `user` / `read_only` / `signed_in`. Who may run it; core enforces it before forwarding. See [Who may run an action](#who-may-run-an-action). |
| `actions[].timeout_ms` | no | How long core waits for the plugin's reply (5 seconds when absent). For a streaming action it is also the deadline after which core ends the stream with `timeout`. |
| `actions[].danger` | no, default `false` | The action can't be undone or interrupts the house (a reboot, unpairing, forgetting devices). Screens ask before running it. |

The Rust SDK also adds the plugin's `config_schema`, `config_descriptor`,
`alert_kinds` and `ui` (its own screens) to the same manifest when the plugin
declares them.

### Params schema subset

Only these JSON-Schema keywords are recognised in v1:
`type` (`"string" | "integer" | "number" | "boolean" | "array" | "object"`),
`default`, `enum`, `required`, `minimum`, `maximum`, `description`.

The web UI draws an input for each param: a choice for an `enum`, a number
field for `integer` and `number`, a checkbox for `boolean`, and a text field
for `string`. Arrays and objects get a JSON field. It also reads a `title` as
the field's label, `x-options` as labels for `enum` values, and hides the text
of a string param marked `format: "password"` or `writeOnly`, or whose name
contains `password`, `secret` or `token`.

---

## Who may run an action

| `requires_role` | Who may run it |
|---|---|
| `user` (the default) | Callers with `plugins:write`, which in practice means admins and keys that hold that scope. |
| `read_only` | The same on `command`. It also answers on `POST /api/v1/plugins/{id}/query`, which needs only permission to read devices. |
| `admin` | `plugins:write` and the admin role. |
| `signed_in` | Every signed-in person or API key, whatever their role, through `command` and `upload`. |

An action the manifest doesn't declare is treated like `user`. `signed_in` is
opt-in and never a default: use it only for an action that is safe for anyone
in the house, or one that limits itself by who asked. The stream of a
`signed_in` action, and its `respond` and `cancel`, belong to whoever started
it (and to admins).

### Who asked: `caller`

Every action core forwards (`command`, `query` and `upload`) carries the
verified caller:

```json
{
  "uid": "8f1c…",
  "username": "sam",
  "role": "household_member",
  "scopes": ["devices:read", "devices:command", "…"],
  "kind": "user"
}
```

`kind` is `user`, `api_key`, `local_admin` or `whitelist`. `role` is the
role's wire name. For an API key the role is advisory and `scopes` is what
the key may do, so judge by `scopes`. `uid` is null for the local transports
and for a plugin's own key. Core drops any `caller` the client put in the
request, so a plugin can trust it.

Core checks `requires_role` before forwarding, so a plugin never has to check
whether someone may run the action. It does have to check what the action
then does for them. A `signed_in` action can be called by a household member
or a read-only account, so it must stay within `caller.scopes`: an assistant
that turns on a light for someone should do it only if their scopes include
`devices:command`.

Core puts `caller` in the action's params. The Python, Node.js and .NET SDKs
take it out and hand it to the handler on its own (`caller` / `ctx.caller`
in Python and Node.js, `Caller` / `ctx.Caller` in .NET). A Rust plugin reads
it from the params (`params["caller"]`).

### The plugin's own REST access

A plugin that needs homeCore's REST API lists the scopes it wants in its
manifest's `api_scopes`. Each time the manifest is published (every start),
homeCore makes the plugin an API key with those scopes and sends it with the
`api_access` management action, params `{url, key, scopes}`:

- `url` is homeCore's REST base as the plugin reaches it, ending in
  `/api/v1`: loopback for a plugin homeCore runs, or the address its
  [runtime](./runtimes) was added with.
- `users:write` and `api_keys:admin` are never granted, so check `scopes`
  rather than assuming you got everything.
- The previous key stops working when a new one is made, and the key is
  deleted when the plugin is uninstalled. Keep it in memory only. A plugin
  that doesn't answer `api_access` has its key deleted.
- A key for a plugin homeCore runs on its own machine only works from
  loopback.
- The key shows in the API keys list as `plugin <id>`, and in the audit log
  as `api_key:plugin <id>`.

There is nothing to paste. Every SDK answers `api_access` for you and keeps
the grant: `api_access()` / `wait_for_api_access` on the management handle in
Rust (0.6.5, core v0.1.113 and later), `api_access` / `wait_for_api_access` in
Python, `apiAccess` / `waitForApiAccess` in Node.js, and `ApiAccess` /
`WaitForApiAccessAsync` in .NET, each with a hook that runs when it arrives
(`with_api_access_handler` in Rust). The
[Assistant](../tools/hc-mcp) is a working example: it asks for the scopes its
tools need and acts for each person within their own scopes.

---

## Sync vs. streaming

### Sync actions (`stream: false`)

A single request and response. The client POSTs the action and waits for the
plugin's reply.

```bash
curl -s -X POST http://localhost:8080/api/v1/plugins/plugin.yolink/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "rescan_devices"}'

# → {"status":"ok"}
```

Whatever the plugin replies, including its own `status: "error"`, comes back
with HTTP 200. Core returns 504 only when the plugin doesn't answer within the
action's `timeout_ms`.

A `read_only` action can also be run with `POST /api/v1/plugins/{id}/query`,
which only needs permission to read devices. Core refuses anything on that
path that the manifest does not declare `read_only`.

### Streaming actions (`stream: true`)

Long-running flows that emit progress and item events. The POST returns
`{request_id, status: "accepted", stream_topic}` as soon as the plugin
accepts the action, and the client opens an SSE stream for the stage events.

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

The plugin publishes the stages on
`homecore/plugins/{plugin_id}/commands/{request_id}/events`.

### The six stage vocabulary (frozen)

| Stage | Terminal? | Meaning |
|---|---|---|
| `progress` | no | UI updates the progress bar / status text. |
| `item` | no | Add / update / remove a row keyed by `item_key`. |
| `awaiting_user` | no | Emit a prompt; UI may show an inline form. |
| `warning` | no | Recoverable issue; flow continues. |
| `complete` | yes | Success terminal. Carries `data` matching `result`. |
| `error` | yes | Unrecoverable failure terminal. |

Two more terminal stages exist outside the six:

| Stage | Origin |
|---|---|
| `canceled` | Emitted by the action itself (`ctx.canceled()` in Rust) once it has seen the cancel request and cleaned up. The SDK does not send it for you. |
| `timeout` | Injected by core when the manifest's `timeout_ms` passes with no terminal stage. |

Core also ends every active stream with an `error` stage
(`data.reason: "plugin_offline"`) when the plugin goes offline. If a Rust
action returns without emitting a terminal stage, the SDK sends an `error`
(`data.reason: "plugin_dropped_stream"`).

### Stage envelope

Every stream event has the same shape:

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

An `awaiting_user` prompt can include a `response_schema` to drive an
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

## In the web UI

The plugin's page in Settings › Plugins lists its actions under **Actions**,
built entirely from the manifest. The list appears for people who may change
plugins (`plugins:write`); `admin` actions are left out for everyone else. A
plugin that brings [its own page](./plugin-screens) shows that instead.

Opening an action shows a field for each param and a **Run** button (**Start**
for a streaming action). An action marked `danger`, or whose id starts with
`remove`, `delete`, `forget`, `unpair`, `reset`, `factory` or `reboot`, asks
for confirmation first.

- A sync action's reply is shown in place: a `message` or `result` string as
  it is, anything else as labelled lines rather than raw JSON.
- A streaming action shows its state (working, waiting for you, done, didn't
  work, cancelled, took too long), a progress bar while `percent` is known,
  and a **Cancel** button if the action is `cancelable`. Progress and warning
  messages build up as a log. An `awaiting_user` prompt becomes a small form
  with a **Send** button. Items appear as a list, one row per `item_key`,
  showing the item's `name` or `label` (else its key) and its `status`. The
  `complete` data is shown as labelled lines at the end.

You can leave the page while a streaming action runs. It keeps going, and the
page picks it up again when you come back.

### Busy → cancel pattern

When a `concurrency: single` streaming action is already running, a second
POST gets HTTP 409 with
`{status: "busy", active_request_id: "...", stream_topic: "..."}`. The web UI
says the plugin is already doing it and starts following the active run, so
you can watch it or cancel it from there. Nothing retries automatically. A
client of the API can cancel the active run by POSTing
`{action: "cancel", target_request_id: "..."}` with the returned id.

### awaiting_user: prompt at the end of the batch

In a multi-item flow where each item needs input from the person (Z-Wave's
`include_node` asking for a name and area for each node it included, say),
send the prompts **at the end of the batch** rather than mid-stream. A
mid-stream `awaiting_user` would interleave with any prompt that stays open
for the whole run (such as a "Done" gate), and the SDK can't tell which
prompt a `respond` answers.

The Z-Wave include flow is the reference. It collects the nodes whose
interview finished during the inclusion window, then goes through them when
the person presses **Done**, emitting one `awaiting_user_with_schema` per
node. It applies the answers (`node.set_name` / `node.set_location`) before
the action's terminal stage.

---

## In hc-mcp

The MCP server exposes three tools that map directly onto the framework:

- **`list_plugin_actions`** flattens every plugin's manifest into one list.
  Always available (read-only).
- **`invoke_plugin_action(plugin_id, action, params)`** POSTs the command for
  a **non-streaming** action and returns the response. It refuses streaming
  actions; use the await variant for those. Write-gated behind
  `HC_MCP_ALLOW_WRITE=plugin_actions`.
- **`await_streaming_plugin_action(plugin_id, action, params, timeout_secs)`**
  POSTs a streaming action and reads the SSE stream until a terminal stage,
  then returns a summary:
  `{stage, request_id, data, error, items, warnings, progress_history, elapsed_secs, event_count}`.
  It is bounded by
  `timeout_secs` (default 90, max 600). It can't answer `awaiting_user`
  prompts; those are reported as warnings. Same write gate as
  `invoke_plugin_action`.

`HC_MCP_ALLOW_WRITE=all` also satisfies the gate. See the
[hc-mcp guide](../tools/hc-mcp) for setup.

---

## Adding actions to your plugin

See [Developing Plugins](./developing-plugins#capability-manifest) for
the SDK calls. In short, in Rust:

```rust
let mgmt = client
    .enable_management(60, Some(VERSION.into()), Some(config_path), Some(log_handle))
    .await?
    .with_capabilities(plugin_sdk_rs::types::Capabilities {
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
4. Stage events are published retained, and the plugin clears the retained
   event once the action ends, so a late subscriber never sees a stale
   terminal. To keep fast actions from looking empty when the client is slow
   to connect, core caches each stream's events in memory (up to 256 per
   request, kept for 60 seconds after the terminal stage) and replays them to
   an SSE client that attaches late.
5. `requires_role` is enforced by core **before** forwarding the
   command, so plugin code never checks who may run an action. A
   `signed_in` action still has to keep what it does within
   `caller.scopes`.
6. Adding a new plugin action requires **zero** changes to core,
   SDKs, the web UI, or hc-mcp.

The types are defined in `crates/hc-types/src/plugin_capabilities.rs` in the
homeCore repository.
