# TUI Architecture - View-Only Dashboard

**Philosophy:** Beautiful ambient awareness, not interactive features.

## Core Principles

### 1. View-Only (No Interaction)
**TUI is a dashboard, not an interface.**

**What it does:**
- Shows current state
- Updates in real-time
- Looks beautiful
- Provides ambient awareness

**What it does NOT do:**
- Edit tickets
- Change status
- Create issues
- Filter interactively
- Replace LLM queries

**Interaction happens via:**
- LLM queries ("Show me blocked tickets")
- CLI commands (`tract create`, `tract edit`)
- Direct markdown editing
- Git operations

### 2. Real-Time Updates
**Watch filesystem, refresh immediately when data changes.**

```javascript
const chokidar = require('chokidar');

// Watch issues directory
const watcher = chokidar.watch('issues/*.md', {
  persistent: true,
  ignoreInitial: false
});

watcher.on('change', (path) => {
  // Reload ticket data
  // Re-render board
  screen.render();
});
```

**Result:** Edit a ticket in vim, see board update instantly.

### 3. Configured Filters (Not Interactive JQL)
**Set up board with configuration, not runtime queries.**

```bash
# Configure once
tract board --label sprint-7 --save sprint7-board

# Run anytime
tract board sprint7-board

# Or quick filter
tract board --label tbricks
tract board --assignee john
tract board --sprint 2026-W07
```

**Configuration saved:**
```yaml
# .tract/boards/sprint7-board.yaml
name: Sprint 7 Board
filters:
  labels: [sprint-7]
  status: [todo, in-progress, review]
view: kanban
refresh: auto
```

**NOT interactive:** No runtime JQL builder, no complex filter UI.

### 4. Purpose: Ambient Awareness + Demos
**Not your primary interface. Supplementary.**

**Use cases:**
- Dashboard on second monitor during sprint
- Demo to stakeholders (flashy, impressive)
- Team stand-up display
- Visual context while working
- "Something nice to look at"

**Like the Morgan Stanley trade monitor:**
- Glance for patterns
- Spot anomalies (blocks of purple)
- Don't interact with it
- Real work happens elsewhere

### 5. Responsive Design (Key Differentiator)
**Adapts to terminal geometry. This is what makes it special.**

Not just "wraps at 80 columns" - **intelligently changes what it shows.**

#### 80 columns (minimal)
```
Todo: 12   Progress: 5   Done: 23
APP-123  High   @john
APP-124  High   @john
APP-125  Med    @sarah
```

#### 120 columns (standard)
```
┌─ Todo (12) ────────┬─ In Progress (5) ──┬─ Done (23) ────────┐
│ APP-123            │ APP-125            │ APP-120            │
│ Fix login          │ New API            │ Setup CI           │
│ @john  High        │ @sarah  Med        │ @mike  Med         │
└────────────────────┴────────────────────┴────────────────────┘
```

#### 160 columns (wide)
```
┌─ Todo (12) ──────────────────┬─ In Progress (5) ────────┬─ Done (23) ──────────────┐
│ APP-123  Fix login bug       │ APP-125  New REST API    │ APP-120  Setup CI/CD     │
│ @john  🔴 High               │ @sarah  Medium           │ @mike  Medium            │
│ #fix-protocol #auth          │ #api #tbricks            │ #devops                  │
│ Blocks: APP-124              │ Progress: 60%            │ Deployed: staging        │
└──────────────────────────────┴──────────────────────────┴──────────────────────────┘
```

#### 200+ columns (ultra-wide)
```
┌─ Todo (12) ────────────────────────────┬─ In Progress (5) ──────────────┬─ Done (23) ────────────────┐  ┌─ Sprint Stats ─────┐
│ APP-123  Fix login bug after OAuth     │ APP-125  New REST API          │ APP-120  Setup CI/CD       │  │ Velocity: 8.2/day  │
│ @john  🔴 High  #fix-protocol #auth    │ @sarah  Medium  #api #tbricks  │ @mike  Medium  #devops     │  │ Complete: 45%      │
│ Blocks: APP-124  Created: 2d ago       │ Progress: 60%  Updated: 30m    │ Deployed: staging  Done 2d │  │ Days left: 6       │
│ Story points: 5  Sprint: 2026-W07      │ Story points: 8  Sprint: W07   │ Story points: 3            │  │ At risk: 2 tickets │
└────────────────────────────────────────┴────────────────────────────────┴────────────────────────────┘  └────────────────────┘
```

**Auto-detection:**
```javascript
function getDetailLevel(terminalWidth) {
  if (terminalWidth >= 200) return 'ultra';
  if (terminalWidth >= 160) return 'wide';
  if (terminalWidth >= 120) return 'standard';
  return 'minimal';
}
```

