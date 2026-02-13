# Central Worklogs Repository

## Problem

Each project repo (app-tickets, tb-tickets, etc.) only stores worklogs for that project. This makes complete time reporting impossible:
- Can't see total hours across all projects
- Can't log to admin projects (TINT) from developer CLI
- Scrum master worklogs split across multiple repos

## Solution: Central Worklogs Repository

All worklogs from ALL projects go to one central location:

```
/opt/tract/worklogs/                # Central worklogs (all projects)
├── 2026-01.jsonl
├── 2026-02.jsonl
└── 2026-03.jsonl
```

**NOT** in project repos:
```
/opt/tract/app-tickets/worklogs/    # ❌ Remove this
/opt/tract/tb-tickets/worklogs/     # ❌ Remove this
```

## Architecture

```
Developer → tract log TINT-206 2h → Sync Server → Central /opt/tract/worklogs/
Developer → tract log APP-3350 2h → Sync Server → Central /opt/tract/worklogs/
Jira → worklog_created webhook → Sync Server → Central /opt/tract/worklogs/
```

**All sync services** (APP, TB, PRD, TINT) write to the same central location.

## Configuration

Each sync service needs:
```bash
# /opt/tract/config/app.env
WORKLOG_REPO_PATH=/opt/tract/worklogs
```

The WorklogManager uses this separate path for worklogs, while TRACT_REPO_PATH is for tickets.

## Benefits

### Complete Time Reporting

Query all time from one location:

```bash
# Total hours in February (all projects)
cat /opt/tract/worklogs/2026-02.jsonl | jq -s 'map(.seconds) | add / 3600'

# Hours per project
cat /opt/tract/worklogs/2026-02.jsonl | jq -r '.issue' | cut -d- -f1 | sort | uniq -c

# Developer's total time
cat /opt/tract/worklogs/2026-02.jsonl | jq 'select(.author == "john")'

# Admin work (TINT project)
cat /opt/tract/worklogs/2026-02.jsonl | jq 'select(.issue | startswith("TINT-"))'
```

### Cross-Project Logging

Developers can log to any project:

```bash
tract log APP-3350 2h "Feature work"
tract log TINT-206 30m "Sprint planning"
tract log TB-1234 1h "Bug fix"
```

All worklogs end up in the same central JSONL files.

### Scrum Master Worklogs

When scrum masters log time in Jira (any project), it all syncs to central location automatically.

## Git Repository

The central worklogs location is its own git repository:

```bash
cd /opt/tract/worklogs
git init
git add 2026-02.jsonl
git commit -m "Worklogs for February 2026"
```

This allows:
- Version control of all time data
- Audit trail of who logged what when
- Push to remote for backup

## Migration

To migrate to central worklogs:

```bash
# Create central location
sudo mkdir -p /opt/tract/worklogs
sudo chown tract:tract /opt/tract/worklogs
cd /opt/tract/worklogs
git init
git config user.name "Tract Sync"
git config user.email "tract-sync@localhost"

# Copy existing worklogs from project repos
cp /opt/tract/app-tickets/worklogs/*.jsonl . 2>/dev/null || true
cp /opt/tract/tb-tickets/worklogs/*.jsonl . 2>/dev/null || true

# Merge duplicate entries (optional)
# Each JSONL line is already unique per entry

# Update sync service configs
echo "WORKLOG_REPO_PATH=/opt/tract/worklogs" >> /opt/tract/config/app.env
echo "WORKLOG_REPO_PATH=/opt/tract/worklogs" >> /opt/tract/config/tb.env

# Restart services
sudo systemctl restart tract-sync@app.service
sudo systemctl restart tract-sync@tb.service
```

## Implementation

Update WorklogManager constructor:

```javascript
constructor(config) {
  // Separate worklog path from ticket repo path
  this.worklogPath = config.worklogPath || path.join(config.repoPath, 'worklogs');
  this.worklogsDir = this.worklogPath;
  this.git = simpleGit(this.worklogPath);
  // ...
}
```

This allows worklogs to be in a different git repository than tickets.

## Timesheet Command

The `tract timesheet` command queries the central location:

```bash
# Your timesheet (all projects)
tract timesheet

# Output includes all projects:
2026-02-12
  APP-3350   2.0h  Feature work
  TINT-206   0.5h  Sprint planning
  TB-1234    1.0h  Bug fix
Total: 3.5h ⚠️ (4.5h short of 8h)
```

## Security

Central worklogs contain time data for all projects. Access control:
- Directory owned by `tract:tract` user
- Sync services run as `tract` user
- Developers read via `tract timesheet` command (authenticated via sync server)
- Managers access via Jira (already authenticated)

## Future: TINT Sync Service

For admin projects like TINT, deploy a sync service:

```bash
# /opt/tract/config/tint.env
PROJECT_NAME=TINT
JIRA_PROJECT=TINT
TRACT_REPO_PATH=/opt/tract/tint-tickets
WORKLOG_REPO_PATH=/opt/tract/worklogs  # Same central location
PORT=3103

# Start service
systemctl start tract-sync@tint.service
```

Now developers can create TINT tickets and log time to them.
