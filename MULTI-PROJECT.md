# Multi-Project Onboarding Guide

This guide shows how to onboard multiple related Jira projects into Tract, supporting both code-based projects (with component mapping) and ticket-only projects.

## Scenario: Three Related Projects

- **TB** (Trading Backend) - Has source code at `~/work/tb`
- **APP** (Client Apps) - Has source code at `~/work/apps`  
- **PRD** (Production Issues) - No source code, ticket-only

All three projects share the same Jira instance and have related components/tickets.

## Project Structure

```
~/work/
├── tb/                          # Trading Backend codebase
│   ├── src/
│   ├── tests/
│   └── tickets/                 # Git submodule for TB tickets
│       ├── .tract/
│       │   ├── config.yaml
│       │   ├── components.yaml
│       │   └── SCHEMA.md
│       └── issues/
│           ├── TB-1.md
│           ├── TB-2.md
│           └── ...
│
├── apps/                        # Client Apps codebase
│   ├── packages/
│   ├── beta/
│   └── tickets/                 # Git submodule for APP tickets
│       ├── .tract/
│       │   ├── config.yaml
│       │   ├── components.yaml
│       │   └── SCHEMA.md
│       └── issues/
│           ├── APP-1.md
│           ├── APP-2.md
│           └── ...
│
└── prd-tickets/                 # Standalone ticket repo (no code)
    ├── .tract/
    │   ├── config.yaml
    │   └── SCHEMA.md
    └── issues/
        ├── PRD-1.md
        ├── PRD-2.md
        └── ...

~/.config/tract/
└── workspace.yaml               # Ties all projects together
```

## Step 1: Onboard TB (Trading Backend)

**With source code and component mapping:**

```bash
cd ~/work/tb

# Onboard metadata and tickets
tract onboard \
  --jira https://jira.orcsoftware.com \
  --project TB \
  --submodule tickets \
  --import-tickets

# Map components to source code
cd tickets
tract map-components --code ../

# LLM maps components interactively:
# "Map the first 20 unmapped components to the codebase"
# Repeat until satisfied with coverage

# Commit mappings
git add .tract/components.yaml
git commit -m "Map TB components to source code"

# Configure remote and push
git remote add origin git@github.com:yourorg/tb-tickets.git
git push -u origin master

# Update parent repo
cd ~/work/tb
git add tickets .gitattributes .gitmodules
git commit -m "Add TB tickets as submodule"
git push
```

## Step 2: Onboard APP (Client Apps)

**With source code and component mapping:**

```bash
cd ~/work/apps

# Onboard metadata and tickets
tract onboard \
  --jira https://jira.orcsoftware.com \
  --project APP \
  --submodule tickets \
  --import-tickets

# Map components to source code
cd tickets
tract map-components --code ../

# LLM maps components interactively
# "Map the first 50 unmapped components to directories"

# Commit mappings
git add .tract/components.yaml
git commit -m "Map APP components to source code"

# Configure remote and push
git remote add origin git@github.com:yourorg/app-tickets.git
git push -u origin master

# Update parent repo
cd ~/work/apps
git add tickets .gitattributes .gitmodules
git commit -m "Add APP tickets as submodule"
git push
```

## Step 3: Onboard PRD (Production Issues)

**Ticket-only project (no source code):**

```bash
cd ~/work

# Create standalone ticket repo
mkdir prd-tickets
cd prd-tickets

# Onboard without submodule mode
tract onboard \
  --jira https://jira.orcsoftware.com \
  --project PRD \
  --import-tickets

# No component mapping needed (no codebase)
# PRD tickets track production issues, not code components

# Initialize git and push
git remote add origin git@github.com:yourorg/prd-tickets.git
git push -u origin master
```

