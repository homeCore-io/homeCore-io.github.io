---
id: extensions
title: UI extensions
sidebar_label: UI extensions
sidebar_position: 3
---

# UI extensions

A UI extension is a set of drawings and cards made outside the app, which
[looks](./looks.md) can choose: an animated thermostat, readings drawn as
gauges. An extension never commands anything. A tap on one does what a tap
on the card always does.

Extensions are installed by the web app's own server, into `extensions/` in
its data directory. homeCore never sees them. They need app v0.1.46 or later;
extensions made of code (below) need v0.1.47.

## Installing one

**From the Catalog.** Settings › Plugins › **Catalog** has a tab for UI
extensions, grouped by category. Choose one and its version, then
**Install**. The app downloads it from its release, checks the Catalog's
signature and the file's checksum, and only then unpacks it. Nothing in the
Catalog costs anything.

**From a file.** For one you made, or one not in the Catalog: on the same
tab, **Add from a file** takes a `.tar.zst`, `.tar.gz` or `.zip`. The app
reads it first and shows what it holds, then installs it only when you say
so. Nothing vouches for a file, and the page says so.

Then choose its drawing in a look's Drawings, in the row for what it draws.
Installing changes nothing on its own.

Only people who may install plugins can install or remove an extension.

## Seeing and removing them

**Settings › Extensions** lists what's installed, its version, and where it
came from: the Catalog, a file, or copied in by hand. **Remove** takes one
away, and whatever a look drew with it is drawn as Classic draws it again.
Drawings that plugins bring are listed too; they come and go with their
plugin.

## What an extension can do

There are two kinds of drawing:

- **Rive.** An animation made in [Rive](https://rive.app). It is a file, not
  code, and the app plays it, so it can only show what the app tells it.
- **Code.** A web component that runs in the browser of everyone who sees a
  look that uses it, with the same reach as the app itself, as a plugin's
  own screens have. That's why only admins can install one, and why the app
  warns when a file you add contains code.

Either way, an extension is given what it draws (the thing's name, state and
readings) and a few of the app's own helpers. It is given nothing that can
command a device.

## Settings

The UI server finds the Catalog's list of extensions, and the key that signs
it, from two settings. The defaults are homeCore's registry, the same one
homeCore trusts for plugins:

| Setting | Default |
|---|---|
| `HC_EXTENSIONS_INDEX` | `https://homecore.io/registry/extensions.json` (the signature is the same address plus `.sig`) |
| `HC_REGISTRY_PUBLIC_KEY` | the homeCore registry's key |

To install from the Catalog, the UI server needs to reach that address and
GitHub's release downloads. Adding from a file works offline. Keep the data
directory on its volume, as before: the extensions live there.

## Making one

See [Making a UI extension](./making-extensions.md).
