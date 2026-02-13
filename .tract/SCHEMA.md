# Tract Schema Specification

> The product is a specification. The interface is any LLM. The infrastructure is git.

**Version:** 1.0.0
**Date:** 2026-02-09

This document is the complete reference for operating a Tract project management system. An LLM reading this document should be able to create, query, update, and manage all aspects of the system using only filesystem operations and git.

---

## Table of Contents

1. [Directory Structure](#1-directory-structure)
2. [Ticket Format](#2-ticket-format)
3. [Field Reference](#3-field-reference)
4. [ID Generation](#4-id-generation)
5. [Project Configuration](#5-project-configuration)
6. [Config Inheritance](#6-config-inheritance)
7. [Workspace Configuration](#7-workspace-configuration)
8. [Components](#8-components)
9. [Sprints](#9-sprints)
10. [Boards](#10-boards)
11. [Releases & Fix Versions](#11-releases--fix-versions)
12. [Customers](#12-customers)
13. [Saved Queries](#13-saved-queries)
14. [Links & Relationships](#14-links--relationships)
15. [Comments](#15-comments)
16. [Moving Tickets](#16-moving-tickets)
17. [Commit Message Convention](#17-commit-message-convention)
18. [Distribution & Submodules](#18-distribution--submodules)

---

## 1. Directory Structure

### Dual-Mode: Standalone & Submodule

Ticket repos work in two modes with zero changes. See `FEDERATION.md` for full details.

**Standalone mode** — ticket repo cloned on its own (Tract server or developer):

```
tickets-tb/                      # self-contained ticket repo
├── .tract/
│   ├── config.yaml
│   ├── workflows/
│   ├── sprints/
│   ├── boards/
│   └── ...
├── TB-001.md
├── TB-002.md
└── TB-003.md
```

**Submodule mode** — ticket repo mounted inside a code repo:

```
trading-platform/                # code repo
├── src/
├── tickets/                     # git submodule → tickets-tb repo
│   ├── .tract/
│   │   └── config.yaml
│   ├── TB-001.md
│   └── TB-002.md
├── .tract/                       # optional parent config
│   └── config.yaml              # can point at submodule path
└── ...
```

**Key principle:** The ticket repo must be **self-contained** — it carries its own `.tract/` config, sprints, boards, and everything else. This is what makes dual-mode possible. The same repo works identically whether cloned standalone or mounted as a submodule.

### Per-Repository Layout (Code + Tickets in One Repo)

For simpler setups where tickets live alongside code in a single repo:

```
repo/
├── .tract/
│   ├── config.yaml              # Project config (prefix, types, statuses)
│   ├── components.yaml          # Logical component → physical location map
│   ├── boards/
│   │   ├── engineering.yaml     # Board view definitions
│   │   └── support.yaml
│   ├── sprints/
│   │   ├── 2026-W07.yaml
│   │   └── 2026-W08.yaml
│   ├── releases/
│   │   └── 6.8.0.yaml
│   ├── customers/
│   │   └── acme-corp.yaml
│   └── queries/
│       └── blocked-by-eng.yaml
├── tickets/
│   ├── TB-001.md
│   ├── TB-002.md
│   └── TB-003.md
├── .gitattributes               # Optional: export-ignore rules
└── (source code)
```

### Key Rules

- **`.tract/`** holds all configuration. Never put tickets here.
- **Ticket files** live at the repo root (standalone ticket repos) or in `tickets/` (code repos). Flat — no subdirectories. One file per ticket.
- Ticket filename is `{ID}.md` — e.g., `TB-042.md`.
- Multiple projects in one repo: use `tickets/PROJECT/` directories (e.g., `tickets/TB/`, `tickets/APP/`).
- **Self-contained ticket repos** must carry their own `.tract/` directory with full config — they must work without any parent repo.

### Multi-Project Repository Layout

```
repo/
├── .tract/
│   ├── config.yaml              # Lists all project prefixes
│   ├── components.yaml
│   └── ...
├── tickets/
│   ├── TB/
│   │   ├── TB-001.md
│   │   └── TB-002.md
│   └── APP/
│       ├── APP-001.md
│       └── APP-002.md
└── ...
```

Multi-project `config.yaml`:

```yaml
projects:
  TB:
    types: [bug, story, task, epic]
    statuses: [backlog, todo, in-progress, review, done]
  APP:
    types: [bug, story, task]
    statuses: [backlog, todo, in-progress, done]
```

### Single-Project Repository Layout

When a repo has one project, tickets live directly in `tickets/`:

```yaml
# .tract/config.yaml
prefix: TB
types: [bug, story, task, epic]
statuses: [backlog, todo, in-progress, review, done]
```

```
tickets/
├── TB-001.md
├── TB-002.md
└── TB-003.md
```

---

## 2. Ticket Format

Every ticket is a Markdown file with YAML frontmatter.

### Complete Example

```markdown
---
id: TB-042
title: FIX session drops during market close auction
status: in-progress
type: bug
created: 2026-02-09
assignee: john
priority: critical
sprint: 2026-W07
epic: TB-010
fix_version: "6.8.0"
affected_version: "6.7.2"
component: trading.fix-engine
labels: [fix-protocol, production, sev1]
customer: acme-corp
reporter: sarah
watchers: [mike, dave]
due: 2026-02-14
estimate: 3d
logged: 4h
remaining: 2d
severity: sev1
environment: prod-eu
links:
  - rel: blocks
    ref: TB-055
  - rel: related_to
    ref: APP-019
resolution: null
x-risk-score: 9
x-trade-impact: "~2000 orders/day affected"
---

## Description

FIX sessions to LSE and Euronext drop during the closing auction window (16:28-16:35 GMT). The heartbeat interval is correctly configured at 30s but the counterparty reports no messages received.

## Acceptance Criteria

- [ ] Sessions remain stable through closing auction
- [ ] Heartbeat delivery confirmed via packet capture
- [ ] No message gaps in FIX log during 16:00-17:00 window
- [ ] Tested against simulator for LSE and Euronext

## Comments

### sarah — 2026-02-09 14:30
Acme reported this again today. Third occurrence this week. LSE only so far.

### john — 2026-02-09 16:15
Root cause identified: TCP_NODELAY not set on the auction-mode socket. Fix in branch `fix/TB-042-nagle`.

### john — 2026-02-09 20:00
Fix deployed to staging. Running overnight soak test against LSE simulator.
```

### Minimal Example

```markdown
---
id: TB-043
title: Update API docs for v6.8
status: backlog
type: task
created: 2026-02-09
---

Update the REST API documentation to reflect the new order types added in 6.8.
```

---

## 3. Field Reference

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique ticket identifier. Format: `PREFIX-NUMBER` (e.g., `TB-042`) |
| `title` | string | Short summary of the ticket |
| `status` | string | Current status. Must be in project's defined statuses (or any value if `*`) |
| `type` | string | Ticket type. Must be in project's defined types (or any value if `*`) |
| `created` | date | ISO date of creation (`YYYY-MM-DD`) |

### Optional Known Fields

These are recognised by the schema. If present, they should conform to the types below. If absent, they are simply missing (not null).

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `assignee` | string | Unix/git username of the person responsible | `john` |
| `priority` | string | Priority level (project-defined or freeform) | `critical`, `high`, `medium`, `low` |
| `sprint` | string | Sprint identifier matching a file in `sprints/` | `2026-W07` |
| `epic` | string | Ticket ID of the parent epic | `TB-010` |
| `fix_version` | string | Target release version | `"6.8.0"` |
| `affected_version` | string | Version where a bug was found | `"6.7.2"` |
| `component` | string | Logical component name from `components.yaml` | `trading.fix-engine` |
| `labels` | list[string] | Freeform tags. **Field name is configurable** — during onboarding, users choose `labels` or `tags`. Config stores `tag_field: labels` (or `tags`). Use whichever name the project config specifies. | `[fix-protocol, production]` |
| `links` | list[object] | Relationships to other tickets (see §14) | See below |
| `customer` | string | Customer key matching a file in `customers/` | `acme-corp` |
| `reporter` | string | Who raised the ticket | `sarah` |
| `watchers` | list[string] | Users interested in updates | `[mike, dave]` |
| `due` | date | Due date (`YYYY-MM-DD`) | `2026-02-14` |
| `estimate` | string | Estimated effort (points or duration) | `5`, `3d`, `8h` |
| `logged` | string | Time spent so far | `4h` |
| `remaining` | string | Time remaining | `2d` |
| `severity` | string | Severity level (distinct from priority) | `sev1` |
| `environment` | string | Where the issue occurs | `prod-eu` |
| `resolution` | string | How a closed ticket was resolved | `fixed`, `wontfix`, `duplicate` |
| `moved_to` | string | Ticket ID this was moved to (tombstone) | `APP-018` |
| `moved_from` | string | Ticket ID this was moved from | `TB-042` |
| `attachments` | list[object] | File attachments. Each object has `name` and `url`. Convention: no binary in git — link to external storage (S3, NFS, SharePoint, etc.). | `[{name: screenshot.png, url: "s3://bucket/TB-042/screenshot.png"}]` |
| `rank` | integer | Ordering within sprint/backlog views. Boards sort by rank within columns. Use gaps (100, 200, 300) for easy insertion. | `200` |

### Freeform Fields

Any field not listed above is **freeform**. It is preserved exactly as written but not validated. Convention: prefix custom fields with `x-`.

```yaml
x-risk-score: 7
x-trade-impact: "~2000 orders/day"
x-compliance-review: pending
```

Freeform fields can be used in board filters and queries — they are just YAML keys.

---

## Derived Fields

Some fields are **not stored in frontmatter** — they are derived at query time from git or from other tickets.

### `modified`

Derived from git history:

```bash
git log -1 --format=%ai -- tickets/TB-042.md
```

**Why not store it?** Because it can't drift from reality. Git *is* the source of truth for when a file last changed. Storing `modified` in frontmatter creates a maintenance burden and an inevitable consistency problem — someone forgets to update it, or a rebase changes it silently. Deriving from git means zero maintenance and zero drift.

### `blocked` (derived status)

A ticket is considered **blocked** if it has `blocked_by` links where the referenced ticket's status is not in a terminal state (`done`, `closed`, `resolved`). This is not a stored status value — it's a computed overlay.

To check if a ticket is blocked:

1. Read its `links` for any `rel: blocked_by` entries
2. For each `ref`, look up that ticket's `status`
3. If any referenced ticket has a non-terminal status → this ticket is blocked

Boards and queries can use `blocked: true` as a virtual filter. The underlying `status` field remains whatever it actually is (`todo`, `in-progress`, etc.) — `blocked` is an additional signal, not a replacement.

---

## 4. ID Generation

### Algorithm

IDs are sequential per project directory. To generate the next ID:

1. List all ticket files in the project directory
2. Sort by version number and take the last one
3. Extract the number, increment by 1
4. Create the new file

```bash
# For project prefix TB in tickets/TB/ (or tickets/ for single-project repos)
LAST=$(ls tickets/TB/ | sort -V | tail -1)   # e.g., TB-042.md
NUM=$(echo "$LAST" | grep -oP '\d+')          # 42
NEXT=$((NUM + 1))                              # 43
NEW_ID="TB-$(printf '%03d' $NEXT)"             # TB-043
```

If the directory is empty, start at 1: `TB-001`.

### Concurrency

**Git merge conflict is the resolution mechanism.** If two people create tickets simultaneously:

1. Both get the same next number locally
2. Both commit and push
3. The second push fails with a merge conflict on the duplicate filename
4. That person pulls, sees the conflict, increments again, and retries

This is deliberate. Merge conflicts are explicit and visible — better than silent overwrites. In practice, collisions are rare and trivially resolved.

### ID Format

- Always zero-padded to at least 3 digits: `TB-001`, `TB-042`, `TB-100`, `TB-1042`
- The number never resets. Deleted tickets leave gaps. That's fine.

---

## 5. Project Configuration

### `.tract/config.yaml`

```yaml
prefix: TB
types: [bug, story, task, epic]
statuses: [backlog, todo, in-progress, review, done]
priorities: [critical, high, medium, low]
tag_field: labels          # or "tags" — configurable during onboarding
```

### Wildcard Mode

Use `*` to accept any value for a field:

```yaml
prefix: NOTES
types: ['*']        # Any type value accepted, no validation
statuses: ['*']     # Any status value accepted
tag_field: tags     # This project prefers "tags" over "labels"
```

This is useful for personal/informal projects, or for support/sales teams that want total flexibility.

### Multi-Project Config

```yaml
projects:
  TB:
    types: [bug, story, task, epic]
    statuses: [backlog, todo, in-progress, review, done]
  FIX:
    types: [bug, enhancement, investigation]
    statuses: [new, triaged, in-progress, testing, deployed, closed]
  SUP:
    types: [support-case, question, incident]
    statuses: [new, investigating, waiting-customer, waiting-internal, resolved, closed]
```

---

## 6. Config Inheritance

Configuration merges from two levels:

```
~/.config/tract/defaults.yaml    ← User-level defaults (applied everywhere)
repo/.tract/config.yaml          ← Repo-level overrides
```

### User Defaults Example

```yaml
# ~/.config/tract/defaults.yaml
default_assignee: john
default_priority: medium
priorities: [critical, high, medium, low]
```

### Merge Behaviour

- Repo config **overrides** user defaults for any key present in both
- Lists are **replaced**, not appended (repo `statuses` replaces user `statuses`)
- Keys only in user defaults are preserved
- Keys only in repo config are preserved

The final effective config is: `user_defaults | repo_config` (repo wins on conflict).

---

## 7. Workspace Configuration

A workspace ties multiple repos together for cross-project queries.

### `~/.config/tract/workspace.yaml`

```yaml
repos:
  - path: ~/work/trading-platform
    prefix: TB
  - path: ~/work/trading-platform
    prefix: FIX
  - path: ~/work/client-apps
    prefix: APP
  - path: ~/work/support-tickets
    prefix: SUP
  - path: ~/work/product
    prefix: PRD
```

### Usage

- Cross-project queries iterate over all repos in the workspace
- Board definitions can specify `repos: [TB, FIX]` to limit scope
- The workspace file is the only thing that knows about multiple repos

---

## 8. Components

Components map logical names to physical locations (repos, paths, URLs).

### `.tract/components.yaml`

```yaml
components:
  trading-oms:
    url: git@github.com:acme/tbricks-apps.git
    path: src/trading/oms
    owner: john
  trading-fix-engine:
    url: git@github.com:acme/tbricks-apps.git
    path: src/trading/fix
    owner: dave
  auth-service:
    url: git@github.com:acme/platform.git
    path: services/auth
  client-portal:
    url: git@github.com:acme/client-apps.git
    path: apps/portal
  docs:
    url: https://confluence.acme.com/display/ARCH
```

### Sub-Components (Dot Notation)

Use dot notation for hierarchical components:

```yaml
components:
  trading:
    url: git@github.com:acme/tbricks-apps.git
    path: src/trading
    children:
      oms:
        path: src/trading/oms
      fix-engine:
        path: src/trading/fix
      market-data:
        path: src/trading/md
```

Tickets reference as `component: trading.fix-engine`.

### Ticket Reference

```yaml
component: trading-oms
```

The component value must match a key in `components.yaml`. This is a soft reference — no enforcement at the file level, but an LLM or validation script should flag unknown components.

---

## 9. Sprints

A sprint is a YAML file in `.tract/sprints/`.

### `.tract/sprints/2026-W07.yaml`

```yaml
name: Sprint 7
start: 2026-02-10
end: 2026-02-21
goal: Ship FIX session stability fixes and OAuth integration
```

### Sprint Assignment

Tickets reference sprints via frontmatter:

```yaml
sprint: 2026-W07
```

### The `current` Keyword

In board filters and queries, the keyword `current` resolves to the sprint whose date range includes today:

```yaml
filter: { sprint: current }
```

Resolution: scan all sprint YAML files, find the one where `start <= today <= end`.

### Sprint Lifecycle

1. **Create** the sprint YAML file
2. **Assign** tickets by setting `sprint: SPRINT-ID` in frontmatter
3. **During** the sprint, tickets move through statuses
4. **After** the sprint, unfinished tickets either get their sprint updated to the next sprint or have the field cleared

---

## 10. Boards

A board is a YAML view definition — it describes columns and filters over ticket frontmatter.

### `.tract/boards/engineering.yaml`

```yaml
name: Engineering Board
columns:
  - name: Backlog
    filter: { status: backlog }
  - name: Sprint To Do
    filter: { status: todo, sprint: current }
  - name: In Progress
    filter: { status: in-progress }
  - name: In Review
    filter: { status: review }
  - name: Done (This Sprint)
    filter: { status: done, sprint: current }
query:
  type: [bug, story, task]
  repos: [TB, FIX]
```

### `.tract/boards/support-dashboard.yaml`

```yaml
name: Support Dashboard
columns:
  - name: New
    filter: { status: new }
  - name: Investigating
    filter: { status: investigating }
  - name: Waiting on Customer
    filter: { status: waiting-customer }
  - name: Waiting on Engineering
    filter: { status: waiting-internal }
  - name: Resolved
    filter: { status: resolved }
query:
  type: [support-case, incident]
  repos: [SUP]
```

### Filter Semantics

- Filters match on frontmatter fields
- Multiple fields in a filter are AND conditions
- List values for a field are OR conditions: `type: [bug, story]` matches either
- `current` in sprint filters resolves to the active sprint (see §9)
- `repos` limits which workspace repos to query (defaults to all)
- Tickets are assigned to the **first column whose filter matches** (evaluated top to bottom)

### Rendering

A board is rendered by:

1. Collecting all tickets matching the top-level `query`
2. For each column, filtering tickets matching that column's `filter`
3. Outputting the result as a text table, markdown, or any format the consumer wants

---

## 11. Releases & Fix Versions

Releases are **workspace-level** — they span multiple projects because multiple components ship together.

### `.tract/releases/6.8.0.yaml`

```yaml
name: "6.8.0"
branch: release/6.8.0
target_date: 2026-03-15
status: in-progress
projects: [TB, APP, FIX]
nightly: true
notes: "FIX session stability, OAuth integration, new order types"
```

### Ticket Reference

```yaml
fix_version: "6.8.0"
affected_version: "6.7.2"    # For bugs: which version the bug was found in
```

### Release Branches

- `main` = current development state
- `release/6.8.0` = release branch
- `git diff release/6.7.2..release/6.8.0 -- tickets/` = what changed between releases

### Fix Version Validation (Submodule Mode)

When tickets are submodules inside code repos, the developer LLM can **verify fix versions against actual branches**:

1. Check `git branch` on the code repo → see `release/6.8.0`
2. Find tickets with `fix_version: "6.8.0"`
3. Check if fix branches (e.g., `fix/TB-042-nagle`) are merged into the release branch
4. Warn on mismatch: `"TB-042 tagged for 6.8.0 but fix/TB-042-nagle not merged into release/6.8.0"`

This only works in submodule mode — the LLM needs visibility into both the ticket repo and the code repo. See `FEDERATION.md §3` for full details.

**The insight:** Tickets say what *should* be in a release. Branches say what *is*. Mismatch = warning.

### Release Readiness

To assess release readiness, query all tickets where `fix_version: "6.8.0"` and check:

- Any with `status` not in `[done, closed]`?
- Any with `priority: critical` still open?
- Any with unresolved `blocks` links?
- (Submodule mode) Any fix branches not merged into the release branch?

---

## 12. Customers

Customer records live in `.tract/customers/`.

### `.tract/customers/acme-corp.yaml`

```yaml
name: Acme Corporation
industry: Asset Management
tier: enterprise
contacts:
  - name: Sarah Chen
    email: sarah.chen@acme.com
    role: Technical Lead
    last_verified: 2026-01-15
  - name: Mike Ross
    email: mike.ross@acme.com
    role: VP Engineering
    last_verified: 2025-09-20
notes: |
  Running TB 6.7.2 in production. LSE and Euronext connectivity.
  Upgrade to 6.8.0 planned for Q2.
```

### Ticket Reference

```yaml
customer: acme-corp
```

### Stale Contact Detection

A contact is stale if `last_verified` is more than 90 days ago. An agent should flag these periodically.

---

## 13. Saved Queries

Saved queries are reusable filter definitions stored in `.tract/queries/`.

### `.tract/queries/blocked-by-eng.yaml`

```yaml
name: Support cases blocked by engineering
description: Find all support cases that are waiting on engineering bugs or stories
filter:
  type: [support-case]
  status: [investigating, waiting-internal]
  links:
    rel: blocked_by
```

### `.tract/queries/critical-open.yaml`

```yaml
name: Critical open tickets
filter:
  priority: critical
  status: [backlog, todo, in-progress, review]
repos: [TB, FIX, APP]
```

### `.tract/queries/stale-tickets.yaml`

```yaml
name: Stale tickets (no update in 30 days)
description: Tickets with no git commit touching them in 30+ days
filter:
  status: [backlog, todo, in-progress]
stale_days: 30
```

### Executing a Query

To execute a saved query:

1. Read the query YAML
2. For each repo in scope (from `repos` or all workspace repos)
3. Scan ticket files, parse frontmatter
4. Apply filter conditions
5. For link-based filters: follow the `ref` to the referenced ticket and check its fields
6. For `stale_days`: check `git log -1 --format=%ai -- tickets/TB-042.md`
7. Return matching tickets

---

## 14. Links & Relationships

Tickets can link to other tickets using the `links` field.

### Structure

```yaml
links:
  - rel: blocks
    ref: TB-055
  - rel: related_to
    ref: APP-019
  - rel: duplicate_of
    ref: TB-030
```

### Relationship Types

| Relationship | Inverse | Meaning |
|-------------|---------|---------|
| `blocks` | `blocked_by` | This ticket blocks the referenced ticket |
| `blocked_by` | `blocks` | This ticket is blocked by the referenced ticket |
| `related_to` | `related_to` | Bidirectional general relationship |
| `duplicate_of` | `duplicate_of` | This ticket duplicates the referenced one |
| `parent` | `child` | This ticket is a parent of the referenced ticket |
| `child` | `parent` | This ticket is a child of the referenced ticket |

### Important Rules

- Links are **stored on one side only**. You do NOT need to add the inverse link to the other ticket. An LLM resolving links should check both directions by scanning.
- However, **maintaining both sides is recommended** for performance and clarity when practical.
- Cross-project links are fully supported: `ref: APP-019` from a `TB` ticket.
- The `ref` is a ticket ID, not a file path. Resolution: find the file in the appropriate project directory.

### Epic Relationship

The `epic` field is shorthand for a `child` link:

```yaml
epic: TB-010    # equivalent to links: [{ rel: child, ref: TB-010 }] on the epic
```

---

## 15. Comments

Comments live in the ticket's markdown body under a `## Comments` heading.

### Format

```markdown
## Comments

### john — 2026-02-09 14:30
Root cause identified. TCP_NODELAY not set on auction-mode socket.

### sarah — 2026-02-10 09:15
Confirmed fix works in staging. Proceeding to prod deployment.
```

### Rules

- Each comment is an H3 heading: `### {author} — {YYYY-MM-DD HH:MM}`
- Comments are appended in chronological order
- The author is a username (same namespace as `assignee`)
- Comments are never deleted — only appended (git history preserves everything regardless)
- The `## Comments` section must be the **last section** in the file

### Adding a Comment

To add a comment, append to the end of the file:

```markdown

### wylie — 2026-02-10 11:00
Deployed to production. Monitoring overnight.
```

If no `## Comments` section exists, create it:

```markdown

## Comments

### wylie — 2026-02-10 11:00
Initial triage complete. Assigning to john.
```

---

## 16. Moving Tickets

When a ticket needs to move between projects (e.g., a support case becomes an engineering bug):

### Procedure

1. **Create** the new ticket in the destination project with a new ID
2. **Copy** all content from the old ticket to the new one
3. **Update** the new ticket's `id` to the new ID
4. **Add** `moved_from: OLD-ID` to the new ticket
5. **Tombstone** the old ticket: set `status: moved` and `moved_to: NEW-ID`

### Example

Old ticket (`tickets/SUP/SUP-088.md`) after move:

```yaml
---
id: SUP-088
title: FIX session drops during auction
status: moved
type: support-case
created: 2026-02-01
moved_to: TB-042
---

This ticket has been moved to TB-042.
```

New ticket (`tickets/TB/TB-042.md`):

```yaml
---
id: TB-042
title: FIX session drops during market close auction
status: in-progress
type: bug
created: 2026-02-09
moved_from: SUP-088
---
(full content copied and updated)
```

### Rules

- The old ticket is a **tombstone** — it should not be edited further
- Git history on both files preserves the full trail
- Queries should exclude tickets with `status: moved` by default

---

## 17. Commit Message Convention

All commits that relate to a ticket **must** prefix the message with the ticket ID:

```
TB-042: fix TCP_NODELAY on auction socket
TB-042: add integration test for closing auction window
APP-019: update OAuth token refresh logic
```

### Why

- `git log --grep="TB-042"` across the code repo reconstructs the full implementation history
- Links code changes to tickets without any external integration
- Works across repos (search each repo's git log)

### Multiple Tickets

If a commit relates to multiple tickets, list all:

```
TB-042, TB-055: refactor socket configuration for all FIX sessions
```

---

## 18. Distribution & Submodules

Git submodules are the **primary distribution mechanism** for Tract at scale. See `FEDERATION.md` for the full federation design.

### Dual-Mode Ticket Repos

Ticket repos are self-contained and work in two modes with zero changes:

**Standalone mode** (Tract server clones them directly):

```
tract-server/
├── tickets-tb/          # cloned standalone
├── tickets-app/         # cloned standalone
└── tract-web/            # the web server
```

**Submodule mode** (developer mounts them in code repos):

```bash
git submodule add git@github.com:acme/tickets-tb.git tickets
```

```
trading-platform/        # code repo
├── src/
├── tickets/             # git submodule → tickets-tb repo
└── ...
```

### Benefits of Submodule Mode

- **Separate access control** — engineers see code + tickets; customers see code only
- **Separate history** — ticket churn doesn't bloat the code repo
- **Fix version derivation** — LLM can validate fix versions against actual code branches (see §11)
- **Tickets pinned to releases** via submodule commit references

### Benefits of Standalone Mode

- **Simpler setup** — just clone and go
- **Server-friendly** — Tract server clones repos without needing code repos
- **Cross-project queries** — server sees all ticket repos in one place

### Excluding Tickets from Archives

For repos distributed to customers (e.g., via `git archive`), add to `.gitattributes`:

```gitattributes
tickets/ export-ignore
.tract/ export-ignore
```

This strips tickets and config from archives. Customers get code only.

---

## Appendix: Quick Reference

### File Locations

| What | Where |
|------|-------|
| Project config | `repo/.tract/config.yaml` |
| User defaults | `~/.config/tract/defaults.yaml` |
| Workspace config | `~/.config/tract/workspace.yaml` |
| Components | `repo/.tract/components.yaml` |
| Sprints | `repo/.tract/sprints/{id}.yaml` |
| Boards | `repo/.tract/boards/{name}.yaml` |
| Releases | `repo/.tract/releases/{version}.yaml` |
| Customers | `repo/.tract/customers/{key}.yaml` |
| Saved queries | `repo/.tract/queries/{name}.yaml` |
| Tickets | `repo/tickets/{ID}.md` or `repo/tickets/{PROJECT}/{ID}.md` |

### Frontmatter Quick Reference

```yaml
---
# Required
id: TB-042
title: Short description
status: in-progress
type: bug
created: 2026-02-09

# Common optional
assignee: john
priority: high
sprint: 2026-W07
epic: TB-010
fix_version: "6.8.0"
component: trading.fix-engine
labels: [production, sev1]
customer: acme-corp
links:
  - rel: blocks
    ref: TB-055

# Freeform
x-anything: any value
---
```
