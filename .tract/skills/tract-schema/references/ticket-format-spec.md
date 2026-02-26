# Ticket Format Specification

Complete reference for Tract ticket markdown format.

## Structure

Every ticket is a Markdown file with YAML frontmatter:

```markdown
---
# YAML frontmatter (metadata)
field: value
---

# Markdown body (content)
```

## Frontmatter Requirements

### Required Fields
```yaml
id: APP-1234              # Unique identifier
title: Short description  # Brief summary
type: bug                 # Ticket type
status: in-progress       # Current status
created: 2026-02-14       # Creation date (YYYY-MM-DD or ISO 8601)
```

### Common Optional Fields
```yaml
assignee: john.mcmullan
priority: critical
sprint: 2026-W07
component: auth-service
labels: [security, urgent]
estimate: 3d
due: 2026-02-20
```

## Complete Example

```markdown
---
id: APP-1234
title: Fix session timeout bug
type: bug
status: in-progress
priority: critical
created: 2026-02-14T13:00:00Z
updated: 2026-02-14T14:30:00Z
assignee: john.mcmullan
reporter: sarah.jones
sprint: 2026-W07
component: authentication
labels: [security, production]
estimate: 2d
logged: 4h
remaining: 1.5d
due: 2026-02-16
epic: APP-100
fix_version: "2.5.0"
affected_version: "2.4.3"
customer: acme-corp
watchers: [mike.smith, dave.wilson]
links:
  - rel: blocks
    ref: APP-1235
  - rel: related_to
    ref: APP-1200
resolution: null
---

## Description

Users are getting logged out after 5 minutes of inactivity. The session timeout should be 30 minutes, not 5.

## Steps to Reproduce

1. Log in to the application
2. Wait 5 minutes without any activity
3. Try to navigate to a new page
4. Redirected to login (session expired)

## Expected Behavior

Session should remain active for 30 minutes of inactivity.

## Technical Details

The issue is in `auth-middleware.js` where `SESSION_TTL` is set to `300` (5 minutes in seconds) instead of `1800` (30 minutes).

## Acceptance Criteria

- [ ] Session timeout set to 30 minutes
- [ ] Existing sessions migrated correctly
- [ ] Unit tests updated
- [ ] Documentation updated

## Comments

### sarah.jones - 2026-02-14 13:00
Multiple users reporting this. High priority.

### john.mcmullan - 2026-02-14 14:30
Root cause identified. Config value was wrong in deployment script. Fix in progress.
```

## Field Value Formats

### Dates
```yaml
created: 2026-02-14                    # Date only
created: 2026-02-14T13:00:00Z          # Full ISO 8601
due: 2026-02-20                        # YYYY-MM-DD
```

### Time Estimates
```yaml
estimate: 2h          # Hours
estimate: 3d          # Days
estimate: 1w          # Weeks
estimate: 5           # Story points (numeric)
```

### Lists
```yaml
labels: [security, urgent, production]
watchers: [john, sarah, mike]
```

### Links
```yaml
links:
  - rel: blocks          # Relationship type
    ref: APP-1235        # Target ticket ID
  - rel: blocked_by
    ref: APP-1236
  - rel: related_to
    ref: APP-1200
```

Link relationship types:
- `blocks` - This ticket blocks the referenced ticket
- `blocked_by` - This ticket is blocked by the referenced ticket
- `duplicates` - This is a duplicate of the referenced ticket
- `related_to` - General relationship
- `causes` - This ticket causes the referenced issue
- `caused_by` - This ticket is caused by the referenced issue

## Markdown Body Conventions

### Sections (Recommended)
```markdown
## Description
What the ticket is about.

## Steps to Reproduce
For bugs - how to trigger the issue.

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Acceptance Criteria
- [ ] Checklist item 1
- [ ] Checklist item 2

## Technical Notes
Implementation details.

## Comments
Use heading level 3 for comment authorship.

### author - YYYY-MM-DD HH:MM
Comment text.
```

### Comments Format
```markdown
## Comments

### john.mcmullan - 2026-02-14 13:00
Started investigating. Looks like a config issue.

### sarah.jones - 2026-02-14 14:30
Confirmed. Session TTL is set wrong in production.
```

## File Naming

**Format:** `{ID}.md`

Examples:
- `APP-1234.md`
- `TB-042.md`
- `PROJ-5.md`

**Location:**
- Single-project repo: `issues/APP-1234.md`
- Multi-project repo: `issues/APP/APP-1234.md` or `issues/TB/TB-042.md`

## YAML Syntax Rules

### Strings
```yaml
# Simple strings (no special chars)
title: Fix the bug

# Quoted strings (contains special chars or starts with number)
title: "Fix: the bug"
title: "2024 release notes"

# Multi-line strings
description: |
  This is a long description
  that spans multiple lines.
```

### Booleans
```yaml
archived: true
active: false
```

### Numbers
```yaml
rank: 100
x-risk-score: 7
```

### Null
```yaml
resolution: null          # Explicitly null
assignee:                 # Also null (empty value)
```

### Arrays
```yaml
# Inline
labels: [bug, security, urgent]

# Block
watchers:
  - john.mcmullan
  - sarah.jones
  - mike.smith
```

### Objects
```yaml
# Inline (avoid for readability)
link: {rel: blocks, ref: APP-1235}

# Block (preferred)
links:
  - rel: blocks
    ref: APP-1235
  - rel: related_to
    ref: APP-1200
```

## Validation Rules

1. **Frontmatter must be valid YAML** - parse errors = invalid ticket
2. **Required fields must be present** - id, title, type, status, created
3. **Field types must match** - dates must be valid dates, etc.
4. **Status/type must be in project config** - unless config allows `*` (any value)
5. **Ticket ID must be unique** - no duplicate IDs in the repo
6. **File name must match ID** - `APP-1234.md` must have `id: APP-1234`

## Common Mistakes

### Missing quotes for version numbers
```yaml
# ❌ Wrong - YAML parses as float
fix_version: 2.4.0

# ✅ Correct
fix_version: "2.4.0"
```

### Unquoted strings with colons
```yaml
# ❌ Wrong - YAML thinks it's a nested object
title: Fix: authentication bug

# ✅ Correct
title: "Fix: authentication bug"
```

### Wrong date format
```yaml
# ❌ Wrong
created: 14/02/2026

# ✅ Correct
created: 2026-02-14
```

### Links as strings instead of objects
```yaml
# ❌ Wrong
links: APP-1235

# ✅ Correct
links:
  - rel: blocks
    ref: APP-1235
```

## Minimal Valid Ticket

Absolute minimum required:

```markdown
---
id: APP-1
title: My ticket
type: task
status: backlog
created: 2026-02-14
---

Ticket description goes here.
```

This is valid and will work, but real tickets should include more context.

## Custom Fields

Any field not in the standard list is considered custom (freeform).

**Convention:** Prefix with `x-`

```yaml
x-risk-score: 8
x-compliance-review: pending
x-customer-impact: high
x-deployment-notes: "Requires DB migration"
```

Custom fields:
- Are preserved exactly as written
- Are not validated
- Can be used in queries and filters
- Are synced to Jira if configured
