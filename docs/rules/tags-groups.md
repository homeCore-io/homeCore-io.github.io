---
id: tags-groups
title: Tags & Groups
sidebar_label: Tags & Groups
sidebar_position: 6
---

# Tags & Groups

Tags and groups both allow bulk operations on rules, but they serve different purposes.

## Tags

Tags are free-form string labels stored on each rule. They are great for open-ended categorization.

### Adding tags

In RON:

```toml
id      = ""
name    = "Deck door open alert"
enabled = true
tags    = ["deck", "door-alerts", "security"]

[trigger]
type = "device_state_changed"
...
```

Via API:

```bash
curl -s -X PUT http://localhost:8080/api/v1/automations/RULE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Deck door open alert",
    "enabled": true,
    "priority": 10,
    "tags": ["deck", "door-alerts"],
    "trigger": {...},
    "conditions": [],
    "actions": [...]
  }' | jq
```

### Filtering by tag

```bash
# List all deck rules
curl -s "http://localhost:8080/api/v1/automations?tag=deck" \
  -H "Authorization: Bearer $TOKEN" | jq '.[].name'

# Count door-alert rules
curl -s "http://localhost:8080/api/v1/automations?tag=door-alerts" \
  -H "Authorization: Bearer $TOKEN" | jq length
```

### Bulk enable/disable by tag

```bash
# Vacation mode — disable all vacation-sensitive rules
curl -s -X PATCH "http://localhost:8080/api/v1/automations?tag=vacation-sensitive" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}' | jq .updated

# Re-enable on return
curl -s -X PATCH "http://localhost:8080/api/v1/automations?tag=vacation-sensitive" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}' | jq .updated
```

### Suggested tag conventions

| Category | Example tags |
|---|---|
| Area/room | `"deck"`, `"garage"`, `"bedroom"`, `"kitchen"` |
| Function | `"door-alerts"`, `"morning-routine"`, `"security"` |
| Vacation | `"vacation-sensitive"`, `"presence-aware"` |
| Maintenance | `"disabled-pending-fix"`, `"seasonal"`, `"testing"` |

---

## Groups

Groups are named bundles of rule UUIDs stored in `rules/groups.json`. Unlike tags (stored on each rule), groups reference rules by UUID and survive rule renames.

A rule can belong to multiple groups. Groups do not affect evaluation order or priorities.

### Create a group

```bash
GROUP_ID=$(curl -s -X POST http://localhost:8080/api/v1/automations/groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "",
    "name": "Vacation Mode",
    "description": "Rules to pause while away from home",
    "rule_ids": ["UUID1", "UUID2", "UUID3"]
  }' | jq -r .id)

echo "Group: $GROUP_ID"
```

### List and view groups

```bash
# List all groups
curl -s http://localhost:8080/api/v1/automations/groups \
  -H "Authorization: Bearer $TOKEN" | jq

# Get one group
curl -s http://localhost:8080/api/v1/automations/groups/$GROUP_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Update a group

```bash
# Change name and description
curl -s -X PATCH http://localhost:8080/api/v1/automations/groups/$GROUP_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Extended Vacation", "description": "Updated vacation rules"}' | jq

# Add a new rule to the group
curl -s -X PATCH http://localhost:8080/api/v1/automations/groups/$GROUP_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rule_ids": ["UUID1", "UUID2", "UUID3", "UUID4"]}' | jq
```

### Enable / disable all rules in a group

```bash
# Disable — leaving for vacation
curl -s -X POST http://localhost:8080/api/v1/automations/groups/$GROUP_ID/disable \
  -H "Authorization: Bearer $TOKEN" | jq .updated

# Re-enable on return
curl -s -X POST http://localhost:8080/api/v1/automations/groups/$GROUP_ID/enable \
  -H "Authorization: Bearer $TOKEN" | jq .updated
```

Response: `{ "enabled": true, "updated": 3, "rules": [...] }`

### Delete a group

```bash
curl -s -X DELETE http://localhost:8080/api/v1/automations/groups/$GROUP_ID \
  -H "Authorization: Bearer $TOKEN"
```

Deleting a group does **not** delete the rules themselves. It only removes the group definition from `rules/groups.json`.

---

## Tags vs. Groups — when to use each

| | Tags | Groups |
|---|---|---|
| Stored in | Each rule's RON file | `rules/groups.json` |
| Survives rule rename | Yes | Yes (by UUID) |
| One rule, many | Yes | Yes |
| Bulk toggle API | `PATCH /automations?tag=X` | `POST /automations/groups/ID/enable` |
| Best for | Open-ended labelling | Named presets (vacation, maintenance, testing) |
| Visibility | Always visible in rule data | Separate group objects |

**Rule of thumb:** Use tags when you want the label to travel with the rule (visible in `GET /automations`). Use groups when you want a named switch that controls a set of rules without editing each one.

---

## Automation list filters

`GET /automations` accepts these query parameters (all combinable):

| Parameter | Example | Effect |
|---|---|---|
| `tag` | `?tag=deck` | Only rules containing this tag |
| `trigger` | `?trigger=time_of_day` | Only rules with this trigger type |
| `device_id` | `?device_id=yolink_abc` | Only rules referencing this internal device ID (filtering uses the real `device_id`, even if the rule source uses `device = "canonical.name"`) |
| `stale` | `?stale=true` | Only rules with an `error` field (broken or references deleted device) |
| `limit` | `?limit=10` | Pagination |
| `offset` | `?offset=20` | Pagination offset |

`X-Total-Count` response header gives the total count before pagination:

```bash
curl -s "http://localhost:8080/api/v1/automations?tag=security&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -v 2>&1 | grep "X-Total-Count"
# X-Total-Count: 23
```

Valid `trigger` values:
`device_state_changed` `device_availability_changed` `time_of_day` `sun_event` `cron` `periodic` `webhook_received` `mqtt_message` `custom_event` `system_started` `mode_changed` `button_event` `numeric_threshold` `hub_variable_changed` `calendar_event` `manual_trigger`

---

## Bulk PATCH

Bulk-update `enabled`, `priority`, or `tags` for multiple rules at once.

```bash
# Disable all rules matching a tag
curl -s -X PATCH "http://localhost:8080/api/v1/automations?tag=vacation-sensitive" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Disable specific rules by ID
curl -s -X PATCH http://localhost:8080/api/v1/automations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["UUID1", "UUID2"], "enabled": false}'

# Disable ALL rules (no filter)
curl -s -X PATCH http://localhost:8080/api/v1/automations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

When `ids` is present in the body, `?tag=` query parameter is ignored.

Response: `{ "updated": N, "rules": [...full rule objects...] }`

---

## Clone a rule

Duplicate a rule with a new UUID. The clone is disabled by default, named `Copy of {original}`.

```bash
curl -s -X POST http://localhost:8080/api/v1/automations/RULE_ID/clone \
  -H "Authorization: Bearer $TOKEN" | jq '{id, name, enabled}'
# → { "id": "new-uuid", "name": "Copy of Front door alert", "enabled": false }
```

Edit the clone's trigger/conditions/actions and enable it when ready.

---

## Export and import

```bash
# Export all rules
curl -s http://localhost:8080/api/v1/automations/export \
  -H "Authorization: Bearer $TOKEN" > rules-backup.json

# Import (adds rules; does not replace existing ones)
curl -s -X POST http://localhost:8080/api/v1/automations/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @rules-backup.json | jq '{imported: length}'
```

Imported rules get fresh UUIDs, so there are no ID conflicts with existing rules.
