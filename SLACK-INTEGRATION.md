# Tract Slack Integration

Simple notification system for ticket updates via Slack webhooks.

## Why Slack Over Email?

**Slack is easier:**
- ✅ No SMTP server needed
- ✅ No spam filter issues
- ✅ No HTML email formatting
- ✅ Better team visibility (everyone sees updates)
- ✅ Rich formatting with attachments/colors
- ✅ Just HTTP POST to webhook URL

**Complexity:** Email = ⭐⭐⭐⭐☆ | Slack = ⭐☆☆☆☆

## Basic Setup (5 minutes)

### 1. Create Slack Incoming Webhook

1. Go to https://api.slack.com/apps
2. Create new app (or use existing)
3. Add "Incoming Webhooks" feature
4. Activate webhooks
5. Create webhook for channel (e.g., `#tickets`)
6. Copy webhook URL: `https://hooks.slack.com/services/T00/B00/XXX`

### 2. Install Git Hook

**For server deployment:**

```bash
# On ticket repo server
cd /opt/tract-data/app-tickets/.git/hooks

# Create post-receive hook
cat > post-receive << 'BASH'
#!/bin/bash

SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
CHANNEL="#tickets"

while read oldrev newrev ref; do
  # Skip if deleting branch
  if [ "$newrev" = "0000000000000000000000000000000000000000" ]; then
    continue
  fi
  
  # Get commits
  for commit in $(git rev-list $oldrev..$newrev); do
    msg=$(git log -1 --pretty=format:"%s" $commit)
    author=$(git log -1 --pretty=format:"%an" $commit)
    
    # Extract ticket ID (APP-123, TB-456, etc)
    ticket=$(echo "$msg" | grep -oP '[A-Z]+-\d+' | head -1)
    
    if [ -n "$ticket" ]; then
      # Determine action from commit message
      color="good"
      action="updated"
      
      if echo "$msg" | grep -qi "create\|add"; then
        color="warning"
        action="created"
      elif echo "$msg" | grep -qi "close\|fix\|resolve"; then
        color="good"
        action="closed"
      fi
      
      # Post to Slack
      curl -X POST "$SLACK_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{
          \"channel\": \"$CHANNEL\",
          \"username\": \"Tract Bot\",
          \"icon_emoji\": \": ticket:\",
          \"text\": \"🎫 *$ticket* $action by $author\",
          \"attachments\": [{
            \"text\": \"$msg\",
            \"color\": \"$color\",
            \"footer\": \"Tract\",
            \"ts\": $(date +%s)
          }]
        }"
    fi
  done
done
BASH

chmod +x post-receive
```

### 3. Test It

```bash
cd /opt/tract-data/app-tickets

# Make a test commit
echo "test" > test.txt
git add test.txt
git commit -m "Update APP-12345 status to closed"
git push

# Check Slack - you should see notification!
```

## Rich Notifications

### With Ticket Details

```bash
#!/bin/bash
# Enhanced hook with ticket metadata

SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK"

while read oldrev newrev ref; do
  for commit in $(git rev-list $oldrev..$newrev); do
    msg=$(git log -1 --pretty=format:"%s" $commit)
    ticket=$(echo "$msg" | grep -oP '[A-Z]+-\d+' | head -1)
    
    if [ -n "$ticket" ] && [ -f "issues/$ticket.md" ]; then
      # Parse ticket frontmatter
      title=$(grep "^title:" "issues/$ticket.md" | cut -d: -f2- | xargs)
      status=$(grep "^status:" "issues/$ticket.md" | cut -d: -f2 | xargs)
      assignee=$(grep "^assignee:" "issues/$ticket.md" | cut -d: -f2 | xargs)
      priority=$(grep "^priority:" "issues/$ticket.md" | cut -d: -f2 | xargs)
      
      # Build rich notification
      curl -X POST "$SLACK_WEBHOOK" \
        -H 'Content-Type: application/json' \
        -d "{
          \"text\": \"🎫 *$ticket*: $title\",
          \"attachments\": [{
            \"fields\": [
              {\"title\": \"Status\", \"value\": \"$status\", \"short\": true},
              {\"title\": \"Assignee\", \"value\": \"$assignee\", \"short\": true},
              {\"title\": \"Priority\", \"value\": \"$priority\", \"short\": true}
            ],
            \"footer\": \"$msg\",
            \"color\": \"good\"
          }]
        }"
    fi
  done
done
```

### Example Output in Slack

```
Tract Bot  APP BOT  12:34 PM
🎫 APP-12345: Fix portfolio FX hedger order size quote

Status: closed        Assignee: john.mcmullan
Priority: critical

Update APP-12345 status to closed
```

## Multiple Channels

**Route by priority:**

