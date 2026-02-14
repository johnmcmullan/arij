# Tract Schema Skill

## Purpose

Understand and operate Tract's data model for ticket management. This skill enables you to create, read, update, and query tickets using markdown files, git, and the `tract` CLI.

**The product is the specification. The interface is any LLM. The infrastructure is git.**

## When to Use This Skill

**Activate when:**
- User wants to create a ticket
- User wants to update ticket status/fields
- User asks about ticket format or available fields
- User wants to log time or add comments
- User needs to query or search tickets
- Working with `.tract/config.yaml` or ticket files

**Do NOT activate when:**
- User needs to set up Tract initially (use tract-onboarding skill)
- User needs health checks (use tract-doctor skill)
- User is not in a Tract project

## Core Workflow

### Step 1: Verify You're in a Tract Project

Before any ticket operations:

```bash
# Check for .tract/ directory
ls .tract/config.yaml
```

If missing: User needs to run `tract onboard` first (tract-onboarding skill).

If you're in a subdirectory: Tract searches parent dirs (like git does).

### Step 2: Creating Tickets

**Method 1: Direct File Creation (Local-Only Projects)**

**Note:** For local-only projects (no sync server), creating markdown files directly is the primary method. This is Tract's philosophy - tickets are just files.

```bash
# Create next ticket ID (e.g., EMACS-1)
# Get next ID from: ls issues/ | sort -V | tail -1
```

**Method 2: Using tract CLI (Requires Sync Server)**

**⚠️ Current Limitation:** `tract create` requires `TRACT_SYNC_SERVER` even for local-only projects. This is a known issue.

**For Jira-synced projects:**
```bash
export TRACT_SYNC_SERVER=http://tract-server:3100

tract create <PROJECT> \
  --title "Fix login timeout bug" \
  --type bug \
  --priority high \
  --assignee john.mcmullan \
  --description "Users logged out after 5 min..."
```

**For local-only projects (workaround):**

Create `issues/APP-<NEXT-ID>.md`:

```markdown
---
title: Fix login timeout bug
type: bug
status: backlog
priority: high
created: 2026-02-14T13:00:00Z
assignee: john.mcmullan
---

Users are getting logged out after 5 minutes instead of 30.

## Steps to Reproduce
1. Log in
2. Wait 5 minutes
3. Try to navigate
4. Session expired

## Expected
Session should last 30 minutes.
```

Then commit:
```bash
git add issues/APP-*.md
git commit -m "Create APP-1234: Fix login timeout bug"
git push
```

### Step 3: Updating Tickets

**Method 1: Edit the markdown file**

```bash
vim issues/APP-1234.md
# Change status: backlog → in-progress
# Add estimate: 2h
git add issues/APP-1234.md
git commit -m "Update APP-1234: Start work, estimate 2h"
git push
```

**Method 2: Use tract CLI for common operations**

```bash
# Log time
tract log APP-1234 2h "Fixed session TTL config"

# View worklogs
tract worklogs APP-1234
```

### Step 4: Reading Tickets

**Method 1: Direct file access**
```bash
cat issues/APP-1234.md
grep "status:" issues/APP-*.md
```

**Method 2: Git operations**
```bash
git log -- issues/APP-1234.md  # History
git diff HEAD~1 issues/APP-1234.md  # Changes
```

**Method 3: Search with grep/ripgrep**
```bash
grep -r "priority: critical" issues/
rg "status: in-progress" issues/
```

### Step 5: Time Tracking

**Log time:**
```bash
tract log APP-1234 2h "Fixed authentication bug"
```

**View timesheet:**
```bash
tract timesheet              # Your timesheet
tract timesheet john.mcmullan  # Someone else's
tract timesheet --week       # This week
tract timesheet --month 2026-02  # Specific month
```

**Time entries are stored in:**
```
worklogs/2026-02.jsonl
```

Format:
```json
{"issue":"APP-1234","author":"john.mcmullan","time":"2h","started":"2026-02-14T13:00:00Z","comment":"Fixed authentication bug"}
```

## Essential Fields

### Always Required
- `title` - Brief description
- `type` - bug | story | task | epic
- `status` - backlog | in-progress | review | done (customizable)

