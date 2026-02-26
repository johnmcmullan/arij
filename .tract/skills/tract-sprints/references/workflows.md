# Sprint Workflows

Detailed workflow examples for common sprint operations.

## Starting a New Sprint

### Step-by-Step

**1. Close previous sprint:**
```bash
vim .tract/sprints/2026-W07.yaml
```

Change:
```yaml
state: closed  # Was: open
```

**2. Create next sprint:**
```bash
cat > .tract/sprints/2026-W08.yaml << 'EOF'
name: Sprint 8
state: open
start: 2026-02-17
end: 2026-02-28
goal: Complete OAuth integration and begin performance testing
EOF
```

**3. Identify incomplete tickets:**
```bash
# Find tickets in old sprint
grep -l "sprints:.*2026-W07" issues/*.md | while read ticket; do
  # Check if not done
  if ! grep -q "status: \(done\|closed\)" "$ticket"; then
    echo "Carryover: $ticket"
  fi
done
```

**4. Update carryover tickets:**

For each incomplete ticket, append new sprint:

```yaml
# Before
sprints: [2026-W07]

# After
sprints: [2026-W07, 2026-W08]
```

**5. Commit everything:**
```bash
git add .tract/sprints/ issues/
git commit -m "Start Sprint 8, carry over 3 tickets from Sprint 7"
git push
```

### Automated Script

```bash
#!/bin/bash
# start-sprint.sh

OLD_SPRINT="2026-W07"
NEW_SPRINT="2026-W08"
SPRINT_NAME="Sprint 8"
START_DATE="2026-02-17"
END_DATE="2026-02-28"
GOAL="Complete OAuth integration"

# Close old sprint
sed -i 's/state: open/state: closed/' ".tract/sprints/$OLD_SPRINT.yaml"

# Create new sprint
cat > ".tract/sprints/$NEW_SPRINT.yaml" << EOF
name: $SPRINT_NAME
state: open
start: $START_DATE
end: $END_DATE
goal: $GOAL
EOF

# Find and update carryover tickets
grep -l "sprints:.*$OLD_SPRINT" issues/*.md | while read ticket; do
  if ! grep -q "status: \(done\|closed\)" "$ticket"; then
    # Append new sprint to array
    sed -i "s/sprints: \[\(.*\)\]/sprints: [\1, $NEW_SPRINT]/" "$ticket"
    echo "Carried over: $ticket"
  fi
done

# Commit
git add .tract/sprints/ issues/
git commit -m "Start $SPRINT_NAME, carry over incomplete tickets"
git push
```

## Mid-Sprint: Adding New Work

### Adding a Ticket to Current Sprint

**1. Create ticket (using tract CLI):**
```bash
tract create TB "Implement password reset" --status todo
```

**2. Edit ticket to add to sprint:**
```bash
vim issues/TB-234.md
```

Add sprint to frontmatter:
```yaml
sprints: [2026-W08]
```

**3. Commit:**
```bash
git add issues/TB-234.md
git commit -m "Add TB-234 to Sprint 8: password reset"
git push
```

### Adding Multiple Tickets

```bash
# Create tickets
tract create TB "Add 2FA support" --status todo
tract create TB "Implement session timeout" --status todo
tract create TB "Add security logging" --status todo

# Get current sprint
CURRENT_SPRINT=$(grep -l "state: open" .tract/sprints/*.yaml | xargs basename -s .yaml)

# Add sprint to each ticket
for ticket in issues/TB-234.md issues/TB-235.md issues/TB-236.md; do
  # Add sprint to frontmatter if not present
  if ! grep -q "^sprints:" "$ticket"; then
    sed -i "/^status:/a sprints: [$CURRENT_SPRINT]" "$ticket"
  fi
done

git add issues/
git commit -m "Add 3 security tickets to Sprint 8"
git push
```

## Closing a Sprint

### Standard Sprint Closure

