# Sync Requirements & Workflow

**Clarification:** Import has TWO modes - one-time migration vs ongoing sync.

## Two Import Modes

### Mode 1: One-Time Import (Migration to Tract-Only)

**Use case:** "I have 500 Jira tickets. Import them once. Then I'm done with Jira forever."

```bash
tract import \
  --jira https://jira.company.com \
  --project APP \
  --user you@company.com \
  --token <api-token>

# Downloads all tickets
# Does NOT configure ongoing sync
# After this: Tract-only (no Jira)
```

**This is MIGRATION** - grab data from Jira, then pure Tract.

### Mode 2: Ongoing Sync (Bidirectional)

**Use case:** "Keep Jira and Tract in sync. Managers use Jira, developers use Tract."

```yaml
# .tract/config.yaml
jira:
  url: https://jira.company.com
  project: APP
sync:
  enabled: true
```

```bash
tract import  # Uses config, expects ongoing sync
```

**This is INTEGRATION** - parallel Jira + Tract usage.

## Solution: Clear Guards & Messaging

### 1. Early Validation in Import Command

**Current flow:**
```bash
tract import
→ Asks for credentials
→ Reads config
→ ERROR: Jira URL not found
```

**Better flow:**
```bash
tract import
→ Reads config FIRST
→ Checks sync configuration
→ IF not configured:
   ERROR: Sync not configured
   HINT: Run `tract setup-sync` first
→ ELSE: Ask for credentials and proceed
```

### 2. New `doctor` Command

Check project health and configuration:

```bash
tract doctor

Checking Tract configuration...

✓ .tract/config.yaml exists
✓ Project: APP
✗ Sync: NOT CONFIGURED
  → Jira URL: not set
  → Run: tract setup-sync

Capabilities:
  ✓ Create local tickets
  ✓ Log time locally
  ✗ Import from Jira (sync required)
  ✗ Push to Jira (sync required)
```

### 3. Import Command (Two Modes)

```javascript
// commands/import.js
async function importCommand(options) {
  const tractDir = path.resolve(options.tract || '.');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  
  // Two modes:
  // 1. One-time import: --jira flag provided (migration)
  // 2. Ongoing sync: Use config (bidirectional)
  
  let jiraUrl = options.jira || config.jira?.url;
  const projectKey = options.project || config.project;
  
  if (!jiraUrl) {
    console.error(chalk.red('❌ Error: Jira URL required\n'));
    console.error(chalk.yellow('Two ways to import:\n'));
    console.error(chalk.bold('Option 1: One-time import (migration)\n'));
    console.error(chalk.gray('   tract import \\'));
    console.error(chalk.gray('     --jira https://jira.company.com \\'));
    console.error(chalk.gray('     --project APP \\'));
    console.error(chalk.gray('     --user you@company.com \\'));
    console.error(chalk.gray('     --token <token>\n'));
    console.error(chalk.bold('Option 2: Ongoing sync (edit config first)\n'));
    console.error(chalk.gray('   tract import\n'));
    process.exit(1);
  }
  
  const isOneTimeImport = !!options.jira;
  
  if (isOneTimeImport) {
    console.log('📦 One-Time Import (Migration to Tract-only)');
    console.log('No ongoing sync will be configured.\n');
  } else {
    console.log('🔄 Import with Sync Configured\n');
  }
  
  // ... proceed with import
}
```

### 4. Setup-Sync Command (New)

Guided sync configuration for local-only projects:

```bash
tract setup-sync

🔗 Configure Jira Sync

This project is currently local-only.
Enable sync to import/export tickets with Jira.

→ Jira URL? https://jira.company.com
→ Jira project key? APP
→ Test connection? y

✓ Connection successful!

Updated .tract/config.yaml:
  jira:
    url: https://jira.company.com
    project: APP
  sync:
    enabled: true

✅ Sync configured!

Next steps:
  # Set credentials (secure):
  export JIRA_USERNAME=you@company.com
  export JIRA_TOKEN=<your-api-token>
  
  # Import existing tickets:
  tract import
```

### 5. Onboarding Clarity

**Interactive onboarding messages:**

