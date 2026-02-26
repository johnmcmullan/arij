# Tract Dashboard API Reference

All endpoints are served by `tract serve` at `http://localhost:7766` (default port).

---

## `GET /api/tickets`

Returns all tickets as a JSON array.

**Query parameters:**

| Param | Description | Example |
|-------|-------------|---------|
| `project` | Filter by project prefix | `?project=APP` |
| `sprint` | Filter by sprint ID | `?sprint=2026-W07` |
| `status` | Comma-separated statuses | `?status=in-progress,todo` |
| `assignee` | Filter by assignee (exact, lowercase) | `?assignee=alice` |

**Ticket object schema:**

```json
{
  "id": "APP-1042",
  "title": "Fix login timeout bug",
  "status": "in-progress",
  "assignee": "alice",
  "priority": "major",
  "labels": ["auth", "bug"],
  "sprints": ["2026-W06", "2026-W07"],
  "sprint": "2026-W07",
  "blocked_by": "APP-1038",
  "blocks": null,
  "created": "2026-01-15",
  "updated": "2026-02-10",
  "type": "bug",
  "estimate": "4h",
  "due": "2026-02-21",
  "epic": "AUTH-EPIC",
  "component": "authentication",
  "project": "APP",
  "logged": "2h",
  "remaining": "2h",
  "loggedSeconds": 7200,
  "estimateSeconds": 14400
}
```

**Field notes:**
- `status`: common values: `todo`, `in-progress`, `in-review`, `done`, `closed`, `blocked`
- `sprint`: the most recent sprint ID (last element of `sprints` array)
- `sprints`: full history of sprint IDs for this ticket (for carryover tracking)
- `logged` / `remaining`: human-readable strings like `"2h"`, `"1d 3h"`, `"0h"`
- `loggedSeconds` / `estimateSeconds`: raw seconds for calculations
- `blocked_by` / `blocks`: ticket ID strings, or null

---

## `GET /api/ticket/:id`

Returns a single ticket with its full markdown body (the text below the frontmatter).

```json
{
  "id": "APP-1042",
  "title": "Fix login timeout bug",
  "status": "in-progress",
  "body": "## Description\n\nUsers get logged out after 5 minutes...",
  ...all other ticket fields...
}
```

`body` is the raw markdown string. Render it with marked.js:
```js
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@9/+esm';
const { body } = await fetch('/api/ticket/APP-1042').then(r => r.json());
el.innerHTML = marked.parse(body, { breaks: true, gfm: true });
```

---

## `GET /api/sprints`

Returns all sprint YAML files from `.tract/sprints/` as JSON.

**Sprint object schema:**

```json
{
  "id": "2026-W07",
  "name": "Sprint 7",
  "state": "open",
  "start": "2026-02-10",
  "end": "2026-02-21",
  "goal": "Ship FIX session stability fixes"
}
```

- `state`: `"open"` or `"closed"`

---

## `GET /api/projects`

Returns all projects in the workspace.

```json
[
  {
    "prefix": "APP",
    "name": "app-backend",
    "ticketsDir": "/home/alice/work/app/tickets",
    "ticketCount": 142
  }
]
```

---

## `GET /api/meta`

Returns server metadata.

```json
{
  "workspace": "my-company",
  "port": 7766,
  "projects": [
    { "prefix": "APP", "name": "app-backend" },
    { "prefix": "FE", "name": "frontend" }
  ]
}
```

---

## `GET /api/events`

Server-Sent Events (SSE) stream. Receives a message whenever any ticket file changes on disk.

**Message format:**
```
data: {"type":"reload","ts":1708450000000}
```

**Usage pattern (copy into dashboard HTML):**

```js
const es = new EventSource('/api/events');
es.onmessage = () => loadTickets(); // re-fetch /api/tickets and re-render
es.onerror = () => { /* silently ignore reconnection */ };
```

The browser automatically reconnects if the connection drops.

---

## Dashboard File Locations

```
Built-in templates (always available, served from CLI install):
  kanban.html, scrum.html, control-chart.html

Custom dashboards (local only, never in git):
  ~/.tract/dashboards/<name>.html
```

All served at `http://localhost:7766/dashboards/<name>.html`.

A custom file with the same name as a built-in overrides it.

### Named views with index.yaml

Place an `index.yaml` in `<workspaceRoot>/dashboards/` to give the landing page
a curated named menu. The HTML files it references are the built-ins — no copying needed.

```yaml
dashboards:
  - name: "Team Kanban"
    file: kanban.html
    description: "All active work"
  - name: "Alice's Board"
    file: kanban.html
    params:
      assignee: alice.chen
      title: "Alice's Board"
```

### Sharing views

Don't share HTML files — share **URLs with parameters**:
```
http://server:7766/dashboards/kanban.html?assignee=alice.chen&title=Alice's+Board
```

---

## Common Patterns

### Group tickets by status
```js
const byStatus = tickets.reduce((acc, t) => {
  (acc[t.status] ??= []).push(t);
  return acc;
}, {});
```

### Find the open sprint
```js
const sprints = await fetch('/api/sprints').then(r => r.json());
const openSprint = sprints.find(s => s.state === 'open');
```

### Filter current sprint tickets
```js
const tickets = await fetch(`/api/tickets?sprint=${openSprint.id}`).then(r => r.json());
```

### Count by assignee
```js
const byAssignee = tickets.reduce((acc, t) => {
  const key = t.assignee || 'unassigned';
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});
```

### Calculate completion rate
```js
const done = tickets.filter(t => ['done', 'closed'].includes(t.status)).length;
const pct = Math.round((done / tickets.length) * 100);
```