**1. Review incomplete tickets:**
```bash
SPRINT="2026-W08"

echo "=== Sprint $SPRINT Status ==="
echo ""
echo "Done tickets:"
grep -l "sprints:.*$SPRINT" issues/*.md | while read ticket; do
  if grep -q "status: \(done\|closed\)" "$ticket"; then
    echo "  ✓ $(basename $ticket)"
  fi
done

echo ""
echo "Incomplete tickets (will carry over):"
grep -l "sprints:.*$SPRINT" issues/*.md | while read ticket; do
  if ! grep -q "status: \(done\|closed\)" "$ticket"; then
    echo "  ⚠ $(basename $ticket)"
  fi
done
```

**2. Close sprint:**
```bash
vim .tract/sprints/2026-W08.yaml
```

Change state to closed:
```yaml
state: closed
```

**3. Commit:**
```bash
git add .tract/sprints/2026-W08.yaml
git commit -m "Close Sprint 8"
git push
```

**4. Start next sprint** (see "Starting a New Sprint" above)

### Emergency Sprint Closure

If sprint needs to end early:

```bash
# Close sprint immediately
vim .tract/sprints/2026-W08.yaml
# Change: state: closed

git add .tract/sprints/2026-W08.yaml
git commit -m "Emergency close Sprint 8: scope change"
git push

# All incomplete tickets will carry to next sprint
```

## Sprint Extensions

### Extending End Date

Sprint running longer than planned:

```bash
vim .tract/sprints/2026-W08.yaml
```

Update end date, keep state open:
```yaml
name: Sprint 8
state: open
start: 2026-02-17
end: 2026-03-03  # Extended by 3 days
goal: Complete OAuth integration
```

```bash
git add .tract/sprints/2026-W08.yaml
git commit -m "Extend Sprint 8 by 3 days"
git push
```

### Extending Scope

Add tickets mid-sprint without changing dates:

```bash
# Create and add new tickets
tract create TB "Additional OAuth scope" --status todo
vim issues/TB-250.md
# Add: sprints: [2026-W08]

git add issues/TB-250.md
git commit -m "Add TB-250 to Sprint 8 (scope extension)"
git push
```

## Sprint Queries

### Find Current Sprint

```bash
# Get current sprint ID
CURRENT=$(grep -l "state: open" .tract/sprints/*.yaml | xargs basename -s .yaml)
echo "Current sprint: $CURRENT"
```

### List Tickets in Sprint

```bash
SPRINT="2026-W08"

echo "Tickets in $SPRINT:"
grep -l "sprints:.*$SPRINT" issues/*.md | while read ticket; do
  ID=$(basename "$ticket" .md)
  TITLE=$(grep "^title:" "$ticket" | cut -d: -f2- | xargs)
  STATUS=$(grep "^status:" "$ticket" | cut -d: -f2 | xargs)
  echo "  $ID [$STATUS] $TITLE"
done
```

### Sprint Progress Report

```bash
SPRINT="2026-W08"

TOTAL=$(grep -l "sprints:.*$SPRINT" issues/*.md | wc -l)
DONE=$(grep -l "sprints:.*$SPRINT" issues/*.md | xargs grep -l "status: \(done\|closed\)" | wc -l)
IN_PROGRESS=$(grep -l "sprints:.*$SPRINT" issues/*.md | xargs grep -l "status: in-progress" | wc -l)
TODO=$(grep -l "sprints:.*$SPRINT" issues/*.md | xargs grep -l "status: todo" | wc -l)

echo "Sprint $SPRINT Progress:"
echo "  Total: $TOTAL tickets"
echo "  Done: $DONE"
echo "  In Progress: $IN_PROGRESS"
echo "  To Do: $TODO"
echo ""
echo "  Complete: $(( DONE * 100 / TOTAL ))%"
```

### Tickets with Long Sprint History

Find tickets that have been in many sprints (potential blockers):

