# Self-Update Guide

## Simple Updates (After First Setup)

Just trigger the update API:

```bash
curl -X POST http://reek:3100/update
```

The service will:
1. Pull latest code from GitHub
2. Copy updated files
3. Install any new npm dependencies
4. Exit (systemd restarts it automatically)

Check status after 10 seconds:
```bash
curl http://reek:3100/health
# or
ssh reek systemctl status tract-sync@app.service
```

## First-Time Setup

Before self-update works, give tract user ownership of git repo (run once):

```bash
ssh reek
sudo chown -R tract:tract /opt/tract/tract
```

Then update the systemd service to include PROJECT_NAME:

```bash
sudo systemctl stop tract-sync@app.service
sudo cp /opt/tract/tract/tract-sync/install-service.sh /tmp/
sudo bash -c 'cd /opt/tract/tract && git fetch origin && git reset --hard origin/master'
sudo bash /tmp/install-service.sh app --skip-onboard
```

Or manually update the service file:

```bash
sudo vi /etc/systemd/system/tract-sync@.service
# Add this line after EnvironmentFile:
Environment="PROJECT_NAME=%i"

sudo systemctl daemon-reload
sudo systemctl restart tract-sync@app.service
```

## How It Works

1. **POST /update** endpoint receives request
2. Service pulls latest code from GitHub (tract user has ownership)
3. Copies files from `/opt/tract/tract/tract-sync/` to `/opt/tract/tract-sync/`
4. Installs any new npm packages
5. Calls `process.exit(0)`
6. Systemd sees exit and restarts service automatically
7. Service starts with new code

## Benefits

- ✅ **No SSH required** - Update from anywhere
- ✅ **No sudo required** - tract user can git pull
- ✅ **No login shell needed** - tract user still has /sbin/nologin
- ✅ **Automatic restart** - systemd Restart=always handles it
- ✅ **Safe** - Only pulls from GitHub, no arbitrary code execution

## Update Multiple Projects

```bash
curl -X POST http://reek:3100/update  # app project (port 3100)
curl -X POST http://reek:3101/update  # tb project (port 3101)
curl -X POST http://reek:3102/update  # prd project (port 3102)
```

## Monitoring Updates

```bash
# Watch logs during update
ssh reek
sudo journalctl -u tract-sync@app.service -f
```

## Rollback

If an update breaks something:

```bash
ssh reek
sudo -u tract bash
cd /opt/tract/tract
git reset --hard <previous-commit-sha>
exit

# Then trigger update to use old code
curl -X POST http://reek:3100/update
```

## Security

The endpoint is unauthenticated (internal network only). To add auth:

1. Add API key to `/opt/tract/config/app.env`:
   ```
   UPDATE_API_KEY=your-secret-key
   ```

2. Check key in endpoint:
   ```javascript
   if (req.headers['x-api-key'] !== process.env.UPDATE_API_KEY) {
     return res.status(401).json({ error: 'Unauthorized' });
   }
   ```

3. Use with curl:
   ```bash
   curl -X POST http://reek:3100/update -H "X-API-Key: your-secret-key"
   ```
