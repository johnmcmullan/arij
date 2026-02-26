# Bulk Time Tracking Operations

Batch logging, imports, and reporting.

## Bulk Logging from CSV

### Format

**CSV structure:**
```csv
Issue,Time,Comment,Date
APP-1234,2h,Fixed authentication bug,2026-02-14
APP-1235,1.5h,Code review,2026-02-14
APP-1236,3h,Feature development,2026-02-14
```

### Import Script

```bash
#!/bin/bash
# import-worklogs.sh

CSV_FILE="$1"
AUTHOR="${2:-$(git config user.name)}"

# Skip header, process each line
tail -n +2 "$CSV_FILE" | while IFS=, read -r issue time comment date; do
  # Build started timestamp (assumes 9am if no time given)
  started="${date}T09:00:00Z"
  
  # Log time
  tract log "$issue" "$time" "$comment" --started "$started" --author "$AUTHOR"
  
  # Small delay to avoid overwhelming system
  sleep 0.1
done

echo "Import complete. Check timesheet:"
tract timesheet
```

**Usage:**
```bash
chmod +x import-worklogs.sh
./import-worklogs.sh timelog.csv john.mcmullan
```

## Direct JSONL Manipulation

### Append Entries

```bash
# Format: {"issue":"ID","author":"name","time":"Xh","started":"ISO-timestamp","comment":"text"}

cat >> worklogs/2026-02.jsonl << 'EOF'
{"issue":"APP-1234","author":"john.mcmullan","time":"2h","started":"2026-02-14T09:00:00Z","comment":"Morning work"}
{"issue":"APP-1235","author":"john.mcmullan","time":"1.5h","started":"2026-02-14T11:30:00Z","comment":"Afternoon work"}
EOF

# Commit
git add worklogs/2026-02.jsonl
git commit -m "Bulk import time logs for 2026-02-14"
git push
```

### Bulk Edit with jq

**Example: Change all worklogs from one issue to another**

```bash
# Change APP-1234 → APP-1235
cat worklogs/2026-02.jsonl | \
  jq -c 'if .issue == "APP-1234" then .issue = "APP-1235" else . end' \
  > worklogs/2026-02-new.jsonl

mv worklogs/2026-02-new.jsonl worklogs/2026-02.jsonl

git commit -am "Reassign worklogs from APP-1234 to APP-1235"
```

**Example: Add author to all entries missing it**

```bash
cat worklogs/2026-02.jsonl | \
  jq -c 'if .author == null then .author = "john.mcmullan" else . end' \
  > worklogs/2026-02-new.jsonl

mv worklogs/2026-02-new.jsonl worklogs/2026-02.jsonl

git commit -am "Add author to legacy worklogs"
```

## Bulk Reporting

### Total Time per Issue

```bash
# All time on each issue this month
cat worklogs/2026-02.jsonl | \
  jq -r '.issue' | \
  sort | uniq -c | \
  sort -rn
```

**Output:**
```
12 APP-1234
 8 APP-1235
 5 APP-1236
```

**With time totals (requires custom script):**

```bash
#!/bin/bash
# total-by-issue.sh

cat worklogs/2026-02.jsonl | \
  jq -r '[.issue, .time] | @tsv' | \
  awk '{
    # Parse time (assumes format like "2h", "1.5h", "30m")
    time = $2
    if (time ~ /h$/) {
      hours = substr(time, 1, length(time)-1)
    } else if (time ~ /m$/) {
      hours = substr(time, 1, length(time)-1) / 60
    }
    total[$1] += hours
  }
  END {
    for (issue in total) {
      printf "%s\t%.1fh\n", issue, total[issue]
    }
  }' | \
  sort -t$'\t' -k2 -rn
```

**Output:**
```
APP-1234    24.5h
APP-1235    16.0h
APP-1236    10.5h
```

### Time per Author

```bash
cat worklogs/2026-02.jsonl | \
  jq -r '.author' | \
  sort | uniq -c | \
  sort -rn
```

