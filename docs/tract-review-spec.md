# Tract Review — Specification

**Status:** Draft  
**Date:** 2026-03-01  
**Author:** John McMullan / Wylie  

---

## Overview

Tract Review replaces the pull request workflow in Bitbucket/GitHub with a
protocol built entirely on git and markdown. A review is not a separate entity
in a web UI — it is a structured phase in the ticket's own lifecycle, recorded
as a `review:` block in the ticket frontmatter.

The core philosophy: **a PR is just a ticket in the `in-review` state, with
structured context attached.**

No Bitbucket. No web UI required. Full audit trail in git. Works with agents
and humans as first-class reviewers.

---

## Ticket Lifecycle

```
open → in-progress → in-review → done
                          ↑
                    review block written
                    by agent or developer
```

The `in-review` status is the gate. Nothing merges without it being cleared
by the required approvals.

---

## Ticket Schema — Review Block

Added to the YAML frontmatter of any ticket when it enters `in-review`:

```yaml
review:
  branch: fix/TB-1234-order-routing       # required
  opened: 2026-03-01T11:30:00Z            # ISO 8601, set on transition
  opened_by: claude-sonnet-4-6            # agent id or username
  confidence: 0.87                        # 0.0–1.0, agent-set (omit if human-opened)
  required_approvals: 2                   # override project default
  approvals: []                           # filled in as reviews arrive
```

### Approval entry

```yaml
approvals:
  - by: john.mcmullan          # username or agent id
    kind: human                # human | agent
    at: 2026-03-01T12:15:00Z
    verdict: approved          # approved | rejected | abstain
    comment: "Happy with the async approach, good call rejecting Redis"
  - by: claude-opus-4
    kind: agent
    at: 2026-03-01T12:01:00Z
    verdict: approved
    comment: "No issues found. Flagged one style nit (non-blocking)."
    confidence: 0.94
```

### Review narrative block

Below the frontmatter, a `## Review` section is appended to the ticket body
by the agent (or developer) when opening the review:

```markdown
## Review

### What changed
Plain English summary of the change and why. Not a diff — the diff is dynamic.

### Considered and rejected
What alternatives were evaluated and why they were ruled out.

### Test coverage
What was tested, how, and results.

### Agent uncertainty
Specific areas the agent is not confident about. Honest. Reviewers should
focus here. Omit if confidence > 0.95.

### Blast radius
What breaks if this is wrong. Especially important for financial systems.
```

The diff is never stored in the file. It is always live:

```
git diff main...fix/TB-1234-order-routing
```

---

## Review Policy

Defined in `.tract/config.yaml` at the project level:

```yaml
review:
  required_approvals: 2          # minimum approvals before merge is allowed
  required_human_approvals: 1   # of the total, at least N must be human
  approvers:                     # optional allowlist — if empty, anyone can approve
    - john.mcmullan
    - senior-dev-2
    - claude-opus-4              # agents can be named approvers too
  agent_reviewers:               # agents auto-invoked when review opens
    - claude-opus-4
  confidence_policy:             # scale required_approvals based on agent confidence
    - max_confidence: 0.70
      required_approvals: 3
      required_human_approvals: 2
    - max_confidence: 0.90
      required_approvals: 2
      required_human_approvals: 1
    - max_confidence: 1.00
      required_approvals: 1
      required_human_approvals: 1
```

### Confidence policy

If an agent opens the review with a `confidence` score, the policy table is
evaluated top-to-bottom and the first matching band wins — overriding the
project defaults. This means:

- Low confidence → more human eyes required
- High confidence → lighter touch, faster cycle
- Human-opened reviews → no confidence score, project defaults apply

---

## Reviewers

Reviewers are a first-class concept. Any named entity — human or agent — can
hold a reviewer role. The audit trail treats them identically.

### Human reviewers

Identified by their git/tract username. They run `tract approve` or
`tract reject` from the terminal. They can read the ticket, run
`tract review` to see the diff and narrative side by side, and leave a comment.

### Agent reviewers

Named by model id (e.g. `claude-opus-4`). When an `agent_reviewers` list is
configured, the sync daemon (or a git hook) automatically invokes each agent
reviewer when a ticket transitions to `in-review`. The agent:

1. Reads the ticket (including the review narrative)
2. Fetches the live diff
3. Writes its verdict to the `approvals` array
4. Commits and pushes

Agent review happens in seconds. Human review can happen async. Both are
recorded identically.

### Blame minimisation

