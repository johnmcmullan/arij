# Tract Migration Guide

**For:** An LLM migrating an existing Tract deployment to the new layout
**Status:** Current as of 2026-02-19

---

## What changed and why

Three structural changes were made to clean up the layout and correctly separate
cross-project shared metadata from per-project data:

1. **Ticket directory renamed** — `issues/` → `tickets/`
2. **Sprints moved** — `project/.tract/sprints/` → `~/.tract/sprints/`
3. **Worklogs moved** — `project/.tract/worklogs/` → `~/.tract/worklogs/`

`~/.tract/` is now a git repository holding shared cross-project metadata.
`config.yaml` inside it is gitignored (machine-local). Everything else syncs.

---

## Before / after layout

**Before:**
```
~/work/tb/
├── issues/              ← ticket markdown files
└── .tract/
    ├── config.yaml
    ├── components.yaml
    ├── sprints/         ← sprint YAML files (was here)
    ├── releases/
    └── worklogs/        ← worklog JSONL files (was here)
        └── 2026-02.jsonl
```

**After:**
```
~/.tract/                ← git repo, shared cross-project metadata
├── .gitignore           ← excludes config.yaml
├── .gitattributes       ← *.jsonl merge=union
├── config.yaml          ← LOCAL ONLY, never committed
├── sprints/             ← sprint YAML files (moved here)
│   └── sprint-7.yaml
└── worklogs/            ← worklog JSONL files (moved here)
    └── 2026-02.jsonl

~/work/tb/
├── tickets/             ← ticket markdown files (renamed)
└── .tract/
    ├── config.yaml      ← project config (prefix, types, statuses…)
    ├── components.yaml
    └── releases/
```

---

## Step-by-step migration for a developer's machine

### 1. Rename `issues/` to `tickets/` in each project repo

```bash
cd ~/work/tb          # repeat for each project repo
git mv issues/ tickets/
git commit -m "Rename issues/ to tickets/"
```

### 2. Initialise `~/.tract/` as a git repo

```bash
mkdir -p ~/.tract/sprints ~/.tract/worklogs
cd ~/.tract
git init

# config.yaml is machine-local — never commit it
echo 'config.yaml' > .gitignore

# JSONL worklogs use git union merge — no conflicts on concurrent push
echo '*.jsonl merge=union' > .gitattributes

git add .gitignore .gitattributes sprints worklogs
git commit -m "Initialize ~/.tract shared metadata"
```

If your team already has a shared `~/.tract` remote:
```bash
git clone git@server:tract/shared.git ~/.tract
```

### 3. Move sprints from each project repo into `~/.tract/sprints/`

```bash
# For each project repo that has a .tract/sprints/ directory:
cp ~/work/tb/.tract/sprints/*.yaml ~/.tract/sprints/   # copy, don't clobber
cp ~/work/app/.tract/sprints/*.yaml ~/.tract/sprints/

# Remove from project repos
cd ~/work/tb  && git rm -r .tract/sprints/ && git commit -m "Move sprints to ~/.tract"
cd ~/work/app && git rm -r .tract/sprints/ && git commit -m "Move sprints to ~/.tract"

# Commit shared sprints
cd ~/.tract && git add sprints/ && git commit -m "Import sprints from project repos"
```

If the same sprint exists in multiple repos, the files are identical — just
keep one copy.

### 4. Move worklogs from each project repo into `~/.tract/worklogs/`

Worklog files are per-month JSONL. If the same month file exists in multiple
project repos, **merge** the lines rather than overwriting:

```bash
# Merge all project worklogs into ~/.tract/worklogs/
for repo in ~/work/tb ~/work/app ~/work/prd; do
  src="$repo/.tract/worklogs"
  if [ -d "$src" ]; then
    for f in "$src"/*.jsonl; do
      month=$(basename "$f")
      dest=~/.tract/worklogs/$month
      if [ -f "$dest" ]; then
        # Append unique lines (dedup by content)
        sort -u "$dest" "$f" > /tmp/merged.jsonl && mv /tmp/merged.jsonl "$dest"
      else
        cp "$f" "$dest"
      fi
    done
    # Remove from project repo
    cd "$repo" && git rm -r .tract/worklogs/ && git commit -m "Move worklogs to ~/.tract"
  fi
done

cd ~/.tract && git add worklogs/ && git commit -m "Import worklogs from project repos"
```

### 5. Add a remote for `~/.tract/` (optional but recommended)

```bash
# On the server, create a bare repo:
#   git init --bare /srv/tract/shared.git

cd ~/.tract
git remote add origin git@server:tract/shared.git
git push -u origin master
```

### 6. Write `~/.tract/config.yaml` (local, never committed)

```yaml
# ~/.tract/config.yaml  — machine-local, gitignored
upstream: https://jira.company.com

projects:
  TB:
    path: ~/work/tb
  APP:
    path: ~/work/app
```

---

## Step-by-step migration for a tract-sync server

The server runs as a dedicated service user (e.g. `tract`). It does **not** need
`~/.tract/` shared metadata — it only serves per-project ticket sync.

```bash
# Rename issues/ → tickets/ in the server's project directory
cd /opt/tract/tb
git mv issues/ tickets/
git commit -m "Rename issues/ to tickets/"
git push
```

The tract-sync process picks up the rename automatically — `tickets/` is now
the watched directory in `server.js`.

---

## Code-level reference (what changed in the source)

| Component | Old | New |
|-----------|-----|-----|
| `ticket-importer.js` constructor | `(jiraClient, tractDir)` | `(jiraClient, tractDir, tractHome = ~/.tract)` |
| `importWorklogs()` destination | `tractDir/.tract/worklogs/` | `tractHome/worklogs/` |
| `importSprints()` destination | `tractDir/.tract/sprints/` | `tractHome/sprints/` |
| `worklog-calculator.js` default | walk up tree for `.tract/worklogs/` | `~/.tract/worklogs/` directly |
| `board.js` `sprintsDir` | `cwd/.tract/sprints/` | `~/.tract/sprints/` (overridable via `options.sprintsDir`) |
| `board.js` `ticketsDir` | `cwd/issues/` (was `issuesDir`) | `cwd/tickets/` (now `ticketsDir`) |
| `onboard.js` | `setupWorklogs()` — inits `~/.tract/worklogs/` as separate git repo | `setupTractHome()` — inits `~/.tract/` as git repo with sprints/, worklogs/, .gitignore, .gitattributes |
| All sync classes | `this.issuesDir` / `issues/` | `this.ticketsDir` / `tickets/` |

---

## Integration test pattern

Tests that exercise the importer pass a temporary directory as `tractHome`:

```javascript
const tractHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tract-home-'));
const importer = new TicketImporter(client, tempDir, tractHome);

// Worklogs land in tractHome/worklogs/YYYY-MM.jsonl
// Sprints land in tractHome/sprints/SPRINT-ID.yaml
// Releases still in tempDir/.tract/releases/
// Tickets in tempDir/tickets/
```

Clean up both `tempDir` and `tractHome` in `afterEach`.

---

## What did NOT change

- `.tract/config.yaml` — still per-project, same format
- `.tract/components.yaml` — still per-project
- `.tract/releases/` — still per-project
- Jira credentials — still in environment variables (`JIRA_USERNAME`, `JIRA_TOKEN`), never in any config file
- The `jira:` section of `.tract/config.yaml` — unchanged
- Sprint YAML format — unchanged, just a different home directory
- Worklog JSONL format — unchanged, files now named `YYYY-MM.jsonl` and all authors are in one file per month
