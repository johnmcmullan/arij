# Tract CLI

Command-line tool for working with Tract tickets.

## Installation

```bash
cd tract-cli
npm install
npm link  # Makes 'tract' command available globally
```

## Environment Setup

```bash
# Set your sync server URL
export TRACT_SYNC_SERVER=http://tract-server:3100

# Or add to ~/.bashrc
echo 'export TRACT_SYNC_SERVER=http://tract-server:3100' >> ~/.bashrc
```

## Commands

### `tract create`

Create a new ticket (works offline).

**Usage:**
```bash
tract create APP --title "Fix login bug"

tract create APP \
  --title "Implement OAuth" \
  --type story \
  --priority high \
  --assignee john.mcmullan \
  --description "Add OAuth 2.0 support" \
  --components "Backend,Security" \
  --labels "auth,oauth"
```

**Options:**
- `--title <text>` - Ticket title (required)
- `--type <type>` - Issue type: bug, task, story, epic (default: task)
- `--priority <level>` - Priority: trivial, minor, medium, major, critical, blocker (default: medium)
- `--assignee <username>` - Assign to user
- `--description <text>` - Detailed description
- `--components <list>` - Comma-separated components
- `--labels <list>` - Comma-separated labels
- `--server <url>` - Sync server URL (or use TRACT_SYNC_SERVER env var)

**Offline support:**
- If Jira is available: Creates ticket immediately, returns real ID (e.g., APP-3350)
- If Jira is down: Creates temp ID (e.g., APP-TEMP-123), queues for sync
- Auto-syncs when Jira comes back online

### `tract log`

Log time to a ticket.

**Usage:**
```bash
tract log APP-3350 2h "Fixed authentication bug"
tract log APP-3351 30m "Code review"
tract log APP-3352 1d "Implemented feature"
```

**Arguments:**
- `<issue>` - Issue key (e.g., APP-3350)
- `<time>` - Time spent (e.g., 2h, 30m, 1d, 1.5h)
- `[comment]` - Work description (optional)

**Options:**
- `--server <url>` - Sync server URL
- `--author <name>` - Author name (defaults to git user.name)
- `--started <datetime>` - Start time (ISO 8601, defaults to now)

**Time formats:**
- `2h` - 2 hours
- `30m` - 30 minutes
- `1d` - 1 day (8 hours)
- `1.5h` - 1.5 hours

### `tract timesheet`

View your timesheet.

**Usage:**
```bash
# Today's timesheet
tract timesheet

# Specific date
tract timesheet --date 2026-02-12

# This week
tract timesheet --week

# Specific week
tract timesheet --week 2026-W07

# This month
tract timesheet --month 2026-02

# Different author
tract timesheet john.doe

# Export formats
tract timesheet --format csv > timesheet.csv
tract timesheet --format json > timesheet.json
```

**Options:**
- `[author]` - Author name (defaults to git user.name)
- `--server <url>` - Sync server URL
- `--date <date>` - Specific date (YYYY-MM-DD)
- `--week [week]` - ISO week (e.g., 2026-W07, or current week if no value)
- `--month <month>` - Month (YYYY-MM)
- `--format <format>` - Output format: text, json, csv (default: text)

**Output:**
```
Timesheet for john.mcmullan (2026-02-12)

APP-3350  2.0h  Fixed authentication bug
APP-3351  0.5h  Code review
APP-3352  4.0h  Implemented OAuth flow

Total: 6.5h ⚠️ (1.5h short of 8h)
```

### `tract worklogs`

View worklog entries for a specific issue.

**Usage:**
```bash
tract worklogs APP-3350
```

**Options:**
- `--server <url>` - Sync server URL

**Output:**
```
Worklogs for APP-3350

2026-02-12 09:00  john.mcmullan  2.0h  Fixed authentication bug
2026-02-11 14:00  sarah.jones    1.5h  Code review
2026-02-10 10:00  john.mcmullan  4.0h  Initial implementation

Total logged: 7.5h
```

## LLM Usage

Tract is designed to be used through LLMs. Instead of memorizing commands, talk to your LLM:

**Instead of:**
```bash
tract create APP --title "Fix login timeout" --type bug --priority high --description "..."
```

**Just say:**
```
"Create a ticket for the login timeout issue. Make it high priority."
```

**Your LLM will:**
1. Read SCHEMA.md to understand the system
2. Extract details from your conversation
3. Run the appropriate command
4. Tell you what it did

## Working with Tickets

### Edit Directly

Tickets are markdown files. Edit them directly:

```bash
vim issues/APP-3350.md
git commit -am "Update APP-3350: Add acceptance criteria"
git push  # Auto-syncs to Jira via webhook
```

### Bulk Operations

Use standard Unix tools:

```bash
# Update all tickets in sprint 6 to sprint 7
sed -i 's/sprint: 6/sprint: 7/' issues/APP-*.md
git commit -am "Move tickets to sprint 7"
git push

# Find all high-priority bugs
grep -l "priority: high" issues/*.md | xargs grep "type: bug"

# List tickets assigned to you
grep -l "assignee: $(git config user.name)" issues/*.md
```

## Development

### Running Tests

```bash
npm test
```

### Local Development

```bash
# Link for development
npm link

# Make changes
vim bin/tract.js

# Test immediately
tract create APP --title "Test"
```

## See Also

- [CREATE-GUIDE.md](../tract-sync/CREATE-GUIDE.md) - Detailed ticket creation guide
- [WORKLOG-GUIDE.md](../tract-sync/WORKLOG-GUIDE.md) - Time tracking guide
- [SCHEMA.md](../.tract/SCHEMA.md) - Complete specification (for LLMs)
- [README.md](../README.md) - Project overview and philosophy
