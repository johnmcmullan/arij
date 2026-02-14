# TUI CLI Interface Design

**Goal:** Simple defaults, powerful options, extensible for future views.

## The Interface

### Simplest Case (Just Works)
```bash
tract board
# Shows default Kanban view
# Auto-detects current sprint (or all active if no sprint)
# Full-screen TUI
```

### View Selection
```bash
# Explicit view type
tract board --kanban      # Kanban columns
tract board --backlog     # Scrolling list
tract board --heatmap     # Component matrix
tract board --graph       # Dependency tree

# Or shorter subcommands (alternative)
tract kanban              # Same as tract board --kanban
tract backlog             # Same as tract board --backlog
tract heatmap             # Same as tract board --heatmap
tract graph               # Same as tract board --graph
```

**Recommendation:** Support both patterns. Power users prefer shorter.

### Filtering
```bash
# Sprint filtering
tract board --sprint 2026-W07
tract board --sprint latest     # Most recent sprint
tract board --sprint current    # Active sprint
tract board --sprint all        # No sprint filter

# Label filtering
tract board --label tbricks
tract board --label fix-protocol
tract board --label "sprint-7,high-priority"  # Multiple (AND)

# Assignee filtering
tract board --assignee john
tract board --assignee @me      # Current user

# Status filtering
tract board --status todo,in-progress
tract board --exclude-status done,cancelled

# Combined filters
tract board --sprint latest --label tbricks --assignee john
```

### Saved Configurations
```bash
# Save a configuration
tract board --sprint 2026-W07 --label tbricks --kanban --save sprint7-tbricks

# Run saved configuration
tract board sprint7-tbricks

# List saved boards
tract board --list

# Edit saved board
tract board --edit sprint7-tbricks

# Delete saved board
tract board --delete sprint7-tbricks
```

**Saved config location:** `.tract/boards/<name>.yaml`

### Control Panel (Interactive Selection)
```bash
# Interactive board selector
tract board --control

# Shows interactive menu:
┌─ Tract Board Selector ─────────────────────────┐
│                                                 │
│  Saved Boards:                                  │
│  ❯ sprint7-tbricks   (Kanban, sprint-7)        │
│    team-backlog      (Backlog, all)            │
│    blocked-items     (Graph, blocked)          │
│                                                 │
│  Quick Start:                                   │
│    Current Sprint    (Auto-detect)              │
│    My Tickets        (@john)                    │
│    All Active        (No filters)               │
│                                                 │
│  [↑↓] Navigate  [Enter] Select  [q] Quit        │
└─────────────────────────────────────────────────┘
```

### Modern CLI Patterns

#### Pattern 1: Subcommand + Flags (Git-style)
```bash
tract board [options]
tract kanban [options]
tract backlog [options]
```

**Pros:**
- Familiar (git, docker pattern)
- Extensible
- Discoverable (`tract --help`)

**Cons:**
- More typing for common operations

#### Pattern 2: Smart Defaults + Optional Flags
```bash
# Simple
tract board

# With options
tract board --sprint latest --kanban

# Saved config
tract board myboard
```

**Pros:**
- Quick for common case
- Powerful when needed
- Named configs easy

**Cons:**
- Ambiguity (is "myboard" a filter or saved config?)

#### Pattern 3: Positional Arguments
```bash
tract board <view> [filters...]
tract board kanban sprint-7
tract board backlog tbricks
```

**Pros:**
- Very concise
- Natural language feel

**Cons:**
- Hard to extend
- Ambiguous ordering
- Not self-documenting

### Recommendation: Hybrid Approach

**Combine Pattern 1 + 2:**

```bash
# Simple (smart defaults)
tract board                    # Kanban, current sprint

# View shortcuts
tract kanban                   # Shortcut for tract board --kanban
tract backlog                  # Shortcut for tract board --backlog

# Filters (flags)
tract board --sprint latest    # Clear, explicit
tract kanban --label tbricks   # Combine shortcut + filter

# Saved configs (positional)
tract board sprint7            # Load .tract/boards/sprint7.yaml
tract kanban sprint7           # Override view from saved config

# Interactive
tract board --control          # Menu picker
```

**Why this works:**
- Simple case: Just `tract board`
- Power users: `tract kanban --label tbricks`
- Saved configs: `tract board sprint7`
- Discovery: `tract board --control` (menu)
- Extensible: New views add as subcommands

## Full Interface Spec

### `tract board` Command

