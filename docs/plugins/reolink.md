---
id: reolink
title: Reolink
sidebar_label: Reolink
sidebar_position: 16
---

# Reolink (`hc-reolink`)

This plugin connects Reolink cameras, NVRs and Home Hubs on your home
network. It reports what each camera sees (motion, a person, a vehicle, an
animal, a package) as soon as the camera does, keeps a snapshot of each
detection, and lets rules and cards switch spotlights, move PTZ cameras and
play live video. It has been tried on an RLN36 NVR with E1 Outdoor SE and
Duo 3 cameras, and on those cameras on their own.

## Adding cameras

Open the plugin's page (Settings › Plugins › Reolink) and add a row for each
address: a camera on its own, or an NVR or Home Hub, whose cameras arrive as
its channels. Give it a name, its address, and an account on it.

| Field | |
|---|---|
| Name | what it's called in homeCore. Its cameras' ids are made from it, so keep it once set. |
| Address | host name or IP, with `:port` if it isn't the usual one |
| Username, password | an account on the camera or NVR (see below) |
| HTTPS | on unless you turned HTTPS off on the device; Reolink's certificates are self-signed, and that's accepted |
| RTSP port | 554 unless you changed it, for live video |
| Push port | 9000 unless you changed it, for events as they happen |

**Use an account of its own.** A Reolink device allows only a few sessions at
once. The plugin signs in once per address, keeps that one session and gives
it back when it stops, so it doesn't use up the sessions the Reolink app
needs. The plugin offers only what the account may do: an account that may
only watch gets no spotlight, siren or PTZ controls, and the plugin raises an
alert saying so.

**A wrong password locks the device for a while.** Reolink locks an account
for five minutes after five refused sign-ins. After one refusal the plugin
waits ten minutes before trying again, so a typo can't lock you out of the
Reolink app as well.

A camera with two lenses (a Duo) becomes a camera per lens, with one
spotlight and one siren between them.

## What you get

Each camera is a `camera` device named `reolink_<name>`, or
`reolink_<name>_<channel>` for an NVR's. Its spotlight is a `light` device
(`<camera>_spotlight`) and its siren a `siren` device (`<camera>_siren`) of
their own, so cards, rules and scenes treat
them like any other light or siren.

A camera reports:

| Reading | |
|---|---|
| `motion` | moving |
| `person_detected`, `vehicle_detected`, `animal_detected`, `package_detected` | what the camera's AI sees, for the models that have it |
| `pushed` | a doorbell's press, as a button press |
| `snapshot` | the newest snapshot |
| `ir_mode` | infrared `auto` or `off` |

**Events arrive as they happen.** The plugin listens to Reolink's push
(port 9000) and still asks every 30 seconds in case a push was missed. With
push off, it asks every `poll_secs` (2 seconds unless changed).

**Snapshots** are taken when a detection starts, and on request with the
`take_snapshot` action. The newest 20 per camera are kept (`snapshots_kept`).

**PTZ cameras** have `ptz_move` (left, right, up, down, zoom in or out, for
half a second unless you say otherwise) and `goto_preset` with the presets
saved on the camera.

## On Home

A camera's card shows its live picture, or its newest snapshot if live video
isn't set up, with its spotlight and what it last saw. Its panel adds the
detections, PTZ and presets, and infrared. In Lit, cameras have a Cameras
section of their own in each room.

**The Cameras card** (Add › Cards › Cameras) shows several cameras in one
card. Its settings choose which, and whether they play live. At its large
size the first four play live and the rest show snapshots; a tile opens that
camera.

## Rules

- **Detections** are ordinary readings: "Driveway camera sees a person"
  triggers on `person_detected` turning on.
- **A doorbell** is a button: the rule editor offers "Front door doorbell
  rings", which is a `ButtonEvent` with `event: Pushed`.
- **A picture with a notification.** A Notify step can send a fresh
  snapshot from a camera to Telegram, Pushover or email. See
  [Notify](../rules/actions#notify).

## Live video

Live video goes through [go2rtc](https://github.com/AlexxIT/go2rtc), which
turns a camera's stream into what a browser plays. Set go2rtc's address in the
plugin's settings (`[reolink.go2rtc] url`), and the plugin adds
`reolink_<camera>` (the sub stream, H.264) and `reolink_<camera>_hd` (the
main stream) to it and keeps them current. It never touches a stream whose
name doesn't start with `reolink_`. If you already have go2rtc streams for
your cameras, turn off `add_streams` and name them in each row's `streams`
setting instead.

The app plays them from its own address. Set `HC_GO2RTC_URL` on the app's
container to go2rtc's address as the app reaches it
(`http://127.0.0.1:1984` on host networking). The app passes on only go2rtc's
addresses for watching, and only to someone homeCore says is signed in, so
go2rtc's own API (where the cameras' passwords are) stays out of reach.

Without go2rtc, cameras show their snapshots.

## Settings

| Setting | |
|---|---|
| Hosts | the cameras, NVRs and Home Hubs, as above |
| Push | events as they happen (default on) |
| Check every | `poll_secs`, how often to ask with push off (default 2 seconds) |
| Snapshots kept | per camera (default 20) |
| Siren times | how many times the siren sounds (default 3) |
| go2rtc | its address, and whether the plugin adds its own streams |

## Not covered

Recordings and playback stay in the Reolink app, and two-way audio isn't
supported. The plugin talks only to devices on your network, never through
Reolink's cloud.
