# Tract — A Jira Replacement for Developers

> **The product is a specification. The interface is any LLM. The infrastructure is git.**

Tract is a project management system that treats tickets as **markdown files** in **git**, synced bidirectionally with Jira. It's designed for developers who prefer working in their terminal and delegating to LLMs.

## Philosophy

**Traditional project management:**
- Click through web UI → Find your ticket → Click edit → Type in form → Click save → Hope it worked

**Tract:**
- Talk to your LLM → "Create a ticket for that auth bug we discussed" → Done  
- Edit markdown files → Git commit → Automatically syncs to Jira

## Why Tract?

### For Developers
- **Work offline** - Jira down? Keep creating tickets, logging time, making changes
- **Use your tools** - vim, VS Code, grep, git - whatever you prefer  
- **No context switching** - Stay in terminal, delegate to LLM
- **Git history** - Every change tracked, reviewable, revertable
- **Fast** - Grep thousands of tickets instantly, no waiting for Jira

### For Managers
- **Still have Jira** - Bidirectional sync means nothing changes for non-developers
- **Better data** - Developers actually log time because it's easy
- **Resilience** - Team keeps working even when Jira is down
- **Transparency** - All changes in git, auditable, searchable

## Quick Start

### Talk to Your LLM (Recommended)

The easiest way to use Tract is through an LLM interface like GitHub Copilot CLI, Cursor, or any chat interface that can run commands.

**Create a ticket:**
```
You: "Create a ticket for the login timeout issue. Make it high priority."

LLM: [Runs: tract create APP --title "Fix login timeout" --type bug --priority high]
     Created APP-3350.
```

**Log your time:**
```
You: "I spent 2 hours on APP-3350 fixing that bug."

LLM: [Runs: tract log APP-3350 2h "Fixed timeout by increasing session TTL"]
     Logged 2h to APP-3350. Synced to Jira.
```

**Check your timesheet:**
```
You: "Did I log 8 hours today?"

LLM: [Runs: tract timesheet]
     Today: 7.5 hours ⚠️ (0.5h short)
```

**Update a ticket:**
```
You: "Mark APP-3350 as done"

LLM: [Edits: issues/APP-3350.md, changes status to Done, git commits]
     APP-3350 updated and synced to Jira.
```

### Manual CLI (if you prefer)

```bash
# Create a ticket
tract create APP \
  --title "Implement OAuth authentication" \
  --type story \
  --priority high

# Log time
tract log APP-3350 2h "Implemented OAuth flow"

# View your timesheet
tract timesheet

# Edit tickets directly
vim issues/APP-3350.md
git commit -am "Update APP-3350: Add acceptance criteria"
git push  # Auto-syncs to Jira
```

## For LLMs: Read SCHEMA.md

**If you're an LLM helping a developer**, read `.tract/SCHEMA.md` in the ticket repository for complete documentation:

- Full field reference (all frontmatter fields explained)
- Command reference (create, log, import, sync)
- File formats (markdown structure, JSONL worklogs, queue files)
- Workflow patterns (offline queueing, conflict resolution)
- Integration examples (how to help users effectively)

**SCHEMA.md is your API documentation.** It's designed to be consumed by LLMs, not humans. It tells you everything you need to operate the system on behalf of a user.

## How It Works

### The Files

```
app-tickets/                    # Your ticket repository
├── issues/
│   ├── APP-3350.md            # One file per ticket
│   ├── APP-3351.md
│   └── APP-3352.md
├── worklogs/
│   └── 2026-02.jsonl          # Time entries by month
└── .tract/
    ├── SCHEMA.md              # LLM API documentation
    ├── config.yaml            # Project configuration
    └── sprints/               # Sprint definitions
```

### The Sync

```
Developer ─┬─> Edit Markdown ──> Git Commit ──> Sync Server ──> Jira
           │
           └─> tract CLI ──────> Sync Server ──┬─> Jira (online)
                                                └─> Queue (offline)

Jira ──> Webhook ──> Sync Server ──> Git Commit ──> Developer pulls
```

