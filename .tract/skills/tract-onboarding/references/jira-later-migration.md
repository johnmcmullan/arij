# Adding Jira Sync After Local-Only Setup

How to migrate from local-only to Jira sync.

## Scenario

You onboarded with `--local` and now want to connect to Jira.

**Starting point:**
- `.tract/config.yaml` has no Jira URL
- You have local tickets in `issues/`
- You have local time logs in `worklogs/`

**Goal:**
- Connect to Jira
- Import existing Jira tickets
- Start bidirectional sync

## Migration Steps

### Step 1: Update Configuration

Edit `.tract/config.yaml` to add Jira settings:

**Before:**
```yaml
project: APP
jira:
  url: null
  project: APP

sync:
  enabled: false
```

**After:**
```yaml
project: APP
jira:
  url: https://jira.company.com
  project: APP

sync:
  enabled: true
```

**Commit:**
```bash
git add .tract/config.yaml
git commit -m "Add Jira configuration"
```

### Step 2: Set Credentials

```bash
export JIRA_USERNAME=john.mcmullan
export JIRA_TOKEN=your-api-token

# Make permanent (optional):
echo 'export JIRA_USERNAME=john.mcmullan' >> ~/.bashrc
echo 'export JIRA_TOKEN=your-api-token' >> ~/.bashrc
```

### Step 3: Import Jira Tickets

Fetch metadata and import existing tickets:

```bash
tract import --status open
```

**What this does:**
- Connects to Jira
- Fetches project metadata (types, statuses, components, etc.)
- Imports all open tickets
- Creates markdown files in `issues/`
- Commits to git

**Options:**
```bash
# Import all tickets (not just open)
tract import --status all

# Import specific status
tract import --status "in-progress"

# Limit for testing
tract import --status open --limit 50

# Custom JQL
tract import --jql "project=APP AND priority=critical"
```

### Step 4: Configure Sync Server

Set the sync server URL:

```bash
export TRACT_SYNC_SERVER=http://tract-server:3100

# Make permanent:
echo 'export TRACT_SYNC_SERVER=http://tract-server:3100' >> ~/.bashrc
```

### Step 5: Verify Sync

```bash
# Check connectivity
curl $TRACT_SYNC_SERVER/health

# Run diagnostics
tract doctor

# Should show:
# ✓ Jira configured
# ✓ Sync server reachable
```

### Step 6: Test Bidirectional Sync

**Test Tract → Jira:**
```bash
# Edit a ticket locally
vim issues/APP-1234.md
# Change status: backlog → in-progress

# Commit and push
git add issues/APP-1234.md
git commit -m "Update APP-1234: Start work"
git push

# Check Jira - status should update
```

**Test Jira → Tract:**
```bash
# Edit ticket in Jira web UI (change assignee, add comment, etc.)

# Pull changes
git pull

# Should see: [tract-sync] Updated APP-1234 from Jira
```

## Handling Conflicts

### Tickets That Exist Locally and in Jira

**Scenario:**
- You created APP-1234 locally
- APP-1234 also exists in Jira (created by someone else)

**Resolution:**
- During import, tract detects duplicate by ID
- **Option 1:** Keep local (default) - Jira version ignored
- **Option 2:** Overwrite with Jira - delete local first

**Manual override:**
```bash
# Delete local ticket before import
rm issues/APP-1234.md

# Then import
tract import --status open

# Jira version imported
```

### Time Logs

**Scenario:**
- You logged time locally in `worklogs/`
- Want those logs in Jira

**Solution:**
```bash
# Push time logs to Jira
git push

# Sync server processes worklogs
# Posts to Jira via API
```

**Note:** Local time logs sync to Jira automatically on next push if sync server is configured.

## Common Questions

### Will my local tickets sync to Jira?

**Yes**, when you push:
1. Local tickets commit to git
2. Sync server detects changes
3. Creates corresponding Jira issues
4. Links them by ID

### What about tickets I deleted locally?

**Not synced.** Deletions don't propagate to Jira (safety feature).

If you want to remove from Jira too:
1. Delete in Jira web UI manually
2. Or: Mark as `resolution: wontfix` locally and sync

### Can I go back to local-only?

**Yes:**

1. Edit `.tract/config.yaml`:
   ```yaml
   sync:
     enabled: false
   ```
2. Unset `TRACT_SYNC_SERVER`
3. Continue working locally

Git history and tickets remain. Sync just stops.

### What if I change my mind about the project key?

**Hard to change.** Project key is embedded in ticket IDs (APP-1234).

**Options:**
1. Keep the key (easiest)
2. Start fresh with new key
3. Write migration script to rename all files and update IDs (advanced)

## Migration Checklist

- [ ] Update `.tract/config.yaml` with Jira URL
- [ ] Set `JIRA_USERNAME` and `JIRA_TOKEN` env vars
- [ ] Run `tract import --status open`
- [ ] Verify imported tickets: `ls issues/`
- [ ] Set `TRACT_SYNC_SERVER` env var
- [ ] Test sync: edit ticket locally, push, check Jira
- [ ] Test reverse: edit in Jira, pull, check local
- [ ] Run `tract doctor` - should show all green

## Rollback (If Something Goes Wrong)

**If import fails or creates duplicates:**

```bash
# Revert to before import
git log --oneline | head -20
# Find commit before import

git reset --hard <commit-before-import>

# Try again with different options
tract import --status open --limit 10  # Test with small batch
```

## Example Migration Session

```bash
# Starting point: local-only project
cd ~/work/app-tickets

# Update config
vim .tract/config.yaml
# Add Jira URL, enable sync

git commit -am "Add Jira configuration"

# Set credentials
export JIRA_USERNAME=john.mcmullan
export JIRA_TOKEN=ghp_xxxxx

# Import open tickets
tract import --status open
# Importing... 234 tickets found
# Created: APP-1 through APP-234
# Committed to git

# Set sync server
export TRACT_SYNC_SERVER=http://tract-server:3100

# Verify
tract doctor
# ✓ Jira configured (https://jira.company.com)
# ✓ Sync server reachable
# ✅ All checks passed

# Test sync
vim issues/APP-1.md
# Change status: backlog → in-progress

git commit -am "Update APP-1: Start work"
git push

# Check Jira - should see status change

# Done! Now working with bidirectional sync.
```

## Future: One-Command Migration

**Vision (not yet implemented):**

```bash
tract configure-jira \
  --url https://jira.company.com \
  --import open \
  --sync-server http://tract-server:3100
```

Would:
1. Update config
2. Import tickets
3. Enable sync
4. Verify connectivity
5. Guide next steps

For now: manual steps above.

## Summary

**Adding Jira later is fully supported:**
1. Edit config
2. Set credentials
3. Run `tract import`
4. Enable sync server
5. Verify

**No data loss.** Local tickets and time logs sync to Jira.

**Reversible.** Can disable sync anytime.

**Best practice:** Start local-only, add Jira when ready. Don't overthink it upfront.
