---
name: tract-teams
description: >
  View and query Tempo Teams synced from Jira. Use when listing teams, checking team membership,
  filtering by R&D flag or jurisdiction, or preparing R&D TAX reports. Teams are synced daily
  by tract-sync-daemon into the worklogs repo.
---

# Tract Teams Skill

## Purpose

Tempo Teams are synced from Jira into `worklogs/teams/` as YAML files. Each file records:
- Team name, ID, lead, and hierarchy
- Whether the team is R&D (for TAX purposes)
- Jurisdiction (`eu`, `us`, `uk`, `apac`, `in`, or `null`)
- Members with usernames, roles, availability %, and membership date ranges

## When to Use This Skill

**Activate when:**
- User asks "who is in team X?"
- User wants to see R&D teams for a jurisdiction
- User is building a TAX report and needs team membership
- User asks "is team X R&D?"
- User wants to override a team's jurisdiction or R&D flag
- User asks about team hierarchy

## Core Commands

### List teams

```bash
tract teams list                          # all teams, grouped by hierarchy
tract teams list --rd                     # R&D teams only
tract teams list --jurisdiction eu        # by jurisdiction
tract teams list --rd --jurisdiction uk   # combine filters
```

Output format (grouped by hierarchy root):

```
Engineering (12 teams)
  Engineering (Global)       [eu]  R&D
  Engineering PT             [eu]  R&D
    Engineering PT - Principal Trading  [eu]  R&D
  Engineering Americas       [us]  R&D
  ...
```

### Show a team

```bash
tract teams show "Engineering PT - Principal Trading"
tract teams show 33          # by numeric Tempo team ID
tract teams show "PT"        # fuzzy name match
```

Output:

```
Engineering PT - Principal Trading  (id: 33)
  Lead:         jmcmullan
  Hierarchy:    Engineering > Engineering PT > Engineering PT - Principal Trading
  Jurisdiction: eu
  R&D:          yes

Active members (4):
  jdoe         John Doe              Member    100%  2020-01-01 →
  asmith       Alice Smith           Lead      100%  2021-06-15 →
  ...

Former members (1):
  bjones       Bob Jones             Member    50%   2019-03-01 → 2023-12-31
```

## Setup

Teams are read from `TRACT_WORKLOGS_DIR/teams/` (or `~/work/worklogs/teams/` as fallback):

```bash
# Clone worklogs (if not already done)
tract clone worklogs --server <host>

export TRACT_WORKLOGS_DIR=~/work/worklogs
```

## Team YAML Format

```yaml
id: 33
name: "Engineering PT - Principal Trading"
slug: engineering-pt-principal-trading
lead: jmcmullan
hierarchy:
  - Engineering PT
  - Engineering PT - Principal Trading
jurisdiction: eu          # null = unknown/multi-region
is_rd: true
members:
  - username: jdoe
    display_name: "John Doe"
    role: Member
    date_from: "2020-01-01"
    date_to: ""            # empty = current member
    availability: 100
    active: true
```

## Overriding Jurisdiction or R&D Flag

Edit `worklogs/teams/config.yaml` (committed to git, survives re-syncs):

```yaml
overrides:
  - id: 99         # InfoSec
    is_rd: false
  - id: 42
    is_rd: false
    jurisdiction: us
```

Alternatively, edit the YAML file directly — `hierarchy`, `jurisdiction`, and `is_rd` are
preserved across syncs once written. `name`, `lead`, and `members` are always refreshed from
Jira.

## Hierarchy

Team hierarchy is name-encoded: `Engineering PT - Principal Trading` implies:

```
Engineering (root, inferred)
  └─ Engineering PT
       └─ Engineering PT - Principal Trading
```

The daemon splits on ` - ` to build the hierarchy array. Roots that don't appear in any
team name are not added automatically.

## R&D TAX Reporting Workflow

1. **Identify teams in scope** (R&D + jurisdiction):

```bash
tract teams list --rd --jurisdiction uk
```

2. **Get member usernames for a team**:

```bash
tract teams show "Engineering PT" | grep -A20 "Active members"
```

3. **Pull worklogs for each member** over the tax period:

```bash
tract timesheet <username> --month 2026-02 --format csv
```

4. **Cross-reference**: A worklog entry counts as R&D if:
   - Author is a member of a team with `is_rd: true`
   - Membership was active during the worklog date (`date_from ≤ date ≤ date_to`)
   - Team jurisdiction matches the reporting jurisdiction

## Sync Behaviour

- Teams sync on daemon startup + every 24 hours (`TEAM_SYNC_INTERVAL_HOURS`)
- To force a refresh: `sudo systemctl restart tract-sync`
- Source: Jira Tempo Teams API (`/rest/tempo-teams/2/team`)

## Troubleshooting

**`tract teams list` returns nothing:**
```bash
ls $TRACT_WORKLOGS_DIR/teams/
# If empty, daemon hasn't run team sync yet — check journalctl -u tract-sync
```

**Team YAML missing `jurisdiction` or `is_rd`:**
The file may have been created before the fields were computed. Delete and re-sync:
```bash
rm /opt/tract/worklogs/teams/<id>-<slug>.yaml
sudo systemctl restart tract-sync
```

**Need to bulk-override multiple teams:**
Edit `worklogs/teams/config.yaml` and commit. Changes take effect on next read (no sync needed).
