# LLM Safety & Architecture Clarification

**Response to concerns about LLM-managed git operations**

## The Real Architecture (What Grok Missed)

### Tract Has TWO Operating Modes

**Mode 1: Developer-Assisted (Default)**
```
Human: "Create ticket for auth bug"
  ↓
LLM: Generates markdown → Shows preview
  ↓
Human: Reviews → Approves
  ↓
LLM: git add issues/APP-123.md
     git commit -m "..."
  ↓
Human: git push (manual, or reviews LLM suggestion)
```

**Mode 2: Server-Managed (Multi-User)**
```
Human: Edits ticket via Web UI
  ↓
Sync Server: Generates git commit (deterministic)
              Uses service account
              Handles conflicts (merge logic, not LLM)
  ↓
Git: Distributed to all developers
```

**Key point:** LLM is **assistant**, not **autonomous operator**.

## Safety By Design

### 1. LLM Assists, Human Confirms

**Current workflow:**
```bash
# LLM suggests
tract create APP --title "Fix login" --priority high

# Human sees output
Created APP-3350

# Human decides when to push
git status  # Review changes
git push    # Manual step
```

**Not this:**
```bash
# LLM autonomously
[Runs: tract create && git push]  # ❌ No confirmation
```

### 2. Sync Server Is Deterministic (Not LLM)

**External system sync:**
- Sync server = Node.js code (deterministic)
- Webhook handlers = Fixed logic
- Field mappings = YAML config
- Conflict resolution = Merge strategies (last-write-wins, manual queue)

**LLM role in sync:** ZERO
- LLM doesn't touch sync logic
- LLM doesn't make API calls
- LLM doesn't resolve conflicts

### 3. Git Safety Features (Standard Practices)

**Branch protection:**
```yaml
# .tract/config.yaml
git:
  protected_branches:
    - master
  require_review: true
  no_force_push: true
```

**Pre-commit hooks:**
```bash
#!/bin/bash
# .git/hooks/pre-commit
tract validate || exit 1  # Validate ticket format
```

**Multiple remotes:**
```bash
# Backup remote (auto-push)
git remote add backup git@backup-server:tickets.git
```

### 4. Workspace Isolation (Single User)

**Developer workstation:**
- One developer = One LLM
- No concurrent LLM operations
- Local workspace, human in control

**Server (multi-user):**
- Sync service = Deterministic code
- No LLM decision-making
- Humans use Web UI or CLI

## Addressing Specific Concerns

### "Force Push Disasters"

**Prevention:**
```yaml
# .tract/config.yaml
git:
  allow_force_push: false  # Default
  
# Server config
protected_branches:
  - master
  - main
```

**Git server config:**
```bash
# GitHub/GitLab branch protection
- Require pull request reviews
- Prevent force push
- Require status checks
```

### "Concurrent LLM Operations"

**Reality:**
- Developers work in **local clones**
- Push conflicts → Git rejects
- Human resolves (standard git workflow)

**Not an LLM problem:**
```bash
# Two developers, normal git
Developer A: git push
Developer B: git push
# → Rejected, "Updates were rejected"
# → Developer B pulls, merges, pushes
```

This is **normal git**, not LLM-specific.

### "Sync Logic Black Box"

**Actual sync architecture:**
```
Ticket Update
  ↓
Sync Server (deterministic Node.js)
  ↓
Field Mapper (YAML config)
  ↓
External API (REST calls)
  ↓
Queue (if offline)
```

**No LLM involved.** Sync is code, not AI.

### "Hallucinated Field Mappings"

**Field mappings are config:**
```yaml
# .tract/sync/field-map.yaml
tract_to_external:
  status:
    todo: "To Do"
    in_progress: "In Progress"
    done: "Done"
  priority:
    high: "High"
    medium: "Medium"
    low: "Low"
```

**Not LLM-generated.** Fixed, deterministic.

## What LLMs ARE Good For

### 1. Natural Language → Structured Data

**Human:** "Create high-priority bug for login timeout"

**LLM generates:**
```yaml
---
id: APP-3350
title: Fix login timeout
type: bug
priority: high
status: todo
---
```

**Human reviews before commit.**

### 2. Reading/Understanding Tickets

