# First-Time Update (Bootstrap)

Since the update script doesn't exist on the server yet, and `/opt/tract` is owned by the `tract` user, run everything with sudo:

```bash
ssh your-server

# Pull latest code and run update (all as root)
sudo bash -c 'cd /opt/tract/tract && \
  git fetch origin && \
  git reset --hard origin/master && \
  chown -R tract:tract /opt/tract/tract && \
  chmod +x tract-sync/update-server.sh && \
  tract-sync/update-server.sh app'
```

Or step-by-step:

```bash
ssh your-server

# Run all commands as root (staying in one sudo session)
sudo bash

cd /opt/tract/tract
git fetch origin
git reset --hard origin/master
chown -R tract:tract /opt/tract/tract
chmod +x tract-sync/update-server.sh
tract-sync/update-server.sh app

# Exit root shell
exit
```

After this first time, future updates are just:

```bash
ssh your-server
sudo /opt/tract/tract/tract-sync/update-server.sh app
```

## Why This Works

- `/opt/tract/` is owned by `tract:tract` (no world read/write)
- You can't `cd` there as your user
- `sudo bash -c '...'` runs everything in one root session
- After first update, the script path is absolute so sudo can find it
