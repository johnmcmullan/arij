# Sync Requirements & Workflow

**Problem:** Users try to import tickets before sync is configured, get confusing errors.

## Current Issues

1. **import command errors late** - Asks for credentials, then fails with "Jira URL not found"
2. **Onboarding flow unclear** - Local-only mode mentions importing (but skips it)
3. **No clear guard** - Nothing prevents `tract import` without sync configured

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

### 3. Import Command Guard

```javascript
// commands/import.js
async function importCommand(options) {
  const tractDir = path.resolve(options.tract || '.');
  
  // Load config FIRST
  const configPath = path.join(tractDir, '.tract', 'config.yaml');
  if (!fs.existsSync(configPath)) {
    console.error(chalk.red(`❌ Error: .tract/config.yaml not found`));
    console.error(chalk.yellow('   Run: tract onboard'));
    process.exit(1);
  }

  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  
  // Check sync configuration EARLY
  const jiraUrl = config.jira?.url;
  const syncEnabled = config.sync?.enabled !== false; // Default true if not set
  
  if (!jiraUrl || jiraUrl === 'null') {
    console.error(chalk.red('❌ Error: Sync not configured'));
    console.error(chalk.yellow('\nThis is a local-only Tract project.'));
    console.error(chalk.yellow('To import from Jira, you need to configure sync first.\n'));
    console.error(chalk.bold('Steps to enable sync:\n'));
    console.error(chalk.gray('1. Edit .tract/config.yaml'));
    console.error(chalk.gray('   jira:'));
    console.error(chalk.gray('     url: https://jira.company.com'));
    console.error(chalk.gray('     project: APP'));
    console.error(chalk.gray(''));
    console.error(chalk.gray('2. Set credentials (one of):'));
    console.error(chalk.gray('   export JIRA_USERNAME=you@company.com'));
    console.error(chalk.gray('   export JIRA_TOKEN=<api-token>'));
    console.error(chalk.gray(''));
    console.error(chalk.gray('3. Try import again:'));
    console.error(chalk.gray('   tract import'));
    console.error(chalk.gray(''));
    console.error(chalk.yellow('Or use: tract setup-sync (guided setup)\n'));
    process.exit(1);
  }
  
  // NOW ask for credentials (we know sync is configured)
  const username = options.user || process.env.JIRA_USERNAME;
  const password = options.password || process.env.JIRA_PASSWORD;
  const token = options.token || process.env.JIRA_TOKEN;

  if (!username || !(password || token)) {
    console.error(chalk.red('❌ Error: Jira credentials required'));
    console.error(chalk.yellow('   Set JIRA_USERNAME and JIRA_TOKEN environment variables'));
    console.error(chalk.yellow('   Or use --user and --token options'));
    process.exit(1);
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

| Command | Local-only | Sync Required |
|---------|-----------|---------------|
| `tract create` | ✅ Works | ✅ Works + syncs |
| `tract log` | ✅ Works | ✅ Works + syncs |
| `tract onboard --local` | ✅ Works | N/A |
| `tract onboard --jira <url>` | N/A | ✅ Configures |
| `tract import` | ❌ Blocked | ✅ Works |
| `tract setup-sync` | ✅ Configures | ✅ Reconfigures |
| `tract doctor` | ✅ Shows status | ✅ Shows status |

### 8. Error Messages (Improved)

**Before:**
```
❌ Error: Jira URL not found in .tract/config.yaml
```

**After:**
```
❌ Error: Sync not configured

This is a local-only Tract project.
To import from Jira, configure sync first:

  tract setup-sync

Or manually edit .tract/config.yaml:
  jira:
    url: https://jira.company.com
    project: APP

Then retry:
  tract import
```

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
