# Tract Sync Service

Bidirectional synchronization between Tract (Git markdown) and Jira.

## Architecture

```
Tract Repo (Git) ←→ Sync Service ←→ Jira
                   (Node.js/Express)
```

**Git → Jira:**
- Post-receive hook detects changes to `issues/*.md`
- Parses frontmatter + comments to detect what changed
- Updates Jira via REST API (status, assignee, comments, etc.)

**Jira → Git:**
- Jira webhook posts events to sync service
- Service creates/updates markdown files
- Auto-commits to git with `[tract-sync]` marker

**Loop Prevention:**
- Git commits from sync user are ignored by Jira webhook handler
- Jira updates by sync user are ignored by git hook
- `[tract-sync]` marker in commit messages and comments

## Installation

### Server Installation (One-time Setup)

**For setting up the sync service on your server:**

```bash
# Download the installer
wget https://raw.githubusercontent.com/johnmcmullan/tract/master/tract-sync/install-service.sh

# Review the script (important!)
less install-service.sh

# Run the installer (creates user, installs service)
chmod +x install-service.sh
sudo ./install-service.sh APP

# The script will:
# - Create tract user (UID 751)
# - Install tract CLI
# - Run tract onboard to fetch from Jira
# - Set up bare git repository
# - Install systemd service
# - Start bidirectional sync
```

**For multiple projects:**
```bash
sudo ./install-service.sh APP
sudo ./install-service.sh TB
sudo ./install-service.sh PRD
```

### Development Installation (Manual Setup)

**If you want to run the sync service manually for testing:**

```bash
cd ~/work/tract/tract-sync
npm install
```

## Configuration

**After running install-service.sh**, configuration is stored in:
```
/opt/tract/config/app.env      # For APP project
/opt/tract/config/tb.env       # For TB project
/opt/tract/config/prd.env      # For PRD project
```

**Manual configuration** (if not using install script):

Set environment variables:

```bash
export JIRA_URL="https://jira.orcsoftware.com"
export JIRA_USERNAME="your-username"
export JIRA_PASSWORD="your-password-or-token"
export TRACT_REPO_PATH="/path/to/tract/repo"
export SYNC_USER="tract-sync"
export SYNC_EMAIL="tract-sync@localhost"
export PORT=3000
export WEBHOOK_SECRET="optional-secret-for-jira-webhook"
```

Or create `.env` file:

```bash
cat > .env << EOF
JIRA_URL=https://jira.orcsoftware.com
JIRA_USERNAME=john.mcmullan
JIRA_PASSWORD=your-token
TRACT_REPO_PATH=/home/john.mcmullan/work/apps/tickets
SYNC_USER=tract-sync
SYNC_EMAIL=tract-sync@localhost
PORT=3000
EOF
```

## Running

**After install-service.sh** (recommended):
```bash
# Service is already running!
systemctl status tract-sync@app.service
journalctl -u tract-sync@app.service -f

# Manage services
sudo systemctl restart tract-sync@app.service
sudo systemctl stop tract-sync@app.service
```

**Manual development mode:**
```bash
npm run dev
```

**Manual production mode:**
```bash
npm start
```

## Git Hook Setup

Install post-receive hook in your git remote:

```bash
# On your git server
cp hooks/post-receive /path/to/repo.git/hooks/post-receive
chmod +x /path/to/repo.git/hooks/post-receive

# Configure sync URL
export TRACT_SYNC_URL="http://localhost:3000/webhook/git"
```

Or add to hook:

```bash
#!/bin/bash
TRACT_SYNC_URL="http://your-sync-server:3000/webhook/git"
# ... rest of hook
```

## Jira Webhook Setup

1. Go to Jira → Settings → System → WebHooks
2. Create webhook:
   - **Name:** Tract Sync
   - **URL:** `http://your-sync-server:3000/webhook/jira`
   - **Events:** Issue created, updated, deleted; Comment created, updated
   - **JQL Filter:** `project = APP` (or your project)

3. Optional: Add webhook secret for security
   - Set `WEBHOOK_SECRET` in sync service config
   - Configure same secret in Jira webhook

## Usage

### Automatic Sync

Once configured, sync happens automatically:

