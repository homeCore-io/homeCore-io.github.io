---
id: runtimes
title: Plugin Runtimes
sidebar_label: Plugin runtimes
sidebar_position: 6
---

# Plugin Runtimes

A plugin runtime is a container you run yourself that holds plugins written
in Python. homeCore never starts or stops it. You add the runtime in homeCore,
paste the key homeCore gives you into the runtime, and from then on you
install, update and remove its plugins from the Catalog like any other
plugin. The [Assistant](../tools/hc-mcp) is a Python plugin and runs this way.

One runtime holds any number of plugins, up to a limit you can set. Each
plugin gets its own process and its own Python environment, so two plugins
that want different versions of a library, or even of Python, don't
conflict. That is the only
separation between them. Put a plugin you want kept apart from the rest in a
runtime of its own.

Runtimes are managed on the **Plugin runtimes** screen: open
**Settings › Plugins** and choose **Plugin runtimes**, beside **Catalog**.

## Before you start: the broker

The runtime and its plugins talk to homeCore's broker over the network. If the
broker listens only on homeCore's own machine (`[broker] host = "127.0.0.1"`,
as in the example config and the Docker image's config), the
**Plugin runtimes** screen says so and offers **Open the broker to the
network**. That sets `host = "0.0.0.0"`, adds a login for homeCore itself if
there is none, and restarts homeCore. From then on the broker asks every
connection for a login. homeCore makes one for each runtime and each plugin,
so you never type one in.

If homeCore runs from the Docker stack, its `compose.yml` publishes port 1883
for this (`HC_BROKER_PORT` changes the host side). Older copies of the file
don't publish it; add `- "1883:1883"` under the `homecore` service's `ports`.

## Add a runtime

1. In homeCore, open **Settings › Plugins**, choose **Plugin runtimes**, then
   **Add runtime**. Give it a name and check the address the runtime will
   reach homeCore at. It is filled in from the address you're using. You can
   also set a plugin limit here; blank means no limit.
2. homeCore shows a **connection key** once. Copy it. If you lose it, use
   **Reset login** to make a new one.
3. Start the container:

   ```sh
   docker run -d --name pyhost-01 -p 8790:8790 \
     -v pyhost-01:/var/lib/hc-runtime \
     ghcr.io/homecore-io/hc-runtime-python
   ```

4. Open `http://<the machine running it>:8790`, paste the key and choose
   **Connect**. The runtime tries homeCore and the broker before it saves the
   key, and says which one it couldn't reach.

