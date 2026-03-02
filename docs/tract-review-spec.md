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
# Tract Review Specification

## Philosophy

Tract is for LLMs. Code review tooling is for humans.

Tract Review is not a PR system — it is the **contract layer** between agent work and
the main branch. The human-facing diff view, inline comments, and approval UI are
provided by **Forgejo** (or Gitea), which runs on the same host. Tract owns the ticket
state and enforces the merge gate. The two systems are loosely coupled through a single
shared identifier: the branch name.

```
Forgejo  — code hosting, diff UI, human inline comments, branch protection
Tract    — ticket state, agent workflow, approval record, merge gate hook
```

Tract never renders a diff. Forgejo never knows about sprints, epics, or custom fields.


## Identity Model

Two classes of reviewer are recognised:

**Human-in-the-loop** — an agent or human working in an interactive terminal session.
Commits are authenticated by the operator's SSH key. The human is accountable for
whatever lands under their key, regardless of how much an LLM contributed.
Counts as a human approval.

**Automated agent** — a daemon or CI process running under a service account
(e.g. `tract-sync`). Commits under a known service key. Can post an agent review
with a confidence score. Never counts as a human approval.

Enforcement relies on SSH key authentication to the git server. There is no separate
token or signature scheme — git commit authorship under a verified key is the audit trail.


## Data Model

### Branch field on tickets

When a branch is created for a ticket, the branch name is written explicitly into the
ticket frontmatter by the operator or agent:

```yaml
id: TB-1234
status: in-progress
branch: feature/TB-1234-fix-session-stability
```

Multiple branches are supported (e.g. separate frontend/backend work):

```yaml
branches:
  - feature/TB-1234-backend
  - feature/TB-1234-frontend
```

The `tract branch` CLI command creates the git branch and writes this field atomically.

### Review frontmatter block

When a ticket moves to `in-review`, a `review:` block is added:

```yaml
id: TB-1234
status: in-review
branch: feature/TB-1234-fix-session-stability
review:
  base: main
  opened: 2026-03-02T10:00:00Z
  opened_by: john.mcmullan
  policy: 1-human
  approvals:
    - reviewer: copilot
      type: agent
      confidence: 0.81
      approved: true
      at: 2026-03-02T10:05:00Z
      summary: "No regressions found. Edge case in line 47 noted but non-blocking."
    - reviewer: john.mcmullan
      type: human
      approved: true
      at: 2026-03-02T10:22:00Z
```

### Review section in ticket body

The `## Review` section of the ticket markdown is the human-readable review thread.
Reviewers append comments here. Agents write their summary here automatically.
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
### copilot — 2026-03-02T10:05

Reviewed diff against `main`. Logic is correct. Minor: `session.go:47` uses a bare
`recover()` with no logging — non-blocking but worth a follow-up ticket.
Confidence: 0.81 — approving.

### john.mcmullan — 2026-03-02T10:22

Looks good. Raised TB-1289 for the recovery logging. Approving.
```

All of this is plain markdown committed to git. No database. No lock-in.


## Approval Policy

Policies are defined per-project in `.tract/config.yaml`:

```yaml
review:
  policy: 1-human          # default — at least one human approval required
  # policy: 2-human        # higher risk paths
  # policy: agent-only     # for automated/low-risk changes (e.g. dependency bumps)
```

Policy can be overridden per-ticket in the `review:` block.

**Policy evaluation** (checked by the pre-receive hook):

| Policy | Requirement |
|---|---|
| `1-human` | ≥1 approval where `type: human` |
| `2-human` | ≥2 approvals where `type: human` |
| `agent-only` | ≥1 approval of any type |
| `none` | No approvals required (escape hatch, logged) |

Agent approvals are always recorded but never satisfy a human requirement.
Low confidence agent approvals (< 0.6) are flagged as warnings in the hook output.


## Workflow

### 1. Start work

```bash
tract branch TB-1234              # creates branch, writes branch: to ticket frontmatter
git checkout feature/TB-1234-*   # or: the skill does this
# ... do work ...
git push origin feature/TB-1234-fix-session-stability
```

### 2. Open review

```bash
tract review open TB-1234
```

This:
- Sets `status: in-review` on the ticket
- Adds the `review:` frontmatter block
- Opens a PR in Forgejo via API (so humans get the familiar diff UI + inline comments)
- Commits the ticket change

### 3. Agent reviews (automated or on-demand)

```bash
tract review agent TB-1234
```

Launches a fresh LLM context (not the working context) prompted to be adversarial.
The agent reads the diff, writes its findings to the `## Review` section, and appends
an approval entry to `review.approvals`. Commits under the service account key.

This can also be triggered automatically when a PR is opened in Forgejo via webhook.