Shared approval is deliberate. When multiple reviewers — human and agent —
sign off on a change, blame is distributed. No single person carries the risk.
The audit trail shows *who reviewed*, *what they saw*, and *what they said*,
which is more useful in a post-incident review than "who merged the PR."

If an agent reviewer flags uncertainty and a human approves anyway, that is
visible in the record. If nobody flagged the issue, that is also visible.
Honest history, not blame assignment.

---

## CLI Commands

### `tract review <ticket>`

Shows the review dashboard for a ticket:

- Ticket frontmatter (status, branch, confidence, approvals so far)
- Review narrative (what changed, uncertainty, blast radius)
- Live diff: `git diff main...<branch>`
- Current approval status vs required

```
TB-1234  fix/TB-1234-order-routing  [in-review]

Confidence: 0.87  Required: 2 approvals (≥1 human)
Approvals:  1/2   claude-opus-4 ✓ approved

UNCERTAINTY — agent flagged:
  router.rs lines 47-63: behaviour under partial network partition

[diff follows...]
```

### `tract approve <ticket> [--comment "..."]`

Appends an approval entry to the ticket frontmatter. If quorum is met,
prompts to merge (or merges automatically if `review.auto_merge: true`).

### `tract reject <ticket> [--comment "..."]`

Appends a rejection. Transitions ticket back to `in-progress`.
The branch is not deleted. The review block is preserved for history.

### `tract open-review <ticket> [--branch <branch>] [--confidence <0.0-1.0>]`

Transitions a ticket to `in-review`, writes the review block, and triggers
configured agent reviewers. Typically called by an agent after pushing a branch,
but can be called by a developer manually.

---

## Merge

Merge is a deliberate step, not automatic by default. When quorum is met:

```
$ tract approve TB-1234 --comment "Good call on the async approach"
✓ Approval recorded (2/2 — quorum met)

Ready to merge fix/TB-1234-order-routing → main
  tract merge TB-1234
```

`tract merge <ticket>` performs the actual git merge, updates ticket status
to `done`, and commits. The merge commit message is structured:

```
TB-1234: Fix order routing latency

Reviewed by: john.mcmullan (human), claude-opus-4 (agent)
Confidence: 0.87
Branch: fix/TB-1234-order-routing
```

---

## Git Hooks

### Pre-commit (existing, unchanged)

Enforce ticket key prefix on commit messages. Already in place at Broadridge.
`TB-1234: ...` format required.

### Post-push (new)

When a branch matching `fix/<KEY>-*` or `feat/<KEY>-*` is pushed, a hook
(or the sync daemon) detects the branch, checks if the ticket exists, and
prompts (or automatically calls) `tract open-review`. Configurable.

---

## What this replaces

| Bitbucket/Bamboo          | Tract Review                          |
|---------------------------|---------------------------------------|
| Pull Request              | Ticket in `in-review` state           |
| PR description            | `## Review` section in ticket body    |
| Inline comments           | `approvals[].comment` in frontmatter  |
| Approval button           | `tract approve <ticket>`              |
| Merge button              | `tract merge <ticket>`                |
| CI trigger on PR          | git hook or daemon detecting branch   |
| Audit log                 | git history                           |
| Required reviewers        | `review.approvers` in config.yaml     |

---

## What this does NOT replace (yet)

- **CI/CD pipelines** — Bamboo still runs. Tract Review does not manage
  build/test execution. That is a separate problem.
- **Code browsing** — no web UI for navigating the codebase. Git + terminal.
- **Notifications** — currently out of scope. Could be a webhook or a
  tract-native notification mechanism.

---

## Open questions

1. **Rejected reviews** — should the review block be preserved verbatim, or
   annotated? Leaning toward preserve-and-annotate for full history.
2. **Agent reviewer invocation** — via sync daemon webhook, or a separate
   tract-review-agent service? Daemon hook is simpler.
3. **Required human approvals = 0** — allow full agent-only approval for
   low-risk/high-confidence changes? Probably yes, but opt-in per project.
4. **Branch naming** — enforce `<type>/TB-NNNN-<slug>` strictly, or just
   require the key somewhere in the branch name?
5. **Notifications** — how do human reviewers know a review is waiting?
   Could be as simple as `tract review --pending` in a terminal, or a
   Telegram/Signal message via OpenClaw.

---

## Next steps

1. Schema: add `review:` block to tract-schema SKILL.md
2. CLI: stub `tract open-review`, `tract approve`, `tract reject`, `tract merge`
3. Daemon: detect branch push, trigger agent reviewers
4. Pilot: one low-risk project at Broadridge (or tbricks) to prove the loop
