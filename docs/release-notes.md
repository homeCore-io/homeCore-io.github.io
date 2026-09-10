---
id: release-notes
title: Release Notes
sidebar_label: Release Notes
sidebar_position: 99
---

# Release Notes

Detailed history of homeCore releases. Each entry summarises what
operators see — UI changes, stability fixes, configuration updates,
and any flags that affect upgrade. Per-component git tags and CI
state are tracked separately on the
[ci-glance dashboard](https://homecore-io.github.io/ci-glance/).

Component releases follow **per-component SemVer**; the `0.1.x`
cohort moves roughly together but not all components ship in every
patch round. The release matrix for each version below lists which
components were tagged.

**Every core release has an entry here**, including the rounds where
nothing an operator would notice changed — those say so. An entry is
written as part of cutting the release, because a tag with no entry is
a release nobody outside the workspace can find out about.

---

## v0.1.71 — 2026-09-10

**Theme:** Every value a device shows you is a value something can name.

### Attributes nothing declared

Reading the reference house back after the September schema work: **82 of 178
devices published at least one attribute their own schema never mentioned.**
An undeclared attribute still shows up — as a raw name and a raw value, with
nothing to label it, rank it, or fold it away as housekeeping.

Two unrelated causes, both closed.

**Hue's hand-written schemas covered the controls and stopped.** A light
declared four attributes and published nineteen — the bridge and resource ids,
its capability flags, the colour-temperature bounds. A scene declared whether
it was active and published eight. They are all described now, and demoted
where they are not readings, so a light's page leads with brightness rather
than with the id of the bridge it is on.

**homeCore stored its own bookkeeping as if the device had reported it.** A
WLED controller carried a `correlation_id` among its readings — homeCore's
term for "which command caused this", presented as something the light strip
had said. Provenance is stripped from device state now.

### Release matrix

**Tagged at v0.1.71:** `homeCore` (core), `hc-hue` 0.1.15.

### Upgrade notes

- **Restart hc-hue**, or press *Refresh devices* on it — either republishes the
  fuller schemas. The plugin gained that ability in 0.1.14 yesterday.
- Existing `correlation_id` values already stored on a device disappear the
  next time it reports.
- Nothing that was working stops: every attribute still has the same name and
  the same value, and more of them now have a label.

---

## v0.1.70 — 2026-09-09

**Theme:** A Z-Wave device stops calling itself "Z-Wave".

### Every Z-Wave node had the wrong type

Every node this plugin registered carried `device_type: "zwave"` — the
protocol it speaks, not the thing it is. A door lock, four outlets, a door
sensor and a motion sensor all arrived indistinguishable, so any client
filtering a list by type, choosing an icon, or deciding which reading to lead
with had nothing to work from.

zwave-js had been sending the answer on every node the whole time. The plugin
now reads it, and on the reference network that means:

| Node | What it registers as now |
|---|---|
| Living Room lock | `lock` |
| Four outlets and a plug | `switch` |
| Test Door Sensor | `contact_sensor` |
| Test Motion Sensor | `motion_sensor` |
| The controller itself | `gateway` |

The two sensors are worth a note: Z-Wave describes both of them identically —
"Notification Sensor" — so the class alone cannot separate a door sensor from
a motion sensor. What separates them is that one reports a contact and the
other reports motion, so that is what the plugin reads when the class runs
out.

A node that has not finished its interview yet says nothing rather than
guessing, and fills its type in on the next registration.

### Modes had no type at all

The two devices in the reference house reporting no `device_type` were both
modes — the only device family registering without one. They are `mode` now,
and lead with whether they are on.

### Release matrix

**Tagged at v0.1.70:** `homeCore` (core), `hc-zwave` 0.1.13.

### Upgrade notes

- **Restart hc-zwave to see the change.** Types are set at registration, so
  nodes keep their old `zwave` type until the plugin reconnects and
  re-registers them.
- **A dashboard or rule that filters on `device_type == "zwave"` will stop
  matching.** Nothing in homeCore does this by default, but a hand-written
  filter might; point it at the real type, which is what it wanted.
- Modes gaining a type is additive — nothing filtered on "no type".

---

## v0.1.69 — 2026-09-09

**Theme:** A device's declaration can change, and now says so.

### For anyone building against the API

**`device_schema_changed` is a new event.** It fires when a device changes
what it *declares* — the attributes and actions it says it has — rather than
when a value changes. The event carries the names, so a client can decide
whether it cares before refetching `GET /devices/{id}/schema`.

This matters because device schemas are not static, and became less so with
the September schema work. A Lutron phantom scene upgrades its own about a
second after the bridge connects, once its LED query is answered. The Ecowitt
plugin republishes when a sensor's set of readings changes. Hue republishes
when a sensor gains a facet, Z-Wave on a rescan. Until now nothing announced
any of it: a client showing controls built from the schema kept the old ones
until somebody reloaded the page.

**The event stream's documented type list was eight of twenty-one.** It had
never included `device_name_changed`, and nothing added since. All twenty-one
are listed now, checked against the code that names them, so filtering by
`?type=` can be written from the spec rather than by experiment.

### Unchanged

Nothing an operator does changes here, and no device behaves differently.
This is an addition to the API surface for the people writing against it.

### Release matrix

**Tagged at v0.1.69 (1 repo):** `homeCore` (core). No plugin changed.

### Upgrade notes

- **Nothing to do.** A client that ignores the new event behaves exactly as
  it did; one that subscribes to everything sees a new `type` it can ignore
  or act on.
- Core-owned devices — timers, counters, modes — do **not** emit this event.
  They write their schemas when the device is created, which a client learns
  about by the device appearing.

---

## v0.1.68 — 2026-09-09

**Theme:** An API key is a credential for the whole API.

Two things an API key could not do, both found while working out how a
wall panel should authenticate. If you use API keys, this release
matters; if you only ever log in with a password, nothing here changes
what you see.

### A key opened no stream

`/events/stream`, `/logs/stream` and the media route take their
credential in a `?token=` query parameter, because a browser cannot set
a header on a WebSocket upgrade. All three validated it as a JWT, so an
API key worked for every REST call and silently for none of these.

A display authenticated with a key would load its dashboard and then
never hear another word from the house — a frozen picture with nothing
saying why. All three now accept keys on the same terms as the header
path.

### `/auth/me` now says what the credential may do

It described the *user*: a key names its owner, so the profile and its
`role` were the owner's, while the key's real authority is the narrower
set of scopes it was issued with. Anything reading `role` and looking up
that role's rights gave a deliberately restricted key everything its
creator could do.

The response now carries `scopes` — what **this credential** may do, for
password sessions and keys alike. **If you authorise against `/auth/me`,
read `scopes` and not `role`.**

### Two smaller things that came with consolidating

- The event stream never checked token version, so a session ended by a
  password change could keep streaming. It does now, as the header path
  always has.
- The media route accepted a key in its `Authorization` header but not
  in its `?token=` parameter.

**Upgrade notes:** none, and no permissions change. A whitelisted caller
still receives `404` from `/auth/me`, which is correct — the bypass
trusts an address, not a person, so there is no profile to return.

---

## v0.1.67 — 2026-09-09

**Theme:** The spec says which version it is.

Nothing an operator will notice, and the entry exists because that is
still worth knowing.

v0.1.66 shipped with `docs/openapi.yaml` stamped `0.1.65`. The version
lives in two files — the crate manifest and the spec's `info.version` —
and only one of them was bumped, so a release described itself as its
predecessor. A test exists for exactly this and caught it, after the tag
had already gone out and its artifacts had been built.

This release stamps both. If you fetched the v0.1.66 spec and are
matching it against a running core, take this one instead; the described
API is identical.

**Upgrade notes:** none.

---

## v0.1.66 — 2026-09-09

**Theme:** Somewhere to put what you made.

Two new scopes, `content:read` and `content:write`, and nothing else.

**No permissions change today.** Reading joins the other reads, writing
joins authoring beside `dashboards:write` and `skins:write`, so the same
four roles may write — admin, user, rule_editor, service_operator — and
the same three may not. Nobody gains or loses access on upgrade.

**What they are for.** A client is starting to keep what a household
authored: widget templates, icon rules, the images somebody uploaded.
That content lives in core today only because the previous web client
compiled ahead of time and could hold nothing itself, which is why
`/assets` and `/dashboards/templates` exist. It is moving back to the
client that makes it.

What does *not* move is identity. The house has one set of users, roles
and revocations and it is core's, so a client presents the caller's own
bearer, asks `/auth/me` who it belongs to and `/auth/roles` what that
role may do, and enforces the answer itself. These two scopes are the
vocabulary for that conversation.

You will find them in `GET /auth/roles` and on no operation in the API
spec. That is deliberate: the thing they authorise is not here. The
OpenAPI preamble says so, so a reader who notices does not go looking
for a missing endpoint.

**Upgrade notes:** none. Existing tokens keep working; a client that has
not been taught the new scopes falls back to the dashboard ones.

---

## v0.1.65 — 2026-09-08

**Theme:** A chart asks for points, not rows.

Device history was returning every attribute of a device interleaved,
with no way to ask for one — so a client drawing six hours of a single
temperature fetched every reading that device had produced and threw
most of it away. On a sensor that reports a dozen attributes, a chart's
thousand-row budget could run out before reaching the one asked for, and
the chart came up empty on a device that plainly had the data.

History now takes an attribute filter and downsamples server-side.

**Upgrade notes:** none. The existing shape still answers.

---

## v0.1.64 — 2026-09-08

**Theme:** What the deployed house showed that the source did not.

A round of fixes found by running against a real 184-device house rather
than by reading code.

- **The Hue bridge declares itself** — the last device in the house with
  no capability schema. Every device now has one.
- **A WLED controller stops overwriting half of itself**, so its
  attributes no longer arrive with pieces missing.
- **A Roku stops reporting that time has passed** when nothing is
  playing, which had made it look like a device in constant motion.
- **Three filed issues closed**: an absent reading, a scale that
  misreported itself, and an advertisement a device made about a
  capability it did not have.

Also released alongside: hc-lutron 0.1.18, hc-yolink 0.1.14,
hc-zwave 0.1.12.

**Upgrade notes:** none.

---

## v0.1.63 — 2026-09-08

**Theme:** Every device says what it is.

A reference house of 184 devices had 107 with a capability schema. It now
has 184. The gap was never one problem: some devices had no schema
because core mis-wired its own, most because their plugin declared only
part of what it supports, and the rest because two schema fields that
already existed were set by nobody.

Between this entry and v0.1.6 the project moved to per-component
releases and shipped 56 core versions; those rounds are recorded in the
per-component tags and on the
[ci-glance dashboard](https://homecore-io.github.io/ci-glance/) rather
than here.

### What a client can do now that it could not

- **Tell a reading from a battery.** `AttributeSchema.category` marks a
  reading `diagnostic` (battery, signal, firmware, ip, model) or
  `config` (a setting). Absent means primary. The field has been in the
  schema for a while and read by the web UI for nearly as long — no
  plugin ever set it, so a lock's battery was declared exactly as
  primary as whether it was locked, and clients kept private lists of
  attribute names to demote. One lexicon in core now backs every plugin
  that builds attributes from a name.
- **Know which reading leads.** `DeviceSchema.primary` is an ordered
  list of the readings a device exists to report. A temperature/humidity
  sensor leads with temperature; a multi-sensor that reports motion
  leads with motion. homeCore derives it from the device's own type, so
  no plugin has to declare anything, and a plugin that knows better can
  override it. Before this, "the first attribute" was not even stable
  between two reads of the same device — the attribute map has no order.
- **Render a scene, a shade, a fan or a timeclock event.** See below.
- **Show an enum value in a person's words.** An attribute's options may
  now carry a label and an icon, matching what action parameters have
  always had. Accepted, not yet emitted: no plugin declares a label in
  this release, because a client that decodes options as plain strings
  must be updated first. An option carrying neither extra is still sent
  as the bare string it always was, so nothing changes on the wire yet.

### Added

- **Devices that declared nothing now declare themselves.** Lutron fans,
  shades, pulsed contact closures, phantom scenes, occupancy groups and
  timeclock events; every Caséta device except the Pico, which was the
  only one that had a schema before; Hue scenes, sensors and the bridge;
  the Ecowitt gateway; and core's own glue devices — timers, counters,
  groups and the rest.
- **A Lutron scene says whether its state can be trusted.** A phantom
  scene's state is its button's LED, and RadioRA 2 answers 255 — no
  state at all — for a button that has none, which is the shape a scene
  tied to a Pico has. Those scenes declare no `on`; the ones that really
  report declare it, and both publish the button and (where there is
  one) the LED behind it. A scene whose status a client cannot show can
  now say why.
- **A momentary output declares an empty attribute set**, which is a
  different statement from having no schema. A pulsed contact closure
  has nothing to read — the Integration Guide forbids querying one — and
  now says so rather than staying silent.

### Fixed

- **Core wrote glue-device schemas from a startup sweep that raced the
  manager that creates them.** A timer added through the API got no
  schema until the next restart, and one seeded from config could miss
  it entirely. Every path that creates a core-owned device now writes
  the schema with it.
- **Hue scenes could not be activated by the id their schema declares.**
  `{"action": "activate"}` is accepted alongside the older
  `{"action": "activate_scene"}`, so one action works across Hue and
  Lutron scenes.
- **A Lutron LED event could be attributed to the wrong scene.** Phantom
  LEDs are `button + 100` and keypad LEDs are `button + 80`, and both
  subtractions land on real button numbers — component 106 is button 6's
  LED, but 106 − 80 = 26 is a button someone may have a scene on. The
  reading that applies is now chosen rather than guessed.
- **A Lutron timeclock event ignored the attribute it publishes.** It
  reported `enabled` and accepted only `enable`, so a client echoing
  back what it had just read was silently dropped.

### Documentation

- The REST contract now describes `category`, `states`, `primary` and
  the attribute-option forms. All four were being served without being
  documented.
- [Devices → overview](./devices/overview) explains what a
  capability schema contains, rather than only how to fetch one.

### Release matrix

**Tagged at v0.1.63 (1 repo):** `homeCore` (core).

**Plugins tagged in the same round (7):** `hc-lutron` 0.1.18,
`hc-hue` 0.1.13, `hc-caseta` 0.1.12, `hc-ecowitt` 0.1.14,
`hc-yolink` 0.1.14, `hc-zwave` 0.1.12, `hc-isy` 0.1.11.

**Web UI:** `hc-web-flutter` 0.1.94 — reads `primary`, and accepts both
attribute-option forms.

**Skipped (no behavioural change):** `hc-roku` and `hc-thermostat` were
edited only to compile against the new option type; their published
schemas are byte-identical.

### Upgrade notes

- **Restart the plugins, not only core.** The two halves arrive by
  different routes: `primary` is computed by the API when it serves a
  schema, so it appears as soon as core is new enough — even for
  schemas stored by older plugins. Everything else (`category`, and
  every schema listed under *Added*) is published by the plugin as a
  retained MQTT message at registration, so a plugin that has not
  restarted is still silent.
- **A Lutron scene settles about a second after the bridge connects**,
  once its LED query is answered. Before that it declares status on the
  assumption that it has an LED, which is true of every phantom scene
  that is not tied to a Pico.
- **Nothing needs migrating and nothing needs purging.** A republished
  schema replaces the old one by device id, and every field added here
  is optional — a client that ignores them behaves exactly as it did.

---

## v0.1.6 — 2026-07-26

**Theme:** One artifact per component — and devices that no plugin owns.

Two unrelated bodies of work land together, because 0.1.6 is the first
tagged round since 0.1.5 in May.

### Deployment and release (operator-visible)

homeCore now ships as **two containers**, wired together by compose:

| Image | What it is |
|---|---|
| `ghcr.io/homecore-io/hc-core` | The REST/WebSocket API and the embedded MQTT broker. |
| `ghcr.io/homecore-io/hc-web` | The web UI. nginx serves the app and proxies `/api/v1/*` to core. |

- **The appliance image is retired.** `homecore-appliance` baked core and
  every plugin into one container. Plugins install at runtime from the
  signed registry, so the merged image was a different product from the
  one being shipped. Existing appliance images stay in GHCR and keep
  working; none are published any more. The
  `homecore-appliance-*.tar.gz` release archive is gone for the same
  reason.
- **hc-core no longer carries a web UI.** It used to bundle a Leptos WASM
  build. `hc-web` is the UI now, released for the first time at v0.1.6.
- **Repaired image tags.** `hc-core:latest`, `:0.1.5` and `:0.1.4` had all
  become unpullable — the tags existed but the amd64 child manifest each
  one referenced had been deleted in the 2026-05-11 GHCR cleanup incident,
  so `docker pull` failed with "content not found". v0.1.6 republishes a
  working `:latest`. The cleanup job now fails rather than pruning against
  an incomplete protected set, which is what allowed it.
- **amd64 only.** aarch64 tarballs and images had in practice not been
  produced for months — the matrix entry was switched off behind a
  hardcoded override while the release still advertised a multi-arch
  toggle. The pipeline now says amd64 and means it. If you need arm64,
  say so; restoring it is a small change.
- **The whole plugin registry is current.** Ten plugins had shipped
  versions well ahead of what the index served (`hc-lutron` was at 0.1.10
  against a published 0.1.4). All are reconciled, and `plugin.roku` is
  published for the first time.

Upgrade: `docker compose pull && docker compose up -d`. Installed plugins
live in the data directory, not the image, so they are untouched.

### Devices that no plugin owns

**Theme:** the silence around them.

A keypad button that had been dead since May turned out to be pointing
at a Hue group the Hue plugin had stopped managing back in April. The
device was still listed, still accepted commands, and still reported
state — the state just never changed again. Everything downstream
believed it.

This round fixes that button, deletes the devices behind it, and adds
the check that would have caught it in April.

### The failure, for anyone who might hit it

A device can outlive its plugin's interest in it. Turn off
`publish_grouped_lights` in the Hue plugin and its grouped lights stop
being registered — but homeCore's registration and retained state for
them persist. Such an **orphaned** device then fails silently in *both*
directions:

- **Commands vanish.** Plugins subscribe to command topics per-device,
  only for devices they registered. An orphan has no subscriber, so the
  broker drops its commands. No error, anywhere — and the rule engine
  still records the action as `fired: success`.
- **State freezes.** Its attributes stay at whatever they last were,
  forever, and rule conditions keep reading them as truth.

Together those wedge a toggle permanently. The affected keypad had:

```
Btn1 "On"  — condition: group.on == false → turn on    ← could never pass
Btn1 "Off" — condition: group.on == true  → turn off   ← always passed
```

The group was frozen `on: true`, so the "On" rule never fired *once* in
two months (`condition_failed`, 9 of 9 presses), the "Off" rule fired
every time, and its command evaporated at the broker. The button looked
broken; every layer reported success.

### Added

- **`GET /api/v1/devices/orphaned`** — finds devices homeCore holds that
  their owning plugin no longer manages.

  Detection is a **count comparison, not a staleness threshold**. Every
  management-capable plugin self-reports `device_count`; if core holds
  more devices for that plugin than the plugin claims, the difference is
  exactly the orphan count. Flagging on `last_seen` age is the obvious
  approach and is wrong — plugins that publish only on change leave
  healthy devices cold for months (a wall switch nobody flips is not
  orphaned), so an age rule cries wolf on exactly the quiet devices you
  care least about.

  Worth running once after upgrading. On the system this was found on it
  immediately turned up 11 more orphans in a *second* plugin, unrelated
  and unnoticed.

### Fixed

- **`hc-hue`** now reports a command sent to a Hue device it no longer
  manages — a `warn` plus a failed `plugin_command_result` — instead of
  silently discarding it as another plugin's device. (This covers a
  device pruned mid-run; a device orphaned across a restart is caught by
  `/devices/orphaned` above, since its command never reaches the plugin
  at all.)
- **`hc-hue`** warns, rather than staying quiet, when it skips the
  cross-restart reconcile that retires stale devices.
- **Plugin SDK** warns when it cannot load its published-device snapshot.
  That file is the only record of devices registered in earlier runs, so
  losing it silently disables stale-device cleanup for every plugin.

### Documentation

- **`openapi.yaml` now matches the server** — 89 of 89 routes, 124 of 124
  operations, up from 39. It had also stopped parsing entirely at some
  point (an unquoted `description:` containing `": "` reads as YAML
  mapping syntax), so nothing could consume it. Both fixed; the
  "adding an endpoint" checklist now includes documenting it, which is
  what was missing.

### Upgrade notes

- **Orphans from before the SDK's device-snapshot mechanism cannot be
  auto-cleaned.** `reconcile_devices` computes `stale = known − live`
  from its persisted `.published-device-ids.json`; devices registered
  before that file existed were never written to it, so `known == live`
  and the stale set is empty. They are structurally invisible to the
  reconcile — running the plugin's **cleanup stale devices** action will
  never remove them and will log nothing when it doesn't.

  Delete them explicitly:

  ```
  GET    /api/v1/devices/orphaned      # review the suspects first
  DELETE /api/v1/devices/{id}
  ```

  Check `affected_rules` in the delete response — deletion cascades into
  rule files, disabling any automation that referenced the device. An
  empty list means nothing was disturbed.

---

## v0.1.5 — 2026-05-07

**Theme:** Comfort fix + diagnostic toolkit + client UX cleanup.

A larger-than-usual patch round that closes out a cluster of
operator-reported bugs and lands the WS-observability work that
was deferred from 0.1.3.

### Added

- **`GET /api/v1/logs`** — REST log-tail companion to the
  WebSocket `/api/v1/logs/stream`. Same filter semantics
  (`level`, `target` prefix), plus `since=<RFC3339>` for
  incremental polling and `limit` (default 100, cap 1000).
  CLI-friendly: `curl ... | jq` no longer needs a websocket
  client. Same auth as the WS endpoint.
- **`GET /api/v1/ws/connections`** (admin-only) — live
  registry of every active WebSocket connection (events_stream
  + logs_stream) with `connection_id`, `endpoint`, `client_id`,
  `ip`, `user`, `user_agent`, `connected_at`. Distinguishes
  "one looping client" from "many churning clients" during
  reconnect-storm investigations.
- **WS lifecycle Prometheus metrics** —
  `homecore_ws_connects_total{endpoint}` and
  `homecore_ws_disconnects_total{endpoint, reason}`. The
  `reason` label uses the same categories as the disconnect
  log (see Changed). Combined with `/api/v1/metrics` scraping,
  dashboards can alert on `pong_timeout` rate (network/proxy
  issues) independent of normal `client_close` churn.
- **`hc-thermostat` operator-triggered force-recalc** — the
  `recalculate_all` plugin command now accepts
  `{"force": true}` which re-issues actuator commands
  unconditionally (regardless of cached `actuator_state`).
  Recovery path for the cached-vs-physical-reality drift the
  comfort fix below was added to prevent in the first place.

### Changed

- **WS disconnect log carries a `reason` field** — seven
  categorised strings (`client_close`, `socket_closed`,
  `recv_error`, `pong_timeout`, `ping_send_failed`,
  `event_send_failed`, `bus_closed`) replace the
  previously-indistinguishable `INFO "WebSocket client
  disconnected"`. `logs/stream` got the same treatment with
  its own four categories. Reconnect storms are now
  diagnosable from logs alone.
- **`hc-thermostat` settle gate** — after a plugin or
  appliance restart, the bridge holds command issuance until
  every configured sensor has reported at least once, then
  issues an unconditional command for the desired state.
  Fixes the case where the cached `actuator_state` (restored
  from retained MQTT) matched the desired state but physical
  reality had drifted (power blip, manual flip, dropped
  Z-Wave frame) — the transition-only path never re-synced.
- **Version-banner is direction-aware** (Leptos admin) — only
  fires when the server is strictly newer than the tab. The
  prior any-mismatch trigger fired during in-flight upgrades
  too, where Reload couldn't help. Banner copy also rewritten
  for clarity ("homeCore was upgraded — server is on v0.1.5,
  this tab is still on v0.1.4. Reload to pick up the new
  client.").
- **Overview Security widget honours per-device opt-out** —
  unchecking a contact-sensor or lock on its detail page now
  actually excludes it from the Security tile. Previously the
  default-set fallback ("all locks + contact sensors when no
  tags are explicit") swept unchecked devices back in. New
  explicit-exclude store; checkbox semantics now match operator
  expectations.
- **Overview widget click resets Devices-page filters** —
  clicking a Security/Climate/etc. tile now overrides
  persisted filter chips on the Devices page, instead of
  intersecting with them. Previously a stored
  `area_filter=["kitchen"]` from a prior session could
  produce an empty view when clicking through to a system
  with no Kitchen devices.

### Fixed

- **Cargo.lock metadata drift** in 9 plugin repos — the
  per-repo lockfiles' "version" line for the local crate now
  matches the `Cargo.toml` (was 0.1.2 lingering after the
  v0.1.3 ceremony due to the meta-layout workspace shadowing
  per-plugin builds). Cosmetic — release-pipeline binaries
  were already correct.
- **`/health` and `/system/status` report the binary's
  version, not hc-api's** (HEALTH-VERSION-SOURCE-1). Core's
  binary now passes `CARGO_PKG_VERSION` into AppState and
  the handlers read it from there. Removes the
  bump-all-17-workspace-crates workaround that v0.1.4 needed
  — future "tag only what changed" releases can bump just
  the top-level Cargo.toml.

### Release matrix

**Tagged at v0.1.5 (4 repos):** `homeCore` (core),
`hc-web-leptos`, `hc-thermostat`, `homeCore-io/docker`
(orchestration; triggers appliance build).

**Skipped (no tag, only branch merge for cosmetic Cargo.lock
sync):** 9 plugins (`hc-hue`, `hc-yolink`, `hc-lutron`,
`hc-sonos`, `hc-wled`, `hc-isy`, `hc-zwave`, `hc-caseta`,
`hc-ecowitt`).

**Appliance image:**
`ghcr.io/homecore-io/homecore-appliance:0.1.5` published.
Bundles core 0.1.5 + leptos 0.1.5 + thermostat 0.1.5 +
plugins still at 0.1.3.

### Upgrade notes

- **Stuck thermostat from before 0.1.5?** If you upgraded
  from 0.1.4 with an actuator that had drifted from the
  plugin's cached state (the symptom: AC outlet visibly off
  while the thermostat shows `actuator_state: true`), invoke
  the new force path:
  ```
  POST /api/v1/plugins/plugin.thermostat/command
  {"action":"recalculate_all", "force": true}
  ```
  Or: flip the setpoint by ±1°F to force a transition the
  old way.

---

## v0.1.4 — 2026-05-07 (hotfix)

**Theme:** `/health` version-reporting fix.

Same-day hotfix after v0.1.3. The v0.1.3 ceremony bumped only
the top-level `homecore` `Cargo.toml`, but `/health` and
`/system/status` are implemented in the `hc-api` sub-crate and
read **its** `CARGO_PKG_VERSION` — which was still at 0.1.2.
A v0.1.3 appliance image therefore reported `version: 0.1.2`
through `/health`, the Leptos sidebar, and the login page.

### Fixed

- Bumped every workspace crate (top-level `homecore` + 16
  sub-crates) to 0.1.4 in lockstep, so `hc-api`'s
  `CARGO_PKG_VERSION` lines up with the binary's. `hc-web-leptos`
  rode along to keep the WASM bundle's `client_version` in
  sync with the new server.

### Release matrix

**Tagged at v0.1.4 (3 repos):** `homeCore`, `hc-web-leptos`,
`homeCore-io/docker`. Appliance image
`ghcr.io/homecore-io/homecore-appliance:0.1.4` published.

### Upgrade notes

- The proper architectural fix for this fragility ships in
  v0.1.5 (HEALTH-VERSION-SOURCE-1). Lockstep-bump-everything
  is no longer required from v0.1.5 forward.

---

## v0.1.3 — 2026-05-06

**Theme:** Leptos admin reliability + automation hygiene.

The browser-side admin client got a substantial reliability pass after
field reports of disconnect storms and stale state. Three of the four
fixes are behavioural changes invisible until you look at the
WebSocket events log; the fourth is a banner that finally tells you
your tab is running old code.

### Added

- **`hc-web-leptos` first-ever release tag.** The web admin client
  has shipped through the appliance image since 0.1.0; this is its
  first standalone `v*` git tag, joining the per-component SemVer
  cohort.
- **Stale-WASM banner.** When the operator deploys a new homeCore,
  every existing browser tab keeps running the WASM it loaded
  earlier (`Ctrl+Shift+R` only reloads the active tab). The admin
  now compares its embedded `CARGO_PKG_VERSION` against
  `/api/v1/health` on connect and on every WS reconnect; on
  mismatch a "new version available — Reload" banner appears at
  the top of the viewport. Dismissable per server-version in
  `sessionStorage`.
- **Renovate digest-bump automation.** Every base-image digest
  pinned in 0.1.2 (alpine 3.23, rust 1.95-alpine3.23) now has
  Renovate watching it. Weekly Monday probe; digest + patch tag
  bumps auto-merge on green CI; minor/major land as PRs labelled
  `review-required`. Twelve repos covered.
- **CI for `hc-web-leptos`.** The crate now has a
  `.github/workflows/ci.yml` (fmt + tests via the shared
  `hc-scripts/rust-ci.yml`). It also joined the
  [ci-glance dashboard](https://homecore-io.github.io/ci-glance/).
- **Per-repo `Dockerfile` for `hc-caseta`, `hc-ecowitt`,
  `hc-thermostat`.** These three plugins missed the original
  Dockerfile copy-pass; now in line with the other seven plugins so
  `docker build .` works from each plugin's checkout.

### Changed

- **WebSocket survives navigation.** Routing between admin pages
  (Devices → Scenes → Areas, etc.) used to tear down the
  WebSocket and reopen it ~10 ms later — visible as a continuous
  disconnect/connect storm in the events log and as occasional
  missed state updates. The shared `WsContext` is now hoisted
  above the router so the connection lives for the session.
- **Cached state self-heals on reconnect.** When the WebSocket
  disconnects (real network blips, server restarts), the device
  and plugin maps now re-fetch from REST on every reconnect.
  Previously, state changes that happened during the disconnect
  window were silently lost until the next event for that device.
  In particular: the symptom "Sonos shows paused while the
  speaker is actually playing, until something nudges it" should
  no longer recur.
- **Plugins consume `plugin_sdk_rs::types::*` /
  `plugin_sdk_rs::logging::*` re-exports.** Eleven plugins
  (`hc-hue`, `hc-yolink`, `hc-lutron`, `hc-sonos`, `hc-wled`,
  `hc-isy`, `hc-zwave`, `hc-caseta`, `hc-ecowitt`,
  `hc-thermostat`, `hc-captest`) dropped their direct
  `hc-types` / `hc-logging` git deps and now consume those
  surfaces through the SDK. One upstream-homeCore dependency per
  plugin instead of three. SDK SemVer becomes the only
  homeCore-side version a plugin needs to track.
- **Release-tag policy: tag only what changed.** Starting with
  0.1.3 the project no longer publishes a fixed N-tag table per
  release. Components with operator-impact changes get a tag;
  components whose only changes are configuration that doesn't
  affect the produced binary (e.g. `.github/renovate.json`) are
  skipped. The appliance is always retagged because it bundles
  whatever's latest.

### Fixed

- **Expired session leaves the user logged in.** Before this
  release, a JWT that expired mid-session was only detected on
  the next API write — read-only browsing of cached state stayed
  "alive" indefinitely. The admin now checks token expiry every
  30 seconds and bounces to `/login` proactively. The 401-handler
  in the API client also reliably clears the session signal now
  (a `use_context` lookup inside `spawn_local` previously
  silently failed).

### Release matrix

**Tagged at v0.1.3 (13 repos):** `homeCore` (core), `hc-web-leptos`
(first tag), `hc-hue`, `hc-yolink`, `hc-lutron`, `hc-sonos`,
`hc-wled`, `hc-isy`, `hc-zwave`, `hc-caseta`, `hc-ecowitt`,
`hc-thermostat`, `homeCore-io/docker` (orchestration; triggers
appliance build).

**Skipped (no tag, only branch merge):** `hc-captest` (dev-only
repo, not in production release flow).

**Appliance image:**
`ghcr.io/homecore-io/homecore-appliance:0.1.3` published.

### Upgrade notes

- **Hard-refresh at least one browser tab** after pulling the new
  appliance — the new banner is the long-term answer, but the
  *first* tab on the new server still needs a manual reload
  because it loaded the old WASM before the banner code existed.
- **Renovate onboarding PRs** may appear once Mend Renovate
  Cloud's first scan completes (24-48 h after the App was
  installed). They contain default config; close them — the
  canonical `renovate.json` already shipped on `main` in each
  repo.

### Note on Phase F (the "tag only what changed" rule)

This was the first release applying our new policy of tagging
only components whose binaries differ from the prior release
(rather than the lockstep "tag everything" approach used through
0.1.2). The initial pass tagged 12 components and skipped two
(`homeCore`, `hc-captest`) whose only changes were
`.github/renovate.json`. Operators reported the appliance still
showing v0.1.2 in the Leptos sidebar — because the sidebar reads
core's `CARGO_PKG_VERSION` which was untouched. Resolved by
amending the rule: components that ship *inside* the appliance
image (today: core, plus the WASM bundled into core) ride with
the appliance tag even when their own diff is binary-irrelevant.
Core was retagged at `v0.1.3` and the appliance was rebuilt with
the new core image. Future releases follow the amended rule.

---

## v0.1.2 — 2026-05-05

**Theme:** WebSocket reliability + version correctness + base
image hardening.

A targeted patch round after a 0.1.1 deploy debugging session
exposed three orthogonal weaknesses: the server-side WS loop
mishandled some edge cases, the tooling couldn't tell *which*
component a heartbeat came from, and the Dockerfiles all floated
on a single `alpine:3.20` tag.

### Added

- **`GET /api/v1/system/versions`** — BOM endpoint returning
  `{appliance, core, built_at, plugins: {hc-*: version, ...}}`.
  The appliance image stamps `versions.json` at build time so
  this endpoint always serves accurate per-component versions
  even when components ship at independent SemVers.
- **Plugin heartbeat carries `sdk_version`** — auto-populated
  from the SDK crate's own `CARGO_PKG_VERSION` at compile time.
  Core's state bridge reads this on first heartbeat per plugin
  per session and warns (does not refuse) on MAJOR/MINOR
  divergence from `hc-types::PROTOCOL_VERSION`.
- **Per-tab `client_id` fingerprint.** The Leptos admin generates
  a UUID in `sessionStorage` on first connect and includes it in
  every WS/SSE URL. Server logs now correlate reconnect storms
  to a specific tab instead of `client_id="-"`.

### Changed

- **Server WebSocket loop refactored** to `select!` over
  `socket.recv()`, a 30-second ping ticker, and the event bus —
  closed clients are detected within one ping interval rather
  than waiting for the next event broadcast. NAT/proxy idle
  timeouts also kept warm.
- **Activity page WebSocket consolidated.** Pre-0.1.2, the
  Activity page opened its own `/events/stream` socket *in
  addition* to the shared NavShell socket. Both cycled in
  lockstep, doubling the disconnect-storm signal. The page now
  subscribes to the shared `WsContext.latest_event` signal.
- **Base images digest-pinned.** Three canonical Dockerfiles in
  `homeCore-io/docker` plus eight per-plugin local Dockerfiles
  moved from `alpine:3.20` (floating) to
  `alpine:3.23@sha256:5b10f432…` (3.23.4 digest-pinned). Driven
  by a kernel CVE in the 3.20 lineage. Rust toolchain pinned to
  `1.95` across the board.
- **`apk upgrade` runs in every Dockerfile** before
  `apk add --no-cache` so CVE patches in named packages land
  even on cached layers.

### Fixed

- **Cargo.toml version-correctness sweep.** Several plugin and
  client crates had stale `version = "0.1.0"` lines despite
  shipping inside a v0.1.1 cohort. A pre-tag CI guard now
  refuses to publish if any tracked Cargo.toml's version field
  doesn't match the tag being pushed.
- **`result_large_err` boxing in `hc-api`** — the largest
  variant of the auth-middleware error type was inlined in
  every `Result<T, _>` return. Boxed it; smaller stack frames,
  same surface.
- **Duplicate `debug!` disconnect log** in the WS handler
  removed.

### Release matrix

14 tags total: `homeCore`, `hc-tui`, ten plugins, and
`homeCore-io/docker` all at `v0.1.2`. `hc-plugin-sdk-rs`
shipped independently at `v0.1.3` (its first independent
SemVer; the appliance pulls SDK by tag at plugin-build time).

### Upgrade notes

- The appliance image at `:0.1.2` is the first to carry
  `/etc/homecore/versions.json` and to expose
  `GET /system/versions`. Earlier appliance versions had
  inconsistent self-reported version strings.

---

## v0.1.1 — 2026-05-03

**Theme:** Timezone unification, backup/restore plumbing, plugin
security hardening.

Operator-visible polish round. The most noticeable change is that
every UI timestamp now renders in your configured timezone instead
of UTC; the most consequential is that backups now actually
include plugin configs.

### Added

- **System timezone** propagates from `/api/v1/system/status`
  through every component. The Leptos admin renders timestamps
  in the configured zone; plugins receive the zone via a new
  retained MQTT topic `homecore/system/tz` and use it for log
  formatting.
- **Plugin configs included in backup archive.** `POST
  /api/v1/system/backup` now zips up `state.redb`, `history.db`,
  rules, and every plugin's `config.toml`. Restore unzips back
  in place. Body limit raised to handle realistic archive sizes.
- **Live status text during backup + restore** — the admin shows
  byte counters and stage transitions instead of a blocking
  spinner.
- **Telegram channel** added to `hc-notify`. `type = "telegram"`
  in `[[notify.channels]]`; `channel = "all"` fans out to every
  registered channel.
- **`TimeElapsed` rule condition** — `type = "time_elapsed"`
  checks ms since an attribute last changed. Per-attribute
  timestamp cache; dry-run uses `last_seen` baseline.
- **README dashboard badges** repointed at the new
  [ci-glance dashboard](https://homecore-io.github.io/ci-glance/)
  across 12 repos.

### Changed

- **Solar mode ON/OFF transitions** now fire the simultaneous
  edge correctly when the sun event lands on an exact tick
  boundary (previously dropped).
- **Plugin MQTT log forwarding** redacts secret-named fields
  (`password`, `api_key`, `token`, etc.) before publishing to
  `homecore/plugins/{id}/logs`.
- **Plugin command admin enforcement** verified end-to-end;
  `hc-web-leptos` disables the submit button for non-admin
  users.
- **`hc-ecowitt` LAN attack surface** reduced — the HTTP
  receiver binds loopback by default and accepts an
  `allowed_source_ips` allowlist when binding to a routable
  address.

### Fixed

- **Telegram `CHANGE_ME` placeholder check** — homeCore now
  refuses to start when a notification channel is configured
  with the example placeholder values, instead of silently
  failing on first dispatch.

### Release matrix

14 tags at `v0.1.1`. 12 GitHub Releases (canonical + `latest`
mirror), 12 Docker images on ghcr (`:0.1.1` + `:latest`),
appliance image + tarball.

---

## v0.1.0 — 2026-04-09

Initial release. Runs a house, not yet packaged for general use.

### Core

- Rust kernel with `axum` REST + WebSocket API and embedded
  `rumqttd` MQTT broker.
- Rule engine — triggers, conditions, actions stored as RON
  files on disk, hot-reloaded.
- `redb`-backed device registry; SQLite-backed history.
- Rhai sandboxed scripting for conditions and action scripts.
- Solar event triggers computed locally (no cloud).
- Multi-user auth — JWT HS256, Argon2id passwords, 7 preset
  roles (admin / user / read_only and four mid-tier roles).
- Pushover, email, and (later) Telegram notification
  channels.

### Plugins (Rust SDK)

- `hc-hue`, `hc-yolink`, `hc-lutron`, `hc-sonos`, `hc-wled`,
  `hc-isy`, `hc-zwave`. All on the same plugin SDK with
  management protocol, heartbeat, remote config, dynamic log
  level, and MQTT log forwarding.

### Clients

- `hc-web-leptos` — Rust+WASM single-page admin. (Retired since; the web
  UI is now `hc-web`.)
- `hc-tui` — terminal UI built on `ratatui`.

### Distribution

- Per-component Docker images on `ghcr.io/homecore-io/`.
- All-in-one `homecore-appliance` image (alpine, multi-stage).
- Per-component tarballs published as GitHub Releases.

### Release matrix

14 repos tagged at `v0.1.0`; amd64-only via `FORCE_FAST` (multi-arch is a deliberate later run, tracked as
MULTIARCH-1).

---

## Looking forward

Active and deferred work for the next patch release lives in the
project's planning docs (not part of public docs). User-visible
items will appear here once they ship.
