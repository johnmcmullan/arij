# Tract Architecture

## Overview

Tract is a **bidirectional sync layer** between Git (markdown files) and Jira. It lets developers work with tickets as files while managers continue using Jira normally.

## High-Level Flow

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────┐
│   Developers    │         │   Tract Sync     │         │   Jira   │
│  (Local Repo)   │ ◄─────► │     Service      │ ◄─────► │  (Web)   │
│                 │   Git   │ (Node.js/Express)│   API   │          │
│  issues/*.md    │  Push   │  /opt/tract/     │         │ Managers │
│  worklogs/*.json│  Pull   │   git/*.git      │         │ continue │
└─────────────────┘         └──────────────────┘         └──────────┘
```

## Components

### 1. Ticket Repository (Git)

**Location (developer):** `~/code/app-tickets/` (local clone)  
**Location (server):** `/opt/tract/git/app-tickets.git` (bare repo)

**Structure:**
```
app-tickets/
├── .tract/
│   ├── config.yaml           # Project settings (from Jira)
│   ├── components.yaml       # Component → directory mappings
│   ├── SCHEMA.md             # Complete API documentation (for LLMs)
│   ├── TEMPO.md              # Time tracking spec
│   └── FEDERATION.md         # Multi-repo architecture
├── issues/
│   ├── APP-1234.md           # One file per ticket
│   ├── APP-1235.md
│   └── ...
├── worklogs/
│   ├── 2026-02.jsonl         # Time entries by month
│   └── 2026-03.jsonl
└── .gitignore
```

**Ticket format** (`issues/APP-1234.md`):
```markdown
---
title: Fix login timeout
type: Bug
status: In Progress
priority: High
assignee: john.doe
created: 2026-02-10T14:30:00Z
updated: 2026-02-13T09:15:00Z
components: [Auth, Frontend]
labels: [security, urgent]
---

Users are getting logged out after 5 minutes of inactivity. Should be 30 minutes.

## Comments

**john.doe** - 2026-02-13 09:15:00

Increased session TTL from 300s to 1800s in auth middleware.
```

### 2. Tract Sync Service

**Location:** Server-side (e.g., `tract-server`)  
**Path:** `/opt/tract/tract-sync/`  
**Service:** `systemd` service `tract-sync@<project>.service`  
**Port:** 3100 (APP), 3101 (TB), 3102 (PRD), etc.

**Responsibilities:**
- Listen for Jira webhooks (Jira → Git sync)
- Listen for git post-receive hooks (Git → Jira sync)
- Provide API for CLI commands (create, log, timesheet)
- Maintain bare git repository
- Auto-commit changes with `[tract-sync]` marker

**Endpoints:**
- `GET /health` - Service status
- `POST /webhook/jira` - Jira webhook receiver
- `POST /webhook/git` - Git post-receive hook receiver
- `POST /create/:project` - Create ticket
- `POST /worklog/:issue` - Log time
- `GET /timesheet/:author` - Get timesheet
- `GET /worklogs/:issue` - Get issue worklogs
- `POST /update` - Self-update trigger

### 3. Tract CLI

**Installation:** `npm install -g @tract/cli`  
**Commands:** `tract doctor`, `tract create`, `tract log`, `tract timesheet`, etc.

**Responsibilities:**
- Bootstrap new Tract repos from Jira (`tract onboard`)
- Create tickets via sync service API
- Log time via sync service API
- Generate timesheets
- Health checks and diagnostics

### 4. Jira (External)

**Role:** Source of truth for managers, fallback for developers

**Integration:**
- Jira webhook → Tract sync service (for updates)
- Tract sync service → Jira REST API (for pushes)

## Data Flow

### Creating a Ticket (Developer → Jira)

```
Developer                Tract CLI              Sync Service           Git Repo              Jira
   │                         │                       │                     │                   │
   │  tract create APP      │                       │                     │                   │
   │  --title "Fix bug"     │                       │                     │                   │
   ├────────────────────────►│                       │                     │                   │
   │                         │  POST /create/APP     │                     │                   │
   │                         ├──────────────────────►│                     │                   │
   │                         │                       │  Create issue in    │                   │
   │                         │                       │  Jira               │                   │
   │                         │                       ├────────────────────────────────────────►│
   │                         │                       │                     │  ◄────────────────┤
   │                         │                       │  APP-3456 created   │                   │
   │                         │                       │                     │                   │
   │                         │                       │  Write APP-3456.md  │                   │
   │                         │                       ├────────────────────►│                   │
   │                         │                       │                     │                   │
   │                         │                       │  git commit         │                   │
   │                         │                       │  "[tract-sync]      │                   │
   │                         │                       │   Created APP-3456" │                   │
   │                         │                       ├────────────────────►│                   │
   │                         │  { issueKey, ... }    │                     │                   │
   │  ✅ Created APP-3456    │◄──────────────────────┤                     │                   │
   │◄────────────────────────┤                       │                     │                   │
   │                         │                       │                     │                   │
   │  git pull               │                       │                     │                   │
   ├─────────────────────────────────────────────────────────────────────►│                   │
   │  ◄─────────────────────────────────────────────────────────────────  │                   │
   │  Received APP-3456.md   │                       │                     │                   │
```

### Updating in Jira (Manager → Developer)

```
Manager (Jira)         Jira Webhook           Sync Service           Git Repo              Developer
   │                         │                       │                     │                   │
   │  Change APP-3456       │                       │                     │                   │
   │  status to "Done"       │                       │                     │                   │
   ├────────────────────────►│                       │                     │                   │
   │                         │  POST /webhook/jira   │                     │                   │
   │                         ├──────────────────────►│                     │                   │
   │                         │  {                     │                     │                   │
   │                         │    issue: {           │                     │                   │
   │                         │      key: APP-3456,   │                     │                   │
   │                         │      fields: {        │                     │                   │
   │                         │        status: Done   │                     │                   │
   │                         │      }                │                     │                   │
   │                         │    }                  │                     │                   │
   │                         │  }                    │                     │                   │
   │                         │                       │                     │                   │
   │                         │                       │  Update APP-3456.md │                   │
   │                         │                       │  (change status)    │                   │
   │                         │                       ├────────────────────►│                   │
   │                         │                       │                     │                   │
   │                         │                       │  git commit         │                   │
   │                         │                       │  "[tract-sync]      │                   │
   │                         │                       │   Updated APP-3456" │                   │
   │                         │                       ├────────────────────►│                   │
   │                         │                       │                     │                   │
   │                         │                       │                     │   git pull        │
   │                         │                       │                     │◄──────────────────┤
   │                         │                       │                     │  ───────────────► │
   │                         │                       │                     │  Updated file     │
```

### Logging Time

```
Developer                Tract CLI              Sync Service           Jira                  Git Repo
   │                         │                       │                     │                   │
   │  tract log APP-3456    │                       │                     │                   │
   │  2h "Fixed bug"         │                       │                     │                   │
   ├────────────────────────►│                       │                     │                   │
   │                         │  POST /worklog/       │                     │                   │
   │                         │       APP-3456        │                     │                   │
   │                         ├──────────────────────►│                     │                   │
   │                         │                       │  POST worklog       │                   │
   │                         │                       │  to Jira            │                   │
   │                         │                       ├────────────────────►│                   │
   │                         │                       │  ◄──────────────────┤                   │
   │                         │                       │  Worklog created    │                   │
   │                         │                       │                     │                   │
   │                         │                       │  Append to          │                   │
   │                         │                       │  worklogs/2026-02   │                   │
   │                         │                       │  .jsonl             │                   │
   │                         │                       ├────────────────────────────────────────►│
   │                         │                       │                     │                   │
   │                         │                       │  git commit         │                   │
   │                         │                       │  "[tract-sync]      │                   │
   │                         │                       │   Logged 2h to      │                   │
   │                         │                       │   APP-3456"         │                   │
   │                         │                       ├────────────────────────────────────────►│
   │                         │  ✅ Logged 2h          │                     │                   │
   │  ◄────────────────────  │◄──────────────────────┤                     │                   │
```

## Security Model

### User Isolation

**Tract system user:**
- UID: 751 (configurable)
- Shell: `/sbin/nologin` (no interactive login)
- Home: `/opt/tract`
- Owns: `/opt/tract/git/*.git` (bare repos), `/opt/tract/tract-sync/` (service code)

**Permissions:**
```
/opt/tract/
├── git/                    (drwxr-x--- tract:git)
│   └── app-tickets.git/    (drwxr-x--- tract:git)
├── config/                 (drwx------ tract:tract)
│   └── app.env             (-rw------- tract:tract)  # Contains Jira credentials
└── tract-sync/             (drwxr-x--- tract:tract)
    ├── server.js
    └── lib/
```

**Why `/sbin/nologin`?**
- Prevents interactive SSH login as `tract`
- Service runs via `systemd` (no shell needed)
- Git operations via `git` user with SSH key auth
- Updates via self-update API or `sudo` commands

### Network Security

**Firewall rules (example):**
```bash
# Allow Jira webhooks (if Jira is external)
iptables -A INPUT -p tcp --dport 3100 -s <jira-ip> -j ACCEPT

# Allow developers (internal network)
iptables -A INPUT -p tcp --dport 3100 -s 10.0.0.0/8 -j ACCEPT

# Block external access
iptables -A INPUT -p tcp --dport 3100 -j DROP
```

**Optional:** Add API key auth to `/update` endpoint (see SELF-UPDATE.md)

### Jira Credentials

**Stored in:** `/opt/tract/config/<project>.env`  
**Format:**
```bash
JIRA_URL=https://jira.company.com
JIRA_USERNAME=service-account
JIRA_PASSWORD=api-token-here
```

**Permissions:** `-rw------- tract:tract` (600)

**Best practice:** Use dedicated Jira service account with limited permissions (not a personal account).

## Loop Prevention

### Problem
Bidirectional sync can create infinite loops:
```
Developer edits Git → Sync pushes to Jira
→ Jira webhook fires → Sync commits to Git
→ Git hook fires → Sync pushes to Jira
→ ...
```

### Solution

**1. Commit message marker:**
All sync-generated commits include `[tract-sync]`:
```
[tract-sync] Updated APP-3456
[tract-sync] Created APP-3457
```

Git post-receive hook **ignores** commits with this marker.

**2. Sync user detection:**
Jira webhook handler **ignores** updates made by sync user (`JIRA_USERNAME` in config).

**3. Idempotency:**
Sync operations are idempotent — applying the same change twice has no effect.

**Example:**
```javascript
// Git → Jira sync (lib/git-to-jira-sync.js)
if (commitMessage.includes('[tract-sync]')) {
  console.log('Skipping sync commit');
  return;
}

// Jira → Git sync (lib/jira-to-git-sync.js)
if (issue.fields.updated.user.name === process.env.JIRA_USERNAME) {
  console.log('Skipping sync user update');
  return;
}
```

## Offline Mode

Tract is **offline-first**. You can create tickets and log time even when:
- Jira is down
- Sync server is unreachable
- No internet connection

**How it works:**

1. **Create ticket offline:**
   - CLI generates temporary ticket ID (e.g., `APP-OFFLINE-1234567890`)
   - Writes markdown file locally
   - Queues sync operation in `.tract/queue/create.jsonl`

2. **When online:**
   - Sync service processes queue
   - Creates ticket in Jira
   - Gets real ticket ID (e.g., `APP-3456`)
   - Renames file: `APP-OFFLINE-1234567890.md` → `APP-3456.md`
   - Commits change

**Worklog offline:**
- Append directly to `worklogs/YYYY-MM.jsonl`
- Sync service picks up new entries on next push

## Scaling

### Multiple Projects

Run separate sync services for each project:
```bash
# Install services
sudo ./install-service.sh APP   # Port 3100
sudo ./install-service.sh TB    # Port 3101
sudo ./install-service.sh PRD   # Port 3102

# Each gets:
# - Own bare git repo: /opt/tract/git/<project>-tickets.git
# - Own service: tract-sync@<project>.service
# - Own config: /opt/tract/config/<project>.env
# - Own port: 3100 + index
```

Developers set `TRACT_SYNC_SERVER` to the relevant port.

### Multiple Servers (Federation)

**Coming soon:** Sync between multiple Tract servers for distributed teams.

See `.tract/FEDERATION.md` for design.

## Monitoring

### Service Health

```bash
# Check service
systemctl status tract-sync@app.service

# Live logs
journalctl -u tract-sync@app.service -f

# Health endpoint
curl http://localhost:3100/health
```

**Healthy response:**
```json
{
  "status": "ok",
  "project": "APP",
  "jiraConnected": true,
  "gitRepoPath": "/opt/tract/git/app-tickets.git",
  "uptime": 86400
}
```

### Metrics to Track

- **Webhook latency** - Time from Jira event to git commit
- **Sync errors** - Failed API calls, permission issues
- **Loop detections** - Should be ~50% of events (normal)
- **Offline queue depth** - Pending operations when Jira down

## Deployment

See `ONBOARDING-CHECKLIST.md` for step-by-step guide.

**Quick overview:**
1. Install sync service on server (`install-service.sh`)
2. Configure Jira webhook
3. Developers clone repo and install CLI
4. Start creating tickets!

## Philosophy

**Tract is not a replacement for Jira.** It's a developer-friendly **interface** to Jira.

- **Managers:** Keep using Jira web UI (nothing changes)
- **Developers:** Use terminal, LLMs, and git (much faster)
- **Sync layer:** Keeps everyone in sync automatically

**Benefits:**
- Work offline (Jira down? Keep working)
- Fast search (`grep` beats Jira search)
- Version control (full history in git)
- LLM-native (AI can read/write tickets)
- Developer-friendly (terminal > slow web UI)

**Trade-offs:**
- Adds complexity (sync service to maintain)
- Not all Jira features supported (custom fields, workflows, attachments)
- Requires discipline (don't edit both sides simultaneously)

For teams where developers outnumber managers 10:1, the productivity gains are worth it.

---

**Questions?**
- Run `tract doctor` for diagnostics
- Check logs: `journalctl -u tract-sync -n 100`
- Read docs: `.tract/SCHEMA.md` (complete API reference)
