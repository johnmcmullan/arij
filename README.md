# Tract 🦞

**A lightweight Jira alternative using Markdown + Frontmatter + Git**

Simple project management where tickets are just markdown files with YAML frontmatter. No database required, everything versioned in git.

## Quick Links

- **[Installation Guide](tract-cli/README.md#installation)** - Get started in 1 command
- **[Multi-Project Setup](MULTI-PROJECT.md)** - Onboard TB, APP, PRD with workspace config
- **[Component Mapping](ON-DEMAND-MAPPING.md)** - LLM-powered component-to-code mapping
- **[CLI Reference](tract-cli/README.md)** - Complete command documentation

## The Philosophy

If an AI assistant can build Jira's core features, then:
1. Jira's $10-20/user/month pricing is not justified by technical defensibility
2. Software moats are eroding as AI collapses development costs to near-zero
3. The future of project management is text files + git

This project proves it works.

## What We Built

✅ **Projects** - Markdown files in `/projects/` folder  
✅ **Tickets** - Markdown files with frontmatter (PROJ-123.md)  
✅ **Kanban Board** - Drag-and-drop between Todo/In Progress/Done  
✅ **Comments** - Embedded in ticket markdown files  
✅ **Git-ready** - All changes go to files, ready to commit  
✅ **Zero Database** - No SQLite, PostgreSQL, or MongoDB needed  
✅ **Zero CSS frameworks** - Plain HTML, minimal CSS  
✅ **Vanilla JavaScript** - No React, no Vue, just native drag-and-drop  

## Tech Stack

- **Backend:** Express.js (Node.js)
- **Storage:** Markdown files with YAML frontmatter
- **Parser:** gray-matter (frontmatter parser)
- **Git:** simple-git (for manual commits)
- **Templates:** EJS (server-rendered HTML)
- **Styling:** Plain CSS (~5KB, no frameworks)
- **JavaScript:** Vanilla JS for drag-and-drop

**Why these choices?**
- Fast to build
- Zero complexity overhead
- Text files are the ultimate portable format
- Git gives you version control for free

## Installation

```bash
# Clone or download
git clone <repo-url>
cd tract

# Install dependencies
npm install

# Start the server
npm start
```

Visit `http://localhost:3000`

## File Structure

```
tract/
├── app.js                    # Express server (no database!)
├── lib/
│   └── markdown-store.js     # File-based storage layer
├── projects/
│   └── JK.md                 # Project metadata
├── tickets/
│   ├── JK-001.md             # Individual tickets
│   ├── JK-002.md
│   └── ...
├── views/                    # EJS templates
└── public/                   # Static assets
```

## Ticket Format

Each ticket is a markdown file with YAML frontmatter:

```markdown
---
id: JK-001
title: "Epic: Full ticket lifecycle"
status: todo
type: epic
created: 2026-02-09
priority: critical
assignee: john
component: server
labels: [mvp, crud]
---

## Description

Your ticket description goes here with **markdown** support.

## Acceptance Criteria

- [ ] Feature A works
- [ ] Feature B works

## Comments

**Alice** (2026-02-10T10:30:00Z):

This looks great! Let's get started.

---

**Bob** (2026-02-10T14:20:00Z):

I can help with the frontend.
```

## Features Breakdown

### Projects
- Markdown files in `/projects/` directory
- YAML frontmatter for metadata (name, created date, archived status)
- Body contains project description

### Tickets
- Auto-generated sequential IDs: PROJ-001, PROJ-002, etc.
- Markdown frontmatter for structured data
- Markdown body for description
- Comments embedded in the same file

### Board View
- Kanban-style columns (Todo/In Progress/Done)
- Drag-and-drop to change status
- Updates markdown files in real-time
- Visual feedback during drag

### Comments
- Embedded in ticket markdown under `## Comments` heading
- Markdown support
- Author and timestamp tracking

## Git Integration

Tract writes everything to markdown files, making it git-ready out of the box:

```bash
# Commit a new ticket
git add tickets/PROJ-042.md
git commit -m "Add ticket PROJ-042: Implement user authentication"

# See ticket history
git log -- tickets/PROJ-042.md

# View what changed in a ticket
git diff tickets/PROJ-042.md

# Revert a ticket to previous state
git checkout HEAD~1 -- tickets/PROJ-042.md
```

The LLM managing your project can decide when to commit, giving you intelligent version control without manual overhead.

## What Jira Charges For

Jira charges **$10-20/user/month** for essentially this:
- Project/ticket management ✅
- Status workflows ✅
- Board views ✅
- Comments/collaboration ✅
- Search and filters (coming soon)

**We built the core in ~6 hours with markdown files.** The rest is enterprise bloat.

## What We Didn't Build (Yet)

These are all weekend projects, not moats:
- Advanced search (grep works though!)
- Sprint planning
- Time tracking
- Integrations (GitHub webhooks, Slack)
- Email notifications
- Custom workflows (frontmatter is extensible)
- Authentication (add Passport.js)

None of these are technically difficult. They're just features.

## The Point

**Software margins are collapsing.**

If AI-assisted developers can replicate "moats" in hours using markdown files and git, then:
1. SaaS valuations are mispriced
2. Per-seat pricing models are doomed
3. Text files + version control beat expensive SaaS platforms

This project is proof: **Jira is commoditizable, and text files are all you need.**

## Why Markdown + Git?

**Portability:** Your data is in plain text files. No vendor lock-in, no export hassles.  
**Version Control:** Git gives you complete history for free.  
**Searchability:** Use grep, ripgrep, or any text search tool.  
**Extensibility:** Add any field to frontmatter. No schema migrations.  
**Collaboration:** Pull requests, branches, merges—git workflows just work.  
**AI-Friendly:** LLMs can read and write markdown natively.  
**Backup:** `git clone` is your backup. No database dumps needed.

## Use Cases

- **Solo developers:** Your personal task tracker in git
- **Small teams:** Collaborative project management with git workflows
- **AI-assisted workflows:** LLMs can manage tickets in markdown
- **Migration from Jira:** Export Jira issues to markdown files
- **Documentation-driven:** Tickets ARE documentation

## Deployment

**Option 1: Run Locally**
```bash
npm install
npm start
# Visit http://localhost:3000
```

**Option 2: Fly.io**
```bash
fly launch
fly deploy
```

**Option 3: Any VPS**
```bash
# Install Node.js
# Clone repo
npm install
npm start
# Set up systemd service or PM2
```

**Option 4: Docker**
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Contributing

This is a proof-of-concept, but pull requests welcome! Ideas:
- Better search (full-text indexing)
- GitHub integration (auto-create tickets from issues)
- CLI tool for creating tickets
- VSCode extension
- Mobile-friendly UI

## License

MIT - Do whatever you want with it.

## Credits

**Original prototype:** Built by Wylie (AI assistant) in Feb 2026  
**Markdown + Git migration:** Converted to file-based backend Feb 2026

Inspired by the realization that the best project management tool is just text files in git.

---

**Status:** ✅ Working prototype with markdown backend  
**Database:** None - pure markdown files  
**Jira replacement factor:** 80% of core functionality  
**Lock-in:** Zero - it's just text files

*The emperor has no clothes. Jira is just a fancy file editor. This is the proof.*
