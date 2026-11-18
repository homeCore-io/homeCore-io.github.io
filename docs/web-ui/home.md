---
id: home
title: Home
sidebar_label: Home
description: The Console's Home screen, from the greeting and what needs attention to the weather, scenes, room tiles and what's playing.
---

import Shot from '@site/src/components/Shot';

# Home

Home is the first screen in the Console, the app's default look. It sums up the house in one view: what needs attention, the weather, your scenes, every room lit as it is now, and what's playing.

<Shot
  src="/img/screens/console-home.png"
  width={1395}
  height={1228}
  alt="The Console's Home: the sidebar with Everywhere views and rooms, a greeting, two attention pills, the weather band, the scenes row, a tile for each room and the playing bar."
  pins={[
    [1, 1.5, 12],
    [2, 18.9, 16.5],
    [3, 20.5, 24],
    [4, 18.9, 35],
    [5, 61, 48.5],
    [6, 18, 96.5],
  ]}
  legend={[
    ['Everywhere and Rooms.', 'The sidebar. Each Everywhere view shows a short status, such as "27 on" or "2 to check", and each room shows its temperature and a dot when its lights are on.'],
    ['What needs attention.', 'Up to four pills, such as an open door or an unlocked lock, each with a button that fixes it or shows it.'],
    ['The weather.', 'Now, the next 24 hours and the next few days, when a weather source is set up.'],
    ['Every light off and Scenes.', 'One button for the whole house, then the scenes you put on Home.'],
    ['Room tiles.', 'Each room\'s picture, lit live by its lights, with what is going on there.'],
    ['What\'s playing.', 'Media playing anywhere in the house. Tap one to open its room.'],
  ]}
/>

## The top of the page

Under the day and time, the greeting changes through the day: "Good morning", "Good afternoon", "Good evening", and "Good night" after midnight. The line below it sums up the house, for example "27 lights on in 10 rooms · 3 playing · 2 thermostats working · 2 things need attention", or "all secure" when nothing does.

## What needs attention

When something needs a look, it shows as a pill with a button:

| Pill | Button |
|---|---|
| A lock is unlocked | **Lock it** locks it at once |
| A door is open | **Show** opens the room's Doors tab |
| A device is offline | **Show** |
| An urgent alert, such as a leak or smoke | **Show** opens the room on the tab that has it |

Home shows up to four. When there are more, the last pill counts them and **See all** opens the alerts page.

## The weather band

The band shows the temperature now, the condition, today's high and low and what it feels like, then the wind, the humidity and any warning. **Next 24 hours** charts the temperature and the chance of rain. **Next 3 days** lists the coming days, and **Show 7 days** opens the rest of the week.

Someone who may change the household's content can choose where the weather comes from in the band's **From** menu. The band stays hidden until there is weather to show.

## Every light off and Scenes

**Every light off** turns off every light in the house. It asks first, because it reaches every room. Room on brings any one room back the way it was.

The scenes row runs the scenes chosen for Home. Tap one to run it. **Edit** opens **Scenes on Home**, where you add scenes with **Add a scene**, drag them into order and remove them. If you may change the household's content, choose **Everyone** to change the row for the whole house, or **Just me** to keep a row of your own. **Use the house's** drops your own row again.

Any favorites you pin follow the scenes. A lock or a switch toggles where it is; anything else opens its details.

## Room tiles

Each room has a tile with its picture, lit by the lights that are on. The tile names the room and says what is going on there, up to three things, such as "3 lights on · Roku playing · Heating", or "Quiet". The temperature sits in the corner. A tile ringed in red has something wrong, such as an open door or an offline device.

Tap a tile to open the [room](./rooms.md).

## What's playing

The bar along the bottom shows up to two things playing in the house, each with its artwork. Tap one to open its room's Media tab. The count on the right opens [Everywhere › Media](./everywhere.md).

## On a phone

A phone has a bar along the bottom with **Home**, **Rooms**, **Everywhere** and, when the house has cameras, **Cameras**. Home is the same screen in one column: scenes sit two across, and the weather's details open with **Show more**.

:::tip Make a screen open on a room
A wall tablet in the kitchen can skip Home and open on the Kitchen. Open the menu under your picture and set **This screen opens on**. It applies to that screen only.
:::