**Human:** "What's blocking APP-3350?"

**LLM:**
```bash
# Reads: issues/APP-3350.md
# Finds: links.depends_on = [BACK-456]
# Checks: issues/BACK-456.md status = in_progress

"APP-3350 is waiting on BACK-456 (API endpoint), 
which is in progress, assigned to Sarah."
```

### 3. Generating Commands (Human Executes)

**Human:** "Log 2 hours on APP-3350"

**LLM suggests:**
```bash
tract log APP-3350 2h "Fixed timeout by increasing session TTL"
```

**Human runs it** (or LLM runs, human reviews output).

## Comparison to Competitors

| Tool | LLM Role | Git Safety |
|------|----------|-----------|
| **Beads** | Memory/tasks in git, agent executes | Worktrees, checkpoints |
| **Claude Code** | Code generation, can run git commands | Human approval mode |
| **Tract (current)** | Assistant, generates markdown/commands | Human in loop, standard git |
| **Tract (future)** | Add dry-run mode, review gates | Protected branches, hooks |

## Proposed Safety Enhancements

### 1. Dry-Run Mode (Learn from Competitors)

```bash
tract create APP --title "..." --dry-run
# Shows: Would create issues/APP-3350.md
# Shows: Would run: git add issues/APP-3350.md
# Asks: Continue? [y/N]
```

### 2. Review Gates

```bash
# .tract/config.yaml
review:
  require_approval: true  # Show diff before commit
  auto_push: false        # Never auto-push
```

### 3. Worktree Support (Borrow from Beads)

```bash
# Experimental: LLM works in worktree
tract workspace create feature-123
# Creates: .tract/worktrees/feature-123/
# LLM operates there
# Human merges when ready
```

### 4. Audit Log

```bash
# .tract/audit.jsonl
{"timestamp":"2026-02-14T16:00:00Z","action":"create","ticket":"APP-3350","source":"llm","user":"john"}
{"timestamp":"2026-02-14T16:01:00Z","action":"commit","files":["issues/APP-3350.md"],"source":"llm","user":"john"}
{"timestamp":"2026-02-14T16:02:00Z","action":"push","branch":"master","source":"human","user":"john"}
```

## The Real Value Proposition

**Tract's core value ISN'T "LLM does everything autonomously"**

**It's:**
1. **Tickets = markdown files** (readable, greppable, diffable)
2. **Git = storage** (versioned, distributed, proven)
3. **LLM = natural interface** (talk instead of click)
4. **Optional sync** (integrate with external systems)

**LLM is the UI layer, not the orchestrator.**

## Positioning: LLM-Friendly, Not LLM-Autonomous

### ❌ Don't Say
"LLM manages everything, hands-off automation!"

### ✅ Do Say
"LLM-friendly interface to git-native project management"

**What that means:**
- LLM reads SCHEMA.md, understands ticket format
- LLM generates markdown, suggests commands
- Human reviews, approves, controls git
- Standard git workflows apply

## Atlassian Timeline (Separate Issue)

**Grok's point:** LLM doesn't buy time on Atlassian EOL

**True, but:**
- Tract's value = git-native, LLM-friendly **regardless** of external sync
- Migration from external systems = one-time, human-supervised
- LLM helps generate tickets during migration, but humans validate

**Position:**
- Tract works standalone (no external system required)
- Sync is **optional** (for existing users transitioning)
- Long-term: Pure git-native, no external dependencies

## Conclusion

**Grok's critique assumes:** LLM = autonomous operator, direct git control, no human in loop

**Tract's reality:**
- LLM = assistant interface
- Human = in control of git operations
- Sync server = deterministic code (not LLM)
- Standard git safety applies (protected branches, hooks, reviews)

**Next steps:**
1. ✅ Clarify positioning (LLM-friendly, not autonomous)
2. ⬜ Add dry-run mode
3. ⬜ Add review gates
4. ⬜ Document audit trail
5. ⬜ Consider worktree support (for advanced users)

**The criticism is valid if we position as "LLM does everything."**  
**It's unfounded if we position as "LLM-assisted git-native PM."**

---

**Remember:** Git has worked for 20 years without LLMs. Adding LLM as natural language interface doesn't break git's safety model - it just makes it more accessible.
