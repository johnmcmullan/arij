# Tract Onboarding Checklist

Use this checklist to onboard a new Tract project. Copy it, check off steps as you go.

## Prerequisites

- [ ] Git installed on server
- [ ] Node.js 16+ installed on server
- [ ] SSH access to server
- [ ] Jira instance accessible
- [ ] Jira project created (e.g., APP, TB, PRD)
- [ ] Jira user with API access
- [ ] Jira API token generated

## Server Setup (One-Time, Admin Only)

### 1. Install Tract Sync Service

- [ ] SSH to server: `ssh your-server`
- [ ] Download installer:
  ```bash
  wget https://raw.githubusercontent.com/johnmcmullan/tract/master/tract-sync/install-service.sh
  ```
- [ ] Review installer (security!):
  ```bash
  less install-service.sh
  ```
- [ ] Run installer:
  ```bash
  chmod +x install-service.sh
  sudo ./install-service.sh APP  # Replace APP with your project key
  ```

**What the installer does:**
- Creates `tract` system user (UID 751, no login shell)
- Installs Tract CLI globally
- Runs `tract onboard` to fetch Jira project metadata
- Creates bare git repository at `/opt/tract/git/app-tickets.git`
- Sets up systemd service `tract-sync@app.service`
- Starts bidirectional sync

### 2. Verify Service

- [ ] Check service is running:
  ```bash
  systemctl status tract-sync@app.service
  ```
- [ ] Check health endpoint:
  ```bash
  curl http://localhost:3100/health
  ```
  Expected: `{"status":"ok","project":"APP",...}`

- [ ] Check logs:
  ```bash
  journalctl -u tract-sync@app.service -n 50
  ```

### 3. Configure Jira Webhook (Jira → Git Sync)

- [ ] Go to Jira → Settings → System → WebHooks
- [ ] Create webhook:
  - **Name:** Tract Sync
  - **URL:** `http://your-server:3100/webhook/jira`
  - **Events:** Issue created, updated, deleted; Comment created, updated
  - **JQL Filter:** `project = APP` (match your project)
- [ ] Save webhook
- [ ] Test it: Edit a Jira ticket and watch logs:
  ```bash
  journalctl -u tract-sync@app.service -f
  ```

### 4. Set Up Git Remote

- [ ] Note the git remote URL:
  ```
  ssh://git@your-server/opt/tract/git/app-tickets.git
  ```
  Or configure `~/.ssh/config` alias:
  ```
  Host tract-server
    HostName your-server.com
    User git
  ```
  Then use: `ssh://tract-server/opt/tract/git/app-tickets.git`

## Developer Setup (Each Developer)

### 1. Install Tract CLI

- [ ] Install globally:
  ```bash
  npm install -g @tract/cli
  ```
- [ ] Verify installation:
  ```bash
  tract --version
  tract doctor
  ```

### 2. Clone Ticket Repository

- [ ] Clone the repo:
  ```bash
  git clone ssh://git@your-server/opt/tract/git/app-tickets.git
  cd app-tickets
  ```
  
  **Or as a submodule in your code repo:**
  ```bash
  cd ~/code/my-app
  git submodule add ssh://git@your-server/opt/tract/git/app-tickets.git tickets
  cd tickets
  ```

- [ ] Run health check:
  ```bash
  tract doctor
  ```

### 3. Configure Environment

- [ ] Set sync server URL:
  ```bash
  export TRACT_SYNC_SERVER=http://your-server:3100
  ```
- [ ] Add to shell config (`~/.bashrc` or `~/.zshrc`):
  ```bash
  echo 'export TRACT_SYNC_SERVER=http://your-server:3100' >> ~/.bashrc
  ```

### 4. Test It Works

- [ ] Create a test ticket:
  ```bash
  tract create APP --title "Test ticket" --type task
  ```
- [ ] Check it appears in Jira
- [ ] Edit ticket in Jira
- [ ] Pull changes:
  ```bash
  git pull
  ```
- [ ] Verify changes appear in `issues/APP-XXXX.md`
- [ ] Log some time:
  ```bash
  tract log APP-XXXX 30m "Testing timesheet"
  ```
- [ ] Check your timesheet:
  ```bash
  tract timesheet
  ```
- [ ] Verify worklog appears in Jira

### 5. Configure Git User (If Not Already)

- [ ] Set git user:
  ```bash
  git config user.name "Your Name"
  git config user.email "you@company.com"
  ```

## Optional: LLM Integration

### For GitHub Copilot CLI

