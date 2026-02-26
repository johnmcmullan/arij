# Jira Import Troubleshooting

## Authentication errors

### 401 Unauthorized

```
Error: Request failed with status code 401
```

**Causes:**
- Wrong username or token
- Token has been revoked
- Using your login password instead of an API token

**Fix:**
```bash
# Verify credentials work directly
curl -u "$JIRA_USERNAME:$JIRA_TOKEN" \
  "https://jira.your-company.com/rest/api/2/myself" | python3 -m json.tool
```

Should return your user details. If it returns 401, the token is wrong.

For **Jira Server without Personal Access Tokens** (older than 8.14), use
your username and password but note the account lockout risk. Ask your admin
to raise `jira.user.max.sessions` and disable the lockout timer for your
test account.

### 403 Forbidden

You're authenticated but don't have Browse permission for the project.
Ask your Jira admin to grant you Browse Project permission.

---

## Missing or wrong fields

### `status` shows raw Jira name (e.g. "In Progress" not "in-progress")

Tract normalises statuses against the list in `config.yaml`. If your Jira
uses status names not in that list, normalisation falls back to `open`.

**Fix:** Add your Jira statuses to config:

```yaml
statuses: [backlog, todo, in-progress, in-review, done, closed, cancelled]
```

Or use wildcard to accept anything:
```yaml
statuses: ['*']
```

### Sprints not appearing in tickets

The sprint field ID varies by Jira instance. The importer auto-detects it,
but detection can fail if no issues have sprint data in the first batch.

**Fix:** Find and set it manually:

```bash
# Fetch one issue's raw fields to find the sprint key
curl -u "$JIRA_USERNAME:$JIRA_TOKEN" \
  "https://jira.your-company.com/rest/api/2/issue/YOUR-1?fields=*all" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
for k, v in data['fields'].items():
    if v and 'sprint' in str(v).lower():
        print(k, ':', str(v)[:80])
"
```

Add to config.yaml:
```yaml
jira:
  sprint_field: customfield_10020   # use whatever key you found above
```

### `fix_versions` not appearing

Check the raw Jira field name:
```bash
curl -u "$JIRA_USERNAME:$JIRA_TOKEN" \
  "https://jira.your-company.com/rest/api/2/issue/YOUR-1?fields=fixVersions" | \
  python3 -m json.tool
```

`fixVersions` is a standard Jira field — if it's empty the tickets just have
no fix version set in Jira.

### Custom fields appearing as `customfield_NNNNN`

You need a mapping. Enable passthrough first to discover what's there:

```yaml
jira:
  custom_field_passthrough: true
```

Import one ticket, look at the frontmatter, note the field IDs. Then add
named mappings and disable passthrough:

```yaml
jira:
  custom_field_passthrough: false
  custom_field_map:
    customfield_10042: customer
```

---

## Rate limiting and account lockout

### HTTP 429 — Rate limit hit

The importer will automatically retry with exponential backoff (up to 4 times).
You'll see:

```
[jira] 429 – retrying in 1s (attempt 1/4)
```

If all retries fail, wait 5 minutes and try again. Reduce `--limit` if it
keeps hitting the rate limit.

For Jira Server: the rate limit is configured in `jira.properties`. Ask your
admin:
```
jira.ratelimiting.maxrequests=100
jira.ratelimiting.period=60
```

### Account locked out

Symptoms: 401 even with correct credentials, admin receives lockout alert.

This is a **separate mechanism** from the API rate limiter. It's triggered by
too many failed authentication attempts (wrong password, not wrong token).

**Prevention:** Always use an API token, not your password. Failed token auth
does not trigger the lockout on most Jira versions.

**Recovery:** Only a Jira admin can unlock the account. They go to:
Admin → User Management → Your user → Unlock.

---

## YAML parse errors

### `YAMLException: unexpected end of the stream`

Usually caused by colons or special characters in ticket titles without
quoting. The importer should handle this via `js-yaml`'s dump, but if
you see it:

```bash
# Find which ticket is broken
for f in issues/*.md; do
  node -e "
    const y = require('js-yaml');
    const c = require('fs').readFileSync('$f', 'utf8');
    const m = c.match(/^---\n([\s\S]*?)\n---/);
    if (m) try { y.load(m[1]); } catch(e) { console.log('$f', e.message); }
  "
done
```

### Unicode / emoji in titles

Some Jira instances allow emoji in summary fields. The YAML serialiser
handles them fine, but blessed (the terminal UI) may display them as
double-width. The board replaces known problem characters automatically.

---

## Import seems slow

With the 250ms inter-page delay, importing 500 tickets (5 pages of 100)
takes about 1.25 seconds of deliberate pausing plus Jira response time.
That's expected and intentional.

For very large imports (1000+ tickets), run during off-hours and use
`--limit` in batches to avoid holding a long-running connection.
