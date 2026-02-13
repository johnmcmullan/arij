# Tract Quick Start (Developers)

> **TL;DR:** Clone the repo, run `tract doctor`, create tickets in your terminal.

## Install

```bash
npm install -g @tract/cli
```

## Clone Existing Repo (Your Team Already Has Tract)

```bash
# Clone tickets repo
git clone ssh://git@server/path/to/app-tickets.git
cd app-tickets

# Set sync server
export TRACT_SYNC_SERVER=http://tract-server:3100
echo 'export TRACT_SYNC_SERVER=http://tract-server:3100' >> ~/.bashrc

# Health check
tract doctor
```

**Done.** You're ready to use Tract.

## Daily Commands

```bash
# Create a ticket
tract create APP --title "Fix login bug" --type bug --priority high

# Log time
tract log APP-3456 2h "Fixed authentication timeout"

# Check timesheet
tract timesheet

# Edit tickets directly (advanced)
vim issues/APP-3456.md
git add issues/APP-3456.md
git commit -m "Update APP-3456: Add acceptance criteria"
git push  # Syncs to Jira automatically

# Pull latest (someone edited in Jira)
git pull
```

## First Time Setup (New Project)

**Admin sets up server** (one-time):
```bash
ssh server
wget https://raw.githubusercontent.com/johnmcmullan/tract/master/tract-sync/install-service.sh
chmod +x install-service.sh
sudo ./install-service.sh APP
```

**You clone and go** (same as above):
```bash
git clone ssh://git@server/opt/tract/git/app-tickets.git
cd app-tickets
export TRACT_SYNC_SERVER=http://server:3100
tract doctor
```

## Troubleshooting

**Something broken?**
```bash
tract doctor
```

It tells you exactly what's wrong and how to fix it.

**Common fixes:**

```bash
# Server not set
export TRACT_SYNC_SERVER=http://tract-server:3100

# Git user not configured
git config user.name "Your Name"
git config user.email "you@company.com"

# Can't reach server
curl http://tract-server:3100/health

# Service down (server)
ssh server systemctl status tract-sync@app.service
```

## Work Offline

No server? No problem.

```bash
# Edit markdown files directly
vim issues/APP-3456.md

# Changes sync to Jira next time you push (when server is back)
git commit -am "Update tickets offline"
git push  # Later, when online
```

## LLM Integration

**For GitHub Copilot / Cursor / etc:**

"Read `.tract/SCHEMA.md` and help me create tickets."

Then just talk:
- "Create a ticket for the auth bug"
- "Log 2 hours to APP-3456"
- "Show me my timesheet"

The LLM runs `tract` commands for you.

## Philosophy

Tract = **Git** (markdown files) + **Jira** (sync layer).

- Managers use Jira (web UI)
- Developers use Tract (terminal)
- Sync happens automatically

You get the speed of git with the compliance of Jira.

---

**Next Steps:**
- Full docs: `GETTING-STARTED.md`
- Architecture: `ARCHITECTURE.md`
- Onboarding: `ONBOARDING-CHECKLIST.md`
- LLM API: `.tract/SCHEMA.md` (in your ticket repo)

**Need help?** Run `tract doctor` first.
