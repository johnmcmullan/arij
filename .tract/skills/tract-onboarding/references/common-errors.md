# Common Onboarding Errors

Quick reference for error messages and fixes.

## Directory Errors

### Error: Directory not empty

```
❌ Error: Directory not empty: /home/john/my-tickets
   Remove files or use a different --output directory
```

**Why:** Onboarding requires an empty directory to avoid overwriting existing work.

**Fix:**
```bash
# Option 1: Use a different directory
mkdir fresh-tickets
tract onboard --output fresh-tickets ...

# Option 2: Clear the directory (careful!)
rm -rf my-tickets/*
tract onboard --output my-tickets ...
```

### Error: Not a git repository (submodule mode)

```
❌ Error: Parent directory is not a git repository: /home/john/code/myapp
   Run: cd /home/john/code/myapp && git init
```

**Why:** `--submodule` requires the parent directory to be a git repo.

**Fix:**
```bash
cd /home/john/code/myapp
git init
tract onboard --submodule tickets ...
```

### Error: Submodule path already exists

```
❌ Error: Submodule path already exists: /home/john/code/myapp/tickets
```

**Why:** Can't add submodule to an existing path.

**Fix:**
```bash
# Remove or rename existing directory
mv tickets tickets-old
tract onboard --submodule tickets ...
```

## Authentication Errors

### Error: 401 Unauthorized

```
❌ Jira API Error: 401 Unauthorized
💡 Tip: Check your username and token/password
```

**Why:** Wrong credentials or expired token.

**Fix:**
1. Check username: `echo $JIRA_USERNAME`
2. Generate new API token: https://id.atlassian.com/manage/api-tokens
3. Verify Jira URL is correct

### Error: 403 Forbidden

```
❌ Jira API Error: 403 Forbidden
```

**Why:** User doesn't have permission to access the project.

**Fix:**
1. Browse to project in Jira web UI - can you see it?
2. Ask Jira admin to grant access
3. Verify project key is correct

### Error: 404 Not Found

```
❌ Jira API Error: 404 Not Found
💡 Tip: Project "XYZ" may not exist
```

**Why:** Project doesn't exist or wrong project key.

**Fix:**
1. Check project key spelling (case matters in some setups)
2. Browse to: `https://jira.company.com/browse/XYZ-1`
3. List available projects in Jira

## Connection Errors

### Error: ENOTFOUND

```
❌ Error: getaddrinfo ENOTFOUND jira.company.com
💡 Tip: Check Jira URL: https://jira.company.com
```

**Why:** DNS can't resolve domain (wrong URL or VPN required).

**Fix:**
1. Ping domain: `ping jira.company.com`
2. Check VPN connection
3. Verify URL spelling
4. Try browsing in web browser

### Error: ECONNREFUSED

```
❌ Error: connect ECONNREFUSED 10.1.2.3:443
```

**Why:** Jira server not responding (down or firewall blocking).

**Fix:**
1. Try browsing to Jira URL
2. Check with IT/admin if Jira is down
3. Verify no firewall blocking API access

### Error: Certificate errors

```
❌ Error: unable to verify the first certificate
```

**Why:** Self-signed SSL certificate (common with self-hosted Jira).

**Fix (temporary, for testing):**
```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 tract onboard ...
```

**Fix (proper):** Get IT to install valid SSL certificate or add CA to system trust.

## Parameter Errors

### Error: --user required

```
❌ Error: --user required or set JIRA_USERNAME
```

**Fix:**
```bash
# Option 1: Use flag
tract onboard --user john.mcmullan ...

# Option 2: Set env var
export JIRA_USERNAME="john.mcmullan"
tract onboard ...
```

### Error: --token or --password required

```
❌ Error: --token or --password required, or set JIRA_TOKEN/JIRA_PASSWORD
```

**Fix:**
```bash
# Recommended: API token via env var
export JIRA_TOKEN="your-api-token"
tract onboard ...

# Or: flag
tract onboard --token "your-api-token" ...
```

### Error: --jira required

```
❌ Error: --jira <url> required (or use --local for local-only project)
```

**Fix:**
```bash
# For Jira sync:
tract onboard --jira https://jira.company.com ...

# For local-only:
tract onboard --local ...
```

## Git Errors

### Error: Git not found

```
ℹ Git installed
✗ Git not found in PATH
Fix: Install git: https://git-scm.com/downloads
```

**Why:** Git not installed or not in PATH.

**Fix:**
1. Install git: https://git-scm.com/downloads
2. Restart terminal
3. Verify: `git --version`

### Error: Git user not configured

```
⚠ Git user not configured
Fix: git config user.name "Your Name" && git config user.email "you@example.com"
```

**Why:** Git requires user identity for commits.

**Fix:**
```bash
git config --global user.name "John McMullan"
git config --global user.email "john.mcmullan@company.com"
```

## Import Errors

### Error: No tickets found

```
⚠ No tickets imported (0 found matching criteria)
```

**Why:** Project has no tickets, or all are in a non-matching status.

**Fix:**
- Check Jira web UI - are there tickets?
- Try `--status all` to import everything
- Specify custom JQL: `tract import --jql "project=APP AND status!=Done"`

### Error: Timeout during import

```
❌ Error: Timeout after 234 tickets
```

**Why:** Large import taking too long.

**Fix:**
```bash
# Import in batches
tract onboard --limit 100 --import-tickets
# Then later:
tract import --limit 500
```

## Validation Errors

### Error: Invalid YAML

```
❌ Error: Invalid YAML in config.yaml
```

**Why:** Generated config has syntax errors (rare, report as bug).

**Fix:**
1. Check `.tract/config.yaml` syntax
2. Run: `tract doctor` for detailed check
3. Report to Tract maintainer if generated during onboard

## When All Else Fails

1. **Run `tract doctor`** - it diagnoses most issues
2. **Check logs:** Look for more detailed errors in terminal output
3. **Minimal test:** Try local-only mode first:
   ```bash
   mkdir test && cd test
   tract onboard --project TEST --local
   ```
4. **Report bug:** If onboard consistently fails, file an issue with full error output