### Commonly Used
- `assignee` - Username of person responsible
- `priority` - trivial | minor | major | critical | blocker
- `sprint` - Sprint ID (e.g., 2026-W07)
- `component` - Logical component name
- `labels` - Array of tags
- `estimate` - Time estimate (e.g., 2h, 3d, 1w)
- `epic` - Parent epic ID (e.g., APP-100)

### Auto-Generated
- `id` - Ticket ID (e.g., APP-1234)
- `created` - ISO 8601 timestamp
- `updated` - ISO 8601 timestamp (auto-updated on save)

### Optional but Useful
- `description` - Detailed description (in markdown body)
- `reporter` - Who reported it
- `watchers` - Array of usernames
- `due` - Due date (YYYY-MM-DD)
- `fix_version` - Target release (e.g., "6.8.0")
- `customer` - Customer ID (for customer-specific tickets)
- `resolution` - fixed | wontfix | duplicate | cannot-reproduce

For complete field reference, load: `references/field-reference.md`

## Ticket Format Basics

### Structure
```markdown
---
# YAML frontmatter (metadata)
id: APP-1234
title: Short description
type: bug
status: in-progress
# ... more fields
---

# Markdown body (description, comments, etc.)

## Description
Detailed explanation...

## Steps to Reproduce
1. Step one
2. Step two

## Expected Behavior
What should happen...

## Actual Behavior
What actually happens...

## Comments

### john.mcmullan - 2026-02-14 13:00
Started investigating...
```

### Rules
- Frontmatter: YAML, between `---` lines
- Body: Markdown, everything after second `---`
- Comments: Use `### author - timestamp` format
- File name: `{ID}.md` (e.g., `APP-1234.md`)

For complete format spec, load: `references/ticket-format-spec.md`

## Git Workflow

### Creating Tickets
```bash
git add issues/APP-1234.md
git commit -m "Create APP-1234: Fix login timeout bug"
git push
```

### Updating Tickets
```bash
git add issues/APP-1234.md
git commit -m "Update APP-1234: Change status to in-progress"
git push
```

### Commit Message Convention
```
Create APP-1234: Brief title
Update APP-1234: What changed
Close APP-1234: Resolution reason
```

Or use `[tract-sync]` prefix for automated sync commits:
```
[tract-sync] Updated APP-1234 from Jira
```

For complete git conventions, load: `references/git-conventions.md`

## Common Operations

### Change Status
Edit the `status:` field in frontmatter:
```yaml
status: in-progress
```

Commit:
```bash
git commit -am "Update APP-1234: Start work"
```

### Assign to Someone
```yaml
assignee: john.mcmullan
```

### Add to Sprint
```yaml
sprint: 2026-W07
```

Sprint definition lives in `.tract/sprints/2026-W07.yaml`.

### Mark as Blocked
Use `labels`:
```yaml
labels: [blocked, waiting-for-ops]
```

Or link to blocking ticket:
```yaml
links:
  - rel: blocked_by
    ref: APP-1235
```

### Add Comments
Append to markdown body:
```markdown
## Comments

### john.mcmullan - 2026-02-14 13:00
Started investigating. Looks like session TTL config is wrong.

### sarah.jones - 2026-02-14 14:30
Confirmed. Should be 1800 seconds, not 300.
```

## Project Configuration

Located at: `.tract/config.yaml`

**Minimal example:**
```yaml
project: APP
jira:
  url: https://jira.company.com
  project: APP

types: [bug, story, task, epic]
statuses: [backlog, todo, in-progress, review, done]
priorities: [trivial, minor, major, critical, blocker]
```

**Key sections:**
- `project` - Project key
- `jira` - Jira sync settings (optional)
- `types` - Allowed issue types
- `statuses` - Workflow states
- `priorities` - Priority levels
- `components` - Component definitions

For complete config spec, load: `references/config-schema.md`

## Directory Structure

**Standard layout:**
```
project/
├── .tract/
│   ├── config.yaml          # Project configuration
│   ├── SCHEMA.md            # This specification
│   ├── sprints/             # Sprint definitions
│   ├── boards/              # Board views
│   └── queries/             # Saved queries
├── issues/                  # Ticket files
│   ├── APP-1234.md
│   ├── APP-1235.md
│   └── ...
└── worklogs/                # Time tracking
    ├── 2026-01.jsonl
    └── 2026-02.jsonl
```

