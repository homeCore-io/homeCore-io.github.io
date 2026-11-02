---
id: hc-tui
title: "hc-tui: Terminal UI"
sidebar_label: hc-tui (Terminal UI)
sidebar_position: 2
---

# hc-tui

`hc-tui` is a keyboard-driven terminal UI for HomeCore, written in Rust with `ratatui`. It talks to the same REST and WebSocket API as the [web app](../web-ui/overview.md), which makes it handy over SSH, on headless machines, and for anyone who would rather stay in the terminal.

The repo lives at [homeCore-io/hc-tui](https://github.com/homeCore-io/hc-tui). Tagged releases publish a statically linked Linux x86_64 binary as a `.tar.gz`; you can also build it from source with `cargo build --release`.

:::caution Being reworked
HomeCore 0.1.82 removed the `/timers` and `/switches` endpoints in favour of `/glue`. hc-tui's Switches and Timers sub-tabs still use the old endpoints, so they stay empty and can't create anything, and its helper creator (`g` in Manage) doesn't create helpers either. Create and manage helpers in the web app (**Settings → Helpers**) or with the [`/glue` API](../devices/virtual-devices.md#managing-helpers) until hc-tui catches up.
:::

---

## When to reach for the TUI

| Scenario | Use |
|---|---|
| Quick device toggle from an SSH session | `hc-tui` |
| Showing automations on a screen-shared call | Web app (richer visuals) |
| Writing or editing a rule | Web app (rule editor) |
| Triaging a flood of events or logs on a remote box | `hc-tui` (low-overhead live stream) |
| Commissioning a Matter device from the command line | `hc-tui` (Manage → Matter) |

Both talk to the same endpoints, so anything you do in one shows up live in the other.

---

## Running

```bash
hc-tui --base-url http://127.0.0.1:8080 --cache-dir ~/.cache/hc-tui
```

| Flag | Default | Description |
|---|---|---|
| `--base-url` | `http://127.0.0.1:8080` | The HomeCore server, **without** the `/api/v1` suffix |
| `--cache-dir` | `./cache` | Where per-user JSON snapshots and the saved session go |
| `--config` | `config/config.toml` | Optional config file |

Flags override the config file, and the file is optional:

```toml
[server]
base_url = "http://127.0.0.1:8080"   # without /api/v1

[cache]
dir = "./cache"

[session]
# Save the JWT to {cache_dir}/session.json and skip the login screen while it is valid.
persist_token = true

# Optional: log in automatically when the saved token is missing or expired.
#[auto_login]
#username = "admin"
#password = "..."
```

Without a valid saved session, a login screen appears first. Sign in with the same credentials you use in the web app. The config file can hold a password, so keep it private.

---

## Layout

The main screen is a row of tabs across the top with a status line at the bottom:

**Devices · Scenes · Areas · Rules · Plugins · Manage**

Plugins appears only for admins. Manage appears for everyone, but most of its panels use admin-only endpoints, so other roles get HomeCore's refusal there.

A live subscription to `/api/v1/events/stream` keeps device state, availability and names current, and reconnects by itself if the connection drops. Screens redraw only when something changes, so leaving the TUI open doesn't burn CPU.

---

## Key bindings

### Login screen

| Key | Action |
|---|---|
| `Tab` | Switch field |
| `Enter` | Submit login |
| `Esc` | Quit |

### Everywhere

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Next / previous tab |
| `1` to `9` | Jump to a tab |
| `j` / `k` (or `Down` / `Up`) | Move selection |
| `r` | Refresh from the server |
| `T` | Show times in UTC or local time |
| `q` | Quit |

### Devices tab

`Left` / `Right` switch between the **All**, **Media Players**, **Switches** and **Timers** sub-tabs.

On **All**:

| Key | Action |
|---|---|
| `t` | Toggle the selected device (lights and switches on/off; media players play/stop, falling back to pause if stop isn't supported) |
| `Space` | Lock/unlock a lock, or toggle a switch |
| `l` / `u` | Lock / unlock |
| `+` / `-` | Brightness up / down |
| `Enter` | Edit name, area and canonical name |
| `d` | Delete the device |
| `/` | Search (matches name, `device_id` and `canonical_name`) |
| `f` | Filter: all, online, offline, low battery |
| `s` | Sort: name, status, last seen |
| `v` | Grouped or flat list |

On **Media Players**, with generic transport controls:

| Key | Action |
|---|---|
| `p` | Play / pause |
| `x` | Stop |
| `n` / `b` | Next / previous track |
| `+` / `-` | Volume up / down |
| `m` | Mute toggle |
| `Enter` | Edit metadata |

### Scenes tab

| Key | Action |
|---|---|
| `a` | Activate the selected scene |

### Areas tab

Two panes: the areas, and the devices in the selected one.

| Key | Action |
|---|---|
| `n` | New area |
| `Enter` | Edit the selected area |
| `d` | Delete the selected area |

### Rules tab

| Key | Action |
|---|---|
| `Enter` | Open the rule's detail view with its RON (`j`/`k`, `PageUp`/`PageDown` scroll; `Esc` back) |
| `e` / `d` | Enable / disable |
| `Space` | Select several rules; then `e` enables them all and `D` disables them all |
| `c` | Clone |
| `x` / `Delete` | Delete, after a `y`/`n` confirmation |
| `h` | Recent firing history |
| `f` | Filter bar: tag, trigger type, stale |
| `s` | Show only rules with stale device references |
| `g` | Rule groups: enable (`e`), disable (`d`) or delete (`x`) a group |
| `Esc` | Close history, or clear the selection |

The TUI has no rule editor; write rules in the web app.

### Plugins tab (admin)

| Key | Action |
|---|---|
| `Enter` | Open the plugin's detail view |
| `d` | Deregister the plugin |

In the detail view, `1` to `4` (or `Left`/`Right`) switch between **Overview**, **Actions**, **Diagnostics** and **Metrics**, and `Esc` closes it. On **Actions**, `Enter` runs the selected action from the plugin's manifest, with no parameters. A streaming action opens a progress window that shows progress, items, warnings and prompts; type a reply and press `Enter` to answer a prompt, and press `c` (`Ctrl+C` while replying) to cancel. `Esc` closes the window; the action keeps running unless you cancelled it. `b` and `p` start bridge discovery and pairing for plugins that have bridges.

### Manage tab

`Left` / `Right` move between the panels: **Modes**, **Matter**, **Status**, **Users**, **Logs**, **Events**, **Audit** and **Backup**.

| Panel | Keys |
|---|---|
| Modes | `n` or `Enter` new mode; `d` delete |
| Matter | `c` or `n` commission (pairing code, optional name, room, discriminator, passcode); `r` refresh nodes; `i` or `Enter` re-interview; `d` remove node |
| Status | `r` refresh system status |
| Users | `n` or `Enter` new user (admins; for other roles `Enter` opens the role editor); `p` change password; `d` delete |
| Logs | `p` or `Space` pause/resume; `e`, `w`, `i` show ERROR, WARN or INFO and above; `/` filter by module; `c` or `d` clear the buffer |
| Events | `f` filter: all, Hue inputs, entertainment, plugin metrics |
| Audit | `Enter` expand an entry; `n` / `p` next / previous page; `r` refresh |
| Backup | `Enter` runs the selected action: download a system backup (`.zip`), export all rules or scenes to JSON, or import rules or scenes from `~/.homecore/imports/rules.json` and `~/.homecore/imports/scenes.json` |

The Logs panel opens its log WebSocket only while you are on it, and closes it when you leave.

---

## Caching

- On login, the TUI shows cached state first (if there is any), then syncs fresh data from HomeCore, so later launches appear at once even on a slow link.
- `r` pulls fresh data and updates the cache.
- After a device or scene action, the TUI re-fetches and re-caches what changed.
- There is no background polling; live updates come from the event stream.

---

## Endpoints used

The TUI uses only the documented `/api/v1` API, so anything it does, another client can do too.

```
POST   /auth/login, GET /auth/me, POST /auth/change-password
GET    /devices                      PATCH /devices/{id}/state
PATCH  /devices/{id}                 DELETE /devices/{id}
GET    /scenes                       POST /scenes/{id}/activate
GET    /areas (+ create, edit, delete, PUT /areas/{id}/devices)
GET    /automations, /automations/{id}, /automations/{id}/ron, /automations/{id}/history
POST   /automations/{id}/clone       PATCH, DELETE /automations/{id}
GET    /automations/groups (+ enable, disable, delete)
GET    /automations/export           POST /automations/import
GET    /scenes/export                POST /scenes/import
GET    /events?limit=...
GET    /plugins, /plugins/{id}/capabilities
POST   /plugins/{id}/command         DELETE /plugins/{id}
GET    /modes                        POST /modes, DELETE /modes/{id}
GET    /auth/users (+ create, role, password, delete)
GET    /system/status                POST /system/backup
GET    /audit
POST   /plugins/matter/commission    GET /plugins/matter/nodes
POST   /plugins/matter/reinterview   DELETE /plugins/matter/nodes/{id}

GET    /plugins/{id}/command/{request_id}/stream   # SSE, streaming actions
WS     /events/stream?token=...                    # live state
WS     /logs/stream                                # only while Manage → Logs is open
```

It also still calls `/switches`, `/timers` and `/glue` as described in the note at the top.

---

## Comparison with the web app

| Feature | Web app | TUI |
|---|---|---|
| Device control | yes | yes |
| Scene activation | yes | yes |
| Live event stream | yes | yes |
| Rule editor | yes | no (enable, disable, clone, delete, import, export) |
| Helpers (timers, switches, counters …) | yes | no (see the note above) |
| Plugin actions, including streaming ones | yes | yes (without parameters) |
| Audit log | yes | yes |
| Matter commissioning | yes | yes (Manage → Matter) |
| Live logs | yes | yes (Manage → Logs, on demand) |
| Backup | yes | download, plus rules and scenes in and out |
| Restore | yes | no |
| Phones and tablets | yes | no (terminal) |
| Works over plain SSH | no | yes |

For writing rules, helpers, restore or anything on a phone, use the [web app](../web-ui/overview.md). For quick control and for watching events and logs on a remote or headless machine, the TUI is the lighter choice.
