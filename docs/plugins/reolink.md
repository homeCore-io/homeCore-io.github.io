---
id: reolink
title: Reolink
sidebar_label: Reolink
sidebar_position: 16
---

# Reolink (`hc-reolink`)

This plugin connects Reolink cameras, NVRs and Home Hubs on your home network.
It reports what each camera sees (motion, a person, a vehicle, an animal, a
package) as soon as the camera does, keeps a snapshot of each detection, and
lets rules and cards switch spotlights, sound sirens, move PTZ cameras and play
live video. It talks to the devices directly on your network and doesn't use Reolink's
cloud. It has been tested on an RLN36 NVR with E1 Outdoor SE and Duo
3 cameras, and on those cameras on their own.

## Before you start

- Each camera, NVR or Home Hub needs an address on your network that the
  machine running homeCore can reach. Give it a fixed address in your router.
- The plugin uses Reolink's HTTP API (HTTPS on port 443 by default, or HTTP)
  and Reolink's push on port 9000. Live video comes from RTSP on port 554,
  through [go2rtc](https://github.com/AlexxIT/go2rtc).
- Create an account on each device just for homeCore. A Reolink device allows
  only a few sessions at once. The plugin signs in once per address, keeps
  that one session and gives it back when it stops, so it doesn't use up the
  sessions the Reolink app needs.
- The plugin offers only what that account may use. If the account may not
  use the spotlight, siren or infrared, those controls are left out and the
  plugin raises an alert saying so.

## Install and set up

1. Install **Reolink** from Settings › Plugins › Catalog.
2. Open its settings (Settings › Plugins › Reolink) and add a row under
   **Cameras and NVRs** for each address: a camera on its own, or an NVR or
   Home Hub, whose cameras arrive as its channels. Usually only the name,
   address, user name and password need filling in.
3. Save. The plugin signs in to each address, finds out what it is, reads each
   camera's features from the device, and registers the cameras.

A camera with two lenses (a Duo) is one camera, because it joins its lenses
into one picture. The plugin looks for new or removed NVR channels now and
then, so a camera you add to an NVR shows up without a restart.

:::warning A wrong password locks the device for a while
Reolink locks an account for a few minutes after five refused sign-ins. After
one refusal the plugin waits ten minutes before it tries again, or until you
change the settings, so a typo can't lock you out of the Reolink app as well.
:::

### Live video

Live video goes through go2rtc, which turns a camera's stream into something a
browser can play. Without go2rtc, cameras show their snapshots.

Set **go2rtc address** under **Live video** to go2rtc's web address as the
plugin reaches it, usually `http://127.0.0.1:1984`. With **Add the cameras'
streams to go2rtc** on (the default), nothing else is needed. The plugin gives go2rtc two
streams per camera, `reolink_<camera>` (the sub stream, H.264, which every
browser plays) and `reolink_<camera>_hd` (the main stream). It keeps them
current when a password or address changes. go2rtc saves them in its own
config, so they outlast a restart. The plugin never touches a stream whose
name doesn't start with `reolink_`, so streams you set up yourself are left
alone.

If your go2rtc already has streams for these cameras, turn **Add the cameras'
streams to go2rtc** off. Each row under **Cameras and NVRs** then shows two
more fields, **go2rtc streams** and **go2rtc streams, HD**. List your go2rtc
stream names there, one per camera. For a camera on its own that's one name.
For an NVR or Home Hub, the first name is channel 1's camera, the second
channel 2's, and so on; leave an entry blank for a channel you skip. A stream's
name is its key under `streams:` in go2rtc's config. With this go2rtc.yaml:

```yaml
streams:
  driveway: rtsp://user:password@192.168.1.20:554/h264Preview_01_sub
  driveway_hd: rtsp://user:password@192.168.1.20:554/h264Preview_01_main
```

you would put `driveway` in **go2rtc streams** and `driveway_hd` in **go2rtc
streams, HD**. Use a sub stream for the first, since browsers play H.264 and
many Reolink main streams are H.265. A camera with no name in the list shows
snapshots.

The app plays the streams from its own server. Set `HC_GO2RTC_URL` on the
app's container to go2rtc's address as the app reaches it
(`http://127.0.0.1:1984` on host networking, `http://go2rtc:1984` if go2rtc is
a service in the same compose file). The app passes on only go2rtc's
addresses for watching, and only to someone homeCore says is signed in, so
go2rtc's own API (where the cameras' passwords are) stays out of reach.

