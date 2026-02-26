# Sprint Federation

How sprints work across multiple projects and workspaces.

## Single Project

In a single project, sprints are stored in the project's `.tract/sprints/` directory:

```
my-project/
├── .tract/
│   ├── config.yaml
│   ├── sprints/
│   │   ├── 2026-W07.yaml
│   │   └── 2026-W08.yaml
│   └── worklogs/
└── issues/
    ├── PROJ-001.md
    └── PROJ-002.md
```

Tickets in this project reference sprints:

```yaml
# issues/PROJ-001.md
---
id: PROJ-001
title: Implement feature X
sprints: [2026-W08]
---
```

## Multi-Project Workspace

In a workspace with multiple projects, sprints are at the workspace root and shared:

```
~/work/company/              # Workspace root (git repo)
├── .tract/
│   ├── workspace.yaml       # Workspace config
│   ├── sprints/             # Shared sprints
│   │   ├── 2026-W07.yaml
│   │   └── 2026-W08.yaml
│   ├── worklogs/            # Shared worklogs
│   └── boards/              # Shared boards
├── frontend/                # Project 1
│   ├── .tract/
│   │   └── config.yaml
│   └── issues/
│       ├── FRONT-001.md
│       └── FRONT-002.md
├── backend/                 # Project 2
│   ├── .tract/
│   │   └── config.yaml
│   └── issues/
│       ├── BACK-001.md
│       └── BACK-002.md
└── platform/                # Project 3
    ├── .tract/
    │   └── config.yaml
    └── issues/
        ├── PLAT-001.md
        └── PLAT-002.md
```

### Workspace Configuration

The workspace root has `.tract/workspace.yaml`:

```yaml
# ~/work/company/.tract/workspace.yaml
workspace:
  name: company
  description: Frontend, backend, and platform projects

projects:
  - name: frontend
    prefix: FRONT
    path: ./frontend

  - name: backend
    prefix: BACK
    path: ./backend

  - name: platform
    prefix: PLAT
    path: ./platform

shared:
  sprints: .tract/sprints/
  worklogs: .tract/worklogs/
  boards: .tract/boards/
```

### Cross-Project Sprints

A single sprint can contain tickets from multiple projects:

```yaml
# .tract/sprints/2026-W08.yaml
name: Sprint 8
state: open
start: 2026-02-17
end: 2026-02-28
goal: OAuth integration across all services
```

Tickets from different projects reference the same sprint:

```yaml
# frontend/issues/FRONT-123.md
---
id: FRONT-123
title: Add OAuth login UI
sprints: [2026-W08]
---
```

```yaml
# backend/issues/BACK-456.md
---
id: BACK-456
title: Implement OAuth token endpoint
sprints: [2026-W08]
---
```

```yaml
# platform/issues/PLAT-789.md
---
id: PLAT-789
title: Deploy OAuth infrastructure
sprints: [2026-W08]
---
```

## Board Views

### Workspace Board

From workspace root, view all projects in sprint:

```bash
cd ~/work/company
tract board  # Auto-detects Sprint 8, shows all tickets from all projects
```

Output includes tickets from FRONT, BACK, and PLAT prefixes.

### Project-Specific Board

From a project subdirectory, view only that project's sprint tickets:

```bash
cd ~/work/company/frontend
tract board  # Shows only FRONT-* tickets in current sprint
```

## Git Integration

### Workspace as Git Repo

The workspace root is a git repository:

```bash
cd ~/work/company
git init
git add .tract/
git commit -m "Add workspace configuration"
```

Sprint changes are committed at workspace level:

```bash
# Close Sprint 7, start Sprint 8
vim .tract/sprints/2026-W07.yaml  # state: closed
cat > .tract/sprints/2026-W08.yaml << 'EOF'
name: Sprint 8
state: open
start: 2026-02-17
end: 2026-02-28
goal: OAuth integration
EOF

git add .tract/sprints/
git commit -m "Close Sprint 7, start Sprint 8"
git push
```

### Project Repos

Individual projects can be:

**Option A: Subdirectories in workspace repo**
```
company/         # Single git repo
├── frontend/
├── backend/
└── platform/
```

**Option B: Git submodules**
```
company/         # Workspace repo
├── frontend/    # git submodule → frontend repo
├── backend/     # git submodule → backend repo
└── platform/    # git submodule → platform repo
```

**Option C: Independent repos**

Each project is its own repo. Use workspace discovery to find them:

```yaml
# ~/.config/tract/workspace.yaml
repos:
  - path: ~/work/frontend
    prefix: FRONT
  - path: ~/work/backend
    prefix: BACK
  - path: ~/work/platform
    prefix: PLAT

shared:
  sprints: ~/work/shared/.tract/sprints/
```

## Sprint Discovery

When running `tract board` from a project subdirectory, Tract searches:

1. Current directory for `.tract/sprints/`
2. Parent directories for `.tract/sprints/` (like git does)
3. Workspace root (if configured) for `.tract/sprints/`

This enables sprints to work whether you're in:
- A single project
- A project within a workspace
- The workspace root

## Team Collaboration

### Shared Sprint Planning

Team members pull sprint changes:

```bash
cd ~/work/company
git pull
# Now has latest sprint files
```

### Concurrent Sprint Work

Multiple team members can work on different tickets in same sprint:

```bash
# Developer A
cd ~/work/company/frontend
vim issues/FRONT-123.md  # Add sprints: [2026-W08]
git add issues/FRONT-123.md
git commit -m "Add FRONT-123 to Sprint 8"
git push
```

```bash
# Developer B
cd ~/work/company/backend
vim issues/BACK-456.md  # Add sprints: [2026-W08]
git add issues/BACK-456.md
git commit -m "Add BACK-456 to Sprint 8"
git push
```

### Sprint Closure

Product owner closes sprint, team pulls changes:

```bash
# Product owner
vim .tract/sprints/2026-W08.yaml  # state: closed
git add .tract/sprints/
git commit -m "Close Sprint 8"
git push
```

```bash
# Team members
git pull
tract board  # Now shows backlog (no open sprint)
```

## Jira Integration

When syncing from Jira with multiple projects:

```bash
cd ~/work/company/frontend
tract import  # Imports FRONT-* tickets

cd ~/work/company/backend
tract import  # Imports BACK-* tickets
```

Sprint metadata is deduplicated:
- Same sprint from multiple Jira projects creates one sprint file
- Sprint files are written to workspace `.tract/sprints/`
- All tickets reference the shared sprint file

## Benefits of Federated Sprints

1. **Single source of truth:** One sprint definition across all projects
2. **Atomic sprint transitions:** Close sprint once, affects all projects
3. **Cross-project visibility:** See all sprint work in one board view
4. **Git history:** Full audit trail of sprint changes
5. **Team coordination:** Shared sprint state, no sync issues
