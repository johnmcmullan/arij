# Boards, Sprints & Workflows - Implementation Status

## What's Already There

### 1. Boards ✅ (Partially)

**Web UI:**
```javascript
// app.js
app.get('/board', async (req, res) => {
  const tickets = {
    todo: allTickets.filter(t => t.status === 'todo'),
    in_progress: allTickets.filter(t => t.status === 'in_progress'),
    done: allTickets.filter(t => t.status === 'done')
  };
  res.render('board/index', { tickets });
});
```

**Works:** Kanban board with drag-and-drop (Todo/In Progress/Done)

**Missing:** 
- CLI board command
- Custom board definitions (`.tract/boards/*.yaml`)
- Filter-based columns (sprint, assignee, etc.)

**Schema defined:**
```yaml
# .tract/boards/engineering.yaml
name: Engineering Board
columns:
  - name: Sprint To Do
    filter: { status: todo, sprint: current }
  - name: In Progress
    filter: { status: in-progress }
  - name: Done
    filter: { status: done, sprint: current }
```

**Not implemented:** Reading/rendering custom board YAML files

---

### 2. Sprints ✅ (Schema Only)

**Schema defined:**
```yaml
# .tract/sprints/2026-W07.yaml
name: Sprint 7
start: 2026-02-10
end: 2026-02-21
goal: Ship FIX session stability fixes
```

**Tickets reference sprints:**
```yaml
# issues/APP-123.md
sprint: 2026-W07
```

**Not implemented:**
- Sprint YAML files created during onboarding
- `current` keyword resolution (find sprint where start <= today <= end)
- Sprint queries/filters
- CLI sprint commands

**Needs:**
- `tract sprint create 2026-W08 --start 2026-02-24 --end 2026-03-07`
- `tract sprint list`
- `tract sprint current` (show active sprint)
- Board filters using `sprint: current`

---

### 3. Workflows ⚠️ (Mentioned, Not Defined)

**In directory structure:**
```
.tract/
├── workflows/
```

**But:** No schema definition, no implementation.

**Question:** What are workflows in Tract?

**Option A: Status Transitions (Simple)**
```yaml
# .tract/workflows/default.yaml
transitions:
  todo:
    - in-progress
  in-progress:
    - review
    - done
  review:
    - in-progress  # Send back
    - done
  done:
    - [] # Terminal state
```

**Option B: Full Workflow Definitions (Complex)**
Like Jira workflows with conditions, validators, post-functions.

**Recommendation:** Skip workflows for now. Statuses alone are enough.

---

## What You're Right About

### "Boards = Just ripgrep search, right?"

**YES!** Boards are just filters over markdown frontmatter:

```bash
# "Sprint Todo" column
grep -l "status: todo" issues/*.md | xargs grep -l "sprint: 2026-W07"

# "Assigned to John" column
grep -l "assignee: john" issues/*.md

# "High priority bugs" column  
grep -l "type: bug" issues/*.md | xargs grep -l "priority: high"
```

**Board = Collection of grep queries + pretty display**

Web UI does this in JavaScript:
```javascript
tickets.filter(t => t.status === 'todo' && t.sprint === '2026-W07')
```

CLI could do:
```bash
tract board engineering
# Reads .tract/boards/engineering.yaml
# For each column, greps matching tickets
# Displays in columns (like ls -C or column command)
```

---

## Minimal Implementation (Monday Demo)

### What Works Now
1. ✅ Web UI board (basic Kanban)
2. ✅ Tickets have `sprint` field (in schema)
3. ✅ SCHEMA.md documents boards/sprints

### What's Missing
1. ⬜ CLI board command
2. ⬜ Custom board YAML files
3. ⬜ Sprint YAML files
4. ⬜ `current` sprint resolution

### Quick Wins (Week 1)

**1. Sprint Command (Simple)**
```bash
tract sprint create 2026-W08 \
  --start 2026-02-24 \
  --end 2026-03-07 \
  --goal "Auth refactor + performance"

# Creates .tract/sprints/2026-W08.yaml
```

**2. Board Query (Ripgrep-based)**
```bash
tract board
# Default board: Todo | In Progress | Done
# Uses grep to filter by status

tract board --sprint current
# Filters to current sprint

tract board --assignee john
# Filters to assignee
```

**3. LLM Integration**
```
User: "Show me the board for this sprint"

LLM: [Runs: grep -l "sprint: 2026-W07" issues/*.md | xargs grep "^status:"]
     [Groups by status]
     [Displays in columns]

Todo (3):
  APP-123: Fix login bug
  APP-124: Add OAuth
  APP-125: Update docs

In Progress (2):
  APP-120: Refactor auth
  APP-121: Add tests

Done (5):
  APP-115: Deploy staging
  ...
```

---

## Implementation Plan

### Critical (Before Monday)
- Nothing - schema is documented, web UI works

### High (Week 1)
1. ⬜ `tract sprint create` command
2. ⬜ `tract sprint list` command
3. ⬜ `tract board` command (simple grep-based)
4. ⬜ Update onboarding to create initial sprint

### Medium (Week 2)
5. ⬜ Custom board YAML support
6. ⬜ `current` sprint resolution
7. ⬜ Board filters (sprint, assignee, priority)
8. ⬜ Web UI reads custom board YAML

### Low (Month 2+)
9. ⬜ Sprint burndown (count done vs total)
10. ⬜ Velocity tracking
11. ⬜ Workflow transitions (if needed)

---

## Recommendation: Simple First

### Don't Build
- Complex workflow engine
- Full Jira workflow parity
- Custom validators/conditions

### Do Build
- Simple sprint YAML files
- Grep-based board queries
- LLM-friendly board display
- `current` sprint resolution

**Why:** Developers don't need fancy workflows. They need:
- "What's in this sprint?" (grep)
- "What am I working on?" (grep)
- "What's blocked?" (grep)

**Git is the workflow.** Statuses are metadata. Keep it simple.

---

## Monday Demo Script

**Don't show:**
- Unimplemented CLI board command
- Custom board YAML (not built yet)
- Sprint CLI (not built yet)

**Do show:**
1. **Web UI board** (works now)
   - Kanban with drag-and-drop
   - Todo/In Progress/Done

2. **Tickets with sprint field**
   ```yaml
   sprint: 2026-W07
   ```

3. **LLM can query**
   ```bash
   grep -l "sprint: 2026-W07" issues/*.md
   ```

4. **Schema documents it**
   - Show SCHEMA.md section on boards/sprints
   - "Designed for grep-ability"

**Message:** "Boards and sprints are in the schema. Web UI has basic Kanban. CLI commands coming Week 1."

---

## Your Question Answered

**Q:** "Do we support boards (just a ripgrep search, right?), sprints and workflows?"

**A:**
- **Boards:** YES (schema + web UI). CLI = ripgrep (not built yet, Week 1)
- **Sprints:** YES (schema defined). YAML files not auto-created yet (Week 1)
- **Workflows:** NO (not needed - git is the workflow, statuses are enough)

**Next steps:**
1. Week 1: `tract sprint create` + `tract board` (grep-based)
2. Week 2: Custom board YAML support
3. Skip workflows unless you see a specific need

---

**Bottom line:** Boards and sprints are designed and documented (SCHEMA.md). Implementation is partial (web UI works, CLI TBD). It's all just grep over markdown frontmatter - exactly as you said.
