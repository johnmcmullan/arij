# Timesheet Output Formats

Complete reference for `tract timesheet` output formats.

## Text Format (Default)

Human-readable table format.

**Command:**
```bash
tract timesheet
tract timesheet --format text
```

**Output:**
```
Timesheet for john.mcmullan - 2026-02-14

┌──────────┬──────────┬──────┬─────────────────────────────────┐
│ Issue    │ Started  │ Time │ Comment                         │
├──────────┼──────────┼──────┼─────────────────────────────────┤
│ APP-1234 │ 09:00    │ 2h   │ Fixed authentication bug        │
│ APP-1235 │ 11:30    │ 1.5h │ Code review                     │
│ APP-1236 │ 14:00    │ 3h   │ Feature development             │
│ APP-1234 │ 17:00    │ 1h   │ Testing and deployment          │
└──────────┴──────────┴──────┴─────────────────────────────────┘

Total: 7.5h ⚠️ (target: 8h)
```

**Status indicators:**
- `✅` - Target met (8h logged)
- `⚠️` - Under target
- `🔥` - Over target (9h+)

## JSON Format

Machine-readable structured data.

**Command:**
```bash
tract timesheet --format json
tract timesheet --date 2026-02-14 --format json
```

**Output:**
```json
{
  "author": "john.mcmullan",
  "date": "2026-02-14",
  "entries": [
    {
      "issue": "APP-1234",
      "started": "2026-02-14T09:00:00Z",
      "time": "2h",
      "timeSeconds": 7200,
      "comment": "Fixed authentication bug"
    },
    {
      "issue": "APP-1235",
      "started": "2026-02-14T11:30:00Z",
      "time": "1.5h",
      "timeSeconds": 5400,
      "comment": "Code review"
    },
    {
      "issue": "APP-1236",
      "started": "2026-02-14T14:00:00Z",
      "time": "3h",
      "timeSeconds": 10800,
      "comment": "Feature development"
    },
    {
      "issue": "APP-1234",
      "started": "2026-02-14T17:00:00Z",
      "time": "1h",
      "timeSeconds": 3600,
      "comment": "Testing and deployment"
    }
  ],
  "total": "7.5h",
  "totalSeconds": 27000,
  "target": "8h",
  "targetSeconds": 28800,
  "status": "under",
  "deficit": "0.5h",
  "deficitSeconds": 1800
}
```

**Field reference:**
- `author` - Username
- `date` - Date (YYYY-MM-DD)
- `entries` - Array of worklog entries
  - `issue` - Ticket ID
  - `started` - ISO 8601 timestamp
  - `time` - Human-readable duration
  - `timeSeconds` - Duration in seconds
  - `comment` - Work description
- `total` - Total time logged
- `totalSeconds` - Total in seconds
- `target` - Daily target
- `targetSeconds` - Target in seconds
- `status` - "met", "under", "over"
- `deficit` - How much short (if under)
- `surplus` - How much over (if over)

## CSV Format

Spreadsheet-friendly comma-separated values.

**Command:**
```bash
tract timesheet --format csv
tract timesheet --week --format csv > week.csv
```

**Output:**
```csv
Issue,Started,Time,Comment
APP-1234,2026-02-14T09:00:00Z,2h,Fixed authentication bug
APP-1235,2026-02-14T11:30:00Z,1.5h,Code review
APP-1236,2026-02-14T14:00:00Z,3h,Feature development
APP-1234,2026-02-14T17:00:00Z,1h,Testing and deployment
```

**With header:**
```csv
Author,Date,Issue,Started,Time,TimeSeconds,Comment
john.mcmullan,2026-02-14,APP-1234,2026-02-14T09:00:00Z,2h,7200,Fixed authentication bug
john.mcmullan,2026-02-14,APP-1235,2026-02-14T11:30:00Z,1.5h,5400,Code review
```

**Use cases:**
- Import to Excel/Google Sheets
- Data analysis with pandas/R
- Payroll processing
- Project time reports

## Weekly Format

Shows daily breakdown for a week.

**Command:**
```bash
tract timesheet --week
tract timesheet --week 2026-W07
```

**Text output:**
```
Timesheet for john.mcmullan - Week 2026-W07

Monday 2026-02-10:    8.0h ✅
Tuesday 2026-02-11:   7.5h ⚠️
Wednesday 2026-02-12: 8.5h 🔥
Thursday 2026-02-13:  8.0h ✅
Friday 2026-02-14:    7.5h ⚠️

─────────────────────────────
Weekly Total: 39.5h / 40h ⚠️
```

