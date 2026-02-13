# Creating Tickets with Tract

## Quick Start

```bash
# Set your sync server URL (one time)
export TRACT_SYNC_SERVER=http://tract-server:3100

# Create a minimal ticket
tract create APP --title "Fix login bug"

# Create a fully-specified ticket
tract create APP \
  --title "Implement user authentication" \
  --type story \
  --priority high \
  --assignee john.mcmullan \
  --description "Users need a secure login system with OAuth support" \
  --components "Backend,Security" \
  --labels "sprint-7,auth,oauth"
```

## How It Works

### Online Mode (Jira Available)

When Jira is online, the sync server:

1. Creates the ticket in Jira via REST API
2. Gets back the real Jira ID (e.g., `APP-3348`)
3. Creates the markdown file: `issues/APP-3348.md`
4. Commits to git with message: `Create APP-3348: [title]`
5. Returns immediately to the CLI

**Example output:**
```
📝 Creating ticket in APP...
   Title: Fix login bug
   Type: bug

✅ Created APP-3348
   File: issues/APP-3348.md
   Synced to Jira and committed to git

🔗 Edit: issues/APP-3348.md
```

### Offline Mode (Jira Down)

When Jira is unavailable, the sync server:

1. Generates a temporary ID: `APP-TEMP-1707763200000` (timestamp-based)
2. Creates the markdown file with `_offline: true` flag
3. Writes a queue file: `.tract/queue/APP-TEMP-1707763200000.json`
4. Commits to git with the temp ID
5. Returns immediately to the CLI

**Example output:**
```
📝 Creating ticket in APP...
   Title: Fix login bug
   Type: bug

⏸️  Created APP-TEMP-1707763200000 (offline)
   File: issues/APP-TEMP-1707763200000.md
   Jira is unavailable - queued for sync when online
   Temporary ID will be updated to real Jira ID automatically

🔗 Edit: issues/APP-TEMP-1707763200000.md
```

### Queue Processing

When Jira comes back online, the sync server automatically:

1. Scans `.tract/queue/` on startup
2. For each queued ticket:
   - Creates in Jira
   - Gets real ID (e.g., `APP-3350`)
   - Renames: `issues/APP-TEMP-*.md` → `issues/APP-3350.md`
   - Removes `_offline` flag
   - Updates git history
   - Deletes queue file

**Server output:**
```
✅ Synced 3 offline ticket(s) to Jira
   APP-TEMP-1707763200000 → APP-3350
   APP-TEMP-1707763201000 → APP-3351
   APP-TEMP-1707763202000 → APP-3352
```

## Field Reference

### Required

- `--title` - Short summary (becomes frontmatter `title` field)

### Optional

- `--type` - Issue type: `bug`, `task`, `story`, `epic`, `sub-task` (default: `task`)
- `--priority` - Priority: `trivial`, `minor`, `medium`, `major`, `critical`, `blocker` (default: `medium`)
- `--assignee` - Username to assign to (must exist in Jira)
- `--description` - Full description (becomes markdown body)
- `--components` - Comma-separated components (e.g., `"Backend,Frontend"`)
- `--labels` - Comma-separated labels (e.g., `"bug,regression,critical"`)

### Server

- `--server` - Sync server URL (or set `TRACT_SYNC_SERVER` environment variable)

## Examples

### Bug Report

```bash
tract create APP \
  --title "Crash on startup with empty config" \
  --type bug \
  --priority critical \
  --description "Application crashes if config.json is empty. Need proper validation." \
  --labels "crash,config,regression"
```

### Feature Request

```bash
tract create APP \
  --title "Add CSV export functionality" \
  --type story \
  --priority medium \
  --assignee sarah.jones \
  --description "Users need to export data to CSV format" \
  --components "Export,UI" \
  --labels "export,enhancement"
```

### Quick Task

```bash
tract create APP --title "Update README with new installation steps"
```

## LLM Usage

LLMs reading SCHEMA.md can create tickets from natural language:

**User says:** "Create a ticket for the login timeout issue"

**LLM runs:**
```bash
tract create APP \
  --title "Fix login timeout issue" \
  --type bug \
  --priority medium \
  --description "Users experiencing timeout during login after 30 seconds"
```

**User says:** "We need to implement dark mode. Make it a story and assign it to me."

**LLM runs:**
```bash
tract create APP \
  --title "Implement dark mode theme" \
  --type story \
  --assignee john.mcmullan \
  --description "Add dark mode support to application UI" \
  --components "UI,Frontend" \
  --labels "enhancement,ui"
```

## High Availability Benefits

### Never Blocked by Jira

Before Tract:
- Jira down → Can't create tickets → Developers blocked
- Jira slow → Wait for response → Lost productivity
- Network issues → No ticket creation → Work halts

With Tract:
- Jira down → Offline ticket created → Keep working
- Jira slow → Offline ticket created → No wait
- Network issues → Offline ticket created → No blocking

### Automatic Recovery

When Jira recovers, the queue is automatically processed:
- All offline tickets synced
- Files renamed with real IDs
- Git history updated
- No manual intervention needed

### Distributed by Design

- Each developer has full ticket history in git
- Can create tickets without network access
- Sync happens when connectivity restored
- Built-in resilience to infrastructure failures

## Troubleshooting

### "Could not reach sync server"

The sync server is not running or not reachable:

```bash
# Check if service is running
systemctl status tract-sync@app.service

# Check network connectivity
curl http://tract-server:3100/health

# Set correct server URL
export TRACT_SYNC_SERVER=http://tract-server:3100
```

### "Jira authentication failed"

Server configuration issue:

```bash
# Check service logs
journalctl -u tract-sync@app.service -f

# Verify credentials in config
cat /opt/tract/config/app.env
```

### Tickets stuck in queue

If tickets remain in queue after Jira comes back:

```bash
# Manually trigger queue processing
curl -X POST http://tract-server:3100/sync/queue

# Check server logs for errors
journalctl -u tract-sync@app.service -n 100
```

## Technical Details

### Temporary ID Format

`{PROJECT}-TEMP-{timestamp}`

Example: `APP-TEMP-1707763200000`

- `PROJECT`: Project key (APP, TB, etc.)
- `TEMP`: Indicates offline ticket
- `timestamp`: Unix timestamp in milliseconds (ensures uniqueness)

### Queue File Structure

`.tract/queue/APP-TEMP-1707763200000.json`:

```json
{
  "tempId": "APP-TEMP-1707763200000",
  "title": "Fix crash on startup",
  "type": "bug",
  "priority": "critical",
  "assignee": "john.mcmullan",
  "description": "Application crashes if config.json is empty",
  "components": ["Backend"],
  "labels": ["crash", "config"],
  "created": "2026-02-12T20:00:00.000Z"
}
```

### Offline Ticket Frontmatter

```yaml
---
id: APP-TEMP-1707763200000
title: Fix crash on startup
type: bug
status: To Do
priority: critical
_offline: true
created: 2026-02-12 20:00:00
---
```

The `_offline: true` flag is removed when the ticket syncs to Jira.

## See Also

- [SCHEMA.md](../../apps/tickets/.tract/SCHEMA.md) - Section 16: Creating New Tickets
- [WORKLOG-GUIDE.md](./WORKLOG-GUIDE.md) - Time logging workflow
- [FIRST-UPDATE.md](./FIRST-UPDATE.md) - Server setup guide
