---
name: tract-dashboard
description: Create web dashboards for Tract projects. Generates self-contained HTML files that read from the local JSON API. Use when user asks for a dashboard, chart, visualization, burndown, velocity, or web board.
metadata:
  author: tract
  version: "1.0"
---

# Dashboard Creation

Create self-contained HTML dashboards powered by Tract's local API (`tract serve`).

## When to Use This Skill

Activate when the user:
- Asks for a dashboard, chart, visualization, or web board
- Says "show me sprint progress", "team velocity", "burndown chart"
- Asks "who has the most tickets?" / "what's blocked?" / "show me an overview"
- Wants to see anything graphical about their tickets

## Step 1: Decide Where to Save

Custom dashboards always go in `~/.tract/dashboards/<name>.html`. This directory is local to the machine — never in git, never shared automatically.

To share a view with someone, share a **URL with parameters** instead of a file:
```
http://server:7766/dashboards/kanban.html?assignee=alice.chen&title=Alice's+Board
```

## Step 2: Generate the HTML File

Create a **single self-contained HTML file**. Requirements:

1. **Fetch data from the local API** — `fetch('/api/tickets')` etc. (no hardcoded data)
2. **CDN-only libraries** — no build step, no local npm
   - Charts: `https://cdn.jsdelivr.net/npm/chart.js`
   - Reactivity (optional): `https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js`
3. **Live reload via SSE** — include this snippet so the dashboard auto-refreshes:
   ```js
   const es = new EventSource('/api/events');
   es.onmessage = () => loadTickets(); // re-fetch and re-render
   ```
4. Keep it **readable and clean** — another engineer should be able to understand it

## Step 3: After Saving

Tell the user:
```
Saved to: ~/.tract/dashboards/<name>.html

Run:  tract serve
Open: http://localhost:7766/dashboards/<name>.html
```

## API Reference

See [references/api.md](references/api.md) for the complete API reference and ticket schema.

See [references/starter.html](references/starter.html) for a minimal working dashboard to use as a starting point.

## Dashboard Ideas

| Dashboard | Description |
|-----------|-------------|
| `sprint-board.html` | Kanban columns (to-do / in-progress / done) for current sprint |
| `burndown.html` | Story-points burned per day — Chart.js line chart |
| `velocity.html` | Tickets completed per sprint — bar chart |
| `blocked.html` | All blocked tickets with their blocker details |
| `team-load.html` | Tickets per assignee — horizontal bar chart |
| `backlog.html` | Unsorted backlog grouped by priority |
| `epic-progress.html` | Progress per epic — progress bars |

## Design Philosophy

- **No build step** — LLMs generate dashboards instantly; developers should be able to read them
- **Self-contained** — one HTML file, CDN links, no local dependencies
- **Live** — SSE keeps the page current without a page reload
- **Portable** — `tract serve` serves them; anyone on the team can use shared ones