```bash
echo "Tickets in 3+ sprints:"
for ticket in issues/*.md; do
  SPRINT_COUNT=$(grep "^sprints:" "$ticket" | grep -o ',' | wc -l)
  SPRINT_COUNT=$((SPRINT_COUNT + 1))

  if [ $SPRINT_COUNT -ge 3 ]; then
    ID=$(basename "$ticket" .md)
    TITLE=$(grep "^title:" "$ticket" | cut -d: -f2- | xargs)
    SPRINTS=$(grep "^sprints:" "$ticket" | cut -d: -f2- | xargs)
    echo "  $ID ($SPRINT_COUNT sprints): $TITLE"
    echo "    $SPRINTS"
  fi
done
```

## Board Workflows

### View Current Sprint Board

```bash
# Auto-detection
tract board

# Board detects open sprint and filters automatically
```

### View Specific Sprint Board

```bash
# Historical sprint
tract board --sprint 2026-W07

# Current sprint (explicit)
tract board --sprint current
```

### View Backlog (No Sprint Filter)

```bash
# When no sprint is open, board shows backlog
# Or force backlog view:
tract board --sprint all
```

## Rollback Workflows

### Undo Sprint Closure

Accidentally closed sprint:

```bash
# Reopen sprint
vim .tract/sprints/2026-W08.yaml
# Change: state: open

git add .tract/sprints/2026-W08.yaml
git commit -m "Reopen Sprint 8: closed in error"
git push
```

### Remove Ticket from Sprint

Ticket shouldn't be in current sprint:

```bash
vim issues/TB-123.md
```

Remove sprint from array:
```yaml
# Before
sprints: [2026-W07, 2026-W08]

# After (remove last element)
sprints: [2026-W07]
```

```bash
git add issues/TB-123.md
git commit -m "Remove TB-123 from Sprint 8"
git push
```

## Multi-Project Workflows

### Add Tickets from Multiple Projects

In a workspace with multiple projects:

```bash
cd ~/work/company

# Get current sprint
SPRINT=$(grep -l "state: open" .tract/sprints/*.yaml | xargs basename -s .yaml)

# Add frontend ticket
vim frontend/issues/FRONT-123.md
# Add: sprints: [$SPRINT]

# Add backend ticket
vim backend/issues/BACK-456.md
# Add: sprints: [$SPRINT]

# Commit all
git add frontend/issues/ backend/issues/
git commit -m "Add cross-project tickets to Sprint $SPRINT"
git push
```

### Sprint Progress Across Projects

```bash
SPRINT="2026-W08"

echo "Sprint $SPRINT - Cross-Project Progress:"
echo ""

for project in frontend backend platform; do
  if [ -d "$project/issues" ]; then
    TOTAL=$(grep -l "sprints:.*$SPRINT" $project/issues/*.md 2>/dev/null | wc -l)
    DONE=$(grep -l "sprints:.*$SPRINT" $project/issues/*.md 2>/dev/null | xargs grep -l "status: \(done\|closed\)" 2>/dev/null | wc -l)

    if [ $TOTAL -gt 0 ]; then
      echo "  $project: $DONE/$TOTAL done ($(( DONE * 100 / TOTAL ))%)"
    fi
  fi
done
```

## Best Practices

### Sprint Planning

1. **Review previous sprint before closing**
   - Identify blockers
   - Document lessons learned
   - Plan carryover strategy

2. **Set realistic sprint goals**
   - Clear, measurable objectives
   - Time-boxed scope
   - Team agreement on capacity

3. **Commit sprint changes atomically**
   - Close old + open new in one commit
   - Include carryover ticket updates
   - Clear commit messages

### During Sprint

1. **Add work intentionally**
   - Document why new work added
   - Check impact on sprint goal
   - Update team

2. **Track progress daily**
   - Use board view
   - Update ticket statuses
   - Identify blockers early

3. **Keep sprint state synchronized**
   - Pull changes regularly
   - Push updates promptly
   - Resolve conflicts quickly

### Sprint Closure

1. **Complete sprint retrospective**
   - What went well
   - What to improve
   - Action items for next sprint

2. **Clean carryover**
   - Review why tickets incomplete
   - Decide: carry over, backlog, or close
   - Update ticket priorities

3. **Document in commit message**
   - Completion metrics
   - Key achievements
   - Lessons learned
