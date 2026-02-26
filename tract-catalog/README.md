# tract-catalog

A small HTTP server that is the **single source of truth for tract in your organisation**. It serves:

| Endpoint | Returns |
|----------|---------|
| `GET /install.sh` | Installer script with this server's URL baked in |
| `GET /catalog` | The `catalog.yaml` project catalog, live from disk |
| `GET /version` | `{"version":"1.0.3"}` — latest CLI version |
| `GET /tract-cli.tgz` | The tract CLI npm package, ready to install |

Developers only ever need the server hostname. Everything else flows from it:

```bash
# First time
curl http://tract-server:8080/install.sh | bash

# Future updates
tract update
```

No npm account, no GitHub access, no external dependencies. The server is the org's home for tract.

## Server Setup (Admin)

### 1. Copy files to server

```bash
scp -r tract-catalog/ tract-server:/opt/tract/tract-catalog/
scp -r tract-cli/     tract-server:/opt/tract/tract-cli/
```

### 2. Create catalog.yaml

```bash
ssh tract-server
cp /opt/tract/tract-catalog/catalog.yaml.template /opt/tract/catalog.yaml
nano /opt/tract/catalog.yaml   # edit to match your real projects and repo URLs
```

### 3. Package the CLI

```bash
/opt/tract/tract-catalog/deploy-cli
# → creates /opt/tract/tract-cli-latest.tgz
```

### 4. Install systemd service

```bash
sudo cp /opt/tract/tract-catalog/tract-catalog.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tract-catalog
sudo systemctl start tract-catalog
```

### 5. Verify

```bash
systemctl status tract-catalog
curl http://localhost:8080/version          # {"version":"1.0.0"}
curl http://localhost:8080/catalog          # YAML catalog
curl http://localhost:8080/install.sh       # check __TRACT_SERVER__ was substituted
curl -I http://localhost:8080/tract-cli.tgz # 200 OK with Content-Length
```

### 6. Tell your developers

```
curl http://tract-server:8080/install.sh | bash
```

That's it. They never need another URL.

## Keeping the server up to date

The server updates itself by pulling its git source and redeploying. Three ways to trigger it — pick whichever fits your workflow:

### Option A: Webhook (push → instant update)

Ideal for teams that want the server to track a branch automatically.

**1. Set the secret in the systemd unit:**

```ini
# /etc/systemd/system/tract-catalog.service
Environment=WEBHOOK_SECRET=your-secret-here
Environment=TRACT_SOURCE_DIR=/opt/tract/source
```

```bash
sudo systemctl daemon-reload && sudo systemctl restart tract-catalog
```

**2. Add a webhook in GitHub/GitLab:**

- URL: `http://tract-server:8080/update`
- Method: POST
- Add header: `X-Webhook-Token: your-secret-here`
- Trigger: push to `main` (or whichever branch)

**3. Test it:**

```bash
curl -X POST http://tract-server:8080/update \
     -H "X-Webhook-Token: your-secret-here"
# → 202 Update triggered
# Server pulls, redeploys CLI, restarts itself
```

---

### Option B: Cron (scheduled, e.g. nightly)

Good for teams that want control over when updates land in production.

```bash
# crontab -e  (as the tract user or root)
0 2 * * *  /opt/tract/tract-catalog/update-server >> /var/log/tract-update.log 2>&1
```

Combine with `UPDATE_WINDOW` in the systemd unit if you also use the webhook but want it to respect business hours:

```ini
Environment=UPDATE_WINDOW=02:00-06:00
```

The webhook will still acknowledge with 202, but `update-server` will exit early if called outside the window.

---

### Option C: Manual

```bash
ssh tract-server /opt/tract/tract-catalog/update-server
```

---

### What `update-server` does

1. `git fetch` + `git merge --ff-only origin/<branch>` in `TRACT_SOURCE_DIR`
2. If the HEAD changed: runs `deploy-cli` to repackage the CLI tgz
3. Restarts the systemd service so the new `server.js` takes effect
4. If the HEAD didn't change: exits early — no redeploy, no restart