## Settings

Each row under **Cameras and NVRs** (`reolink.hosts`) has these fields:

| Setting | Key | Default | What it does |
|---|---|---|---|
| Name | `name` | none | What it's called in homeCore. Its cameras' ids are made from it, so choose it before you write rules: renaming it later gives them new ids. |
| Address | `address` | required | Its IP address or host name on your network, with `:port` if it isn't the usual one. |
| User name | `username` | `admin` | An account on the camera or NVR. One of its own is best. |
| Password | `password` | required | That account's password. |
| HTTPS | `https` | on | Leave it on unless HTTPS is turned off on the device. Reolink's certificates are self-signed, and the plugin accepts them. |
| RTSP port | `rtsp_port` | 554 | Where it serves video, for go2rtc. |
| Push port | `push_port` | 9000 | Where it pushes events. |
| go2rtc streams | `streams` | empty | Your own go2rtc stream names. Shown only when **Add the cameras' streams to go2rtc** is off. |
| go2rtc streams, HD | `streams_hd` | empty | The same for HD streams. |

The rest of the settings:

| Setting | Key | Default | What it does |
|---|---|---|---|
| Events as they happen | `reolink.push` | on | Listens to Reolink's push, so motion and detections arrive at once. |
| Ask for detections every | `reolink.poll_secs` | 2 s | How often each address is asked what it sees when push is off or down. |
| Snapshots kept per camera | `reolink.snapshots_kept` | 20 | The newest snapshots kept for each camera. |
| The siren sounds | `reolink.siren_times` | 3 times | How many times the siren's `sound` action plays it (1 to 10), about five seconds each. |
| A siren turned on stops after | `reolink.siren_max_secs` | 60 s | The longest a siren turned on keeps sounding (5 to 600 s). |
| go2rtc address | `reolink.go2rtc.url` | empty | go2rtc's address as the plugin reaches it. Empty means snapshots only. |
| Add the cameras' streams to go2rtc | `reolink.go2rtc.add_streams` | on | Adds and maintains the `reolink_` streams in go2rtc. |
| Forward to core | `logging.log_forward_level` | `info` | The lowest log level sent to homeCore's log. |

## Devices

Each camera is a `camera` device with the id `reolink_<name>`, or
`reolink_<name>_<channel>` for an NVR's camera, where `<name>` is the row's
name in lowercase with spaces as `_` and channels count from 1. A camera's
spotlight is a `light` device (`<camera>_spotlight`) and its siren a `siren`
device (`<camera>_siren`), so cards, rules and scenes treat them like any
other light or siren. When an address stops answering, its devices show as
offline.

A camera reports:

| Attribute | Values |
|---|---|
| `motion` | `true` while it sees motion |
| `person_detected`, `vehicle_detected`, `animal_detected`, `package_detected` | what the camera's AI sees, on models that have it |
| `pushed` | a doorbell's press, as button `1`, on doorbells |
| `ir_mode` | infrared `auto` (when dark) or `off`, writable, where the camera has infrared |
| `snapshot`, `snapshot_at` | the newest snapshot and when it was taken |
| `stream`, `stream_hd` | the go2rtc stream names for live video |
| `model` | the camera's model |

Snapshots are taken when a detection starts (at most one every 10 seconds per
camera) and on request. After a restart, each camera shows its newest snapshot
from before.