### Weekly Aggregates

```bash
#!/bin/bash
# weekly-report.sh

WEEK="$1"  # e.g., 2026-W07

# Get week start/end dates (ISO 8601)
# Simplification: assumes week starts Monday
YEAR=$(echo $WEEK | cut -d'-' -f1)
WEEK_NUM=$(echo $WEEK | cut -d'W' -f2)

# ... date calculation logic ...

# Query worklogs for that week
cat worklogs/2026-02.jsonl | \
  jq -r --arg week "$WEEK" '
    select(.started | startswith(week))
  ' | \
  # ... aggregate by day, author, etc. ...
```

## Payroll Export

### Generate Payroll CSV

```bash
#!/bin/bash
# payroll-export.sh

MONTH="$1"  # e.g., 2026-02
OUTPUT="${MONTH}-payroll.csv"

# Header
echo "Employee,Date,Hours,Description" > "$OUTPUT"

# Extract and format
cat worklogs/${MONTH}.jsonl | \
  jq -r '[.author, (.started | split("T")[0]), .time, .comment] | @csv' \
  >> "$OUTPUT"

echo "Payroll export: $OUTPUT"
```

**Usage:**
```bash
./payroll-export.sh 2026-02
# Creates: 2026-02-payroll.csv
```

## Importing from Other Systems

### From Jira Time Tracking Report

**Export from Jira:**
1. Jira → Reports → Time Tracking Report
2. Filter by date range
3. Export as CSV

**Convert to Tract JSONL:**

```bash
#!/bin/bash
# jira-to-tract.sh

JIRA_CSV="$1"

tail -n +2 "$JIRA_CSV" | while IFS=, read -r issue author time_seconds started comment; do
  # Convert seconds to hours
  hours=$(echo "scale=1; $time_seconds / 3600" | bc)
  time="${hours}h"
  
  # Output JSONL
  jq -n \
    --arg issue "$issue" \
    --arg author "$author" \
    --arg time "$time" \
    --arg started "$started" \
    --arg comment "$comment" \
    '{issue: $issue, author: $author, time: $time, started: $started, comment: $comment}'
done >> worklogs/2026-02.jsonl

git add worklogs/2026-02.jsonl
git commit -m "Import time logs from Jira export"
git push
```

### From Toggl/Harvest/Other Time Trackers

**Similar pattern:**
1. Export from tool (CSV/JSON)
2. Parse with script
3. Convert to Tract JSONL format
4. Append to worklog file
5. Commit and push

## Automated Daily Summaries

### End-of-Day Slack/Email Report

```bash
#!/bin/bash
# daily-summary.sh

TODAY=$(date +%Y-%m-%d)
AUTHOR=$(git config user.name)

# Get today's timesheet
SUMMARY=$(tract timesheet --date "$TODAY" --format json)

# Extract total
TOTAL=$(echo "$SUMMARY" | jq -r '.total')
STATUS=$(echo "$SUMMARY" | jq -r '.status')

# Send to Slack (example)
if [ "$STATUS" == "under" ]; then
  MESSAGE="⚠️ Only $TOTAL logged today. Don't forget to log time!"
else
  MESSAGE="✅ Logged $TOTAL today. Good job!"
fi

curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK/URL \
  -H 'Content-Type: application/json' \
  -d "{\"text\": \"$MESSAGE\"}"
```

**Cron job (runs at 5pm daily):**
```bash
0 17 * * * /path/to/daily-summary.sh
```

## Batch Corrections

### Fix Incorrect Issue IDs

```bash
# Change all APP-9999 → APP-1234
cat worklogs/2026-02.jsonl | \
  sed 's/"issue":"APP-9999"/"issue":"APP-1234"/g' \
  > worklogs/2026-02-fixed.jsonl

mv worklogs/2026-02-fixed.jsonl worklogs/2026-02.jsonl

git commit -am "Fix issue IDs (APP-9999 → APP-1234)"
git push
```

