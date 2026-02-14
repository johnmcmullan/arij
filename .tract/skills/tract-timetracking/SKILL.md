# Tract Time Tracking Skill

## Purpose

Log work hours and view timesheets in Tract. This skill handles time tracking, worklog queries, and timesheet reporting.

**Philosophy:** Time tracking should be effortless. Log time in seconds, view timesheet instantly, sync to Jira automatically.

## When to Use This Skill

**Activate when:**
- User wants to log time to a ticket
- User asks: "Did I log 8 hours today?"
- User wants to view their timesheet
- User asks about time spent on a specific ticket
- User wants to see team timesheets
- End-of-day time logging reminders

**Do NOT activate when:**
- User wants to create tickets (use tract-schema skill)
- User wants to onboard (use tract-onboarding skill)
- Time tracking not needed (optional feature)

## Core Workflow

### Step 1: Verify You're in a Tract Project

```bash
# Check for .tract/
ls .tract/config.yaml

# Or just try - tract searches parent dirs
tract timesheet
```

If not in a project: User needs to onboard first.

### Step 2: Log Time to a Ticket

**Basic syntax:**
```bash
tract log <ISSUE> <TIME> [COMMENT]
```

**Examples:**
```bash
# Log 2 hours with description
tract log APP-1234 2h "Fixed authentication bug"

# Log 30 minutes
tract log APP-1234 30m "Code review"

# Log 1 day
tract log APP-1234 1d "Full day on feature development"

# Log without comment
tract log APP-1234 3h

# Backdate (custom start time)
tract log APP-1234 2h "Morning work" --started "2026-02-14T09:00:00Z"
```

**Time format:**
- `2h` - Hours
- `30m` - Minutes
- `1d` - Days (8 hours by default)
- `1.5h` - Decimals work

### Step 3: View Your Timesheet

**Today's timesheet:**
```bash
tract timesheet
```

**Specific date:**
```bash
tract timesheet --date 2026-02-14
```

**This week:**
```bash
tract timesheet --week
```

**Specific week:**
```bash
tract timesheet --week 2026-W07
```

**This month:**
```bash
tract timesheet --month 2026-02
```

**Someone else's timesheet:**
```bash
tract timesheet john.mcmullan
tract timesheet --date 2026-02-14 sarah.jones
```

### Step 4: View Worklogs for a Ticket

**All worklogs for a ticket:**
```bash
tract worklogs APP-1234
```

**Output shows:**
- Who logged time
- How much time
- When
- Comment/description

### Step 5: Interpret Timesheet Output

**Example output:**
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
- ✅ Green check: Hit target (8h)
- ⚠️ Warning: Under target
- 🔥 Over target (e.g., 9h+)

## Time Tracking Storage

### Worklog Files

**Location:** `worklogs/YYYY-MM.jsonl`

**Format:** JSONL (one JSON object per line)

```json
{"issue":"APP-1234","author":"john.mcmullan","time":"2h","started":"2026-02-14T09:00:00Z","comment":"Fixed authentication bug"}
{"issue":"APP-1235","author":"john.mcmullan","time":"1.5h","started":"2026-02-14T11:30:00Z","comment":"Code review"}
```

**File structure:**
```
worklogs/
├── 2026-01.jsonl
├── 2026-02.jsonl
└── 2026-03.jsonl
```

### Direct File Editing (Advanced)

You can edit worklogs directly:

```bash
# Add entry
echo '{"issue":"APP-1234","author":"john","time":"2h","started":"2026-02-14T09:00:00Z","comment":"Work description"}' >> worklogs/2026-02.jsonl

# View raw file
cat worklogs/2026-02.jsonl

# Edit (careful!)
vim worklogs/2026-02.jsonl
```

**Then commit:**
```bash
git add worklogs/2026-02.jsonl
git commit -m "Log time to APP-1234"
git push
```

## Common Operations

### Daily Time Logging

**At end of day:**
```bash
# Review what you worked on today (from git, memory, etc.)
# Then log time

tract log APP-1234 3h "Feature development"
tract log APP-1235 2h "Code review and testing"
tract log APP-1236 2.5h "Bug fixes"

# Check total
tract timesheet
# Total: 7.5h ⚠️ (0.5h short)

# Add more if needed
tract log APP-1237 30m "Documentation"
```

