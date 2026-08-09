# Tract CLI

> Command-line interface for Tract - the developer-friendly Jira alternative

## Installation

```bash
npm install -g @tract/cli
```

Or use without installing:

```bash
npx @tract/cli doctor
```

## Quick Start

### 1. Check Your Setup

```bash
tract doctor
```

This runs health checks and tells you exactly what's missing.

### 2. Clone an Existing Tract Repo

If your team already has Tract set up:

```bash
git clone ssh://git@server/path/to/tickets.git
cd tickets
tract doctor
```

### 3. Or Bootstrap a New Project

If you're the first person:

```bash
tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --output ./app-tickets
```

## Commands

### `tract doctor`

Run health checks and diagnostics.

**What it checks:**
- Git installation
- Git repository status
- Tract config validity
- Git remote setup
- Sync server connectivity
- Common issues

**Example output:**
```
✓ Git installed (git version 2.39.0)
✓ Git repository initialized
✓ Tract config directory exists
✓ Tract config file valid (Project: APP)
✓ Issues directory exists (42 tickets)
⚠ Git remote not configured
  Fix: git remote add origin <url>
```

**When to use:** Anytime something isn't working. Start here.

---

### `tract onboard`

Bootstrap a new Tract project from Jira.

**Required:**
- `--jira <url>` - Jira instance URL
- `--project <key>` - Project key (e.g., APP, TB)
- `--user <username>` OR `JIRA_USERNAME` env var
- `--token <token>` OR `JIRA_TOKEN` env var

**Optional:**
- `--output <dir>` - Where to create the repo (default: current directory)
- `--submodule <path>` - Add as submodule in parent repo
- `--remote <url>` - Git remote URL
- `--import-tickets` - Import existing tickets during setup
- `--limit <n>` - Limit tickets imported (for testing)
- `--no-git` - Skip git initialization

**Examples:**

**Basic onboarding:**
```bash
export JIRA_USERNAME="your.name"
export JIRA_TOKEN="your-token"

tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --output ./app-tickets \
  --import-tickets
```

**As a submodule in your code repo:**
```bash
cd ~/code/my-app

tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --submodule tickets \
  --remote ssh://git@server/tickets.git \
  --import-tickets
```

**What it does:**
1. Creates directory structure (`.tract/`, `issues/`, `worklogs/`)
2. Generates config from Jira project settings
3. Optionally imports open tickets
4. Initializes git repo
5. Sets up git remote (if provided)
6. Creates initial commit

---

### `tract create <PROJECT>`

Create a new ticket.

**Required:**
- `<project>` - Project key (e.g., APP)
- `--title <text>` - Ticket title

**Optional:**
- `--type <type>` - Issue type (bug, task, story, etc.) - default: task
- `--priority <priority>` - Priority (trivial, minor, major, critical, blocker) - default: medium
- `--assignee <username>` - Assign to user
- `--description <text>` - Detailed description
- `--components <list>` - Comma-separated component names
- `--labels <list>` - Comma-separated labels
- `--server <url>` - Sync server URL (or use `TRACT_SYNC_SERVER` env var)

**Examples:**

```bash
# Simple task
tract create APP --title "Update README"

# Bug with priority
tract create APP \
  --title "Login timeout after 5 minutes" \
  --type bug \
  --priority critical \
  --assignee john.doe \
  --components "Auth,Frontend"

# Story with description
tract create APP \
  --title "Implement OAuth SSO" \
  --type story \
  --description "Users should be able to log in via Google/GitHub" \
  --labels "security,auth"
```

**Requires:** `TRACT_SYNC_SERVER` environment variable or `--server` option

---

### `tract log <ISSUE> <TIME> [COMMENT]`

Log time to an issue.

**Arguments:**
- `<issue>` - Issue key (e.g., APP-1234)
- `<time>` - Time spent (e.g., 2h, 30m, 1d, 1w)
- `[comment]` - Work description (optional)

