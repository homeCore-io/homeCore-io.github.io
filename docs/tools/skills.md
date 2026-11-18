---
id: skills
title: Skills for AI Assistants
sidebar_label: Skills
sidebar_position: 3
---

# Skills for AI assistants

[homeCore-io/skills](https://github.com/homeCore-io/skills) holds
[Agent Skills](https://agentskills.io) for homeCore. A skill is a guide an AI
assistant follows step by step, and people can read them as they are. Each is a
`SKILL.md` with the steps and a `references/` folder with the detail it points
to; they link to these docs for the rest.

| Skill | For |
|---|---|
| `dev-environment` | Setting up to work on homeCore: the toolchain, the workspace, building and running core and the app, a safe sandbox, tests and CI |
| `install-and-setup` | Installing and setting up homeCore: Docker or a binary, configuration, plugins from the Catalog, plugin runtimes, people and access, backups and upgrades |
| `plugin-development` | Writing a plugin in Rust, Python, JavaScript or .NET: devices, actions, settings, screens, testing and releasing |

## In Claude Code

The repository is a Claude Code plugin marketplace. Add it and install the
plugin:

```
/plugin marketplace add homeCore-io/skills
/plugin install homecore@homecore
```

Then ask about homeCore, and Claude picks the skill that fits. To start one
directly, use its name, for example `/homecore:plugin-development`.

## In hc-mcp and the Assistant

[hc-mcp](./hc-mcp.md) ships a copy of the skills (v0.1.3 and later):

- An MCP client such as Claude Desktop sees each skill as a prompt, to
  start a conversation with.
- Every file of a skill is a resource at
  `homecore-skill://<skill>/<file>`, for example
  `homecore-skill://plugin-development/references/python.md`.
- Two tools, `list_skills` and `read_skill`, list them and read one.

The Assistant, hc-mcp's chat inside homeCore, knows the skills by name and
reads the one that fits when someone asks how to do something.

## Other assistants

Anything else that reads Agent Skills can use them too: copy a folder from the
repository's `skills/` directory.