```bash
tract onboard --interactive

→ Setup mode?
   1. Local-only (no sync)
   2. Connect to Jira

[If user chooses "Local-only":]

✅ Local project created!

This is a local-only project. You can:
  ✓ Create tickets (tract create)
  ✓ Log time (tract log)
  ✓ Use git for versioning

To import from Jira later:
  tract setup-sync

[If user chooses "Connect to Jira":]

→ Jira URL? ...
→ Username? ...
→ API token? ...

✓ Connection verified

→ Import existing tickets now? [y/N]

[If yes:] 
  Imports tickets...
  
[If no:]
  ✅ Sync configured!
  
  To import tickets later:
    tract import
```

### 6. Config File Comments

Make it obvious what sync does:

```yaml
# .tract/config.yaml

project: APP

# Jira sync configuration
# Set to enable import/export with Jira
# Leave as null for local-only operation
jira:
  url: null  # Example: https://jira.company.com
  project: APP

sync:
  enabled: false  # Set true when jira.url is configured
  
# When sync is disabled:
#  ✓ You can create tickets locally
#  ✓ You can log time locally
#  ✗ You cannot import from Jira (tract import will fail)
#  ✗ Changes won't sync to Jira
#
# To enable sync:
#  1. Set jira.url above
#  2. Set sync.enabled: true
#  3. Configure credentials (JIRA_USERNAME, JIRA_TOKEN)
#  4. Run: tract import
```

### 7. Command Requirements Matrix

| Command | Local-only | One-Time Import | Ongoing Sync |
|---------|-----------|-----------------|--------------|
| `tract create` | ✅ Works | ✅ Works | ✅ Works + syncs |
| `tract log` | ✅ Works | ✅ Works | ✅ Works + syncs |
| `tract onboard --local` | ✅ Creates | N/A | N/A |
| `tract onboard --jira <url>` | N/A | N/A | ✅ Configures |
| `tract import` (no flags) | ❌ Blocked | N/A | ✅ Works |
| `tract import --jira <url>` | N/A | ✅ Works | ✅ Works |
| `tract setup-sync` | ✅ Configures | N/A | ✅ Reconfigures |
| `tract doctor` | ✅ Shows status | ✅ Shows status | ✅ Shows status |

**Key insight:**
- "Local-only" = Created from scratch, no external data
- "One-time import" = Migrated from Jira, now Tract-only
- "Ongoing sync" = Parallel Jira + Tract usage

### 8. Error Messages (Improved)

**Before:**
```
❌ Error: Jira URL not found in .tract/config.yaml
```

**After:**
```
❌ Error: Jira URL required

Two ways to import:

Option 1: One-time import (migration to Tract-only)
  tract import \
    --jira https://jira.company.com \
    --project APP \
    --user you@company.com \
    --token <token>
  
  Downloads tickets once, no ongoing sync.

Option 2: Ongoing sync (bidirectional)
  1. Edit .tract/config.yaml (add jira.url)
  2. Set credentials
  3. tract import
```

**Terminology:**
- ❌ "Local-only" (wrong - implies no external data at all)
- ✅ "Tract-only" (right - migrated from Jira, now pure Tract)

## Implementation Priority

### Critical (Before Monday Demo)
1. ✅ Import command early validation (check sync before credentials)
2. ✅ Clear error messages with setup instructions
3. ✅ Config file comments explaining sync

### High (Week 1)
4. ⬜ `tract doctor` command (health check)
5. ⬜ `tract setup-sync` command (guided sync setup)
6. ⬜ Onboarding clarity (better messaging for local vs sync mode)

### Medium (Week 2)
7. ⬜ Pre-flight checks for all sync-dependent commands
8. ⬜ Help text updates (man pages, --help output)

## Monday Demo Script

**Show the guard:**

```bash
# 1. Create local-only project
tract onboard --local --project DEMO

# 2. Try to import (should fail gracefully)
tract import

ERROR: Sync not configured
HINT: This is local-only. Run: tract setup-sync

# 3. Show doctor command
tract doctor

✓ Local tickets work
✗ Sync not configured (import unavailable)

# 4. Setup sync (guided)
tract setup-sync
→ Jira URL? https://jira.demo.com
→ Project? DEMO
✓ Configured!

# 5. Now import works
tract import
✓ Imported 42 tickets
```

**Key message:** "Tract works offline-first. Sync is optional but required for import/export."

---

**Bottom line:** Make it impossible to get into confusing state. Check sync config early, fail fast with helpful messages, guide users to solution.
