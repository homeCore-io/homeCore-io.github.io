---
id: looks
title: Looks
sidebar_label: Looks
sidebar_position: 2
---

# Looks

A look is how the house is drawn: how each kind of thing looks, the spacing
and motion of the page, its colors, the frame around it, and how each room
is grouped. You choose a look as a whole, change it, or make your own. The
app comes with three. Drawings can also come from plugins and
[UI extensions](./extensions.md).

## The built-in looks

**Classic** is a card for each thing, with a switch on it.

**Lit** draws each room as a lit room. Lights are bars you drag across to
dim, switches are rockers, and scenes are swatches of their colors. Doors,
garage doors and locks are drawn as what they are. Readings show their day,
and quiet sensors sit in a Watching list. A room opens over Home instead of
leaving the page, and Back closes it.

**Console** is the look a house gets when it chooses nothing. It puts the app in a desktop frame: a toolbar, a sidebar of
Everywhere views and rooms, and each room's devices in tabs with faders and
switches like a lighting desk. It has its own Home with lit room tiles, a
favorites and scenes row and a weather band, plus a phone layout and a
tablet rail. You change Console's rooms with **Customize** instead of the
look editor. Each person chooses their own fader style, switch style and sidebar
from the menu under their picture. See the
[Web UI overview](./overview.md#getting-around-in-console).

**Settings › Look** sets the house's look, which everyone sees unless they
pick their own on **Me** (or Look in Console's picture menu). Each display
has a Look setting of its own in Settings › Displays.

Classic and Lit each keep their own arrangement of Home and the rooms, so
moving a card in Lit doesn't move it in Classic.

## Arranging

In Classic, Lit and looks made from them, **Edit › Just for me** and
**Edit › For everyone** (for people who may edit the house's pages) let you
drag cards, add things from the Add sheet by dragging them where they go,
and resize a card by dragging its corner. Everything dragging does can also
be done from a card's menu or with the keyboard.

## Stacks

A stack is one tall card holding several things, for a room with more
switches than it has space for. Things of any kind mix: switches, lights,
sensors, locks and scenes, each with its own control. A switch flips, a
scene runs, a lock locks (and asks before unlocking, where it's set to),
and a sensor shows its state. Tapping a name opens the device.

To add one while arranging, choose **Add › Cards › Stack**. Its settings
open beside the page. Tick the things it holds (this room's first, or the
whole house by search or kind), and reorder or remove them there.

To move things in and out, drop a card on a stack, or drag a line out of a
stack to give it its own card again. A card's **Move to** lists the page's
stacks too. A thing in a stack leaves its own card, so it shows on the page
once.

A stack can be a list, pills, rockers like wall switches, a keypad, or
what's on or open first with the rest folded. It is one to four cards wide,
with its things in one column or two. It can be as tall as its things, or
one to six cards tall and scroll inside. Drag its corner to size it, and
click the corner to fit it to its things again. Its heading counts what's on
and open, and **All off** turns off its switches.

In the look editor's Rooms tab, a section can start **in a stack from** a
number of things. A room with that many things starts that section as one
stack, which anyone can then change. A stack someone filled by hand wins over
one the look filled.

## Making your own

Open the look editor from Settings › Look (for the house) or Me (for
yourself). **Make** copies the chosen look under a new name, and **Change**
opens a look of your own in the editor. Its tabs:

| Tab | What it holds |
|---|---|
| Drawings | How each family is drawn: lights, switches, scenes, doors and locks, readings, watching, players and thermostats, each shown with one of your own things. |
| Feel | Spacing, corners, type size, and motion (still, gentle or lively). |
| Colors | Its theme, and whether lights show their own colors. |
| Frame | The room's header and its status chips, what needs someone first, folding what's rarely used, a display's rest view, and whether a room opens over Home. |
| Rooms | The rows of named areas a room is laid out in, and what starts in each. |
| Home | Home's areas, their order and layout. |
| Displays | How a display at rest looks. |
| Reaches | Whether it stops at household pages and displays, or reaches Settings too. |

**What changed** lists how your look differs from the one it started from,
so you can always find your way back. **Save to a file** exports a look, and
**Add a look from a file** brings it in again, here or in another house.

### Drawings made in the editor

**Make a drawing…** under a family builds a drawing from parts: its shape,
what fills it, which of its symbol, name, state, level and bar show, and
what a tap does. Text comes from expressions that read the thing's values:

```text
on ? (level > 60 ? "Bright" : "Low") + " · " + room : "Off"
round(temperature, 1) + "°"
```

Expressions can read values, compare them, do arithmetic, pick between
values and format them, and nothing more. `temperature` is in °C,
as homeCore keeps it. `state` is already in your units ("69.6°F · 54%").
Anyone who may make a look can make a drawing.

Admins can also give a drawing its own HTML, CSS and JavaScript in its Code
tab. That code runs walled off from the page and gets a short time to draw
before it is stopped.

### Drawings from plugins and extensions

A plugin can offer drawings, room headers, rest views and symbols. A UI
extension can offer drawings. Once installed, they appear in the editor
beside the built-in ones, named with where they come from. If one goes away
(its plugin is removed, or it fails to load), whatever used it is drawn the
way Classic draws it.

## Motion

A look's motion is still, gentle or lively. Still never moves. Gentle plays a
change and then settles. Lively also plays loops, such as an animated
thermostat's rising heat. If your device asks for less motion, you always
get still.
