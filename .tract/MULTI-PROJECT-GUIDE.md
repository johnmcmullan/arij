# Multi-Project Setup Guide

How to manage multiple projects (with or without code) sharing worklogs and linking tickets.

## Scenario: Your Setup

You have:
1. **Frontend project** - React app, own repo
2. **Backend project** - API service, own repo  
3. **Platform project** - No code, coordination/documentation only

**Requirements:**
- Shared time tracking across all three
- Cross-project ticket links (FRONT-123 → BACK-456)
- Platform project for cross-cutting work

## Solution: Workspace Setup

### Directory Structure

```
~/work/company/                  # Workspace root
├── .tract/
│   ├── workspace.yaml           # Links all projects
│   └── worklogs/                # Shared time tracking
│       ├── 2026-01.jsonl
│       └── 2026-02.jsonl
├── frontend/
│   ├── .tract/
│   │   └── config.yaml          # FRONT project
│   ├── issues/
│   │   ├── FRONT-1.md
│   │   └── FRONT-2.md
│   ├── src/                     # React code
│   └── .git/
├── backend/
│   ├── .tract/
│   │   └── config.yaml          # BACK project
│   ├── issues/
│   │   ├── BACK-1.md
│   │   └── BACK-2.md
│   ├── src/                     # API code
│   └── .git/
└── platform/
    ├── .tract/
    │   └── config.yaml          # PLAT project
    ├── issues/
    │   ├── PLAT-1.md
    │   └── PLAT-2.md
    ├── docs/                    # No code, just docs
    └── .git/
```

### Step 1: Create Workspace Root

```bash
mkdir -p ~/work/company
cd ~/work/company
```

### Step 2: Onboard Each Project

**Frontend:**
```bash
cd ~/work/company
mkdir frontend && cd frontend
tract onboard --project FRONT --local
# Add your React code
git add .
git commit -m "Initial frontend project"
```

**Backend:**
```bash
cd ~/work/company
mkdir backend && cd backend
tract onboard --project BACK --local
# Add your API code
git add .
git commit -m "Initial backend project"
```

**Platform (no code):**
```bash
cd ~/work/company
mkdir platform && cd platform
tract onboard --project PLAT --local
# Create docs/ instead of src/
mkdir docs
echo "# Platform Documentation" > docs/README.md
git add .
git commit -m "Initial platform project"
```

### Step 3: Create Workspace Config

```bash
cd ~/work/company
mkdir -p .tract/worklogs
```

**Create `.tract/workspace.yaml`:**

```yaml
# Workspace: Company Projects
# Shared workspace for frontend, backend, and platform

workspace:
  name: company
  description: Frontend, backend, and platform projects

# Projects in this workspace
projects:
  - name: frontend
    prefix: FRONT
    path: ./frontend
    description: React web application
    
  - name: backend
    prefix: BACK
    path: ./backend
    description: API service
    
  - name: platform
    prefix: PLAT
    path: ./platform
    description: Cross-cutting platform work and documentation

# Shared worklogs for all projects
shared:
  worklogs: .tract/worklogs/
  
# Optional: shared components across projects
components:
  shared-ui:
    description: Shared UI component library
    paths:
      - frontend/src/components/shared/
    owner: frontend-team
    
  api-client:
    description: Shared API client
    paths:
      - frontend/src/api/
      - backend/docs/api/
    owner: platform-team
```

**Git init workspace:**
```bash
cd ~/work/company
git init
git add .tract/
git commit -m "Add workspace configuration"
```

## Shared Worklogs

### Log Time from Any Project

Time logs go to the **workspace root**, not individual projects:

**From frontend project:**
```bash
cd ~/work/company/frontend
tract log FRONT-123 2h "Fixed button styling"
# Writes to ~/work/company/.tract/worklogs/2026-02.jsonl
```

**From backend project:**
```bash
cd ~/work/company/backend
tract log BACK-456 3h "Implemented new API endpoint"
# Writes to ~/work/company/.tract/worklogs/2026-02.jsonl
```

**From platform project:**
```bash
cd ~/work/company/platform
tract log PLAT-789 1h "Updated deployment docs"
# Writes to ~/work/company/.tract/worklogs/2026-02.jsonl
```

### View Combined Timesheet

```bash
cd ~/work/company
tract timesheet
```

Shows time across **all projects**:
```
Timesheet for john.mcmullan - 2026-02-14

┌──────────┬──────────┬──────┬─────────────────────────────────┐
│ Issue    │ Started  │ Time │ Comment                         │
├──────────┼──────────┼──────┼─────────────────────────────────┤
│ FRONT-123│ 09:00    │ 2h   │ Fixed button styling            │
│ BACK-456 │ 11:30    │ 3h   │ Implemented new API endpoint    │
│ PLAT-789 │ 15:00    │ 1h   │ Updated deployment docs         │
└──────────┴──────────┴──────┴─────────────────────────────────┘

Total: 6h ⚠️ (target: 8h)
```

### Worklog File Format

`~/work/company/.tract/worklogs/2026-02.jsonl`:

```json
{"issue":"FRONT-123","author":"john.mcmullan","time":"2h","started":"2026-02-14T09:00:00Z","comment":"Fixed button styling"}
{"issue":"BACK-456","author":"john.mcmullan","time":"3h","started":"2026-02-14T11:30:00Z","comment":"Implemented new API endpoint"}
{"issue":"PLAT-789","author":"john.mcmullan","time":"1h","started":"2026-02-14T15:00:00Z","comment":"Updated deployment docs"}
```

