# Label Change Tracking

**Question:** Can we spot when labels are added or removed?

**Answer:** YES! Git tracks every label change automatically.

## Basic Queries

### Show Label Changes (Any Ticket)

```bash
# Show all label changes in git history
git log --all --grep='labels' --oneline

# Show detailed label changes
git log -p -- issues/*.md | grep -A2 -B2 'labels:'
```

### Show Label Changes (Specific Ticket)

```bash
# See all changes to APP-123's labels
git log -p issues/APP-123.md | grep -A2 -B2 'labels:'

# Output:
# commit abc123
# +labels: [performance, tbricks]
# -labels: [TBricks]
```

### Who Changed Labels?

```bash
# Show who modified labels and when
git log --all --oneline --author="john" -- issues/*.md | \
  xargs -I {} git show {} | grep 'labels:'
```

## LLM Queries

**User:** "Show me label changes in the last week"

**LLM:**
```bash
git log --since="1 week ago" -p -- issues/*.md | \
  grep -B5 'labels:' | \
  grep -E '^\+labels:|^-labels:'

# Output:
# +labels: [performance, tbricks]  # Added
# -labels: [TBricks, performance]  # Removed
```

**User:** "What labels were added to APP-123?"

**LLM:**
```bash
git log -p issues/APP-123.md | \
  grep '^\+labels:' | \
  tail -1

# Shows most recent label addition
```

**User:** "Track when 'high-priority' label was added"

**LLM:**
```bash
git log -p -- issues/*.md | \
  grep -B10 'high-priority' | \
  grep '^commit' | \
  head -1

# Shows first commit that added 'high-priority' label
```

## Advanced Tracking

### Label Diff Between Commits

```bash
# What labels changed between commits?
git diff HEAD~1 HEAD -- issues/APP-123.md | grep 'labels:'

# Output:
# -labels: [tbricks, performance]
# +labels: [tbricks, performance, high-priority]
#
# Interpretation: 'high-priority' added
```

### Label Audit Trail

```bash
# Full history of labels for a ticket
git log --format='%ai %an' --follow -p issues/APP-123.md | \
  grep -A1 'labels:' | \
  grep -v '^--$'

# Output:
# 2026-02-14 10:00:00 john.mcmullan
# labels: [tbricks, performance, high-priority]
# 2026-02-13 15:30:00 sarah.jones
# labels: [tbricks, performance]
# 2026-02-10 09:00:00 john.mcmullan
# labels: [TBricks]
```

## Automated Detection

### Post-Commit Hook (Alert on Label Changes)

```bash
# .git/hooks/post-commit
#!/bin/bash

# Check if labels changed in this commit
LABEL_CHANGES=$(git diff HEAD~1 HEAD -- issues/*.md | grep 'labels:')

if [ -n "$LABEL_CHANGES" ]; then
  echo "Labels changed in this commit:"
  echo "$LABEL_CHANGES"
  
  # Optional: Send notification
  # slack-notify "Labels changed: $LABEL_CHANGES"
fi
```

### CI/CD Label Report

```yaml
# .github/workflows/label-report.yml
on:
  push:
    paths: ['issues/**']

jobs:
  label-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          fetch-depth: 2  # Need previous commit
      
      - name: Detect label changes
        run: |
          CHANGED=$(git diff HEAD~1 HEAD -- issues/*.md | grep 'labels:')
          if [ -n "$CHANGED" ]; then
            echo "::notice::Labels changed in this push"
            echo "$CHANGED"
          fi
```

## Label Analytics

### Which Labels Are Growing?

**LLM query:**

**User:** "What labels have been added most in the last month?"

**LLM:**
```bash
# Get all label additions in last month
git log --since="1 month ago" -p -- issues/*.md | \
  grep '^\+labels:' | \
  sed 's/+labels: \[//; s/\]//' | \
  tr ',' '\n' | \
  sort | uniq -c | sort -rn

# Output:
#  15 high-priority
#  12 performance
#   8 tbricks
#   5 fix-protocol
```

### Which Labels Are Shrinking?

```bash
# Get all label removals in last month
git log --since="1 month ago" -p -- issues/*.md | \
  grep '^-labels:' | \
  sed 's/-labels: \[//; s/\]//' | \
  tr ',' '\n' | \
  sort | uniq -c | sort -rn

# Output:
#   8 TBricks  # Normalized away
#   5 old-tag
#   3 deprecated
```

### Label Churn (Added + Removed Frequently)

```bash
# Labels that change a lot
git log -p -- issues/*.md | \
  grep -E '^\+labels:|^-labels:' | \
  sed 's/[+-]labels: \[//; s/\]//' | \
  tr ',' '\n' | \
  sort | uniq -c | sort -rn

# High count = high churn (added/removed frequently)
```

## Use Cases

### 1. Label Cleanup Audit

**After running normalize-labels hook:**

```bash
# What changed?
git diff HEAD~1 HEAD -- issues/*.md | grep 'labels:' | \
  grep -E '^\+|^-' | head -20

# Output shows normalization:
# -labels: [TBricks, Performance]
# +labels: [performance, tbricks]
```

