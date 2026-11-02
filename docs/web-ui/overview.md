---
id: overview
title: Web UI overview
sidebar_label: Overview
sidebar_position: 1
---

# Web UI overview

**hc-web-svelte** is homeCore's web app. It is built with Svelte 5 and SvelteKit, published as the `ghcr.io/homecore-io/hc-web-svelte` image, and works on phones, tablets, desktops and wall displays, in a light and a dark theme. One app serves both sides of the house: the household uses it to run lights, scenes and rooms, and admins use it for devices, automations, plugins, people and backups.

The app is not built into core. Core serves the API and nothing else. The app's container runs a small Node server (the UI server) that:

- serves the app,
- passes `/api/v1/*` and the event stream through to core on the same origin (core sends no CORS headers, so the API has to be same-origin with the app),
- keeps your sign-in in `HttpOnly` cookies, and
- stores the app's own data in `/data`: pages, each person's Home, displays, the house's theme and preferences.

homeCore keeps the house; the UI server keeps how it is shown. Everything the app does to the house is a documented REST or WebSocket call, so any other client, such as [hc-tui](../tools/hc-tui.md), [hc-mcp](../tools/hc-mcp.md), a script or a voice assistant, can do the same things.

## Getting it

The [Docker stack](../getting-started/docker.md) runs core and the app together and is the intended way to deploy both:

```sh
git clone https://github.com/homeCore-io/docker.git homecore-docker
cd homecore-docker
mkdir homecore-data
docker compose up -d
```

Open `http://<host-ip>:3000` and sign in with `admin` and the password in `homecore-data/INITIAL_ADMIN_PASSWORD`.

To run the app on its own, beside an existing homeCore:

```sh
docker run -d --name hc-web-svelte --restart unless-stopped \
  -p 3000:3000 \
  -e HC_CORE_URL=http://homecore:8080 \
  -v hc-web-svelte-data:/data \
  ghcr.io/homecore-io/hc-web-svelte:latest
```

`HC_CORE_URL` is how the container reaches homeCore: a compose service name or the host's address. Keep `/data` on a volume. homeCore's own backup doesn't include it; **Settings → Data & backups** saves it. `GET /ui/health` answers `{"ok":true}`.

From source, you need Node: `npm install`, copy `.env.example` to `.env` and set `HC_CORE_URL`, then `npm run dev` serves the app on port 5180. For production, `npm run build && npm start`, configured with `PORT`, `HOST`, `HC_CORE_URL` and `HC_DATA_DIR`.

## Signing in

Sign in with a username and password. The UI server holds the session in cookies the app's scripts can't read, refreshes it as needed, and returns you to the sign-in page when it ends.

Worth knowing:

- Changing a password ends every session that user holds, in every browser. That is deliberate (see [Users & authentication](../administration/users-auth.md)), and it means changing your own password signs out your other tabs and devices.
- The UI server never passes on a request that carries no credential, apart from signing in. homeCore treats requests from whitelisted addresses as admin without a token, and every request through the UI server comes from the UI server's address, so forwarding anonymous requests would make anyone who can reach the app an admin.
- **Me → Signed in** lists where you are signed in, and can end those sessions.

## Getting around

On a phone, a bar along the bottom holds **Home · Scenes · Alerts · More** by default. Each person can choose their own bar on **Me**, including rooms and pages; **Pages** joins the default bar once a page exists. On a wider screen, a collapsible sidebar holds Home, Pages, Scenes and Alerts, with the rooms below them. **Search** (⌘K) finds places, devices and rules, and Settings has its own search over every setting.

### Home and rooms

