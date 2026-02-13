# Getting Started with Tract

> **For developers who want to work with tickets in their terminal instead of clicking through Jira.**

## What You'll Set Up

1. **Server** (one-time, admin-only) - Sync service that keeps Tract ↔ Jira in sync
2. **Your Local Clone** - Git repo with your project's tickets

## Prerequisites

- Git installed
- Node.js 16+ installed (for running `tract` CLI)
- SSH access to your git server (if using one)
- Jira credentials (username + API token)

## Installation

### Install the Tract CLI

```bash
npm install -g @tract/cli
```

Or use `npx` without installing globally:

```bash
npx @tract/cli doctor
```

### Verify Installation

```bash
tract --version
tract doctor
```

The `doctor` command will check:
- ✓ Git is installed
- ✓ Node/npm versions
- ✓ Environment setup

## Two Ways to Start

### Option 1: Clone Existing Tract Repo (Recommended)

If your team already has a Tract repo set up:

```bash
# Clone the ticket repo
git clone ssh://git@your-server/path/to/app-tickets.git

cd app-tickets

# Run health check
tract doctor

# You're ready! Try:
tract create APP --title "Test ticket" --type task
```

### Option 2: Bootstrap New Project from Jira

If you're the first person setting this up:

```bash
# Set Jira credentials (one-time)
export JIRA_USERNAME="your.name"
export JIRA_TOKEN="your-api-token"

# Bootstrap the repo
tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --output ./app-tickets \
  --import-tickets

cd app-tickets

# Configure git remote (if you have a git server)
git remote add origin ssh://git@your-server/path/to/app-tickets.git
git push -u origin master

# Run health check
tract doctor
```

### Option 3: Add Tickets to Existing Code Repo (Submodule)

If you want tickets alongside your code:

```bash
cd ~/code/your-app

# Add tract repo as submodule
tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --submodule tickets \
  --remote ssh://git@your-server/path/to/app-tickets.git \
  --import-tickets

# The submodule is now at ./tickets/
cd tickets
tract doctor
```

## Daily Usage

### Create a Ticket

```bash
tract create APP \
  --title "Fix login timeout bug" \
  --type bug \
  --priority high \
  --description "Users getting logged out after 5 minutes"
```

Or use an LLM:
```
You: "Create a ticket for the login timeout issue"
LLM: [runs: tract create APP --title "Fix login timeout" ...]
```

### Log Time

```bash
tract log APP-3350 2h "Fixed session timeout in auth middleware"
```

Or:
```
You: "I just spent 2 hours on APP-3350"
LLM: [runs: tract log APP-3350 2h ...]
```

### Check Your Timesheet

```bash
tract timesheet
```

Shows:
- Hours logged today
- Warning if under 8h
- Breakdown by ticket

### Edit Tickets (Advanced)

```bash
# Edit ticket markdown directly
vim issues/APP-3350.md

# Change status, add comments, update description
# Then commit:
git add issues/APP-3350.md
git commit -m "Update APP-3350: Mark as done"
git push

# Changes sync to Jira automatically (if server configured)
```

### Pull Latest Tickets

```bash
git pull
```

If someone else updated tickets (via Jira or git), you'll see them immediately.

## Configuration

### Set Sync Server (Optional)

If your team has a Tract sync server running:

```bash
export TRACT_SYNC_SERVER=http://tract-server:3100

# Add to ~/.bashrc or ~/.zshrc to persist:
echo 'export TRACT_SYNC_SERVER=http://tract-server:3100' >> ~/.bashrc
```

### Jira Credentials

Store credentials in environment variables (don't commit these!):

```bash
export JIRA_USERNAME="your.name"
export JIRA_TOKEN="your-api-token"

# Or use ~/.netrc (more secure):
cat >> ~/.netrc << EOF
machine jira.company.com
  login your.name
  password your-api-token
EOF
chmod 600 ~/.netrc
```

## Troubleshooting

### "TRACT_SYNC_SERVER not set"

This is a **warning**, not an error. You can use Tract locally without a sync server.

To fix:
```bash
export TRACT_SYNC_SERVER=http://tract-server:3100
```

### "Not a git repository"

You're not in a Tract directory. Navigate to your ticket repo:

```bash
cd path/to/app-tickets
```

Or run `tract onboard` to create a new repo.

### ".tract/ directory missing"

The directory doesn't have Tract configuration. Run:

```bash
tract onboard --jira <url> --project <KEY>
```

### "Cannot reach sync server"

The Tract sync server isn't running or not accessible.

**Check server status:**
```bash
ssh tract-server systemctl status tract-sync@app.service
```

**Check health manually:**
```bash
curl http://tract-server:3100/health
```

If server is down, you can still work offline. Changes will sync when server comes back.

### "Git user not configured"

Git doesn't know who you are:

```bash
git config user.name "Your Name"
git config user.email "you@company.com"
```

## Commands Reference

### `tract doctor`
Run health checks and diagnostics. Use this when something isn't working.

### `tract onboard`
Bootstrap a new Tract project from Jira. Creates directory structure, imports tickets, sets up git.

### `tract create <PROJECT>`
Create a new ticket. Syncs to Jira if server configured, otherwise queues locally.

### `tract log <ISSUE> <TIME> [COMMENT]`
Log time to a ticket. Examples: `2h`, `30m`, `1d`.

### `tract timesheet [--week] [--month]`
View your logged time. Defaults to today.

### `tract import`
Import tickets from Jira (if you already have a Tract repo and want to pull more tickets).

### `tract map-components`
Use LLM to map Jira components to code directories (advanced).

## Next Steps

1. ✅ Install Tract CLI: `npm install -g @tract/cli`
2. ✅ Run `tract doctor` to verify setup
3. ✅ Clone existing repo OR run `tract onboard` for new project
4. ✅ Create your first ticket: `tract create`
5. ✅ Log some time: `tract log`
6. ✅ Configure your LLM to use Tract commands

**For LLMs:** Read `.tract/SCHEMA.md` in your ticket repository for complete documentation.

**For Admins:** See `tract-sync/README.md` for server installation and setup.

## Philosophy

Tract is designed for **developers who prefer their terminal over web UIs**.

- **Local-first:** Full repo on your machine, work offline
- **Git-native:** Every change tracked, branches work, pull requests work
- **LLM-friendly:** Talk to AI, delegate ticket management
- **Jira-compatible:** Bidirectional sync means managers keep using Jira

You shouldn't have to context-switch to a slow web UI just to update a ticket. Stay in your terminal, use your tools, let the computer handle the sync.

---

**Questions? Issues?** Check `tract doctor` output or read `.tract/SCHEMA.md` for complete documentation.