```
Usage: tract board [VIEW] [CONFIG_NAME] [OPTIONS]

Views:
  (default)         Kanban board
  --kanban          Kanban board (explicit)
  --backlog         Scrolling list view
  --heatmap         Component health matrix
  --graph           Dependency graph

Filters:
  --sprint SPRINT   Filter by sprint (number, latest, current, all)
  --label LABELS    Filter by labels (comma-separated)
  --assignee USER   Filter by assignee (@me for current user)
  --status STATUS   Include only these statuses
  --exclude-status  Exclude these statuses
  
Configuration:
  --save NAME       Save current view/filters as named config
  --list            List saved board configurations
  --edit NAME       Edit saved configuration
  --delete NAME     Delete saved configuration
  
Interactive:
  --control         Show interactive board selector
  
Options:
  --refresh MS      Refresh rate in milliseconds (default: 500)
  --theme THEME     Color theme (nord, dracula, monokai, default)
  --no-watch        Don't watch for file changes (static view)
  
Examples:
  tract board                              # Default Kanban, current sprint
  tract board --sprint latest              # Latest sprint
  tract board --label tbricks --backlog    # Backlog filtered by label
  tract board --save sprint7               # Save current config
  tract board sprint7                      # Load saved config
  tract board --control                    # Interactive selector
```

### View Shortcuts

```bash
# These are shortcuts for tract board --<view>

tract kanban [OPTIONS]    # = tract board --kanban [OPTIONS]
tract backlog [OPTIONS]   # = tract board --backlog [OPTIONS]
tract heatmap [OPTIONS]   # = tract board --heatmap [OPTIONS]
tract graph [OPTIONS]     # = tract board --graph [OPTIONS]
```

### Saved Configuration Format

```yaml
# .tract/boards/sprint7-tbricks.yaml

name: Sprint 7 TBricks Work
view: kanban
filters:
  sprint: 2026-W07
  labels: [tbricks, fix-protocol]
  status: [todo, in-progress, review]
  exclude_status: [done, cancelled]
theme: nord
refresh: 500
columns:  # Optional: customize Kanban columns
  - status: todo
    label: "Backlog"
  - status: in-progress
    label: "Active"
  - status: review
    label: "In Review"
```

## Smart Defaults

### Sprint Detection
```javascript
function detectCurrentSprint() {
  // 1. Check .tract/config.yaml for active sprint
  const config = loadConfig();
  if (config.current_sprint) return config.current_sprint;
  
  // 2. Find most recent sprint in tickets
  const tickets = loadAllTickets();
  const sprints = tickets
    .map(t => t.sprint)
    .filter(Boolean)
    .sort()
    .reverse();
  
  return sprints[0] || 'all';  // Fallback to 'all'
}
```

### Current User Detection
```javascript
function getCurrentUser() {
  // From git config
  const gitUser = execSync('git config user.name').toString().trim();
  
  // Or from environment
  const envUser = process.env.USER || process.env.USERNAME;
  
  return gitUser || envUser;
}
```

## Extensibility Plan

### Adding New Views (Future)

```bash
# Week 3: Add timeline view
tract board --timeline
tract timeline

# Week 4: Add burndown view
tract board --burndown
tract burndown

# Month 2: Add custom views
tract board --custom my-view.js
```

**Implementation:**
```javascript
// tract-cli/views/index.js

const views = {
  kanban: require('./kanban'),
  backlog: require('./backlog'),
  heatmap: require('./heatmap'),
  graph: require('./graph'),
  // Future views auto-discovered:
  // timeline: require('./timeline'),
  // burndown: require('./burndown'),
};

function loadView(name) {
  if (views[name]) return views[name];
  
  // Try loading from .tract/views/
  const customPath = `.tract/views/${name}.js`;
  if (fs.existsSync(customPath)) {
    return require(path.resolve(customPath));
  }
  
  throw new Error(`Unknown view: ${name}`);
}
```

### View Interface (Plugin Pattern)

```javascript
// tract-cli/views/kanban.js

module.exports = {
  name: 'kanban',
  description: 'Kanban board with columns',
  
  // Required: Render function
  render(tickets, config, screen) {
    const grouped = groupByStatus(tickets);
    const detailLevel = getDetailLevel(screen.width);
    
    return renderKanban(grouped, detailLevel, config);
  },
  
  // Optional: View-specific config
  defaultConfig: {
    columns: ['todo', 'in-progress', 'review', 'done']
  },
  
  // Optional: Validates filters for this view
  validateFilters(filters) {
    // Kanban works better with status filters
    return true;
  }
};
```

**Adding new view:**
```javascript
// .tract/views/timeline.js (custom view)

module.exports = {
  name: 'timeline',
  description: 'Timeline of ticket activity',
  
  render(tickets, config, screen) {
    const sorted = sortByUpdated(tickets);
    return renderTimeline(sorted, screen.width);
  }
};
```

## Cool CLI Patterns (Modern)

### 1. Interactive Prompts (When Ambiguous)
```bash
tract board --save

# Prompts:
? Board name: sprint7-tbricks
? Description (optional): Sprint 7 TBricks work
✓ Saved to .tract/boards/sprint7-tbricks.yaml
```

**Library:** `inquirer` or `prompts`

