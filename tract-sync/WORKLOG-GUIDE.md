# Worklog & Timesheet Usage Guide

## Setup

Configure the sync server URL once:
```bash
export TRACT_SYNC_SERVER=http://reek:3100
# Add to ~/.bashrc or ~/.zshrc to make permanent
```

## Logging Time

### Basic usage
```bash
# Log time to an issue
tract log APP-1002 2h "Fixed authentication bug"

# Log with specific start time
tract log APP-1002 1.5h "Code review" --started "2026-02-12T14:00:00Z"

# Log as different author (for managers)
tract log APP-1002 30m "Testing" --author sarah
```

### Time formats
- Minutes: `30m`
- Hours: `2h`, `1.5h`
- Days: `1d` (= 8 hours)
- Weeks: `1w` (= 40 hours)

## Viewing Timesheets

### Check today's hours
```bash
$ tract timesheet
Timesheet: john.mcmullan
Period: 2026-02-12
────────────────────────────────────────────────────────────────────────────────

2026-02-12 (Wed)
  09:00  2h        APP-1002      Fixed authentication bug
  11:00  1h        APP-1003      Code review
  14:00  3h        APP-1002      Testing and documentation
  17:00  1.5h      APP-1004      Started new feature
                          Daily: 7.5h  ⚠️  Need 0.5h more
────────────────────────────────────────────────────────────────────────────────
Total: 7.5h  ⚠️  Need 0.5h more
```

### Check this week
```bash
$ tract timesheet --week
Timesheet: john.mcmullan
Period: Week 2026-W07
────────────────────────────────────────────────────────────────────────────────

2026-02-10 (Mon)
  09:00  4h        APP-1001      Database migration
  14:00  4h        APP-1001      Testing
                          Daily: 8h  ✓

2026-02-11 (Tue)
  09:00  6h        APP-1002      Bug fixes
  15:00  2h        APP-1003      Documentation
                          Daily: 8h  ✓
────────────────────────────────────────────────────────────────────────────────
Total: 16h / 40h
```

### Export for payroll
```bash
# CSV format
tract timesheet --month 2026-02 --format csv > february.csv

# JSON format
tract timesheet --week --format json > this-week.json
```

### Check someone else's timesheet (managers)
```bash
tract timesheet sarah --week
```

## Viewing Issue Worklogs

```bash
$ tract worklogs APP-1002
Worklogs for APP-1002:
──────────────────────────────────────────────────────────────────────
2026-02-12 09:00:00  2h        john.mcmullan
  Fixed authentication bug
2026-02-12 14:00:00  3h        john.mcmullan
  Testing and documentation
2026-02-13 10:00:00  1h        sarah
  Code review
──────────────────────────────────────────────────────────────────────
Total: 6h
```

## How It Works

### Direct API (not git workflow)
```
Developer → tract log → HTTP POST → Sync Server → Both:
                                                     ├─> Jira API (immediate)
                                                     └─> worklogs/YYYY-MM.jsonl + git commit (batched)
```

### Benefits
- ✅ **Instant Jira sync** - Managers see time immediately
- ✅ **No git noise** - Commits batched every 5 minutes
- ✅ **Still in git** - Full audit trail in `worklogs/YYYY-MM.jsonl`
- ✅ **Works from anywhere** - Don't need to be in repo directory
- ✅ **Scriptable** - Easy to automate timesheet entry
- ✅ **Easy archiving** - One file per month, can compress old months

### Storage Format

Worklogs stored in monthly JSONL (JSON Lines) files:
```
worklogs/2026-02.jsonl:
{"issue":"APP-1002","author":"john","started":"2026-02-12T09:00:00Z","seconds":7200,"comment":"Fixed auth bug"}
{"issue":"APP-1003","author":"sarah","started":"2026-02-12T14:00:00Z","seconds":3600,"comment":"Code review"}
{"issue":"APP-1002","author":"john","started":"2026-02-12T14:00:00Z","seconds":5400,"comment":"Testing"}
```

One file per month (e.g., `2026-02.jsonl`) contains all time entries for that month across all issues.
Append-only, no merge conflicts, easy to parse programmatically.

## Offline Support

If sync server is unreachable, `tract log` will:
1. Append to local `worklogs/*.jsonl` file
2. Commit to git normally
3. Post-receive hook will sync to Jira when you push

## Tips

### Daily routine
```bash
# End of day - check if you hit 8 hours
tract timesheet
# If under, log remaining time
tract log APP-1002 30m "Wrap up and documentation"
```

### Weekly review
```bash
# Check full week
tract timesheet --week
# Export for records
tract timesheet --week --format csv > week-$(date +%Y-W%W).csv
```

### Scripting
```bash
#!/bin/bash
# Auto-log morning standup time
tract log $(git branch --show-current | grep -oE '[A-Z]+-[0-9]+') 15m "Daily standup"
```

## Authentication

Currently uses git `user.name` for author identification. Future options:
- API tokens
- SSH key authentication
- LDAP/AD integration

## Bidirectional Sync

Worklogs are synced bidirectionally between Tract and Jira:

### Tract → Jira

When you log time via `tract log`:
1. Entry added to monthly JSONL file (e.g., `worklogs/2026-02.jsonl`)
2. Posted to Jira worklog API immediately
3. Changes committed to git (batched every 5 minutes)

### Jira → Tract

