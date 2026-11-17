---
id: editor
title: The automation editor
sidebar_label: Automation editor
sidebar_position: 2
---

# The automation editor

The web app keeps rules under **Settings › Automations**. It shows each rule as a sentence ("When the front door opens, only if it's between 08:00 and 22:00, tell telegram...") and saves to the same RON files described in the [Rules Overview](./overview.md). This page maps the app's words to the rule fields used everywhere else in these docs.

| In the app | In a rule file |
|---|---|
| Automation | Rule |
| When, a moment | `trigger` and `triggers` |
| Only if, a check | `conditions` |
| Do, a step | `actions` |
| If / otherwise | `Conditional` |
| Rest after running | `cooldown_secs` |
| If it starts again while running | `run_mode` |
| A set | A group (`/automations/groups`) |
| House values | Hub variables |

## The list

The list groups rules by tag, with **All on** and **All off** for each tag. A rule with two tags shows under both, and rules without one are under "Not tagged". Each row is the rule's sentence and name, when it last ran, and any trouble, such as a device the house no longer has or a step that failed last time. A row marked "made by" a mode belongs to that mode: change it in **Settings › Modes**.

At the top are a search box, filter chips (**All**, **Needs attention**, **Off**, **Families**, **Started by alerts**), **+ New automation**, **Import…** and **Export all**. Select rules to turn them on or off together, tag or untag them, add them to a set, export them or delete them.

**Sets** are the app's name for [groups](./tags-groups.md#groups): rules you turn on and off together, such as everything to pause while you're away. Each set has **Show**, **All on**, **All off** and **Change…**.

**Families** are rules whose names suggest one purpose, such as "Porch light on" and "Porch light off". A family can offer **Combine…**, which makes one rule out of them. The new rule starts on any of the members' moments, and each member becomes an if/otherwise step holding its own checks and steps. The old rules keep running until you save. Saving turns them off and keeps them, so you can go back. Rules that differ in cooldown, run mode or logging can't be combined this way.

## Making and changing a rule

**+ New automation** offers starting points ("Keep in step", "A button toggles", "Off after a while", "At a time of day") or "Start from nothing". The editor has these parts:

- **Name**.
- **When**: the moment that starts the rule. **+ Or when…** adds another, and any of them starts it.
- **Only if (checked at that moment)**: checks added with **+ Add a check**. All must pass.
- **Do**: steps added with **+ Add a step**.
- **More**: run mode, rest after running, priority (-1000 to 1000), tags, the three logging switches, the two script gates ("Only while" is `required_expression`, "Only when its moment also has" is `trigger_condition`), the trigger label and the rule's own values (`variables`).

The editor offers these kinds by name. Everything else is under "Something else", as a form built from what your homeCore reports it supports.

| Part | Choices in the app | Rule types |
|---|---|---|
| When | A device changes, A time of day, Sunrise or sunset, A mode changes, homeCore starts, Every so often, A webhook is called, An alert | `DeviceStateChanged`, `TimeOfDay`, `SunEvent`, `ModeChanged`, `SystemStarted`, `Periodic`, `WebhookReceived`, the alert triggers |
| Only if | A device is…, A mode is on or off, It's between two times, Any of these, An alert is (or isn't) active | `DeviceState`, `ModeIs`, `TimeWindow`, `Or`, `AlertActive` / `NoAlertActive` / `TriggerAlertActive` |
| Do | Set a device, Run a scene, A room's lights, Wait, If / otherwise, Tell someone, At the same time, Turn a mode on or off, Act on alerts | `SetDeviceState`, `ActivateScenePerMode`, `RoomOn` / `RoomOff`, `Delay`, `Conditional`, `Notify`, `Parallel`, `SetMode`, the alert steps |

An if/otherwise step reads **If**, **Then**, **Otherwise, if** and **Otherwise**. Its question can be checks or a Rhai script ("Asks (a script)").

The **JSON** tab shows the rule as homeCore stores it, and anything the visual editor can't draw is kept as written. The editor doesn't edit RON. A rule's page shows its RON, read-only, under **As text**.

Save stays off until the rule is complete. A list above the editor says what's missing: a name, a device still to choose, at least one step, or a question for an if/otherwise. An unsaved draft is kept in your browser, so leaving the page doesn't lose it. If someone else saves the same rule meanwhile, the app says so before you replace their change.

## Testing and running

**Test** in the editor dry-runs the draft before you save it. A rule's page has the same test under **Test it**, with **Now** or **At a time…**. At another time, times of day and "how long" checks move to that time, while devices and modes stay as they are now. The result says whether it would run and marks each check yes or no. Nothing is done to the house.

**Run it now** runs the rule as if its moment came, even while it's turned off. **Run it** lets its checks decide. **Do its steps, skipping its checks** skips them.

**Recent runs** lists the last 20 times the rule's moment came, by day. Each says **Ran**, **Ran, with a failure**, **Resting** (inside its cooldown), **Paused**, **Skipped** or **Didn't run**, and opens to show the moment, each check and each step. These are the same records as `GET /automations/{id}/history`.

The rule's page also has **Make a copy** (the copy starts turned off), **Export** (one rule as JSON), tags, **Change** and **Delete…**.

## Alerts

An alert can start an automation. **Do something…** on an alert, or in **Settings › Alerts**, opens the editor with the moment filled in. See [Alerts that start automations](./alert-automations.md).

## The Assistant

If the [Assistant](../plugins/assistant.md) plugin is installed, you can ask it in the chat to set up an automation. It answers with a card that shows the rule as **When**, **Only if** and **Do**, with the stored JSON underneath. Press **Save and turn on** or **Save, turned off**, or type what to change. Changes to an existing rule get **Save changes** or **Not now**, and so do turning a rule on or off and deleting it. After saving, **Open in editor** opens the rule here.

The Assistant never does more than the person asking may do. A household member can't make or change automations through it. An admin can turn off **Make and change automations**, or turn off **Ask before every change** so changes go through without the card. A rule that names a device marked Security (locks, doors and the like) is refused unless an admin has allowed **Locks, doors and security**.

The Assistant doesn't dry-run a rule before proposing it, so test it here if you're unsure.