### Check Your Weekly Hours

```bash
tract timesheet --week

# Shows daily totals + weekly total
```

### Find Missing Time Logs

```bash
# Check last week
tract timesheet --week 2026-W06

# Find days with < 8 hours
# Go back and fill in missing time
```

### Log Time to Yesterday

```bash
# Backdate to yesterday 9am
tract log APP-1234 4h "Forgot to log yesterday" \
  --started "2026-02-13T09:00:00Z"
```

### View Team Timesheets

```bash
# Check if team member logged time
tract timesheet john.mcmullan --date 2026-02-14
tract timesheet sarah.jones --week
```

## Jira Sync

If sync server is configured (`TRACT_SYNC_SERVER`):

**Automatic sync:**
```bash
tract log APP-1234 2h "Work description"
# → Creates worklog in worklogs/2026-02.jsonl
# → Commits to git
# → Pushes to remote
# → Sync server sends to Jira
# → Worklog appears in Jira ticket immediately
```

**Offline mode:**
```bash
# No sync server? No problem.
tract log APP-1234 2h "Offline work"
# → Creates worklog locally
# → Commits to git
# → Queues in .tract/queue/ for later sync

# Later, when online:
git push
# → Sync server processes queue
# → Sends all queued worklogs to Jira
```

## Conversational Time Tracking

When an LLM helps with time tracking:

**Example 1: End-of-day logging**
```
User: "I need to log my time for today"

LLM: "What did you work on today?"

User: "Mostly APP-1234, fixing that auth bug. About 5 hours.
      Also did some code review on APP-1235, maybe 2 hours."

LLM: [Runs: tract log APP-1234 5h "Fixed authentication bug"]
     [Runs: tract log APP-1235 2h "Code review"]
     [Runs: tract timesheet]
     
     "Logged:
      - APP-1234: 5h (Fixed authentication bug)
      - APP-1235: 2h (Code review)
      
      Total today: 7h ⚠️ (1h short of 8h)
      
      Anything else you worked on?"

User: "Oh yeah, 1 hour of meetings"

LLM: "Which ticket should I log that to?"

User: "Just put it on APP-1234"

LLM: [Runs: tract log APP-1234 1h "Meetings"]
     [Runs: tract timesheet]
     
     "Updated. Total today: 8h ✅
      
      You're good to go!"
```

**Example 2: Quick check**
```
User: "Did I log 8 hours today?"

LLM: [Runs: tract timesheet]
     
     "You logged 7.5h today:
      - APP-1234: 3h
      - APP-1235: 2h
      - APP-1236: 2.5h
      
      You're 0.5h short. Want to add more?"
```

**Example 3: Backfill missing days**
```
User: "I forgot to log time yesterday"

LLM: "What did you work on yesterday?"

User: "APP-1234, probably 6 hours"

LLM: [Runs: tract log APP-1234 6h "Work on authentication" --started "2026-02-13T09:00:00Z"]
     
     "Logged 6h to APP-1234 for yesterday (2026-02-13).
      
      Check your week: [Runs: tract timesheet --week]
      
      Mon: 8h ✅
      Tue: 7h ⚠️
      Wed: 6h ⚠️ (just logged)
      Thu: 8h ✅
      Fri: 7.5h ⚠️
      
      Total: 36.5h / 40h
      
      Want to fill in the rest?"
```

## Output Formats

### Text (Default)
```bash
tract timesheet
# Human-readable table
```

### JSON
```bash
tract timesheet --format json
# Machine-readable
```

Output:
```json
{
  "author": "john.mcmullan",
  "date": "2026-02-14",
  "entries": [
    {"issue": "APP-1234", "started": "09:00", "time": "2h", "comment": "..."},
    {"issue": "APP-1235", "started": "11:30", "time": "1.5h", "comment": "..."}
  ],
  "total": "7.5h",
  "target": "8h",
  "status": "under"
}
```

### CSV
```bash
tract timesheet --format csv
# Spreadsheet-friendly
```

Output:
```csv
Issue,Started,Time,Comment
APP-1234,09:00,2h,Fixed authentication bug
APP-1235,11:30,1.5h,Code review
```

## Worklog Author Detection

**Default:** Uses `git config user.name`

