# Tract CLI

> Command-line interface for Tract - the developer-friendly Jira alternative

## Installation

```bash
npm install -g @tract/cli
```

Or use without installing:

```bash
npx @tract/cli doctor
```

## Quick Start

### 1. Check Your Setup

```bash
tract doctor
```

This runs health checks and tells you exactly what's missing.

### 2. Clone an Existing Tract Repo

If your team already has Tract set up:

```bash
git clone ssh://git@server/path/to/tickets.git
cd tickets
tract doctor
```

### 3. Or Bootstrap a New Project

If you're the first person:

```bash
tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --output ./app-tickets
```

## Commands

### `tract doctor`

Run health checks and diagnostics.

**What it checks:**
- Git installation
- Git repository status
- Tract config validity
- Git remote setup
- Sync server connectivity
- Common issues

**Example output:**
```
✓ Git installed (git version 2.39.0)
✓ Git repository initialized
✓ Tract config directory exists
✓ Tract config file valid (Project: APP)
✓ Issues directory exists (42 tickets)
⚠ Git remote not configured
  Fix: git remote add origin <url>
```

**When to use:** Anytime something isn't working. Start here.

---

### `tract onboard`

Bootstrap a new Tract project from Jira.

**Required:**
- `--jira <url>` - Jira instance URL
- `--project <key>` - Project key (e.g., APP, TB)
- `--user <username>` OR `JIRA_USERNAME` env var
- `--token <token>` OR `JIRA_TOKEN` env var

**Optional:**
- `--output <dir>` - Where to create the repo (default: current directory)
- `--submodule <path>` - Add as submodule in parent repo
- `--remote <url>` - Git remote URL
- `--import-tickets` - Import existing tickets during setup
- `--limit <n>` - Limit tickets imported (for testing)
- `--no-git` - Skip git initialization

**Examples:**

**Basic onboarding:**
```bash
export JIRA_USERNAME="your.name"
export JIRA_TOKEN="your-token"

tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --output ./app-tickets \
  --import-tickets
```

**As a submodule in your code repo:**
```bash
cd ~/code/my-app

tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --submodule tickets \
  --remote ssh://git@server/tickets.git \
  --import-tickets
```

**What it does:**
1. Creates directory structure (`.tract/`, `issues/`, `worklogs/`)
2. Generates config from Jira project settings
3. Optionally imports open tickets
4. Initializes git repo
5. Sets up git remote (if provided)
6. Creates initial commit

---

### `tract create <PROJECT>`

Create a new ticket.

**Required:**
- `<project>` - Project key (e.g., APP)
- `--title <text>` - Ticket title

**Optional:**
- `--type <type>` - Issue type (bug, task, story, etc.) - default: task
- `--priority <priority>` - Priority (trivial, minor, major, critical, blocker) - default: medium
- `--assignee <username>` - Assign to user
- `--description <text>` - Detailed description
- `--components <list>` - Comma-separated component names
- `--labels <list>` - Comma-separated labels
- `--server <url>` - Sync server URL (or use `TRACT_SYNC_SERVER` env var)

**Examples:**

```bash
# Simple task
tract create APP --title "Update README"

# Bug with priority
tract create APP \
  --title "Login timeout after 5 minutes" \
  --type bug \
  --priority critical \
  --assignee john.doe \
  --components "Auth,Frontend"

# Story with description
tract create APP \
  --title "Implement OAuth SSO" \
  --type story \
  --description "Users should be able to log in via Google/GitHub" \
  --labels "security,auth"
```

**Requires:** `TRACT_SYNC_SERVER` environment variable or `--server` option

---

### `tract log <ISSUE> <TIME> [COMMENT]`

Log time to an issue.

**Arguments:**
- `<issue>` - Issue key (e.g., APP-1234)
- `<time>` - Time spent (e.g., 2h, 30m, 1d, 1w)
- `[comment]` - Work description (optional)

**Optional:**
- `--server <url>` - Sync server URL
- `--author <name>` - Author name (defaults to git user.name)
- `--started <datetime>` - Start time (ISO 8601, defaults to now)

**Examples:**

```bash
# Log 2 hours
tract log APP-1234 2h "Fixed authentication bug"

# Log with custom author
tract log APP-1234 30m "Code review" --author jane.doe

# Log with specific start time
tract log APP-1234 1h "Meeting" --started "2026-02-13T10:00:00Z"
```

**Time format examples:**
- `30m` = 30 minutes
- `2h` = 2 hours
- `1d` = 1 day (8 hours)
- `1w` = 1 week (40 hours)

**Requires:** `TRACT_SYNC_SERVER` environment variable or `--server` option

---

### `tract timesheet [AUTHOR]`

View timesheet entries.

**Arguments:**
- `[author]` - Author name (optional, defaults to git user.name)

