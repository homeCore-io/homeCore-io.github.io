---
id: tags-groups
title: Tags & Groups
sidebar_label: Tags & Groups
sidebar_position: 6
---

# Tags & Groups

Tags and groups both let you act on many rules at once. Tags are labels stored on each rule; groups are named lists of rules stored separately.

## Tags

Tags are free-form strings on a rule. Use them for open-ended categories: rooms, purposes, anything you want to filter by.

### Adding tags

In the rule file:

```ron
Rule(
    id: "00000000-0000-0000-0000-000000000000",
    name: "Deck door open alert",
    enabled: true,
    priority: 10,
    tags: ["deck", "door-alerts", "security"],
    trigger: DeviceStateChanged(
        device: "deck.door",
        attribute: Some("open"),
        to: Some(true),
    ),
    actions: [
        RuleAction(action: Notify(channel: "telegram", message: "Deck door opened")),
    ],
)
```

Via the API, `PUT /automations/{id}` replaces the whole rule, so fetch it, change the tags and send it back:

```bash
curl -s http://localhost:8080/api/v1/automations/RULE_ID \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.tags += ["deck", "door-alerts"]' \
  | curl -s -X PUT http://localhost:8080/api/v1/automations/RULE_ID \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d @- | jq '{name, tags}'
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
# Vacation mode: disable all vacation-sensitive rules
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

Groups are named lists of rule UUIDs, kept in `groups.json` in the rules directory. Because a group refers to rules by UUID, renaming a rule doesn't affect it, and you never have to edit the rules themselves to change who is in a group.

A rule can belong to several groups. Groups have no effect on evaluation order or priorities.

### Create a group

The body needs an `id` field holding a UUID. The server replaces it with a new one, so send all zeros.

```bash
GROUP_ID=$(curl -s -X POST http://localhost:8080/api/v1/automations/groups \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "00000000-0000-0000-0000-000000000000",
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

`PATCH` changes any of `name`, `description` and `rule_ids`. A new `rule_ids` replaces the whole list, so include the existing members when adding one. Updating a group doesn't enable or disable anything.

```bash
# Change name and description
curl -s -X PATCH http://localhost:8080/api/v1/automations/groups/$GROUP_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Extended Vacation", "description": "Updated vacation rules"}' | jq

# Add a rule to the group
curl -s -X PATCH http://localhost:8080/api/v1/automations/groups/$GROUP_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"rule_ids": ["UUID1", "UUID2", "UUID3", "UUID4"]}' | jq
```

### Enable / disable all rules in a group

```bash
# Disable before leaving for vacation
curl -s -X POST http://localhost:8080/api/v1/automations/groups/$GROUP_ID/disable \
  -H "Authorization: Bearer $TOKEN" | jq .updated

# Re-enable on return
curl -s -X POST http://localhost:8080/api/v1/automations/groups/$GROUP_ID/enable \
  -H "Authorization: Bearer $TOKEN" | jq .updated
```

Response: `{ "enabled": true, "updated": 3, "rules": [...] }`. Each changed rule is written back to its file.

### Delete a group

```bash
curl -s -X DELETE http://localhost:8080/api/v1/automations/groups/$GROUP_ID \
  -H "Authorization: Bearer $TOKEN"
# → { "deleted": true }
```

Deleting a group does **not** delete its rules. It only removes the group from `groups.json`.

---

## Tags vs. groups: when to use each

| | Tags | Groups |
|---|---|---|
| Stored in | Each rule's RON file | `groups.json` in the rules directory |
| Survives rule rename | Yes | Yes (by UUID) |
| A rule can have several | Yes | Yes |
| Bulk toggle API | `PATCH /automations?tag=X` | `POST /automations/groups/ID/enable` |
| Best for | Open-ended labelling | Named presets (vacation, maintenance, testing) |
| Visibility | Part of every rule (`GET /automations`) | Separate group objects |

As a rule of thumb, use tags when you want the label to travel with the rule. Use groups when you want a named switch for a set of rules without editing each one.

---

## Automation list filters

`GET /automations` accepts these query parameters, in any combination:

| Parameter | Example | Effect |
|---|---|---|
| `tag` | `?tag=deck` | Only rules carrying this tag |
| `trigger` | `?trigger=time_of_day` | Only rules with a trigger of this type, in `trigger` or `triggers` |
| `device_id` | `?device_id=yolink_abc` | Only rules referencing this device in a trigger, condition or action. Matching uses the real device ID, so it finds rules written with `device: "canonical.name"` too. |
| `stale` | `?stale=true` | Only rules with an `error` field (broken, or referencing a deleted device) |
| `limit` | `?limit=10` | Pagination: at most this many rules |
| `offset` | `?offset=20` | Pagination: skip this many first |

The `X-Total-Count` response header gives the total number of matches before pagination:

```bash
curl -s "http://localhost:8080/api/v1/automations?tag=security&limit=10" \
  -H "Authorization: Bearer $TOKEN" \
  -v 2>&1 | grep "X-Total-Count"
# X-Total-Count: 23
```

Valid `trigger` values:
`device_state_changed` `device_availability_changed` `device_battery_low` `device_battery_recovered` `time_of_day` `sun_event` `cron` `periodic` `webhook_received` `mqtt_message` `custom_event` `system_started` `mode_changed` `button_event` `numeric_threshold` `hub_variable_changed` `calendar_event` `manual_trigger` `alert_raised` `alert_cleared` `alert_acknowledged` `alert_active_for`

---

## Bulk PATCH

`PATCH /automations` enables or disables many rules at once. It changes only `enabled`. Every request must say which rules it means, in one of three ways:

| Selector | Matches |
|---|---|
| `"ids": [...]` in the body | These rule UUIDs. Takes precedence over `?tag=`. |
| `?tag=X` | Every rule carrying the tag |
| `?all=true` | Every rule |

A request with no selector is refused with `400`, so a forgotten `ids` can't switch off the whole house by accident.

```bash
# Disable all rules with a tag
curl -s -X PATCH "http://localhost:8080/api/v1/automations?tag=vacation-sensitive" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'

# Disable specific rules by ID
curl -s -X PATCH http://localhost:8080/api/v1/automations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["UUID1", "UUID2"], "enabled": false}'

# Disable ALL rules (must be asked for explicitly)
curl -s -X PATCH "http://localhost:8080/api/v1/automations?all=true" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

Response: `{ "updated": N, "rules": [...full rule objects...] }`. Rules generated and managed by a mode definition are left alone. To change one rule's `priority`, use `PATCH /automations/{id}` with `{"priority": 20}`.

---

## Clone a rule

Duplicate a rule under a new UUID. The copy is named `Copy of {original}` and starts disabled, so it can't double-fire before you've reviewed it.

```bash
curl -s -X POST http://localhost:8080/api/v1/automations/RULE_ID/clone \
  -H "Authorization: Bearer $TOKEN" | jq '{id, name, enabled}'
# → { "id": "new-uuid", "name": "Copy of Front door alert", "enabled": false }
```

Edit the copy's trigger, conditions and actions, then enable it.

---

## Export and import

```bash
# Export all rules as a JSON array
curl -s http://localhost:8080/api/v1/automations/export \
  -H "Authorization: Bearer $TOKEN" > rules-backup.json

# Import (adds rules; does not replace existing ones)
curl -s -X POST http://localhost:8080/api/v1/automations/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @rules-backup.json | jq '{imported}'
```

Imported rules get fresh UUIDs, so they never clash with existing rules. An import is all or nothing: if any rule's device references can't be resolved, the server answers `422` with a `failures` list (index, name and error for each) and imports none of them. On success it answers `201` with `{ "imported": N, "rules": [...] }`.