Note: Issues from **different projects** in the **same file**.

## Cross-Project Ticket Links

### Link Tickets Across Projects

**Frontend ticket references backend:**

`frontend/issues/FRONT-123.md`:
```yaml
---
id: FRONT-123
title: Add user profile page
type: story
status: in-progress
links:
  - rel: depends_on
    ref: BACK-456
  - rel: related_to
    ref: PLAT-100
---

# Description

Add user profile page. Depends on BACK-456 (user API endpoint).

Related to PLAT-100 (design system).
```

**Backend ticket referenced by frontend:**

`backend/issues/BACK-456.md`:
```yaml
---
id: BACK-456
title: User profile API endpoint
type: story
status: done
links:
  - rel: blocks
    ref: FRONT-123
---

# Description

Implemented GET /api/user/:id endpoint.

This unblocks FRONT-123 (frontend can now fetch user data).
```

### Query Cross-Project Links

```bash
cd ~/work/company

# Find all tickets that depend on backend work
grep -r "ref: BACK-" */issues/*.md

# Find all frontend tickets blocked by backend
grep -A5 "depends_on" frontend/issues/*.md | grep "ref: BACK"
```

## Platform Project (No Code)

The platform project works exactly the same, just no `src/` directory:

```
platform/
├── .tract/
│   └── config.yaml
├── issues/
│   ├── PLAT-1.md   # "Document deployment process"
│   ├── PLAT-2.md   # "Set up CI/CD pipeline"
│   └── PLAT-3.md   # "Security audit Q1 2026"
├── docs/
│   ├── architecture/
│   ├── deployment/
│   └── security/
└── .git/
```

**Use cases for non-code projects:**
- Documentation work
- Cross-cutting initiatives
- Security audits
- Infrastructure/DevOps
- Process improvements
- Design system

**Example platform ticket:**

`platform/issues/PLAT-100.md`:
```yaml
---
id: PLAT-100
title: Design system color palette
type: story
status: done
component: design-system
links:
  - rel: blocks
    ref: FRONT-123
  - rel: blocks
    ref: FRONT-124
---

# Description

Define standard color palette for all UI components.

## Colors Defined

- Primary: #3B82F6
- Secondary: #10B981  
- Danger: #EF4444

## Blocks

- FRONT-123 (needs colors)
- FRONT-124 (needs colors)
```

## Workspace-Level Components

Define components that span projects:

`.tract/workspace.yaml`:
```yaml
components:
  authentication:
    description: End-to-end authentication flow
    paths:
      - frontend/src/auth/
      - backend/src/auth/
      - platform/docs/auth/
    owner: platform-team
    
  user-management:
    description: User CRUD and profile
    paths:
      - frontend/src/pages/users/
      - backend/src/controllers/users/
      - backend/src/models/user.js
    owner: backend-team
```

## Working with the Workspace

### Environment Variable

Tell Tract where your workspace root is:

```bash
export TRACT_WORKSPACE=~/work/company
echo 'export TRACT_WORKSPACE=~/work/company' >> ~/.bashrc
```

### From Any Project

```bash
# You're in frontend, want to see all tickets
cd ~/work/company/frontend
tract query --workspace   # Searches all projects

# View combined timesheet
tract timesheet --workspace

# Find ticket in any project
tract find PLAT-100
# → ~/work/company/platform/issues/PLAT-100.md
```

## LLM Workflow

**User:** "I worked on frontend and backend today, log my time"

**LLM (using tract-timetracking skill):**
```
What did you work on?
```

**User:** "2 hours on FRONT-123, 3 hours on BACK-456"

**LLM:**
```bash
cd ~/work/company
tract log FRONT-123 2h "Frontend work"
tract log BACK-456 3h "Backend work"
```

**LLM shows:**
```
✅ Logged time:
- FRONT-123: 2h (frontend project)
- BACK-456: 3h (backend project)

Total today: 5h across 2 projects
```

## Benefits

1. **Single timesheet** - See all your work in one view
2. **Cross-project visibility** - Link frontend/backend work explicitly
3. **No-code projects work** - Platform/docs projects are first-class
4. **Git-native** - Each project has its own repo, workspace ties them together
5. **LLM-friendly** - Single workspace.yaml file tells LLM about all projects

## Migration Path

**Already have projects?** Add them to a workspace:

```bash
# Move existing projects under workspace root
mkdir ~/work/company
mv ~/work/frontend ~/work/company/
mv ~/work/backend ~/work/company/

# Create workspace config
cd ~/work/company
mkdir -p .tract/worklogs
cat > .tract/workspace.yaml << 'EOF'
workspace:
  name: company
projects:
  - name: frontend
    prefix: FRONT
    path: ./frontend
  - name: backend
    prefix: BACK
    path: ./backend
shared:
  worklogs: .tract/worklogs/
EOF

git init
git add .tract/
git commit -m "Create workspace"
```

## Advanced: Workspace Sync

If you want to sync the workspace itself:

```bash
cd ~/work/company
git remote add origin git@github.com:company/workspace.git
git push -u origin master
```

**Sub-projects remain independent:**
- `frontend/.git` - frontend repo
- `backend/.git` - backend repo
- `platform/.git` - platform repo
- `.git` - workspace repo (just config + shared worklogs)

**Not git submodules** - just regular directories. Simpler.

---

**Summary:** Workspace = multiple projects + shared worklogs + cross-project links. Works with or without code. Git-native, LLM-friendly.
