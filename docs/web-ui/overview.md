---
id: overview
title: Web UI overview
sidebar_label: Overview
sidebar_position: 1
---

# Web UI overview

hc-web-svelte is homeCore's web app. It is built with Svelte 5 and SvelteKit and published as the `ghcr.io/homecore-io/hc-web-svelte` image. It works on phones, tablets, desktops and wall displays, in a light and a dark theme. The household uses it to run lights, scenes and rooms. Admins use the same app for devices, automations, plugins, people and backups.

Core serves the API and nothing else, so the app runs in its own container. That container runs a small Node server (the UI server) that:

- serves the app,
- passes `/api/v1/*` and the event stream through to core on the same origin (core sends no CORS headers, so the API has to share the app's origin),
- keeps your sign-in in `HttpOnly` cookies,
- plays live camera video through go2rtc, when you set it up, and
- stores the app's own data in `/data`: pages, each person's Home, displays, looks, pictures, UI extensions and preferences.

homeCore holds the house itself, and the UI server holds how it is shown. Everything the app does to the house is a documented REST or WebSocket call, so [hc-tui](../tools/hc-tui.md), [hc-mcp](../tools/hc-mcp.md), a script or a voice assistant can do the same things.

## Getting it

The [Docker stack](../getting-started/docker.md) runs core and the app together. It is the recommended install. The [binary release](../getting-started/binary-releases.md) tarball holds core only. To run the stack:

```sh
git clone https://github.com/homeCore-io/docker.git homecore-docker
cd homecore-docker
mkdir homecore-data
docker compose up -d
```

Open `http://<host-ip>:3001` and sign in as `admin` with the password in `homecore-data/INITIAL_ADMIN_PASSWORD`.

To run the app on its own, beside a homeCore you already have:

```sh
docker run -d --name hc-web-svelte --restart unless-stopped \
  -p 3001:3000 \
  -e HC_CORE_URL=http://homecore:8080 \
  -v hc-web-svelte-data:/data \
  ghcr.io/homecore-io/hc-web-svelte:latest
```

Keep `/data` on a volume. homeCore's own backup doesn't include it; save it from **Settings › Data & backups** (the "save them too" link under Back up). `GET /ui/health` answers `{"ok":true}`.

### UI server settings

The UI server reads these from its environment:

| Variable | Default | What it does |
|---|---|---|
| `HC_CORE_URL` | `http://127.0.0.1:8080` | How the UI server reaches core: a compose service name, or the host's address such as `http://192.168.1.50:8080`. |
| `HC_DATA_DIR` | `./data` (`/data` in the image) | Where the app keeps its own data. |
| `PORT` / `HOST` | `3000` / `0.0.0.0` | Where the production server listens. |
| `HC_GO2RTC_URL` | unset | Your go2rtc address as the UI server reaches it, for live camera video. Unset, cameras show snapshots. See [Reolink](../plugins/reolink.md). |
| `HC_EXTENSIONS_INDEX`, `HC_REGISTRY_PUBLIC_KEY` | homeCore's registry | Where the Catalog finds UI extensions. See [UI extensions](./extensions.md#settings). |
| `HC_UPDATE_CHECK` | on | The UI server asks GitHub every six hours whether a newer core or app is out, and Settings › System says so. Set `off` to stop it. |

From source you need Node: `npm install`, then `npm run dev` serves the app on port 5180. For production, `npm run build && npm start`. Neither server reads a `.env` file, so set the variables in the shell: `HC_CORE_URL=http://192.168.1.50:8080 npm run dev`.

## Signing in

Sign in with a username and password. The UI server holds the session in cookies the page's scripts can't read, refreshes it as needed, and sends you back to the sign-in page when it ends.

- Changing a password ends every session that user has, in every browser (see [Users & authentication](../administration/users-auth.md)). Changing your own password signs out your other tabs and devices too.
- The UI server never passes on a request that carries no credential, except for signing in, refreshing a session, `/api/v1/health`, and a `POST` to a webhook. The rule is there because homeCore treats whitelisted addresses as admin without a token, and every request through the UI server comes from the UI server's address.
- **Me › Signed in** lists where you are signed in and can end those sessions.

## Looks and frames

How the house is drawn is a [look](./looks.md). Three come with the app:

- **Classic**, cards of one size with a switch on each. A house that chooses nothing gets Classic.
- **Lit**, which draws each room as a lit room you drag to dim.
- **Console**, a desktop app with rooms down the side, faders, and switches.

The house has a look (**Settings › Look**), and each person can pick their own. Classic and Lit share one frame, and Console has a frame of its own. Each frame has its own way of getting around.

### Getting around in Classic and Lit

On a wide screen, a sidebar holds Home, Pages, Scenes and Alerts, then an Everywhere group and your rooms, with Settings and Me at the foot. Ctrl+\ (⌘\ on a Mac) folds it to icons. The header has Search, the alert count, Edit on pages you can arrange, and **Ask** when the Assistant is installed.

On a phone, a bar along the bottom holds **Home · Scenes · Alerts · More** by default. Each person can choose their own bar on Me, with rooms and pages in it. An admin sets the household's default bar in Settings › Look.

### Getting around in Console

The toolbar across the top has Search, the alert count, Ask, the gear and your picture.

- The gear opens the household settings menu: Rooms, Devices, Scenes, Plugins, Automations, People, Units and region, System, and All settings.
- Your picture opens your own menu: Picture, Look, Temperature, how faders and switches look, Switches and timers as rows or tiles, the sidebar open or folded, what this screen opens on (for a wall panel), Customize the room, Everything else about you, and Sign out.

The sidebar has Whole home, the Everywhere views, Cameras (when the house has cameras) and your rooms.

On a tablet held upright (761 to 900 pixels wide), the sidebar folds to a rail of icons and slides over the page when you open it. Below 700 pixels wide, Console switches to a phone layout with four tabs along the bottom: Home, Rooms, Everywhere and Cameras. Your picture at the top right opens your settings in a sheet. Customize and arranging need a wider screen.

### Search

Search (Ctrl+K or ⌘K) finds rooms, devices, scenes, pages and, for people who can change them, automations. A device opens its details over the page you're on. Settings has its own search over every setting ("Find a setting").

## Home and rooms

### In Classic and Lit

Home is built from the house: your rooms and the devices in them, live. Controls act at once (tap a light's switch and it turns on), and tapping a card opens the device's details. Each room has a page that works the same way.

Every page is one grid, 12 columns wide (4 on a phone). Edit offers two ways to arrange it:

- **Just for me** changes the page for you alone.
- **For everyone** changes the shared page. Only people allowed to edit the house's pages get it.

While arranging, drag a card to move it. The cards it lands on move aside, and nothing overlaps. Drag a card's corner to resize it. The keyboard works too: Space picks a card up, the arrows move it, and Shift with the arrows sizes it. **Tidy** closes up gaps. A room's Layout menu goes back to the look's layout, copies this room's layout to other rooms, or starts from another room's.

**Add** opens a sheet beside the page (under it on a phone) with two tabs. One lists things in the house that aren't on the page yet. The other lists cards: Heading, Text, Worth knowing, Playing, Weather, Chart, Stack, Title, Divider, Space, Picture, Link to a page and Clock, plus any cards plugins bring. Each device card has its own settings for size, main reading, what else it shows, what a tap does, and its symbol.

A summary chip on Home, such as the lights that are on, opens a page of just those things so you can deal with them there.

### In Console

Home shows your rooms as tiles lit the way their lights are, with what needs attention at the top and a button to fix each one. Under that is a row of favorites and scenes, starting with **Every light off**. Edit on that row sets the house's row (Everyone) or your own (Just me). A weather band shows the conditions now, the next 24 hours and a three-day forecast. Settings › System › Units and region picks where the current conditions come from: automatic, the weather service, or one outdoor sensor. The band hides when there's no weather source.

A room opens with its picture across the header, lit by its lights, and Room on and Room off beside it. Its devices sit in tabs: Lights, Media, Climate, Doors, Water, Sensors, Switches, and Cameras when it has any. The Lights tab has faders by group, scene chips, switches and keypads. Tap a Hue lamp's label to run a scene on that lamp alone. The room's audio sits in a bar along the bottom.

**Customize**, in each room's header, shows what you can change with dashed outlines: favorites, which tabs show and which one the room opens on, the Lights tab's columns, the room picture, and header pills for camera events. Just me changes what you see. Everyone changes it for the household and needs the right to change household settings. The ⋯ beside a device moves it to another room or tab for everyone.

A room's picture can be a drawing or a photo. On a photo, each light gets a spot that glows when it's on.

### Everywhere and Cameras

The Everywhere views show the whole house at once: Lights, Media, Climate, Security and Water. The sidebar shows each view's status, such as "2 open" or "1 offline". Security lists locks, doors and anything else that counts for security. Each device's Security setting (in Settings › Devices) decides whether it counts.

Cameras is a camera wall: live video for the camera you pick, snapshots of the others, and recent events. Live video needs `HC_GO2RTC_URL` on the app's container. Video plays only while it's on screen. Spotlight, siren and PTZ controls are there too, and sounding a siren asks first.

## Pages

Pages (in Classic and Lit) lists the house's pages, then your own. A new page starts empty or as a copy of Home or a room, for everyone or just you, and you arrange it the same way as Home. Only people who edit the house's pages can make one for everyone; anyone can make their own.

## Scenes and alerts

**Scenes** runs scenes grouped by room, with the modes beside them. **Settings › Scenes** lists every scene, homeCore's own and every plugin's (Hue, Lutron, Caséta), with what provides each one. There you pick which scenes go on Home's scenes row.

**Alerts** lists what needs attention: something open, wet or offline, a low battery, or an alert from a plugin or one of your time rules. Mark one Seen, or Mark all seen. An admin can also ignore a kind of alert for a while or for good.

## Pictures

**Settings › Pictures** holds the household's pictures and videos and your own. Upload them, name them, share them with everyone or keep them yours, sort them into albums, and see where each is used. They show up in room photos, Picture cards, a display's picture frame, and your own picture (**Me › Picture**, or Picture in the Console menu). Pictures live in the UI server's data, never in core.

## Ask

When the [Assistant](../plugins/assistant.md) plugin is installed, an **Ask** button appears on every page. On a wide screen it opens a panel beside the page. On a tablet the panel sits over the page, and on a phone it opens a page of its own. You can ask what's on, why something happened, or for a new automation. It never does more than you are allowed to do. Unless an admin turns it off, every change waits on a card that says what it will do until you confirm it.

## Displays

A display is a screen of its own, such as a kitchen panel or a hall tablet, that isn't signed in as a person. An admin makes one in **Settings › Displays** and sees its key once (Copy the key). On the tablet, open `/display` and paste the key under Display key. From then on the tablet opens on the pages the admin chose, with no sign-in. It shows tabs along the bottom, a clock, the alert count and a lock.

Each display has its own settings:

- its pages, in order (Home, Scenes, Alerts, rooms or pages),
- its look,
- Keep the screen on, Dark while Night Mode is on, and Reload every day at a set time,
- what it does at rest after 2 to 30 minutes untouched: a picture frame from an album, a clock, or dark.

A person can unlock the full app on a display for five minutes with a PIN they set on Me. It locks again after a minute and a half untouched. A display's key is an API key, so deleting the display signs it out at once.

## Me

**Me** holds your own preferences: appearance (light or dark, which follows the device unless you choose), your look, theme, units (temperature, and pressure, wind and rain), your phone bar, your PIN for displays, where you are signed in, your API keys and your password. In Console, your picture's menu covers the everyday ones and links to the rest.

## Settings

Settings has two groups. You see only the sections your role can use.

House: Devices · Rooms · Scenes · Modes · Helpers · Automations · Alerts · Displays · Asking first · Pictures · Look

System: Plugins · Extensions · People & access · Configuration · Notifications · Data & backups · Logs · Events · Audit · System

| Section | What it is |
|---|---|
| Devices | Every device with its state, history and settings: name, room, name in rules, Security, how it's shown, button names, the hardware, which device it sits behind, and what uses it. Filters for problems such as no room, battery low and offline, and bulk actions. |
| Rooms | Room names, order, icons and photos. |
| Scenes | Every scene and what provides it, which are on Home, new scenes, and import and export. |
| Helpers | Timers, switches, counters and other [virtual devices](../devices/virtual-devices.md). |
| Automations | Rules written out in words, with when each last ran, groups by tag, dry runs and history. The editor builds a rule as sentences in three parts (When, Only if, Do). Its advanced mode edits the rule as JSON. |
| Alerts | Time rules, such as a door left open at night. |
| Asking first | Which commands ask for confirmation before they go. |
| Look | The house's [look](./looks.md), the look editor, the house's theme and the household's phone bar. |
| Plugins | Installed plugins with Start, Stop, Restart, Update and **Update all**, each plugin's settings in a form the plugin describes, its actions, its log level and its live log. **Catalog** installs new plugins from the [signed registry](../plugins/overview.md) and has a UI extensions tab. **Plugin runtimes** adds and manages [runtimes](../plugins/runtimes.md) for Python plugins. |
| Extensions | The [UI extensions](./extensions.md) installed, where each came from, and Remove. |
| People & access | Accounts, roles, what each role allows, and API keys. |
| Configuration | `homecore.toml` as a form, with the raw TOML and a restart button. |
| Notifications | Notification channels, a test send, and the automations that use each. |
| Data & backups | Back up now, kept backups, Restore, rules and scenes on their own, calendars, and the app's own data. |
| Logs | The live log from core and every plugin, filtered by level and module. |
| Events | Everything the house reports, live. |
| Audit | Who changed what and when, written as sentences. |
| System | Version, health, storage, log level, Units and region (the household's temperature unit and the weather source), and whether a newer core or app is out. |

### Plugin screens

A plugin can bring its own screens: its page in Settings › Plugins, a panel for its devices, a form in the automation editor, its devices' cards, and cards of its own to add to a page. See [Plugin Screens and Cards](../plugins/plugin-screens.md).

## What each role sees

The app hides what the API would refuse. For example, someone who can read automations but not change them can still open Automations to look. See [Users & authentication](../administration/users-auth.md) for the roles.

## Other clients

- [hc-tui](../tools/hc-tui.md): a terminal UI.
- [hc-mcp](../tools/hc-mcp.md): an MCP server for driving homeCore from Claude Desktop or another LLM client. It is also the Assistant plugin.
- `hc-cli`: a command-line tool for scripting and same-host administration. It is not in the image or the release tarball; build it from the homeCore repository with `cargo build -p hc-cli`.

## Earlier web UIs

Two earlier clients are retired. Core used to bundle a Leptos admin client. The Flutter app, hc-web, came next. It stopped working with core v0.1.94, which removed the dashboard endpoints its pages used.

The `[web_admin]` config section still exists. With `enabled = true` it serves a folder of static files at core's root path. The standard install leaves it off.