**Optional:**
- `--server <url>` - Sync server URL
- `--author <name>` - Author name (defaults to git user.name)
- `--started <datetime>` - Start time (ISO 8601, defaults to now)

**Examples:**

```bash
# Log 2 hours
tract log APP-1234 2h "Fixed authentication bug"

# Log with custom author
tract log APP-1234 30m "Code review" --author jane.doe

# Log with specific start time
tract log APP-1234 1h "Meeting" --started "2026-02-13T10:00:00Z"
```

**Time format examples:**
- `30m` = 30 minutes
- `2h` = 2 hours
- `1d` = 1 day (8 hours)
- `1w` = 1 week (40 hours)

**Requires:** `TRACT_SYNC_SERVER` environment variable or `--server` option

---

### `tract timesheet [AUTHOR]`

View timesheet entries.

**Arguments:**
- `[author]` - Author name (optional, defaults to git user.name)

**Optional:**
- `--date <date>` - Specific date (YYYY-MM-DD)
- `--week [week]` - ISO week (e.g., 2026-W07, or current week if no value)
- `--month <month>` - Month (YYYY-MM)
- `--format <format>` - Output format: text, json, csv (default: text)
- `--server <url>` - Sync server URL

**Examples:**

```bash
# Today's timesheet
tract timesheet

# This week
tract timesheet --week

# Specific week
tract timesheet --week 2026-W07

# Specific month
tract timesheet --month 2026-02

# Another user's timesheet
tract timesheet john.doe --week

# Export as CSV
tract timesheet --month 2026-02 --format csv > february.csv
```

**Requires:** `TRACT_SYNC_SERVER` environment variable or `--server` option

---

### `tract worklogs <ISSUE>`

View all worklog entries for a specific issue.

**Arguments:**
- `<issue>` - Issue key (e.g., APP-1234)

**Optional:**
- `--server <url>` - Sync server URL

**Example:**

```bash
tract worklogs APP-1234
```

**Requires:** `TRACT_SYNC_SERVER` environment variable or `--server` option

---

### `tract teams`

List and inspect Tempo teams synced from Jira. Teams are stored as YAML files in the `worklogs/teams/` directory of the worklogs clone.

**Subcommands:**

#### `tract teams list`

```bash
tract teams list                          # all teams, grouped by hierarchy
tract teams list --rd                     # R&D teams only
tract teams list --jurisdiction eu        # teams in a specific jurisdiction
tract teams list --rd --jurisdiction uk   # combine filters
```

**Jurisdictions:** `eu`, `us`, `uk`, `apac`, `in`

#### `tract teams show <name-or-id>`

```bash
tract teams show "Engineering PT - Principal Trading"
tract teams show 33        # by numeric Tempo team ID
tract teams show "PT"      # fuzzy name match
```

Shows team metadata, hierarchy, jurisdiction, R&D flag, active members with availability % and membership dates, and former members.

**Options (both subcommands):**
- `--dir <path>` - Path to the `teams/` directory (or set `TRACT_WORKLOGS_DIR` pointing to the worklogs clone root)

**Setup:** Clone the worklogs repo and set `TRACT_WORKLOGS_DIR`:

```bash
tract clone worklogs --server <host>
export TRACT_WORKLOGS_DIR=~/work/worklogs
```

---

### `tract import`

Import tickets from Jira into an existing Tract repo.

**Optional:**
- `--tract <dir>` - Tract repo directory (default: current)
- `--user <username>` - Jira username (or `JIRA_USERNAME` env var)
- `--token <token>` - Jira API token (or `JIRA_TOKEN` env var)
- `--status <status>` - Import tickets with this status (default: open, or "all")
- `--limit <n>` - Limit number of tickets
- `--jql <query>` - Custom JQL query (overrides --status)
- `--commit` - Auto-commit imported tickets

**Examples:**

