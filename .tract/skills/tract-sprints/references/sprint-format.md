# Sprint File Format Reference

Complete specification for sprint YAML files.

## File Location

Sprint files are stored in `.tract/sprints/` (in git repo):

```
.tract/
└── sprints/
    ├── 2026-W07.yaml
    ├── 2026-W08.yaml
    └── sprint-5.yaml
```

## Naming Conventions

Sprint files can use any of these naming patterns:

### Week-based (Recommended)
```
2026-W07.yaml
2026-W08.yaml
```

**Format:** `YYYY-Wnn.yaml` (ISO 8601 week number)

**Benefits:**
- Sorts chronologically
- Standard format
- Easy to calculate

### Number-based
```
sprint-1.yaml
sprint-2.yaml
```

**Format:** `sprint-N.yaml`

**Benefits:**
- Simple sequential numbering
- Team-friendly names

### Date-based
```
2026-02-10.yaml
2026-02-17.yaml
```

**Format:** `YYYY-MM-DD.yaml` (sprint start date)

**Benefits:**
- Clear chronological order
- No ambiguity

## YAML Structure

### Required Fields

```yaml
name: Sprint 7
state: open
start: 2026-02-10
end: 2026-02-21
```

#### `name` (required)
- **Type:** string
- **Description:** Human-readable sprint name
- **Examples:** "Sprint 7", "February Sprint", "OAuth Integration Sprint"

#### `state` (required)
- **Type:** string
- **Values:** `open` or `closed`
- **Description:** Current state of sprint
- **Important:** Independent of dates. A sprint with `end: 2026-02-21` can still be `state: open` if it runs longer.

#### `start` (required)
- **Type:** date
- **Format:** `YYYY-MM-DD`
- **Description:** Sprint start date

#### `end` (required)
- **Type:** date
- **Format:** `YYYY-MM-DD`
- **Description:** Planned sprint end date
- **Note:** Actual end is determined by `state` field, not this date

### Optional Fields

#### `goal` (optional)
- **Type:** string
- **Description:** Sprint goal or objective
- **Example:** "Ship FIX session stability fixes and OAuth integration"

```yaml
name: Sprint 7
state: open
start: 2026-02-10
end: 2026-02-21
goal: Ship FIX session stability fixes and OAuth integration
```

## Complete Example

```yaml
name: Sprint 8
state: open
start: 2026-02-17
end: 2026-02-28
goal: Complete OAuth integration, begin performance testing, and resolve critical bugs
```

## State Transitions

### Opening a Sprint

Create new sprint file with `state: open`:

```yaml
name: Sprint 9
state: open
start: 2026-03-01
end: 2026-03-14
goal: Performance optimization sprint
```

**Important:** Only one sprint should have `state: open` at a time.

### Closing a Sprint

Edit sprint file to change state:

```yaml
name: Sprint 8
state: closed  # Changed from 'open'
start: 2026-02-17
end: 2026-02-28
goal: Complete OAuth integration
```

### Extending a Sprint

Keep state as `open`, update end date:

```yaml
name: Sprint 8
state: open
start: 2026-02-17
end: 2026-03-03  # Extended by 3 days
goal: Complete OAuth integration
```

## Ticket Sprint References

Tickets reference sprints in frontmatter using sprint file basename (without `.yaml`):

```yaml
---
id: TB-123
title: Fix authentication bug
sprints: [2026-W08]
status: in-progress
---
```

### Sprint History

Tickets that carry over accumulate sprint IDs:

```yaml
---
id: TB-051
title: OAuth token refresh
sprints: [2026-W06, 2026-W07, 2026-W08]  # In 3rd sprint
status: in-progress
---
```

**The last element in the array is the current sprint.**

## Validation

Valid sprint file checklist:

- [ ] File is in `.tract/sprints/` directory
- [ ] Filename matches pattern (week-based, number-based, or date-based)
- [ ] Has `name` field (string)
- [ ] Has `state` field (`open` or `closed`)
- [ ] Has `start` field (valid YYYY-MM-DD date)
- [ ] Has `end` field (valid YYYY-MM-DD date)
- [ ] `end` date is after `start` date
- [ ] File is valid YAML
- [ ] File is committed to git

## Import from Jira

When importing from Jira, sprint state is mapped:

| Jira State | Tract State |
|------------|-------------|
| `active`   | `open`      |
| `closed`   | `closed`    |
| `future`   | `closed`    |

Sprint fields are extracted from Jira sprint objects:

```javascript
// Jira sprint object
{
  name: "Sprint 7",
  state: "active",
  startDate: "2026-02-10T00:00:00.000Z",
  endDate: "2026-02-21T00:00:00.000Z",
  goal: "Ship FIX session stability"
}

// Becomes Tract sprint file
name: Sprint 7
state: open
start: 2026-02-10
end: 2026-02-21
goal: Ship FIX session stability
```