The [docker repository](https://github.com/homeCore-io/docker) has a ready
compose file for this, `compose.runtime-python.yml`:

```sh
mkdir runtime-python-data
docker compose -f compose.runtime-python.yml up -d
```

You can also pass the key when the container starts instead of using the
page, which suits compose files:

```yaml
services:
  pyhost-01:
    image: ghcr.io/homecore-io/hc-runtime-python
    environment:
      HC_RUNTIME_KEY: hcrt1.…
    volumes:
      - pyhost-01:/var/lib/hc-runtime
```

**Show details** next to the key lists what is inside it: homeCore's address,
the broker, and the runtime's username and password, for anyone setting a
runtime up by hand.

The image is published with every core release as
`ghcr.io/homecore-io/hc-runtime-python`, tagged with core's version and
`latest`. The image has no Python of its own: each plugin runs on the Python
it was built for, which the runtime gets through homeCore (see
[Which Python a plugin runs on](#which-python-a-plugin-runs-on)). The
published image and those Pythons are x86_64 (amd64) only for now.

## Install plugins into it

Install a Python plugin from the Catalog as usual. The Catalog marks such
plugins "Runs in a Python runtime" and says before you install if no runtime
can take it: there is none yet, it hasn't connected, it runs on another
architecture, or it is full. If one runtime can take the plugin, it goes
there. If several can, homeCore asks which.

homeCore checks the plugin's signature, then asks the runtime to check in.
The runtime downloads the plugin from homeCore, installs it offline into its
own environment and starts it, usually within seconds. You edit its settings
in homeCore, the same as any plugin's; homeCore sends them to the runtime.

An update goes to the runtime the plugin already runs on, even when that
runtime is full. The plugin's page shows that it is updating until the new
version is running.

A plugin in a runtime offers only **Uninstall…** on its page. The runtime
starts and stops it, so Turn off, Start, Stop and Restart aren't offered. The
runtime restarts a plugin that exits, waiting 2 seconds at first and doubling
up to 60, the same as homeCore does for its own plugins.

## Which Python a plugin runs on

Each plugin is built for one Python version, such as 3.13, and runs on that
version whatever else the runtime holds. The registry publishes the Pythons
themselves, signed like plugins, from
[homeCore-io/interpreters](https://github.com/homeCore-io/interpreters). When
a plugin is installed, homeCore picks the newest patch of its version, for
example 3.13.18, and the runtime fetches it through homeCore, checks it and
keeps one copy for every plugin that uses it. Each plugin row on the runtime's
card shows the Python it runs on.

New Python patch releases never install by themselves. When the registry has
one, the runtime's card says so and lists the plugins it would restart, and
the Plugins page tags **Plugin runtimes** with **Python update**. Choose
**Update Python** on the card to move them. The runtime builds new
environments beside the old ones from the packages it already has, so the
update downloads only the new Python. Each plugin restarts on it within a
minute. Update all on the Plugins page covers plugin versions only.

When a Python version stops getting fixes upstream, the card notes it. Its
plugins keep running on it and move to a newer Python when their next version
is built for one.

The runtime keeps the current install of each plugin and the one before it,
and removes a Python once no install uses it.

## Watching a runtime

The runtime shows up in homeCore's plugin list as a plugin of its own, named
by its runtime id. Its page in homeCore has a **Check in now** action
(runtime 0.2.2 and later). When a hosted plugin keeps exiting, the runtime
raises a notice there with the plugin's last output.

The runtime's own page, on port 8790, lists the plugins homeCore placed there
and keeps the last 500 log lines from the runtime and from each plugin,
including what a plugin printed before it reached homeCore. Passwords and
keys are masked. **Open its page** on the Plugin runtimes screen links to it.

The oldest runtime homeCore works with is 0.2.3, the first that gets its
Pythons through homeCore. An older one is marked as outdated on its card and
in the Catalog, and an image that brings its own Python is turned away when
it connects; its page says to pull the new image. To update a runtime, pull
the newer image and restart the container. Its plugins come back by
themselves. A container updated in place keeps the old image's
settings; if `HC_RUNTIME_ABI` is among them, remove it, since the image sets
its own.

## Change limit, Reset login and Remove

- **Change limit** sets how many plugins the runtime takes. A few suit a
  Raspberry Pi; a large server takes many.
- **Reset login** makes a new key and stops the old one at once. The runtime
  stops its plugins and waits. Paste the new key on its page and they come
  back.
- **Remove** uninstalls the plugins in the runtime, with their devices and
  settings, and ends its key. Stop the container yourself.

A runtime that is still added in one homeCore won't take a key from another.
To move it, remove it from the first homeCore, then paste the new key.

## Container settings

| Variable | Default | What it does |
|---|---|---|
| `HC_RUNTIME_KEY` | | The connection key. When set here, the page shows it and doesn't offer to change it. |
| `HC_RUNTIME_PAGE_PORT` | `8790` | The runtime's page. `0` turns it off. |
| `HC_RUNTIME_PAGE_URL` | | The page's address, for homeCore's link to it. Set it when the runtime runs on another machine on a bridge network, or its page is published on a different port. |
| `HC_RUNTIME_BROKER_HOST` | | The broker's address, when the runtime reaches it somewhere other than the host in the key. |
| `HC_RUNTIME_POLL_SECS` | `30` | How often it checks in with homeCore. homeCore 0.1.114 and runtime 0.2.2 also check in at once when a plugin is installed, updated or uninstalled there. |
| `HC_RUNTIME_NETWORK_MODE` | | Shown in homeCore's list (for example `bridge` or `host`). |

The volume at `/var/lib/hc-runtime` holds the key, the installed plugins and
their Pythons.
If you lose it, paste the key again and homeCore sends every plugin back.

For how to package a Python plugin for a runtime, see
[Releasing a Python plugin](./developing-plugins#releasing-a-python-plugin).
