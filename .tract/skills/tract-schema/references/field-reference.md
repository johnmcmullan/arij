# Field Reference

Complete reference for all Tract ticket fields.

## Required Fields

These must be present in every ticket:

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | string | Unique ticket identifier. Format: `PREFIX-NUMBER` | `APP-1234`, `TB-042` |
| `title` | string | Short summary (1-2 sentences max) | `Fix session timeout bug` |
| `status` | string | Current workflow state. Must match project config. | `in-progress`, `done` |
| `type` | string | Issue type. Must match project config. | `bug`, `story`, `task`, `epic` |
| `created` | date | Creation date/time (ISO 8601 or YYYY-MM-DD) | `2026-02-14` or `2026-02-14T13:00:00Z` |

## Standard Optional Fields

These are recognized by Tract and validated when present:

### Assignment & Ownership

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `assignee` | string | Person responsible for the ticket | `john.mcmullan` |
| `reporter` | string | Person who created/reported the ticket | `sarah.jones` |
| `watchers` | list[string] | Users interested in updates | `[mike, dave, sarah]` |

### Prioritization

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `priority` | string | Importance level (project-defined or freeform) | `critical`, `high`, `medium`, `low` |
| `severity` | string | Impact level (distinct from priority) | `sev1`, `sev2`, `blocker` |
| `rank` | integer | Ordering within sprint/backlog (use gaps: 100, 200...) | `200` |

### Planning

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `sprint` | string | Sprint ID (must match file in `.tract/sprints/`) | `2026-W07`, `sprint-23` |
| `epic` | string | Parent epic ticket ID | `APP-100` |
| `component` | string | Logical component (from `.tract/components.yaml`) | `auth-service`, `trading.fix-engine` |
| `labels` | list[string] | Freeform tags (**field name configurable**: `labels` or `tags`) | `[security, urgent, production]` |

### Time Tracking

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `estimate` | string | Estimated effort (story points or duration) | `5`, `3d`, `8h`, `2w` |
| `logged` | string | Time spent so far | `4h`, `2d` |
| `remaining` | string | Time remaining | `1.5d`, `3h` |
| `due` | date | Due date (YYYY-MM-DD) | `2026-02-20` |

### Versioning

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `fix_version` | string | Target release version (quote to avoid YAML float parsing) | `"2.5.0"`, `"Q1-2026"` |
| `affected_version` | string | Version where bug was found | `"2.4.3"` |

