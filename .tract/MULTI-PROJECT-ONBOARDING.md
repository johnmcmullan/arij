# Multi-Project Onboarding Enhancement Proposal

**Status**: Draft  
**Date**: 2026-02-18  
**Author**: John McMullan  
**Related**: MULTI-PROJECT-GUIDE.md, FEDERATION.md

## Problem Statement

The current `tract onboard` command successfully handles single-project setup, but provides no guidance or automation for multi-project deployments. Users must manually:

1. Run separate onboarding for each project
2. Perform initial bulk imports manually
3. Configure and start multiple tract-sync instances
4. Manage port assignments and environment variables
5. Register Jira webhooks manually for each project
6. Set up process management (systemd services) independently

This creates a significant gap between onboarding a first project and deploying a production multi-project setup.

## Real-World Use Case

A team managing APP, TB, and PRD projects needs to:
- Import all historical tickets from 3 Jira projects
- Run 3 independent tract-sync servers (ports 3100, 3101, 3102)
- Configure Jira webhooks for issue updates AND worklog events
- Ensure all processes start on system reboot
- Share a common worklog repository across projects

Current process requires ~45 manual steps across multiple terminal sessions.

## Proposed Enhancements

### 1. Enhanced Onboarding Options

```bash
# Single project with sync (current + enhanced)
tract onboard \
  --project TB \
  --jira https://jira.company.com \
  --sync-port 3101 \
  --import-all \
  --create-service

# Multi-project in one command
tract onboard \
  --projects APP,TB,PRD \
  --jira https://jira.company.com \
  --sync-ports 3100-3102 \
  --shared-worklogs ~/worklogs \
  --import-all \
  --create-services
```

**New flags:**

- `--sync-port <port>` - Port for tract-sync server
- `--import-all` - Run initial bulk import during onboarding
- `--create-service` - Generate systemd service file
- `--projects <list>` - Comma-separated project keys
- `--sync-ports <range>` - Port range for multiple projects
- `--shared-worklogs <path>` - Common worklog directory
- `--register-webhooks` - Automatically register Jira webhooks (requires Jira admin credentials)

### 2. Initial Import with Progress

During onboarding, if `--import-all` is specified:

```
🚀 Tract Onboarding - Project TB

✓ Created repository structure
✓ Git repository initialized
✓ Jira connection configured

📥 Initial Import
   Query: project = TB AND status != "Closed"
   Estimated: ~450 tickets
   
   Progress: ████████████░░░░░░░░ 60% (270/450)
   Rate: 15 tickets/sec
   ETA: 12 seconds
   
✓ Imported 450 tickets
✓ Imported 127 worklog entries
✓ Imported 12 sprints
✓ Imported 8 releases

✅ Onboarding Complete!
```

### 3. Sync Server Management

Generate systemd service files automatically:

```bash
tract onboard --project TB --sync-port 3101 --create-service

# Creates: /etc/systemd/system/tract-sync-tb.service
```

**Service template:**

```ini
[Unit]
Description=Tract Sync - TB Project
After=network.target

[Service]
Type=simple
User=tract
Environment=PORT=3101
Environment=TRACT_REPO_PATH=/home/tract/tb-tickets
Environment=WORKLOG_REPO_PATH=/home/tract/worklogs
Environment=JIRA_URL=https://jira.orcsoftware.com
Environment=JIRA_USERNAME=tract-sync
EnvironmentFile=-/home/tract/.tract-sync-env
ExecStart=/usr/bin/node /opt/tract/tract-sync/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Management commands:**

```bash
tract sync start TB       # Start sync server
tract sync stop TB        # Stop sync server
tract sync restart TB     # Restart sync server
tract sync status         # Show status of all sync servers
tract sync logs TB        # View logs
```

### 4. Webhook Registration

If `--register-webhooks` is provided:

```bash
tract onboard --project TB --register-webhooks

# Prompts for Jira admin credentials
# Automatically creates webhooks:
# - Name: Tract Sync - TB
# - URL: http://hostname:3101/webhook/jira
# - Events: Issue created, updated; Comment created, updated; Worklog created, updated, deleted
# - JQL Filter: project = TB
```

Store webhook configuration in `.tract/sync.yaml`:

```yaml
sync:
  enabled: true
  port: 3101
  webhook_id: 12345  # For future updates/deletion
  events:
    - issue:created
    - issue:updated
    - comment:created
    - comment:updated
    - worklog:created
    - worklog:updated
    - worklog:deleted