**Optional:**
- `--date <date>` - Specific date (YYYY-MM-DD)
- `--week [week]` - ISO week (e.g., 2026-W07, or current week if no value)
- `--month <month>` - Month (YYYY-MM)
- `--format <format>` - Output format: text, json, csv (default: text)
- `--server <url>` - Sync server URL

**Examples:**

```bash
# Today's timesheet
tract timesheet

# This week
tract timesheet --week

# Specific week
tract timesheet --week 2026-W07

# Specific month
tract timesheet --month 2026-02

# Another user's timesheet
tract timesheet john.doe --week

# Export as CSV
tract timesheet --month 2026-02 --format csv > february.csv
```

**Requires:** `TRACT_SYNC_SERVER` environment variable or `--server` option

---

### `tract worklogs <ISSUE>`

View all worklog entries for a specific issue.

**Arguments:**
- `<issue>` - Issue key (e.g., APP-1234)

**Optional:**
- `--server <url>` - Sync server URL

**Example:**

```bash
tract worklogs APP-1234
```

**Requires:** `TRACT_SYNC_SERVER` environment variable or `--server` option

---

### `tract import`

Import tickets from Jira into an existing Tract repo.

**Optional:**
- `--tract <dir>` - Tract repo directory (default: current)
- `--user <username>` - Jira username (or `JIRA_USERNAME` env var)
- `--token <token>` - Jira API token (or `JIRA_TOKEN` env var)
- `--status <status>` - Import tickets with this status (default: open, or "all")
- `--limit <n>` - Limit number of tickets
- `--jql <query>` - Custom JQL query (overrides --status)
- `--commit` - Auto-commit imported tickets

**Examples:**

```bash
# Import all open tickets
tract import

# Import only "In Progress" tickets
tract import --status "In Progress"

# Import using custom JQL
tract import --jql "project = APP AND created > -7d"

# Import and commit
tract import --commit
```

---

### `tract map-components`

Use an LLM to map Jira components to code directory paths.

**Optional:**
- `--tract <dir>` - Tract repo directory (default: current)
- `--code <dir>` - Code repo root to scan (default: parent directory)
- `--confidence <percent>` - Confidence threshold for auto-accept (default: 80)
- `--no-interactive` - Skip interactive review (auto-accept all)

**Example:**

```bash
cd ~/code/my-app/tickets
tract map-components --code .. --confidence 90
```

**What it does:**
1. Scans your code directory structure
2. Uses LLM to match Jira component names to directories
3. Writes mappings to `.tract/components.yaml`
4. Interactive review (unless `--no-interactive`)

---

## Environment Variables

### `TRACT_SYNC_SERVER`

URL of the Tract sync service (required for create/log/timesheet commands).

**Example:**
```bash
export TRACT_SYNC_SERVER=http://tract-server:3100
```

Add to `~/.bashrc` or `~/.zshrc` to persist.

### `JIRA_USERNAME` / `JIRA_TOKEN`

Jira credentials for onboarding and importing.

**Example:**
```bash
export JIRA_USERNAME="your.name"
export JIRA_TOKEN="your-api-token"
```

**How to get a token:**
1. Go to Jira → Settings → Personal Access Tokens
2. Create new token
3. Copy and save in environment variable

---

## Troubleshooting

### "TRACT_SYNC_SERVER not set"

**Solution:** Set the environment variable or use `--server` option:

```bash
export TRACT_SYNC_SERVER=http://tract-server:3100
```

Or:
```bash
tract create APP --title "Test" --server http://tract-server:3100
```

### "Not a git repository"

**Solution:** Navigate to your Tract repo or run `tract onboard`:

```bash
cd path/to/tickets
# or
tract onboard --jira <url> --project <KEY>
```

### ".tract/ directory missing"

**Solution:** Run `tract onboard` to bootstrap the repository.

### "Could not reach sync server"

**Checks:**
1. Is the service running? `ssh tract-server systemctl status tract-sync`
2. Is the URL correct? `curl http://tract-server:3100/health`
3. Are you on the right network/VPN?

**Offline work:** You can still create/edit tickets locally. Edit markdown files in `issues/` directory.

### "Git user not configured"

**Solution:** Configure git user:

```bash
git config user.name "Your Name"
git config user.email "you@company.com"
```

---

## For LLMs

If you're an LLM helping a developer:

1. **Read `.tract/SCHEMA.md`** in the ticket repository for complete documentation
2. Use `tract doctor` to diagnose issues
3. Prefer `tract create` and `tract log` over manual file editing (when server is available)
4. For offline work, edit markdown files directly in `issues/`

---

## Development

**Run from source:**

```bash
git clone https://github.com/johnmcmullan/tract.git
cd tract/tract-cli
npm install
npm link  # Makes 'tract' command available globally

# Test
tract doctor
```

**Run tests:**

```bash
npm test
```

---

## License

MIT

## Support

- **Issues:** https://github.com/johnmcmullan/tract/issues
- **Docs:** https://github.com/johnmcmullan/tract
- **Need help?** Run `tract doctor` first!
