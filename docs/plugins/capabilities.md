---
id: capabilities
title: Plugin Capabilities & Actions
sidebar_label: Capabilities & Actions
sidebar_position: 3
---

# Plugin Capabilities & Actions

A plugin tells homeCore which commands of its own it supports by publishing a
capability manifest: "Pair Hue bridge", "Include Z-Wave device", "Rescan
devices". The web app lists those actions on the plugin's page, and hc-mcp
offers them as tools. Adding an action to a plugin needs no change to
homeCore, the SDKs, the web app or hc-mcp.

The same manifest carries the plugin's settings schema and descriptor, the
kinds of alert it can raise, its own screens, and the REST scopes it wants.
This page covers the actions and the REST scopes. The rest is in
[Developing Plugins](./developing-plugins#configuration-schema-and-descriptor),
[Alerts from Plugins](./plugin-alerts) and [Screens and Cards](./plugin-screens).

## The manifest

The SDK publishes the manifest retained on
`homecore/plugins/{plugin_id}/capabilities` after each connect. homeCore
serves it at `GET /api/v1/plugins/{id}/capabilities`.

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
| `spec` | yes | Manifest version. Version 1 is `"1"` and is frozen. |
| `plugin_id` | yes | Must match the MQTT client id. The SDKs fill it in. |
| `actions[]` | yes | May be empty. |
| `api_scopes` | no | REST scopes the plugin wants for calling homeCore's API. See [The plugin's own REST access](#the-plugins-own-rest-access). |
| `actions[].id` | yes | Stable snake_case id. This is what a client calls. |
| `actions[].label` | yes | Button text. |
| `actions[].description` | no | Help text shown with the action in the app and in MCP. |
| `actions[].params` | no | A map of params in a subset of JSON Schema (below). |
| `actions[].result` | no | The shape of the success payload. Advisory only. |
| `actions[].stream` | no, default `false` | The action sends stage events on a stream. |
| `actions[].cancelable` | no, default `false` | The app offers Cancel while it runs. |
| `actions[].concurrency` | no, default `multi` | `single` refuses a second run of a streaming action while one is active (`status: "busy"`). |
| `actions[].item_key` | no | The field inside `item.data` that identifies a row. |
| `actions[].item_operations` | no | Any of `add`, `update`, `remove`. |
| `actions[].requires_role` | no, default `user` | `admin`, `user`, `read_only` or `signed_in`. See [Who may run an action](#who-may-run-an-action). |
| `actions[].timeout_ms` | no | How long homeCore waits for the plugin's reply. Without it, 5 seconds. For a streaming action it is also the deadline after which homeCore ends the stream with `timeout`. |
| `actions[].danger` | no, default `false` | The action can't be undone or interrupts the house (a reboot, unpairing, forgetting devices). Screens ask before running it. |

Declare a `timeout_ms` on every action. Five seconds is too short for most
actions that talk to hardware.

### Params

These JSON Schema keywords are recognized in a param: `type` (`string`,
`integer`, `number`, `boolean`, `array`, `object`), `default`, `enum`,
`required`, `minimum`, `maximum` and `description`.

The web app draws one input per param: a choice for an `enum`, a number field
for `integer` and `number`, a checkbox for `boolean` and a text field for
`string`. Arrays and objects get a JSON field. It also reads `title` as the
field's label and `x-options` as labels for `enum` values. It hides what is
typed into a string param marked `format: "password"` or `writeOnly`, or
whose name contains `password`, `secret` or `token`.

## Who may run an action

| `requires_role` | Who may run it |
|---|---|
| `user` (the default) | Callers with `plugins:write`: admins, and API keys that hold that scope. |
| `read_only` | The same on `command`. It also answers on `POST /api/v1/plugins/{id}/query`, which needs only `devices:read`. |
| `admin` | `plugins:write` and the admin role. |
| `signed_in` | Every signed-in person or API key, whatever their role, through `command` and `upload`. |

An action the manifest doesn't declare is treated like `user`. `signed_in` is
opt-in and never a default. Use it only for an action that is safe for anyone
in the house, or one that limits itself by who asked. The stream of a
`signed_in` action, and its `respond` and `cancel`, belong to whoever started
it and to admins.

Each SDK spells it its own way: `RequiresRole::SignedIn` in Rust
(`device_actions::Role::SignedIn` on a device action), `RequiresRole.SIGNED_IN`
in Python and Node.js, and `RequiresRole.SignedIn` in .NET.

### Who asked: `caller`

Every action homeCore forwards (`command`, `query` and `upload`) carries the
verified caller in its params:

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
role's wire name (`admin`, `user`, `household_member`, `read_only` and so
on). For an API key the role means nothing, so judge a key by `scopes`. `uid`
is null for the local transports and for a plugin's own key. homeCore drops
any `caller` the client put in the request, so a plugin can trust it.

homeCore checks `requires_role` before it forwards an action, so a plugin
never checks whether someone may run it. The plugin does have to check what
the action then does for that person. A `signed_in` action can be called by a
household member or a read-only account, so it must stay within
`caller.scopes`. An assistant that turns on a light for someone should do it
only if their scopes include `devices:command`.

How each SDK hands it over:

| SDK | Immediate action | Streaming action |
|---|---|---|
| Rust | `Caller::from_cmd(cmd)` in a custom or async handler | `ctx.caller()` |
| Python | a `caller=` keyword on `on_action` | `ctx.caller` |
| Node.js | the fourth argument of `onAction(action, params, ctx, caller)` | `ctx.caller` |
| .NET | `OnActionWithCaller` (its last argument) | `ctx.Caller` |

### The plugin's own REST access

A plugin that needs homeCore's REST API lists the scopes it wants in its
manifest's `api_scopes`. Each time the manifest is published (every start),
homeCore makes the plugin an API key with those scopes and sends it with the
`api_access` management action, params `{url, key, scopes}`.

- `url` is homeCore's REST base as the plugin reaches it, ending in
  `/api/v1`: loopback for a plugin homeCore runs, or the address its
  [runtime](./runtimes) was added with.
- `users:write` and `api_keys:admin` are never granted, so check `scopes`
  instead of assuming you got everything.
- A new key replaces the previous one, which stops working. The key is
  deleted when the plugin is uninstalled, and also when the plugin doesn't
  answer `api_access`. Keep it in memory only.
- A key for a plugin that homeCore runs on its own machine works only from
  that machine.
- The key shows in the API keys list as `plugin <id>`, and in the audit log
  as `api_key:plugin <id>`.

There is nothing to paste. Every SDK answers `api_access` itself and keeps the
grant, with its key kept out of logs:

| SDK | Ask for scopes | Read the grant | Wait for it | Hear each new one |
|---|---|---|---|---|
| Rust (0.6.5, core v0.1.113 and later) | `Capabilities { api_scopes, .. }` | `mgmt.api_access()` | `mgmt.wait_for_api_access(timeout)` | `with_api_access_handler`, `api_access_updates()` |
| Python | `Capabilities(api_scopes=[...])` | `self.api_access` | `wait_for_api_access(timeout)` | override `on_api_access(url, key, scopes)` |
| Node.js | `new Capabilities({ apiScopes })` | `this.apiAccess` | `waitForApiAccess(timeoutMs)` | override `onApiAccess(url, key, scopes)` |
| .NET | `Capabilities.ApiScopes` | `client.ApiAccess` | `WaitForApiAccessAsync(...)` | `OnApiAccess` |

The [Assistant](../tools/hc-mcp) is a working example. It asks for the scopes
its tools need and acts for each person within that person's scopes.

## Sync and streaming actions

### Sync actions (`stream: false`)

The client POSTs the action and waits for the plugin's single reply.

```bash
curl -s -X POST http://localhost:8080/api/v1/plugins/plugin.yolink/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "rescan_devices"}'

# → {"status":"ok"}
```

Whatever the plugin replies comes back with HTTP 200, including its own
`status: "error"`. homeCore returns 504 only when the plugin doesn't answer
within the action's `timeout_ms`.

A `read_only` action that doesn't stream can also run through
`POST /api/v1/plugins/{id}/query`, which needs only permission to read
devices. homeCore refuses anything else on that path. Use it for catalogs and
status that a plugin's screens read.

### Files sent to an action

`POST /api/v1/plugins/{id}/upload/{action}` sends a file of up to 32 MiB to an
action, such as a firmware image or a backup to restore. The action's role
applies. The SDK receives the file in pieces and runs the action with a local
`file_path` param, then removes the file once the action has replied. Query
parameters arrive as params, as strings. Only the Rust SDK supports this so
far; see [Developing Plugins](./developing-plugins#files-sent-to-an-action).

### Streaming actions (`stream: true`)

These are for long flows that report progress and items. The POST returns
`{request_id, status: "accepted", stream_topic}` as soon as the plugin
accepts the action. The client then opens an SSE stream for the stage events.

```bash
# 1. Start the action
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

### The six stages

| Stage | Ends the run? | Meaning |
|---|---|---|
| `progress` | no | Update the progress bar or status text. |
| `item` | no | Add, update or remove a row keyed by `item_key`. |
| `awaiting_user` | no | Ask the person something. The app may show a small form. |
| `warning` | no | A problem the flow recovered from. It continues. |
| `complete` | yes | Success. Carries `data` in the shape of `result`. |
| `error` | yes | A failure the flow can't recover from. |

Two more stages end a run:

| Stage | Where it comes from |
|---|---|
| `canceled` | The action itself, once it has seen the cancel request and cleaned up (`ctx.canceled()` in Rust). The SDK doesn't send it for you. |
| `timeout` | homeCore, when `timeout_ms` passes with no ending stage. |

homeCore also ends every active stream with an `error` stage
(`data.reason: "plugin_offline"`) when the plugin goes offline. If a Rust
action returns without an ending stage, the SDK sends an `error` with
`data.reason: "plugin_dropped_stream"`.

### The stage envelope

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

`progress` and `awaiting_user` can also carry `data` for a plugin's own
screen. Item events carry an `op` and `data`:

```json
{
  "stage": "item",
  "op": "update",
  "data": { "node_id": 14, "status": "ready", "manufacturer": "Aeotec" }
}
```

An `awaiting_user` prompt can include a `response_schema`, which the app turns
into a small form:

```json
{
  "stage": "awaiting_user",
  "prompt": "Configure node 14: set a name and area, or check Skip.",
  "response_schema": {
    "name": { "type": "string" },
    "area": { "type": "string" },
    "skip": { "type": "boolean", "default": false }
  }
}
```

The client answers with a `respond` command:

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

### When a single-run action is busy

When a `concurrency: single` streaming action is already running, a second
POST gets HTTP 409 with
`{status: "busy", active_request_id: "...", stream_topic: "..."}`. The web app
says the plugin is already doing it and follows the active run, so you can
watch or cancel it. Nothing retries on its own. An API client can cancel the
active run by POSTing `{action: "cancel", target_request_id: "..."}` with the
returned id.

### Ask at the end of a batch

In a flow where each item needs an answer from the person (Z-Wave's
`include_node` asks for a name and area for each node it included), send the
questions after the batch, not in the middle of it. A mid-stream
`awaiting_user` would interleave with a question that stays open for the
whole run (a "Done" button, say), and the SDK can't tell which question a
`respond` answers.

The Z-Wave include flow does it this way. It collects the nodes whose
interview finished during the inclusion window. When the person presses
**Done**, it asks about each node in turn and applies the answers
(`node.set_name`, `node.set_location`) before the run's ending stage.

## In the web app

The plugin's page in Settings › Plugins lists its actions under **Actions**,
built from the manifest. The list appears for people who may change plugins
(`plugins:write`). `admin` actions are left out for everyone else, and
`signed_in` actions are never on the list. A plugin that brings
[its own page](./plugin-screens) shows that page instead.

Opening an action shows a field for each param and a **Run** button (**Start**
for a streaming action). The app asks for confirmation first when the action
is marked `danger` or its id starts with `remove`, `delete`, `forget`,
`unpair`, `reset`, `factory` or `reboot`.

A sync action's reply is shown in place: a `message` or `result` string as
is, anything else as labeled lines. A streaming action shows its state
(working, waiting for you, done, didn't work, canceled, took too long), a
progress bar while `percent` is known, and **Cancel** if the action is
`cancelable`. Progress and warning messages build up as a log. An
`awaiting_user` question becomes a small form with a **Send** button. Items
appear as a list, one row per `item_key`, showing the item's `name` or
`label` (else its key) and its `status`. The `complete` data is shown as
labeled lines at the end.

You can leave the page while a streaming action runs. It keeps going, and the
page picks it up again when you come back.

A plugin's own screens run actions through `host.action`, `host.query`,
`host.stream` and `host.upload`. See [Screens and Cards](./plugin-screens#the-host).

## In hc-mcp

The MCP server has three tools for plugin actions:

- `list_plugin_actions` flattens every plugin's manifest into one list. It is
  always available.
- `invoke_plugin_action(plugin_id, action, params)` runs a sync action and
  returns the reply. It refuses streaming actions.
- `await_streaming_plugin_action(plugin_id, action, params, timeout_secs)`
  starts a streaming action and reads the stream until it ends, then returns
  a summary:
  `{stage, request_id, data, error, items, warnings, progress_history, elapsed_secs, event_count}`.
  `timeout_secs` defaults to 90, at most 600. It can't answer `awaiting_user`
  questions; it reports them as warnings.

The last two change things, so they are off until you allow them with
`HC_MCP_ALLOW_WRITE=plugin_actions` (or `all`). See the
[hc-mcp guide](../tools/hc-mcp) for setup.

## Adding actions to your plugin

[Developing Plugins](./developing-plugins#capability-manifest) shows the SDK
calls. In short, in Rust:

```rust
let mgmt = client
    .enable_management(60, Some(VERSION.into()), Some(config_path), None)
    .await?
    .with_capabilities(plugin_sdk_rs::types::Capabilities {
        spec: "1".into(),
        actions: vec![/* ... */],
        ..Default::default() // plugin_id is filled in by the SDK
    })
    .with_custom_handler(/* sync action dispatch */)
    .with_streaming_action(StreamingAction::new(
        "my_streaming_action",
        |ctx, params| async move { /* emit progress / items / complete */ },
    ));
```

## Rules that don't change in spec 1

These hold until `spec` becomes `"2"`:

1. The six stages are a closed set. Plugin-specific data goes in `data`, not
   in new stages.
2. `error` always ends the run. A retry the plugin recovers from is a
   `warning`.
3. `item.op` is `add`, `update` or `remove`, and `item_key` is required when
   sending `item` events.
4. Stage events are published retained, and the plugin clears the retained
   event when the action ends, so a late subscriber never sees an old ending.
   So that a fast action doesn't look empty to a client that connects late,
   homeCore keeps each stream's events in memory (up to 256 per run, for 60
   seconds after it ends) and replays them to an SSE client that attaches
   late.
5. homeCore enforces `requires_role` before it forwards the command. A
   `signed_in` action still has to keep what it does within `caller.scopes`.
6. Adding an action needs no change to homeCore, the SDKs, the web app or
   hc-mcp.

The types are in `crates/hc-types/src/plugin_capabilities.rs` in the homeCore
repository.
