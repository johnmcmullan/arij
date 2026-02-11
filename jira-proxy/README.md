# Tract Jira Proxy

A transparent HTTP proxy for gradually migrating from Jira to Tract.

## Purpose

This proxy sits between your organization and Jira, providing:

1. **Data Collection**: Logs all Jira API requests/responses to JSON files for LLM analysis
2. **Gradual Migration**: Redirects requests for migrated projects to Tract
3. **Transparent Operation**: Non-migrated projects continue working normally
4. **Usage Analytics**: Captures real-world Jira usage patterns and field schemas

## Architecture

```
[Clients] → [Tract Jira Proxy] → [Jira API]
              ↓ (if migrated)
           [Tract]
```

**For migrated projects:**
- Web browsers: HTTP 302 redirect to Tract UI
- API clients: HTTP 410 response with Tract endpoint information

**For active projects:**
- Transparent proxy to Jira
- All requests/responses logged to JSON

## Installation

```bash
cd ~/work/tract/jira-proxy
npm install
```

## Configuration

Edit `config/default.json`:

```json
{
  "jiraUrl": "https://your-jira.atlassian.net",
  "proxyPort": 8888,
  "tractUrl": "http://localhost:3000",
  "logsDir": "./logs",
  "migratedProjects": ["JK", "DEMO"],
  "logging": {
    "enabled": true,
    "logRequests": true,
    "logResponses": true,
    "organizeByProject": true,
    "organizeByDate": true
  }
}
```

**Fields:**
- `jiraUrl`: Your Jira instance URL
- `proxyPort`: Port for the proxy server
- `tractUrl`: Your Tract instance URL
- `logsDir`: Directory for JSON logs
- `migratedProjects`: Array of project keys that have been migrated to Tract
- `logging`: Logging configuration

## Usage

**Start the proxy:**
```bash
npm start
```

**Development mode (auto-reload):**
```bash
npm run dev
```

**Configure clients to use proxy:**

Update Jira URL in your tools/browsers to point to the proxy:
- Before: `https://your-jira.atlassian.net`
- After: `http://localhost:8888` (or your proxy server)

## Log Format

Logs are organized as:
```
logs/
  2026-02-11/
    APP/
      2026-02-11T18-30-00-000Z-GET-APP.json
      2026-02-11T18-30-01-234Z-POST-APP.json
    TB/
      2026-02-11T18-31-00-000Z-GET-TB.json
```

Each log file contains:
```json
{
  "timestamp": "2026-02-11T18:30:00.000Z",
  "projectKey": "APP",
  "method": "GET",
  "url": "/rest/api/2/issue/APP-123",
  "headers": {...},
  "userAgent": "Mozilla/5.0...",
  "statusCode": 200,
  "responseHeaders": {...},
  "responseBody": {...}
}
```

## Migration Workflow

1. **Deploy proxy** in your infrastructure
2. **Configure clients** to use proxy instead of Jira
3. **Collect data** for weeks/months - understand usage patterns
4. **Migrate a project** to Tract
5. **Add project key** to `migratedProjects` in config
6. **Restart proxy** - that project now routes to Tract
7. **Repeat** for each project

## Benefits of Capturing Real Traffic

Unlike `tbjira` queries, the proxy captures:
- **All fields** returned by Jira (including custom fields)
- **Complete responses** (no pagination limits)
- **Actual usage patterns** (which fields are actually used)
- **Relationships** (links, subtasks, attachments)
- **Metadata** (workflows, transitions, permissions)
- **Custom field schemas** (field types, allowed values)

This data is invaluable for:
- Building accurate Jira → Tract import scripts
- Understanding what features are actually used
- Validating Tract compatibility
- Training LLMs on your Jira structure

## Security Considerations

- Proxy logs contain sensitive data - secure the logs directory
- Use HTTPS in production (add SSL termination)
- Consider authentication for proxy access
- Be mindful of data retention policies
- Logs may contain API tokens/credentials in headers

## Monitoring

The proxy logs to console:
```
[2026-02-11T18:30:00.000Z] GET /browse/APP-123 | Project: APP | Migrated: false | Web: true
[LOG] GET /browse/APP-123 -> logs/2026-02-11/APP/2026-02-11T18-30-00-000Z-GET-APP.json
[REDIRECT] /browse/JK-001 -> http://localhost:3000/tickets/JK-001
```

## Troubleshooting

**Proxy won't start:**
- Check if port 8888 is already in use
- Verify Node.js version (v14+)

**Requests not being logged:**
- Check `logging.enabled` in config
- Verify `logsDir` is writable
- Check console for errors

**Redirects not working:**
- Verify project key in `migratedProjects`
- Check `tractUrl` is correct
- Restart proxy after config changes

## Future Enhancements

- [ ] SSL/TLS support
- [ ] Authentication/authorization
- [ ] Real-time analytics dashboard
- [ ] Automatic Tract API translation (full transparency)
- [ ] Response time metrics
- [ ] Error rate tracking
- [ ] Jira → Tract field mapping