- [ ] Install Copilot CLI:
  ```bash
  npm install -g @githubnext/github-copilot-cli
  ```
- [ ] Train it on Tract:
  - Include `.tract/SCHEMA.md` in your workspace
  - Ask Copilot to create tickets, log time, etc.

### For Cursor / Other LLM Tools

- [ ] Open `.tract/SCHEMA.md` in editor
- [ ] Point LLM to it: "Read SCHEMA.md and help me manage tickets"
- [ ] Test: "Create a ticket for fixing the login bug"

## Verification Checklist

- [ ] Server: systemd service running
- [ ] Server: Health endpoint returns 200
- [ ] Server: Git repo initialized and accessible
- [ ] Jira: Webhook configured and firing
- [ ] Developer: CLI installed and working
- [ ] Developer: Can clone ticket repo
- [ ] Developer: Can create tickets (→ sync to Jira)
- [ ] Developer: Can edit Jira (→ sync to Git)
- [ ] Developer: Can log time
- [ ] Developer: Timesheet shows entries

## Common Issues

### Service won't start

**Check:**
```bash
journalctl -u tract-sync@app.service -n 100
```

**Common causes:**
- Missing environment variables in `/opt/tract/config/app.env`
- Jira credentials invalid
- Port 3100 already in use
- Git repo permissions wrong

**Fix:**
```bash
# Check config
cat /opt/tract/config/app.env

# Test Jira credentials
curl -u username:token https://jira.company.com/rest/api/2/myself

# Check port
netstat -tuln | grep 3100

# Fix permissions
sudo chown -R tract:tract /opt/tract/git/app-tickets.git
```

### Webhook not firing

**Check:**
- Jira webhook URL is correct (http://<server>:3100/webhook/jira)
- Server is reachable from Jira (check firewalls/network)
- Webhook events are configured (issue created/updated/deleted)
- JQL filter matches your tickets

**Test manually:**
```bash
curl -X POST http://localhost:3100/webhook/jira \
  -H "Content-Type: application/json" \
  -d '{"webhookEvent":"jira:issue_updated","issue":{"key":"APP-1"}}'
```

### Developers can't clone

**Check:**
- SSH access to server works: `ssh git@your-server`
- Git repo path is correct: `/opt/tract/git/app-tickets.git`
- Permissions allow read: `ls -la /opt/tract/git/`

**Fix:**
```bash
# Allow git user to read repo
sudo chmod -R g+r /opt/tract/git/app-tickets.git
sudo chown -R tract:git /opt/tract/git/app-tickets.git
```

### Sync loops (infinite commits)

**Check logs for:**
- Commits from sync user not being ignored
- Missing `[tract-sync]` marker

**Fix:**
- Verify `SYNC_USER=tract-sync` in config
- Check git commits include `[tract-sync]` marker
- Verify Jira webhook checks for sync user updates

### Time not syncing to Jira

**Check:**
- Jira user has worklog permissions
- Ticket exists in Jira
- Worklog API endpoint accessible

**Test manually:**
```bash
# Check ticket exists
curl -u user:token https://jira.company.com/rest/api/2/issue/APP-1234

# Check worklog permissions
curl -u user:token https://jira.company.com/rest/api/2/issue/APP-1234/worklog
```

## Success Criteria

✅ **Server healthy:** Service running, webhooks configured
✅ **Developers happy:** CLI works, no friction
✅ **Sync working:** Bidirectional sync, no loops
✅ **Managers unblocked:** Can still use Jira normally
✅ **Time tracking works:** Worklogs appear in Jira

## Next Steps

Once everything works:

1. **Onboard more developers** - Share clone instructions
2. **Import historical tickets** - Run `tract import` to backfill
3. **Monitor for a week** - Watch logs, fix issues
4. **Train the team** - Show them `tract create`, `tract log`
5. **Integrate with LLMs** - Point AI tools at `.tract/SCHEMA.md`

## Rollback Plan

If things go wrong:

1. **Stop the service:**
   ```bash
   sudo systemctl stop tract-sync@app.service
   ```

2. **Keep using Jira normally** - Nothing breaks

3. **Debug and fix** - Check logs, run `tract doctor`

4. **Restart when ready:**
   ```bash
   sudo systemctl start tract-sync@app.service
   ```

The beauty of bidirectional sync: **you can always fall back to Jira**.

---

**Questions? Issues?**
- Run `tract doctor` for diagnostics
- Check logs: `journalctl -u tract-sync -n 100`
- Read docs: `.tract/SCHEMA.md` and `tract-sync/README.md`
