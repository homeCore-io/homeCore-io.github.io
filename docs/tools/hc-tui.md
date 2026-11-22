---
id: hc-tui
title: "hc-tui: Terminal UI"
sidebar_label: hc-tui (Terminal UI)
sidebar_position: 2
---

# hc-tui

`hc-tui` is a keyboard-driven terminal UI for homeCore, written in Rust with `ratatui`. It talks to the same REST and WebSocket API as the [web app](../web-ui/overview.md), uses the app's names for things, and works over SSH and on headless machines.

The repo is [homeCore-io/hc-tui](https://github.com/homeCore-io/hc-tui), a separate Rust repo with its own lockfile (the latest release is v0.1.4). Tagged releases publish a statically linked Linux x86_64 binary as a `.tar.gz`. You can also build it from source with `cargo build --release`.

---

## When to reach for the TUI

| Scenario | Use |
|---|---|
| Quick device or room toggle from an SSH session | `hc-tui` |
| Writing or editing an automation | Web app (automation editor) |
| Making alert rules | Web app |
| Triaging a flood of events or logs on a remote box | `hc-tui` (low-overhead live stream) |
| Changing a plugin's settings on a headless machine | `hc-tui` (Plugins → Settings) |
| Commissioning a Matter device from the command line | `hc-tui` (Plugins → Matter) |

Both talk to the same endpoints, so anything you do in one shows up live in the other.

---

## Running

```bash
hc-tui --base-url http://127.0.0.1:8080
```

| Flag | Default | Description |
|---|---|---|
| `--base-url` | `http://127.0.0.1:8080` | The homeCore server, without the `/api/v1` suffix |
| `--config` | `~/.config/hc-tui/config.toml` | Optional config file |
| `--cache-dir` | `~/.cache/hc-tui` | Where cached data and the saved session go |

The config file is read from `$XDG_CONFIG_HOME/hc-tui/config.toml` (usually `~/.config/hc-tui/config.toml`), or from `./config/config.toml` when only that one exists. Flags override the file, and the file is optional:

```toml
[server]
base_url = "http://127.0.0.1:8080"   # without /api/v1

[session]
# Save the session and skip the login screen while it can be refreshed.
persist_token = true

# Optional: log in automatically when there is no usable saved session.
#[auto_login]
#username = "admin"
#password = "..."
```

Without a usable saved session, a login screen appears first. Sign in with the same credentials you use in the web app. The session is refreshed before it expires; when it can't be refreshed any more, the TUI goes back to the login screen. `L` signs out.

The config file can hold a password, so keep it private. Every folder hc-tui creates is 0700 and every file 0600.

---

## Layout

A sidebar lists the screens, with the same names as the app:

**1 Home · 2 Rooms · 3 Devices · 4 Scenes · 5 Modes · 6 Helpers · 7 Automations · 8 Alerts · 9 Plugins**

and under **Settings**: **People · Data & backups · Logs · Events · Audit · System**.

Each person sees only the screens their role can use. Plugins needs `plugins:read`, People `users:read`, Audit `audit:read`, Logs the admin role, and Data & backups the admin role or `automations:write`.

The header shows the homeCore version, the modes that are on and the outside temperature when a weather device reports one. On the right it shows your role and whether the live stream is connected. Alerts shows the number of open alerts in the sidebar.

A live subscription to `/api/v1/events/stream` keeps devices, rooms, scenes, automations, modes, alerts and plugins current. It reconnects by itself with backoff (1 to 30 seconds) and reloads everything after a reconnect. Screens redraw only when something changes, so leaving the TUI open doesn't burn CPU.

Temperatures are shown in the unit set on homeCore.

---

## Home

Home is the first screen. It holds the rooms, devices, scenes, modes, helpers and automations you pick, under headings you name, each with its live state. `Space` does the item's main action: a room's lights on or off, a light toggled, a scene activated, a manual mode switched, a timer started, an automation turned on or off.

Press `*` on any screen to pin or unpin the selected item, or `a` on Home to add items from a picker. Home is saved per server and per person in `~/.config/hc-tui/home/`. Core keeps no UI settings and the web app's favorites live on the app's own server, so this Home belongs to hc-tui alone.

---

## Key bindings

The footer shows the main keys for the screen you are on, and `?` lists all of them.

### Everywhere

| Key | Action |
|---|---|
| `1` to `9`, `Tab`, `Shift+Tab` | Jump between screens |
| `j` / `k` or arrows | Move |
| `Enter` | Open or edit |
| `Space` | The main action: on or off, enable or disable, activate |
| `n` | New |
| `x` | Delete, remove or uninstall, after a `y` confirmation |
| `/` | Search the current list as you type; `Enter` keeps it, `Esc` clears it |
| `*` | Pin or unpin the selected item on Home |
| `r` | Refresh from the server |
| `?` | Every key for this screen |
| `Esc` | Back or close |
| `T` | Show times in UTC or local time |
| `L` | Sign out |
| `q`, `Ctrl+C` | Quit |

On the login screen, `Tab` switches field, `Enter` signs in and `Esc` quits.

### Screens

| Screen | Keys |
|---|---|
| Home | `Space` main action; `Enter` open the item on its own screen; `a` add; `x` take off Home (no confirmation); `J` / `K` move; `h` rename the heading |
| Rooms | `Space` room on or off; `Enter` its devices, where `a` adds devices and `x` takes one out; `s` what Room on would bring back; `n` new room; `e` rename; `M` merge into another room (asks first); `x` delete |
| Devices | `←` / `→` tabs (All, Lights, Climate, Media, Covers, Locks, Sensors, Offline, Removed); `Tab` into the controls; `Space` or `t` on or off; `+` / `-` brightness; `l` / `u` lock and unlock; `f` filter; `s` sort; `v` grouped or flat; `h` history of any reading, 1 hour to 30 days; `o` devices no plugin manages (`Space` mark, `x` remove); `Enter` edit; `x` remove. On Removed, `Space` lets a device come back |
| Media | `Space` play or stop; `p` play or pause; `s` stop; `>` / `<` next and previous; `+` / `-` volume; `m` mute |
| Scenes | `Space` or `a` activate; `n` new; `Enter` edit; `x` delete |
| Modes | `Space` manual mode on or off; `d` what turns a criteria mode on and off; `n` new; `Enter` edit (name, sun event and offset); `x` delete |
| Helpers | `Space` the helper's main action; `n` new; `Enter` edit; `x` delete. A timer adds `0` cancel; a counter `+`, `-` and `0` reset; a number `←` / `→` and `s` set |
| Automations | `Space` on or off; `R` run now; `t` dry run at a time; `u` resume one that another automation paused; `F` point a missing device's place at another device; `Enter` the RON; `m` mark several; `c` copy; `x` delete; `g` groups; `v` hub variables; `f` filter; `s` only those that need fixing |
| Alerts | `←` / `→` Open, Acknowledged, Rules, Plugin kinds, Ignored. On an alert, `a` acknowledge, `p` run its action, `i` ignore its device. Rules: `Space` on or off, `x` delete (asks what becomes of the automations it starts). Plugin kinds: `Space` off or on, `n` where it's sent, `d` the plugin's choice. Ignored: `x` show again |
| Plugins | `←` / `→` Installed, Catalog, Runtimes, Matter. Installed: `Enter` detail; for admins `Space` on or off, `s` start or stop, `R` restart, `U` update, `x` uninstall. Actions: `Enter` run, `f` run with a file. Catalog: `i` install. Runtimes: `R` reset login, `U` update Python, `e` name and plugin limit, `n` add, `x` remove. Matter: `c` commission, `i` reinterview, `x` remove a node |
| People | `←` / `→` People, Roles, API keys, Sessions, Displays. People: `n` new, `Enter` change role, `p` password, `P` your PIN for displays, `c` remove PIN, `x` delete. API keys: `n` new, `e` label or scopes, `s` new secret, `x` revoke. Sessions: `x` end one, `X` end all others. Displays: `n` new (its key shown once), `x` delete |
| Data & backups | `n` back up now; `Enter` download a kept backup, run an action (restore from a file, export, import, add a calendar from a file or a web address) or show a calendar's next events; `R` restore a kept backup; `x` delete a calendar |
| Logs | `Space` or `p` pause; `e` / `w` / `i` / `d` level; `c` clear |
| Events | `f` event type |
| Audit | `Enter` detail; `]` / `[` next and previous page; `f` everything, sign-ins, changes, refused or failed |
| System | `c` check what devices take; `u` °C or °F for the household and `N` a test notification (admin); `←` / `→` core's log level until it restarts; `R` restart core (admin, asks first) |

### Devices

The device detail has controls built from the device's schema: on and off, brightness, color temperature, color presets, position, lock, mode, setpoints, fan, and the actions that need no input. Changes are sent 600 ms after the last key. Temperatures step by 1°F or 0.5°C. A sparkline shows the last 24 hours of the device's main reading. Unlocking, and any action that asks first, needs `y`.

Editing a device sends only the fields that changed: its name (empty restores the plugin's name), room, Security choice and name in automations. Removing a device first says how many automations use it.

### Automations

Each automation shows what starts it in words (`sunset -15m`, `Garage Door open 10m`), its last run and its group. `‖` marks one that another automation paused, and `!` one that needs fixing, with the missing device named. The selected automation shows When, If and Then, and its last 20 runs. A dry run (`t`) evaluates it at a time you give, and sends nothing to devices.

The TUI has no automation editor; write automations in the web app or as RON files.

### Plugins

A plugin's detail has five tabs: Overview, Settings, Actions, Notices and Logs.

- The Settings tab is a form built from the plugin's settings description. `Enter` edits a field, `u` undoes a change, `Ctrl+S` saves and `Esc` discards. Only what changed is written, in place, so comments and keys the form doesn't know about stay in the file. Secrets are never shown.
- The Actions tab asks for an action's parameters first, and a dangerous action asks before it runs. A streaming action opens a progress window that can take replies and be canceled.
- The Logs tab streams the plugin's own log while the tab is open.

When more than one runtime can run a plugin from the Catalog, hc-tui asks which one to use.

### Data & backups

Downloads and exports go to `~/.homecore/exports`, and imports are read from `~/.homecore/imports`. To restore a kept backup you type its date to go ahead. A restore is staged for core's next start, and hc-tui asks whether to restart core now. A new API key's secret is shown once in a dialog, and hc-tui never writes it anywhere.

---

## Caching

- After sign-in, the TUI shows cached data at once and syncs in the background. A spinner in the status bar shows work in flight.
- Each request of a sync succeeds or fails on its own. The status bar names failures, and only data from requests that succeeded is cached, so a failed request never replaces good cached data.
- `r` syncs again. Live changes come from the event stream; there is no background polling.
- The log stream is open only while Logs (or a plugin's Logs tab) is on screen.

---

## Endpoints used

The TUI uses only the documented `/api/v1` API, so anything it does, another client can do too. The full list is in the repo's [README](https://github.com/homeCore-io/hc-tui#homecore-api-integration). The streams it opens are:

```
WS     /events/stream                              # live state
WS     /logs/stream                                # only while Logs is open (admin)
GET    /plugins/{id}/command/{request_id}/stream   # SSE, streaming actions
```

---

## Comparison with the web app

| Feature | Web app | TUI |
|---|---|---|
| Home with your own picks | yes | yes (kept by hc-tui) |
| Rooms, devices, scenes, modes | yes | yes |
| Helpers | yes | yes |
| Automation editor | yes | no (run, dry run, enable, disable, copy, delete, repoint, groups) |
| Alerts | yes | yes (alert rules are made in the app) |
| Plugin settings, actions and logs | yes | yes |
| Plugin Catalog and runtimes | yes | yes |
| People, API keys and sessions | yes | yes |
| Backup and restore | yes | yes |
| Live logs, events and audit | yes | yes |
| Matter commissioning | yes | yes |
| Cameras and pictures | yes | no |
| Phones and tablets | yes | no (terminal) |
| Works over plain SSH | no | yes |

For writing automations, cameras or anything on a phone, use the [web app](../web-ui/overview.md). For quick control, plugin settings, and watching events and logs on a remote or headless machine, the TUI is the lighter choice.
