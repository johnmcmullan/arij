# Boards & Sprints Philosophy: Local Developer Views

## The Key Insight

**Sprint/Board definitions don't sync. The `sprint` field on tickets does.**

### What Syncs (Distributed via Git)

```yaml
# issues/APP-123.md
---
sprint: 2026-W07      # ✅ Syncs (ticket metadata)
assignee: john        # ✅ Syncs
status: in-progress   # ✅ Syncs
---
```

All developers see the same ticket metadata.

### What Doesn't Sync (Local Developer Preference)

```yaml
# .tract/sprints/2026-W07.yaml
name: Sprint 7
start: 2026-02-10
end: 2026-02-21
goal: My personal goal for this sprint
```

```yaml
# .tract/boards/my-view.yaml
name: My Personal Board
columns:
  - name: My Todo
    filter: { assignee: john, status: todo }
```

**Why local:**
- Each developer has different workflow preferences
- PMs might organize sprints differently than developers
- Board views are personal (like .vimrc or .bashrc)
- No need to sync personal preferences

**How to share (if desired):** Commit to git (opt-in)

---

## Sync Strategy

### Ticket Metadata (Syncs)

**Fields that sync to external systems:**
```yaml
id: APP-123
title: Fix login bug
status: in-progress
priority: high
assignee: john.mcmullan
sprint: 2026-W07        # Just the ID, not the sprint definition
epic: APP-100
fix_version: "6.8.0"
component: auth-service
```

**Jira sees:**
- Issue with sprint field = "2026-W07"
- Jira has its own sprint definition (name, dates, etc.)
- Field values match, definitions don't

### Sprint Definitions (Don't Sync)

**In Jira:**
```
Sprint: "Sprint 7 - Auth Refactor"
Start: 2026-02-10
End: 2026-02-21
```