**Editing in Tract (Git):**
```bash
# Edit ticket
vim issues/APP-1234.md

# Change status to "In Progress"
# Add a comment
# Change assignee

# Commit and push
git commit -am "Update APP-1234"
git push

# → Post-receive hook syncs to Jira automatically
```

**Editing in Jira:**
```
User edits APP-1234 in Jira web UI
→ Jira webhook fires
→ Sync service updates issues/APP-1234.md
→ Auto-commits to git
→ Other users pull and see changes
```

### Manual Sync

For testing or one-off syncs:

```bash
# Sync specific ticket from Git to Jira
curl -X POST http://localhost:3000/sync/git-to-jira/APP-1234

# Check service health
curl http://localhost:3000/health
```

## What Gets Synced

**Git → Jira:**
- ✅ Status changes (via transitions)
- ✅ Assignee changes
- ✅ Priority changes
- ✅ Labels
- ✅ Components
- ✅ Description edits
- ✅ New comments

**Jira → Git:**
- ✅ New issues created
- ✅ Issue updates (all fields)
- ✅ New comments
- ✅ Status transitions
- ✅ Assignee changes

**Not Synced:**
- ❌ File attachments (Tract uses links to /tb/shared)
- ❌ Jira workflows (Tract is simpler)
- ❌ Custom fields (only standard fields)
- ❌ Issue links (future enhancement)

## Conflict Resolution

**Strategy: Last Write Wins**

If both Git and Jira are edited simultaneously:
- Jira → Git sync happens immediately (webhook)
- Git → Jira sync happens on push
- Later push overwrites earlier change
- No merge conflicts (markdown files are regenerated)

**Future:** Could add conflict detection and manual resolution workflow.

## Monitoring

**Logs:**
```bash
# View sync logs
journalctl -u tract-sync -f

# Check recent syncs
tail -f /var/log/tract-sync.log
```

**Metrics to watch:**
- Webhook latency
- Failed syncs
- Loopback events (should be ~50% of total)
- Git commit rate vs Jira update rate

## Troubleshooting

**Sync not working:**
1. Check service is running: `systemctl status tract-sync`
2. Check logs: `journalctl -u tract-sync -n 100`
3. Test webhook manually: `curl -X POST http://localhost:3000/webhook/git -d '{"changedFiles":[]}'`
4. Verify Jira credentials: `curl -u username:password https://jira.orcsoftware.com/rest/api/2/myself`

**Infinite loops:**
- Check `[tract-sync]` marker is in commit messages
- Verify sync user name matches `SYNC_USER` config
- Check loopback detection in logs

**Permission errors:**
- Verify Jira credentials have edit permissions
- Check git repo is writable by sync service user
- Verify systemd service runs as correct user

## Development

**Project structure:**
```
tract-sync/
├── server.js                 # Express server + webhooks
├── lib/
│   ├── git-to-jira-sync.js  # Git → Jira sync logic
│   └── jira-to-git-sync.js  # Jira → Git sync logic
├── hooks/
│   └── post-receive         # Git hook template
├── systemd/
│   └── tract-sync.service   # Systemd service
└── README.md
```

**Testing:**
```bash
# Test Git → Jira sync
node -e "
const GitToJiraSync = require('./lib/git-to-jira-sync');
const sync = new GitToJiraSync({...config});
// Test parsing, change detection, etc.
"

# Test Jira → Git sync
node -e "
const JiraToGitSync = require('./lib/jira-to-git-sync');
const sync = new JiraToGitSync({...config});
// Test markdown conversion, git commits, etc.
"
```

## Deployment Strategy

**Phase 1: Git → Jira only (1 week)**
- Install sync service
- Configure git post-receive hook
- Test: Edit Tract tickets → Updates appear in Jira
- Jira remains source of truth

**Phase 2: Bidirectional (1 week)**
- Configure Jira webhook
- Test: Edit Jira → Updates appear in Git
- Monitor for loops and conflicts

**Phase 3: Gradual adoption (1-2 months)**
- Early adopters use Copilot CLI + Tract
- Everyone else uses Jira
- Both stay in sync automatically
- Monitor Jira usage metrics

**Phase 4: Decommission Jira**
- When Jira usage → 0, turn off sync
- Cancel Jira subscription
- Keep Tract as single source of truth

## License

MIT
