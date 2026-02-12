# Arij LLM Operations Guide

> Step-by-step instructions for operating an Arij project management system.
> These are runbooks — what to read, what to write, what to check.

**Prerequisite:** Read `SCHEMA.md` first for the full specification.

---

## Table of Contents

1. [Initialize a New Project](#1-initialize-a-new-project)
2. [Add a Repo to the Workspace](#2-add-a-repo-to-the-workspace)
3. [Bootstrap Components from a Codebase](#3-bootstrap-components-from-a-codebase)
4. [Create a Ticket](#4-create-a-ticket)
5. [Update a Ticket](#5-update-a-ticket)
6. [Close a Ticket](#6-close-a-ticket)
7. [Move a Ticket Between Projects](#7-move-a-ticket-between-projects)
8. [Set Up a Sprint](#8-set-up-a-sprint)
9. [Create a Custom Board](#9-create-a-custom-board)
10. [Set Up a Release / Fix Version](#10-set-up-a-release--fix-version)
11. [Generate a Release Readiness Report](#11-generate-a-release-readiness-report)
12. [Generate a Sprint Report](#12-generate-a-sprint-report)
13. [Cross-Project Queries](#13-cross-project-queries)
14. [Add a Customer](#14-add-a-customer)
15. [Migrate from Jira CSV Export](#15-migrate-from-jira-csv-export)
16. [Daily Standup Generation](#16-daily-standup-generation)
17. [Stale Ticket Detection](#17-stale-ticket-detection)

---

## 1. Initialize a New Project

**Goal:** Add Arij project management to an existing git repo.

### Read
- Check if `.arij/` or `tickets/` already exist in the repo

### Write

1. Create `.arij/config.yaml`:
   ```yaml
   prefix: TB
   types: [bug, story, task, epic]
   statuses: [backlog, todo, in-progress, review, done]
   ```

2. Create `tickets/` directory (add a `.gitkeep` if empty):
   ```bash
   mkdir -p tickets
   touch tickets/.gitkeep
   ```

3. Create `.arij/components.yaml` (can be empty to start):
   ```yaml
   components: {}
   ```

4. Create empty directories for optional features:
   ```bash
   mkdir -p .arij/boards .arij/sprints .arij/releases .arij/customers .arij/queries
   ```

5. Optionally add `.gitattributes` for distribution:
   ```gitattributes
   tickets/ export-ignore
   .arij/ export-ignore
   ```

### Check
- `git add .arij/ tickets/ .gitattributes`
- Commit: `arij: initialize project TB`
- Verify config is valid YAML

---

## 2. Add a Repo to the Workspace

**Goal:** Register a repo so cross-project queries can find it.

### Read
- `~/.config/arij/workspace.yaml` (may not exist yet)
- The repo's `.arij/config.yaml` to get the prefix

### Write

Create or update `~/.config/arij/workspace.yaml`:

```yaml
repos:
  - path: ~/work/trading-platform
    prefix: TB
  - path: ~/work/client-apps
    prefix: APP
```

### Check
- Path exists and contains `.arij/config.yaml`
- Prefix matches the repo's config
- No duplicate entries

---

## 3. Bootstrap Components from a Codebase

**Goal:** Auto-generate `components.yaml` by analyzing an existing repo's structure.

### Read
1. Walk the top-level directory tree (2-3 levels deep):
   ```bash
   find . -maxdepth 3 -type d -not -path './.git/*' -not -path './node_modules/*'
   ```

2. Check git log for commit frequency per directory:
   ```bash
   git log --format='' --name-only -- 'src/' | head -500 | xargs -I{} dirname {} | sort | uniq -c | sort -rn | head -20
   ```

3. Look for existing structure signals: `package.json`, `pom.xml`, `go.mod`, `Cargo.toml` in subdirectories

### Write

Generate `.arij/components.yaml` based on findings:

```yaml
components:
  trading-oms:
    path: src/trading/oms
    owner: john        # from git log --format='%an' -- src/trading/oms | sort | uniq -c | sort -rn | head -1
  trading-fix-engine:
    path: src/trading/fix
    owner: dave
  api-gateway:
    path: src/api
    owner: sarah
  client-portal:
    path: apps/portal
```

### Check
- Present the proposed components to the user for review before committing
- Verify paths exist
- Commit: `arij: bootstrap components from codebase analysis`

---

## 4. Create a Ticket

**Goal:** Create a new ticket with the next sequential ID.

### Read
1. `.arij/config.yaml` — get the prefix, valid types and statuses
2. List existing tickets to determine next ID:
   ```bash
   ls tickets/ | sort -V | tail -1
   ```
   For multi-project: `ls tickets/TB/ | sort -V | tail -1`

### Write

1. Calculate next ID (if last is `TB-042.md`, next is `TB-043`)
2. Create `tickets/TB-043.md`:
   ```markdown
   ---
   id: TB-043
   title: Implement rate limiting on order submission API
   status: backlog
   type: story
   created: 2026-02-09
   priority: high
   component: api-gateway
   ---

   ## Description

   Add rate limiting to prevent clients from exceeding 1000 orders/sec.

   ## Acceptance Criteria

   - [ ] Rate limit configurable per client
   - [ ] HTTP 429 returned when limit exceeded
   - [ ] Metrics exposed for monitoring
   ```

### Check
- `id` matches the filename
- `status` and `type` are valid per config (or config has `*`)
- `created` is today's date
- Commit: `TB-043: create ticket — implement rate limiting on order submission API`

---

## 5. Update a Ticket

**Goal:** Modify a ticket's frontmatter or body.

### Read
1. The ticket file (e.g., `tickets/TB-043.md`)
2. `.arij/config.yaml` — validate any status/type changes

### Write

Edit the YAML frontmatter and/or markdown body. Common updates:

- **Change status:** Update `status:` field
- **Assign:** Set `assignee:` field
- **Add to sprint:** Set `sprint:` field
- **Add a comment:** Append to `## Comments` section
- **Log time:** Update `logged:` field

Example — move to in-progress and assign:

```yaml
status: in-progress
assignee: john
sprint: 2026-W07
```

### Check
- New status is valid per config
- Commit: `TB-043: assign to john, move to in-progress`

---

## 6. Close a Ticket

**Goal:** Mark a ticket as done/closed with a resolution.

### Read
- The ticket file

### Write

Update frontmatter:

```yaml
status: done
resolution: fixed
```

Or for won't fix:

```yaml
status: closed
resolution: wontfix
```

### Check
- Resolution is set (good practice for closed tickets)
- Commit: `TB-043: close — fixed`

---

## 7. Move a Ticket Between Projects

**Goal:** Move a ticket from one project to another (e.g., support case → engineering bug).

### Read
1. The source ticket (e.g., `tickets/SUP/SUP-088.md`)
2. The destination project's config for valid types/statuses
3. The destination project's tickets to determine next ID

### Write

1. **Create new ticket** in destination with next ID (e.g., `TB-042`):
   - Copy all content from the source
   - Update `id` to new ID
   - Update `type` and `status` to match destination project's schema
   - Add `moved_from: SUP-088`

2. **Tombstone the source ticket** — update `SUP-088.md`:
   ```yaml
   status: moved
   moved_to: TB-042
   ```
   Replace the body with: `This ticket has been moved to TB-042.`

### Check
- New ticket has valid type/status for destination project
- Source ticket has `moved_to` set
- Commit: `SUP-088 → TB-042: move support case to engineering`

---

## 8. Set Up a Sprint

**Goal:** Create a sprint and assign tickets to it.

### Write

1. Create `.arij/sprints/2026-W07.yaml`:
   ```yaml
   name: Sprint 7
   start: 2026-02-10
   end: 2026-02-21
   goal: FIX session stability and OAuth integration
   ```

2. For each ticket to include in the sprint, update frontmatter:
   ```yaml
   sprint: 2026-W07
   ```

### Check
- Sprint dates don't overlap with other sprints (read all files in `sprints/`)
- Commit: `arij: create sprint 2026-W07 and assign tickets`

---

## 9. Create a Custom Board

**Goal:** Define a board view for a team.

### Write

Create `.arij/boards/trading-team.yaml`:

```yaml
name: Trading Team Board
columns:
  - name: Backlog
    filter: { status: backlog, component: trading.oms }
  - name: Sprint
    filter: { status: todo, sprint: current }
  - name: In Progress
    filter: { status: in-progress }
  - name: Review
    filter: { status: review }
  - name: Done
    filter: { status: done, sprint: current }
query:
  type: [bug, story, task]
  repos: [TB, FIX]
```

### Check
- Column filter fields match actual frontmatter field names
- Statuses match the project config
- Commit: `arij: add trading team board`

---

## 10. Set Up a Release / Fix Version

**Goal:** Create a release definition that spans multiple projects.

### Write

Create `.arij/releases/6.8.0.yaml`:

```yaml
name: "6.8.0"
branch: release/6.8.0
target_date: 2026-03-15
status: planning
projects: [TB, APP, FIX]
nightly: false
notes: "FIX session stability, OAuth integration, new order types"
```

Then tag relevant tickets:

```yaml
fix_version: "6.8.0"
```

### Check
- Version string is consistent across the release file and ticket references
- Branch name follows convention
- Commit: `arij: create release 6.8.0`

---

## 11. Generate a Release Readiness Report

**Goal:** Assess whether a release is ready to ship.

### Read

1. `.arij/releases/6.8.0.yaml` — get the project list
2. All tickets across those projects where `fix_version: "6.8.0"`
3. For each ticket, check:
   - Status (is it done/closed?)
   - Priority (any critical still open?)
   - Links (any unresolved blockers?)

### Output

Generate a report like:

```markdown
# Release Readiness: 6.8.0
**Target Date:** 2026-03-15
**Status:** NOT READY

## Summary
- Total tickets: 24
- Done: 18
- In Progress: 4
- Blocked: 2

## Blockers
- **TB-042** (critical) — FIX session drops during auction — status: in-progress
  - Blocks: TB-055, APP-019
- **FIX-012** (high) — Message sequence gap on reconnect — status: review

## Open Critical/High
| ID | Title | Status | Assignee |
|----|-------|--------|----------|
| TB-042 | FIX session drops during auction | in-progress | john |
| FIX-012 | Message sequence gap on reconnect | review | dave |
| APP-019 | OAuth token refresh fails silently | in-progress | sarah |
| TB-055 | Order reject on auction re-entry | blocked | mike |

## Done (18 tickets)
[list omitted for brevity]
```

### Check
- Query all workspace repos listed in the release
- Follow `blocks`/`blocked_by` links to identify chains

---

## 12. Generate a Sprint Report

**Goal:** Summarize a completed sprint.

### Read

1. `.arij/sprints/2026-W07.yaml` — sprint metadata
2. All tickets where `sprint: 2026-W07`
3. Git log for the sprint date range to count commits per ticket

### Output

```markdown
# Sprint Report: Sprint 7 (2026-W07)
**Period:** 2026-02-10 to 2026-02-21
**Goal:** FIX session stability and OAuth integration

## Velocity
- Planned: 12 tickets
- Completed: 9
- Carried over: 3

## Completed
| ID | Title | Type | Assignee |
|----|-------|------|----------|
| TB-042 | FIX session drops during auction | bug | john |
| TB-043 | Rate limiting on order API | story | sarah |
| ... | ... | ... | ... |

## Carried Over
| ID | Title | Status | Reason |
|----|-------|--------|--------|
| APP-019 | OAuth token refresh | in-progress | Dependency on auth-service deploy |
| TB-055 | Order reject on auction re-entry | blocked | Blocked by TB-042 |
| FIX-015 | Heartbeat interval tuning | todo | Not started — deprioritized |

## Observations
- 9/12 planned items completed (75%)
- 2 items blocked by TB-042 (resolved mid-sprint)
- Unplanned: 2 hotfix tickets pulled in (TB-048, TB-049)
```

---

## 13. Cross-Project Queries

**Goal:** Query across multiple projects in the workspace.

### Read
1. `~/.config/arij/workspace.yaml` — list of repos
2. Tickets from all repos matching the query

### Example: Support cases blocked by engineering

1. Read all tickets in `SUP` where `status` is `investigating` or `waiting-internal`
2. For each, check `links` for `rel: blocked_by`
3. Follow each `ref` to the referenced ticket (may be in `TB`, `FIX`, etc.)
4. Report the chain

### Example: All critical tickets across all projects

```bash
# Across all workspace repos:
rg -l '^priority: critical' tickets/
```

Parse results, cross-reference with status to find open criticals.

### Example: Customer exposure report

1. Read all tickets where `customer: acme-corp`
2. Group by status
3. Flag any critical/sev1 items
4. Include linked engineering tickets

---

## 14. Add a Customer

**Goal:** Create a customer record and link tickets to it.

### Write

Create `.arij/customers/acme-corp.yaml`:

```yaml
name: Acme Corporation
industry: Asset Management
tier: enterprise
contacts:
  - name: Sarah Chen
    email: sarah.chen@acme.com
    role: Technical Lead
    last_verified: 2026-02-09
  - name: Mike Ross
    email: mike.ross@acme.com
    role: VP Engineering
    last_verified: 2026-02-09
notes: |
  Running TB 6.7.2 in production. LSE and Euronext connectivity.
  Primary FIX connections: LSE, Euronext, BATS.
```

To link a ticket: set `customer: acme-corp` in the ticket's frontmatter.

### Check
- Customer key (filename without `.yaml`) is kebab-case
- All contacts have `last_verified` set
- Commit: `arij: add customer acme-corp`

---

## 15. Migrate from Jira CSV Export

**Goal:** Import tickets from a Jira CSV export into Arij.

### Read

1. The Jira CSV file (exported from Jira → Filters → Export)
2. `.arij/config.yaml` — target project prefix, valid types/statuses

### Steps

1. **Parse the CSV** — map Jira columns to Arij fields:

   | Jira Column | Arij Field |
   |-------------|------------|
   | Issue key | (discard — generate new IDs) |
   | Summary | `title` |
   | Status | `status` (map to project's statuses) |
   | Issue Type | `type` (map to project's types) |
   | Created | `created` |
   | Assignee | `assignee` |
   | Priority | `priority` |
   | Fix Version/s | `fix_version` |
   | Component/s | `component` |
   | Labels | `labels` |
   | Description | Markdown body |
   | Comment | `## Comments` section |
   | Sprint | `sprint` (may need mapping) |

2. **Map values** — Jira statuses/types may differ from Arij config:
   - `In Progress` → `in-progress`
   - `To Do` → `todo`
   - `Story` → `story`
   - Create a mapping table before processing

3. **Generate IDs** — sequential starting from the current max in the project

4. **Create ticket files** — one `.md` per row

5. **Build a Jira-to-Arij ID mapping** for link resolution:
   ```
   JIRA-100 → TB-001
   JIRA-101 → TB-002
   ```

6. **Resolve links** — using the mapping, convert Jira issue links to Arij `links:` entries

### Check
- All tickets have valid types/statuses per config
- No duplicate IDs
- Links reference valid Arij IDs
- Commit: `arij: migrate N tickets from Jira export`

---

## 16. Daily Standup Generation

**Goal:** Generate a standup summary for a team.

### Read

1. Find the current sprint (scan `.arij/sprints/`, find where `start <= today <= end`)
2. All tickets in the current sprint
3. Git log from the last working day to now:
   ```bash
   git log --since="yesterday" --format="%s" -- tickets/
   ```

### Output

```markdown
# Standup — 2026-02-11 (Sprint 7)

## What changed since last standup
- TB-042: moved to review (john) — FIX session fix in staging
- TB-043: moved to in-progress (sarah) — started rate limiting work
- TB-048: created (dave) — hotfix for overnight market data gap

## In Progress
| ID | Title | Assignee | Days in Status |
|----|-------|----------|----------------|
| TB-043 | Rate limiting on order API | sarah | 1 |
| APP-019 | OAuth token refresh | sarah | 3 |
| FIX-012 | Message sequence gap | dave | 2 |

## Blocked
| ID | Title | Blocked By | Assignee |
|----|-------|------------|----------|
| TB-055 | Order reject on auction re-entry | TB-042 | mike |

## Review
| ID | Title | Assignee |
|----|-------|----------|
| TB-042 | FIX session drops during auction | john |
```

### How to calculate "Days in Status"
Check `git log --follow --format="%ai %s" -- tickets/TB-043.md` for the most recent status change commit.

---

## 17. Stale Ticket Detection

**Goal:** Find tickets that haven't been touched in N days.

### Read

1. All tickets with active statuses (`backlog`, `todo`, `in-progress`, `review`)
2. For each, check last modification date:
   ```bash
   git log -1 --format="%ai" -- tickets/TB-001.md
   ```

### Logic

- **Stale threshold:** 30 days (configurable)
- A ticket is stale if its last git commit is older than the threshold
- Exclude tickets with `status: done`, `status: closed`, `status: moved`

### Output

```markdown
# Stale Tickets (>30 days since last update)

| ID | Title | Status | Assignee | Last Updated | Days Stale |
|----|-------|--------|----------|-------------|------------|
| TB-015 | Refactor order validation | backlog | unassigned | 2026-01-05 | 37 |
| TB-023 | Add BATS connectivity | todo | dave | 2025-12-20 | 53 |
| APP-008 | Mobile app dark mode | backlog | unassigned | 2025-11-15 | 88 |
```

### Check
- If a saved query exists (`.arij/queries/stale-tickets.yaml`), use its `stale_days` value
- Flag especially stale tickets (>90 days) for potential closure