Camera commands:

```json
{"ir_mode": "off"}
{"action": "take_snapshot"}
{"action": "ptz_move", "direction": "left", "duration_ms": 500}
{"action": "goto_preset", "preset": 2}
```

`ptz_move` and `goto_preset` exist only on PTZ cameras. `direction` is
`left`, `right`, `up`, `down`, `zoom_in` or `zoom_out`, and `duration_ms` is
100 to 5000 (500 if left out). `goto_preset` lists the presets saved on the
camera, and appears only when there are some.

A spotlight has `on` and `brightness_pct` (0 to 100 %), both writable:

```json
{"on": true, "brightness_pct": 80}
```

A spotlight turned on or off by something else (the camera's own motion
lighting or schedule, Reolink's app) shows in homeCore within a second or two.

A siren has `on`, which sounds it until it is turned off:

```json
{"on": true}
{"action": "sound", "times": 3}
```

`{"on": false}` stops it. So that none is left sounding, the plugin stops a
siren after **A siren turned on stops after** and whenever the plugin itself
stops. The `sound` action plays it a few times instead (`times`, 1 to 10), and
it goes quiet by itself. The app asks before it sounds a siren.

### In rules

Detections are ordinary readings, so "Driveway camera sees a person" triggers
on `person_detected` turning on. A doorbell is a button, so the rule editor
offers "Front door doorbell rings", a `ButtonEvent` with `event: Pushed`. A
Notify step can send a fresh snapshot from a camera to Telegram, Pushover or
email; see [Notify](../rules/actions#notify).

## Actions

The plugin has one action of its own, **Cameras and NVRs** (`status`,
read-only, 5 second timeout). It reports whether each address is signed in,
its model and its cameras, and the plugin's screens use it.

## Alerts

| Alert | Severity | When |
|---|---|---|
| A camera or NVR isn't answering (`host_unreachable`) | warning | Its cameras are offline until it answers again. |
| A camera or NVR refused the sign-in (`login_refused`) | warning | The user name or password is wrong, or the account is locked after too many tries. |
| A camera's account may not use everything it has (`account_limited`) | info | The account can't use the spotlight, siren or infrared, so those aren't offered. |
| A camera or NVR isn't pushing events (`push_down`) | info | Its detections are asked for every few seconds instead. |
| go2rtc isn't answering (`go2rtc_unreachable`) | warning | Cameras still report what they see, but there's no live video. |

All are on by default and clear by themselves. The plugin also shows a notice
on its page when no cameras are configured, and when no go2rtc address is
set.

## Screens and cards

- A camera's card shows its live picture, or its newest snapshot if live video
  isn't set up, with its spotlight and what it last saw.
- A camera's panel adds the detections, the spotlight with brightness, the
  siren, PTZ and presets, and infrared.
- In Lit, cameras have a Cameras section of their own in each room.
- The **Cameras** card (Add › Cards › Cameras) shows several cameras in one
  card. Its settings choose which, and whether they play live. At its large
  size the first four play live and the rest show snapshots. A tile opens that
  camera.

## Troubleshooting

- Events arrive by push, and the plugin still asks each address every 30
  seconds in case a push was missed. With push off or down, it asks every
  **Ask for detections every** seconds. A push connection that drops is tried
  again with a growing wait, up to five minutes.
- An address that stops answering is tried again with a growing wait, up to
  two minutes. Its cameras come back online when it answers.
- `login_refused`: check the user name and password. If the password is right
  and it still can't sign in, try turning HTTPS off for that row.
- If a camera's firmware won't sound its siren until it is stopped, the
  plugin plays the siren a few times instead.
- When homeCore stops or restarts the plugin, the plugin turns off any siren
  it started, signs out of each address and marks its devices offline before
  it exits.

## Known limits

Recordings and playback stay in the Reolink app, and two-way audio isn't
supported.
