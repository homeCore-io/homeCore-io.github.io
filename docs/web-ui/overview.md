---
id: overview
title: Web UI overview
sidebar_label: Overview
sidebar_position: 1
---

# Web UI overview

HomeCore ships with a bundled admin client — a single-page Leptos /
WebAssembly application served directly from the core server. It's
the default surface for day-to-day operation: dashboards, device
control, rule editing, plugin management, and audit review.

The web UI is API-first like everything else in HomeCore: every
action it performs is a documented REST or WebSocket call, so any
custom client (mobile, voice, dashboard hardware, scripts) can do
what the bundled UI does.

## Launching

The UI is served at the root path of the core server when
`[web_admin].enabled = true` in `homecore.toml`:

```toml
[web_admin]
enabled   = true
dist_path = "ui/dist"
```

Open `http://<host>:8080/` in a browser. API routes at `/api/v1/`
take priority over static file serving, and a SPA fallback returns
`index.html` for any unmatched path so client-side routing works.

For development, run `trunk serve` separately from the
`clients/hc-web-leptos/` directory; it proxies `/api` to the core on
port 8080.

## Authentication

Sign in with a username + password. The UI stores the issued JWT in
`localStorage`, decodes the expiry on startup, and silently redirects
to the login page when the token has expired. There's no flash of
"session expired" toast on stale tokens — they're dropped before the
first render.

Refresh tokens are handled transparently when configured.

## Layout

- **Topbar** — route-aware breadcrumb on the left, right-aligned
  controls (theme toggle, logout). Dark mode is persisted in
  `localStorage` and applied via `:root[data-theme="dark"]`.
- **Sidebar** — collapsible, reorderable navigation. The order is
  persisted per user in `localStorage`. Overview is first by default.
- **Main canvas** — the active page. Page transitions fade rather
  than flash; skeleton shimmers cover loading states.

## House Status hero

The Overview page leads with the **House Status hero** — a
full-width tile row that summarizes your home at a glance. Each
tile reads from the live device map and click-throughs to a
filtered devices view.

| Tile | Counts | Click target |
|---|---|---|
| **Lighting** | Lights and dimmers currently on | `/devices?focus=lighting` |
| **Climate** | Thermostat states | `/devices?focus=climate` |
| **Security** | Unlocked locks + open contact sensors | `/devices?focus=security` |
| **Battery** | Devices at or below threshold | `/devices?focus=battery&below=N` |
| **Media** | Playing or idle media players | `/devices?focus=media` |
| **Energy** | Total wattage from power monitors | `/devices?focus=energy` |
| **Activity** | WebSocket connection state | `/events` |

Tiles auto-hide when no relevant devices exist in the live device
map — a fresh install with no power monitors won't show the Energy
tile until one is registered.

The hero's tile set, layout (`wide` / `compact`), and visibility per
system are configurable through the dashboard editor. The Battery
tile reads its threshold from the server-side `[battery]` config
([Battery monitoring](../devices/battery-monitoring.md)) so the
hero count and click-through filter always match the rule engine's
view of the world.

### Security tagging

By default the Security tile considers all locks and contact sensors
"security relevant." On any device's detail page you can flip a
`security` tag to override that — only tagged devices are then
considered. Tags are stored client-side in `localStorage` (this is
the one piece of state the UI does not persist server-side).

## Devices page

A live grid of device cards organized into **area chapters** —
mono-uppercase headers grouping devices by their assigned area, with
counts, persistent collapse state, and a per-chapter "All off"
action that targets only currently-on lights and dimmers.

Card polish:

- Per-type accent rim
- Brightness halo (scaled to a `--card-brightness` CSS variable)
- Color reflection for color-capable lights (CIE xyY → sRGB)
- Command-pulse animation on click
- Press-depth on `:active`

### Focus filters

The `?focus={system}` query param filters the device list to a
specific system. Each focus mode includes a banner explaining what's
shown and a "Clear filter" affordance. When you click a hero tile
the URL is set automatically; you can also bookmark filtered views.

For battery, the URL also carries `&below=N` so the count and the
filter agree exactly.

## Rule editor

The typed rule editor at `/rules/{id}` walks you through
**Trigger → Conditions → Actions** as numbered steps with a
connecting hairline rail (the WHEN → IF → THEN flow). The header
splits the rule into Identity (name + enabled + tags) and Behavior
(priority / run-mode / cooldown).

Every trigger variant has a typed editor, including the
[battery triggers](../devices/battery-monitoring.md). When the typed
editor can't represent a rule (advanced JSON-only constructs), it
falls back to a raw-JSON view rather than dropping fields.

## Plugins page

Lists registered plugins with health, per-plugin command actions
(restart, deregister, plugin-specific commands), and a streaming
**ActionDrawer** that surfaces real-time output from
capability-driven plugin actions.

## Audit page

A filterable view of admin actions persisted in the audit log —
who changed what, when, from which IP. Useful for security reviews
and post-incident analysis.

## Other pages

- **Areas** — manage the area assignments used by device cards
- **Scenes** — list, activate, edit
- **Modes** — view and toggle named modes; check solar mode state
- **Events** — combined events / audit / logs troubleshooting surface
- **Glue** — configure timer, switch, and counter virtual devices
- **Admin** — user CRUD with all 7 preset roles + group management

## Customization beyond the bundled UI

The bundled UI is one client among several. The [API surface](../events/event-stream.md)
is the source of truth, and there are alternative clients in the
source tree exploring different approaches (React + TypeScript widget
platform, Dioxus, Svelte, Flutter). None of these are deprecated; pick
whichever fits your deployment.