When someone logs time directly in Jira:
1. Jira webhook fires (`worklog_created` or `worklog_updated`)
2. Sync server receives webhook
3. Entry added to monthly JSONL file with Jira worklog ID
4. Changes committed to git (batched)
5. Duplicate detection prevents re-syncing same worklog

This ensures **all worklogs** appear in the monthly files, regardless of whether they were logged via Tract CLI or Jira UI.

### Why Bidirectional?

**Complete time reporting** - Monthly JSONL files contain all time logged by everyone:
- Developers using `tract log`
- Scrum masters logging in Jira
- Managers logging in Jira
- Non-developers who don't use Tract

**Single source of truth** - Query the JSONL files for:
- Team timesheets
- Monthly time reports
- Utilization analysis
- Project time tracking

**Example report query:**
```bash
# Total hours logged by everyone in February
cat worklogs/2026-02.jsonl | jq -s 'map(.seconds) | add / 3600'

# Hours per person
cat worklogs/2026-02.jsonl | jq -r '.author' | sort | uniq -c

# Hours per project
cat worklogs/2026-02.jsonl | jq -r '.issue' | cut -d- -f1 | sort | uniq -c
```

## Jira Webhook Configuration

To enable Jira → Tract worklog sync, configure a webhook in Jira:

**Webhook URL:**
```
http://your-tract-server:3100/webhook/jira
```

**Events to subscribe:**
- ✅ `worklog_created`
- ✅ `worklog_updated`
- ✅ `issue_created`
- ✅ `issue_updated`

All worklog events will be automatically synced to the monthly JSONL files.

## Advanced Queries

### Daily Summary per Person

```bash
# Hours logged by each person today
cat worklogs/2026-02.jsonl | \
  jq -r --arg date "$(date +%Y-%m-%d)" \
  'select(.started | startswith($date)) | "\(.author) \(.seconds)"' | \
  awk '{hrs[$1] += $2/3600} END {for (p in hrs) printf "%s: %.1fh\n", p, hrs[p]}'
```

### Weekly Team Summary

```bash
# Total hours per person this week
cat worklogs/2026-02.jsonl | \
  jq -r 'select(.started >= "2026-02-09" and .started < "2026-02-16") | "\(.author) \(.seconds)"' | \
  awk '{hrs[$1] += $2/3600} END {for (p in hrs) printf "%s: %.1fh\n", p, hrs[p]}' | \
  sort -t: -k2 -nr
```

### Project Breakdown

```bash
# Hours per project with percentages
cat worklogs/2026-02.jsonl | \
  jq -r '.issue' | cut -d- -f1 | sort | uniq -c | \
  awk '{total+=$1; proj[$2]=$1} END {for (p in proj) printf "%s: %d entries (%.1f%%)\n", p, proj[p], 100*proj[p]/total}'
```

### Under-logging Detection

```bash
# Find people who logged less than 6h today (might need to log more)
cat worklogs/2026-02.jsonl | \
  jq -r --arg date "$(date +%Y-%m-%d)" \
  'select(.started | startswith($date)) | "\(.author) \(.seconds)"' | \
  awk '{hrs[$1] += $2/3600} END {for (p in hrs) if (hrs[p] < 6) printf "%s: %.1fh ⚠️\n", p, hrs[p]}'
```

### Monthly Report

```bash
# Complete monthly summary: total hours, per person, per project
echo "=== February 2026 Time Report ==="
echo ""
echo "Total hours:"
cat worklogs/2026-02.jsonl | jq -s 'map(.seconds) | add / 3600'
echo ""
echo "By person:"
cat worklogs/2026-02.jsonl | jq -r '.author' | sort | uniq -c | sort -rn
echo ""
echo "By project:"
cat worklogs/2026-02.jsonl | jq -r '.issue' | cut -d- -f1 | sort | uniq -c | sort -rn
```

### Export to CSV

```bash
# Export all February worklogs to CSV
echo "Date,Author,Issue,Hours,Comment" > february-2026.csv
cat worklogs/2026-02.jsonl | \
  jq -r '[.started[0:10], .author, .issue, (.seconds/3600|tostring), .comment] | @csv' \
  >> february-2026.csv
```

### Find Specific Work

```bash
# Find all time logged to a specific issue
cat worklogs/2026-02.jsonl | jq -r 'select(.issue == "APP-3350") | "\(.started[0:10]) \(.author) \(.seconds/3600)h \(.comment)"'

# Find all sprint planning time (TINT project)
cat worklogs/2026-02.jsonl | jq -r 'select(.issue | startswith("TINT-")) | "\(.started[0:10]) \(.author) \(.seconds/3600)h \(.issue) \(.comment)"'
```

## Integration with Other Tools

### Tempo Integration (Future)

The JSONL format is compatible with Tempo's time tracking. A script could sync to Tempo:

```bash
# Sync to Tempo (example - not yet implemented)
cat worklogs/2026-02.jsonl | \
  jq -r '{"author": .author, "issue": .issue, "started": .started, "timeSpentSeconds": .seconds}' | \
  curl -X POST https://tempo-api/worklogs -d @-
```

### Jira Time Reports

Since worklogs sync to Jira, managers can use Jira's built-in time tracking reports. The central worklogs provide a backup and enable custom queries.

### Spreadsheet Import

Export to CSV and import to Google Sheets/Excel for analysis:

```bash
tract timesheet --month 2026-02 --format csv > feb-2026.csv
# Open in Google Sheets or Excel
```