### Relationships

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `links` | list[object] | Relationships to other tickets | See [Link Format](#link-format) below |

### Customer Tracking

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `customer` | string | Customer ID (must match file in `.tract/customers/`) | `acme-corp`, `globex` |

### Resolution

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `resolution` | string | How the ticket was resolved | `fixed`, `wontfix`, `duplicate`, `cannot-reproduce` |
| `environment` | string | Where the issue occurs | `prod-eu`, `staging`, `dev` |

### Migration Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `moved_to` | string | Ticket ID this was moved to (tombstone marker) | `NEWPROJ-18` |
| `moved_from` | string | Ticket ID this was moved from | `OLDPROJ-42` |

### Attachments

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `attachments` | list[object] | File attachments (links, not binaries) | `[{name: "screenshot.png", url: "s3://..."}]` |

## Auto-Generated Fields

These are set automatically by `tract create` or sync:

| Field | Type | Description |
|-------|------|-------------|
| `updated` | date | Last modification timestamp (auto-updated on save) |

## Derived Fields

These are **not stored** - computed at query time:

| Field | Source | Description |
|-------|--------|-------------|
| `modified` | git | Last commit timestamp affecting this file |
| `age` | created vs now | How long the ticket has existed |
| `comments_count` | markdown body | Number of comment sections |

## Link Format

Links express relationships between tickets:

```yaml
links:
  - rel: blocks
    ref: APP-1235
  - rel: related_to
    ref: APP-1200
  - rel: duplicates
    ref: APP-1180
```

### Link Relationship Types

| Type | Meaning | Example |
|------|---------|---------|
| `blocks` | This ticket blocks the referenced one | `APP-1234 blocks APP-1235` |
| `blocked_by` | This ticket is blocked by the referenced one | `APP-1234 blocked_by APP-1200` |
| `duplicates` | This is a duplicate of the referenced ticket | `APP-1234 duplicates APP-1180` |
| `duplicated_by` | The referenced ticket is a duplicate of this one | `APP-1180 duplicated_by APP-1234` |
| `related_to` | General relationship | `APP-1234 related_to APP-1200` |
| `causes` | This ticket causes the referenced issue | `APP-1234 causes APP-1250` |
| `caused_by` | This ticket is caused by the referenced issue | `APP-1250 caused_by APP-1234` |
| `parent` | This ticket is a child of the referenced one | `APP-1234 parent APP-100` (epic) |
| `child` | The referenced ticket is a child of this one | `APP-100 child APP-1234` |

## Custom (Freeform) Fields

Any field not listed above is **freeform** - preserved but not validated.

**Convention:** Prefix with `x-` for clarity:

```yaml
x-risk-score: 8
x-compliance-review: pending
x-customer-impact: high
x-deployment-notes: "Requires DB migration"
x-trade-impact: "~2000 orders/day affected"
```

Freeform fields:
- Can be any YAML type (string, number, list, object)
- Are preserved exactly as written
- Can be used in board filters and queries
- Sync to Jira as custom fields (if configured)

## Field Type Details

### String
Any text value:
```yaml
assignee: john.mcmullan
title: Fix the authentication bug
```

Quote if contains special chars or starts with number:
```yaml
title: "Fix: authentication (urgent)"
fix_version: "2.4.0"
```

### Date
ISO 8601 or YYYY-MM-DD:
```yaml
created: 2026-02-14
created: 2026-02-14T13:00:00Z
due: 2026-02-20
```

### List[String]
Array of strings:
```yaml
# Inline
labels: [security, urgent, production]

# Block
watchers:
  - john.mcmullan
  - sarah.jones
```

### List[Object]
Array of objects (for links, attachments):
```yaml
links:
  - rel: blocks
    ref: APP-1235
  - rel: related_to
    ref: APP-1200

attachments:
  - name: screenshot.png
    url: s3://bucket/APP-1234/screenshot.png
  - name: logs.txt
    url: https://fileserver/logs/APP-1234.txt
```

### Integer
Numeric value (no quotes):
```yaml
rank: 200
x-risk-score: 7
```

### Time Duration
String with unit suffix:
```yaml
estimate: 2h
estimate: 3d
estimate: 1w
logged: 4h
remaining: 1.5d
```

Or story points (numeric):
```yaml
estimate: 5
estimate: 13
```

## Validation

Fields are validated when:
- `tract create` is run
- `tract doctor` is run
- Sync server processes changes

Validation rules:
1. **Required fields present:** id, title, type, status, created
2. **Type constraints:** dates are valid dates, lists are lists, etc.
3. **Referential integrity:** sprint/component/customer exist in config
4. **Enum validation:** status/type match project config (unless `*` wildcard)
5. **ID format:** Matches `PREFIX-NUMBER` pattern
6. **File name matches ID:** `APP-1234.md` must have `id: APP-1234`

## Examples

### Minimal Bug Report
```yaml
id: APP-1234
title: Login fails on Firefox
type: bug
status: backlog
created: 2026-02-14
priority: high
assignee: john.mcmullan
labels: [browser-compat, urgent]
```

### Detailed Story with Links
```yaml
id: APP-500
title: Implement OAuth 2.0 authentication
type: story
status: in-progress
created: 2026-01-15
updated: 2026-02-14T14:30:00Z
assignee: john.mcmullan
reporter: sarah.jones
priority: high
sprint: 2026-W07
epic: APP-100
component: auth-service
labels: [security, api, oauth]
estimate: 5d
logged: 3d
remaining: 2d
due: 2026-02-20
fix_version: "2.5.0"
watchers: [mike.smith, dave.wilson]
links:
  - rel: blocks
    ref: APP-501
  - rel: related_to
    ref: APP-450
```

### Epic
```yaml
id: APP-100
title: Authentication System Overhaul
type: epic
status: in-progress
created: 2026-01-01
assignee: sarah.jones
priority: critical
sprint: null
fix_version: "2.5.0"
labels: [epic, security, Q1-2026]
```

### Tombstone (Moved Ticket)
```yaml
id: OLDPROJ-42
title: Session management improvements
type: story
status: moved
created: 2025-12-01
moved_to: NEWPROJ-123
resolution: moved
```

## Best Practices

1. **Always quote version numbers** - avoid YAML float parsing
2. **Use consistent usernames** - match git user.name
3. **Keep title brief** - detailed description goes in markdown body
4. **Update `updated` field manually** - or rely on sync to set it
5. **Use gaps in rank values** - 100, 200, 300 allows easy insertion
6. **Prefix custom fields with `x-`** - makes them obvious
7. **Link related tickets** - improves traceability
8. **Tag liberally** - labels make search easier
