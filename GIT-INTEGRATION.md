# Git Integration

Tract automatically links commits to tickets via git post-receive hooks.

## How It Works

1. Developer commits with ticket ID in message: `git commit -m "TB-001: Fix login bug"`
2. On push, git server runs post-receive hook
3. Hook sends commit data to Tract webhook endpoint
4. Tract parses commit message for ticket IDs (`TB-001`, `APP-456`, etc.)
5. Adds commit as a comment to the linked ticket(s)

## Setup

### 1. Configure Webhook Secret

Set an environment variable before starting Tract:

```bash
export TRACT_WEBHOOK_SECRET="your-secret-key-here"
node app.js
```

Or add to your `.env` file (requires dotenv):

```
TRACT_WEBHOOK_SECRET=your-secret-key-here
```

### 2. Install Git Hook

For each repository that should link to Tract:

```bash
# Copy the sample hook
cp git-hooks/post-receive.sample /path/to/repo/.git/hooks/post-receive

# Make it executable
chmod +x /path/to/repo/.git/hooks/post-receive

# Set the secret (same as Tract)
export TRACT_WEBHOOK_SECRET="your-secret-key-here"
```

**For bare repos** (server-side git):
```bash
cp git-hooks/post-receive.sample /path/to/repo.git/hooks/post-receive
chmod +x /path/to/repo.git/hooks/post-receive
```

### 3. Test

Push a commit with a ticket ID:

```bash
git commit -m "TB-001: Test git integration"
git push
```

You should see:
```
✓ Tract: linked commits to tickets
  → TB-001
```

## Commit Message Format

Tract extracts ticket IDs using the pattern: **`[A-Z]{2,10}-\d+`**

Valid formats:
- `TB-001: Fix bug` → links to TB-001
- `APP-456 and TB-789: Refactor` → links to both
- `Merge TB-123 into main` → links to TB-123

Invalid (won't link):
- `tb-001` (lowercase)
- `T-1` (project key too short)
- `TOOLONGKEY-123` (project key >10 chars)

## Webhook Endpoint

**URL:** `http://localhost:3000/api/webhooks/git`

**Method:** POST

**Headers:**
- `Content-Type: application/json`
- `X-Git-Secret: <your-secret>`

**Payload:**
```json
{
  "repo": "myproject",
  "ref": "refs/heads/main",
  "before": "abc123...",
  "after": "def456...",
  "commits": [
    {
      "id": "def456...",
      "message": "TB-001: Fix login bug",
      "author": "John Doe",
      "timestamp": "2026-02-12T08:00:00Z"
    }
  ]
}
```

**Response (success):**
```json
{
  "success": true,
  "processed": 1,
  "linked": 1,
  "tickets": ["TB-001"]
}
```

## Testing Without Git

```bash
curl -X POST http://localhost:3000/api/webhooks/git \
  -H "Content-Type: application/json" \
  -H "X-Git-Secret: your-secret-key-here" \
  -d '{
    "repo": "test-repo",
    "ref": "refs/heads/main",
    "before": "0000000",
    "after": "abc1234",
    "commits": [{
      "id": "abc1234567890",
      "message": "TB-001: Test commit",
      "author": "Test User",
      "timestamp": "2026-02-12T08:00:00Z"
    }]
  }'
```

## Security

- **Always use HTTPS** in production
- **Change the default secret** before deployment
- **Validate the secret** on every webhook request
- Consider IP allowlisting if running on the same machine

## Troubleshooting

**Hook fails with "curl: command not found"**
- Install curl: `apt install curl` or `yum install curl`

**Hook fails with "jq: command not found"**
- Install jq: `apt install jq` or `yum install jq`

**Webhook returns 401/403**
- Check `TRACT_WEBHOOK_SECRET` is set correctly in both Tract and hook
- Ensure secrets match exactly (no extra spaces/newlines)

**Commits link but don't show in ticket**
- Check ticket ID matches exactly (case-sensitive)
- View ticket detail page → scroll to comments
- Check Tract server logs for errors

## Future Enhancements

- [ ] Branch creation from ticket view (via git provider API)
- [ ] PR/MR status tracking
- [ ] Automatic ticket status updates on merge
- [ ] Bamboo CI trigger integration
- [ ] Documentation build trigger on merge
