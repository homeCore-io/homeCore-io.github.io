---
id: extensions
title: UI extensions
sidebar_label: UI extensions
sidebar_position: 3
---

# UI extensions

A UI extension is a set of drawings made outside the app, which
[looks](./looks.md) can use. Two examples are an animated thermostat and
readings drawn as gauges. An extension never commands anything. A tap on one
does what a tap on the card always does.

The web app's own server installs extensions into `extensions/` in its data
directory. homeCore never sees them.

## Installing one

**From the Catalog.** Open Settings › Plugins › **Catalog** and pick the
**UI extensions** tab. Extensions are grouped by category. Choose one to see
how it looks (a picture or a short video), pick its version, then
**Install**. The app's server fetches the preview and checks it against the
Catalog's signed list before showing it, so your browser never fetches
anything from elsewhere. Installing downloads the extension from its
release, checks the Catalog's signature and the file's checksum, and only
then unpacks it. Nothing in the Catalog costs anything.

**From a file.** For one you made, or one that isn't in the Catalog, use
**Add from a file** on the same tab. It takes a `.tar.zst`, `.tar.gz` or
`.zip`. The app reads the file first and shows what it holds, and installs
it only when you say so. Nothing vouches for a file, and the page says so.

Installing changes nothing by itself. To use it, choose its drawing in a
look's Drawings tab, in the row for what it draws.

Only people who may install plugins can install or remove an extension.

## Seeing and removing them

**Settings › Extensions** lists what's installed, its version, and where it
came from: the Catalog, a file, or copied in by hand. **Remove** takes one
away, and whatever a look drew with it goes back to the way Classic draws
it. Drawings that plugins bring are listed too. They come and go with their
plugin.

## What an extension can do

There are two kinds of drawing.

A Rive drawing is an animation made in [Rive](https://rive.app). It is a
file, and the app plays it, so it can only show what the app tells it.

A code drawing is a web component. It runs in the browser of everyone who
sees a look that uses it, with the same reach as the app itself, as a
plugin's own screens have. That's why only people who may install plugins
can add one, and why the app warns when a file you add contains code.

Either way, an extension is given what it draws (the thing's name, state and
readings) and a few of the app's helpers. It is given nothing that can
command a device.

## Settings

The UI server finds the Catalog's list of extensions, and the key that signs
it, from two environment variables. The defaults point at homeCore's
registry, the same one homeCore trusts for plugins:

| Variable | Default |
|---|---|
| `HC_EXTENSIONS_INDEX` | `https://homecore.io/registry/extensions.json` (the signature is the same address plus `.sig`) |
| `HC_REGISTRY_PUBLIC_KEY` | the homeCore registry's key |

To install from the Catalog, the UI server needs to reach that address and
GitHub's release downloads. Adding from a file works offline.

Extensions live in the app's data directory, so keep it on its volume. The
app's backup in Settings › Data & backups doesn't include them; after a
restore, install them again.

## Making one

See [Making a UI extension](./making-extensions.md).
