---
name: tract-server
description: Install and manage Tract server infrastructure — tract-sync (Jira daemon) and tract-catalog (project discovery). Use when setting up a new server, adding a Jira account, troubleshooting services, or configuring webhooks.
metadata:
  author: tract
  requires: sudo, systemd, Node.js 18+
---

# Tract Server Skill

## Purpose

Install, configure, and maintain the server-side components of Tract:

- **tract-sync** — bidirectional Jira sync daemon. Watches ticket repos for git changes and pushes them to Jira. Receives Jira webhooks and commits them back to git.
- **tract-catalog** — project discovery and CLI update server. Tells `tract clone` what repos exist and serves `tract update` packages.

Both run as the `tract` system user under systemd.

## When to Use This Skill

- Setting up Tract on a server for the first time
- Adding a new Jira project or account to an existing installation
- Troubleshooting sync failures or webhook issues
- Rotating Jira credentials
- Updating tract to a new version on the server

## Architecture

```
Developer machine                    Server
─────────────────                    ──────
tract CLI ──git push──────────────→  ticket repo (bare)
                                          │
                                     tract-sync watches
                                          │
                                          ↓
                                     Jira REST API
                                          │
                                     Jira webhook ──→ tract-sync /webhook
                                          │
                                     git commit + push
                                          ↓
Developer ←──git pull────────────── ticket repo (bare)

tract catalog list/clone ──────────→ tract-catalog :3200
tract update ──────────────────────→ tract-catalog :3200/tract-cli.tgz
```

## Initial Server Setup

Run the canonical setup script as root:

```bash
# Clone the repo first (or copy the script)
curl -fsSL https://raw.githubusercontent.com/johnmcmullan/tract/master/scripts/server-setup \
  | sudo bash

# Or interactively:
git clone https://github.com/johnmcmullan/tract.git /tmp/tract
sudo bash /tmp/tract/scripts/server-setup
```

The script is idempotent — safe to re-run.

**What it does:**
1. Creates `tract` system user (nologin shell)
2. Clones/updates the tract repo to `/opt/tract`
3. Installs npm dependencies for tract-sync and tract-catalog
4. Writes environment config to `/etc/tract/env` (mode 640, root:tract)
5. Writes systemd unit files for both services
6. Enables and starts services
7. Prints next steps (webhook URL, developer onboarding command)

**Environment variables (override defaults):**

| Variable | Default | Description |
|----------|---------|-------------|
| `TRACT_USER` | `tract` | System user |
| `TRACT_HOME` | `/opt/tract` | Install directory |
| `SYNC_PORT` | `3100` | tract-sync port |
| `CATALOG_PORT` | `3200` | tract-catalog port |
| `TICKETS_ROOT` | `/opt/tract/tickets` | Where ticket repos live |
| `TRACT_JIRA_URL` | *(prompted)* | Jira instance URL |
| `TRACT_JIRA_USER` | *(prompted)* | Jira service account |
| `TRACT_JIRA_TOKEN` | *(prompted)* | Jira API token |

Non-interactive example:
```bash
sudo TRACT_JIRA_URL=https://jira.company.com \
     TRACT_JIRA_USER=tract-bot \
     TRACT_JIRA_TOKEN=ATATT3x... \
     bash scripts/server-setup
```

## Adding a New Jira Account or Project

1. **Edit the environment file** to add or change credentials:
   ```bash
   sudo nano /etc/tract/env
   systemctl restart tract-sync
   ```

2. **Create the ticket repo** for the new project:
   ```bash
   sudo -u tract git init --bare /opt/tract/tickets/NEW-PROJECT.git
   ```

3. **Ask the Jira admin** to add the project key to the webhook filter (if using a single webhook for multiple projects).

4. **Developer onboarding** — they run:
   ```bash
   tract clone NEW-PROJECT
   tract doctor
   ```

## Webhook Configuration

After the server is running, a Jira admin must create the webhook. Jira → Settings → System → Webhooks → Create:

| Field | Value |
|-------|-------|
| URL | `http://<server>:3100/webhook` |
| Events | Issue Created, Issue Updated, Issue Deleted, Comment Created |
| JQL filter | `project in (APP, OPS, ...)` *(optional — limits to specific projects)* |

To test the webhook is working:
```bash
curl -s http://localhost:3100/health
journalctl -u tract-sync -n 50
```

## Routine Operations

**Check service status:**
```bash
systemctl status tract-sync tract-catalog
journalctl -u tract-sync -f          # live logs
journalctl -u tract-catalog -f
```

**Update tract to latest version:**
```bash
sudo -u tract git -C /opt/tract pull --ff-only
(cd /opt/tract/tract-sync    && sudo -u tract npm install --omit=dev)
(cd /opt/tract/tract-catalog && sudo -u tract npm install --omit=dev)
sudo systemctl restart tract-sync tract-catalog
```

**Rotate Jira credentials:**
```bash
sudo nano /etc/tract/env          # update JIRA_TOKEN
sudo systemctl restart tract-sync
journalctl -u tract-sync -n 20    # confirm no auth errors
```

**Force re-sync a specific ticket:**
```bash
# Edit the ticket file, commit, push — tract-sync will pick it up
sudo -u tract git -C /opt/tract/tickets/APP.git log --oneline -5
```

## Troubleshooting

**tract-sync fails to start:**
```bash
journalctl -u tract-sync -n 50 --no-pager
# Check: node version, JIRA_URL reachable, token valid
node --version               # needs 18+
curl -u user:token https://jira.company.com/rest/api/2/myself
```

**Webhook not firing:**
- Check Jira webhook logs: Jira → Settings → System → Webhooks → (click webhook) → Recent Deliveries
- Check the server is reachable from Jira's network
- Check `journalctl -u tract-sync | grep webhook`

**Tickets not syncing to Jira:**
- Check tract-sync logs for the specific ticket ID
- Verify the ticket's project key matches what's configured
- Check Jira rate limits (look for 429 errors in logs)

**tract-catalog not serving packages:**
```bash
curl http://localhost:3200/version
ls -la /opt/tract/tract-cli/  # confirm CLI is present
```

## Security Notes

- `/etc/tract/env` is readable only by root and the `tract` user (mode 640)
- The `tract` user has no login shell — cannot be used interactively
- Both services bind to all interfaces by default — put nginx in front for external access
- Nginx can handle TLS termination and SSO (X-Forwarded-User header for identity)

## Developer Onboarding (after server is set up)

Tell developers to run:
```bash
tract catalog set http://<server>:3200
tract clone <PROJECT>
tract doctor
```

That's it. `tract clone` fetches the repo and dependencies. `tract doctor` verifies everything is wired up correctly.