### 6. btop-Level Beauty
**This is what makes people say "Whoa."**

**Not acceptable:**
```
TODO          IN PROGRESS     DONE
----          -----------     ----
APP-123       APP-125         APP-120
```

**Required:**
```
┌─ Tract Board ─ Sprint 2026-W07 ────────────────────── 20:10 GMT ─┐
│                                                                    │
│  ┏━ Todo (12) ━━━━━━━━━┓  ┏━ In Progress (5) ━┓  ┏━ Done (23) ━┓ │
│  ┃ APP-123             ┃  ┃ APP-125            ┃  ┃ APP-120      ┃ │
│  ┃ Fix login bug       ┃  ┃ New REST API       ┃  ┃ Setup CI/CD  ┃ │
│  ┃ @john  🔴 High      ┃  ┃ @sarah  Medium     ┃  ┃ @mike  Med   ┃ │
│  ┗━━━━━━━━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━┛ │
│                                                                    │
│  ████████░░ 45% Sprint Complete  │  Velocity: 8.2 pts/day        │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Aesthetic requirements:**
- Box drawing characters (━ ┃ ┏ ┓ ┗ ┛)
- Color coding (priority, status, age)
- Progress bars (sprint, velocity)
- Emoji for visual scanning (🔴 High, 🟡 Medium, 🟢 Low)
- Clean spacing (not cramped)
- Subtle animations (smooth updates)

### 7. LLM Remains Primary
**TUI does NOT replace LLM queries.**

**Example workflow:**

```bash
# Complex query → Ask LLM
User: "Show me high-priority tickets blocking other work that haven't been updated in 3 days"

