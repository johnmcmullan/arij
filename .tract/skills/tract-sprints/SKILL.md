---
name: tract-sprints
description: Manage sprints in Tract. Create sprint files, add tickets to sprints, close sprints, and view sprint boards. Use when user asks about sprints, wants to start/close a sprint, or needs to see sprint progress.
metadata:
  author: tract
  version: "1.0"
---

# Sprint Management

Manage sprints across single or multiple projects in Tract.

## When to Use This Skill

Activate when:
- User wants to create a new sprint
- User wants to add tickets to a sprint
- User asks to close or end a sprint
- User asks "what sprint are we in?" or "is there a sprint running?"
- User wants to see sprint progress
- User asks to view the sprint board

## How Sprints Work

**Sprints are YAML files in `.tract/sprints/`:**

```yaml
# .tract/sprints/2026-W07.yaml
name: Sprint 7
state: open
start: 2026-02-10
end: 2026-02-21
goal: Ship FIX session stability fixes
```

**Key concepts:**
- Sprint files are committed to git (versioned, shareable)
- Sprints can span multiple projects in a workspace
- Tickets track sprint history as arrays (last element is current)
- State flag (`open`/`closed`) controls active sprint, independent of dates

## Core Workflows

### 1. Check for Active Sprint

```bash
# Find open sprint
grep -l "state: open" .tract/sprints/*.yaml 2>/dev/null

# If found, read sprint details
cat .tract/sprints/2026-W07.yaml
```

If no sprints exist yet:
```bash
mkdir -p .tract/sprints
```

### 2. Create a New Sprint

**Manual method (preferred):**

```bash
cat > .tract/sprints/2026-W08.yaml << 'EOF'
name: Sprint 8
state: open
start: 2026-02-17
end: 2026-02-28
goal: Complete OAuth integration and performance testing
EOF

git add .tract/sprints/2026-W08.yaml
git commit -m "Start Sprint 8"
```

**Sprint naming conventions:**
- Week-based: `2026-W07.yaml` (ISO week)
- Number-based: `sprint-7.yaml`
- Date-based: `2026-02-10.yaml`

### 3. Add Tickets to Sprint

Edit ticket frontmatter to add sprint ID:

```bash
# For new ticket in sprint
vim issues/TB-123.md
```

Add to frontmatter:
```yaml
sprints: [2026-W08]
```

For tickets that roll over (carryover):
```yaml
sprints: [2026-W07, 2026-W08]  # Preserves history
```

### 4. View Sprint Board

**Auto-detection (shows sprint if open):**
```bash
tract board
```

**Explicit sprint:**
```bash
tract board --sprint 2026-W08
tract board --sprint current  # Finds open sprint
```

When no sprint is active, board shows backlog.

### 5. Close a Sprint

Edit sprint file to change state:

```bash
vim .tract/sprints/2026-W07.yaml
# Change: state: open → state: closed

git add .tract/sprints/2026-W07.yaml
git commit -m "Close Sprint 7"
```

### 6. Start Next Sprint with Carryover

Complete workflow for sprint transition:

```bash
# 1. Close current sprint
vim .tract/sprints/2026-W07.yaml  # state: closed

# 2. Create next sprint
cat > .tract/sprints/2026-W08.yaml << 'EOF'
name: Sprint 8
state: open
start: 2026-02-17
end: 2026-02-28
goal: Complete OAuth integration
EOF

# 3. Find incomplete tickets from old sprint
grep -l "sprints:.*2026-W07" issues/*.md | while read ticket; do
  # Check if ticket is incomplete (not 'done' or 'closed')
  if ! grep -q "status: \(done\|closed\)" "$ticket"; then
    echo "Incomplete: $ticket"
    # Edit to append new sprint: sprints: [2026-W07, 2026-W08]
  fi
done

# 4. Commit all changes
git add .tract/sprints/ issues/
git commit -m "Start Sprint 8, carry over 3 tickets"
```

## Sprint Storage

**Single project:**
```
my-project/
├── .tract/
│   ├── config.yaml
│   └── sprints/
│       ├── 2026-W07.yaml
│       └── 2026-W08.yaml
└── issues/
```

**Multi-project workspace:**
```
~/work/company/
├── .tract/
│   ├── workspace.yaml
│   └── sprints/         # Shared across projects
├── frontend/
│   └── issues/
└── backend/
    └── issues/
```

Sprints are in git and federated (can span multiple projects).

## Troubleshooting

### Board doesn't show sprint

**Check:**
```bash
grep "state: open" .tract/sprints/*.yaml
```

**Fix:** Ensure exactly one sprint has `state: open`.

### Ticket not in sprint board

**Check ticket:**
```bash
grep "sprints:" issues/TB-123.md
```

**Fix:** Ensure sprint ID is in array:
```yaml
sprints: [2026-W08]
```

### Multiple open sprints

**Check:**
```bash
grep -l "state: open" .tract/sprints/*.yaml
```

**Fix:** Close old sprints (change to `state: closed`).

## Reference Documentation

See [references/sprint-format.md](references/sprint-format.md) for complete sprint YAML format specification.

See [references/federation.md](references/federation.md) for multi-project workspace setup.

See [references/workflows.md](references/workflows.md) for detailed workflow examples.

## Design Philosophy

**Why sprints are files:**
- Editable by any tool (vim, LLM, web UI, CLI)
- Git history provides full audit trail
- No database needed
- Federated across projects
- Simple YAML format

**Why state flag exists:**
- Sprints don't always end on time
- Explicit control over active sprint
- Can extend or close early as needed

**Why sprint arrays:**
- Preserves carryover history
- Identifies long-running work
- Helps spot estimation problems
