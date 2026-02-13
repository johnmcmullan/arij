# Server Update Instructions

## Quick Update

SSH to server and run as root:

```bash
ssh reek
sudo /opt/tract/tract/tract-sync/update-server.sh app
```

The script will:
1. Pull latest code from GitHub
2. Copy sync service files
3. Install any new npm dependencies
4. Restart the service
5. Show status

## Manual Update (if needed)

```bash
ssh reek

# Pull latest code
cd /opt/tract/tract
git fetch origin
git reset --hard origin/master
chown -R tract:tract /opt/tract/tract

# Copy files
cd /opt/tract/tract-sync
cp /opt/tract/tract/tract-sync/lib/*.js lib/
cp /opt/tract/tract/tract-sync/server.js .
chown tract:tract lib/*.js server.js

# Check for new dependencies
cd /opt/tract/tract-sync
diff /opt/tract/tract/tract-sync/package.json package.json
# If different:
cp /opt/tract/tract/tract-sync/package.json .
npm install --production
chown -R tract:tract node_modules package*.json

# Restart
sudo systemctl restart tract-sync@app.service
systemctl status tract-sync@app.service
```

## Why This Works

The `tract` user has `/sbin/nologin` shell (security best practice), so we can't `sudo -u tract`. Instead:

1. **Git operations** run as root
2. **chown** to tract:tract after copying
3. **systemd** runs the service as tract user

## Verify Deployment

```bash
# Check service is running
systemctl status tract-sync@app.service

# Check health endpoint
curl http://localhost:3100/health

# Check logs
journalctl -u tract-sync@app.service -f
```

## Multiple Projects

```bash
# Update APP project
sudo /opt/tract/tract/tract-sync/update-server.sh app

# Update TB project (when deployed)
sudo /opt/tract/tract/tract-sync/update-server.sh tb

# Update PRD project (when deployed)
sudo /opt/tract/tract/tract-sync/update-server.sh prd
```

## Rollback

If deployment fails:

```bash
cd /opt/tract/tract
git reset --hard <previous-commit>
# Then run update script again
```

## First-Time Setup

For new servers, use the installer:

```bash
cd /opt/tract/tract/tract-sync
sudo ./install-service.sh APP
```
