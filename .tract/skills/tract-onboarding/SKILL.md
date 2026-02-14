# Tract Onboarding Skill

## Purpose

Guide users through setting up a new Tract project — either with Jira sync or local-only mode. This skill activates when a user wants to bootstrap, initialize, or connect Tract for the first time.

## When to Use This Skill

**Activate when:**
- User says: "Set up Tract", "Initialize Tract", "Connect to Jira"
- User wants to create a new Tract project
- User runs `tract onboard` with missing parameters
- User asks how to get started with Tract

**Do NOT activate when:**
- User is already in a Tract project (check for `.tract/`)
- User wants to create tickets (use tract-schema skill)
- User wants to import existing tickets to an already-set-up project

## Core Workflow

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

1. **Binary choice:** Interactive OR full-args (never mix)
2. **Validate before executing:** Catch errors early
3. **Clear output directory:** Onboarding requires empty or non-existent dir
4. **LLMs gather, then execute:** Don't use `--interactive` from an LLM
5. **Credentials safety:** Prefer env vars over --token in command line

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

## Post-Onboarding

Once onboarding completes, transition to:
- **tract-schema skill** - for creating/managing tickets
- **tract-doctor skill** - for health checks and diagnostics

---

**Remember:** Onboarding is a one-time setup. If user is already in a Tract project, they don't need this skill - they need tract-schema or other operational skills.
