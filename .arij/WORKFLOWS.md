# Arij Workflows — State Machines for Ticket Lifecycle

> Workflows are YAML files. The LLM is the enforcer. No runtime needed.

**Version:** 1.0.0
**Date:** 2026-02-10

This document is the complete reference for defining and enforcing ticket workflows in Arij. An LLM reading this document should be able to validate transitions, evaluate guards, and execute post-transition actions using only filesystem operations and git.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Storage & Assignment](#2-storage--assignment)
3. [Workflow Format](#3-workflow-format)
4. [Transitions](#4-transitions)
5. [Conditions (Guards)](#5-conditions-guards)
6. [Post-Transition Actions (Hooks)](#6-post-transition-actions-hooks)
7. [Wildcard Mode](#7-wildcard-mode)
8. [Sub-Statuses](#8-sub-statuses)
9. [Enforcement Algorithm](#9-enforcement-algorithm)
10. [Examples](#10-examples)

---

## 1. Overview

A workflow defines:

- **Statuses** — the allowed states a ticket can be in
- **Transitions** — which status can move to which other status
- **Guards** — conditions that must be true before a transition is allowed
- **Hooks** — actions that execute automatically after a transition completes

Workflows replace Jira's drag-and-drop workflow editor with a version-controlled YAML file that any LLM reads, understands, and enforces.

---

## 2. Storage & Assignment

### File Location

Workflow files live in `.arij/workflows/`:

```
.arij/
└── workflows/
    ├── engineering.yaml
    ├── bug-triage.yaml
    └── support-flow.yaml
```

### Assignment in Config

Workflows are assigned to ticket types in `.arij/config.yaml`:

```yaml
prefix: TB
types: [bug, story, task, epic]
statuses: [backlog, todo, in-progress, review, done]

workflows:
  default: engineering
  overrides:
    bug: bug-triage
    support-case: support-flow
```

**Resolution order:**

1. Check `workflows.overrides` for the ticket's `type`
2. If no match, use `workflows.default`
3. If no `workflows` section exists, no enforcement (equivalent to wildcard `*`)

### Multi-Project Config

```yaml
projects:
  TB:
    types: [bug, story, task, epic]
    statuses: [backlog, todo, in-progress, review, done]
    workflows:
      default: engineering
      overrides:
        bug: bug-triage
  SUP:
    types: [support-case, question, incident]
    statuses: [new, investigating, waiting-customer, waiting-internal, resolved, closed]
    workflows:
      default: support-flow
```

Each project can have its own workflow assignments. Workflow files are shared — `support-flow.yaml` can be referenced by any project.

---

## 3. Workflow Format

### Complete Example

```yaml
# .arij/workflows/engineering.yaml
name: Engineering Workflow
description: Standard workflow for stories, tasks, and epics

statuses:
  - backlog
  - todo
  - in-progress
  - review
  - done

transitions:
  backlog:
    - to: todo
    - to: done
      guards: [has-resolution]
  todo:
    - to: in-progress
      guards: [has-assignee]
    - to: backlog
  in-progress:
    - to: review
    - to: todo
    - to: backlog
  review:
    - to: done
      guards: [checklist-complete]
      hooks: [set-resolution-fixed, notify-reporter]
    - to: in-progress
  done:
    - to: backlog
      hooks: [clear-resolution]

guards:
  has-assignee:
    type: field_required
    field: assignee

  has-resolution:
    type: field_required
    field: resolution

  checklist-complete:
    type: checklist
    section: "Acceptance Criteria"

hooks:
  set-resolution-fixed:
    type: set_field
    field: resolution
    value: fixed

  clear-resolution:
    type: set_field
    field: resolution
    value: null

  notify-reporter:
    type: notify
    targets: [reporter, watchers]
    message: "{ticket} moved to {status} by {user}"
```

### Structure

| Top-Level Key | Type | Required | Description |
|---------------|------|----------|-------------|
| `name` | string | yes | Human-readable name |
| `description` | string | no | What this workflow is for |
| `statuses` | list[string] | yes | Ordered list of valid statuses |
| `transitions` | map | yes | Transition map (see §4) |
| `guards` | map | no | Named guard definitions (see §5) |
| `hooks` | map | no | Named hook definitions (see §6) |

---

## 4. Transitions

The `transitions` map defines allowed movements between statuses.

### Format

```yaml
transitions:
  {from_status}:
    - to: {target_status}
      guards: [{guard_name}, ...]    # optional
      hooks: [{hook_name}, ...]      # optional
```

Each key under `transitions` is a source status. Its value is a list of allowed target statuses, each optionally with guards and hooks.

### Rules

- If a `from → to` pair is not listed, the transition is **denied**
- Guards and hooks are referenced by name — defined in the `guards` and `hooks` sections
- A transition can have multiple guards (all must pass) and multiple hooks (all execute in order)
- The `statuses` list defines valid statuses. A transition referencing an unlisted status is invalid

### Implicit Rules

- **No self-transitions** — moving from a status to itself is a no-op and always allowed (no guards evaluated)
- **Terminal statuses** — a status with no outgoing transitions is terminal. Tickets can reach it but not leave. To reopen, add an explicit transition back

---

## 5. Conditions (Guards)

Guards are conditions evaluated before a transition is permitted. All guards on a transition must pass.

### 5.1 `field_required`

A field must be set (not null, not missing).

```yaml
has-assignee:
  type: field_required
  field: assignee

has-estimate:
  type: field_required
  field: estimate

has-priority:
  type: field_required
  field: priority
```

### 5.2 `field_value`

A field must have a specific value (or one of several values).

```yaml
is-critical:
  type: field_value
  field: priority
  values: [critical, high]

has-fix-version:
  type: field_value
  field: fix_version
  not_null: true
```

### 5.3 `checklist`

All checklist items in a named markdown section must be checked.

```yaml
checklist-complete:
  type: checklist
  section: "Acceptance Criteria"
```

**Evaluation:** Parse the ticket body, find the `## {section}` heading, check that every `- [ ]` is `- [x]`. If no checklist exists in that section, the guard passes (nothing to check).

### 5.4 `links`

Requirements on ticket links.

```yaml
no-blockers:
  type: links
  rel: blocked_by
  require: resolved
```

**`require: resolved`** means all tickets referenced by `blocked_by` links must have a terminal status (`done`, `closed`, `resolved`). If any blocker is still open, the guard fails.

```yaml
has-parent:
  type: links
  rel: child
  min: 1
```

**`min: 1`** means at least one link of this relationship type must exist.

### 5.5 `role`

Only users with a specific role can perform this transition.

```yaml
release-manager-only:
  type: role
  roles: [release-manager, admin]
```

**Role resolution:** Roles are defined in `.arij/config.yaml`:

```yaml
roles:
  release-manager: [john, sarah]
  admin: [john]
  qa-lead: [mike]
```

The LLM checks if the user performing the transition is in one of the listed roles.

### 5.6 `time_in_status`

The ticket must have been in its current status for a minimum duration. Used for compliance workflows.

```yaml
review-minimum:
  type: time_in_status
  min: 1h
```

**Evaluation:** Check git history for when the status was last changed to the current value:

```bash
git log --follow -p -- tickets/TB-042.md | grep "status:"
```

Compare the timestamp of the commit that set the current status against now. If the difference is less than `min`, the guard fails.

---

## 6. Post-Transition Actions (Hooks)

Hooks execute after a transition completes successfully. They are instructions for the LLM to carry out.

### 6.1 `set_field`

Set a frontmatter field to a value.

```yaml
set-resolution-fixed:
  type: set_field
  field: resolution
  value: fixed

clear-sprint:
  type: set_field
  field: sprint
  value: null

auto-assign:
  type: set_field
  field: assignee
  value: "{user}"           # {user} = the person making the transition
```

**Template variables:**

| Variable | Resolves To |
|----------|-------------|
| `{user}` | Username of the person performing the transition |
| `{ticket}` | Ticket ID (e.g. `TB-042`) |
| `{status}` | New status after transition |
| `{previous_status}` | Status before transition |
| `{date}` | Today's date (`YYYY-MM-DD`) |
| `{timestamp}` | Current datetime (`YYYY-MM-DD HH:MM`) |

### 6.2 `notify`

Notify users about the transition. The LLM formats and delivers the notification through whatever channel is available.

```yaml
notify-reporter:
  type: notify
  targets: [reporter, watchers]
  message: "{ticket} moved to {status} by {user}"

notify-team:
  type: notify
  targets: [role:release-manager]
  message: "{ticket} is ready for deployment"
```

**Target types:**

| Target | Resolves To |
|--------|-------------|
| `reporter` | The ticket's `reporter` field |
| `assignee` | The ticket's `assignee` field |
| `watchers` | All users in the ticket's `watchers` list |
| `role:{name}` | All users in the named role (from config) |
| `{username}` | A specific user |

### 6.3 `comment`

Add a comment to the ticket.

```yaml
auto-comment-done:
  type: comment
  message: "Moved to done by {user} on {date}."

auto-comment-reopen:
  type: comment
  message: "Reopened by {user}. Previous status: {previous_status}."
```

The LLM appends the comment following the format in SCHEMA.md §15.

### 6.4 `create_ticket`

Create a new ticket automatically.

```yaml
create-verification:
  type: create_ticket
  template:
    type: task
    title: "Verify deployment: {ticket}"
    status: todo
    labels: [verification]
    links:
      - rel: related_to
        ref: "{ticket}"
```

The LLM creates the ticket following SCHEMA.md §2 and §4 (ID generation).

### 6.5 `update_links`

Update linked tickets when a transition occurs.

```yaml
unblock-dependents:
  type: update_links
  when_rel: blocks
  action: notify
  message: "Blocker {ticket} has been resolved. {ref} may now proceed."
```

**Evaluation:** Find all tickets that this ticket `blocks` (or that reference this ticket as `blocked_by`). For each, deliver the notification or perform the specified action.

---

## 7. Wildcard Mode

For teams that don't want workflow restrictions:

```yaml
# .arij/workflows/open.yaml
name: Open Workflow
description: No restrictions — any status to any status

statuses: ['*']
transitions: '*'
```

Or simply omit the `workflows` section from config entirely. No workflow = no enforcement.

When `transitions: '*'`:
- Any status can transition to any other status
- No guards are evaluated
- Hooks can still be defined on a per-status basis if desired:

```yaml
name: Open with Hooks
statuses: ['*']
transitions: '*'

on_enter:
  done:
    hooks: [set-resolution-fixed, notify-reporter]
```

The `on_enter` section is an alternative hook mechanism for wildcard workflows — hooks fire when entering a status regardless of the source status.

---

## 8. Sub-Statuses

Optional granularity within a main status. Sub-statuses don't affect workflow transitions — they're labels for reporting and visibility.

### Definition

```yaml
# In the workflow file
sub_statuses:
  in-progress:
    - coding
    - writing-tests
    - debugging
    - waiting-for-dependency
  review:
    - code-review
    - qa-testing
    - security-review
```

### Ticket Usage

```yaml
---
id: TB-042
status: in-progress
sub_status: writing-tests
---
```

### Rules

- `sub_status` is a freeform frontmatter field — it's not enforced unless `sub_statuses` is defined in the workflow
- If `sub_statuses` is defined, the LLM should validate that the `sub_status` value is in the allowed list for the current `status`
- Changing `sub_status` does **not** trigger workflow transitions, guards, or hooks
- Sub-statuses are useful for board swimlanes and filtering:

```yaml
# Board column with sub-status breakdown
columns:
  - name: In Progress — Coding
    filter: { status: in-progress, sub_status: coding }
  - name: In Progress — Testing
    filter: { status: in-progress, sub_status: writing-tests }
```

---

## 9. Enforcement Algorithm

When processing a status change on a ticket, the LLM follows this procedure:

### Step 1: Resolve Workflow

```
ticket_type = ticket.frontmatter.type
workflow_name = config.workflows.overrides[ticket_type]
                ?? config.workflows.default
                ?? null

if workflow_name is null:
    # No enforcement — allow the transition
    make the change, done

workflow = read(".arij/workflows/{workflow_name}.yaml")
```

### Step 2: Check Transition is Allowed

```
current = ticket.frontmatter.status
target = requested status

if workflow.transitions == '*':
    # Wildcard — skip to step 4

if target not in workflow.transitions[current]:
    DENY: "{current} → {target} is not an allowed transition.
           Allowed from {current}: {list of allowed targets}"
```

### Step 3: Evaluate Guards

```
transition = find transition entry where to == target in workflow.transitions[current]

for guard_name in transition.guards:
    guard = workflow.guards[guard_name]
    result = evaluate(guard, ticket)
    if result.failed:
        DENY: "Transition blocked by '{guard_name}': {result.reason}
               To proceed: {result.fix_hint}"
```

**Fix hints** help the user understand what to do:

| Guard Type | Example Fix Hint |
|------------|-----------------|
| `field_required` | *"Set the `assignee` field before moving to in-progress"* |
| `checklist` | *"2 of 4 acceptance criteria are unchecked"* |
| `links` | *"TB-055 (blocked_by) is still in-progress — resolve it first"* |
| `role` | *"Only release-managers can move tickets to deployed"* |
| `time_in_status` | *"Ticket has been in review for 35m — minimum is 1h"* |

### Step 4: Apply Transition

```
ticket.frontmatter.status = target
if workflow.sub_statuses and ticket.sub_status not valid for target:
    ticket.frontmatter.sub_status = null    # Clear invalid sub-status
write ticket file
```

### Step 5: Execute Hooks

```
for hook_name in transition.hooks:
    hook = workflow.hooks[hook_name]
    execute(hook, ticket, context)

# Also check on_enter hooks (for wildcard workflows)
if workflow.on_enter[target]:
    for hook_name in workflow.on_enter[target].hooks:
        execute(hook, ticket, context)
```

### Step 6: Commit

All changes (status update, field sets, new tickets, comments) are committed together:

```
TB-042: transition in-progress → done
```

---

## 10. Examples

### Bug Triage Workflow

```yaml
# .arij/workflows/bug-triage.yaml
name: Bug Triage
description: Workflow for bugs — includes triage and verification steps

statuses:
  - new
  - triaged
  - in-progress
  - in-review
  - verification
  - done
  - wontfix

transitions:
  new:
    - to: triaged
      guards: [has-priority, has-severity]
    - to: wontfix
      guards: [has-resolution]
      hooks: [auto-comment-closed]
  triaged:
    - to: in-progress
      guards: [has-assignee]
    - to: wontfix
      hooks: [auto-comment-closed]
  in-progress:
    - to: in-review
    - to: triaged
  in-review:
    - to: verification
      guards: [checklist-complete]
      hooks: [notify-reporter]
    - to: in-progress
  verification:
    - to: done
      hooks: [set-resolution-fixed, notify-reporter, unblock-dependents]
    - to: in-progress
      hooks: [auto-comment-reopen]
  done:
    - to: triaged
      hooks: [clear-resolution, auto-comment-reopen]
  wontfix:
    - to: triaged
      hooks: [clear-resolution, auto-comment-reopen]

guards:
  has-priority:
    type: field_required
    field: priority
  has-severity:
    type: field_required
    field: severity
  has-assignee:
    type: field_required
    field: assignee
  has-resolution:
    type: field_required
    field: resolution
  checklist-complete:
    type: checklist
    section: "Acceptance Criteria"

hooks:
  set-resolution-fixed:
    type: set_field
    field: resolution
    value: fixed
  clear-resolution:
    type: set_field
    field: resolution
    value: null
  notify-reporter:
    type: notify
    targets: [reporter, watchers]
    message: "{ticket} moved to {status} by {user}"
  unblock-dependents:
    type: update_links
    when_rel: blocks
    action: notify
    message: "Blocker {ticket} resolved — {ref} is unblocked"
  auto-comment-closed:
    type: comment
    message: "Closed as {resolution} by {user}."
  auto-comment-reopen:
    type: comment
    message: "Reopened by {user}. Previous status: {previous_status}."
```

### Support Flow

```yaml
# .arij/workflows/support-flow.yaml
name: Support Flow
description: Workflow for support cases and incidents

statuses:
  - new
  - investigating
  - waiting-customer
  - waiting-internal
  - resolved
  - closed

transitions:
  new:
    - to: investigating
      hooks: [auto-assign-support]
  investigating:
    - to: waiting-customer
      hooks: [notify-customer-contact]
    - to: waiting-internal
      hooks: [create-engineering-ticket]
    - to: resolved
      guards: [has-resolution]
      hooks: [notify-customer-contact]
  waiting-customer:
    - to: investigating
    - to: resolved
      guards: [has-resolution]
    - to: closed
      hooks: [auto-comment-closed]
  waiting-internal:
    - to: investigating
      guards: [no-blockers]
  resolved:
    - to: closed
    - to: investigating
      hooks: [auto-comment-reopen]
  closed:
    - to: investigating
      hooks: [auto-comment-reopen]

guards:
  has-resolution:
    type: field_required
    field: resolution
  no-blockers:
    type: links
    rel: blocked_by
    require: resolved

hooks:
  auto-assign-support:
    type: set_field
    field: assignee
    value: "{user}"
  notify-customer-contact:
    type: notify
    targets: [customer]
    message: "{ticket}: Status updated to {status}"
  create-engineering-ticket:
    type: create_ticket
    template:
      type: bug
      title: "Engineering escalation: {ticket}"
      status: backlog
      links:
        - rel: blocks
          ref: "{ticket}"
  auto-comment-closed:
    type: comment
    message: "Closed — no response from customer. Reopened automatically if they reply."
  auto-comment-reopen:
    type: comment
    message: "Reopened by {user}."
```

---

## Appendix: Quick Reference

### File Locations

| What | Where |
|------|-------|
| Workflow definitions | `.arij/workflows/{name}.yaml` |
| Workflow assignment | `.arij/config.yaml` → `workflows:` section |
| Role definitions | `.arij/config.yaml` → `roles:` section |

### Guard Types

| Type | Description |
|------|-------------|
| `field_required` | Field must be set |
| `field_value` | Field must match specific value(s) |
| `checklist` | All items in a markdown section must be checked |
| `links` | Link relationship requirements |
| `role` | User must have a specific role |
| `time_in_status` | Minimum time in current status |

### Hook Types

| Type | Description |
|------|-------------|
| `set_field` | Set or clear a frontmatter field |
| `notify` | Send notification to users/roles |
| `comment` | Add a comment to the ticket |
| `create_ticket` | Create a new ticket from a template |
| `update_links` | Notify or update linked tickets |

### Template Variables

| Variable | Resolves To |
|----------|-------------|
| `{user}` | Person performing the transition |
| `{ticket}` | Ticket ID |
| `{status}` | New status |
| `{previous_status}` | Previous status |
| `{date}` | Today (`YYYY-MM-DD`) |
| `{timestamp}` | Now (`YYYY-MM-DD HH:MM`) |
| `{resolution}` | Ticket's resolution field |
| `{ref}` | Referenced ticket ID (in link hooks) |
