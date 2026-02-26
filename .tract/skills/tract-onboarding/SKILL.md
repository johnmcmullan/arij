---
name: tract-onboarding
description: Set up a new Tract project or onboard a developer to an existing team. Use when bootstrapping tract, connecting to Jira, cloning repos for the first time, or running tract onboard.
---
# Tract Onboarding Skill

## Purpose

Guide users through setting up a new Tract project — either with Jira sync or local-only mode. This skill activates when a user wants to bootstrap, initialize, or connect Tract for the first time.

## When to Use This Skill

**Activate when:**
- User says: "Set up Tract", "Initialize Tract", "Connect to Jira"
- User says: "Get me set up on the team", "Clone the project", "Join the team's Tract"
- User wants to create a new Tract project
- User runs `tract onboard` or `tract clone` with missing parameters
- User asks how to get started with Tract

**Do NOT activate when:**
- User is already in a Tract project (check for `.tract/`)
- User wants to create tickets (use tract-schema skill)
- User wants to import existing tickets to an already-set-up project

## Two Distinct Onboarding Paths

**Read this first — the right path depends on the user's situation.**

### Path A: Joining an existing team

Used when the organisation already runs tract. Two sub-paths depending on whether a catalog server is running:

**Path A1 — Catalog server available** → Jump to: **[Team Onboarding via Catalog](#team-onboarding-via-catalog)**

**Path A2 — No catalog, but sync server hostname known** → Use `tract clone <PROJECT> --server <host>` (see below)

### Path B: Bootstrapping tract for the first time

Used when there is no catalog server yet, or when an admin is setting up a new project from scratch.

→ Continue reading the Core Workflow below.

---

## Team Onboarding via Catalog

When a developer is joining a team that already uses tract.

### Step 1: Get the catalog server URL

Ask the user: "Do you have the catalog server URL from your admin? It looks like `http://tract-server:8080`."

If they don't have it — they need to ask their admin. The admin can find it by running `curl http://localhost:8080/install.sh` on the server.

### Step 2: Install

```bash
curl http://tract-server:8080/install.sh | bash
```

This does three things: installs tract from the org's server (not npm), saves the catalog server URL to `~/.tract/config.yaml`, and prints next steps.

Skip this step if `tract --version` already works and `tract catalog list` returns projects.

### Step 3: See what's available

```bash
tract catalog list
```

Shows all projects and their dependencies. Identify which project the user needs.

### Step 4: Clone

```bash
tract clone <PROJECT>
```

e.g. `tract clone TRADING`

**No catalog server?** Use `--server` with the sync server hostname instead:

```bash
tract clone APP --server reek
tract clone TB --server reek
```

This clones directly via SSH (`tract@reek:/opt/tract/APP`) without needing a catalog.

### Step 4b: Field Detection (after clone — do this before any other work)

After cloning, the sync daemon will have saved a compact ticket sample for LLM field analysis.
Check for it and run field detection if present:

```bash
ls ~/.tract/<PREFIX>/.tract/detect-fields-payload.json
```

If the file exists:

```bash
ANTHROPIC_API_KEY=<key> tract detect-fields <PREFIX> --reuse
```

This calls Claude to identify which `customfield_NNNNN` keys map to sprint, story_points,
epic_link, rank, etc. It outputs a `custom_field_map:` YAML block.

**As the supervising LLM you should:**
1. Run `tract detect-fields <PREFIX> --reuse` yourself (using the bash tool)
2. Read the suggested `custom_field_map` from the output
3. Add it under `jira:` in `~/.tract/<PREFIX>/.tract/config.yaml`
4. Commit the change: `cd ~/.tract/<PREFIX> && git add .tract/config.yaml && git commit -m "Add custom field mappings"`
5. Note: existing tickets were synced without custom fields. To backfill, delete the sentinel
   and restart the daemon: `sudo -u tract rm /opt/tract/<PREFIX>/.tract/.full-sync-done && sudo systemctl restart tract-sync`

**The payload file persists** — re-run `--reuse` any time to re-analyse without hitting Jira again.

### Step 5: Verify

```bash
cd ~/work/<project-name>
tract doctor
```

### Success criteria

- ✓ `tract --version` works
- ✓ `tract catalog list` shows projects
- ✓ Repo(s) cloned to `~/work/`
- ✓ `tract doctor` passes in the project directory
- ✓ `~/work/.tract/workspace.yaml` exists

### Staying up to date

```bash
tract update
```

Checks the org's catalog server for a newer CLI version and installs it if found. tract also checks automatically in the background every 8 hours and notifies at the next command invocation.

---

## Core Workflow (Path B: Bootstrapping a new project)

### Step 0: Verify This is NOT Already a Tract Project

**Before onboarding, check:**
```bash
ls .tract/config.yaml 2>/dev/null
```

**If .tract/ exists:**
- This is already a Tract project
- User doesn't need onboarding
- Switch to tract-schema or tract-doctor skill instead

**If .tract/ does NOT exist:**
- Perfect! Proceed with onboarding.
- This directory will become a Tract project.

### Step 1: Determine Mode

Ask the user which setup mode they want:

**Three Options:**

1. **Local-only (add Jira later)**
   - Start working immediately
   - Add Jira sync when ready
   - Migrate path documented below

2. **Jira sync now**
   - Full metadata import during onboarding
   - Immediate bidirectional sync
   - Requires Jira credentials ready

3. **Jira later (deferred import)**
   - Save Jira URL in config
   - Don't import tickets yet
   - Run `tract import` when ready

**Option A: Interactive (Recommended for Humans)**
```bash
tract onboard --interactive
```
- Guided Q&A flow
- Validates inputs as you go
- Use when: user is new, exploring, or doesn't have all info ready

**Option B: Full Arguments (Recommended for LLMs)**
Gather all required info through conversation, then execute with complete flags.

For local-only (add Jira later):
```bash
tract onboard \
  --project <KEY> \
  --local \
  --output <directory>
```

For Jira sync now:
```bash
tract onboard \
  --project <KEY> \
  --jira <URL> \
  --user <username> \
  --token <api-token> \
  --output <directory> \
  [--import-tickets]
```

### Step 2: Gather Required Information

**For Jira Sync:**
1. **Project key** - 2+ characters, uppercase (e.g., APP, TB, MYPROJ)
2. **Jira URL** - Full URL including https:// (e.g., `https://jira.company.com`)
3. **Username** - Jira username (often email)
4. **API Token** - Check if `JIRA_TOKEN` env var is set first
5. **Output directory** - Where to create the project (default: current dir)
6. **Import tickets?** - Yes/no (can do later with `tract import`)

**For Local-Only:**
1. **Project key**
2. **Output directory**

### Step 3: Validate Inputs

Before running the command:

**Check project key:**
- At least 2 characters
- Uppercase recommended (command will auto-uppercase)
- No spaces or special chars except hyphen/underscore

**Check Jira URL:**
- Starts with `http://` or `https://`
- No trailing slash
- Reachable (optional: curl check)

**Check credentials:**
- If `JIRA_TOKEN` env var exists, skip --token flag
- If not, user must provide token via --token

**Check output directory:**
- Must be empty (or non-existent)
- If exists and has files → error, suggest new directory

### Step 4: Execute Onboarding

Run the command with gathered parameters.

**Expected output:**
```
🚀 Tract Onboarding

Connecting to Jira...
✓ Metadata fetched successfully

📊 Project Metadata:
   Name:        MyProject
   Key:         APP
   Issue Types: 5
   Statuses:    8
   ...

✓ Configuration files generated
✓ Git repository initialized

✅ Onboarding complete!
```

**If it fails:**
- Read the error message carefully
- Common errors documented in `references/common-errors.md`
- Pass clear explanation back to user

### Step 5: Post-Onboarding Actions

Tell the user what they can do next:

```
cd <output-directory>
tract doctor                    # Verify setup
tract create APP --title "..."  # Create first ticket
tract import --status open      # Import existing tickets (if skipped)
```

## Error Handling

### Authentication Errors
```
❌ Jira API Error: 401 Unauthorized
```
**Fix:**
- Username wrong? (Check spelling, case)
- Token expired? (Generate new one from Jira)
- Wrong Jira URL? (Check https://, domain)

See `references/jira-auth.md` for detailed auth troubleshooting.

### Directory Errors
```
❌ Error: Directory not empty: ./my-tickets
```
**Fix:**
- Choose a different directory
- Or: create a new subdirectory: `mkdir fresh && cd fresh`

### Project Not Found
```
❌ Error: Project "XYZ" may not exist
```
**Fix:**
- Check project key spelling (case-sensitive in some Jira setups)
- Verify user has permission to access that project
- Try browsing to Jira URL + `/browse/XYZ-1` to confirm

## Advanced Options

### Git Submodule Mode
Add tickets as a submodule inside an existing code repo:

```bash
tract onboard \
  --project APP \
  --jira <url> \
  --user <user> \
  --token <token> \
  --output <parent-repo-dir> \
  --submodule tickets \
  --remote <git-url>
```

**When to use:**
- Code and tickets in one repo
- Want tickets excluded from client exports
- LLM manages both code and tickets

### Import During Onboarding
```bash
--import-tickets           # Import open tickets
--import-tickets --limit 50  # Limit for testing
```

**Note:** Import can also be done later with `tract import`.

## Example Conversations

### Example 0: Developer joining a team (catalog path)

```
User: "I've just started and need to get set up on the TRADING project"

LLM: "Do you have the catalog server URL from your admin?"

User: "Yes — http://tract-server:8080"

LLM: [Runs: curl http://tract-server:8080/install.sh | bash]

     "Tract is installed and configured to talk to your org's server.
      Let me check what projects are available..."

LLM: [Runs: tract catalog list]

     "I can see:
        APP          Main application
        SHARED-UI    Shared UI components
        TRADING      Trading platform  [depends on: APP, SHARED-UI]

      Cloning TRADING (which will also clone APP and SHARED-UI as dependencies)..."

LLM: [Runs: tract clone TRADING]

     "Done! Three repos cloned:
        ~/work/app/
        ~/work/shared-ui/
        ~/work/trading/

      workspace.yaml written to ~/work/.tract/

      Let me run a health check..."

LLM: [Runs: cd ~/work/trading && tract doctor]

     "All good. You're ready to work.
      Want me to show you what tickets are open in TRADING?"
```

### Example 1: LLM-Assisted Jira Onboarding

```
User: "Help me set up Tract for our APP project"

LLM: "I'll set up Tract for you. A few questions:
      1. Do you want Jira sync or local-only?
      2. What's your Jira URL?
      3. What's your Jira username?
      4. Do you have JIRA_TOKEN in your environment?"

User: "Jira sync. URL is jira.company.com, username john.mcmullan, token is set."

LLM: [Validates: URL needs https://]
     "I'll use https://jira.company.com - is that correct?"

User: "Yes"

LLM: [Runs: tract onboard --project APP --jira https://jira.company.com --user john.mcmullan --import-tickets]
     
     "Connecting to Jira... Success!
      Found 47 components, 12 issue types, 8 statuses.
      Importing open tickets... 234 tickets imported.
      
      Your Tract project is ready at ./app-tickets/
      
      Next steps:
      - cd app-tickets
      - tract doctor (verify setup)
      - tract create APP --title 'My ticket' (create tickets)"
```

### Example 2: Local-Only Setup

```
User: "I want to try Tract offline first"

LLM: "I'll create a local-only Tract project. What project key? (e.g., TEST, DEMO)"

User: "DEMO"

LLM: [Runs: tract onboard --project DEMO --local --output ./demo-tickets]
     
     "Created local Tract project at ./demo-tickets/
      
      You can:
      - Create tickets: tract create DEMO --title 'First ticket'
      - Log time: tract log DEMO-1 2h 'Work description'
      - Add Jira sync later by editing .tract/config.yaml"
```

## Reference Documents

For complete details, load these references on-demand:

- **`references/onboard-cli-spec.md`** - All CLI flags, options, examples
- **`references/jira-auth.md`** - Authentication setup, token generation, troubleshooting
- **`references/common-errors.md`** - Error messages and fixes

## Key Constraints

1. **Determine the path first:** Catalog/clone (team joining) vs `tract onboard` (new project bootstrap). Ask one question — "do you have a catalog server URL?" — and branch from there.
2. **Binary choice for bootstrap:** Interactive OR full-args (never mix)
3. **Validate before executing:** Catch errors early
4. **Clear output directory:** `tract onboard` requires empty or non-existent dir
5. **LLMs gather, then execute:** Don't use `--interactive` from an LLM
6. **Credentials safety:** Prefer env vars over --token in command line
7. **Don't suggest `npm install -g @tract/cli`** if a catalog server URL is known — the org's server is the distribution point

## Success Criteria

Onboarding succeeded when:
- ✓ `.tract/` directory exists with valid config.yaml
- ✓ `issues/` directory exists (may be empty)
- ✓ Git repository initialized
- ✓ `tract doctor` passes (or warnings only)

## Adding Jira Later (Post-Local-Only Onboarding)

If user onboarded with `--local` and now wants Jira sync:

### Quick Migration Steps

**1. Update config:**
```bash
vim .tract/config.yaml
```
Add Jira settings:
```yaml
jira:
  url: https://jira.company.com
  project: APP

sync:
  enabled: true
```

**2. Set credentials:**
```bash
export JIRA_USERNAME=john.mcmullan
export JIRA_TOKEN=your-api-token
```

**3. Import existing Jira tickets:**
```bash
tract import --status open
```

**4. Enable sync server:**
```bash
export TRACT_SYNC_SERVER=http://tract-server:3100
```

**5. Verify:**
```bash
tract doctor
# Should show:
# ✓ Jira configured
# ✓ Sync server reachable
```

**6. Test sync:**
```bash
# Edit a ticket
vim issues/APP-1.md
git commit -am "Update APP-1: test sync"
git push

# Check Jira - should see changes
```

### Common Migration Questions

**Q: Will my local tickets sync to Jira?**
A: Yes, when you push. Sync server creates them in Jira.

**Q: Will time logs sync?**
A: Yes, on next push. Already-logged time appears in Jira.

**Q: What about conflicts?**
A: Import keeps local version by default. Delete local file first to use Jira version.

**Q: Can I go back to local-only?**
A: Yes, set `sync.enabled: false` in config.

For complete migration guide, load: `references/jira-later-migration.md`

## Post-Onboarding: Transition to Operational Mode

**After successful onboarding, STAY ENGAGED as the user's interface to Tract.**

Don't just dump commands and exit. Offer to help with immediate next steps:

### Transition Script (LLM should say this):

```
✅ Tract is set up and ready!

I can help you manage this project now. What would you like to do first?

Options:
1. Create your first ticket
2. Import existing tickets (if migrating from somewhere)
3. Set up time tracking
4. Just explore - I'll guide you

I'll use the tract-schema and tract-timetracking skills to help you work with Tract.
You don't need to learn the CLI - just tell me what you want to do.
```

### Load Next Skills

Immediately load these for operational mode:
- **tract-schema skill** - ticket creation/management
- **tract-timetracking skill** - time logging, timesheets

### Example Engagement

**User:** "Create a ticket for setting up my Emacs config"

**LLM:**
```
[Loads tract-schema skill]
[Runs: tract create EMACS --title "Set up Emacs configuration" --type task]

Created EMACS-1: Set up Emacs configuration

The ticket is in issues/EMACS-1.md. Want me to:
- Add more details to it?
- Assign it to you?
- Add to a sprint?
- Start logging time?
```

**User:** "Yes, assign it to me and add details"

**LLM:**
```
[Edits issues/EMACS-1.md - adds assignee, description]
[Commits to git]

Updated EMACS-1:
- Assigned to john.mcmullan
- Added description and acceptance criteria
- Status: backlog

Want to start working on it? I can:
- Change status to in-progress
- Start a timer for time tracking
```

### Stay in Character as Project Interface

**Don't:** "Here are the commands you can run..."
**Do:** "What do you want to work on? I'll manage the tickets for you."

**Don't:** "Use tract create to make tickets"
**Do:** "Tell me what ticket you need and I'll create it"

**Don't:** "Run tract log to log time"
**Do:** "How much time did you spend on that? I'll log it."

### Operational Skills to Load

After onboarding succeeds:

1. **Load tract-schema SKILL.md** - for ticket operations
2. **Load tract-timetracking SKILL.md** - for time tracking
3. **Keep onboarding references** - for "add Jira later" questions

### Proactive Offers

**Daily workflow support:**
- "Want me to check what you're working on today?"
- "Should I log your time before end of day?"
- "Any tickets you want to update?"

**Weekly workflow:**
- "Want to see your timesheet for this week?"
- "Should we review open tickets?"

---

**Remember:** You're not just an onboarding wizard - you're the user's **ongoing interface to Tract**. The CLI exists, but the user doesn't need to learn it. You're the natural language layer.
