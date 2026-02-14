# Configuration Schema

Complete reference for `.tract/config.yaml`.

## Location

**Standalone or code+tickets repo:**
```
.tract/config.yaml
```

**Submodule mode:**
```
tickets/.tract/config.yaml      # Submodule config (self-contained)
parent/.tract/config.yaml       # Optional parent config
```

## Minimal Configuration

Absolute minimum for local-only project:

```yaml
project: APP
```

That's it. Tract will use defaults for everything else.

## Standard Configuration

Typical setup with Jira sync:

```yaml
project: APP

jira:
  url: https://jira.company.com
  project: APP

types: [bug, story, task, epic]
statuses: [backlog, todo, in-progress, review, done]
priorities: [trivial, minor, major, critical, blocker]
```

## Complete Example

Full configuration with all sections:

```yaml
# Project identification
project: APP
prefix: APP      # Optional, defaults to project

# Jira sync (optional)
jira:
  url: https://jira.company.com
  project: APP
  component_map:
    auth-service: "Authentication"
    api-gateway: "API Gateway"

# Sync server (optional)
sync:
  enabled: true
  server: http://tract-server:3100

# Issue types
types: [bug, story, task, epic, incident]

# Workflow statuses
statuses: [backlog, todo, in-progress, testing, review, done, archived]

# Priority levels
priorities: [trivial, minor, major, critical, blocker]

# Default values for new tickets
defaults:
  type: task
  status: backlog
  priority: medium

# Field configuration
fields:
  tag_field: labels     # Use 'labels' or 'tags' for tagging

# Component definitions
components:
  auth-service:
    description: Authentication and authorization
    path: src/auth/
    lead: john.mcmullan
  api-gateway:
    description: API gateway and routing
    path: src/gateway/
    lead: sarah.jones
  trading-engine:
    description: Core trading logic
    path: src/trading/
    lead: mike.smith

# Sprint configuration
sprint_duration_days: 14
sprint_start_day: monday

# Board views (optional)
boards:
  - name: engineering
    columns:
      - status: backlog
        label: "Backlog"
      - status: [todo, in-progress]
        label: "Active"
      - status: review
        label: "Review"
      - status: done
        label: "Done"
  - name: support
    columns:
      - status: backlog
        label: "New"
      - status: in-progress
        label: "Working"
      - status: done
        label: "Resolved"

# Automation rules (optional)
automations:
  - name: auto-assign-bugs
    trigger: create
    condition: type == bug AND priority == critical
    action:
      set:
        assignee: john.mcmullan
        labels: [urgent, sev1]
```

## Field Reference

### Project Section

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `project` | string | ✅ Yes | Project key (uppercase) | `APP`, `TB`, `MYPROJ` |
| `prefix` | string | No | Ticket ID prefix (defaults to project) | `APP` |

### Jira Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jira.url` | string | No | Jira instance URL (for sync) |
| `jira.project` | string | No | Jira project key (often same as project) |
| `jira.component_map` | object | No | Map Tract components to Jira component names |

Example:
```yaml
jira:
  url: https://jira.broadridge.com
  project: APP
  component_map:
    auth-service: "Authentication Service"
    api: "REST API"
```

### Sync Section

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sync.enabled` | boolean | No | Enable/disable sync |
| `sync.server` | string | No | Sync server URL |

Example:
```yaml
sync:
  enabled: true
  server: http://tract-server:3100
```

### Types, Statuses, Priorities

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `types` | list[string] | No | Allowed issue types |
| `statuses` | list[string] | No | Allowed workflow states |
| `priorities` | list[string] | No | Allowed priority levels |

**Default values if not specified:**
```yaml
types: [bug, story, task, epic]
statuses: [backlog, in-progress, done]
priorities: [low, medium, high]
```

**Wildcard (allow any value):**
```yaml
types: "*"
statuses: "*"
priorities: "*"
```

### Defaults Section

Set default values for new tickets:

```yaml
defaults:
  type: task
  status: backlog
  priority: medium
  assignee: null
```

### Fields Section

Configure field behavior:

```yaml
fields:
  tag_field: labels    # Use 'labels' or 'tags' for ticket tagging
```

**Why this matters:** Some teams prefer `labels:`, others prefer `tags:`. This setting tells Tract which field name to use.

### Components Section

Define logical components and their metadata:

```yaml
components:
  component-name:
    description: Human-readable description
    path: src/component/        # Code directory path
    lead: username              # Component owner
    jira_name: "Jira Component" # Map to Jira component name
```

Example:
```yaml
components:
  auth-service:
    description: Authentication and authorization
    path: src/auth/
    lead: john.mcmullan
    jira_name: "Authentication"
  api-gateway:
    description: API gateway and routing
    path: src/gateway/
    lead: sarah.jones
    jira_name: "API Gateway"
