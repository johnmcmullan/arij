# Directory Structure Reference

Complete reference for all Tract project layouts.

## Overview

Tract supports multiple directory layouts depending on your needs:

1. **Standalone ticket repo** - Tickets only, self-contained
2. **Code + tickets in one repo** - Tickets alongside source code
3. **Submodule mode** - Tickets as a git submodule in code repo
4. **Multi-project repo** - Multiple projects in one repository

## 1. Standalone Ticket Repo (Most Common)

Self-contained ticket repository. Common for Tract servers and teams using Jira sync.

```
app-tickets/                     # Standalone ticket repository
├── .tract/
│   ├── config.yaml              # Project configuration
│   ├── SCHEMA.md                # Complete specification
│   ├── sprints/
│   │   ├── 2026-W07.yaml
│   │   └── 2026-W08.yaml
│   ├── boards/
│   │   ├── engineering.yaml
│   │   └── support.yaml
│   ├── releases/
│   │   └── 2.5.0.yaml
│   ├── customers/
│   │   └── acme-corp.yaml
│   └── queries/
│       └── blocked-tickets.yaml
├── issues/
│   ├── APP-1234.md
│   ├── APP-1235.md
│   └── ...
├── worklogs/
│   ├── 2026-01.jsonl
│   └── 2026-02.jsonl
└── .git/                         # Git repository
```

**When to use:**
- Jira sync with Tract server
- Shared ticket repository for team
- Want tickets separate from code

**Setup:**
```bash
git clone https://github.com/company/app-tickets.git
cd app-tickets
tract doctor
```

## 2. Code + Tickets in One Repo

Tickets live alongside source code in a single repository.

```
myapp/                            # Combined code + tickets repo
├── .tract/
│   ├── config.yaml
│   ├── SCHEMA.md
│   ├── sprints/
│   └── boards/
├── src/                          # Source code
│   ├── main.py
│   └── ...
├── tests/
├── docs/
├── issues/                       # Tickets
│   ├── APP-1234.md
│   ├── APP-1235.md
│   └── ...
├── worklogs/
│   ├── 2026-01.jsonl
│   └── 2026-02.jsonl
├── README.md
└── .git/
```

**When to use:**
- Small projects or personal projects
- Want everything in one place
- No Jira sync (local-only)

**Setup:**
```bash
cd myapp
tract onboard --project APP --local
```

## 3. Submodule Mode

Tickets as a git submodule inside a code repository.

```
trading-platform/                 # Code repository
├── src/
├── tests/
├── docs/
├── tickets/                      # Git submodule → app-tickets repo
│   ├── .tract/
│   │   ├── config.yaml
│   │   ├── SCHEMA.md
│   │   └── ...
│   ├── issues/
│   │   ├── APP-1234.md
│   │   └── APP-1235.md
│   ├── worklogs/
│   └── .git/
├── .tract/                       # Optional parent config
│   └── config.yaml              # Can reference submodule
├── .gitmodules                   # Submodule configuration
├── .gitattributes                # Export-ignore rules
└── .git/
```

**When to use:**
- Code and tickets logically separate but want them together
- Want tickets excluded from client exports (`git archive`)
- LLM manages both code and tickets
- Tract server syncs ticket submodule with Jira

**Setup:**
```bash
cd trading-platform
tract onboard \
  --project APP \
  --jira https://jira.company.com \
  --user john \
  --token $JIRA_TOKEN \
  --submodule tickets \
  --remote git@github.com:company/app-tickets.git
```

**Working with submodules:**
```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/company/trading-platform.git

# Update submodule
cd tickets
git pull origin master
cd ..
git add tickets
git commit -m "Update tickets submodule"

# Export without tickets
git archive --format=tar HEAD | tar -t | grep -v '^tickets/'
```

## 4. Multi-Project Repository

Multiple projects in one repository (uncommon, but supported).

```
company-tickets/
├── .tract/
│   ├── config.yaml               # Multi-project config
│   ├── sprints/
│   └── boards/
├── issues/
│   ├── APP/
│   │   ├── APP-1234.md
│   │   └── APP-1235.md
│   └── TB/
│       ├── TB-001.md
│       └── TB-002.md
├── worklogs/
│   ├── 2026-01.jsonl
│   └── 2026-02.jsonl
└── .git/
```

