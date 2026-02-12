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
                                                     └─> worklogs/*.jsonl + git commit (batched)
```

### Benefits
- ✅ **Instant Jira sync** - Managers see time immediately
- ✅ **No git noise** - Commits batched every 5 minutes
- ✅ **Still in git** - Full audit trail in `worklogs/*.jsonl`
- ✅ **Works from anywhere** - Don't need to be in repo directory
- ✅ **Scriptable** - Easy to automate timesheet entry

### Storage Format

Worklogs stored in JSONL (JSON Lines) format:
```
worklogs/APP-1002.jsonl:
{"author":"john","started":"2026-02-12T09:00:00Z","seconds":7200,"comment":"Fixed auth bug"}
{"author":"sarah","started":"2026-02-12T14:00:00Z","seconds":3600,"comment":"Code review"}
```

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