**In Tract (developer's local):**
```yaml
# .tract/sprints/2026-W07.yaml
name: Week 7 Sprint  # Different name, that's fine
start: 2026-02-10    # Same dates (optional)
end: 2026-02-21
goal: Personal goal  # Developer's own goal
```

**Different sprint definitions, same sprint ID on tickets.**

---

## Board Queries: LLM Migration

### User Request

"I have this JQL query in Jira. How do I use it in Tract?"

**Jira JQL:**
```
project = APP 
  AND sprint = "Sprint 7" 
  AND status IN ("To Do", "In Progress") 
  AND priority = High 
  ORDER BY rank
```

### LLM Response

"I can translate that to a Tract query. Here's how:

**Option 1: Direct grep**
```bash
grep -l "sprint: 2026-W07" issues/APP-*.md | \
  xargs grep -l "status: todo\|status: in-progress" | \
  xargs grep -l "priority: high"
```

**Option 2: Create a saved query**
```yaml
# .tract/queries/high-priority-sprint.yaml
name: High Priority Sprint Items
filter:
  sprint: 2026-W07
  status: [todo, in-progress]
  priority: high
sort: rank
```

**Option 3: I can run it for you**
```
Found 5 tickets matching your query:

APP-123: Fix login timeout (todo, high)
APP-124: Add OAuth support (in-progress, high)
APP-125: Security audit (todo, high)
APP-130: Performance fix (in-progress, high)
APP-135: Update docs (todo, high)

Want me to format this as a board?
```

**Which do you prefer?"**

---

## The Answer to Feature Requests

### User: "Can Tract do X?"

**Default answer:** "The LLM can already do that with this data."

### Examples

**Request:** "Show me all bugs assigned to me"

**Answer:**
```
LLM can do that now:

grep -l "assignee: john" issues/*.md | xargs grep -l "type: bug"

Want me to run it?
```

**Request:** "Show burndown chart for this sprint"

**Answer:**
```
LLM can calculate that:

Total tickets: grep -l "sprint: 2026-W07" issues/*.md | wc -l
Done tickets: grep -l "sprint: 2026-W07" issues/*.md | xargs grep -l "status: done" | wc -l

14 / 20 tickets done (70% complete)

Want a daily breakdown? I can parse git log for when tickets moved to done.
```

**Request:** "What's blocking my work?"

**Answer:**
```
LLM reads your tickets and their links:

APP-123 (yours, blocked by):
  → APP-100 (in review, owner: sarah)
  
APP-124 (yours, blocked by):
  → BACK-456 (in progress, owner: backend-team)

Sarah's ticket is nearly done (in review).
Backend ticket is in progress - might want to check with them.
```

---

## What We Build vs What LLM Does

### We Build (Core Infrastructure)

1. **Markdown + YAML format** - Machine-readable tickets
2. **SCHEMA.md** - Tells LLM how to interpret data
3. **Git storage** - Distributed, versioned
4. **Sync service** - Bidirectional external system integration
5. **CLI helpers** - `tract create`, `tract log`, etc.

### LLM Does (Queries & Analysis)

1. **Board views** - Filter tickets by any criteria
2. **Sprint reports** - Calculate velocity, burndown, etc.
3. **Dependency analysis** - Parse ticket links, find blockers
4. **Time reports** - Summarize worklogs
5. **Custom queries** - Anything the user can describe

### We DON'T Build

1. ❌ Complex board UI with custom columns
2. ❌ Sprint planning tools
3. ❌ Burndown chart renderers
4. ❌ Velocity calculators
5. ❌ Custom report generators

**Why:** LLM can read the markdown and do all of this on-demand.

---

## Practical Examples

### Sprint Planning

**User:** "Show me what's in the next sprint"

**LLM:**
```bash
# Reads .tract/sprints/2026-W08.yaml
# Finds tickets with sprint: 2026-W08
# Groups by status

Sprint 2026-W08 (Feb 24 - Mar 7)
Goal: Authentication refactor

Backlog (8):
  APP-140: Implement OAuth2
  APP-141: Add SAML support
  ...

Todo (3):
  APP-142: Refactor auth service
  ...

Total: 11 tickets, 24 story points
```

**No UI needed.** LLM reads YAML + markdown, formats output.

### Board View

**User:** "Show me my board"

**LLM:**
```bash
# User's preference stored in .tract/boards/john.yaml
# Or LLM remembers from previous conversations
# Or user describes it: "assignee=john, group by status"

grep -l "assignee: john" issues/*.md

Your Board (5 tickets):

Todo:
  APP-123: Fix login bug

In Progress:
  APP-124: Add OAuth
  APP-125: Security audit

Review:
  APP-126: Update docs

Done (this week):
  APP-120: Deploy staging
```

**No board UI needed.** LLM greps and formats.

### Migration from Jira Board

**User:** "I had a board in Jira with these columns: Todo, Dev, Review, Done. How do I get that in Tract?"

**LLM:**
```
I can show you that board anytime. Just ask:

"Show my board"

Or if you want a file for reference:

# .tract/boards/my-board.yaml
name: My Development Board
columns:
  - name: Todo
    filter: { status: todo }
  - name: Dev
    filter: { status: in-progress }
  - name: Review
    filter: { status: review }
  - name: Done
    filter: { status: done }

I've created this file. Want me to show you the current board?
```

**LLM creates the YAML, then renders it on-demand.**

---

## Developer Workflow

### Morning Standup

**Developer:** "What did I work on yesterday and what's next?"

**LLM:**
```bash
# Reads worklogs from yesterday
# Finds tickets with recent activity by this user

Yesterday (6.5h logged):
  APP-123: Fix login timeout (2.5h) - Done ✓
  APP-124: Add OAuth support (4h) - Still in progress

Next:
  APP-124: Finish OAuth (in progress)
  APP-125: Security audit (todo, high priority)

Want me to log time to APP-124 when you start?
```

### Sprint Planning

**PM:** "How's the sprint looking?"

**LLM:**
```bash
# Reads all tickets with sprint: current
# Groups by status
# Calculates points if available

Sprint 2026-W07 Progress:

Done: 14 tickets (28 points)
In Progress: 3 tickets (6 points)
Todo: 3 tickets (6 points)

Total: 20 tickets, 40 points
Velocity: 70% complete (3 days remaining)

At-risk tickets:
  APP-130: Complex, might slip (in progress 4 days)

On track to complete sprint goal ✓
```

---

## Local Configuration Strategy

### Personal Preferences (Don't Commit)

```bash
# .tract/boards/my-board.yaml
# .tract/queries/my-queries.yaml
# .tract/sprints/my-sprint-notes.yaml

# Add to .gitignore
echo ".tract/boards/my-*.yaml" >> .gitignore
echo ".tract/queries/my-*.yaml" >> .gitignore
```

### Shared Team Views (Do Commit)

```bash
# .tract/boards/team-board.yaml
# .tract/sprints/2026-W07.yaml (shared sprint definition)
# .tract/queries/blockers.yaml (shared query)

git add .tract/boards/team-board.yaml
git commit -m "Add team board view"
```

**Choice:** Each user decides what to share.

---

## Sync Implementation

### What Sync Server Does

**On ticket update in Jira:**
1. Read Jira sprint field → "Sprint 7"
2. Map to Tract sprint ID → "2026-W07"
3. Update ticket frontmatter: `sprint: 2026-W07`
4. Commit to git

**Does NOT:**
- Sync sprint definitions (name, dates, goals)
- Sync board definitions
- Sync personal queries

### What Sync Server Doesn't Do

**Jira sprint change:**
- Jira: Rename "Sprint 7" → "Sprint 7 - Auth Focus"
- Tract: No change (sprint ID still 2026-W07)
- Developers can update their local sprint YAML if they want

**Why:** Sprint metadata is preference, not data.

---

## Migration Guide

### From Jira to Tract

**Step 1: Import tickets**
```bash
tract import --jira <url> --project APP
```

**Step 2: LLM extracts your board/sprint preferences**

**User:** "In Jira I had sprints named 'Sprint 7' and 'Sprint 8'. Can you set those up?"

**LLM:**
```bash
# Creates local sprint YAML files
# Reads ticket frontmatter to infer sprint dates
# Asks user to confirm

I found tickets with sprint fields. Based on their dates:

Sprint 7 (2026-W07):
  - 15 tickets
  - Dates: Feb 10-21 (inferred from ticket created/updated dates)
  
Sprint 8 (2026-W08):
  - 8 tickets
  - Dates: Feb 24-Mar 7 (inferred)

Create sprint YAML files with these dates? (y/n)
```

**Step 3: User describes their Jira board**

**User:** "I had a board with columns: Backlog, Todo, In Progress, Review, Done"

**LLM:**
```bash
# Creates .tract/boards/main.yaml

Created board: main

Want me to show you your current board?
```

**No manual JQL translation needed.** LLM handles it conversationally.

---

## The Core Philosophy

### Traditional PM Tools

Build everything:
- Board UI
- Sprint planning tools
- Burndown charts
- Velocity calculators
- Report generators
- Complex filters

**Problem:** Rigid, slow, expensive, requires clicking.

### Tract + LLM

Build the data layer:
- Markdown tickets (readable)
- YAML frontmatter (greppable)
- Git storage (versioned)
- SCHEMA.md (LLM-understandable)

**LLM does the rest:**
- Queries (grep + parse)
- Analysis (calculate, summarize)
- Reports (format, display)
- Custom views (on-demand)

**Advantage:** Infinitely flexible, conversational, fast, free.

---

## Answer to Feature Requests

### Template Response

**User:** "Can Tract do [feature]?"

**Answer:**
"The LLM can already do that by reading the ticket data. 

Here's how: [show grep/parse example]

Want me to do it for you?"

### Examples

**"Can Tract show me a Gantt chart?"**

"LLM can generate one by reading ticket dates and dependencies. Want me to create one now? (Could output ASCII, mermaid, or tell you which tickets to sequence)"

**"Can Tract calculate team velocity?"**

"LLM can calculate that by counting completed tickets per sprint. Based on your git history:

Sprint 2026-W06: 18 tickets (36 points)
Sprint 2026-W07: 14 tickets done so far (28 points, 3 days left)

Average velocity: ~34 points/sprint

Want a breakdown by person?"

**"Can Tract send me a daily digest?"**

"LLM can generate that and you can schedule it:

# .tract/queries/daily-digest.yaml
filter:
  assignee: john
  status: [todo, in-progress]

Then set up a cron:
  0 9 * * * tract query daily-digest | mail -s 'Daily Digest' you@company.com

Or I can generate it when you ask 'What's my daily digest?'"

---

## Summary

**Sprints/Boards = Local Developer Preference**
- Sprint definitions (.tract/sprints/*.yaml) - local, optional
- Board definitions (.tract/boards/*.yaml) - local, optional
- Sprint field on tickets - syncs everywhere

**Sync Strategy:**
- ✅ Sync: Ticket metadata (sprint ID, status, assignee)
- ❌ Don't sync: Sprint definitions, board definitions, queries

**Feature Requests:**
- Default answer: "LLM can already do that"
- Show grep/parse example
- Offer to run it for them

**Philosophy:**
- Build: Data layer (markdown, git, schema)
- Don't build: Features (boards, reports, charts)
- Enable: LLM to read and analyze data on-demand

**Result:**
- Infinitely flexible (LLM can answer any query)
- Conversational (ask in natural language)
- Fast (grep beats web UI)
- Free (no complex features to maintain)

---

**"The LLM can already do that with this data."**

This is the answer to 90% of feature requests.
