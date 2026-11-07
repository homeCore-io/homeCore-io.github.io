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
app comes with two, and drawings can come from plugins and
[UI extensions](./extensions.md) too.

Looks need app v0.1.46 or later.

## Classic and Lit

- **Classic** is the app as it has always been: a card for each thing, with a
  switch on it. A house that chooses nothing stays Classic.
- **Lit** draws each room as a lit room:
  - lights you drag across to dim, and switches as rockers;
  - scenes as swatches of their colors;
  - doors, garage doors and locks drawn as what they are;
  - readings with their day, and quiet sensors in a Watching list.

  A room opens over Home instead of leaving the page, and Back closes it.

**Settings › Look** chooses the house's look, which everyone sees unless they
choose their own under **Me**. A display follows the look it was given.

Each look keeps its own arrangement of Home and the rooms, so moving a card in
Lit doesn't move it in Classic.

## Arranging

In every look, **Edit › Just for me** and **Edit › For everyone** (for people
who may edit the house's pages) let you drag cards and sections, add things
from the Add sheet by dragging them where they go, and resize a card by
dragging its corner. Everything dragging does can also be done without it,
from a card's menu or with the keyboard.

## Stacks

A stack is one tall card holding several things, for a room with more
switches than it has room for. Things of any kind mix: switches, lights,
sensors, locks and scenes, each with its own control. A switch flips, a
scene runs, a lock locks (and asks before unlocking, where it's set to),
and a sensor shows its state. Tapping a name opens the device.

- **Adding one.** While arranging, **Add › Cards › Stack**. Its settings open
  beside the page, and the page makes room for them; tick the things it holds
  (this room's first, the whole house by search or kind), and reorder or take
  them out there.
- **Moving things in and out.** Drop a card on a stack to put it in, or drag
  a line out of one to give it its own card again. A card's **Move to** lists
  the page's stacks too. A thing in a stack leaves its own card, so it's on
  the page once.
- **How it looks.** A list, pills, rockers like wall switches, a keypad, or
  what's on or open first with the rest folded. One to four cards wide, its
  things in one column or two, so long names fit; as tall as its things, or one
  to six cards tall, scrolling inside. Drag its corner to size it both ways; a
  click on the corner fits it to its things again. Its heading counts what's
  on and open, and **All off** turns off its switches.
- **Made by a look.** In the look editor's Rooms tab, a section can start
  **in a stack from** a number of things: a room with that many starts that
  section as one stack, which anyone can change like their own. A stack
  someone filled keeps its things over one a look filled.

## Making your own

Open the look editor from Settings › Look (for the house) or Me (for
yourself) and start from Classic or Lit. Its tabs:

| Tab | What it holds |
|---|---|
| Drawings | how each family is drawn: lights, switches, scenes, doors and locks, readings, watching, players and thermostats, each shown with one of your own things |
| Feel | spacing, corners, type size, and motion (still, gentle or lively) |
| Colors | its theme, and whether lights show their own colors |
| Frame | the room's header and its status chips, what needs someone first, folding what's rarely used, a display's rest view, and whether a room opens over Home |
| Rooms | how every room is grouped into sections |
| Home | Home's sections, their order and layout |
| Displays | how a display at rest looks |
| Reaches | whether it stops at household pages and displays, or reaches Settings too |

**What changed** lists how your look differs from the one it came from, so
you can always find your way back. A look can be exported to a file and
imported again, here or in another house.

### Drawings made in the editor

**Make a drawing…** under a family builds one from parts (its shape, what
fills it, which of its symbol, name, state, level and bar show, and what a
tap does) and expressions that read the thing's values:

```text
on ? (level > 60 ? "Bright" : "Low") + " · " + room : "Off"
round(temperature, 1) + "°"
```

Expressions can read the thing's values, compare them, do arithmetic, pick
between values and format them, and nothing else. `temperature` is in °C, as
homeCore keeps it; `state` is the thing's state already in your units
("69.6°F · 54%"). Anyone who may make a look
can make one.

Admins can also give a drawing its own HTML, CSS and JavaScript (its Code
tab). That code runs walled off from the page, and has a moment to draw
before it is stopped.

### Drawings from plugins and extensions

A plugin can offer drawings, room headers, rest views and symbols, and a UI
extension can offer drawings. Once installed, they appear in the editor's
rows beside the built-in ones, named with where they come from. If one goes
away (its plugin is removed, or it fails to load), what used it is drawn as
Classic draws it.

## Motion

A look's motion is still, gentle or lively. Still never moves; gentle plays a
change and settles; lively also plays loops, such as an animated thermostat's
rising heat. Someone whose device asks for less motion always gets still.
