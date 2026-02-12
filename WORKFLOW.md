# Tract Onboarding Workflow - Quick Reference

## The Vision

**LLM as UI, Git as Database**
- Use Copilot CLI with `.tract/SCHEMA.md` as your ticket interface
- No manual editing, no web UI
- All operations via natural language
- Git handles version control and collaboration

## One-Time Setup: Onboard Your Project

### Scenario: APP Project with Code at ~/work/apps

**Step 1: Onboard with submodule mode**

```bash
cd ~/work/apps  # Your existing code repository

# Option A: With known remote URL
~/work/tract/tract-cli/bin/tract.js onboard \
  --jira https://your-jira-instance.atlassian.net \
  --project APP \
  --submodule tickets \
  --remote git@github.com:yourcompany/app-tickets.git

# Option B: Configure remote later
~/work/tract/tract-cli/bin/tract.js onboard \
  --jira https://your-jira-instance.atlassian.net \
  --project APP \
  --submodule tickets

# If you chose Option B, add remote now:
cd tickets
git remote add origin git@github.com:yourcompany/app-tickets.git
git push -u origin master
cd ..
```

**What you get:**

```
~/work/apps/
├── .gitattributes          # tickets/ export-ignore (clients won't see tickets)
├── .gitmodules             # submodule configuration
├── tickets/                # ← Git submodule (separate repo)
│   ├── .tract/
│   │   ├── SCHEMA.md       # API spec for LLM
│   │   ├── config.yaml     # Types, statuses, priorities from Jira
│   │   └── components.yaml # Components from Jira
│   ├── projects/
│   │   └── APP.md          # Project metadata
│   ├── tickets/            # Ticket markdown files go here
│   └── README.md
├── src/                    # Your application code
└── README.md
```

**Step 2: Review configuration**

```bash
cd ~/work/apps/tickets
cat .tract/config.yaml       # Verify types, statuses, priorities
cat .tract/components.yaml   # Add file paths to components
cat .tract/SCHEMA.md         # Read this - it's the LLM's API spec
```

**Step 3: Commit parent repo**

```bash
cd ~/work/apps
git add .gitattributes .gitmodules tickets
git commit -m "Add APP tickets as submodule"
git push
```

## Daily Workflow: Using Copilot CLI as Your Ticket Interface

### Creating Tickets

```
You: "Create a bug ticket for the login timeout issue"

Copilot: 
- Reads .tract/SCHEMA.md to understand format
- Creates tickets/APP-001.md with proper frontmatter
- Uses correct type (bug), status (to-do), etc.
- Commits to tickets repo
- Pushes to remote
```

### Viewing Tickets

```
You: "Show me all open bugs"

Copilot:
- Reads tickets/*.md files
- Filters by type=bug, status≠done
- Displays formatted list
```

### Updating Tickets

```
You: "Move APP-001 to in-progress and assign to me"

Copilot:
- Edits tickets/APP-001.md frontmatter
- Updates status and assignee fields
- Commits and pushes
```

### Adding Comments

```
You: "Comment on APP-001: Found the root cause, it's in auth.js line 45"

Copilot:
- Appends to ## Comments section in APP-001.md
- Formats: **user** (timestamp): comment text
- Commits and pushes
```

## Client Distribution

**Creating release archives (excludes tickets):**

```bash
cd ~/work/apps
git archive HEAD -o app-v2.0.tar.gz
# Result: src/ and code only, NO tickets/ or .tract/
```

**Why it works:**
- `.gitattributes` contains `tickets/ export-ignore`
- Git archive respects export-ignore
- Clients never see internal tickets

## Team Collaboration

**Team member cloning:**

```bash
# Clone code repo with tickets
git clone --recurse-submodules git@github.com:yourcompany/apps.git
cd apps

# Or if already cloned without --recurse-submodules:
git clone git@github.com:yourcompany/apps.git
cd apps
git submodule init
git submodule update
```

**Making ticket changes:**

```bash
cd ~/work/apps/tickets
# Use Copilot CLI to create/update tickets
# Copilot handles git operations in the submodule

# Or manually:
vim tickets/APP-123.md
git add tickets/APP-123.md
git commit -m "Update APP-123 status"
git push

# Update parent repo to point to new submodule commit
cd ..
git add tickets
git commit -m "Update tickets submodule"
git push
```

## Copilot CLI Examples

Based on `.tract/SCHEMA.md`, you can ask:

**Ticket Operations:**
- "Create a story for implementing OAuth"
- "Show tickets in code-review status"
- "Add testing component to APP-123"
- "Set priority to blocker for APP-45"
- "Link APP-123 as blocked-by APP-124"

**Queries:**
- "What bugs are assigned to me?"
- "Show all tickets in sprint-23"
- "List tickets with priority critical or blocker"
- "Find tickets mentioning 'authentication'"

**Workflows:**
- "Move APP-123 through the workflow to done"
- "Create a release for version 2.0 with all done tickets"
- "Show tickets fixed in release 1.5"

**The key:** Copilot reads `SCHEMA.md` and knows:
- Valid field names and types
- Workflow states
- Required vs optional fields
- Frontmatter format
- Comment format
- File naming conventions

## Advantages of This Approach

1. **No Web UI needed** - Natural language is the interface
2. **No Database** - Git is the database
3. **Version control** - Every change tracked
4. **LLM handles complexity** - Git submodules, YAML formatting, validation
5. **Portable** - Just markdown files
6. **AI-friendly** - Plain text, well-documented schema
7. **Client-safe** - Export-ignore keeps tickets internal
8. **Dual-mode** - Same repo works standalone or as submodule

## Troubleshooting

**Submodule not showing up:**
```bash
git submodule update --init
```

**Submodule shows changes when you didn't make any:**
```bash
cd tickets
git status  # Check if ahead of remote
git push    # Push any commits
cd ..
git add tickets
git commit -m "Update tickets submodule reference"
```

**Need to update submodule to latest:**
```bash
cd tickets
git pull
cd ..
git add tickets
git commit -m "Update tickets to latest"
```

**Copilot CLI not understanding schema:**
- Make sure `.tract/SCHEMA.md` is present
- Ask Copilot to "read .tract/SCHEMA.md first"
- Reference specific sections: "According to SCHEMA.md section 4..."

## Next Steps

1. **Test onboarding** with your real APP project
2. **Create first ticket** via Copilot CLI
3. **Import existing Jira issues** (future: `tract import --project APP`)
4. **Train team** on Copilot CLI workflow
5. **Deploy Jira proxy** to collect more data
6. **Gradually migrate** projects one at a time

---

**Remember:** The LLM is your ticket interface. Git is your database. SCHEMA.md is the contract.
