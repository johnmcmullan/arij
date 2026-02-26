# Jira Authentication Guide

## Getting a Jira API Token

### Atlassian Cloud (jira.atlassian.com)

1. Go to: https://id.atlassian.com/manage/api-tokens
2. Click **Create API token**
3. Give it a name (e.g., "Tract CLI")
4. Copy the token (you won't see it again)
5. Set environment variable:
   ```bash
   export JIRA_TOKEN="your-token-here"
   echo 'export JIRA_TOKEN="your-token-here"' >> ~/.bashrc
   ```

### Jira Server / Data Center (self-hosted)

Check with your Jira admin:
- Some use API tokens (same as Cloud)
- Some use passwords
- Some use OAuth or SSO

If your org uses passwords:
```bash
tract onboard --password <your-password>
# Or:
export JIRA_PASSWORD="your-password"
```

## Environment Variables vs Flags

**Best practice:** Use environment variables

```bash
# Set once in ~/.bashrc or ~/.zshrc
export JIRA_USERNAME="john.mcmullan"
export JIRA_TOKEN="your-api-token-here"

# Then onboard without exposing credentials in command line
tract onboard --project APP --jira https://jira.company.com
```

**Flags work but are less secure:**
```bash
# Token visible in shell history and process list
tract onboard --user john --token ghp_xxxxx ...
```

## Testing Authentication

Quick test before onboarding:

```bash
curl -u "$JIRA_USERNAME:$JIRA_TOKEN" \
  "https://jira.company.com/rest/api/2/myself"
```

If successful, you'll see your user profile JSON.

## Common Auth Errors

### 401 Unauthorized

**Possible causes:**
- Wrong username
- Wrong/expired token
- Wrong Jira URL
- User account disabled

**Fixes:**
1. Verify username: `echo $JIRA_USERNAME`
2. Generate new token
3. Check Jira URL (try browsing to it)
4. Contact Jira admin if account locked

### 403 Forbidden

**Possible causes:**
- User doesn't have permission to access project
- Project doesn't exist
- API access disabled for your account

**Fixes:**
1. Browse to Jira project in web UI - can you see it?
2. Check project key spelling
3. Ask Jira admin to grant project access

### Connection Errors

```
Error: getaddrinfo ENOTFOUND jira.company.com
```

**Possible causes:**
- Wrong domain
- VPN required
- DNS issue

**Fixes:**
1. Ping the domain: `ping jira.company.com`
2. Check VPN connection
3. Try full URL in browser

## Security Best Practices

1. **Use API tokens, not passwords**
2. **Store in environment variables, not command line**
3. **Rotate tokens regularly** (every 90 days)
4. **Revoke old tokens** from https://id.atlassian.com/manage/api-tokens
5. **Don't commit tokens to git** (add to .gitignore if in scripts)

## Troubleshooting Checklist

- [ ] Token/password correct?
- [ ] Username correct (often email)?
- [ ] Jira URL includes `https://`?
- [ ] Jira URL has no trailing slash?
- [ ] Can you browse to Jira URL in a browser?
- [ ] Can you see the project in Jira web UI?
- [ ] Is VPN required?
- [ ] Environment variables set correctly?
- [ ] Token not expired?

Run through this list before escalating to admin.
