---
id: rooms
title: Rooms
sidebar_label: Rooms
description: A room in the Console, with Room on and Room off, a tab for each kind of device, light faders and scenes, and the room's audio.
---

import Shot from '@site/src/components/Shot';

# Rooms

Each room has a page of its own, with its picture lit by its lights and a tab for each kind of thing in it: lights, media, climate, doors, water and sensors. Open a room from its tile on [Home](./home.md) or from the sidebar, and use the ‹ › arrows beside its name to step through the house.

<Shot
  src="/img/screens/room-main.png"
  width={1145}
  height={1228}
  alt="The Family Room in the Console: its picture with Room on and Room off, chips and a door pill, tabs for Lights, Doors, Media, Climate and Sensors, Hue and Lutron faders, Hue scenes, a switch, and the room's audio bar."
  pins={[
    [1, 83, 11.5],
    [2, 45, 17],
    [3, 1.3, 22.3],
    [4, 1.3, 36],
    [5, 1.3, 44.6],
    [6, 66, 29.9],
    [7, 50, 95.5],
  ]}
  legend={[
    ['Room on and Room off.', 'Switch every light in the room, and bring them back the way they were.'],
    ['Chips and pills.', 'The temperature, how many lights are on and what\'s playing, then the room\'s locks and doors: green when locked or closed, red when not.'],
    ['Tabs.', 'One for each kind of device in the room, with a count. A tab shows only when the room has something for it.'],
    ['Light faders.', 'One column per lighting system, starting with an All fader for the group. Drag a fader to dim.'],
    ['Scenes.', 'A Hue group\'s scenes sit under its faders. All shows the rest.'],
    ['Switches.', 'Lights and plugs that only switch on and off.'],
    ['Room audio.', 'What the room\'s screen or speaker is playing, which device it plays through, and its volume.'],
  ]}
/>

## Room on and Room off

**Room off** remembers which lights were on, how bright, their color and any scene that was running, then turns them all off. **Room on** brings back exactly that: the scenes first, then the lights. With nothing saved, Room on turns every light in the room fully on.

homeCore keeps the saved state in core, so it works from any screen, from the API (`POST /api/v1/areas/{id}/on` and `/off`) and from [automations](../rules/actions.md). It survives a restart and stays after Room on; the next Room off that finds a light on saves a new one.

Room on and Room off reach the room's lights. They leave camera spotlights, light groups and scenes alone. They need the `devices:command` permission.

## The header

Under the room's name, chips show the temperature, how many lights are on and how many things are playing. Pills follow for the room's locks and doors:

- A lock pill says **Locked** or **Unlocked**. Tap it to lock at once. Unlocking may ask first, if the household set that up.
- A door pill says **Open** or **Closed**. Tap it to open the tab the door is on.

**Customize** changes how the room is laid out (see [below](#customize-a-room)).

## The tabs

A room opens on **Lights**, or on **Doors** when the room has a door that opens, like a garage. The household can move any device to another tab, and Customize can reorder or hide tabs.

| Tab | What's on it |
|---|---|
| **Lights** | A column per lighting system (Hue, Lutron, switches, keypads), each with an **All** fader, a fader per lamp and the group's scenes. Lamps that only switch get a switch. |
| **Switches** | Lights and plugs that only switch, when Lights would be too crowded. A numbered set gets **All on** and **All off**. Plugs show their power draw. |
| **Media** | TVs and streaming players with power, apps, a home button and a remote, then speakers. One to three speakers show as cards with their artwork; four or more become a mixer. |
| **Climate** | Thermostats as dials, with the switch each one runs, and fans with their speeds. |
| **Doors** | Garage doors drawn large with **Open door** and **Close door**, then other doors and locks. Opening and unlocking ask first; closing and locking act at once. |
| **Water** | Leak sensors (**Dry** or **Water!**) and valves. **Shut off water** acts at once; **Turn water on** asks first. |
| **Sensors** | Temperatures with humidity, a **Watching** list for motion and contact sensors, and batteries. Nothing here switches. |
| **Cameras** | The room's cameras, with one large and live, and the day's events under **Here today**. |
| **Timers** | The room's timer helpers. |

### Lights and scenes

Drag a fader to dim; the number above it is the level. The **All** fader moves the whole group. Under a Hue group, its scenes show as chips, and the caption names the one that's on. **All** shows every scene, and **Fewer** folds them again.

Tap a lamp's name to aim the scenes at that lamp alone. The caption changes to "Scene for" the lamp, with **Details** to open it.

The **⋯** beside a device lets someone who may change the console move it to another **Room** or **Tab**, or **Put back** where it came from. That change is for the whole household, and the device is tagged "moved here".

## Room audio

When a room has media, a bar runs along the bottom with what's playing and its controls. **Plays through** chooses the room's audio device: one of the room's screens or speakers, a device elsewhere in the house, or **None**. Volume has mute, down, up and a slider. A Roku reports no level, so it steps up and down instead.

## Customize a room

**Customize** shows the room with outlines on what can change:

- favorites: drag to reorder, unpin, or **Pin a favorite**
- tabs: reorder or hide them; the ★ picks the tab the room opens on
- the Lights tab: reorder its columns and hide single lights

A side panel sets the room's audio device, its picture (**Drawn**, **Photo** or **Plain**), which locks and doors show as header pills, and your own controls style.

If you may change the household's layout, choose **Everyone** to change it for the whole house or **Just me** to change it for yourself. Everyone else changes only their own. **Undo** steps back as far as you need, and **Done** leaves.

:::tip Pick your own faders and switches
The menu under your picture has **Faders and switches**: faders come as **Machined**, **Glass pill** or **Light bar**, and switches as **Precision**, **Keypad** or **Off · On**. Your choice follows you to every screen you sign in to.
:::