```bash
# Import all open tickets
tract import

# Import only "In Progress" tickets
tract import --status "In Progress"

# Import using custom JQL
tract import --jql "project = APP AND created > -7d"

# Import and commit
tract import --commit
```

---

### `tract board`

Open the interactive terminal board (TUI). Real-time kanban/swimlane view of all tickets.

**Options:**
- `--project <prefix>` — Filter to specific project(s), comma-separated
- `--workspace <dir>` — Workspace root (default: auto-detected from current directory)
- `--assignee <names>` — Filter by assignee; comma-separate for OR matching (`john,alice`, `@me`)
- `--label <labels>` — Show only tickets with any of these labels (comma-separated)
- `--exclude-label <labels>` — Hide tickets that have any of these labels (comma-separated)
- `--status <statuses>` — Show only these statuses (comma-separated)
- `--exclude-status <statuses>` — Hide these statuses (comma-separated)
- `--sprint <id>` — Filter by sprint (`current`, `backlog`, `latest`, `all`, or a sprint ID)
- `--save <name>` — Save the current filter set as a named board config
- `--list` — List all saved board configs

**Examples:**
```bash
tract board
tract board --project APP,FE
tract board --assignee @me
tract board --assignee john,alice,vijays --exclude-label tsd_apps_exclude
tract board --project APP --exclude-status done,verified --save my-board
tract board my-board
```

**Saved boards:**

Filters can be saved and reused by name. The config is stored as a YAML file in
`.tract/boards/<name>.yaml` and supports all the filter options above, including
multi-value assignee lists and exclude-labels:

```yaml
name: Apps Team Board
filters:
  project: APP
  assignee:
    - john.mcmullan
    - alice.smith
  exclude_labels:
    - tsd_apps_exclude
  exclude_status:
    - done
    - verified
```

**What it shows:**
- Columns: Backlog / Todo / In Progress / Review / Done
- Swimlanes per project when multiple projects are loaded
- Cards show assignee, priority, estimate, worklog progress
- Updates live when ticket files change (chokidar watcher)
- Press `q` or `Ctrl-C` to exit

---

### `tract serve`

Start a local HTTP server that serves your tickets as JSON and hosts web dashboards.

**Optional:**
- `--port <n>` — Port to listen on (default: 7766)
- `--workspace <dir>` — Workspace root (default: auto-detected)
- `--project <prefixes>` — Filter to specific projects, comma-separated

**Example:**
```bash
tract serve
tract serve --port 8080
tract serve --workspace ~/work/myproject
```

**What it serves:**

| Endpoint | Description |
|----------|-------------|
| `GET /` | Dashboard index — named menu if `index.yaml` exists, otherwise auto-list |
| `GET /dashboards/<name>.html` | Serves built-in or custom dashboard HTML |
| `GET /api/tickets` | All tickets as JSON; supports `?project=`, `?sprint=`, `?status=`, `?assignee=` |
| `GET /api/ticket/:id` | Single ticket with full markdown body |
| `GET /api/sprints` | Sprint YAML files as JSON |
| `GET /api/projects` | Project list with ticket counts |
| `GET /api/meta` | Workspace name, port, project list |
| `GET /api/events` | SSE stream — sends `{type:"reload"}` when any ticket file changes |

**Dashboard locations:**
- Built-ins (kanban, scrum, control-chart) — served from the CLI install, always up to date
- Custom — `~/.tract/dashboards/<name>.html` (LLM-generated, local only)
- Named views — `<workspace>/dashboards/index.yaml` for a curated landing page menu

**Live reload:** Dashboards connect to `/api/events` via `EventSource`. Editing any ticket file triggers an automatic browser refresh — no manual reload needed.

---

### `tract demo`

Create a self-contained demo workspace with realistic fictional data and open a browser to explore it.

**Optional:**
- `--port <n>` — Port for the serve instance (default: 7766)
- `--reset` — Delete and regenerate the demo workspace from scratch