### 2. Autocomplete Support
```bash
# Add to shell config
eval "$(tract completion bash)"

# Then:
tract board --spr<TAB>
# Expands to: tract board --sprint
```

**Library:** `omelette` or built-in

### 3. Rich Output (When Not in TUI)
```bash
tract board --list

# Pretty output:
┌─ Saved Boards ────────────────────────────────────────┐
│ sprint7-tbricks    Kanban    Sprint 2026-W07, tbricks │
│ team-backlog       Backlog   All tickets              │
│ blocked-items      Graph     Blocked dependencies     │
└────────────────────────────────────────────────────────┘
```

**Library:** `cli-table3`, `boxen`

### 4. Progress Indicators
```bash
tract board --sprint latest

# While loading:
⠋ Loading tickets... (47 found)
```

**Library:** `ora`, `cli-spinners`

### 5. Colors and Emojis
```bash
tract board --list

✓ sprint7-tbricks   🎯 Kanban   Sprint 2026-W07
✓ team-backlog      📋 Backlog  All active
⚠ old-board         🗓️  Timeline (config outdated)
```

**Library:** `chalk`, `picocolors`

## Implementation Priority

### Phase 1: Basic Interface (This Weekend)
```bash
tract board                    # Default Kanban
tract board --backlog          # Backlog view
tract board --sprint latest    # Sprint filter
```

### Phase 2: Saved Configs (Week 1)
```bash
tract board --save myboard
tract board myboard
tract board --list
```

### Phase 3: Interactive Control (Week 2)
```bash
tract board --control
# Show menu picker
```

### Phase 4: View Shortcuts (Week 2)
```bash
tract kanban
tract backlog
tract heatmap
```

### Phase 5: Advanced Filters (Week 3)
```bash
tract board --assignee @me --exclude-status done
tract board --label "tbricks,high-priority"
```

### Phase 6: Themes & Polish (Week 4)
```bash
tract board --theme nord
tract board --no-watch
```

## Example Workflows

### Developer Daily Workflow
```bash
# Morning standup
tract board

# My work
tract kanban --assignee @me

# Check blockers
tract graph --label blocked
```

### Sprint Planning
```bash
# Review backlog
tract backlog --exclude-status done

# Check capacity
tract heatmap --assignee all

# Save sprint board
tract board --sprint 2026-W08 --save sprint8
```

### Demo / Stakeholder Review
```bash
# Show current sprint progress
tract board --sprint latest --theme nord

# (On ultra-wide monitor, auto-shows stats panel)
# (Edit ticket in vim, watch board update in real-time)
# (Audience: "Whoa!")
```

### Team Dashboard (Always-On Monitor)
```bash
# Save team board
tract board --sprint current --exclude-status done --save team-active

# Run on second monitor
tract board team-active

# Stays running, updates automatically
# Glance for patterns (blocks of red = problem)
```

## Terminal Size Scenarios

### Demo on Projector
```bash
# Start on laptop (120 cols)
tract board --sprint latest

# Move to projector (200+ cols)
# Auto-expands: Shows stats panel, more details, graphs

# Audience sees: "It's adapting to the screen size!"
```

### Pair Programming
```bash
# Split terminal
tmux split-window -h

# Left: Your work
vim issues/APP-123.md

# Right: Board view
tract board --assignee @me

# As you edit, board updates
# Pair programmer sees changes instantly
```

## The "Wow Factor" Demo Script

```bash
# 1. Start simple (80 cols terminal)
tract board
# Shows minimal view (counts, IDs)

# 2. Expand terminal (to 120 cols)
# Board auto-expands: adds assignees, priorities

# 3. Expand more (to 160 cols)
# Board adds: labels, descriptions, links

# 4. Go ultra-wide (200+ cols)
# Board adds: stats panel, velocity graph, sprint countdown

# 5. Edit a ticket in vim (split screen)
vim issues/APP-123.md
# Change status: in-progress → done

# 6. Save
# Board updates INSTANTLY (real-time file watch)

# Audience: 🤯
```

## Bottom Line

**Recommended CLI Interface:**

```bash
# Simple
tract board                    # Just works

# Filters  
tract board --sprint latest --label tbricks

# Views
tract kanban                   # Shortcut
tract board --backlog          # Explicit

# Saved configs
tract board --save myboard
tract board myboard

# Interactive
tract board --control          # Menu picker
```

**Extensibility:**
- New views: Add to `tract-cli/views/`
- Custom views: `.tract/views/<name>.js`
- Plugin interface: `{ name, description, render() }`

**Modern CLI patterns:**
- Smart defaults (current sprint, @me)
- Interactive prompts (when ambiguous)
- Rich output (tables, colors, emojis)
- Autocomplete support
- Progress indicators

**The wow factor:**
- Responsive design (adapts to terminal size)
- Real-time updates (watch files)
- btop-level beauty
- Live demo (edit vim, see board update)

---

**This interface is worth building. It's not just features - it's the demo.**