Home is generated from the house: your rooms and the devices in them, live. Visible controls act directly (tap a light's switch and it turns on), and tapping a card opens the device's details. Rooms are reached from Home, and each room page works the same way.

Home can be arranged in two modes:

- **Customise** changes the page for you alone ("Only you see these changes"). Long-press a card to star or hide it.
- **Edit** changes the shared page for everyone, for people allowed to edit it.

In either mode you can move, hide and rename sections, add your own, add cards (a device, a scene, or cards such as Heading, Text, Worth knowing, Playing, Weather and Chart) and move cards between sections. Each device card has its own settings: size, main reading, what else it shows, what a tap does, and its symbol. Home can also show your rooms as boxes (room field, room tiles, or rooms in the sidebar) with chosen big numbers across the top, such as Inside, Outside and Lights on.

### Pages

**Pages** lists the house's pages, then your own. A new page starts empty or as a copy of Home or a room, for everyone or just you, and is arranged the same way as Home. Only people who edit the house's pages can make one for everyone; anyone can make their own.

### Scenes and alerts

**Scenes** runs scenes, grouped by room, with the modes alongside. **Alerts** lists what needs attention: something open, wet or offline, a low battery, or an alert from a plugin or one of your time rules. Alerts can be marked as seen, and an admin can ignore a kind of alert for a while or for good.

### Displays

A display is a screen of its own, such as a kitchen panel or a hall tablet, separate from any person. An admin makes one in **Settings → Displays** and is shown its key once; on the tablet, open `/display` and enter the key. From then on the tablet opens on the pages the admin chose, with no sign-in: tabs along the bottom, a clock, the alert count and a lock. It can keep the screen on, go dark while Night Mode is on, and reload daily. A person can unlock the full app on a display for five minutes with a PIN they set on **Me**.

### Me

**Me** holds your own preferences: appearance (light or dark, which follows the device unless you choose), theme, units, your phone bar, your display PIN, where you are signed in, your API keys and your password.

## Settings

Settings has two groups.

**House:** Devices · Rooms · Scenes · Modes · Helpers · Automations · Alerts · Displays · Asking first · Look

**System:** Plugins · People & access · Configuration · Notifications · Data & backups · Logs · Events · Audit · System

Some of these are worth calling out:

| Section | What it is |
|---|---|
| Devices | Every device with its state, history and settings: name, room, name in rules, how it's shown, button names, the hardware, which device it sits behind, and what uses it. Filters for problems such as no room, battery low and offline, and bulk actions. |
| Automations | Rules written out in words, with when each last ran, groups by tag, dry runs and history. The editor builds a rule as sentences in three parts (When, Only if, Do) and covers every trigger, condition and action; its advanced mode edits the rule as JSON. |
| Alerts | Time rules, such as a door left open at night |
| Asking first | Which commands ask for confirmation before they go |
| Plugins | Install from the [signed registry](../plugins/overview.md), start, stop, restart and update, edit each plugin's settings in a form the plugin describes, run its actions, set its log level and read its live log. Plugin runtimes are approved here too. |
| Configuration | `homecore.toml` as a form driven by core's config descriptor, with the raw TOML and a restart button |
| Notifications | Notification channels, a test send, and the automations that use each |
| People & access | Accounts, roles and API keys |
| Data & backups | Backup and restore, rules and scenes in and out, calendars |
| Audit | Who changed what and when, written as sentences |
| Logs | The live log from core and every plugin, filtered by level and module |

### Plugin screens

A plugin can bring its own screens: its page in Settings → Plugins, a panel for its devices, a form in the automation editor, its devices' cards, and cards of its own to add to a page. See [Plugin Screens and Cards](../plugins/plugin-screens.md).

## What each role sees

The app hides what the API would refuse. Settings shows a section only to people whose role can use it; for example, someone who can read automations but not change them can still open Automations to look. See [Users & authentication](../administration/users-auth.md) for the roles.

## Other clients

- [hc-tui](../tools/hc-tui.md): terminal UI
- [hc-mcp](../tools/hc-mcp.md): MCP server, for driving homeCore from an LLM
- `hc-cli`: ships with core, for scripting and same-host administration

## Earlier web UIs

Two earlier clients are retired. Core used to bundle a Leptos/WebAssembly admin client and serve it from its own root path. The Flutter app, hc-web, followed; it stopped working with core v0.1.94, which removed the dashboard endpoints its pages came from. Its camera wall, media page and skin editor were not carried over; themes replace skins.

The `[web_admin]` config section still exists and still serves a directory of static files at the root path when `enabled = true`. It is generic (point it at any pre-built bundle), but the standard deployment leaves it off and lets the app's own server do the serving.
