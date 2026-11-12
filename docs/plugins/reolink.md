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

A camera with two lenses (a Duo) is one camera, because it joins its lenses
into one picture.

## What you get

Each camera is a `camera` device named `reolink_<name>`, or
`reolink_<name>_<channel>` for an NVR's. Its spotlight is a `light` device
(`<camera>_spotlight`) and its siren a `siren` device (`<camera>_siren`) of
their own, so cards, rules and scenes treat
them like any other light or siren.

A siren sounds while it's on: `{"on": true}` starts it and `{"on": false}`
stops it. So none is left sounding, the plugin stops it after
`siren_max_secs` (60 seconds unless changed, 5 to 600) and whenever the
plugin itself stops. The `sound` action plays it a few times instead
(`times`, 1 to 10). A siren is offered only when the camera account the
plugin signs in with may use it.

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
turns a camera's stream into something a browser can play. Without go2rtc,
cameras show their snapshots.

### Plugin settings

In the plugin's **go2rtc** section:

| Setting | What to put |
|---|---|
| go2rtc address (`url`) | go2rtc's web address as the plugin reaches it, usually `http://127.0.0.1:1984`. Leave it empty for snapshots only. |
| Add the cameras' streams to go2rtc (`add_streams`) | On (the default) and you're done: the plugin adds each camera's streams to go2rtc itself. |

With **Add the cameras' streams to go2rtc** on, the plugin gives go2rtc two streams per camera,
`reolink_<camera>` (the sub stream, H.264, which every browser plays) and
`reolink_<camera>_hd` (the main stream), and keeps them current when a
password or address changes. go2rtc saves them in its own config, so they
outlast a restart. The plugin never touches a stream whose name doesn't
start with `reolink_`, so streams you set up yourself are left alone.

### Using streams you already have

If your go2rtc already has streams for these cameras (for a camera wall, say),
turn **Add the cameras' streams to go2rtc** off. Each row in Hosts then shows two more fields:

| Field | What to put |
|---|---|
| go2rtc streams | the names of your go2rtc streams, one per camera. For a camera on its own, that's one name. For an NVR or Home Hub, the first name is channel 1's camera, the second channel 2's, and so on; leave an entry blank for a channel you skip. |
| go2rtc streams, HD | the same for high-definition streams, if you have them. Leave it empty if not. |

A stream's name is its key under `streams:` in go2rtc's config. With this
go2rtc.yaml:

```yaml
streams:
  driveway: rtsp://user:password@192.168.1.20:554/h264Preview_01_sub
  driveway_hd: rtsp://user:password@192.168.1.20:554/h264Preview_01_main
```

you would put `driveway` in **go2rtc streams** and `driveway_hd` in
**go2rtc streams, HD**. Use a sub stream for the first: browsers play H.264,
and many Reolink main streams are H.265. A camera with no name in the list
shows snapshots.

### The app

The app plays the streams from its own address. Set `HC_GO2RTC_URL` on the
app's container to go2rtc's address as the app reaches it
(`http://127.0.0.1:1984` on host networking, `http://go2rtc:1984` if go2rtc is
a service in the same compose file). The app passes on only go2rtc's
addresses for watching, and only to someone homeCore says is signed in, so
go2rtc's own API (where the cameras' passwords are) stays out of reach.

## Settings

| Setting | |
|---|---|
| Hosts | the cameras, NVRs and Home Hubs, as above |
| Push | events as they happen (default on) |
| Check every | `poll_secs`, how often to ask with push off (default 2 seconds) |
| Snapshots kept | per camera (default 20) |
| Siren times | how many times the `sound` action plays the siren (default 3) |
| Siren stops after | `siren_max_secs`, the longest a siren turned on keeps sounding (default 60 seconds) |
| go2rtc | its address, and whether the plugin adds its own streams |

## Not covered

Recordings and playback stay in the Reolink app, and two-way audio isn't
supported. The plugin talks only to devices on your network, never through
Reolink's cloud.
