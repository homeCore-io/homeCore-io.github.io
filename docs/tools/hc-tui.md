---
id: hc-tui
title: hc-tui — Terminal UI
sidebar_label: hc-tui (Terminal UI)
sidebar_position: 2
---

# hc-tui

`hc-tui` is a keyboard-driven terminal UI for HomeCore — built with
Rust and `ratatui`. It connects to the same REST + WebSocket API as
the bundled web admin and is the right surface for SSH sessions,
headless boxes, and anyone who'd rather not leave the terminal.

The repo lives at [homeCore-io/hc-tui](https://github.com/homeCore-io/hc-tui).

---

## When to reach for the TUI

| Scenario | Use |
|---|---|
| Quick device toggle from an SSH session | `hc-tui` |
| Demoing automations on a screen-shared call | Web UI (richer visuals) |
| Editing a complex rule with many conditions | Web UI (typed editor) |
| Triaging a flood of events on a remote box | `hc-tui` (low-overhead live stream) |
| Commissioning a Matter device from the command line | `hc-tui` (Manage → Matter) |

The TUI and web UI hit the same endpoints, so anything you do in one
shows up live in the other.

---

## Running

```bash
hc-tui --base-url http://127.0.0.1:8080 --cache-dir ~/.cache/hc-tui
```

- `--base-url` points at the HomeCore server **without** the `/api/v1`
  suffix.
- `--cache-dir` stores per-user JSON snapshots so subsequent launches
  paint instantly while live data syncs.

A login screen appears first. Sign in with the same credentials you'd
use on the web UI; the TUI persists the JWT in the cache directory.

---

## Layout

The main UI is a tab strip across the top, with a status line at the
bottom. The visible tab set depends on your role:

- **`user` / `read_only`** — Devices, Dashboards, Scenes, Areas,
  Automations, Events
- **`admin`** — adds Users, Plugins, and a Manage section
  (Matter commissioning, Logs)

A live event subscription on `/api/v1/events/stream` keeps state
fresh; if the connection drops the TUI auto-reconnects without
intervention. The terminal redraw path is event-driven — idle screens
do not continuously repaint, so leaving the TUI open does not burn
CPU.

---

## Key bindings

### Login screen

| Key | Action |
|---|---|
| `Tab` | Switch field |
| `Enter` | Submit login |
| `Esc` | Quit |

### Main UI

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Switch tabs |
| `j` / `k` (or `Down` / `Up`) | Move selection |
| `r` | Refresh data from the server |
| `q` | Quit |

### Devices tab

| Key | Action |
|---|---|
| `t` | Toggle selected device (lights/switches: on/off; media players: play/stop, falling back to pause if stop is unsupported) |
| `e` | Edit metadata (name, area, canonical name) — admin only |
| `/` | Filter (matches name, `device_id`, and `canonical_name`) |

The Devices tab has a dedicated **Media Players** sub-tab with
generic transport controls:

| Key | Action |
|---|---|
| `p` | Play / pause |
| `x` | Stop |
| `n` / `b` | Next / previous track |
| `+` / `-` | Volume up / down |
| `m` | Mute toggle |

### Scenes tab

| Key | Action |
|---|---|
| `a` | Activate selected scene |

### Dashboards tab

| Key | Action |
|---|---|
| `Enter` | Inspect selected dashboard summary |

### Manage → Matter (admin only)

| Key | Action |
|---|---|
| `c` | Open commission form (pairing code, optional name / room / discriminator / passcode) |
| `r` | Refresh node inventory |
| `i` | Reinterview selected node |
| `d` | Remove selected node |

### Manage → Logs (admin only)

The live log WebSocket is opened only when you actually visit this
panel — closing the panel closes the stream. Filter controls let you
narrow by level and module.

---

## Caching behaviour

- On login, the TUI loads cached state and config first (if present),
  then syncs fresh data from HomeCore. This makes subsequent launches
  feel instant on slow links.
- Manual refresh (`r`) pulls fresh data and updates the cache.
- After any device or scene action, the TUI re-fetches and re-caches
  the affected slice.
- There is no background polling loop; live updates come from the
  event stream WebSocket.
- Dashboard sync accepts both flat and wrapped API response shapes.
  If a dashboard fetch fails, the TUI keeps working and surfaces a
  per-dashboard warning in the status line rather than blanking the
  list.

---

## Endpoints used

The TUI is API-only; it does not depend on internal types or the
admin UDS. All operations go through documented `/api/v1` endpoints,
so anything the TUI can do, a custom client can do too.

```
POST /auth/login                    # login
GET  /auth/me                       # role + scope inspection

GET  /devices                       # device list
PATCH /devices/{id}/state           # toggle / control
GET  /dashboards                    # dashboard list
GET  /scenes
POST /scenes/{id}/activate
GET  /areas
GET  /automations
GET  /events?limit=...

GET  /auth/users                    # admin
GET  /plugins                       # admin

POST /plugins/matter/commission     # admin
GET  /plugins/matter/nodes
POST /plugins/matter/reinterview
DELETE /plugins/matter/nodes/{id}

WS   /events/stream?token=...       # live state updates
WS   /logs/stream                   # admin, when Manage → Logs is open
```

---

## Comparison with the web UI

| Feature | Web UI | TUI |
|---|---|---|
| Device control | yes | yes |
| Scene activation | yes | yes |
| Live event stream | yes | yes |
| Typed rule editor | yes | read-only list |
| Plugin streaming actions | yes (ActionDrawer) | no |
| Dashboards | full editor + hero | read-only summary |
| Audit log | yes | no |
| Matter commissioning | no | yes (Manage → Matter) |
| Live log streaming | yes (`/logs/stream`) | yes (Manage → Logs, on-demand) |
| Backup / restore | yes | no |
| Mobile-friendly | yes (responsive) | no (terminal) |
| Works over plain SSH | no | yes |

If you need rule editing, audit review, dashboards, or backups, use
the [web UI](../web-ui/overview.md). For everything else — and especially
remote / headless administration — the TUI is the lower-overhead
choice.