**JSON output:**
```json
{
  "author": "john.mcmullan",
  "week": "2026-W07",
  "days": [
    {
      "date": "2026-02-10",
      "total": "8.0h",
      "totalSeconds": 28800,
      "status": "met",
      "entries": [...]
    },
    {
      "date": "2026-02-11",
      "total": "7.5h",
      "totalSeconds": 27000,
      "status": "under",
      "entries": [...]
    }
  ],
  "weeklyTotal": "39.5h",
  "weeklyTotalSeconds": 142200,
  "weeklyTarget": "40h",
  "weeklyTargetSeconds": 144000,
  "status": "under"
}
```

## Monthly Format

Aggregated view for a month.

**Command:**
```bash
tract timesheet --month 2026-02
```

**Text output:**
```
Timesheet for john.mcmullan - February 2026

Week 2026-W05:  40.0h ✅
Week 2026-W06:  38.5h ⚠️
Week 2026-W07:  39.5h ⚠️
Week 2026-W08:  40.0h ✅
Week 2026-W09:  12.0h (partial)

─────────────────────────────
Monthly Total: 170h
Average per week: 39.5h
```

**JSON output:**
```json
{
  "author": "john.mcmullan",
  "month": "2026-02",
  "weeks": [
    {
      "week": "2026-W05",
      "total": "40.0h",
      "status": "met"
    },
    {
      "week": "2026-W06",
      "total": "38.5h",
      "status": "under"
    }
  ],
  "monthlyTotal": "170h",
  "monthlyTotalSeconds": 612000,
  "averagePerWeek": "39.5h"
}
```

## Custom Date Ranges (Future)

**Command (not yet implemented):**
```bash
tract timesheet --from 2026-02-01 --to 2026-02-15
```

## Piping and Processing

### Extract just the total
```bash
tract timesheet --format json | jq -r '.total'
# 7.5h
```

### Get seconds for calculations
```bash
tract timesheet --format json | jq -r '.totalSeconds'
# 27000
```

### Filter by issue
```bash
tract timesheet --format json | \
  jq -r '.entries[] | select(.issue=="APP-1234") | .time'
```

### Weekly totals to CSV
```bash
tract timesheet --week --format json | \
  jq -r '.days[] | [.date, .total] | @csv'
```

## Formatting Options

### Compact mode (future)
```bash
tract timesheet --compact
# APP-1234: 2h, APP-1235: 1.5h, Total: 7.5h
```

### Verbose mode (future)
```bash
tract timesheet --verbose
# Include commit hashes, sync status, Jira links
```

## Time Representation

### Human-readable format
- `2h` - 2 hours
- `1.5h` - 1 hour 30 minutes
- `30m` - 30 minutes
- `1d` - 1 day (8 hours)

### Seconds (for calculations)
- `7200` - 2 hours
- `5400` - 1.5 hours
- `1800` - 30 minutes
- `28800` - 8 hours (1 day)

### Conversion
```bash
# Hours to seconds: h * 3600
# 2h = 2 * 3600 = 7200s

# Seconds to hours: s / 3600
# 7200s / 3600 = 2h
```

## Export Examples

### Excel-compatible CSV
```bash
tract timesheet --month 2026-02 --format csv > timesheet-feb.csv
# Open in Excel, Google Sheets, Numbers
```

### JSON for data pipeline
```bash
tract timesheet --week --format json | \
  curl -X POST https://api.payroll.com/timesheets \
  -H "Content-Type: application/json" \
  -d @-
```

### Markdown for reports
```bash
tract timesheet --week | pandoc -f plain -t markdown
```

## Status Codes

When scripting with `tract timesheet`:

**Exit codes:**
- `0` - Success
- `1` - Error (no worklogs found, invalid date, etc.)

**JSON status field:**
- `"met"` - Target achieved
- `"under"` - Below target
- `"over"` - Above target

## Best Practices

1. **Use JSON for automation** - Parsing text output is fragile
2. **Export CSV for analysis** - Easy to import to spreadsheets
3. **Weekly reviews** - Check weekly totals every Friday
4. **Archive monthly CSVs** - Keep historical records
5. **Include --format in scripts** - Don't rely on defaults

## Future Enhancements

- Time range queries (`--from`, `--to`)
- Grouping by issue, component, epic
- Charts and visualizations
- HTML export
- Comparison reports (this week vs last week)