### Update All Comments

```bash
# Add prefix to all comments
cat worklogs/2026-02.jsonl | \
  jq -c '.comment = "[Backfill] " + .comment' \
  > worklogs/2026-02-new.jsonl

mv worklogs/2026-02-new.jsonl worklogs/2026-02.jsonl

git commit -am "Add backfill prefix to comments"
```

## Performance Considerations

### Large Worklog Files

**Issue:** Monthly JSONL files can grow large (1000+ entries).

**Solution:**
- Split by week within month subdirectories (future enhancement)
- Archive old months (move to archive/ directory)
- Compress archived files (gzip)

### Bulk Sync to Jira

**Issue:** Syncing 500+ worklogs at once overwhelms Jira API.

**Solution:**
- Sync server batches requests (10 per batch, 100ms delay)
- Expect ~1 minute per 100 worklogs
- Monitor sync server logs for progress

## Best Practices

1. **Validate before committing** - Check JSONL syntax with jq
2. **Backup before bulk edits** - `cp worklogs/2026-02.jsonl worklogs/2026-02.jsonl.bak`
3. **Test on small dataset first** - Don't bulk-edit entire month without testing
4. **Use scripts** - Don't manually edit JSONL (error-prone)
5. **Version control** - Git tracks all changes, easy to revert
6. **Document imports** - Note source in commit message

## Examples

### Import Week from CSV

```bash
# week-import.csv
cat > week-import.csv << 'EOF'
Issue,Time,Comment,Date
APP-1234,8h,Monday work,2026-02-10
APP-1235,8h,Tuesday work,2026-02-11
APP-1236,8h,Wednesday work,2026-02-12
APP-1237,8h,Thursday work,2026-02-13
APP-1238,8h,Friday work,2026-02-14
EOF

# Import
./import-worklogs.sh week-import.csv

# Verify
tract timesheet --week
```

### Generate Monthly Invoice

```bash
#!/bin/bash
# invoice-export.sh

MONTH="$1"  # 2026-02
RATE_PER_HOUR=150  # $150/hour

TOTAL_HOURS=$(cat worklogs/${MONTH}.jsonl | \
  jq -r '.time' | \
  awk '{
    if ($0 ~ /h$/) {
      total += substr($0, 1, length($0)-1)
    }
  }
  END { print total }')

TOTAL_AMOUNT=$(echo "$TOTAL_HOURS * $RATE_PER_HOUR" | bc)

echo "Invoice for $MONTH:"
echo "  Total Hours: ${TOTAL_HOURS}h"
echo "  Rate: \$${RATE_PER_HOUR}/hour"
echo "  Amount Due: \$${TOTAL_AMOUNT}"
```

**Usage:**
```bash
./invoice-export.sh 2026-02
# Invoice for 2026-02:
#   Total Hours: 160h
#   Rate: $150/hour
#   Amount Due: $24000
```

## Troubleshooting

### Invalid JSONL after bulk edit

```bash
# Validate
cat worklogs/2026-02.jsonl | jq empty
# Error: parse error at line 42

# Find the problematic line
sed -n '42p' worklogs/2026-02.jsonl
```

**Fix:** Edit line 42, or revert from git:
```bash
git checkout worklogs/2026-02.jsonl
```

### Duplicate entries after import

```bash
# Find duplicates (same issue + started time)
cat worklogs/2026-02.jsonl | \
  jq -r '[.issue, .started] | @tsv' | \
  sort | uniq -d
```

**Remove duplicates:**
```bash
cat worklogs/2026-02.jsonl | \
  jq -s 'unique_by([.issue, .started])' | \
  jq -c '.[]' \
  > worklogs/2026-02-deduped.jsonl

mv worklogs/2026-02-deduped.jsonl worklogs/2026-02.jsonl
```

## Summary

Bulk operations are powerful but risky:
- Always backup before editing
- Validate JSONL with `jq` before committing
- Test scripts on small datasets first
- Use git to track changes and revert if needed