```bash
git config user.name
# → john.mcmullan

tract log APP-1234 2h "Work"
# Author: john.mcmullan (auto-detected)
```

**Override:**
```bash
tract log APP-1234 2h "Work" --author sarah.jones
```

**Tip:** Keep git user.name consistent for accurate timesheets.

## Time Targets

**Default target:** 8 hours/day

**Customize (future):**
Edit `.tract/config.yaml`:
```yaml
timetracking:
  daily_target: 7.5h
  weekly_target: 37.5h
```

## Tips for Effective Time Tracking

1. **Log daily** - Don't wait until end of week
2. **Be specific** - Good comments help later ("Fixed bug" vs "Fixed auth timeout in session middleware")
3. **Round to 30m** - Don't obsess over minutes
4. **Log everything** - Meetings, reviews, research all count
5. **Check weekly** - Catch missing days early
6. **Use git history** - `git log --since="1 day ago" --author=me` reminds you what you worked on

## Troubleshooting

### Error: Not in a Tract project
```
tract log APP-1234 2h "Work"
# Error: Not a Tract project
```

**Fix:** Run from project directory, or onboard first.

### Error: Invalid time format
```
tract log APP-1234 two-hours "Work"
# Error: Invalid time format
```

**Fix:** Use: `2h`, `30m`, `1d`, etc.

### Error: Issue doesn't exist
```
tract log APP-9999 2h "Work"
# Warning: Issue APP-9999 not found in issues/
```

**Note:** Tract allows logging to non-existent issues (useful for Jira-synced issues not yet pulled).

### Worklogs not syncing to Jira
```
# Check sync server
echo $TRACT_SYNC_SERVER
# Should be set

# Check connectivity
curl $TRACT_SYNC_SERVER/health
```

**If offline:** Worklogs queue in `.tract/queue/` and sync when connection returns.

## Advanced: Direct JSONL Manipulation

**Bulk import from CSV:**
```bash
# Convert CSV to JSONL
cat timelog.csv | awk -F, 'NR>1 {
  printf "{\"issue\":\"%s\",\"author\":\"john\",\"time\":\"%s\",\"started\":\"%s\",\"comment\":\"%s\"}\n",
  $1, $2, $3, $4
}' >> worklogs/2026-02.jsonl

git add worklogs/2026-02.jsonl
git commit -m "Import time logs from CSV"
git push
```

**Query worklogs with jq:**
```bash
# Total time on APP-1234 this month
cat worklogs/2026-02.jsonl | \
  jq -r 'select(.issue=="APP-1234") | .time' | \
  # Sum manually or use script
```

**Filter by author:**
```bash
cat worklogs/2026-02.jsonl | jq -r 'select(.author=="john.mcmullan")'
```

## Integration with Other Skills

**With tract-schema:**
```bash
# Create ticket and log time immediately
tract create APP --title "Fix bug" --type bug
# Creates APP-1234

tract log APP-1234 2h "Initial investigation"
```

**With reminders (cron):**
```bash
# Set up daily reminder to log time
# (use cron tool to create reminder at 5pm daily)
```

## Reference Documents

For complete details, load these on-demand:

- **`references/timesheet-formats.md`** - Output formats, CSV/JSON schemas
- **`references/sync-behavior.md`** - How Jira sync works for worklogs
- **`references/bulk-operations.md`** - Batch time logging, imports, reports

## Success Criteria

Time tracking working when:
- ✓ `tract log` creates entries in `worklogs/YYYY-MM.jsonl`
- ✓ `tract timesheet` shows accurate totals
- ✓ Worklogs committed to git
- ✓ Jira shows time logs (if sync enabled)
- ✓ Weekly hours tracked consistently

## Best Practices

1. **Log daily** - End-of-day habit
2. **Descriptive comments** - "Fixed auth bug in middleware" not "Work"
3. **Consistent author** - Match git user.name
4. **Round to 30m increments** - 2h, 2.5h, 3h (not 2.37h)
5. **Track everything** - Meetings, research, reviews count
6. **Weekly review** - Check `tract timesheet --week` every Friday
7. **Backfill promptly** - Don't wait weeks to fill missing time

---

**Remember:** Time tracking should be effortless. Log in seconds, sync automatically, view instantly. If it's painful, you won't do it.
