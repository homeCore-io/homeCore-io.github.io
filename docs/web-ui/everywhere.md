---
id: everywhere
title: Everywhere
sidebar_label: Everywhere
description: The Console's house-wide views of lights, media, climate, security, water and cameras, each with one button for the whole house.
---

import Shot from '@site/src/components/Shot';

# Everywhere

The Everywhere views show one kind of thing across the whole house: every light, every player, every thermostat, every lock and door, every leak sensor and every camera. Each sits in the sidebar with a short status, such as "27 on", "3 playing" or "2 to check", so you can see at a glance where to look.

Each view has one button that reaches the whole house. Most ask before they act.

| View | Lists | For the whole house |
|---|---|---|
| **Lights** | Each room's lights, lit to their level | **Turn every light off** (asks first) |
| **Media** | Every player by room, with what's playing and its volume | **Pause everything** (asks first) |
| **Climate** | Thermostats, fans, then every temperature and humidity reading | **Fans off** |
| **Security** | What needs attention first, then each room's locks and doors | **Lock everything** (asks first) |
| **Water** | Wet sensors first, then valves and leak sensors | **Shut off all water** (asks first) |
| **Cameras** | Every camera, one large and live | |

## Lights

<Shot
  src="/img/screens/everywhere-lights.png"
  width={1403}
  height={956}
  alt="Everywhere › Lights: a row for each room with its lights drawn lit to their level, On and Off buttons, and Turn every light off."
/>

A row for each room shows its lights, each lit to its level. Tap a light to switch it. **On** and **Off** on each row are the room's [Room on and Room off](./rooms.md#room-on-and-room-off), so Off remembers how the room was. Lights with no room are listed last.

## Climate

<Shot
  src="/img/screens/everywhere-climate.png"
  width={1403}
  height={872}
  alt="Everywhere › Climate: thermostat dials heating and cooling, ceiling fans with Turn on and Turn off, and a list of temperature and humidity readings."
/>

Thermostats come first as dials, each with − and + to change its setpoint, and say whether they're idle, heating or cooling. Fans follow, with their speed and a button. Then every temperature and humidity reading in the house, with the room and plugin it comes from. A reading from a device with no room yet is marked **No room**.

## Security

<Shot
  src="/img/screens/everywhere-security.png"
  width={1403}
  height={619}
  alt="Everywhere › Security: attention pills for an open door and an unlocked lock with Show and Lock it, then each room's doors and locks, and Lock everything."
/>

What needs attention leads, as pills with **Show** or **Lock it**. Under it, each room lists its locks and doors, green when locked or closed and red when not. The **⋯** on a pill offers **Not for security**, for a door that doesn't matter here, such as an indoor one.

Leak sensors aren't in Security; they have the Water view.

## Media, Water and Cameras

**Media** lists every player by room, with what's playing, its volume and play or pause. **Pause everything** stops them all.

**Water** puts any wet sensor first, then valves and leak sensors. **Shut off water** on a valve acts at once, because a leak can't wait; **Turn water on** asks first.

**Cameras** shows one camera large and live, with a rail of snapshots of the others that refreshes every 8 seconds. **Grid** shows them all as equal snapshots. The day's camera events run along the bottom. Cameras appear in the sidebar only when the house has some.