**Example:**
```bash
tract demo           # start demo (creates workspace on first run)
tract demo --reset   # regenerate fresh data
```

**What it creates** (in `~/.tract/demo/`):
- Two projects: **NOVA** (15 tickets — auth, billing, frontend) and **OPS** (11 tickets — Kubernetes, monitoring, databases)
- One open sprint with a mix of todo/in-progress/review/done tickets
- Historical done tickets spanning multiple weeks (used by the control chart for cycle time data)
- `dashboards/index.yaml` with six named views: team kanban, sprint board, control chart, per-assignee boards, per-project boards

The built-in dashboards (kanban, scrum, control-chart) are served directly — no files are copied.

After generating, `tract demo` starts `tract serve` and opens your browser automatically.

---

### `tract map-components`

Use an LLM to map Jira components to code directory paths.

**Optional:**
- `--tract <dir>` - Tract repo directory (default: current)
- `--code <dir>` - Code repo root to scan (default: parent directory)
- `--confidence <percent>` - Confidence threshold for auto-accept (default: 80)
- `--no-interactive` - Skip interactive review (auto-accept all)

**Example:**

```bash
cd ~/code/my-app/tickets
tract map-components --code .. --confidence 90
```

**What it does:**
1. Scans your code directory structure
2. Uses LLM to match Jira component names to directories
3. Writes mappings to `.tract/components.yaml`
4. Interactive review (unless `--no-interactive`)

---

### `tract detect-fields [project]`

Sample Jira tickets and use AI to identify custom field mappings. Results are written instance-wide to `/etc/tract-sync/fields.yaml`.

**Arguments:**
- `[project]` - Project key (e.g., PRD). Auto-detected when run from `/opt/tract`.

**Optional:**
- `--reuse` - Re-analyse the saved payload without re-fetching from Jira
- `--agent` - Write field data to `/tmp/tract-field-data.json` for external LLM analysis
- `--agent-output <file>` - Override the agent output path
- `--per-type <n>` - Sample tickets per issue type (default: 2)
- `--model <model>` - AI model to use
- `--jira <url>` - Jira instance URL (falls back to `/etc/tract-sync/env`)
- `--user <username>` - Jira username (falls back to `/etc/tract-sync/env`)
- `--token <token>` - Jira API token (falls back to `/etc/tract-sync/env`)

**What it does:**
1. Fetches a stratified sample of tickets by issue type
2. Saves payload to `<projectDir>/.tract/detect-fields-payload.json`
3. Fetches field display names and plugin keys from Jira's `/rest/api/2/field`
4. Sends a field-centric prompt to AI (SAIS/GPT-4o preferred, Anthropic fallback)
5. Auto-resolves any "unidentified" fields that have an official Jira display name
6. Writes final mappings to `/etc/tract-sync/fields.yaml` (non-destructive)
7. Prints a summary and instructs you to run `tract accept-mappings <PROJECT>`

**AI backend:** Uses SAIS (internal BroadGPT proxy) when `SAIS_URL`, `SAIS_ID_URL`, `CLIENT_ID`, and `CLIENT_SECRET` are set; falls back to Anthropic direct. Credentials are stored in `/opt/tract/.env`.

**Note:** Blocked if `.tract/.pending-field-detection` sentinel is not present.

**Examples:**

```bash
# Detect fields for PRD project (from /opt/tract)
tract detect-fields PRD

# Re-analyse without re-fetching
tract detect-fields PRD --reuse

# Write data for external LLM analysis
tract detect-fields PRD --agent
```

---

### `tract clone <project>`

Clone a project (and its dependencies) from the catalog server or directly from a sync server.

**Arguments:**
- `<project>` - Project key (e.g., `APP`) or a full git URL

**Optional:**
- `--server <host>` - Sync server hostname for direct clone (no catalog needed), e.g. `reek`
- `--dest <dir>` - Destination directory (default: `~/.tract/<PROJECT>`)
- `--dry-run` - Show what would be cloned without doing it
- `--full` - Clone full git history (default: shallow `--depth 1` snapshot)