### 4. Human reviews

Human reviews in Forgejo's UI as normal — inline comments, diff navigation.
When satisfied:

```bash
tract review approve TB-1234
```

Appends the human approval entry to the ticket, commits under their SSH key.

### 5. Merge

```bash
tract merge TB-1234
```

Or push to `main` directly — the pre-receive hook runs either way.

The hook:
1. Extracts the ticket ID from the branch name
2. Reads `review.policy` and `review.approvals` from the ticket frontmatter
3. Verifies policy is satisfied (correct number and type of approvals)
4. Verifies no approval was self-authored (same key as the committer being merged)
5. Allows or rejects the push

On successful merge:
- Ticket `status` → `done`
- `review.merged_at` → timestamp
- Forgejo PR is closed via API


## CLI Commands

```
tract branch <ticket>              Create branch, link to ticket
tract review open <ticket>         Move to in-review, open Forgejo PR
tract review agent <ticket>        Run adversarial agent review
tract review approve <ticket>      Record human approval
tract review status <ticket>       Show current approval state
tract merge <ticket>               Merge branch after policy check
```


## Forgejo Integration

Forgejo is the human-facing layer. Tract integrates with it minimally:

- `tract review open` → creates PR via Forgejo API
- `tract merge` → merges PR via Forgejo API (or closes it if merging directly)
- Forgejo webhook → triggers `tract review agent` on PR open (optional)
- Branch protection in Forgejo → set to require 1 approval (belt-and-braces alongside hook)

Forgejo inline comments are not mirrored into the tract ticket — they live in Forgejo.
Only the formal approval record and the `## Review` summary live in Tract.

Forgejo configuration required:
- Branch protection on `main`: require 1 approval, no force push
- Webhook: `POST /hooks/tract-review` on PR open
- OAuth app or API token for `tract review open` / `tract merge` calls


## Pre-receive Hook

Installed at `<repo>/.git/hooks/pre-receive` (or server-side in Forgejo's hook dir).

```bash
#!/usr/bin/env bash
# tract-review pre-receive hook
# Blocks merges to main that don't satisfy the ticket's review policy.

while read oldrev newrev refname; do
  [[ "$refname" != "refs/heads/main" ]] && continue

  # Extract ticket ID from branch being merged
  TICKET=$(git log "$oldrev..$newrev" --pretty="%s" | grep -oP '[A-Z]+-[0-9]+' | head -1)
  [[ -z "$TICKET" ]] && continue

  # Delegate to tract
  tract review check "$TICKET" "$newrev" || exit 1
done
exit 0
```

`tract review check` reads the ticket frontmatter from the ticket repo and validates
the policy. It exits 0 (allow) or 1 (block) with a human-readable message.


## What Tract Does NOT Own

- Diff rendering
- Inline comment threading
- Notification emails
- CI/CD pipeline triggers
- Merge commit strategy (squash/rebase/merge)

All of these are Forgejo's concern. Tract's boundary is: ticket state + approval record
+ merge gate. Everything else is infrastructure.


## Future: tract serve

When `tract serve` is mature enough to render diffs and capture inline comments,
Forgejo can be replaced as the human UI layer. The approval model, hook, and CLI
commands do not change — only the frontend changes. The ticket remains the source
of truth throughout.


---

## UI Layer Decision: Forgejo ✅

**Status:** Decided — 2026-03-02

The Forgejo model was agreed as the direction for this spec. The concern is whether
it's the right choice in practice.

**The problem it solves:** Humans reviewing code need a proper diff UI with inline
comments. Nobody is going to `git diff` a branch and write approval YAML by hand.
Something has to render the diff. Forgejo/Gitea is the most agent-friendly self-hosted
option that has a real REST API and doesn't lock you in.

**John's uncertainty:** "I'm not 100% sure about Forgejo. Humans will want the
Stash interface to review PRs. I can't think of an improvement unless there's some
VSCode plugin or Vim thing."

**Assessment:** No VSCode plugin or Vim equivalent matches a proper web diff UI for
code review. The VSCode GitHub Pull Requests extension is GitHub-specific. GitLens
similarly. vim-fugitive has no PR concept. The CLI (`gh pr`) is GitHub only.

Forgejo is probably the right call — the doubt is more about running another service
than whether it's the wrong tool. The spec's `## Future: tract serve` section is the
long-term answer: once `tract serve` can render diffs and capture inline comments,
Forgejo becomes optional. Until then, it fills the gap without creating lock-in.

**Decision:** Forgejo is the confirmed interim UI layer. Don't build a custom PR UI — Forgejo already exists, the integration is minimal (open PR, close PR, optional webhook), and attention stays on the main task. Revisit when `tract serve` is mature enough to replace it.
