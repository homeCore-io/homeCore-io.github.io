---
id: runtimes
title: Plugin Runtimes
sidebar_label: Plugin Runtimes
sidebar_position: 6
---

# Plugin Runtimes

A **plugin runtime** is a container you run yourself that holds plugins
written in Python. homeCore never starts or stops it. You add it in homeCore,
paste the key homeCore gives you into the runtime, and from then on you
install, update and remove its plugins from the Catalog like any other.

One runtime holds any number of plugins. Each gets its own process and its own
Python environment, so two plugins that want different versions of a library
never share one. They are not walled off from each other beyond that: a plugin
you want kept apart from the rest goes in a runtime of its own.

Runtimes are managed on the **Plugin runtimes** screen: open
**Settings › Plugins** and choose the **Plugin runtimes** button beside
**Catalog**.

## Before you start: the broker

The runtime and its plugins talk to homeCore's broker over the network. If the
broker answers only on homeCore's own machine (`[broker] host = "127.0.0.1"`,
as the example config and the Docker image's config have it), the **Plugin runtimes** screen says so and offers **Open the
broker to the network**. That sets `host = "0.0.0.0"`, adds a login for
homeCore itself if there is none, and restarts homeCore. From then on the
broker asks every connection for a login: homeCore makes one for each runtime
and each plugin, so you never type one in.

If homeCore runs from the Docker stack, its `compose.yml` publishes port 1883
for this (`HC_BROKER_PORT` changes the host side). Older copies of the file don't; add `- "1883:1883"` under the
`homecore` service's `ports`.

## Add a runtime

1. In homeCore, open **Settings › Plugins**, choose **Plugin runtimes**, then
   **Add runtime**. Give it a name, and check the address the runtime will
   reach homeCore at. It's filled in from the address you're using.
2. homeCore shows a **connection key**, once. Copy it. If it's lost, use
   **Reset login** to make a new one.
3. Start the container:

   ```sh
   docker run -d --name pyhost-01 -p 8790:8790 \
     -v pyhost-01:/var/lib/hc-runtime \
     ghcr.io/homecore-io/hc-runtime-python
   ```

4. Open `http://<the machine running it>:8790`, paste the key and choose
   **Connect**. The runtime tries homeCore and the broker before saving the
   key, and says which one it couldn't reach.

The [docker repository](https://github.com/homeCore-io/docker) has a ready
compose file for this, `compose.runtime-python.yml`:

```sh
mkdir runtime-python-data
docker compose -f compose.runtime-python.yml up -d
```

Instead of the page, you can pass the key when the container starts, which
suits compose files:

```yaml
services:
  pyhost-01:
    image: ghcr.io/homecore-io/hc-runtime-python
    environment:
      HC_RUNTIME_KEY: hcrt1.…
    volumes:
      - pyhost-01:/var/lib/hc-runtime
```

**Show details** next to the key lists what is inside it (homeCore's address,
the broker, the runtime's username and password) for anyone setting a runtime
up by hand.

## Install plugins into it

Install a Python plugin from the Catalog as usual. If one runtime can run it,
it goes there; if several can, homeCore asks which. The runtime downloads it
from homeCore (homeCore checks the signature first), installs it offline into
its own environment and starts it. Its settings are edited in homeCore, the
same as any plugin's.

## Reset login and Remove

- **Reset login** makes a new key and stops the old one working. The runtime
  stops its plugins and waits; paste the new key on its page and they come
  back.
- **Remove** uninstalls the plugins in the runtime, with their devices and
  settings, and ends its key. Stop the container yourself.

A runtime that is still added in one homeCore won't take a key from another.
To move it, remove it from the first homeCore, then paste the new key.

## Container settings

| Variable | Default | What it does |
|---|---|---|
| `HC_RUNTIME_KEY` | | The connection key. Set it here and the page shows it without offering to change it. |
| `HC_RUNTIME_PAGE_PORT` | `8790` | The runtime's page. `0` turns it off. |
| `HC_RUNTIME_PAGE_URL` | | The page's address, for homeCore's link to it. Set it when the runtime runs on another machine on a bridge network, or its page is published on a different port. |
| `HC_RUNTIME_BROKER_HOST` | | The broker's address, when the runtime reaches it somewhere other than the address in the key. |
| `HC_RUNTIME_POLL_SECS` | `30` | How often it checks in with homeCore. homeCore 0.1.114 and runtime 0.2.2 also check in at once when a plugin is installed, updated or uninstalled there. |
| `HC_RUNTIME_NETWORK_MODE` | | Shown in homeCore's list (for example `bridge` or `host`). |

The volume at `/var/lib/hc-runtime` holds the key and the installed plugins.
Losing it costs nothing but pasting the key again; homeCore sends every plugin
back.