```

### 5. Multi-Project Orchestration

New command for managing all projects:

```bash
tract projects list
# APP    ✓ synced   3100   ~/app-tickets    450 tickets
# TB     ✓ synced   3101   ~/tb-tickets     320 tickets
# PRD    ✗ offline  3102   ~/prd-tickets    280 tickets

tract projects status
# Shows health, last sync time, pending changes

tract projects import-all
# Run import on all projects in parallel

tract projects sync start
# Start all sync servers

tract projects sync stop
# Stop all sync servers
```

### 6. Configuration File for Multi-Project Setup

Create `.tract/projects.yaml` at a central location:

```yaml
# Multi-project configuration
# Location: ~/tract-root/.tract/projects.yaml

worklog_path: ~/worklogs  # Shared across all projects

projects:
  - key: APP
    repo: ~/app-tickets
    sync_port: 3100
    jira:
      url: https://jira.orcsoftware.com
      project: APP
      
  - key: TB
    repo: ~/tb-tickets
    sync_port: 3101
    jira:
      url: https://jira.orcsoftware.com
      project: TB
      
  - key: PRD
    repo: ~/prd-tickets
    sync_port: 3102
    jira:
      url: https://jira.orcsoftware.com
      project: PRD

jira_auth:
  username: tract-sync
  token_file: ~/.tract-jira-token  # Secure credential storage
```

## Implementation Phases

### Phase 1: Enhanced Single-Project Onboarding (2-3 days)
- Add `--sync-port` flag
- Add `--import-all` flag with progress bar
- Add `--create-service` flag for systemd service generation
- Improve onboarding output with clear next steps

### Phase 2: Sync Server Management (2-3 days)
- Implement `tract sync` subcommand
- Service start/stop/status commands
- Automatic port conflict detection
- Log viewing integration

### Phase 3: Multi-Project Support (3-5 days)
- Add `projects.yaml` configuration format
- Implement `tract projects` subcommand
- Parallel import for multiple projects
- Centralized status dashboard

### Phase 4: Webhook Automation (2-3 days)
- Implement `--register-webhooks` flag
- Jira webhook API integration
- Store webhook IDs for management
- Webhook verification/testing endpoint

## Benefits

1. **Reduced Setup Time**: From 45+ manual steps to single command
2. **Lower Error Rate**: Automation prevents configuration mistakes
3. **Better Onboarding Experience**: Clear progress and status feedback
4. **Easier Scaling**: Adding new projects becomes trivial
5. **Production-Ready**: Systemd integration for process management
6. **Self-Documenting**: Generated configs show how multi-project setup works

## Migration Path for Existing Deployments

For users with manually configured multi-project setups:

```bash
# Generate projects.yaml from existing setup
tract projects discover --output ~/tract-root/.tract/projects.yaml

# Migrate to new service management
tract sync migrate --generate-services

# Verify configuration
tract projects validate
```

## Security Considerations

- Store Jira credentials in separate environment files (`.tract-sync-env`)
- Support token-based auth over passwords
- Webhook secret validation
- Service runs as dedicated `tract` user with limited permissions
- Sensitive configs readable only by tract user (`chmod 600`)

## Documentation Updates Required

1. Update MULTI-PROJECT-GUIDE.md with new onboarding process
2. Create SYNC-SERVER-MANAGEMENT.md
3. Add troubleshooting guide for multi-project setups
4. Update README with multi-project quick start
5. Create migration guide for existing deployments

## Open Questions

1. Should tract-sync support multiple projects in a single process?
   - Pro: Simpler deployment (one process)
   - Con: Shared rate limits, single point of failure
   
2. Should webhook registration require admin credentials or provide manual instructions?
   - Current proposal: Optional automation, fallback to instructions
   
3. How to handle projects with different Jira instances?
   - Current proposal: Support per-project jira.url in projects.yaml

## Success Metrics

- Time to onboard 3 projects: < 5 minutes (vs ~30 minutes manual)
- Setup error rate: < 5% (vs ~40% manual)
- User satisfaction: 4.5+ stars in feedback
- Production deployments: Track adoption of multi-project features

## References

- Related docs: MULTI-PROJECT-GUIDE.md, FEDERATION.md
- Jira webhook API: https://developer.atlassian.com/server/jira/platform/webhooks/
- systemd service best practices: https://www.freedesktop.org/software/systemd/man/systemd.service.html
