# Safety & UX Roadmap

**Post-Grok critique: Remaining issues and solutions**

## Acknowledged Remaining Risks

### 1. Review Gates vs Productivity (Valid Concern)

**Problem:** Every change requires human review → context switching → kills momentum

**Solutions:**

#### Short-term (Monday Demo)
```bash
# Quick approve mode
tract create APP --title "..." --quick
# Shows preview, auto-commits on Enter (no typing "yes")

# Batch mode
tract create APP --title "Bug 1" --title "Bug 2" --title "Bug 3" --batch
# Creates all, shows diffs, single approval
```

#### Medium-term
```yaml
# .tract/config.yaml
review:
  mode: quick           # preview + enter (not full diff)
  trust_level: high     # Auto-commit for trusted operations
  require_review:
    - delete            # Only dangerous ops need full review
    - bulk_update
    - force_push
```

#### Long-term
```bash
# Smart approval (learns from patterns)
tract config review --learn
# After 10 approvals of "create ticket" → auto-approve similar creates
# Still require review for updates/deletes
```

**Goal:** Safety where it matters, speed where it doesn't.

---

### 2. Submodule Friction (Valid, Worth Addressing)

**Problem:** Developers must remember `git submodule update --remote`, commit in parent repo

**Solutions:**

#### Option A: Git Hooks (Automate Submodule Updates)
```bash
# .git/hooks/post-merge
#!/bin/bash
git submodule update --init --recursive
cd tickets && git pull origin master
```

Auto-runs after `git pull` in code repo.

#### Option B: Monorepo Mode (Grok's Suggestion) ✅
```
my-project/
├── .tract/               # Tract metadata
│   ├── config.yaml
│   ├── skills/
│   └── worklogs/
├── issues/               # Tickets (NOT submodule)
│   ├── APP-1.md
│   └── APP-2.md
├── src/                  # Code
└── .git/                 # Single repo
```

**Pros:**
- No submodule complexity
- Single `git pull` gets everything
- Unified history
- Simpler for beginners