LLM: grep 'priority: high' issues/*.md | 
     grep 'blocks:' | 
     check updated date | 
     format results

# Visual context → Use TUI
tract board --label sprint-7
# Glance at board
# See pattern (lots of red in Todo column)
# Back to LLM for details

# Simple status → TUI is fine
tract board
# "Oh, 5 things in progress, 23 done, looks good"

# Make changes → CLI or markdown
tract create "New ticket" --assignee john
vim issues/APP-123.md
# Board updates automatically
```

**The division:**
- **TUI:** Visual patterns, ambient awareness, status at a glance
- **LLM:** Complex queries, analysis, decision support
- **CLI/Editor:** Making changes

## Implementation Plan

### Phase 1: Minimal Board (This Weekend)
```bash
tract board

# Features:
- Three columns (todo, in-progress, done)
- Read tickets from issues/*.md
- Basic formatting (boxes, colors)
- Auto-refresh on file changes
- No interaction (view-only)
```

**Goal:** Prove it can look good.

### Phase 2: Responsive Design (Week 1)
```bash
# Auto-adapts to terminal size
- 80 cols: Minimal (IDs + status)
- 120 cols: Standard (+ assignee, priority)
- 160 cols: Wide (+ labels, links)
- 200+ cols: Ultra (+ stats panel)
```

**Goal:** Prove adaptive design works.

### Phase 3: Multiple Views (Week 2)
```bash
tract board           # Kanban
tract backlog         # List view
tract heatmap         # Component matrix
tract graph           # Dependency graph
```

**Goal:** Different visualizations for different contexts.

### Phase 4: Configured Boards (Week 3)
```bash
# Save board configurations
tract board --label sprint-7 --save sprint7
tract board sprint7

# Configuration files
.tract/boards/*.yaml
```

**Goal:** Persistent dashboard configs.

### Phase 5: Polish (Week 4)
```bash
# btop-level aesthetics
- Smooth transitions
- Color themes
- Progress animations
- Sprint countdown timer
- Velocity graphs
```

**Goal:** Demo-ready beauty.

## Views

### 1. Kanban (`tract board`)
**Best for:** WIP visualization, sprint dashboards

```
┌─ Todo ────┬─ In Progress ─┬─ Review ──┬─ Done ─────┐
│ 12 items  │ 5 items       │ 3 items   │ 23 items   │
└───────────┴───────────────┴───────────┴────────────┘
```

**Responsive:**
- 80 cols: Counts only
- 120 cols: Top 3 items per column
- 160 cols: Top 5 + scroll indicator
- 200+ cols: All items (if fit) + stats

### 2. Backlog (`tract backlog`)
**Best for:** Detailed list, priority scanning

```
┌─ Backlog (147 items) ───────────────────────────────┐
│ APP-123  Fix login bug         @john   🔴 High      │
│ APP-124  Add OAuth2            @john   🔴 High      │
│ APP-125  New REST API          @sarah  Medium       │
│ ...                                                  │
└──────────────────────────────────────────────────────┘
```

**Responsive:**
- 80 cols: ID + assignee
- 120 cols: + title (truncated)
- 160 cols: + priority + labels
- 200+ cols: + status + updated time

### 3. Heatmap (`tract heatmap`)
**Best for:** Pattern recognition, component health

```
┌─ Component Health ──────────────────────────────────┐
│ Component   │ Todo │ In Progress │ Done │ Blocked  │
├─────────────┼──────┼─────────────┼──────┼──────────┤
│ Auth        │ ████ │ ██          │ ████ │          │
│ API         │ ██   │ ████        │ ██   │ █        │
│ Frontend    │ ████ │             │ ████ │          │
│ Database    │ ██   │ ██          │ ████ │ ██       │
└─────────────┴──────┴─────────────┴──────┴──────────┘
```

**Responsive:**
- 80 cols: Component + counts
- 120 cols: + bar graphs
- 160 cols: + color coding
- 200+ cols: + percentages, trends

### 4. Graph (`tract graph`)
**Best for:** Dependency chains, blocker detection

```
┌─ Dependencies ──────────────────────────────────────┐
│                                                      │
│  APP-123 ──────→ APP-124 ──────→ APP-126            │
│     │                │                               │
│     └────────→ APP-125                               │
│                                                      │
│  [Blocked chain: 3 tickets waiting on APP-123]      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Responsive:**
- 80 cols: Text list of blockers
- 120 cols: Simple ASCII graph
- 160+ cols: Full dependency tree

## Technical Architecture

### File Watching (Real-Time Updates)
```javascript
const chokidar = require('chokidar');

class BoardView {
  constructor(issuesDir) {
    this.watcher = chokidar.watch(`${issuesDir}/*.md`, {
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });
    
    this.watcher
      .on('add', () => this.reload())
      .on('change', () => this.reload())
      .on('unlink', () => this.reload());
  }
  
  reload() {
    this.tickets = this.loadTickets();
    this.render();
  }
}
```

### Terminal Size Detection
```javascript
function onResize() {
  const { columns, rows } = process.stdout;
  const detailLevel = getDetailLevel(columns);
  
  // Re-render with appropriate detail
  board.render(detailLevel);
}

process.stdout.on('resize', onResize);
```

### No State (Stateless View)
```javascript
// Don't store state
// Always read from files
// TUI is just a renderer

function render() {
  const tickets = loadTicketsFromDisk();  // Fresh every time
  const filtered = applyFilters(tickets, config.filters);
  const grouped = groupByStatus(filtered);
  
  renderBoard(grouped);
}
```

**Why stateless:**
- Changes happen outside TUI (vim, LLM, CLI)
- TUI always shows truth (filesystem)
- No sync issues

## Configuration

### Board Configuration File
```yaml
# .tract/boards/sprint7.yaml
name: Sprint 7 Board
view: kanban
filters:
  labels: [sprint-7]
  status: [todo, in-progress, review]
  exclude_status: [done, cancelled]
refresh: auto
theme: nord
columns:
  - status: todo
    label: "Backlog"
  - status: in-progress
    label: "Active"
  - status: review
    label: "Review"
```

### Global TUI Config
```yaml
# .tract/config.yaml
tui:
  default_view: kanban
  refresh_rate: 500  # ms
  theme: nord
  animations: true
  detail_level: auto  # or minimal, standard, wide, ultra
```

## The Demo Value

**Monday morning:**

```bash
# Terminal 1: Your work
vim issues/APP-123.md

# Terminal 2: Dashboard (on second monitor)
tract board --label demo

# As you edit in vim, board updates in real-time
# Audience sees: "It's just markdown files!"
# Audience sees: "But it looks AMAZING"
```

**The message:**
- Git-native (just files)
- LLM-friendly (queryable)
- Beautiful (btop-level polish)
- Real-time (no refresh needed)
- Responsive (adapts to screen)

**Not "another PM tool" - A beautiful view over git-tracked markdown.**

## Bottom Line

**TUI is:**
- View-only dashboard
- Real-time updates
- Configured filters (not interactive)
- Responsive to terminal geometry
- btop-level beauty
- Ambient awareness

**TUI is NOT:**
- Interactive interface
- Replacement for LLM queries
- Feature-rich PM tool
- Where changes happen

**Purpose:**
- Something nice to look at
- Demos (flashy, impressive)
- Ambient awareness during sprints
- Visual context while working

**The differentiator:** Responsive design + btop aesthetics + real-time updates.

**The philosophy:** LLM does the work. TUI shows the beauty.

---

**Saturday night architecture decision: View-only, beautiful, responsive.**
