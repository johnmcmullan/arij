# Tract Security Architecture

## Overview

Tract implements a Personal Access Token (PAT) based security system for:
- API authentication (`tract serve`)
- Authorization (project-based permissions)
- Audit logging (all access tracked)
- Rate limiting (prevent bulk data exfiltration)

This matches the existing Jira bridge PAT pattern and provides simple, practical security for internal deployments.

## Authentication

### Personal Access Tokens (PATs)

Tract uses PATs for all API access. Each user generates their own tokens:

```bash
# Create a token
tract token create --name "copilot-cli" --ttl 365

# Output (shown once):
# ✓ Token created successfully
#
# Token (save this securely, it will not be shown again):
#   tract_am9obi5tY21pbGxhbkBvcmMuY29tOjhlZjJhNGI3Yw==
#
# Add to your environment:
#   export TRACT_API_TOKEN="tract_am9obi5tY21pbGxhbkBvcmMuY29tOjhlZjJhNGI3Yw=="
```

### Using Tokens

**Environment variable** (recommended):
```bash
export TRACT_API_TOKEN="tract_xxx"
tract create APP --title "New ticket"
```

**API requests**:
```bash
# Bearer token
curl -H "Authorization: Bearer tract_xxx" http://localhost:7766/api/tickets

# X-Tract-Token header
curl -H "X-Tract-Token: tract_xxx" http://localhost:7766/api/tickets
```

### Token Management

```bash
# List your tokens
tract token list

# Revoke a token
tract token revoke tract_xxx

# Create service account token (admin only)
tract token create-service --user agent@example.com --name "ci-bot" --ttl 365
```

## Authorization

### Permissions Model

Permissions are configured in `/opt/tract/.tract/permissions.yaml`:

```yaml
projects:
  APP:
    teams:
      - name: engineering
        members:
          - "john.mcmullan@orcsoftware.com"
        permissions:
          - "read:tickets"
          - "write:tickets"
          - "read:worklogs"
          - "write:worklogs"
          - "read:embeddings"
          - "git:clone"
          - "git:push"
        rate_limits:
          embeddings: "100/hour"
          api: "1000/hour"

      - name: sales
        members:
          - "bob.sales@orcsoftware.com"
        permissions:
          - "read:tickets"
        filters:
          exclude_labels: ["security", "internal"]
        rate_limits:
          embeddings: "20/hour"
          api: "100/hour"

admins:
  - "john.mcmullan@orcsoftware.com"
```

### Permission Types

- `read:tickets` - View tickets via API
- `write:tickets` - Create/modify tickets
- `read:worklogs` - View time logs
- `write:worklogs` - Log time
- `read:embeddings` - Search via semantic embeddings
- `git:clone` - Clone git repositories
- `git:push` - Push to git repositories

### Ticket Filtering

Teams can be restricted from seeing certain tickets:

```yaml
filters:
  exclude_labels: ["security", "internal", "confidential"]
  exclude_components: ["auth", "billing", "infrastructure"]
```

Filtered tickets are invisible to the team in all views (API, dashboards, embeddings).

## Rate Limiting

Rate limits prevent bulk data exfiltration:

```yaml
rate_limits:
  api: "1000/hour"        # API requests per hour
  embeddings: "100/hour"  # Semantic searches per hour
```

When exceeded, requests return `429 Too Many Requests` with `Retry-After` header.

**Format**: `<count>/<unit>` where unit is `minute`, `hour`, or `day`

## Audit Logging

All access is logged to `/opt/tract/.tract/audit/YYYY-MM-DD.jsonl` in JSON Lines format.

### Example Log Entry

```json
{
  "timestamp": "2026-03-16T14:35:22Z",
  "user": "john.mcmullan@orcsoftware.com",
  "action": "read:tickets",
  "resource": "APP",
  "method": "GET",
  "endpoint": "/api/tickets?project=APP",
  "ip": "192.168.1.100",
  "success": true,
  "status": 200,
  "result_count": 3347
}
```

### Querying Audit Logs

```bash
# View today's logs
cat /opt/tract/.tract/audit/$(date +%Y-%m-%d).jsonl | jq '.'

# Filter by user
jq 'select(.user == "john.mcmullan@orcsoftware.com")' audit/*.jsonl

# Filter by action
jq 'select(.action == "read:embeddings")' audit/*.jsonl

# Count API calls by user
jq -r '.user' audit/*.jsonl | sort | uniq -c | sort -rn

# Find failed auth attempts
jq 'select(.status == 401)' audit/*.jsonl

# Detect high-volume queries (potential exfiltration)
jq -r 'select(.action == "read:embeddings") | .user' audit/*.jsonl | \
  sort | uniq -c | awk '$1 > 50 {print "ALERT: "$2" made "$1" queries"}'
```