```

**Component Mapping:**
When a ticket has `component: auth-service`, Tract knows:
- It's related to `src/auth/` code
- The lead is `john.mcmullan`
- It maps to "Authentication" component in Jira

### Sprint Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sprint_duration_days` | integer | 14 | Sprint length in days |
| `sprint_start_day` | string | monday | Day of week sprints start |

Example:
```yaml
sprint_duration_days: 10
sprint_start_day: wednesday
```

### Boards Section

Define board views (how tickets are displayed):

```yaml
boards:
  - name: board-name
    columns:
      - status: backlog          # Single status
        label: "Backlog"
      - status: [todo, in-progress]  # Multiple statuses
        label: "Active Work"
      - status: done
        label: "Completed"
```

Example:
```yaml
boards:
  - name: engineering
    columns:
      - status: backlog
        label: "Backlog"
      - status: [todo, in-progress, testing]
        label: "In Progress"
      - status: review
        label: "Code Review"
      - status: done
        label: "Done"
  - name: kanban
    columns:
      - status: backlog
        label: "To Do"
      - status: in-progress
        label: "Doing"
      - status: done
        label: "Done"
```

### Automations Section (Advanced)

Define automation rules:

```yaml
automations:
  - name: rule-name
    trigger: create | update | close
    condition: <expression>
    action:
      set:
        field: value
```

Example:
```yaml
automations:
  - name: auto-assign-critical-bugs
    trigger: create
    condition: type == bug AND priority == critical
    action:
      set:
        assignee: oncall-engineer
        labels: [urgent, sev1]
        
  - name: auto-close-wontfix
    trigger: update
    condition: resolution == wontfix
    action:
      set:
        status: done
```

**Note:** Automation execution requires sync server or local automation runner.

## Multi-Project Configuration

For repositories hosting multiple projects:

```yaml
projects:
  APP:
    types: [bug, story, task, epic]
    statuses: [backlog, todo, in-progress, done]
    priorities: [low, medium, high, critical]
    jira:
      url: https://jira.company.com
      project: APP
  TB:
    types: [bug, story, task, epic, incident]
    statuses: [backlog, in-progress, testing, done]
    priorities: [trivial, minor, major, critical, blocker]
    jira:
      url: https://jira.company.com
      project: TB
```

**Directory structure:**
```
issues/
├── APP/
│   ├── APP-1234.md
│   └── APP-1235.md
└── TB/
    ├── TB-001.md
    └── TB-002.md
```

## Configuration Validation

### Validation Rules

1. **project must be set** - Required field
2. **Types, statuses, priorities must be unique** - No duplicates
3. **Component paths must exist** - If specified, directories must exist
4. **Jira URL must be valid** - If set, must be http:// or https://
5. **Board statuses must be defined** - All statuses in boards must exist in main statuses list

### Checking Configuration

```bash
tract doctor
```

Output:
```
✓ Tract config file valid
  Project: APP
```

Or if invalid:
```
✗ Tract config file valid
  Invalid YAML: duplicate key 'project'
  Fix: Check .tract/config.yaml syntax
```

## Environment Variables

Override config with environment variables:

| Variable | Overrides | Example |
|----------|-----------|---------|
| `TRACT_SYNC_SERVER` | `sync.server` | `http://tract-server:3100` |
| `JIRA_USERNAME` | N/A (for auth) | `john.mcmullan` |
| `JIRA_TOKEN` | N/A (for auth) | `ghp_xxxxx` |

## Best Practices

1. **Keep it minimal** - Only configure what you need
2. **Use wildcards sparingly** - `types: "*"` disables validation
3. **Document components** - Include descriptions and leads
4. **Version control** - Commit config.yaml to git
5. **Validate after changes** - Run `tract doctor`
6. **Sync server optional** - Tract works offline without sync
7. **Map components to code** - Use `path` for LLM context

## Common Patterns

### Local-Only Development
```yaml
project: DEMO
types: "*"
statuses: "*"
```

### Jira-Synced Team Project
```yaml
project: APP
jira:
  url: https://jira.company.com
  project: APP
sync:
  enabled: true
types: [bug, story, task, epic]
statuses: [backlog, in-progress, review, done]
```

### Multi-Team with Components
```yaml
project: PLATFORM
components:
  frontend:
    path: packages/web/
    lead: sarah.jones
  backend:
    path: packages/api/
    lead: john.mcmullan
  mobile:
    path: packages/mobile/
    lead: mike.smith
```

## Migration

### Adding Jira Sync to Local Project
```yaml
# Before
project: APP

# After
project: APP
jira:
  url: https://jira.company.com
  project: APP
sync:
  enabled: true
  server: http://tract-server:3100
```

Then: `tract import --status open` to pull existing tickets.

### Splitting Multi-Project to Separate Repos
Extract project-specific config from `projects:` section into individual `config.yaml` files.
