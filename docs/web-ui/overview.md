---
id: overview
title: Web UI overview
sidebar_label: Overview
sidebar_position: 1
---

# Web UI overview

**hc-web** is homeCore's web dashboard: a Flutter application built for
the browser, shipped as its own image and its own repository
([homeCore-io/hc-web](https://github.com/homeCore-io/hc-web)). It is the
default surface for day-to-day operation — the house, device control,
rules, plugins, and administration.

It is not built into core. Core serves the API and nothing else; hc-web's
container runs nginx, which serves the app and reverse-proxies `/api/v1/*`
— WebSocket streams included — to core. That proxy is load-bearing rather
than a convenience: the app calls `/api/v1` as a *relative* path and core
sends no CORS headers, so the API has to be same-origin with the app.

Everything the UI does is a documented REST or WebSocket call, so any other
client — [hc-tui](../tools/hc-tui.md), [hc-mcp](../tools/hc-mcp.md), a
script, a voice assistant — can do the same things.

## Getting it

The [Docker stack](../getting-started/docker.md) runs core and hc-web
together and is the intended way to deploy both:

```sh
git clone https://github.com/homeCore-io/docker.git homecore-docker
cd homecore-docker
mkdir homecore-data
docker compose up -d
```

Open `http://<host-ip>:3000` and log in with `admin` and the password in
`homecore-data/INITIAL_ADMIN_PASSWORD`.

To run it from source you need the Flutter SDK; `flutter run -d chrome`
from the hc-web checkout serves the app against a core you point it at.

## Authentication

Sign in with a username and password. The UI stores the issued JWT in
browser local storage, refreshes it transparently, and returns you to the
login page when the session ends.

Two consequences worth knowing:

- Changing a password **invalidates every token that user already holds**,
  in every browser. That is deliberate — see
  [Users & authentication](../administration/users-auth.md) — but it means
  changing your own password logs your other tabs out.
- Streaming endpoints take the token as a `?token=` query parameter,
  because a browser cannot set headers on a WebSocket upgrade.

## The surface

### Home

The landing page is the house itself, not a menu: rooms, with their
devices live and directly manipulable. Tap a light and it lights. Areas
order and collapse to taste, and **Arrange** edits the layout in place
against a working copy, so abandoning it leaves the saved arrangement
untouched.

### Pages

A page is a grid of widgets you edit *on the page* — drag the live cards,
add from the widget palette, configure in place. There is no separate
editor screen to navigate to and no draft to publish. Pages are stored
server-side, so every browser and every user sees the same one.

### Wall

`/wall` is a camera kiosk: a full-screen camera wall for a wall-mounted
tablet or display. The layout is chosen by the URL the display loads
rather than baked in — spotlight (one live stream, the rest as tappable
stills, so a small tablet copes), grid (all live), solo, or auto.

### Manage

Everything administrative lives under one route family with a section
rail, rather than as separate top-level destinations. The section is in
the URL, so deep links, reloads, and the command palette all land in the
same place.

**The house:** Automations · Devices · Scenes · Areas & rooms · Modes ·
Helpers · Media · Cameras · Events

**The system:** Plugins · System · Configuration · Notifications ·
Users & access · Data & backups · Maintenance · Audit · Logs

A few of those are worth calling out:

| Section | What it is |
|---|---|
| **Automations** | The typed rule editor — Trigger → Conditions → Actions. Every variant has a typed editor; a rule the typed editor can't represent falls back to raw JSON rather than dropping fields. Also import/export, groups, and tags. |
| **Devices** | Every device, its live state, its history, and its per-device settings. |
| **Plugins** | Install from the [signed registry](../plugins/overview.md), start/stop/restart, edit each plugin's config from a form the plugin itself describes, and read its **notices** — the plugin's own account of what is wrong (missing credentials, unreachable hub, nothing discovered yet). |
| **Configuration** | `homecore.toml` as a form, driven by core's config descriptor, so the fields stay in step with the server rather than being mirrored by hand. |
| **Users & access** | User CRUD across all seven roles. |
| **Data & backups** | Download a backup, restore one. |
| **Audit** | Who changed what, when, from which IP. |
| **Logs** | The live log tail, filterable by level and module — core's and every plugin's. |

## What each role sees

The UI hides what the API would refuse. A `read_only` account has no
Plugins or Audit section; a `device_operator` can drive devices but not
author automations. See
[Users & authentication](../administration/users-auth.md) for the full
table.

## Other clients

- [hc-tui](../tools/hc-tui.md) — terminal UI
- [hc-mcp](../tools/hc-mcp.md) — MCP server, for driving homeCore from an
  LLM
- `hc-cli` — ships with core, for scripting and same-host administration

## The retired built-in UI

Core used to bundle a Leptos/WebAssembly admin client and serve it from
its own root path. That client is retired; hc-web replaces it, and core
serves no UI of its own by default.

The `[web_admin]` config section still exists and still serves a directory
of static files at the root path when `enabled = true`. It is generic —
point it at any pre-built bundle — but the standard deployment leaves it
off and lets hc-web's nginx do the serving.
