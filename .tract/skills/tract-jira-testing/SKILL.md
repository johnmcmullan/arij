---
name: tract-jira-testing
description: Guide a developer through testing Tract's Jira import against a real on-prem Jira instance. Use when someone wants to test the import, run a live trial, configure Jira credentials, or diagnose why an import failed or produced wrong output.
metadata:
  author: tract
  version: "1.0"
---

# Testing Tract's Jira Import

This skill guides you through a first live test of `tract import` against your
on-prem Jira. It takes about 15 minutes.

## Prerequisites

- Node.js 18+ installed (`node --version`)
- Git installed
- Access to your company's Jira instance (ask for a **personal API token**, not your password — this avoids account lockouts)
- Your Jira project key (e.g. `APP`, `TB`, `FIX`)

---

## Step 1 — Get Tract

**Option A: Clone and link (recommended for testing)**

```bash
git clone https://github.com/johnmcmullan/tract.git
cd tract/tract-cli
npm install
npm link          # makes 'tract' available globally
```

**Option B: Check if it's already installed**

```bash
tract --version
```

If that works, skip to Step 2.

---

## Step 2 — Create a test ticket repository

Pick a directory outside the tract source code. This is where your tickets will live.

```bash
mkdir ~/jira-test && cd ~/jira-test
git init
tract onboard --local --project YOUR_PROJECT_KEY
```

This creates:
```
~/jira-test/
├── issues/
└── .tract/
    ├── config.yaml
    └── components.yaml
```

---

## Step 3 — Configure Jira connection

Edit `.tract/config.yaml`. Add a `jira:` section:

```yaml
prefix: YOUR_PROJECT_KEY
types: ['*']      # accept any type on first import
statuses: ['*']   # accept any status
priorities: ['*']

jira:
  url: https://jira.your-company.com
  project: YOUR_PROJECT_KEY
  # sprint_field is auto-detected on first import — leave blank initially
  # custom_field_map: {}   # add later once you know your field IDs
```

**Getting an API token (not your password):**

- Jira Cloud: Profile → Manage account → Security → API tokens
- Jira Server/DC: Profile → Personal Access Tokens (Jira 8.14+)
  - Older Server: use your username/password but set `max_sessions` with your admin

Set credentials as environment variables — **never put them in config.yaml**:

```bash
export JIRA_USERNAME="your.name@company.com"
export JIRA_TOKEN="your-api-token-here"
```

---

## Step 4 — Run a limited test import

**Always start with `--limit 5` to avoid hammering Jira:**

```bash
cd ~/jira-test
tract import --limit 5
```

Expected output:
```
📥 Importing Jira Tickets

Query: project = YOUR_PROJECT AND status = "open"
Limit: 5 tickets

✓ Fetched 5 tickets
✓ Converted 5 tickets to markdown
✓ Imported N worklog entries to .tract/worklogs/
✓ Imported sprints: N new
✓ Imported releases: N new
✓ Post-import hooks complete

✅ Import Complete!
  Created: 5 tickets
  Updated: 0 tickets
```

**Inspect what was created:**

```bash
ls issues/
cat issues/YOUR-1.md     # look at the frontmatter and body
ls .tract/sprints/       # sprint YAML files
ls .tract/releases/      # release YAML files
ls .tract/worklogs/      # worklog JSONL files
```

---

## Step 5 — Verify key fields

Open a ticket file and check:

```yaml
---
id: APP-123
title: "The ticket title"
status: in-progress       # should be normalised (not "In Progress")
priority: critical        # should be normalised (not "Critical")
fix_versions: ["6.8.0"]   # array, not single string
affected_versions: []
sprints: ["sprint-7"]
rank: "0|hzzzzz:"
environment: "production" # if it's a bug
reporter: sarah
assignee: john
customer: "Acme Corp"     # only if custom_field_map is configured
links:
  - rel: blocks
    ref: APP-456
---
```

**If fields are missing or wrong** — see [references/troubleshooting.md](references/troubleshooting.md).

---

## Step 6 — Find your custom field IDs

Your Jira instance will have custom fields with IDs like `customfield_10042`.
To find which IDs map to which fields:

```bash
tract import --limit 1    # import one ticket
cat issues/YOUR-1.md      # do you see any customfield_NNNNN keys?
```

If you enabled `custom_field_passthrough: true` in config, all custom fields
appear verbatim. Otherwise run:

```bash
# Ask Jira for all custom field definitions
curl -u "$JIRA_USERNAME:$JIRA_TOKEN" \
  "https://jira.your-company.com/rest/api/2/field" | \
  python3 -m json.tool | grep -A2 '"custom": true'
```

Then add mappings to `config.yaml`:

```yaml
jira:
  custom_field_map:
    customfield_10042: customer
    customfield_10100: account_id
    customfield_10200: sla_tier
```

Re-run `tract import --limit 5` to see the mapped fields.

---

## Step 7 — Auto-detect your sprint field

If sprint fields are not appearing in tickets, Tract needs to know your instance's
sprint custom field ID (it varies: `customfield_10020` is common on Cloud,
`customfield_10119` on older Server):

```bash
# Find sprint field automatically
tract import --limit 1
grep -r "sprint" issues/*.md     # if sprints appear, it auto-detected
```

If no sprints appear, add to `config.yaml`:

```yaml
jira:
  sprint_field: customfield_10020   # adjust until sprints appear
```

---

## Step 8 — View the board

Once you have tickets imported:

```bash
tract board              # auto-detects open sprint
tract board --sprint all  # all tickets
tract board --sprint backlog  # tickets not in current sprint
```

Press `q` to quit, `r` to refresh.

---

## Rate limits and account safety

The importer has built-in protection:
- **250ms pause** between paginated pages
- **Automatic retry** on 429 (rate limit) and 5xx errors with exponential backoff
- Respects the `Retry-After` header if Jira sends one

**To be extra safe on a shared server:**

```bash
tract import --limit 10    # never import more than ~50 on first run
```

If you hit a rate limit, wait 5 minutes and try again with a smaller limit.
If your account is locked, contact your Jira admin — it's a separate lockout
from the rate limiter and only an admin can unlock it.

---

## Common problems

See [references/troubleshooting.md](references/troubleshooting.md) for:

- Authentication errors (401, 403)
- Missing fields (status, sprint, custom fields)
- Sprint field not detected
- Rate limit / account lockout
- Emoji/Unicode in ticket titles causing YAML parse errors