## Enabling Security

### Phase 1: Monitoring Mode (Default)

Authentication is disabled by default to allow safe deployment:

```bash
# Start serve (auth disabled, but logged)
tract serve

# All requests succeed, but are logged
curl http://localhost:7766/api/tickets  # Works
```

Audit logs show all access, allowing you to:
- Test token generation
- Verify permissions configuration
- Check for issues before enforcement

### Phase 2: Enforcement Mode

Enable authentication enforcement:

```bash
# Set environment variable
export TRACT_AUTH_ENABLED=true

# Start serve with auth enabled
tract serve

# Requests without tokens are rejected
curl http://localhost:7766/api/tickets
# {"error":"Authentication required","hint":"Set TRACT_API_TOKEN..."}

# Requests with valid tokens succeed
export TRACT_API_TOKEN="tract_xxx"
curl -H "Authorization: Bearer $TRACT_API_TOKEN" http://localhost:7766/api/tickets
# [tickets...]
```

### Making It Permanent

Add to systemd service:

```ini
[Service]
Environment="TRACT_AUTH_ENABLED=true"
ExecStart=/opt/tract/bin/tract serve
```

## Security Properties

✅ **Authentication** - PAT-based, self-service, revocable
✅ **Authorization** - Project/team-based permissions
✅ **Audit Logging** - All access tracked (who, what, when, where)
✅ **Rate Limiting** - Prevents bulk data exfiltration
✅ **Ticket Filtering** - Team-specific visibility controls
✅ **LLM-Friendly** - Works with CLI, API clients, and agents
✅ **Phased Rollout** - Deploy safely with monitoring mode first

## Threat Model

### Primary Threat: Data Exfiltration via Embeddings

**Scenario**: Employee leaving company queries embeddings to extract:
- Customer names and revenue projections
- Competitive intelligence from ticket discussions
- Internal technical details and vulnerabilities

**Attack vector**: `tract vsearch "customer revenue"` returns all relevant tickets semantically

**Mitigation**:
- Rate limiting (100 queries/hour for engineering, 20/hour for sales)
- Audit logging (all searches logged with query text)
- Anomaly detection (alert on >50 queries/day)

### Secondary Threats

- **Unauthorized API access** - Mitigated by PAT authentication
- **Cross-project snooping** - Mitigated by project-based permissions
- **Anonymous commits** - Mitigated by Git HTTPS with PAT (future phase)

## Deployment

See the security implementation guide:

```bash
/home/john.mcmullan/Claude/tract/security/README.md
/home/john.mcmullan/Claude/tract/security/DEPLOYMENT_GUIDE.md
```

## Future Phases

**Phase 2**: QMD Embeddings Security
- Auth proxy for QMD MCP server
- Same PAT auth + rate limits

**Phase 3**: Git HTTPS with PAT
- Replace unauthenticated git daemon
- nginx + git-http-backend with PAT verification

**Phase 4**: Monitoring & Alerts
- Daily anomaly detection
- Email/Slack alerts

## Troubleshooting

### Token not working

```bash
# Check token exists
ls /opt/tract/.tract/tokens/tract_xxx.yaml

# Check permissions.yaml
cat /opt/tract/.tract/permissions.yaml | grep your.email

# Check audit logs
tail -f /opt/tract/.tract/audit/$(date +%Y-%m-%d).jsonl
```

### Permission denied

Ensure user is in the appropriate team in `permissions.yaml`:

```yaml
projects:
  APP:
    teams:
      - name: engineering
        members:
          - "your.email@orcsoftware.com"  # Add yourself here
```

### Rate limit errors

Increase limits in `permissions.yaml`:

```yaml
rate_limits:
  api: "5000/hour"       # Increased from 1000/hour
  embeddings: "200/hour"  # Increased from 100/hour
```

File is reloaded automatically on each request.

## Design Principles

1. **Simple over complex** - PATs instead of SSO, files instead of database
2. **Match existing patterns** - Use Jira bridge PAT pattern
3. **Phased rollout** - Monitor first, enforce later
4. **Defense in depth** - Authentication + authorization + audit + rate limits
5. **LLM-friendly** - Works for humans and agents alike

## Support

For detailed implementation documentation, see:
- `/home/john.mcmullan/Claude/tract/security/FORJOHN.md` - Technical deep dive
- `/home/john.mcmullan/Claude/tract/security/README.md` - User guide
