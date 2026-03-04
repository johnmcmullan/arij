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
- Running field detection for a new project

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
3. Installs npm dependencies for tract-catalog; tract-sync is a compiled Rust binary at `/opt/tract/bin/tract-sync-daemon`
4. Writes environment config to `/etc/tract-sync/env` (mode 600, tract:tract)
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
   sudo nano /etc/tract-sync/env
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
sudo -u tract git -C /opt/tract/.tract-cli reset --hard origin/master
(cd /opt/tract/tract-catalog && sudo -u tract npm install --omit=dev)
sudo systemctl restart tract-sync tract-catalog
```

**Rotate Jira credentials:**
```bash
sudo nano /etc/tract-sync/env     # update JIRA_API_TOKEN (no JIRA_USERNAME — token-only Bearer auth)
sudo systemctl restart tract-sync
journalctl -u tract-sync -n 20    # confirm no auth errors
```

**Force re-sync a specific ticket:**
```bash
# Edit the ticket file, commit, push — tract-sync will pick it up
sudo -u tract git -C /opt/tract/tickets/APP.git log --oneline -5
```

**Pack a project repo (run periodically or when clone is slow):**

Sync commits accumulate millions of loose objects over time. Run `git gc` to pack them:
```bash
sudo -u tract git -C /opt/tract/APP gc --aggressive --prune=now
# Takes a few minutes; dramatically reduces object count and clone time
```

Each project's post-full-sync hook runs `git gc --auto` which handles routine packing.
For a manual full repack of all projects:
```bash
for p in APP TB PRD SPRJ; do
  echo "=== $p ===" && sudo -u tract git -C /opt/tract/$p gc --aggressive --prune=now
done
```

Note: `tract clone` uses `--depth 1` (shallow) by default so developers get a fast snapshot regardless of server-side object count. Server-side gc still matters for storage and push performance.

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

- `/etc/tract-sync/env` is readable only by the `tract` user (owner: tract:tract, mode 600)
- `/etc/tract-sync/fields.yaml` — instance-wide custom field mappings (owner: tract:tract, mode 600)
- The `tract` user has no login shell — cannot be used interactively
- Both services bind to all interfaces by default — put nginx in front for external access
- Nginx can handle TLS termination and SSO (X-Forwarded-User header for identity)
- **SAIS AI proxy credentials** (for `tract detect-fields`) are stored in `/opt/tract/.env` and sourced by the tract user's `~/.bashrc`. Required vars: `SAIS_URL`, `SAIS_ID_URL`, `CLIENT_ID`, `CLIENT_SECRET`.

## Field Detection Workflow

New projects are created with a `.tract/.pending-field-detection` sentinel that blocks the daemon from syncing until Jira custom fields are mapped. Run as the `tract` user (or any user with access to `/etc/tract-sync/`):

```bash
# From /opt/tract the project subdir is auto-detected:
sudo -u tract tract detect-fields PRD           # AI analysis → writes /etc/tract-sync/fields.yaml
sudo -u tract tract detect-fields PRD --reuse   # re-analyse without re-fetching (optional)
sudo -u tract tract accept-mappings PRD         # remove sentinel → sync starts
```

`tract detect-fields` reads Jira credentials from `/etc/tract-sync/env` automatically (no `--user`/`--token` needed on the server). After `accept-mappings` removes the sentinel the daemon picks up the project on its next poll cycle.

**Key files involved:**
- `/etc/tract-sync/fields.yaml` — instance-wide field mappings written by `detect-fields`
- `/opt/tract/<KEY>/.tract/.pending-field-detection` — sentinel; deleted by `accept-mappings`
- `/opt/tract/<KEY>/.tract/detect-fields-payload.json` — cached Jira sample; deleted by `accept-mappings` (unless `--keep-payload`)

## Server File Inventory

| Path | Description |
|------|-------------|
| `/opt/tract/bin/tract-sync-daemon` | Compiled Rust sync binary |
| `/opt/tract/.tract-cli/` | Tract CLI installation |
| `/opt/tract/<KEY>/` | Per-project git repo (APP, TB, PRD, SPRJ, …) |
| `/opt/tract/<KEY>/.tract/config.yaml` | Per-project Jira config |
| `/opt/tract/<KEY>/.tract/hooks/post-full-sync` | Optional post-sync hook (TB has `git gc --auto`) |
| `/opt/tract/.env` | SAIS AI proxy credentials (sourced by tract user's ~/.bashrc) |
| `/etc/tract-sync/env` | Daemon env vars — `JIRA_BASE_URL`, `JIRA_API_TOKEN`, etc. (tract:tract 600) |
| `/etc/tract-sync/fields.yaml` | Instance-wide custom field mappings (tract:tract 600) |
| `/etc/tract-sync/users.yaml` | Per-user Jira token registry |

> **Config corruption watch:** `optional:` items in `config.yaml` must be indented 4 spaces (not 0). Incorrect indentation is a common source of parse failures.



Tell developers to run:
```bash
tract catalog set http://<server>:3200
tract clone <PROJECT>
tract doctor
```

That's it. `tract clone` fetches the repo and dependencies. `tract doctor` verifies everything is wired up correctly.
