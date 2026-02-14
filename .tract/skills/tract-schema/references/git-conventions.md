# Git Conventions

Git workflow and commit message conventions for Tract.

## Core Philosophy

**Git is the source of truth.** Every ticket operation should result in a clean git commit. The markdown files are the canonical representation, not a cache.

## Commit Message Format

### Creating Tickets
```
Create APP-1234: Brief title

Optional longer description if needed.
```

Example:
```
Create APP-1234: Fix session timeout bug

Users are being logged out after 5 minutes instead of 30.
Priority: critical, assigned to john.mcmullan.
```

### Updating Tickets
```
Update APP-1234: What changed

Optional details about the change.
```

Examples:
```
Update APP-1234: Change status to in-progress

Started work on session timeout fix.
```

```
Update APP-1234: Add acceptance criteria
```

```
Update APP-1234: Assign to sarah.jones
```

### Closing Tickets
```
Close APP-1234: Resolution reason

Optional details.
```

Examples:
```
Close APP-1234: Fixed in commit abc123

Session TTL increased from 300s to 1800s.
Deployed to production.
```

```
Close APP-1234: Duplicate of APP-1200
```

```
Close APP-1234: Won't fix

Decision made to keep current behavior.
Documented in wiki.
```

### Bulk Operations
```
Assign sprint 2026-W07 to backlog items

Moved 12 tickets from backlog to sprint 2026-W07.
```

```
Update priorities for security tickets

Set all security-labeled tickets to high priority.
```

### Sync Commits (Automated)
```
[tract-sync] Updated APP-1234 from Jira

Status: in-progress → done
Assignee: john.mcmullan → sarah.jones
```

**Convention:** Prefix automated sync commits with `[tract-sync]` to distinguish from human edits.

## Workflow Patterns

### Pattern 1: Create and Edit
```bash
# Create ticket
tract create APP --title "Fix timeout bug" --type bug
# Creates: issues/APP-1234.md and commits

# Edit locally
vim issues/APP-1234.md
# Add description, acceptance criteria

# Commit
git add issues/APP-1234.md
git commit -m "Update APP-1234: Add detailed description and acceptance criteria"
git push
```

### Pattern 2: Status Change
```bash
# Edit status
sed -i 's/status: backlog/status: in-progress/' issues/APP-1234.md

# Commit
git commit -am "Update APP-1234: Start work (status → in-progress)"
git push
```

### Pattern 3: Bulk Sprint Assignment
```bash
# Loop through backlog tickets
for f in issues/APP-*.md; do
  if grep -q "status: backlog" "$f"; then
    sed -i '/status: backlog/a sprint: 2026-W07' "$f"
    git add "$f"
  fi
done

# Single commit for all changes
git commit -m "Assign sprint 2026-W07 to all backlog tickets"
git push
```

### Pattern 4: Pull Before Push
```bash
# Always pull first (especially with Jira sync)
git pull

# Make changes
vim issues/APP-1234.md

# Commit and push
git commit -am "Update APP-1234: Add technical notes"
git push
```

## Branch Workflow

### Main Branch Only (Simple)
All changes go directly to `master` or `main`:
```bash
git add issues/APP-1234.md
git commit -m "Update APP-1234: ..."
git push origin master
```

**When to use:**
- Small teams
- Fast-moving projects
- Jira sync enabled (conflicts are rare)

### Feature Branches (Advanced)
Create branches for large ticket changes:
```bash
# Create branch
git checkout -b feature/APP-1234-oauth

# Create/edit tickets
vim issues/APP-1234.md
git commit -am "Update APP-1234: Add OAuth implementation notes"

# Push branch
git push origin feature/APP-1234-oauth

# Create PR/MR
# Merge to main when ready
```

**When to use:**
- Code and tickets in same repo
- Want peer review of ticket changes
- Large refactors affecting many tickets

## Handling Conflicts

### Conflict in Ticket File
```bash
git pull
# CONFLICT in issues/APP-1234.md

# Open file, resolve manually
vim issues/APP-1234.md

# Look for:
<<<<<<< HEAD
status: in-progress
=======
status: done
>>>>>>> origin/master

# Choose or merge fields
status: done
assignee: john.mcmullan

# Mark resolved
git add issues/APP-1234.md
git commit -m "Merge conflict in APP-1234: Keep done status, preserve assignee"
git push
```