**Note:** For PRD (no source code), you can skip:
- `--submodule` flag (it's a standalone repo)
- `tract map-components` (no codebase to map to)
- `.gitattributes` export-ignore (no parent code repo)

## Step 4: Create Workspace Configuration

**Tie all three projects together:**

```bash
# Create workspace config directory
mkdir -p ~/.config/tract

# Create workspace configuration
cat > ~/.config/tract/workspace.yaml << 'YAML'
# Tract Workspace: Trading Platform Projects
# Links TB, APP, and PRD tickets together

repos:
  - path: ~/work/tb/tickets
    prefix: TB
    description: Trading Backend - Core platform code
    
  - path: ~/work/apps/tickets
    prefix: APP
    description: Client Applications - User-facing apps
    
  - path: ~/work/prd-tickets
    prefix: PRD
    description: Production Issues - Live system tickets

# Optional: Define relationships
relationships:
  - from: TB
    to: APP
    type: depends_on
    description: "APP depends on TB APIs"
    
  - from: PRD
    to: [TB, APP]
    type: affects
    description: "Production issues can affect either system"
YAML
```

## Step 5: Use Copilot CLI with Workspace

**Configure Copilot to use workspace:**

```bash
# Add to ~/.bashrc or ~/.zshrc
export TRACT_WORKSPACE=~/.config/tract/workspace.yaml

# Or set per-session
TRACT_WORKSPACE=~/.config/tract/workspace.yaml gh copilot
```

**Example cross-project queries:**

```bash
# Show Copilot CLI the workspace context
cd ~/work/tb/tickets  # or ~/work/apps/tickets or ~/work/prd-tickets

# Example prompts with workspace awareness:
"Show me all open bugs across TB and APP"
"Which TB components are related to APP's FX package?"
"Create a PRD ticket for production issue affecting TB-12345"
"List all APP tickets that depend on TB tickets"
"Show recent PRD tickets and check if they have related code fixes in TB or APP"
```

## Component Mapping Results

**After mapping with LLM:**

### TB Project
```yaml
# ~/work/tb/tickets/.tract/components.yaml
components:
  API:
    description: Core API framework
    paths: [src/api]
  Market Data:
    description: Market data feeds and processing
    paths: [src/market_data, src/feeds]
  Trading Engine:
    paths: [src/trading_engine]
```

### APP Project
```yaml
# ~/work/apps/tickets/.tract/components.yaml
components:
  Analyst:
    description: Analytics and reporting package
    paths: [packages/analyst]
  FX / Market making:
    paths: [packages/fx_mm]
  ETF:
    paths: [packages/etf]
```

### PRD Project
```yaml
# ~/work/prd-tickets/.tract/config.yaml
# No components.yaml - production tickets track issues, not code
```

## Workflow Examples

### Scenario 1: Code Change Workflow (TB)

```bash
# Developer working on TB issue
cd ~/work/tb

# LLM reads workspace + SCHEMA.md + components.yaml
"Show me open TB tickets for the Trading Engine component"
"Assign TB-5678 to me and move to in-progress"

# Make code changes in ~/work/tb/src/trading_engine/
# ...

# Create commit referencing ticket
git commit -m "Fix order routing bug

Fixes TB-5678"

# Update ticket status
"Update TB-5678 status to closed, resolution fixed"
```

### Scenario 2: Production Issue Workflow (PRD)

```bash
# Production issue reported
cd ~/work/prd-tickets

"Create a new PRD ticket:
  Title: Database connection pool exhausted on prod-ae1
  Type: bug
  Priority: critical
  Description: ..."

# Investigate and find root cause in TB
"Create TB ticket linked to PRD-1234 for the fix"

# After fix is deployed
"Update PRD-1234 status to resolved, add comment about TB-9999 fix"
```

### Scenario 3: Cross-Project Query

```bash
# From any ticket repo with workspace configured
"Show me all high-priority bugs in TB and APP assigned to my team"
"List PRD tickets created this week and check for related TB/APP fixes"
"Which APP components use the TB Market Data API?"
```

## Syncing Updates from Jira

**Update all projects from Jira:**

```bash
# Update TB tickets
cd ~/work/tb/tickets
tract import --commit

# Update APP tickets  
cd ~/work/apps/tickets
tract import --commit

# Update PRD tickets
cd ~/work/prd-tickets
tract import --commit
```

## Repository Setup Summary

| Project | Location | Type | Component Mapping | Git Setup |
|---------|----------|------|-------------------|-----------|
| TB | `~/work/tb/tickets/` | Submodule | ✅ Yes (mapped to `src/`) | Submodule in tb repo |
| APP | `~/work/apps/tickets/` | Submodule | ✅ Yes (mapped to `packages/`) | Submodule in apps repo |
| PRD | `~/work/prd-tickets/` | Standalone | ❌ No (ticket-only) | Independent repo |

## Advantages of This Setup

**For Code Projects (TB, APP):**
- ✅ Tickets live alongside code in git submodules
- ✅ Components mapped to actual directories
- ✅ LLM understands code context when working with tickets
- ✅ Git history tracks code + ticket changes together
- ✅ Clients get code without tickets (export-ignore)

**For Ticket-Only Project (PRD):**
- ✅ No unnecessary code/component complexity
- ✅ Simple standalone repo
- ✅ Can still reference TB/APP tickets via workspace
- ✅ Production issues tracked separately from code

**Workspace Benefits:**
- ✅ Single workspace config ties everything together
- ✅ Cross-project queries and relationships
- ✅ LLM sees all related projects in context
- ✅ Consistent workflow across all projects

## Troubleshooting

**Workspace not loading:**
```bash
# Check workspace file exists
cat ~/.config/tract/workspace.yaml

# Verify paths are correct
ls ~/work/tb/tickets/.tract/config.yaml
ls ~/work/apps/tickets/.tract/config.yaml
ls ~/work/prd-tickets/.tract/config.yaml
```

**Component mapping not working:**
```bash
# Re-run mapping
cd ~/work/tb/tickets
tract map-components --code ../

# Check mapping task
cat .tract/mapping-task.json
```

**Submodule issues:**
```bash
# Re-initialize submodule
cd ~/work/tb
git submodule update --init --recursive
```

## Next Steps

After onboarding all projects:

1. **Team Onboarding**: Share workspace config with team
2. **Documentation**: Create team guide for using Copilot CLI with workspace
3. **Automation**: Set up periodic imports from Jira (e.g., daily cron job)
4. **Conventions**: Establish ticket referencing conventions in commits
5. **Workflows**: Define how to handle cross-project dependencies

## Related Documentation

- [Tract CLI README](../tract-cli/README.md) - Command reference
- [SCHEMA.md](../.tract/SCHEMA.md) - Complete ticket format specification
- [ON-DEMAND-MAPPING.md](../ON-DEMAND-MAPPING.md) - Component mapping workflow
- [WORKFLOW.md](../WORKFLOW.md) - LLM-as-UI workflows
