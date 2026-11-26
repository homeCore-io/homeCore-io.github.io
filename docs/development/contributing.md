---
id: contributing
title: Contributing
sidebar_label: Contributing
description: How to send a change to homeCore, and the ways to contribute a plugin.
---

# Contributing

Fixes, features, docs and plugins are all welcome. This page covers how to send a change and how a plugin reaches the Catalog.

## Where things live

| Repository | What's in it |
|---|---|
| [homeCore-io/homeCore](https://github.com/homeCore-io/homeCore) | The server, its crates, the Rust plugin SDK (`sdk/rust`) and every Rust plugin (`plugins/hc-*`), in one Cargo workspace |
| [homeCore-io/hc-web-svelte](https://github.com/homeCore-io/hc-web-svelte) | The web app |
| [homeCore-io/hc-tui](https://github.com/homeCore-io/hc-tui), [hc-mcp](https://github.com/homeCore-io/hc-mcp) | The terminal UI, and the Assistant |
| [hc-plugin-sdk-py](https://github.com/homeCore-io/hc-plugin-sdk-py), [-js](https://github.com/homeCore-io/hc-plugin-sdk-js), [-dotnet](https://github.com/homeCore-io/hc-plugin-sdk-dotnet) | The other plugin SDKs |
| [homeCore-io/registry](https://github.com/homeCore-io/registry) | The signed plugin index the Catalog installs from |
| [homeCore-io.github.io](https://github.com/homeCore-io/homeCore-io.github.io) | These docs |

[Workspace](./workspace.md) explains how the repositories fit together.

## Sending a change

1. **Talk first about anything big.** Open an issue for a new feature, a new plugin or a change in behavior before writing much code. A fix for a clear bug can go straight to a pull request.
2. **Branch from `develop`, and open the pull request against `develop`.** `main` only receives releases.
3. **One change per pull request.** A performance fix, a new plugin and a README edit are three pull requests. Small ones get reviewed sooner.
4. **Run the checks.** In the homeCore repository, `just check` runs the same formatting, Clippy and tests as CI, with the pinned toolchain ([Pre-PR check](./dev-workflow.md#pre-pr-check-just-check)). Add a test for any change in behavior.
5. **Say what changed and why** in the description, and how you tested it. Mention anything an operator would notice on upgrade.

CI runs on pull requests once a maintainer approves the run, which GitHub requires for a first-time contributor.

Please leave out of a pull request:

- Git submodules, or dependencies on repositories outside homeCore-io.
- Generated files, benchmark output and logs. Put results in the description.
- Version bumps and release notes. Maintainers add them when they cut the release.
- Addresses, names or anything else from your own house.

### Writing for people

The app and the docs use plain, short sentences in American spelling. The product is always "homeCore" in prose, while code keeps its own names (`homecore`, `hc-core`). Name things the way the app does: rooms, scenes, automations, the Catalog.

### License

homeCore is licensed under MIT or Apache 2.0, at your option. Unless you say otherwise, anything you submit for inclusion is licensed the same way, with no additional terms.

## Contributing a plugin

Whichever way you choose, read [Developing plugins](../plugins/developing-plugins.md) first and go through its [checklist](../plugins/developing-plugins.md#before-you-release-a-plugin).

### Choosing how it runs

| Where it runs | Language | Who builds and releases it | In the Catalog |
|---|---|---|---|
| [Inside the homeCore repository](#1-inside-the-homecore-repository-rust), started by homeCore | Rust | Maintainers | Yes |
| [In a plugin runtime](#2-in-a-plugin-runtime-python-or-nodejs), from your own repository | Python or Node.js | You, with homeCore's shared release workflow | Once listed |
| [Your own package](#3-your-own-repository-rust), started by homeCore | Rust | You | Once listed |
| [A service you run yourself](#4-a-service-you-run-yourself) | Any | You | No |

Start with the first two. A plugin inside the homeCore repository moves with the SDK as it changes and is kept building by homeCore's CI. A runtime plugin gets its interpreter, its updates and its restarts from homeCore and the runtime, and its release is tested before it's published.

### 1. Inside the homeCore repository (Rust)

The plugin becomes part of homeCore: maintainers build, release and list it.

1. Copy the template: `cp -r plugins/hc-plugin-template plugins/hc-<name>`, and add it to the workspace `members` in the root `Cargo.toml`.
2. Depend on the SDK by path (`plugin-sdk-rs = { path = "../../sdk/rust" }`).
3. Set `package.description` and `[package.metadata.homecore]` `name` and `category` in its `Cargo.toml`; the Catalog shows them.
4. Test it on a [sandbox](../plugins/developing-plugins.md#testing-your-plugin), never your own house, with a stand-in for the hardware if you can. Say in the pull request what you tested it against.
5. Open a pull request against `develop` with the plugin, its `config/config.toml.example` and a README.

Once it's merged, a maintainer releases it with an `hc-<name>-v<version>` tag, which builds the package and adds it to the registry.

### 2. In a plugin runtime (Python or Node.js)

A Python or Node.js plugin runs in a [plugin runtime](../plugins/runtimes.md) and lives in its own repository. Its release calls one of hc-scripts' shared workflows, which builds the package, installs it the way a runtime would, starts it against a broker and only then attaches it to a GitHub Release:

- **Python:** `python-release.yml`, as in [Releasing a Python plugin](../plugins/developing-plugins.md#releasing-a-python-plugin).
- **Node.js:** `node-release.yml`, as in [Releasing a Node.js plugin](../plugins/developing-plugins.md#releasing-a-nodejs-plugin).

Add `publish_registry: false` under `with:`. Notifying the registry needs a secret only homeCore-io repositories hold, so without it the release would fail at that step. Then [ask for a listing](#getting-listed).

### 3. Your own repository (Rust)

Keep the plugin in its own repository and depend on the SDK by a homeCore tag:

```toml
plugin-sdk-rs = { git = "https://github.com/homeCore-io/homeCore", tag = "v0.1.125" }
```

Use the newest tag, and move to newer ones as homeCore releases; the SDK is versioned with homeCore. Build a static binary for `x86_64-unknown-linux-musl`, then pack it into the package core installs, a `.tar.zst` named `plugin.<name>-<version>-linux-x86_64.tar.zst` that holds:

| File | What it is |
|---|---|
| `plugin.toml` | The manifest (below) |
| `hc-<name>` | The binary |
| `ui/` | Optional: the plugin's built screens (`dist/` from its `ui/`) |

```toml
id      = "plugin.<name>"   # must match the id the plugin uses on MQTT
name    = "My Thing"        # as people see it
version = "0.1.0"
binary  = "hc-<name>"
ui      = "ui"              # only when the package has ui/
```

```bash
tar --zstd -cf plugin.mything-0.1.0-linux-x86_64.tar.zst plugin.toml hc-mything
sha256sum plugin.mything-0.1.0-linux-x86_64.tar.zst
```

Attach the package to a GitHub Release, test it by installing it on your own homeCore (point a [registry of your own](#running-your-own-registry) at it), then [ask for a listing](#getting-listed).

### 4. A service you run yourself

Anything that speaks homeCore's MQTT protocol can add devices, wherever it runs: a container on another machine, a Kubernetes deployment, a program on a microcontroller. homeCore doesn't install, start, update or restart it. This suits an integration you run only for your own house, or one that has to live next to its hardware.

- **Give it a login.** Add a [`[[broker.clients]]`](../getting-started/configuration.md#broker) entry whose `id` is the plugin id (`plugin.<name>`), and have the service connect with that id and password. The broker must listen on the network for a service on another machine.
- **Use an SDK if you can.** It does the protocol for you: device registration, the schema, availability, heartbeats and actions. [Raw MQTT](../plugins/developing-plugins.md#raw-mqtt-any-language) shows the topics for anything else.
- **Heartbeat.** The service appears in **Settings › Plugins** once it sends its first heartbeat, and reads offline when the heartbeats stop.
- **Keep its own settings.** homeCore holds no config file for it, so it reads its own.
- **Set a Last Will** that marks its devices offline if the connection drops.

A service like this can't be listed in the Catalog, which installs packages into homeCore or a runtime. To share one, package it as a runtime plugin or a Rust package, as above.

### Changing an SDK

The SDKs serve every plugin, so a change to one has to work for plugins shaped differently from yours: many devices as well as one, started by homeCore, in a runtime or on their own. When a pull request adds something to an SDK:

- Follow what the SDK's existing calls send. A heartbeat or capability manifest sent a new way should carry the same fields homeCore reads from the usual one.
- Keep the protocol as it is. Topics, payloads and which messages are retained are the contract every plugin and homeCore share. Propose a change to them in an issue first.
- Add tests for the new calls, and say which plugins use them.
- Say whether the other SDKs need the same change. The [feature matrix](../plugins/developing-plugins.md#sdk-feature-matrix) keeps track.

### Getting listed

Only maintainers can add a plugin to the official registry, since its index is signed with a key only the registry's workflows hold. Open an issue on [homeCore-io/registry](https://github.com/homeCore-io/registry/issues) with:

- The repository, and the GitHub Release that holds the package.
- The package's URL, SHA-256 and size.
- Its id, name, a one-line description and a Catalog category (Lighting, Climate, Media, Hubs, Weather or Tools).
- The oldest homeCore version it runs on, if it needs a recent one.
- What hardware or service it talks to, and whether that's local or online.

Before listing a plugin from another repository, maintainers check that:

- Its source is public, and the package was built from a tagged release of it.
- It follows the plugin checklist: every device has a type and a schema, it reports availability, and it reports problems rather than stopping without a word.
- It talks only to the hardware or service it says it does, and stores credentials only in its own config.
- Its author will publish fixes when homeCore's SDK moves on.

Each new version is a new request, until the plugin moves into the homeCore repository or its author is given a release path.

## Running your own registry

You can serve plugins from a registry of your own: a signed `index.json` on any web server or in a local folder. Point `[registry] url` and `public_key` in `homecore.toml` at it ([Configuration](../getting-started/configuration.md)). The [registry repository's README](https://github.com/homeCore-io/registry#readme) shows how to make a signing key and sign the index; its `public/index.json` is a working example of the format.

homeCore reads one registry at a time, so pointing it at your own replaces the official one.
