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

- `hc-web-leptos` — Rust+WASM single-page admin (active client).
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