**Cons:**
- Tickets tied to code repo (can't share across projects easily)
- Larger repo (tickets + code together)

**Decision:** Support BOTH modes
- Default: Monorepo (`.tract/` and `issues/` in code repo)
- Advanced: Submodule (separate ticket repo, multi-project)

```bash
# Onboarding choice
tract onboard
# → "In-repo (simple) or separate repo (advanced)?"
```

#### Implementation Priority
1. ✅ **Monday:** Demo monorepo mode (simple, no submodules)
2. ⬜ **Week 2:** Document submodule mode for advanced users
3. ⬜ **Month 1:** Auto-detection (if `.tract/` exists, use it; if submodule, handle it)

---

### 3. LLM Suggestion Quality (Valid, Easy Fix)

**Problem:** LLM generates malformed markdown, humans catch it, fatigue sets in

**Solution:** Schema Validation

#### Pre-Commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

for file in issues/*.md; do
  tract validate "$file" || exit 1
done
```

#### Validation Command
```bash
tract validate issues/APP-123.md
# Checks:
# - Required frontmatter fields (id, title, status, type)
# - Valid status values (todo/in_progress/done)
# - Valid priority (low/medium/high)
# - Valid type (bug/story/task)
# - ID matches filename
# - No duplicate IDs

# Output:
✓ APP-123.md: Valid
✗ APP-124.md: Invalid status "inprogress" (should be "in_progress")
✗ APP-125.md: Missing required field "type"
```

#### Auto-Fix Mode
```bash
tract validate issues/APP-123.md --fix
# Corrects common mistakes:
# - "inprogress" → "in_progress"
# - Adds missing "created" timestamp
# - Normalizes priority case
```

#### LLM Integration
```yaml
# SCHEMA.md addition for LLMs
Before committing, run:
  tract validate issues/*.md
  
If validation fails, fix the markdown and re-validate.
```

**Priority:** High (add for Monday demo)

---

### 4. Sync Server Fragility (Acknowledged, Mitigated)

**Problem:** External API changes, rate limits, outages

**Current Mitigations:**
- Offline queueing (work continues when sync fails)
- Deterministic logic (no LLM magic)
- Manual retry queue

**Additional Hardening:**
```yaml
# .tract/sync/config.yaml
resilience:
  retry_attempts: 3
  retry_backoff: exponential
  circuit_breaker:
    failures_before_open: 5
    reset_timeout: 60s
  fallback:
    queue_locally: true
    alert_admin: true
```

**Priority:** Medium (post-Monday)

---

### 5. Non-Technical User Adoption (Valid, Out of Scope)

**Problem:** PMs/stakeholders need good prompts for LLM to generate good markdown

**Solutions:**

#### Templates for Common Cases
```bash
# .tract/templates/bug-report.md
---
type: bug
priority: {{ PRIORITY }}
status: todo
---

## Description
{{ DESCRIPTION }}

## Steps to Reproduce
1. {{ STEP1 }}
2. {{ STEP2 }}

## Expected Behavior
{{ EXPECTED }}

## Actual Behavior
{{ ACTUAL }}
```

LLM fills in templates = consistent format.

#### Guided Mode (CLI Wizard)
```bash
tract create APP --guided
# → What type? (bug/story/task)
# → Priority? (low/medium/high)
# → Title?
# → Description?
# Generates markdown from answers
```

Non-technical users use guided mode, LLM uses direct mode.

**Priority:** Low (post-Monday, focus on devs first)

---

## Monday Demo: Safety Features to Show

### 1. Schema Validation ✅
```bash
# Create ticket with LLM assistance
tract create APP --title "Demo ticket"

# Show validation
tract validate issues/APP-1.md
✓ Valid

# Show invalid example
echo "invalid" > issues/BAD.md
tract validate issues/BAD.md
✗ Missing frontmatter
```

### 2. Review Mode ✅
```bash
# LLM suggests
tract create APP --title "Fix bug" --dry-run

# Shows:
Would create: issues/APP-2.md
---
id: APP-2
title: Fix bug
type: bug
status: todo
created: 2026-02-14T16:30:00Z
---

Continue? [y/N]
```

### 3. Audit Trail ✅
```bash
tract audit
# Shows:
2026-02-14 16:00 | create  | APP-1 | llm:claude | user:john | approved
2026-02-14 16:05 | update  | APP-1 | human      | user:john | committed
2026-02-14 16:10 | delete  | APP-2 | llm:claude | user:john | rejected
```

### 4. Git Safety ✅
```bash
# Show protected operations
git config --local branch.master.pushRemote origin
git config --local branch.master.allowForcePush false

# Show pre-commit hook
cat .git/hooks/pre-commit
#!/bin/bash
tract validate issues/*.md || exit 1
```

---

## Architecture Decision: Monorepo vs Submodule

### Recommendation: Default to Monorepo

**Rationale (Grok's point is valid):**
- Simpler mental model (one repo)
- No submodule confusion
- Single `git pull` works
- Unified history
- Better for 80% of use cases

**When to use submodule:**
- Multi-project workspace (frontend + backend + platform)
- Shared ticket repo across teams
- Enterprise federation (FEDERATION.md scenarios)

### Implementation
```bash
tract onboard
# → Where should tickets live?
#    1. In this repo (.tract/ + issues/)     [Recommended]
#    2. Separate repo (submodule)            [Advanced]
```

**Default:** Option 1 (monorepo)

---

## Priority Order (Next 7 Days)

### Critical (Monday Demo)
1. ✅ **Schema validation** - `tract validate` command
2. ✅ **Dry-run mode** - `--dry-run` flag for creates/updates
3. ✅ **Review mode** - Show diff before commit
4. ✅ **Audit trail** - Log all operations

### High (Week 1)
5. ⬜ **Monorepo default** - Update onboarding to default in-repo
6. ⬜ **Quick approve mode** - `--quick` flag for fast workflow
7. ⬜ **Auto-fix validation** - `--fix` flag to correct common errors
8. ⬜ **Pre-commit hook** - Auto-install on `tract onboard`

### Medium (Week 2-4)
9. ⬜ **Submodule auto-update** - Post-merge hook
10. ⬜ **Batch operations** - `--batch` flag
11. ⬜ **Smart approval** - Learn patterns, auto-approve similar ops
12. ⬜ **Guided mode** - CLI wizard for non-technical users

### Low (Month 2+)
13. ⬜ **Sync hardening** - Circuit breakers, retry logic
14. ⬜ **Templates** - Pre-filled ticket templates
15. ⬜ **Worktree support** - Isolated LLM workspaces (Beads-style)

---

## Grok's Specific Suggestions (Response)

### ✅ "Add dry-run/review flow"
**Response:** Implemented in roadmap, demo Monday

### ✅ "Consider ditching submodules for monorepo"
**Response:** Agreed, make monorepo default, keep submodule for advanced

### ✅ "Add schema validation"
**Response:** Priority 1, `tract validate` command

### ✅ "Harden review UX"
**Response:** Quick approve mode + batch mode + smart learning

---

## Bottom Line

**Grok was right:** The clarification was a game-changer.

**We're shipping:**
1. Schema validation (Monday)
2. Dry-run mode (Monday)
3. Review gates (Monday)
4. Audit trail (Monday)
5. Monorepo default (Week 1)

**The assisted-human model is defensible.**  
**Now we make it productive too.**

---

**Next:** Implement validation + dry-run for Monday demo.