### The Magic

- **Bidirectional**: Changes in either direction sync automatically
- **Offline-first**: Create tickets, log time even when Jira is down
- **Fast**: Local git repo = instant search, grep, history
- **LLM-native**: Complete specification for AI agents

## Features

### Core
✅ **Markdown + Frontmatter** - Tickets are readable text files  
✅ **Bidirectional Jira Sync** - Changes flow both ways  
✅ **Git-based** - Full history, branches, pull requests  
✅ **Offline-capable** - Create tickets when Jira is down  

### Time Tracking
✅ **Simple logging** - `tract log APP-3350 2h "what you did"`  
✅ **Instant Jira sync** - Managers see time immediately  
✅ **Timesheet reports** - Daily/weekly summaries with warnings  
✅ **Monthly archives** - JSONL format for easy analysis  

### LLM-Friendly
✅ **Structured schema** - Complete spec for LLM consumption  
✅ **Natural language** - Talk to your LLM, it handles the commands  
✅ **Context-aware** - LLM reads git history, ticket content  
✅ **Scriptable** - All commands designed for automation  

### Developer Experience
✅ **Fast search** - `grep` beats Jira search by 100x  
✅ **Bulk operations** - `sed`, `awk`, shell scripts work  
✅ **Your editor** - vim, VS Code, emacs, whatever  
✅ **Diff-friendly** - See exactly what changed  

## Use Cases

### "Jira is down again"
**Before:** Developers blocked, no work can be tracked  
**With Tract:** Create tickets offline, auto-sync when Jira returns

### "I need to update 50 tickets"
**Before:** Click...click...click... for 2 hours  
**With Tract:** `sed -i 's/sprint: 6/sprint: 7/' issues/*.md && git push`

### "What did I work on last week?"
**Before:** Search Jira history, piece it together  
**With Tract:** `git log --since="1 week ago" --author=me`

### "I want to work on the train (no internet)"
**Before:** Can't access anything  
**With Tract:** Full repo locally, sync when back online

## Documentation

**For humans (getting started):**
- [README.md](README.md) - This file
- [tract-sync/CREATE-GUIDE.md](tract-sync/CREATE-GUIDE.md) - Creating tickets
- [tract-sync/WORKLOG-GUIDE.md](tract-sync/WORKLOG-GUIDE.md) - Time tracking

**For LLMs (complete API):**
- [.tract/SCHEMA.md](.tract/SCHEMA.md) - Full specification
- **Read this if you're an LLM helping a developer**

**For admins (deployment):**
- [tract-sync/INSTALL.md](tract-sync/INSTALL.md) - Server installation
- [tract-sync/UPDATE.md](tract-sync/UPDATE.md) - Updating the server

## Philosophy Deep Dive

### Why Markdown?

Markdown is:
- **Human-readable** - No XML/JSON noise
- **Diff-friendly** - Git shows exactly what changed
- **Tool-friendly** - grep, sed, awk, vim, VS Code all work
- **Frontmatter** - Structured metadata when needed
- **LLM-friendly** - Natural language + structure

### Why Git?

Git provides:
- **Offline-first** - Full repo locally, sync when ready
- **History** - Every change tracked forever
- **Distribution** - Everyone has a full copy
- **Trust** - Cryptographic integrity

### Why LLMs?

LLMs are:
- **Natural interfaces** - Talk like a human, not learn CLI flags
- **Context-aware** - Read your git history, understand your project
- **Delegatable** - "Handle this for me" beats "What command?"
- **Always improving** - Gets smarter over time

### The Future

Traditional tools are **forms over databases**. Fill out fields, click buttons, wait for pages.

Tract is **plain text with LLM interfaces**. Express intent, delegate to automation, get work done.

- **The interface is any LLM** - Use Copilot, Cursor, Claude, or build your own
- **The product is a specification** - SCHEMA.md documents everything
- **The infrastructure is git** - Distributed, fast, reliable, proven

---

**Built by developers, for developers, with LLMs.**

Talk to your LLM. It knows what to do.