**Tuning knobs** (set in the systemd unit as `Environment=`):

| Variable | Default | Effect |
|----------|---------|--------|
| `TRACT_SOURCE_DIR` | `/opt/tract/source` | Git checkout to pull |
| `TRACT_BRANCH` | `main` | Branch to track |
| `AUTO_DEPLOY` | `true` | Repackage CLI tgz after pull |
| `AUTO_RESTART` | `true` | `systemctl restart tract-catalog` after pull |
| `UPDATE_WINDOW` | *(any time)* | e.g. `02:00-06:00` — skip outside this range |
| `WEBHOOK_SECRET` | *(empty = disabled)* | Enables `POST /update`; must match webhook header |

---

### Developer update flow

Once the server has new code, developers pick it up at their own pace. `tract update` is checked in the background every 8 hours:

```
💡 tract v1.0.4 is available (you have v1.0.3). Run: tract update
```

```bash
tract update
# Checking for updates at http://tract-server:8080/version ... 1.0.4
# Updating tract CLI: v1.0.3 → v1.0.4
# ✓ Update complete
```

## SSH known-hosts

The single most common point of friction for a new developer is the SSH host authenticity prompt:

```
The authenticity of host 'tract-server' can't be established.
Are you sure you want to continue connecting?
```

The catalog server can eliminate this. Run once on the server:

```bash
ssh-keyscan -H tract-server > /opt/tract/known-hosts
# If your git repos are on a different host:
ssh-keyscan -H git-server >> /opt/tract/known-hosts
```

That's it. `install.sh` and `tract clone` will both fetch `GET /known-hosts` and silently add the entries to each developer's `~/.ssh/known_hosts`. If the file doesn't exist the endpoint returns 404 and clients skip it gracefully — no errors.

## catalog.yaml Reference

Edit `/opt/tract/catalog.yaml` on the server. Edits take effect on the next request — no restart.

```yaml
workspace:
  name: acme

projects:
  - name: app
    prefix: APP
    repo_url: git@tract-server:/opt/tract/git/app-tickets.git
    description: Main application

  - name: trading
    prefix: TRADING
    repo_url: git@tract-server:/opt/tract/git/trading-tickets.git
    description: Trading platform
    depends_on: [APP]    # tract clone TRADING also clones APP

shared:
  worklogs: .tract/worklogs/
```

**Fields:**
- `name` — directory name used when cloning (`~/work/<name>/`)
- `prefix` — project key used in `tract clone <prefix>` and ticket IDs
- `repo_url` — git URL passed to `git clone`
- `description` — shown in `tract catalog list`
- `depends_on` — list of prefixes; resolved recursively by `tract clone`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CATALOG_PATH` | `/opt/tract/catalog.yaml` | Path to catalog.yaml |
| `CLI_TGZ_PATH` | `/opt/tract/tract-cli-latest.tgz` | Path to the CLI package |
| `CLI_PKG_PATH` | `/opt/tract/tract-cli/package.json` | Path to CLI package.json (for version) |
| `PORT` | `8080` | HTTP port to listen on |

## Running Locally (Development / Testing)

```bash
cd tract-catalog

# Package the CLI first
../tract-catalog/deploy-cli ../tract-cli  2>/dev/null || \
  (cd ../tract-cli && npm pack --pack-destination . && mv tract-cli-*.tgz ../tract-catalog/tract-cli-latest.tgz)

# Start server pointing at local files
CATALOG_PATH=./catalog.yaml.template \
CLI_TGZ_PATH=./tract-cli-latest.tgz \
CLI_PKG_PATH=../tract-cli/package.json \
node server.js &

curl http://localhost:8080/version
curl http://localhost:8080/catalog
curl http://localhost:8080/install.sh
curl -O http://localhost:8080/tract-cli.tgz
```