For all layout variations (standalone, submodule, multi-project), load: `references/directory-structure.md`

## Example Workflows

### Example 1: Create Bug, Assign, Start Work

```bash
# Create ticket
tract create APP \
  --title "Fix session timeout" \
  --type bug \
  --priority critical \
  --assignee john.mcmullan

# Edit to add details
vim issues/APP-1234.md
# Add description, steps to reproduce

# Update status
sed -i 's/status: backlog/status: in-progress/' issues/APP-1234.md

# Commit
git add issues/APP-1234.md
git commit -m "Create APP-1234: Fix session timeout (critical bug, in progress)"
git push
```

### Example 2: Log Time Daily

```bash
# Morning
tract log APP-1234 2h "Investigated session config"

# Afternoon
tract log APP-1235 3h "Code review and testing"

# Evening - check timesheet
tract timesheet
# Today: 5h (target: 8h)
```

### Example 3: Find All Critical Bugs

```bash
grep -l "priority: critical" issues/*.md | while read f; do
  grep "type: bug" "$f" && echo "$f"
done
```

Or with ripgrep:
```bash
rg -l "priority: critical" issues/ | xargs rg -l "type: bug"
```

### Example 4: Update Multiple Tickets (Sprint Assignment)

```bash
# Add all backlog items to sprint
for f in issues/APP-*.md; do
  if grep -q "status: backlog" "$f"; then
    sed -i 's/status: backlog/sprint: 2026-W07/' "$f"
    git add "$f"
  fi
done

git commit -m "Assign backlog items to sprint 2026-W07"
git push
```

## Sync with Jira (Optional)

If `.tract/config.yaml` has Jira configured and `TRACT_SYNC_SERVER` is set:

**Changes sync automatically:**
- Edit ticket locally → commit → push → syncs to Jira
- Edit in Jira → webhook → sync server → commits to git → you pull

**Manual sync:**
```bash
git pull  # Get Jira changes
git push  # Send local changes
```

**No sync server?**
- Changes queue locally in `.tract/queue/`
- Push when server available
- Tract works offline

## Key Constraints

1. **Flat structure:** All tickets in `issues/` (no subdirs, except multi-project repos)
2. **One file per ticket:** `{ID}.md`
3. **Valid YAML frontmatter:** Must parse correctly
4. **Unique IDs:** Auto-generated by `tract create` or manually assigned
5. **Git as source of truth:** All changes committed to git

## Reference Documents

Load these on-demand for complete details:

- **`references/ticket-format-spec.md`** - Complete markdown + frontmatter spec
- **`references/field-reference.md`** - All fields, types, validation, examples
- **`references/directory-structure.md`** - All layout variations (standalone, submodule, multi-project)
- **`references/git-conventions.md`** - Commit message format, workflow patterns
- **`references/config-schema.md`** - `.tract/config.yaml` complete spec

## Troubleshooting

**Ticket not syncing to Jira?**
- Check `TRACT_SYNC_SERVER` is set
- Check sync server is running
- Look in `.tract/queue/` for queued changes

**Can't find .tract/?**
- Run `tract doctor` - it searches parent dirs
- Might not be in a Tract project (need to onboard first)

**Invalid YAML error?**
- Check frontmatter syntax
- Common mistakes: unquoted strings with colons, wrong indentation
- Validate with: `python3 -c "import yaml; yaml.safe_load(open('issues/APP-1234.md').read().split('---')[1])"`

**Git conflicts in ticket files?**
- Resolve manually (choose fields from both sides if needed)
- Or: accept one side, re-edit after merge

## Success Criteria

You're using this skill correctly when:
- ✓ Tickets are valid markdown with YAML frontmatter
- ✓ All changes committed to git
- ✓ Commit messages follow convention
- ✓ `tract doctor` passes
- ✓ Time tracking logged daily

---

**Remember:** Tract is git-native. Every operation should result in a clean git commit. The markdown files are the source of truth, not a cache.