**Default is shallow clone.** Ticket repos accumulate millions of git objects over time (sync commits every few minutes). Developers only need the current state — shallow clone is orders of magnitude faster and smaller. Use `--full` only if you need git history for a specific reason.

**Examples:**

```bash
# Direct clone from sync server (most common)
tract clone APP --server reek

# Via catalog server
tract clone APP

# Clone with full history (rarely needed)
tract clone APP --server reek --full
```

**After cloning**, use `tract pull` to keep up to date (also shallow-compatible).

---

### `tract accept-mappings [project]`

Accept detected field mappings and unblock project sync. Run after `tract detect-fields`.

**Arguments:**
- `[project]` - Project key. Auto-detected when run from `/opt/tract`.

**Optional:**
- `--keep-payload` - Preserve `.tract/detect-fields-payload.json` (default: deleted)
- `--tract <dir>` - Tract repo directory
- `--project <key>` - Explicit project key

**What it does:**
1. Deletes the `.tract/.pending-field-detection` sentinel (unblocks sync)
2. Deletes `.tract/detect-fields-payload.json` (unless `--keep-payload`)
3. Reports count of mappings now active in `/etc/tract-sync/fields.yaml`

**Example:**

```bash
# Full field detection workflow
tract detect-fields PRD           # AI analysis + auto-apply to fields.yaml
tract detect-fields PRD --reuse   # re-run without re-fetching (optional)
tract accept-mappings PRD         # delete sentinel → sync starts
```

---

### `tract catalog <subcommand> [arg]`

Manage the catalog server used by `tract clone` and `tract update`.

**Subcommands:**
- `set <url>` - Save a catalog server URL to `~/.tract/config.yaml`
- `list` - Fetch and print projects available on the configured catalog server (default if no subcommand given)

**Example:**

```bash
tract catalog set https://tract.example.com
tract catalog list
#   APP            Application tickets
#   TB             Trading bridge  [depends on: APP]
```

---

### `tract pull`

Pull every ticket repo found under `~/.tract/` (shallow `--depth=1` fetch + hard reset — safe because these are read-only ticket mirrors, not working repos). Also symlinks Tract's builtin skills into `~/.claude/skills` and `~/.copilot/skills`, and regenerates a personalised `tract-workspace` skill describing what's cloned and where.

**When to use:** At the start of every session, to get the latest tickets and keep your LLM's workspace skill current.

**Example:**

```bash
tract pull
#   ✓ APP                  up to date
#   ↓ TB                   updated
#
#   ✓ 2 repo(s) up to date
```

---

### `tract search <query>` / `tract vsearch <query>` / `tract query <query>`

