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

```markdown
## Review

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