### Conflict Resolution Strategy
- **Frontmatter:** Choose most recent state or merge fields manually
- **Markdown body:** Combine both sections if they don't overlap
- **Comments:** Keep both (they're timestamped, order matters)
- **When in doubt:** Accept remote (`git checkout --theirs issues/APP-1234.md`) and re-apply local edits

## Sync Server Workflow

When connected to Tract sync server:

### Automatic Sync
```bash
# Edit locally
vim issues/APP-1234.md

# Commit
git commit -am "Update APP-1234: Change assignee"

# Push → sync server → Jira update
git push
```

### Receiving Jira Changes
```bash
# Jira edit → webhook → sync server → git commit → you pull
git pull
# [tract-sync] Updated APP-1234 from Jira
```

### Offline Queue
When sync server unreachable:
```bash
# Changes queue in .tract/queue/
git push  # Fails to sync but commits locally

# Later, when server available:
git push  # Sync server processes queue
```

## Tag Conventions (Optional)

### Release Tags
```bash
git tag -a v2.5.0 -m "Release 2.5.0"
git push origin v2.5.0
```

### Sprint Tags
```bash
git tag -a sprint-2026-W07-end -m "End of sprint 2026-W07"
git push origin sprint-2026-W07-end
```

**Use when:** Want to snapshot ticket state at release or sprint boundaries.

## Commit Granularity

### Atomic Commits (Preferred)
One commit per logical change:
```bash
# Good
git commit -m "Update APP-1234: Change status to in-progress"
git commit -m "Update APP-1235: Assign to sarah.jones"

# Avoids
git commit -m "Update multiple tickets"
```

### Batch Commits (When Appropriate)
For bulk operations:
```bash
# Good
git commit -m "Assign sprint 2026-W07 to all backlog items (15 tickets)"

# When: Same logical operation across many tickets
```

## File Operations

### Renaming Files (Rare)
Tickets should never be renamed. If you must:
```bash
git mv issues/APP-1234.md issues/APP-1234-archived.md
git commit -m "Archive APP-1234 (moved to APP-1234-archived.md)"
```

**Better:** Use `resolution` field and keep original filename.

### Deleting Tickets (Avoid)
```bash
git rm issues/APP-1234.md
git commit -m "Remove APP-1234: Duplicate, replaced by APP-1235"
```

**Better:** Mark as `resolution: duplicate` and add `moved_to: APP-1235` field. Keeps history.

## History and Archaeology

### View Ticket History
```bash
git log -- issues/APP-1234.md
git log --oneline -- issues/APP-1234.md
git log --patch -- issues/APP-1234.md  # Show diffs
```

### See What Changed
```bash
git diff HEAD~1 issues/APP-1234.md
git diff abc123..def456 issues/APP-1234.md
```

### Find When Field Changed
```bash
git log -S 'status: done' -- issues/APP-1234.md
git log --all -G 'assignee:' -- issues/APP-1234.md
```

### Blame (Who Changed What)
```bash
git blame issues/APP-1234.md
```

## Best Practices

1. **Always pull before push** - especially with Jira sync
2. **Atomic commits** - one logical change per commit
3. **Clear commit messages** - include ticket ID and summary
4. **Commit frontmatter and body separately** - if making unrelated changes
5. **Don't force push** - use merge or rebase carefully
6. **Tag releases** - snapshot ticket state at milestones
7. **Prefix sync commits** - use `[tract-sync]` for automated changes
8. **Resolve conflicts manually** - don't auto-accept without reviewing

## Anti-Patterns

❌ **Vague commit messages**
```
git commit -m "Update tickets"
git commit -m "WIP"
git commit -m "Fix stuff"
```

❌ **Mixing unrelated changes**
```bash
# Bad: multiple tickets in one commit
git add issues/APP-*.md
git commit -m "Various updates"
```

❌ **Not pulling before push**
```bash
# Bad: push without pulling first
vim issues/APP-1234.md
git commit -am "Update"
git push  # Rejected: not up to date
```

❌ **Force pushing**
```bash
# Bad: force push on shared branch
git push --force origin master
```

## Example Session

Complete workflow example:

```bash
# Start of day: pull latest
cd ~/tickets/app-tickets
git pull

# Create a new ticket
tract create APP --title "Add OAuth support" --type story

# Edit to add details
vim issues/APP-1856.md
# Add description, acceptance criteria

# Commit
git commit -am "Update APP-1856: Add detailed requirements"

# Work on existing ticket
vim issues/APP-1234.md
# Change status: backlog → in-progress

# Commit
git commit -am "Update APP-1234: Start work on session timeout fix"

# Log time
tract log APP-1234 2h "Investigated session config, found root cause"

# End of day: push all changes
git push

# Sync server updates Jira automatically
```

## Integration with LLMs

When an LLM is helping you:

```
LLM: [Edits issues/APP-1234.md to change status]
     [Runs: git commit -am "Update APP-1234: Change status to done"]
     [Runs: git push]
     
     "Updated APP-1234 status to done and pushed to Jira."
```

LLM should:
- Make atomic commits
- Use clear commit messages
- Pull before editing
- Handle conflicts gracefully

## Summary

**Golden rules:**
1. Git is truth - commit everything
2. Pull before push
3. Atomic, well-described commits
4. Never force push shared branches
5. Tag releases for snapshots
