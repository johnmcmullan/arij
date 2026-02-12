# First-Time Update (Bootstrap)

Since the update script doesn't exist on the server yet, do this **once** to get it:

```bash
ssh reek

# Pull latest code (as root)
cd /opt/tract/tract
sudo git fetch origin
sudo git reset --hard origin/master
sudo chown -R tract:tract /opt/tract/tract

# Make update script executable
sudo chmod +x /opt/tract/tract/tract-sync/update-server.sh

# Now run the update script
sudo /opt/tract/tract/tract-sync/update-server.sh app
```

After this first time, future updates are just:

```bash
ssh reek
sudo /opt/tract/tract/tract-sync/update-server.sh app
```

## Even Simpler: One-Liner Bootstrap

```bash
ssh reek "cd /opt/tract/tract && sudo git fetch origin && sudo git reset --hard origin/master && sudo chown -R tract:tract . && sudo chmod +x tract-sync/update-server.sh && sudo tract-sync/update-server.sh app"
```

Or broken down for readability:
```bash
ssh reek
cd /opt/tract/tract && \
  sudo git fetch origin && \
  sudo git reset --hard origin/master && \
  sudo chown -R tract:tract . && \
  sudo chmod +x tract-sync/update-server.sh && \
  sudo tract-sync/update-server.sh app
```