Search across cloned ticket collections — three quality/speed tiers, all requiring [qmd](https://github.com/tobilu/qmd):

- `search` - Fast keyword search. Falls back to `ripgrep`/`grep -R` if qmd isn't installed.
- `vsearch` - Semantic vector search (no fallback — requires qmd).
- `query` - Hybrid search + reranking, best quality (no fallback — requires qmd).

**Optional (all three):**
- `-p, --project <keys>` - Limit to project(s), comma-separated (e.g. `TB,SERV`)
- `--all` - Return all matches (no limit)
- `--files` - Return file paths only
- `--min-score <n>` - Minimum relevance score (0–1)

**Example:**

```bash
tract search "payment timeout" -p TB,APP
tract vsearch "customer complaints about slow checkout"
tract query "why did the auth refactor break SSO" --all
```

---

### `tract embed`

Set up [qmd](https://github.com/tobilu/qmd) collections for every cloned project and run `qmd embed` to generate embeddings, so `tract vsearch`/`tract query` have something to search. Fails gracefully (prints a message, doesn't error) if qmd isn't installed.

**Optional:**
- `--setup-only` - Register collections and context but skip running `qmd embed`
- `-v, --verbose` - Show the context string added per project

---

### `tract branch <ticket>`

Create a git branch for a ticket and record it in the ticket's frontmatter, in one step.

**Arguments:**
- `<ticket>` - Ticket key (e.g., `TB-1234`) — looks up `tickets/<ticket>.md` or the sharded `tickets/<shard>/<ticket>.md` layout

**Optional:**
- `--name <branch>` - Branch name (default: derived from the ticket title)
- `--base <branch>` - Base branch to branch from (default: current `HEAD`)
- `--force` - Create an additional branch even if the ticket already has one recorded

**What it does:**
1. Finds the ticket file
2. Derives a branch name from the title unless `--name` is given
3. Creates the branch (`git checkout -b`)
4. Writes `branch: <name>` into the ticket frontmatter and commits that change

---

### `tract review <subcommand> <ticket>`

Tract Review — lightweight PR review gating backed by a Forgejo instance, driven by policy recorded on the ticket itself. Reads `~/.tract/forgejo.yaml` (`{ url, token, user }`) for API access.

**Subcommands:**
- `open <ticket>` - Move ticket to in-review, open a Forgejo PR
- `approve <ticket>` - Record an approval on the ticket
- `status <ticket>` - Show current approval state
- `check <ticket> <sha>` - Validate policy is satisfied (used by a pre-receive hook)

**Optional:**
- `--base <branch>` - Base branch for the PR (default: `main`)
- `--policy <policy>` - Review policy: `agent-only`, `1-human`, `2-human`, `none` (default: `1-human` if unset on the ticket; `open` defaults to `agent-only`)
- `--repo <owner/repo>` - Forgejo repo path (default: detected from the git remote)
- `--comment <text>` - Approval comment (used with `approve`)
- `--force` - Re-open a ticket that's already in review

**Example:**

```bash
tract review open TB-1234
tract review approve TB-1234 --comment "LGTM, verified the fix locally"
tract review status TB-1234
```

---

### `tract skills [name]`

List every LLM skill prompt Tract can see — built-in skills plus any found in `.tract/skills`, `.claude/skills`, or `.github/skills` walking up from the current directory — or print one skill's full `SKILL.md` to stdout.

**Arguments:**
- `[name]` - Skill name to print. Omit to list all.

**Example:**

```bash
tract skills                        # list all, with descriptions
tract skills tract-onboarding       # print one skill's prompt
tract skills tract-onboarding | llm # pipe straight to your LLM
```

---

### `tract auth`

Register your Jira API token on the sync server, over SSH. Separate from `tract token` (below) — this is for the *Jira bridge's* credentials (tract-sync fetching from Jira on your behalf), not for authenticating to `tract serve`'s own API.

**Optional:**
- `--server <host>` - Sync server hostname (or set `sync_server` in `~/.tract/workspace.yaml`)
- `--user <sshuser>` - SSH user on the server (default: `tract`)

**What it does:** Prompts for your git email, Jira username, and Jira API token, then SSHes to the sync server to register them in `/etc/tract-sync/users.yaml` and reload the `tract-sync` daemon so it picks up the new token immediately.

---

### `tract normalize-labels`

Normalise and deduplicate labels across all ticket frontmatter — case, configured mappings, dedup, sort — using the `labels:` section of `.tract/config.yaml`.

**Optional:**
- `--tract <dir>` - Tract ticket repository directory (default: current)
- `--dry-run` - Show what would change without writing files
- `--verbose` - Print each changed file

---

### `tract update`

Update the `tract` CLI itself to the latest version.

**What it does:** If `tract` is running from a git checkout (a dev install), runs `git pull --ff-only`. Otherwise, checks the configured catalog server's `/version` endpoint and, if newer, `npm install -g`s the published tarball. Requires a catalog server (`tract catalog set <url>`) for the non-dev-install path.

---

### `tract token [subcommand] [arg]`

Manage Personal Access Tokens for `tract serve`'s API — see [`docs/SECURITY.md`](../docs/SECURITY.md) for the full authentication/authorization/audit model. Tokens are scoped to the git email on the machine you run `tract token create` from (or to `--user` for `create-service`), and are shown exactly once at creation — only a hash is ever stored.

**Subcommands:**
- `create` - Create a token for yourself
- `create-service --user <email>` - Create a token for another user (admin only — must be listed in `permissions.yaml`'s `admins:`)
- `list` - List your tokens (metadata only, never the raw token)
- `revoke <token-or-name>` - Revoke one of your tokens, by name or by the raw token string

**Optional:**
- `--name <name>` - Token name (required for `create`/`create-service`)
- `--ttl <days>` - Time to live in days (default: 365)
- `--user <email>` - User email, for `create-service`
- `--all` - With `list`, show every user's tokens (admin only)

**Example:**

```bash
tract token create --name "my-laptop" --ttl 90
#   ✓ Token created successfully
#     tract_am9obi5tY21pbGxhbkBvcmMuY29tOjhlZjJhNGI3Yw==
#   export TRACT_API_TOKEN="tract_..."

tract token list
tract token revoke my-laptop
```

Then, on the server: `export TRACT_AUTH_ENABLED=true` before starting `tract serve` to move from monitoring mode (logs everything, rejects nothing) to enforcement.

---

## Environment Variables

### `TRACT_SYNC_SERVER`

URL of the Tract sync service (required for create/log/timesheet commands).

**Example:**
```bash
export TRACT_SYNC_SERVER=http://tract-server:3100
```

Add to `~/.bashrc` or `~/.zshrc` to persist.

### `JIRA_USERNAME` / `JIRA_TOKEN`

Jira credentials for onboarding and importing.

**Example:**
```bash
export JIRA_USERNAME="your.name"
export JIRA_TOKEN="your-api-token"
```

**How to get a token:**
1. Go to Jira → Settings → Personal Access Tokens
2. Create new token
3. Copy and save in environment variable

---

## Troubleshooting

### "TRACT_SYNC_SERVER not set"

**Solution:** Set the environment variable or use `--server` option:

```bash
export TRACT_SYNC_SERVER=http://tract-server:3100
```

Or:
```bash
tract create APP --title "Test" --server http://tract-server:3100
```

### "Not a git repository"

**Solution:** Navigate to your Tract repo or run `tract onboard`:

```bash
cd path/to/tickets
# or
tract onboard --jira <url> --project <KEY>
```

### ".tract/ directory missing"

**Solution:** Run `tract onboard` to bootstrap the repository.

### "Could not reach sync server"

**Checks:**
1. Is the service running? `ssh tract-server systemctl status tract-sync`
2. Is the URL correct? `curl http://tract-server:3100/health`
3. Are you on the right network/VPN?

**Offline work:** You can still create/edit tickets locally. Edit markdown files in `issues/` directory.

### "Git user not configured"

**Solution:** Configure git user:

```bash
git config user.name "Your Name"
git config user.email "you@company.com"
```

---

## For LLMs

If you're an LLM helping a developer:

1. **Read `.tract/SCHEMA.md`** in the ticket repository for complete documentation
2. Use `tract doctor` to diagnose issues
3. Prefer `tract create` and `tract log` over manual file editing (when server is available)
4. For offline work, edit markdown files directly in `issues/`

---

## Development

**Run from source:**

```bash
git clone https://github.com/johnmcmullan/tract.git
cd tract/tract-cli
npm install
npm link  # Makes 'tract' command available globally

# Test
tract doctor
```

**Run tests:**

```bash
npm test
```

---

## License

MIT

## Support

- **Issues:** https://github.com/johnmcmullan/tract/issues
- **Docs:** https://github.com/johnmcmullan/tract
- **Need help?** Run `tract doctor` first!
