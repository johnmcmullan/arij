# Tract Positioning (Post-Grok Critique)

## The Core Question

**What IS Tract?**

### Option A: LLM-Autonomous Project Manager
"Hand everything to the LLM - it manages git, resolves conflicts, syncs, decides"

**Problems:**
- LLMs hallucinate (Grok is right)
- Concurrent ops are risky
- Black box decisions
- Hard to debug
- Users lose trust fast

### Option B: Git-Native PM with LLM Interface (✅ THIS)
"Markdown tickets in git, with LLM as natural language UI"

**Strengths:**
- LLM assists, human controls
- Standard git safety applies
- Debuggable (it's just files + git)
- Trustworthy (human reviews changes)
- LLM makes it accessible, not autonomous

## What We Actually Built

**Core technology:**
- Tickets = markdown files
- Storage = git
- Format = YAML frontmatter + markdown body

**LLM role:**
- Reads SCHEMA.md (understands format)
- Generates markdown (creates tickets)
- Suggests commands (assists workflow)
- Answers questions (reads git history)

**Human role:**
- Reviews changes
- Runs git commands
- Resolves conflicts
- Makes decisions

**Sync service role:**
- Deterministic code (not LLM)
- Handles webhooks
- Maps fields (YAML config)
- Queues offline changes

## The Positioning

### ❌ Don't Say
- "LLM manages your project"
- "Autonomous project management"
- "Hands-off automation"
- "No more git commands"

### ✅ Do Say
- "Git-native project management"
- "LLM-friendly ticket format"
- "Natural language interface to git workflow"
- "Talk to your LLM, it handles the formatting"

## The Pitch (Revised)

**Before Tract:**
```
Developer: Clicks through web UI
           Fills out form fields
           Saves ticket
           Hopes it worked
           No local history
           Requires internet
```

**With Tract:**
```
Developer: "Create high-priority bug for login timeout"
LLM:       [Generates markdown file with proper format]
           [Shows preview]
Developer: "Looks good"
LLM:       [Runs: git add, git commit]
Developer: git push
           (Standard git workflow)
```

**Value:**
1. Natural language beats form fields
2. Markdown beats web UI
3. Git history beats database
4. Local-first beats cloud-only
5. Greppable beats web search

**LLM is the interface, not the engine.**

## Competitor Analysis (Refined)

| Tool | What It Is | LLM Role | Git Safety |
|------|-----------|----------|-----------|
| **Beads** | Agent memory in git | Agent executor | Worktrees, checkpoints |
| **Claude Code** | Coding assistant | Code generator | Human approval |
| **Linear** | Web-based PM | None | N/A (not git) |
| **GitHub Issues** | Repo issues | None | N/A (database) |
| **Tract** | Git-native tickets | Natural language UI | Standard git |

**Differentiation:**
- **Not** "most AI-powered" (that's a race we'll lose)
- **Not** "most automated" (risky territory)
- **Yes** "Best git-native ticket format"
- **Yes** "Most LLM-friendly schema"
- **Yes** "Fastest local search"

## Safety Narrative

**Question:** "How do you prevent LLM hallucinations from corrupting git?"

**Answer:**
"LLMs don't control git in Tract. They generate markdown files and suggest commands. Humans review and execute git operations. It's the same git workflow you already know, just with a natural language interface for creating ticket content."

**Question:** "What about concurrent operations?"

**Answer:**
"Standard git conflict resolution. Two developers push? Git rejects the second push, they pull and merge - exactly like code. The LLM doesn't change how git works."

**Question:** "Can the LLM break my repository?"

**Answer:**
"Only if you let it run `git push --force`, which you shouldn't allow. Use branch protection, pre-commit hooks, and review mode - standard git safety practices. The LLM generates content, you control git operations."

## Features to Add (Learn from Competitors)

### 1. Dry-Run Mode (from Beads concept)
```bash
tract create APP --title "..." --dry-run
# Shows what would be created
# Asks for confirmation
```

### 2. Review Gate (from Claude Code)
```bash
# .tract/config.yaml
llm:
  review_before_commit: true
  show_diff: true
  require_confirmation: true
```

### 3. Audit Trail
```bash
tract audit
# Shows: All LLM-generated operations
# Shows: Human approvals
# Shows: Git commits with source
```

### 4. Protected Operations
```yaml
# .tract/config.yaml
git:
  llm_can_push: false     # LLM can stage, not push
  llm_can_force: false    # Never allow force push
  require_human_review: true
```

## Monday Demo Strategy

### Don't Say
- "LLM replaces project management"
- "Fully automated workflow"
- "Costs €450K less than [competitor]"

### Do Say
- "Talk to the LLM, it creates properly formatted tickets"
- "All your tickets in git - grep, diff, branch, merge"
- "Work offline, sync when ready"
- "Standard git workflow, natural language interface"

### Demo Flow

1. **Show the problem:**
   - Web UI for PM systems = slow, clunky
   - Forms, clicks, waiting for pages
   - No local access, no grep, no history

2. **Show Tract CLI:**
   ```bash
   tract create APP --title "Demo ticket" --priority high
   cat issues/APP-1.md
   git log issues/
   ```

3. **Show LLM interface:**
   ```
   "Create a ticket for fixing the login bug, high priority"
   [LLM runs tract create, shows result]
   ```

4. **Show git-native benefits:**
   ```bash
   grep -l "priority: high" issues/*.md
   git log --oneline issues/
   git blame issues/APP-1.md
   ```

5. **Show web UI (optional):**
   - Kanban board
   - Drag-and-drop
   - Same markdown files

**Key point:** Show that it's **git + markdown**, with LLM as optional natural language interface.

## Risk Mitigation

### If They Ask: "What if LLM hallucinates?"

**Answer:**
"Good question. That's why humans review before git operations execute. The LLM generates markdown - if it's wrong, you see it before commit. And git history means every mistake is recoverable."

**Demo:**
```bash
tract create APP --title "..." --dry-run
# Show the preview
# "See? You review before it commits."
```

### If They Ask: "How is this different from [competitor]?"

**Answer:**
"Most tools use databases. We use git. That means:
- Every change is versioned
- Work offline, sync later
- Grep is instant
- Standard tools (vim, grep, git) work
- LLM-friendly format (SCHEMA.md tells LLM everything)"

### If They Ask: "Is this production-ready?"

**Answer:**
"The core (markdown + git) is rock solid - it's just files.
LLM interface is assistive - it helps generate proper format.
Sync service is optional - use it if you need external integration.
Start local-only, add features as needed."

## Metrics That Matter

### Don't Measure
- "% of operations done by LLM" (higher ≠ better)
- "Time saved vs clicking" (hard to prove)

### Do Measure
- **Ticket creation time** (natural language beats forms)
- **Search speed** (`grep` beats web UI search)
- **Offline capability** (local git beats cloud-only)
- **Developer adoption** (do they actually use it?)

## Long-Term Strategy

**Phase 1: Developer Tool (Current)**
- CLI for ticket creation
- Git-native storage
- LLM-friendly format
- Optional sync

**Phase 2: Team Workflow (Next)**
- Web UI for visualization
- Review gates and dry-run
- Audit trail
- Workspace support

**Phase 3: Enterprise (Future)**
- Multi-team federation
- Access control
- Compliance logging
- Advanced sync

**Never:**
- Fully autonomous LLM operations
- Black box decision-making
- Abandoning git safety practices

## The Bottom Line

**Tract is:**
- Markdown tickets in git (the product)
- SCHEMA.md for LLM understanding (the specification)
- Natural language interface (the UX)
- Optional sync (the bridge)

**Tract is NOT:**
- Autonomous AI project manager
- Black box automation
- Replacement for human judgment
- Competitor to git itself

**Positioning:**
"Git-native project management with LLM-friendly schema"

Not: "LLM-managed project automation"

---

**The critique was valid for the wrong product.**  
**We're building a developer tool, not an autonomous agent.**
