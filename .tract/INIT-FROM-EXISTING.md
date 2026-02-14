# Initialize from Existing Tract Repository

**Scenario:** Developer clones a repo that already has Tract configured.

## The Use Case

**Upstream repo:**
```
frontend/
├── .tract/
│   ├── config.yaml
│   ├── components.yaml
│   └── sprints/
├── issues/
│   ├── FRONT-1.md
│   ├── FRONT-2.md
│   └── ...
├── src/
└── .git/
```

**Developer:**
```bash
git clone git@github.com:company/frontend.git
cd frontend

# Now what?
# How do I start using Tract?
```

## Current Behavior (Works Fine!)

**Tract just works:**

```bash
# No init needed - tract commands work immediately
tract create FRONT --title "Add feature"
tract log FRONT-123 2h "Worked on feature"

# Why? .tract/config.yaml already exists
```

**The repo IS initialized.** No special setup needed.

## Optional: Verify Setup

**Add `tract doctor` command:**

```bash
tract doctor

Checking Tract configuration...

✓ .tract/config.yaml exists
✓ Project: FRONT
✓ Issues directory: issues/ (42 tickets found)
✓ Components: 5 defined
✓ Sprints: 3 defined

Git repository:
  ✓ On branch: main
  ✓ Remote: git@github.com:company/frontend.git
  ✓ Clean working directory

Sync configuration:
  ✗ Credentials not set (optional)
  
Your repository is ready for Tract!

Optional: Set up sync credentials
  export JIRA_USERNAME=you@company.com
  export JIRA_TOKEN=<api-token>
  
Then you can:
  tract import  # Import from Jira
  tract sync    # Sync changes
```

## Developer Onboarding Workflow

### Step 1: Clone Repository

```bash
git clone git@github.com:company/frontend.git
cd frontend
```

### Step 2: Install Tract CLI

```bash
curl -fsSL https://raw.githubusercontent.com/johnmcmullan/tract/master/install.sh | bash
```

### Step 3: Verify (Optional)

```bash
tract doctor
# or just check config exists
cat .tract/config.yaml
```

### Step 4: Start Working

```bash
# Create tickets
tract create FRONT --title "New feature"

# Log time
tract log FRONT-42 1h "Implemented feature"

# View board (web UI)
cd ~/work/frontend
node ~/work/tract/app.js
# Visit http://localhost:3000/board
```

**That's it!** No `tract init` needed.

## Optional Sync Setup

**If developer wants to sync with Jira:**

```bash
# Set credentials
export JIRA_USERNAME=dev@company.com
export JIRA_TOKEN=<your-api-token>

# Add to ~/.bashrc or ~/.zshrc
echo 'export JIRA_USERNAME=dev@company.com' >> ~/.bashrc
echo 'export JIRA_TOKEN=<your-api-token>' >> ~/.bashrc

# Test import
tract import --limit 5
```

## What If Config Is Missing?

**If someone clones a repo without Tract:**

```bash
cd some-repo
tract create APP --title "Ticket"

Error: .tract/config.yaml not found

Run: tract onboard
```

**Then they can onboard:**

```bash
tract onboard --local --project APP
# Creates .tract/ structure

# Or connect to Jira
tract onboard --jira https://jira.company.com --project APP
```

## Comparison: Existing Repo vs New Repo

### Cloning Existing Tract Repo

```bash
git clone repo
cd repo
# .tract/ exists
tract create PROJ --title "Ticket"  # Works immediately
```

### Starting Fresh

```bash
mkdir new-project
cd new-project
git init

tract onboard --local --project NEW
# Creates .tract/

tract create NEW --title "Ticket"  # Now works
```

## `tract init` Command (Optional)

**Could add for clarity:**

```bash
tract init

Checking existing Tract configuration...

✓ .tract/config.yaml exists (project: FRONT)
✓ Issues directory: issues/

This repository is already configured for Tract.

To create a ticket: tract create FRONT --title "..."
To log time: tract log FRONT-123 2h "..."
To set up sync: export JIRA_USERNAME=... JIRA_TOKEN=...

Run 'tract doctor' for detailed status.
```

**But honestly:** Not needed. If `.tract/config.yaml` exists, Tract works.

## Documentation

**Add to README.md:**

```markdown
## For Developers Joining Existing Project

If you cloned a repository that already has Tract configured:

1. **Install Tract CLI:**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/johnmcmullan/tract/master/install.sh | bash
   ```

2. **Start working:**
   ```bash
   tract create PROJ --title "My ticket"
   tract log PROJ-123 1h "Work done"
   ```

3. **Optional - Set up sync:**
   ```bash
   export JIRA_USERNAME=you@company.com
   export JIRA_TOKEN=<api-token>
   ```

That's it! If `.tract/config.yaml` exists, you're ready to go.
```

## Git Ignore Recommendations

**What to commit:**
```gitignore
# Commit (shared team config)
.tract/config.yaml
.tract/components.yaml
.tract/sprints/
.tract/boards/team-*.yaml

# Don't commit (personal preferences)
.tract/boards/my-*.yaml
.tract/queries/my-*.yaml
```

**Or simpler (commit everything):**
```gitignore
# Commit all Tract config
# (nothing in .gitignore for .tract/)
```

## Developer-Specific Config

**Personal overrides (future):**

```yaml
# .tract/config.local.yaml (gitignored)
# Developer-specific settings
user:
  name: john.mcmullan
  default_assignee: john.mcmullan
  
boards:
  default: my-board
```

**Tract reads:**
1. `.tract/config.yaml` (team config)
2. `.tract/config.local.yaml` (personal overrides, gitignored)

## Multi-Developer Scenarios

### Scenario A: Same Sync Credentials

**Team shares one Jira account:**

```bash
# Add to team docs
export JIRA_USERNAME=team-account@company.com
export JIRA_TOKEN=<shared-token>
```

Everyone uses same credentials.

### Scenario B: Individual Credentials

**Each developer has own Jira account:**

```bash
# Each developer sets their own
export JIRA_USERNAME=john@company.com
export JIRA_TOKEN=<john-token>

export JIRA_USERNAME=sarah@company.com
export JIRA_TOKEN=<sarah-token>
```

### Scenario C: No Sync

**Developers work local-only:**

```bash
# No credentials needed
# Just create tickets and commit to git
tract create PROJ --title "Ticket"
git add issues/
git commit -m "Add ticket"
git push
```

## Health Check Commands

### Quick Check

```bash
tract doctor
# Shows: config status, git status, sync status
```

### Detailed Check

```bash
tract config validate
# Validates .tract/config.yaml syntax
# Checks for required fields
# Warns about deprecated options
```

### Repair

```bash
tract config repair
# Fixes common issues:
# - Missing directories (creates issues/, .tract/sprints/)
# - Invalid YAML (reformats)
# - Missing required fields (prompts to add)
```

## Bottom Line

**Existing Tract repo:** Just clone and use. No init needed.

**New repo:** Run `tract onboard` to create `.tract/` structure.

**Health check:** Add `tract doctor` command (nice to have).

**The insight:** Git IS the initialization. If `.tract/config.yaml` exists in the clone, you're initialized.

---

**For Monday:** Document in README that existing repos work immediately. Add `tract doctor` command (Week 1).
