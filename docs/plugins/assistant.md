---
id: assistant
title: Assistant
sidebar_label: Assistant
sidebar_position: 17
---

# Assistant (`hc-mcp`)

The Assistant adds an **Ask** button to every page of the homeCore app. It
opens a chat with Claude about your house. People can ask what is on, why
something happened, or how to set something up, and they can ask it to turn
things on and off or write an automation. It answers from the house as it is
right now, using the same tools as the [hc-mcp MCP server](../tools/hc-mcp).

Its plugin id is `plugin.mcp`. It has no devices of its own.

## Before you start

- homeCore core v0.1.110 or later and app v0.1.74 or later.
- A [Python plugin runtime](./runtimes) connected to homeCore. The Assistant
  is a Python plugin, so it runs in a runtime and not beside the core.
- A Claude API key from [console.anthropic.com](https://console.anthropic.com).
  Questions, and the house details needed to answer them, are sent to
  Anthropic.
- The machine running the runtime needs to reach the Claude API over the
  internet.

## Install and set up

1. Open the Catalog, find **Assistant** and install it into your Python
   runtime. The app waits for the runtime and opens the plugin's page once it
   is running.
2. On **Settings › Plugins › Assistant**, paste the Claude API key and press
   **Save**. Press **Test the key** to check that the key and the model work.
3. Pick the model and decide what it may do (see below).

There is no homeCore key to paste. homeCore gives the plugin its own access
to the house every time it starts, and tells it who is asking with every
message. The top of the settings page says **Connected to homeCore** once that
access has arrived.

Only admins can see or change these settings. The key is stored by the
plugin and never sent back to a browser; the page only shows that one is
saved, with a **Replace** button.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Claude API key | none | The key the chat uses. Without it the chat can't answer. |
| Model | Claude Sonnet 5.5 | Also offered: Claude Opus 5.5 and Claude Haiku 4.5. |
| Answer questions | always on | Devices, rooms, history, what ran and why. |
| Control devices | on | Lights, scenes, thermostats and other devices. |
| Make and change automations | on | Create, edit, turn on or off, and delete automations. |
| Locks, doors and security | off | Allows commands to devices that count for security. |
| Ask before every change | on | Shows what it is about to do and waits for a yes. |
| Keep each person's chats for | 30 days | Also 7 days, or Don't keep (a chat lasts only while the plugin runs). |

A device counts for security when its Security choice in its settings says
so. When it has no choice set, locks, doors, windows, contact sensors,
garage doors, gates, covers, shades and blinds count.

These settings live in the plugin's own data folder, not in homeCore's plugin
config. In a runtime that folder is `plugins/plugin.mcp/data` inside the
runtime, so an update keeps the key and the chats. You can move it with the
`HC_MCP_DATA_DIR` environment variable or `data_dir` under `[assistant]` in
the plugin's config file.

## What it may do

Three things decide what the chat can do for someone. The switch for that
kind of change must be on, the person asking must hold the homeCore
permission it needs, and so must the plugin's own access. A household member
can ask questions and control devices but can't change automations, because
their account can't.

With **Ask before every change** on, every change shows a card first that
says what will happen. The person presses a button to go ahead, or replies
to change it. A card nobody answers expires after 10 minutes and nothing is
done. A new automation is shown as When / Only if / Do, with **Save and turn
on** and **Save turned off**.

A request that touches a device that counts for security is refused while
**Locks, doors and security** is off, and the reply says where to turn it on.

Running other plugins' actions is off and has no switch on the page yet.

Asked how to install homeCore, add a plugin, a runtime or a person, or write
a plugin, it reads the matching [homeCore skill](../tools/skills) and walks
through it, naming the screen for each step.

## Devices

None. The Assistant controls other plugins' devices through homeCore and
publishes none of its own.

## Actions

The app's chat and settings page use these actions. You don't call them
yourself.

| Action | Who | What it does |
|---|---|---|
| `chat` (Ask) | anyone signed in | Sends a message and streams the reply. Times out after 15 minutes so a confirm card can wait. |
| `chats` (Past chats) | anyone signed in | That person's own chats, newest first. |
| `chat_get` | anyone signed in | Opens one of their own chats. |
| `chat_delete` | anyone signed in | Deletes one of their own chats. |
| `settings_get` | admin | Reads the settings (never the key). |
| `settings_set` | admin | Changes the key, model, switches or how long chats are kept. |
| `test_key` | admin | Checks the key and model. Times out after 30 seconds. |

Each person sees only their own chats. homeCore does not store them.

## Alerts

The plugin raises two notices on its page:

- A warning, "The assistant has no Claude API key", until a key is saved.
- An info notice, "Waiting for homeCore to give the assistant access to the
  house", if that access is still missing 15 seconds after the plugin
  connects. It clears when access arrives.

## Screens and cards

The Assistant ships two screens. The chat (`hc-mcp-chat`) fills the
`app.assistant` slot behind the Ask button. On a wide screen it opens beside
the page, on a tablet over it, and on a phone as a full page. It has **New
chat**, **Past chats** and a stop button while a reply is coming. The
settings page (`hc-mcp-settings`) is the plugin's page in Settings ›
Plugins.

## Troubleshooting

The plugin keeps running when something is missing, and the chat says what
is wrong:

- "The Claude API key was not accepted": replace the key on the settings
  page.
- "This API key can't use" a model: pick another model.
- "Claude is busy for this API key right now": the key hit Anthropic's rate
  limit. Try again in a minute.
- "The assistant can't reach the Claude API": the runtime's machine has no
  route to the internet.
- "The assistant is still waiting for homeCore to give it access": if this
  lasts more than a minute, restart the runtime, which restarts the
  Assistant with it.

The plugin's log lines go to homeCore's log, under the plugin `plugin.mcp`.

## Known limits

- One reply can make at most 12 rounds of tool calls before it stops.
- A tool result longer than 40,000 characters is cut short; ask about fewer
  devices at a time.
- It can't run other plugins' actions from the chat yet.
