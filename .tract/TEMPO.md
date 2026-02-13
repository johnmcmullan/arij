# Tract Tempo — Automated Timekeeping

> Time tracking for engineers should be mostly automated. The system derives time from git activity, calendar events, and IDE/CLI telemetry — and supports manual logging for everything else.

**Version:** 1.0.0
**Date:** 2026-02-10

This document is the complete reference for operating Arij's timekeeping system. An LLM reading this document should be able to log time, generate timesheets, produce reports, and reconcile entries using only filesystem operations and git.

---

## Table of Contents

1. [Storage Format](#1-storage-format)
2. [Automated Sources](#2-automated-sources)
3. [Manual Logging](#3-manual-logging)
4. [Reconciliation](#4-reconciliation)
5. [Integration with Tickets](#5-integration-with-tickets)
6. [Reports](#6-reports)
7. [Configuration](#7-configuration)

---

## 1. Storage Format

Time entries are stored as daily YAML files per user:

```
.tract/
└── time/
    ├── john/
    │   ├── 2026-02-09.yaml
    │   ├── 2026-02-10.yaml
    │   └── ...
    └── sarah/
        ├── 2026-02-10.yaml
        └── ...
```

### Daily File Format

```yaml
# .tract/time/john/2026-02-10.yaml
date: 2026-02-10
user: john
status: draft          # draft | reviewed | submitted
entries:
  - ticket: TB-042
    duration: 2h30m
    source: git
    description: "Fix TCP_NODELAY on auction socket"
    commits:
      - abc1234
      - def5678

  - ticket: TB-042
    duration: 45m
    source: calendar
    description: "FIX session debugging sync"

  - ticket: TINT-191
    duration: 2h
    source: manual
    description: "HR training session"

  - ticket: APP-019
    duration: 1h15m
    source: ide
    description: "OAuth token refresh refactor"

  - ticket: null
    duration: 30m
    source: calendar
    description: "All-hands standup"
    unallocated: true
```

### Entry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ticket` | string\|null | yes | Ticket ID (e.g. `TB-042`) or `null` for unallocated time |
| `duration` | string | yes | Duration in `Xh`, `Xm`, `XhYm` format (e.g. `2h30m`, `45m`, `3h`) |
| `source` | string | yes | One of: `git`, `calendar`, `manual`, `ide` |
| `description` | string | no | What was done. Auto-populated from commit messages or calendar titles |
| `commits` | list[string] | no | Git commit SHAs (for `source: git` entries) |
| `unallocated` | bool | no | `true` if this entry needs a ticket assigned during reconciliation |

### Duration Format

Durations use human-readable strings:

- `30m` — 30 minutes
- `2h` — 2 hours
- `1h30m` — 1 hour 30 minutes
- `1d` — 1 day (mapped to `working_hours_per_day` from config, default 8h)

Durations are always stored at minute granularity. When deriving from git, round to the nearest 15 minutes.

### File Status

| Status | Meaning |
|--------|---------|
| `draft` | Auto-generated or partially filled, not yet reviewed |
| `reviewed` | Developer has confirmed the entries are correct |
| `submitted` | Final — included in reports. Should not be edited without a correction entry |

---

## 2. Automated Sources

### 2.1 Git Commits

The primary automated source. Commit messages already reference ticket IDs (see SCHEMA.md §17).

**Derivation algorithm:**

1. For a given user and date, find all commits authored by that user on that date:
   ```bash
   git log --author="john" --after="2026-02-10T00:00:00" --before="2026-02-11T00:00:00" \
     --format="%H %aI %s"
   ```
2. Extract ticket IDs from each commit message (pattern: `PREFIX-NUMBER`)
3. Group consecutive commits to the same ticket
4. Estimate duration using gaps between commits:
   - Time between first commit to a ticket and the next commit to a *different* ticket = working time
   - Gaps longer than `max_gap` (default: 2h) are capped at `default_session` (default: 30m)
   - The first commit of the day: assume work started `default_session` before the commit
5. Round to nearest 15 minutes
6. Record with `source: git` and list the commit SHAs

**Example derivation:**

```
09:15  TB-042: fix socket config          → TB-042 starts
09:45  TB-042: add test                    → TB-042 continues
10:30  APP-019: update OAuth flow          → TB-042 ends (1h15m rounded → 1h15m), APP-019 starts
12:00  (no commit until 14:00)             → APP-019 ends (1h30m), gap capped
14:00  TB-042: fix regression              → TB-042 starts again
15:30  TB-042: update docs                 → TB-042 continues
16:00  (end of day)                        → TB-042 ends (2h)
```

Result: TB-042 = 3h15m, APP-019 = 1h30m

**Multi-repo support:** Run the algorithm across all repos in the workspace (see SCHEMA.md §7). Commits in different repos to the same ticket merge naturally.

**Branch context:** If commit message lacks a ticket ID, fall back to the branch name. Branch naming convention `fix/TB-042-description` or `feature/APP-019-oauth` provides the ticket ID.

### 2.2 Calendar Integration

Calendar events with ticket IDs in the title are logged automatically.

**Matching rules:**

1. Scan calendar events for the date
2. If the title contains a ticket ID pattern (`PREFIX-NUMBER`), log as `source: calendar` against that ticket
3. If no ticket ID found, log with `ticket: null` and `unallocated: true`
4. Duration = event duration from the calendar

**Examples:**

| Calendar Title | Logged As |
|---------------|-----------|
| `TB-042 FIX debugging sync` | `ticket: TB-042, source: calendar` |
| `Sprint planning` | `ticket: null, unallocated: true` |
| `APP-019 OAuth design review` | `ticket: APP-019, source: calendar` |
| `1:1 with manager` | `ticket: null, unallocated: true` |

**Convention:** Teams should put ticket IDs at the start of meeting titles. This costs nothing and makes automation work.

### 2.3 IDE/CLI Telemetry

Coding agents and IDE extensions can report active ticket context.

**Protocol:** Any tool can append to a telemetry log file:

```
# .tract/time/.telemetry/{user}-{date}.jsonl
{"ts":"2026-02-10T09:00:00Z","ticket":"TB-042","tool":"copilot-cli","event":"start"}
{"ts":"2026-02-10T10:30:00Z","ticket":"TB-042","tool":"copilot-cli","event":"stop"}
{"ts":"2026-02-10T10:30:00Z","ticket":"APP-019","tool":"cursor","event":"start"}
{"ts":"2026-02-10T12:00:00Z","ticket":"APP-019","tool":"cursor","event":"stop"}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `ts` | ISO datetime | Timestamp of the event |
| `ticket` | string | Active ticket ID |
| `tool` | string | Tool name (freeform) |
| `event` | string | `start` or `stop` |

**Processing:** During daily file generation, telemetry spans are converted to time entries with `source: ide`. Overlapping spans with git are deduplicated — git takes priority since it's more precise.

**Activation:** A developer tells their tool: *"I'm working on TINT-191"* and the tool writes a `start` event. When they switch context, the tool writes `stop` + new `start`.

---

## 3. Manual Logging

For work with no automated signal — admin, HR, impediments, research.

### LLM Interface

The developer tells the LLM:

- *"Log 2h on TINT-191 for HR training"*
- *"I spent 45 minutes on TINT-206 — VPN was down, couldn't work"*
- *"Add 3h to APP-45678 for sprint planning and retro"*

The LLM appends an entry to the daily file:

```yaml
  - ticket: TINT-191
    duration: 2h
    source: manual
    description: "HR training session"
```

### Rules

- Manual entries are always `source: manual`
- A description is required for manual entries (the LLM should prompt if missing)
- Manual entries can be added for any date, not just today
- If the daily file doesn't exist, create it with the appropriate header

---

## 4. Reconciliation

Automation captures ~80% of time. Reconciliation catches the rest.

### Daily Reconciliation

End of day, the LLM presents the auto-generated timesheet:

```
Here's what I tracked for you today (2026-02-10):

  TB-042    3h15m   git     Fix TCP_NODELAY, add tests, fix regression
  APP-019   1h30m   git     OAuth token refresh
  TB-042      45m   cal     FIX session debugging sync
  ???         30m   cal     All-hands standup (needs ticket)
  TINT-191    2h    manual  HR training

  Total: 8h00m  ✓

  ⚠ 1 unallocated entry needs a ticket
  Anything missing or wrong?
```

The developer can:

1. **Confirm** — status changes to `reviewed`
2. **Adjust** — *"The standup should go on APP-45678"* or *"I also spent an hour reading the FIX spec, put it on TB-042"*
3. **Defer** — leave as `draft` for later

### Weekly Reconciliation

Same flow but aggregated across the week. Useful for catching missed days.

```
Weekly summary (2026-W07):

  Mon   8h00m  ✓ reviewed
  Tue   7h30m  ✓ reviewed
  Wed   8h15m  ✓ reviewed
  Thu   6h45m  ⚠ draft — 1h15m untracked
  Fri   4h00m  ⚠ draft — needs review

  Total: 34h30m (target: 40h)
  Gap: 5h30m unaccounted
```

### Status Transitions

```
draft → reviewed    (developer confirms)
reviewed → submitted    (end of week, ready for reports)
submitted → submitted   (corrections append, don't overwrite)
```

Corrections to submitted timesheets append a new entry with negative duration if needed:

```yaml
  - ticket: TB-042
    duration: -1h
    source: manual
    description: "Correction: over-reported on Tuesday"
```

---

## 5. Integration with Tickets

### Derived Fields

The `logged` and `remaining` fields on tickets (see SCHEMA.md §3) are **derived from time entries**:

```
logged    = sum of all time entries across all users where ticket == this ticket ID
remaining = estimate - logged (floor at 0)
```

These values are **not stored in frontmatter** — they are computed at query time by scanning `.tract/time/*/` files. This follows the same principle as the `modified` derived field (SCHEMA.md §3): the source of truth is the time entry files, not a duplicated field.

**However**, for performance, an LLM or automation tool **may** update the frontmatter `logged` and `remaining` values as a cache. If present in frontmatter, they are hints — the time entry files are authoritative.

### Cross-Project Time

Time entries reference ticket IDs directly. A developer working in one repo can log time against a ticket in another project. The workspace config (SCHEMA.md §7) provides the mapping.

### Querying Time per Ticket

```bash
# Find all time logged against TB-042
grep -r "ticket: TB-042" .tract/time/
```

Or: scan all daily files, parse YAML, sum durations where `ticket == TB-042`.

---

## 6. Reports

All reports are generated on demand by scanning time entry files. No pre-computation needed.

### 6.1 Weekly Timesheet

Per-person, per-week. The primary output for time approval.

```yaml
# Generated report (not stored — rendered on demand)
user: john
week: 2026-W07
total: 38h30m
by_day:
  2026-02-10: 8h00m
  2026-02-11: 7h30m
  2026-02-12: 8h15m
  2026-02-13: 6h45m
  2026-02-14: 8h00m
by_ticket:
  TB-042: 14h30m
  APP-019: 8h00m
  TINT-191: 4h00m
  APP-45678: 6h00m
  TINT-206: 2h00m
  unallocated: 4h00m
status: 3 reviewed, 2 draft
```

### 6.2 Monthly R&D Report

**This is the critical report.** Countries like the UK offer R&D tax credits (RDEC/SME schemes) for qualifying research and development. Programming new features counts. Maintenance and admin generally don't.

**Classification rules:**

| Ticket Type | R&D Category | Qualifies? |
|-------------|-------------|------------|
| `story` | New development | ✅ Yes |
| `epic` | New development | ✅ Yes |
| `bug` (new feature area) | New development | ✅ Yes |
| `bug` (existing system) | Maintenance | ❌ No |
| `task` (technical) | Depends on context | ⚠️ Review |
| `task` (admin/process) | Admin | ❌ No |
| `investigation` | Research | ✅ Yes |
| `support-case` | Support | ❌ No |

**Override:** Tickets can carry an `x-rd-category` freeform field to explicitly classify:

```yaml
x-rd-category: research      # Qualifies
x-rd-category: maintenance   # Does not qualify
x-rd-category: admin         # Does not qualify
```

If present, `x-rd-category` overrides the type-based classification.

**Report format:**

```yaml
# .tract/reports/rd/2026-02.yaml (can be generated and stored, or rendered on demand)
month: 2026-02
generated: 2026-03-01
total_hours: 680.5
by_category:
  research_and_development:
    hours: 412.0
    percentage: 60.5
    projects:
      TB:
        hours: 280.0
        tickets:
          - id: TB-042
            type: bug
            title: "FIX session drops during auction"
            hours: 32.5
            x-rd-category: research
          # ...
      APP:
        hours: 132.0
        tickets: [...]
  maintenance:
    hours: 168.5
    percentage: 24.8
    projects: [...]
  admin:
    hours: 100.0
    percentage: 14.7
    projects: [...]
summary: |
  60.5% of engineering time qualifies as R&D under HMRC guidelines.
  Key R&D activities: FIX protocol session management (TB), OAuth integration (APP).
```

**The report format is configurable** via `.tract/config.yaml` (see §7). The default targets UK HMRC R&D tax credit requirements. Finance teams can define custom categories and output formats.

### 6.3 Sprint Report

Time per ticket vs estimate for retrospectives:

```yaml
sprint: 2026-W07
tickets:
  - id: TB-042
    estimate: 3d
    logged: 3h15m
    remaining: 2d
    status: in-progress
  - id: APP-019
    estimate: 2d
    logged: 1h30m
    remaining: 1d6h
    status: in-progress
totals:
  estimated: 40h
  logged: 34h30m
  accuracy: 86%
```

### 6.4 Utilisation Report

Breaks down time into productive categories:

```yaml
user: john
period: 2026-02
total: 160h
breakdown:
  billable:
    hours: 120h
    percentage: 75
  non_billable:
    hours: 24h
    percentage: 15
  impediment:
    hours: 8h
    percentage: 5
  admin:
    hours: 8h
    percentage: 5
```

**Classification:** Utilisation categories are derived from ticket labels or type:

- **Billable:** tickets with label `billable` or linked to a customer
- **Impediment:** tickets with label `impediment` or type containing `impediment`
- **Admin:** tickets with label `admin` or type `task` with component matching `admin.*`
- **Non-billable:** everything else that isn't billable

These rules are configurable (see §7).

---

## 7. Configuration

### Time Config in `.tract/config.yaml`

Add a `tempo` section to the project config:

```yaml
# .tract/config.yaml
prefix: TB
types: [bug, story, task, epic]
statuses: [backlog, todo, in-progress, review, done]

tempo:
  working_hours_per_day: 8
  rounding: 15m                    # Round git-derived time to nearest X
  max_gap: 2h                     # Max gap between commits before capping
  default_session: 30m            # Assumed work time before first commit
  
  # R&D classification overrides
  rd_categories:
    research: [story, epic, investigation]
    maintenance: [bug]
    admin: [task]
    # Tickets with x-rd-category override these defaults
  
  # Utilisation classification
  utilisation:
    billable_labels: [billable, client-work]
    impediment_labels: [impediment, blocked-external]
    admin_labels: [admin, ceremony, process]
  
  # Calendar source (implementation-specific)
  calendar:
    enabled: true
    # Calendar integration details are environment-specific
    # The LLM or tooling reads this flag and uses available calendar APIs
  
  # IDE telemetry
  telemetry:
    enabled: true
```

### User-Level Overrides

In `~/.config/arij/defaults.yaml`:

```yaml
tempo:
  working_hours_per_day: 7.5      # Part-time or different contract
  calendar:
    enabled: false                 # No calendar access on this machine
```

Merge behaviour follows SCHEMA.md §6 — repo config overrides user defaults.

---

## Appendix: Quick Reference

### File Locations

| What | Where |
|------|-------|
| Daily time entries | `.tract/time/{user}/{YYYY-MM-DD}.yaml` |
| IDE telemetry log | `.tract/time/.telemetry/{user}-{YYYY-MM-DD}.jsonl` |
| Generated reports | `.tract/reports/{type}/{period}.yaml` (optional — can render on demand) |
| Config | `.tract/config.yaml` → `tempo:` section |

### LLM Commands (Natural Language)

| User Says | Action |
|-----------|--------|
| *"Log 2h on TINT-191 for HR training"* | Append manual entry to today's daily file |
| *"What did I work on today?"* | Generate and show today's timesheet |
| *"Show my week"* | Generate weekly timesheet |
| *"Submit my timesheet"* | Set all `reviewed` days this week to `submitted` |
| *"Generate R&D report for January"* | Scan all entries, classify, produce report |
| *"How much time on TB-042?"* | Sum all entries across all users for TB-042 |
| *"I was in meetings all morning, no ticket"* | Create unallocated entries, flag for reconciliation |

### Duration Arithmetic

For summing and computing durations:

- Convert everything to minutes internally
- `1d` = `working_hours_per_day` × 60 minutes
- `1h` = 60 minutes
- Display as `XhYm` (e.g. `2h30m`), or `Xd` when ≥ 1 day
