# Jira → Tract Migration Plan

**Status:** Planning  
**Target:** Broadridge self-hosted Jira (MySQL backend)  
**Scope:** ~34 projects, ~1700+ tickets  

---

## Core Principles

1. **Comments are content** — All comments migrated, embedded in ticket markdown
2. **Recent history only** — Git commits for last 12 months of state changes
3. **Git is source of truth** — audit.jsonl is optional derived cache
4. **Gradual migration** — Per-project cutover, not big bang

---

## What Gets Migrated

### Tickets (All)
- Current state (status, assignee, priority, type, etc.)
- **All comments ever** (embedded in markdown description)
- Links/relationships (parent/child, blocks/blocked-by)
- Attachments metadata (links to original Jira if needed)

### Git History (Last 12 Months Only)
- Status changes → git commits (backdated)
- Field updates → git commits (backdated)
- Comments → git commits (backdated, one per comment)
- Description edits → git commits (backdated)

### Older Tickets
- Imported with current state + all comments
- Synthetic "initial commit" dated 12 months ago
- Rationale: Old state transitions aren't worth commit noise

---

## File Structure

```
tract-repo/
├── projects/
│   ├── PROJ.md              # Project metadata
│   └── TBRICKS.md
├── tickets/
│   ├── PROJ-001.md          # Ticket files
│   ├── PROJ-002.md
│   ├── TBRICKS-001.md
│   └── ...
├── audit.jsonl              # Optional: queryable audit cache
└── .gitignore               # audit.jsonl ignored by default
```

---

## Ticket Format

```markdown
---
id: PROJ-123
title: Fix login timeout issue
status: in_progress
assignee: alice
priority: high
type: bug
created: 2022-03-15T10:00:00Z
updated: 2026-02-10T14:30:00Z
component: authentication
labels: [security, backend]
links:
  - type: blocks
    ticket: PROJ-124
  - type: parent
    ticket: PROJ-100
---

## Description

Users are getting logged out after 5 minutes instead of the configured 30 minutes.

Reproduced on staging environment.

## Acceptance Criteria

- [ ] Session timeout matches configuration
- [ ] Users stay logged in for 30 minutes
- [ ] Add unit tests for timeout logic

## Comments

**john** (2024-01-10T11:00:00Z):

I can reproduce this on staging. Affects Chrome and Firefox.

**alice** (2024-01-11T09:30:00Z):

Found the issue - session timeout is hardcoded in `auth.js` line 42. Fixing now.

**alice** (2024-01-11T15:45:00Z):

Fixed in commit `abc123def`. Deployed to staging for verification.
```

---

## audit.jsonl - Three Modes

### Mode 1: No Audit (Default)
- `audit.jsonl` in `.gitignore`
- Not generated unless explicitly requested
- Fast clone, queries rebuild from git (slow but acceptable)

### Mode 2: Local Only
- Generated locally via `tract audit rebuild`
- Not committed (still in `.gitignore`)
- Each developer rebuilds on first use
- Fast queries after initial rebuild

### Mode 3: Committed (Opt-In)
- Remove `audit.jsonl` from `.gitignore`
- Commit changes (batched daily or manually)
- Merge conflicts = concat both sides, sort by timestamp
- Fastest for all users (no rebuild needed)

### audit.jsonl Format

```jsonl
{"ts":"2024-01-10T10:00:00Z","ticket":"PROJ-123","user":"john","action":"created","status":"todo"}
{"ts":"2024-01-11T14:30:00Z","ticket":"PROJ-123","user":"alice","action":"status_change","from":"todo","to":"in_progress"}
{"ts":"2024-01-12T09:15:00Z","ticket":"PROJ-123","user":"alice","action":"field_change","field":"priority","from":"medium","to":"high"}
{"ts":"2024-01-14T15:30:00Z","ticket":"PROJ-123","user":"alice","action":"status_change","from":"in_progress","to":"done"}
```

Built by parsing git log and extracting events from commit diffs.

---

## Migration Process

### Phase 1: Export from Jira

**Via REST API** (Python script already exists):

```bash
python jira-export.py --projects=all --since=12m --output=exports/
```