**Multi-project config.yaml:**
```yaml
projects:
  APP:
    types: [bug, story, task, epic]
    statuses: [backlog, todo, in-progress, review, done]
    priorities: [low, medium, high, critical]
  TB:
    types: [bug, story, task, epic, incident]
    statuses: [backlog, todo, in-progress, testing, done]
    priorities: [trivial, minor, major, critical, blocker]
```

**When to use:**
- Company-wide ticket repository
- Related projects sharing infrastructure
- Centralized ticket management

## Key Directory Rules

### .tract/ Directory

**Must contain:**
- `config.yaml` - Project configuration (required)

**Optional:**
- `SCHEMA.md` - Generated during onboarding
- `sprints/` - Sprint definitions (YAML files)
- `boards/` - Board view definitions
- `releases/` - Release/version definitions
- `customers/` - Customer metadata
- `queries/` - Saved queries

### issues/ Directory

**Rules:**
- Flat structure (no subdirectories) for single-project repos
- Subdirectories by project key for multi-project repos
- One file per ticket: `{ID}.md`
- Filename must match ticket ID
- Markdown format with YAML frontmatter

### worklogs/ Directory

**Rules:**
- One JSONL file per month: `YYYY-MM.jsonl`
- Each line is a JSON object:
  ```json
  {"issue":"APP-1234","author":"john","time":"2h","started":"2026-02-14T13:00:00Z","comment":"Fixed bug"}
  ```
- Auto-created by `tract log` command

### Optional Directories

```
.tract/queue/         # Offline sync queue (auto-created)
.tract/cache/         # Metadata cache (auto-created)
.tract/workflows/     # Custom workflow definitions
```

## Git Structure

### .gitignore

Recommended:
```
.tract/cache/
.tract/queue/
.tract/*.lock
```

### .gitattributes (Submodule Mode)

Exclude ticket submodule from exports:
```
tickets/ export-ignore
.gitmodules export-ignore
```

This ensures `git archive` excludes tickets when shipping code to clients.

## Configuration Inheritance

### Standalone Repo
```
.tract/config.yaml          # Only config
```

### Code + Tickets Repo
```
.tract/config.yaml          # Single config
```

### Submodule Mode
```
parent-repo/
├── .tract/config.yaml      # Optional parent config
└── tickets/
    └── .tract/config.yaml  # Required submodule config (self-contained)
```

**Inheritance:**
1. Submodule config is **self-contained** - must work standalone
2. Parent config can **reference** submodule but doesn't override it
3. When working in parent repo, `.tract/config.yaml` can point to `tickets/.tract/config.yaml`

## File Locations Summary

| File Type | Single Project | Multi-Project | Submodule |
|-----------|---------------|---------------|-----------|
| Config | `.tract/config.yaml` | `.tract/config.yaml` | `tickets/.tract/config.yaml` |
| Tickets | `issues/APP-*.md` | `issues/APP/APP-*.md` | `tickets/issues/APP-*.md` |
| Worklogs | `worklogs/2026-02.jsonl` | `worklogs/2026-02.jsonl` | `tickets/worklogs/2026-02.jsonl` |
| Sprints | `.tract/sprints/` | `.tract/sprints/` | `tickets/.tract/sprints/` |

## Best Practices

1. **Self-contained submodules:** Ticket repos in submodules must carry full `.tract/` config
2. **Flat issues/ directory:** Avoid nested folders (except multi-project)
3. **One file per ticket:** Never split a ticket across multiple files
4. **Consistent naming:** `{ID}.md` - no prefixes, suffixes, or variations
5. **Git everything:** All tickets and config committed to git
6. **Export-ignore for submodules:** Protect client deliveries

## Migration Paths

### From Local-Only to Jira Sync
1. Edit `.tract/config.yaml` to add Jira URL
2. Set `TRACT_SYNC_SERVER` env var
3. Run `tract import` to pull existing Jira tickets

### From Code+Tickets to Submodule
1. Extract `issues/` and `.tract/` to new repo
2. Push ticket repo to remote
3. Add as submodule: `git submodule add <url> tickets`
4. Update parent `.tract/config.yaml` to reference `tickets/.tract/config.yaml`

### From Multi-Project to Separate Repos
1. Split `issues/PROJECT/` into separate repos
2. Copy `.tract/` to each (customize config per project)
3. Set up separate Jira sync servers if needed