### 2. Track Label Evolution

**User:** "How did our label usage change over time?"

**LLM:**
```bash
# Label usage by month
for month in {01..12}; do
  echo "2026-$month:"
  git log --since="2026-$month-01" --until="2026-$month-31" -p -- issues/*.md | \
    grep '^\+labels:' | wc -l
done

# Shows label additions per month
```

### 3. Detect Unauthorized Changes

**Security hook:**

```bash
# Alert if sensitive labels removed
git diff HEAD~1 HEAD -- issues/*.md | \
  grep '^-labels:' | \
  grep -E 'security|critical|urgent'

# If found, alert security team
```

### 4. Label Compliance

**Check if required labels present:**

```bash
# All tickets should have priority label
git log --all --oneline -- issues/*.md | while read commit _; do
  git show $commit:issues/*.md 2>/dev/null | \
    grep -L 'priority' | \
    xargs -I {} echo "Missing priority: {}"
done
```

## Label Changelog

### Generate Label Change Report

```bash
# .tract/scripts/label-changelog.sh

#!/bin/bash

echo "Label Changes - Last 7 Days"
echo "=============================="
echo ""

git log --since="7 days ago" -p -- issues/*.md | \
  grep -B10 -E '^\+labels:|^-labels:' | \
  grep -E '^commit|^\+labels:|^-labels:' | \
  while read line; do
    if [[ $line =~ ^commit ]]; then
      COMMIT=$(echo $line | cut -d' ' -f2)
      AUTHOR=$(git show -s --format='%an' $COMMIT)
      DATE=$(git show -s --format='%ai' $COMMIT)
      echo ""
      echo "Commit: $COMMIT"
      echo "Author: $AUTHOR"
      echo "Date:   $DATE"
    else
      echo "  $line"
    fi
  done
```

**Output:**
```
Label Changes - Last 7 Days
==============================

Commit: abc123
Author: john.mcmullan
Date:   2026-02-14 10:00:00
  -labels: [TBricks, Performance]
  +labels: [performance, tbricks]

Commit: def456
Author: sarah.jones
Date:   2026-02-13 15:30:00
  +labels: [high-priority]
```

## Integration with LLM

**User:** "Did anyone change labels on my tickets?"

**LLM:**
```bash
# Your tickets
YOUR_TICKETS=$(grep -l "assignee: john" issues/*.md | \
  xargs -n1 basename | sed 's/.md//')

# Check for label changes
for ticket in $YOUR_TICKETS; do
  CHANGES=$(git log --since="1 week ago" -p issues/$ticket.md | \
    grep 'labels:' | wc -l)
  
  if [ $CHANGES -gt 0 ]; then
    echo "$ticket: $CHANGES label changes"
    git log --since="1 week ago" --oneline -p issues/$ticket.md | \
      grep -B5 'labels:' | head -10
  fi
done
```

**User:** "What labels are most popular now?"

**LLM:**
```bash
# Current label frequency
cat issues/*.md | \
  grep '^labels:' | \
  sed 's/labels: \[//; s/\]//' | \
  tr ',' '\n' | \
  sed 's/^ *//; s/ *$//' | \
  sort | uniq -c | sort -rn | head -10

# Output:
#  42 tbricks
#  35 performance
#  28 fix-protocol
#  15 high-priority
```

## Notification Examples

### Slack Alert on Label Changes

```bash
# .git/hooks/post-commit

LABEL_DIFF=$(git diff HEAD~1 HEAD -- issues/*.md | grep 'labels:')

if [ -n "$LABEL_DIFF" ]; then
  TICKET=$(echo "$LABEL_DIFF" | grep -oP 'issues/\K[^.]+')
  
  curl -X POST $SLACK_WEBHOOK \
    -H 'Content-Type: application/json' \
    -d "{
      \"text\": \"Label changed on $TICKET\",
      \"blocks\": [{
        \"type\": \"section\",
        \"text\": {
          \"type\": \"mrkdwn\",
          \"text\": \"\`\`\`$LABEL_DIFF\`\`\`\"
        }
      }]
    }"
fi
```

### Email Digest (Weekly Label Changes)

```bash
# Weekly cron job
git log --since="7 days ago" -p -- issues/*.md | \
  grep -E '^\+labels:|^-labels:' | \
  mail -s "Weekly Label Changes" team@company.com
```

## Bottom Line

**Can we track label changes?** 

**YES! Git does it automatically.**

**Every label change is:**
- ✅ Tracked (git log)
- ✅ Attributed (who changed it)
- ✅ Timestamped (when it changed)
- ✅ Reversible (git revert)
- ✅ Queryable (git grep, git diff)
- ✅ Analyzable (LLM can parse history)

**We don't need to build a feature. Git already tracks everything.**

---

**For the LLM:** Just ask natural language questions. Git has the answers.

**Examples:**
- "Show me label changes this week"
- "Who added the 'urgent' label?"
- "What labels are most popular?"
- "Did labels change on my tickets?"

All answered with git queries.
