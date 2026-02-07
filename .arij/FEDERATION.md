# Arij Federation & Scale

> How Arij works across teams, repos, and organisational boundaries.

**Version:** 1.0.0
**Date:** 2026-02-10

---

## Table of Contents

1. [Dual-Mode Ticket Repos](#1-dual-mode-ticket-repos)
2. [Two LLM Roles](#2-two-llm-roles)
3. [Fix Version Derivation](#3-fix-version-derivation)
4. [Workspace Discovery](#4-workspace-discovery)
5. [Sync & Replication](#5-sync--replication)
6. [Organisational Boundaries](#6-organisational-boundaries)

---

## 1. Dual-Mode Ticket Repos

Ticket repos are designed to work in two modes with **zero changes** to the repo itself.

### Standalone Mode (Arij Server)

The Arij server clones ticket repos as standalone repositories:

```
arij-server/
├── tickets-tb/          # cloned standalone
├── tickets-app/         # cloned standalone
└── arij-web/            # the web server
```

### Submodule Mode (Developer Workstation)

A developer mounts the ticket repo as a git submodule inside their code repo:

```
trading-platform/        # code repo
├── src/
├── tickets/             # git submodule → tickets-tb repo
└── ...
```

### Self-Contained Ticket Repos

The ticket repo **must** be self-contained — it carries its own `.arij/` config and all project metadata:

```
tickets-tb/
├── .arij/
│   ├── config.yaml
│   ├── workflows/
│   ├── sprints/
│   ├── time/
│   └── boards/
├── TB-001.md
├── TB-002.md
└── ...
```

This is what makes dual-mode possible. The repo works identically whether cloned standalone or mounted as a submodule.

When used as a submodule, the parent code repo can optionally have its own `.arij/config.yaml` that points at the submodule path:

```yaml
# parent repo .arij/config.yaml (optional)
ticket_submodule: tickets/
```

When standalone, it just works — no parent config needed.

---

## 2. Two LLM Roles

The same Arij schema supports two fundamentally different operating profiles.

### Server LLM

Manages standalone clones, serves many users:

- `git pull` periodically to sync all repos
- Never commits directly — commits on behalf of authenticated users
- Cross-project queries across ALL repos
- Generates reports, boards, serves web UI
- Handles multi-user merge conflicts
- Uses a service account git identity
- Thinks: **"all repos, all projects, all users"**

### Developer LLM

Manages submodules in code repos, serves one person:

- `git submodule update` to sync tickets
- Commits directly with the developer's git identity
- Can see code branches — validates fix versions against actual branches
- Local workspace queries only
- Single-user, rare conflicts
- Thinks: **"my repos, my tickets, my branches"**

### Comparison

| Aspect | Server LLM | Developer LLM |
|--------|-----------|---------------|
| **Repo mode** | Standalone clones | Submodules in code repos |
| **Users** | Many (multi-tenant) | One (single developer) |
| **Git identity** | Service account | Developer's own |
| **Commits** | On behalf of authenticated users | Direct |
| **Sync** | `git pull` on schedule | `git submodule update` |
| **Scope** | All repos, all projects | Local workspace only |
| **Code visibility** | Ticket repos only | Code + tickets |
| **Branch validation** | No (no code repo) | Yes — fix versions vs branches |
| **Conflict handling** | Multi-user merge resolution | Rare, trivial |
| **Interface** | REST API, web UI | CLI, editor, local LLM |
| **Superpower** | Cross-project reporting | Fix version derivation from branches |

---

## 3. Fix Version Derivation

When tickets are submodules inside code repos, fix versions become **verifiable** — not just metadata you maintain, but claims that can be checked against reality.

### How It Works

1. Developer LLM checks `git branch` on the code repo → sees `release/6.8.0`
2. Reads tickets with `fix_version: "6.8.0"`
3. For each ticket, checks if the fix branch (e.g., `fix/TB-042-nagle`) is merged into the release branch
4. Warns on mismatch

### Example Warning

```
⚠ TB-042 tagged for 6.8.0 but fix/TB-042-nagle not merged into release/6.8.0
```

### The Insight

- **Tickets** say what **should** be in a release
- **Branches** say what **is** in a release
- **Mismatch** = LLM warning

Fix versions stop being metadata you maintain and hope is accurate. They become assertions that can be verified against the actual code. The developer LLM can do this automatically because it has visibility into both the ticket repo (submodule) and the code repo (parent).

### Limitations

- Only works in submodule mode (developer LLM has code visibility)
- Server LLM can't do this — it only sees ticket repos, not code repos
- Requires a branch naming convention (e.g., `fix/TB-042-*`, `feature/TB-043-*`)
- Release branches must follow a predictable pattern (e.g., `release/{version}`)

---

## 4. Workspace Discovery

### Developer Workstation

`~/.config/arij/workspace.yaml` lists local paths — manually maintained, small:

```yaml
repos:
  - path: ~/work/trading-platform
    prefix: TB
  - path: ~/work/client-apps
    prefix: APP
```

### Arij Server

Server config lists all ticket repo URLs to clone and sync:

```yaml
repos:
  - url: git@github.com:acme/tickets-tb.git
    prefix: TB
  - url: git@github.com:acme/tickets-app.git
    prefix: APP
  - url: git@github.com:acme/tickets-sup.git
    prefix: SUP
```

### Discovery Convention

Any repo with `.arij/config.yaml` at its root is an Arij project. No registration needed beyond cloning it.

### Cross-Repo Links

- Links work when both repos are in the workspace (server or developer)
- Links to repos **outside** your workspace are opaque references — known to exist, can't resolve
- That's the organisational boundary, not a bug

---

## 5. Sync & Replication

**Git IS the sync mechanism.** There is no custom replication protocol.

| Role | Sync Method |
|------|------------|
| Server | Periodic `git fetch/pull` on all repos |
| Developer | `git submodule update` or `git pull` in standalone ticket repos |

### Conflict Resolution

Conflicts are resolved by git merge — explicit, visible, auditable. No silent overwrites, no last-write-wins. If two people edit the same ticket, git shows you exactly what happened and makes you resolve it.

This is a feature. Every other project management tool hides conflict resolution behind opaque sync logic. Git makes it a first-class operation with full history.

---

## 6. Organisational Boundaries

### The Reality

Some divisions can't even see each other's repos. Different teams have different access levels. Some projects are shared, others are private.

### How Arij Handles This

- Each division/team can have their own Arij server with their own repos
- Cross-division links are **opaque references** — the link exists in the ticket (`ref: FINANCE-042`) but if your workspace doesn't include the FINANCE repo, you can't resolve it. You know it exists. You can't see it.
- Shared projects (HR/admin tickets like TINT, company-wide agile like APP) live in repos everyone can access
- Git access control (SSH keys, deploy keys, org permissions) is the security model — Arij adds nothing on top

### Multiple Arij Servers

Nothing prevents multiple Arij servers in an organisation:

```
Division A Arij Server → [tickets-trading, tickets-risk, tickets-shared]
Division B Arij Server → [tickets-settlement, tickets-ops, tickets-shared]
```

Both see `tickets-shared`. Neither sees the other's private repos. Cross-division links to private repos are opaque. This is exactly how it should work.