Output structure:
```
exports/
├── PROJ/
│   ├── tickets.jsonl        # All tickets (current state)
│   ├── comments.jsonl       # All comments ever
│   ├── changelog.jsonl      # Last 12 months of changes
│   └── metadata.json        # Project info
├── TBRICKS/
│   └── ...
```

### Phase 2: Transform to Tract Format

**Migration script** (Python or Node):

```bash
tract migrate jira exports/ --output=tract-repos/
```

For each project:
1. Create git repo
2. Generate markdown files for tickets
3. Embed all comments in ticket files
4. Create git commits (backdated, last 12 months only)
5. Output: ready-to-use Tract repo

### Phase 3: Validation

```bash
# Spot check a few projects
tract validate tract-repos/PROJ/
tract validate tract-repos/TBRICKS/

# Compare counts
# Jira: 156 tickets in PROJ
# Tract: 156 markdown files in tract-repos/PROJ/tickets/

# Sample random tickets, compare content
```

### Phase 4: Pilot (Read-Only)

1. Deploy Tract with migrated repos
2. Set read-only mode (UI shows warning, no edits allowed)
3. Teams browse, search, validate data
4. Gather feedback, fix issues
5. Build confidence

### Phase 5: Per-Project Cutover

When a project is ready:

1. **In Jira:** Archive the project (read-only)
2. **In Tract:** Enable editing for that project
3. **Announce:** "PROJ is now in Tract, use the new link"
4. New work flows to Tract → git commits

Iterate per-project. Low risk. Gradual adoption.

---

## Git Commit Strategy

### During Migration

**One commit per meaningful change:**
- Ticket creation
- Status changes
- Field updates
- Each comment

All backdated to original Jira timestamp:
```bash
git commit --date="2024-01-10T11:00:00Z" -m "PROJ-123: Comment by john"
```

**For old tickets (>12 months):**
- Single synthetic commit dated 12 months ago
- Includes current state + all comments
- Message: "PROJ-123: Migrated from Jira (created 2022-03-15)"

### After Migration (Live Use)

**Edits in Tract UI trigger commits:**
- Status change → commit
- Assignee change → commit
- Comment added → commit
- Description edit → commit

Manual `git push` or auto-push via cron/webhook.

---

## Tooling Required

### 1. Jira Export Script
- REST API client (Python, already exists)
- Output: JSONL files per project
- Handles pagination, custom fields, relationships

### 2. Migration Script
```bash
tract migrate jira exports/ --output=tract-repos/ --history-months=12
```

### 3. Audit Tooling
```bash
tract audit rebuild              # Generate audit.jsonl from git
tract audit show PROJ-123        # View ticket history
tract audit stats --this-month   # Analytics
```

### 4. Validation Tools
```bash
tract validate tract-repos/PROJ/   # Check ticket count, links, etc.
```

---

## Rollback Strategy

**Per-project rollback:**
- Keep Jira projects read-only for 90 days
- If issues found, re-enable Jira project
- No data loss (Jira untouched during pilot)

**Data integrity:**
- All git repos backed up (just `git clone`)
- Jira export archives kept for 1 year

---

## Timeline (Estimated)

- **Week 1:** Finalize migration script, test on 2-3 projects
- **Week 2:** Migrate all 34 projects, validate
- **Week 3:** Deploy read-only Tract, gather feedback
- **Week 4+:** Gradual per-project cutover (1-2 per week)

---

## Open Questions

1. **Custom fields:** How many? Map to frontmatter or drop?
2. **Attachments:** Keep in Jira, link from Tract? Or migrate files too?
3. **Integrations:** CI/CD hooks, Slack notifications — rebuild or migrate?
4. **Users/permissions:** How to handle in git-based system? (Future problem)

---

## Success Criteria

✅ All tickets migrated with correct state  
✅ All comments preserved  
✅ Recent history (12 months) in git log  
✅ Teams can browse/search in Tract  
✅ No data loss vs. Jira  
✅ 90% of users prefer Tract after 1 month  

---

**Next Step:** Build and test migration script on 2-3 sample projects.
