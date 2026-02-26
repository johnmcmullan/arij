# Tract Onboard CLI Specification

Complete reference for `tract onboard` command.

## Synopsis

```bash
tract onboard [options]
```

## Modes

### Interactive Mode
```bash
tract onboard --interactive
```
Guided Q&A flow. Prompts for all required information.

### Jira Sync Mode
```bash
tract onboard \
  --project <KEY> \
  --jira <URL> \
  --user <username> \
  --token <api-token> \
  [--output <dir>] \
  [--import-tickets] \
  [--limit <n>] \
  [--submodule <path>] \
  [--remote <git-url>]
```

### Local-Only Mode
```bash
tract onboard \
  --project <KEY> \
  --local \
  [--output <dir>]
```

## Options

### Required (Jira Sync)

| Flag | Description | Example |
|------|-------------|---------|
| `--project <KEY>` | Project key (2+ chars, uppercase) | `--project APP` |
| `--jira <URL>` | Jira instance URL | `--jira https://jira.company.com` |
| `--user <username>` | Jira username | `--user john.mcmullan` |
| `--token <token>` | Jira API token | `--token ghp_xxxxx` |

### Required (Local-Only)

| Flag | Description | Example |
|------|-------------|---------|
| `--project <KEY>` | Project key | `--project DEMO` |
| `--local` | Create local-only project | `--local` |

### Optional

| Flag | Description | Default |
|------|-------------|---------|
| `--interactive` | Interactive Q&A mode | (none) |
| `--output <dir>` | Output directory | `.` (current) |
| `--password <pwd>` | Jira password (instead of token) | (none) |
| `--import-tickets` | Import existing tickets | (skip) |
| `--limit <n>` | Limit ticket import | (all) |
| `--submodule <path>` | Add as git submodule | (none) |
| `--remote <url>` | Git remote URL | (none) |
| `--no-git` | Skip git initialization | (init git) |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `JIRA_USERNAME` | Alternative to --user |
| `JIRA_TOKEN` | Alternative to --token |
| `JIRA_PASSWORD` | Alternative to --password |

## Examples

### Example 1: Jira Sync with Import
```bash
tract onboard \
  --project APP \
  --jira https://jira.broadridge.com \
  --user john.mcmullan \
  --token $JIRA_TOKEN \
  --import-tickets
```

### Example 2: Local-Only in Subdirectory
```bash
mkdir my-tickets
cd my-tickets
tract onboard --project TEST --local
```

### Example 3: Submodule Mode
```bash
cd ~/code/my-app
tract onboard \
  --project APP \
  --jira https://jira.company.com \
  --user john \
  --token $JIRA_TOKEN \
  --submodule tickets \
  --remote git@github.com:company/app-tickets.git
```

### Example 4: Interactive
```bash
tract onboard --interactive
# Then answer prompts
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (see stderr for details) |

## Output Files

Onboarding creates:

```
<output-dir>/
├── .tract/
│   ├── config.yaml          # Project configuration
│   ├── SCHEMA.md            # Full specification
│   └── sprints/             # Sprint definitions (empty)
├── issues/                  # Ticket storage (empty or imported)
├── worklogs/                # Time tracking (empty)
└── .git/                    # Git repository
```

## Notes

- Requires empty or non-existent output directory
- Auto-uppercases project key
- API token recommended over password
- Import can be done later with `tract import`
- Submodule mode requires parent repo to exist