```bash
# Critical bugs → #alerts
# Normal updates → #tickets

priority=$(grep "^priority:" "issues/$ticket.md" | cut -d: -f2 | xargs)

if [ "$priority" = "critical" ] || [ "$priority" = "blocker" ]; then
  CHANNEL="#alerts"
else
  CHANNEL="#tickets"
fi
```

**Route by component:**

```bash
# FX tickets → #fx-team
# ETF tickets → #etf-team

component=$(grep "^components:" -A1 "issues/$ticket.md" | tail -1 | xargs | tr -d '-')

case "$component" in
  *FX*|*fx*)
    CHANNEL="#fx-team"
    ;;
  *ETF*|*etf*)
    CHANNEL="#etf-team"
    ;;
  *)
    CHANNEL="#tickets"
    ;;
esac
```

## Advanced: Slack Commands (Optional)

For `/tract` slash commands in Slack:

### 1. Create Slack App with Slash Commands

1. Add "Slash Commands" feature
2. Create command: `/tract query [search]`
3. Request URL: `https://tickets.company.com/api/slack/command`

### 2. API Endpoint in Tract Server

```javascript
// In tract web server (app.js)

app.post('/api/slack/command', async (req, res) => {
  const { text, user_name } = req.body;
  
  // Parse command: /tract query open bugs in FX
  if (text.startsWith('query ')) {
    const query = text.substring(6);
    
    // Search tickets (simple grep-based for now)
    const results = searchTickets(query);
    
    res.json({
      response_type: 'in_channel',
      text: `Found ${results.length} tickets:`,
      attachments: results.slice(0, 5).map(ticket => ({
        text: `*${ticket.id}*: ${ticket.title}`,
        color: ticket.status === 'open' ? 'danger' : 'good'
      }))
    });
  }
});
```

### 3. Use in Slack

```
/tract query open critical bugs in FX
```

Returns:
```
Found 3 tickets:
🎫 APP-12345: Portfolio FX hedger order size quote
🎫 APP-12346: FX algo configuration bug
🎫 APP-12347: FX market data feed issue
```

## Installation Script

**Quick setup for all ticket repos:**

```bash
#!/bin/bash
# install-slack-hook.sh

WEBHOOK_URL="$1"

if [ -z "$WEBHOOK_URL" ]; then
  echo "Usage: $0 <slack-webhook-url>"
  exit 1
fi

for repo in /opt/tract-data/*-tickets; do
  echo "Installing hook in $repo..."
  
  cat > "$repo/.git/hooks/post-receive" << EOF
#!/bin/bash
SLACK_WEBHOOK="$WEBHOOK_URL"
# ... [full hook script from above]
EOF
  
  chmod +x "$repo/.git/hooks/post-receive"
  echo "✓ Installed in $repo"
done

echo ""
echo "✅ Slack hooks installed in all repos!"
echo "Test with: cd <repo> && git commit -m 'Test APP-123' && git push"
```

**Run once:**

```bash
./install-slack-hook.sh "https://hooks.slack.com/services/T00/B00/XXX"
```

## Notification Types

**What triggers notifications:**

| Event | Trigger | Message |
|-------|---------|---------|
| Create ticket | Git commit with "Create APP-123" | 🎫 **APP-123** created by john |
| Update ticket | Git commit with "Update APP-123" | 🎫 **APP-123** updated by john |
| Close ticket | Git commit with "Close APP-123" | 🎫 **APP-123** closed by john |
| Comment | Git commit with "Comment on APP-123" | 💬 Comment added to **APP-123** |
| Status change | Git commit changes status field | 📊 **APP-123** moved to in-progress |

## Testing

**Local testing without pushing:**

```bash
# Simulate post-receive hook
echo "0000000 $(git rev-parse HEAD) refs/heads/master" | \
  .git/hooks/post-receive
```

**Check Slack webhook:**

```bash
curl -X POST "https://hooks.slack.com/services/YOUR/WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d '{"text": "Test from Tract!"}'
```

## Performance

**Webhook calls are async:**
- Git push returns immediately
- Hook posts to Slack in background
- No delay for users

**Rate limits:**
- Slack webhooks: 1 message per second
- Batch commits if needed
- Or use Slack API with higher limits

## Security

**Webhook URL is sensitive:**
- Don't commit to git
- Store in environment variable
- Or use git config:

```bash
git config tract.slackWebhook "https://hooks.slack.com/..."

# In hook script:
SLACK_WEBHOOK=$(git config tract.slackWebhook)
```

## Summary

**Slack Integration:**
- ⏱️ Setup time: 5 minutes
- 💻 Code: ~30 lines of bash
- 🔧 Maintenance: None (just works)
- 💰 Cost: Free (Slack webhooks)

**vs Email:**
- ⏱️ Setup time: Hours
- 💻 Code: 100+ lines
- 🔧 Maintenance: SMTP server
- 💰 Cost: Email server

**Recommendation:** Use Slack! It's easier, better, and free.
