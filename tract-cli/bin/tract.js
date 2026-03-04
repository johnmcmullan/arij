#!/usr/bin/env node

const { Command } = require('commander');
const packageJson = require('../package.json');
const updateCheck = require('../lib/update-check');

updateCheck.trigger(); // non-blocking background check, ~twice a day

const program = new Command();

program
  .name('tract')
  .description('Tract CLI - Git-native project management with LLM interface')
  .version(packageJson.version);

program
  .command('doctor')
  .description('Run health checks and diagnostics')
  .option('--tract <dir>', 'Tract ticket repository directory (defaults to current)', '.')
  .action(require('../commands/doctor'));

program
  .command('onboard')
  .description('Bootstrap a new Tract project (with Jira sync or local-only)')
  .option('--project <key>', 'Project key (e.g., APP, TB)')
  .option('--interactive', 'Interactive setup (asks questions)')
  .option('--jira <url>', 'Jira instance URL (e.g., https://jira.company.com)')
  .option('--local', 'Create local-only project (no Jira sync)')
  .option('--user <username>', 'Jira username (or use JIRA_USERNAME env var)')
  .option('--token <token>', 'Jira API token (or use JIRA_TOKEN env var)')
  .option('--password <password>', 'Jira password (or use JIRA_PASSWORD env var)')
  .option('--output <dir>', 'Output directory (defaults to current directory)', '.')
  .option('--submodule <path>', 'Add as git submodule at this path in parent repo (e.g., tickets)')
  .option('--remote <url>', 'Git remote URL for ticket repo (optional, can be configured later)')
  .option('--import-tickets', 'Import open tickets during onboarding')
  .option('--limit <n>', 'Limit number of tickets to import (for testing)')
  .option('--no-git', 'Skip git initialization')
  .action(require('../commands/onboard'));

program
  .command('map-components')
  .description('Map Jira components to code directory paths using LLM')
  .option('--tract <dir>', 'Tract ticket repository directory (defaults to current)', '.')
  .option('--code <dir>', 'Code repository root to scan (defaults to parent dir)', '..')
  .option('--confidence <percent>', 'Confidence threshold for auto-accept (default: 80)', '80')
  .option('--no-interactive', 'Skip interactive review (auto-accept all)')
  .action(require('../commands/map-components'));

program
  .command('import')
  .description('Import tickets from Jira to Tract')
  .option('--tract <dir>', 'Tract ticket repository directory (defaults to current)', '.')
  .option('--jira <url>', 'Jira URL for one-time import (or use config)')
  .option('--project <key>', 'Jira project key for one-time import (or use config)')
  .option('--user <username>', 'Jira username (or use JIRA_USERNAME env var)')
  .option('--token <token>', 'Jira API token (or use JIRA_TOKEN env var)')
  .option('--password <password>', 'Jira password (or use JIRA_PASSWORD env var)')
  .option('--status <status>', 'Import tickets with this status (default: all — no filter)')
  .option('--limit <n>', 'Limit number of tickets to import')
  .option('--jql <query>', 'Custom JQL query (overrides --status)')
  .option('--resume', 'Skip tickets that already have a .md file (useful after interrupted import)')
  .option('--concurrency <n>', 'Parallel page requests (default: auto-tuned from round-trip time)')
  .option('--commit', 'Auto-commit imported tickets to git')
  .action(require('../commands/import'));

program
  .command('create')
  .description('Create a new ticket')
  .argument('<project>', 'Project key (e.g., APP, TB)')
  .requiredOption('--title <title>', 'Ticket title')
  .option('--type <type>', 'Issue type (bug, task, story, etc.)', 'task')
  .option('--priority <priority>', 'Priority (trivial, minor, major, critical, blocker)', 'medium')
  .option('--assignee <username>', 'Assign to user')
  .option('--description <text>', 'Detailed description')
  .option('--components <list>', 'Comma-separated component names')
  .option('--labels <list>', 'Comma-separated labels')
  .option('--server <url>', 'Sync server URL (or use TRACT_SYNC_SERVER env var)')
  .action(require('../commands/create'));

program
  .command('log')
  .description('Log time to an issue')
  .argument('<issue>', 'Issue key (e.g., APP-1002)')
  .argument('<time>', 'Time spent (e.g., 2h, 30m, 1d)')
  .argument('[comment]', 'Work description')
  .option('--server <url>', 'Sync server URL (or use TRACT_SYNC_SERVER env var)')
  .option('--author <name>', 'Author name (defaults to git user.name)')
  .option('--started <datetime>', 'Start time (ISO 8601, defaults to now)')
  .action(require('../commands/log'));

program
  .command('timesheet')
  .description('View timesheet entries')
  .argument('[author]', 'Author name (defaults to git user.name)')
  .option('--server <url>', 'Sync server URL (or use TRACT_SYNC_SERVER env var)')
  .option('--date <date>', 'Specific date (YYYY-MM-DD)')
  .option('--week [week]', 'ISO week (e.g., 2026-W07, or current week if no value)')
  .option('--month <month>', 'Month (YYYY-MM)')
  .option('--format <format>', 'Output format: text, json, csv', 'text')
  .action(require('../commands/timesheet'));

program
  .command('worklogs')
  .description('View worklog entries for an issue')
  .argument('<issue>', 'Issue key (e.g., APP-1002)')
  .option('--server <url>', 'Sync server URL (or use TRACT_SYNC_SERVER env var)')
  .action(require('../commands/worklogs'));

program
  .command('board [config]')
  .description('Show beautiful TUI dashboard (view-only, real-time, btop-style)')
  .option('--sprint <sprint>', 'Filter by sprint (backlog, current, latest, all, or sprint-id)')
  .option('--label <labels>', 'Filter by labels (comma-separated)')
  .option('--assignee <name>', 'Filter by assignee (@me, ~me, or username)')
  .option('--status <statuses>', 'Include only these statuses')
  .option('--exclude-status <statuses>', 'Exclude these statuses')
  .option('--save <name>', 'Save current filters as named board config')
  .option('--list', 'List saved board configurations')
  .option('--no-watch', 'Disable real-time file watching')
  .option('--project <prefixes>', 'Filter to specific projects (comma-separated, e.g. APP,TRADING)')
  .option('--workspace <dir>', 'Workspace root containing .tract/workspace.yaml')
  .action(require('../commands/board'));

program
  .command('demo')
  .description('Launch a live demo workspace (two projects, sprint, dashboards)')
  .option('--port <n>', 'Port to listen on', '7766')
  .option('--reset', 'Regenerate demo data from scratch')
  .action(require('../commands/demo'));

program
  .command('serve')
  .description('Start local dashboard server (http://localhost:7766)')
  .option('--port <n>', 'Port to listen on', '7766')
  .option('--workspace <dir>', 'Workspace root containing .tract/workspace.yaml')
  .option('--project <prefixes>', 'Filter to specific projects (comma-separated)')
  .action(require('../commands/serve'));

program
  .command('update')
  .description('Update the tract CLI to the latest version')
  .action(require('../commands/update'));

program
  .command('catalog <subcommand> [arg]')
  .description('Manage catalog server (subcommands: set <url>, list)')
  .action(require('../commands/catalog'));

program
  .command('clone <project>')
  .description('Clone a project and its dependencies from the catalog server')
  .option('--dest <dir>', 'Destination directory (default: ~/.tract/)')
  .option('--server <host>', 'Sync server hostname for direct clone, e.g. reek (no catalog needed)')
  .option('--dry-run', 'Show what would be cloned without doing it')
  .action(require('../commands/clone'));

// pull — git pull all workspace repos (project repos + worklogs)
program
  .command('pull')
  .description('Pull all tract repos in the current workspace to get latest tickets')
  .action(require('../commands/pull'));

program
  .command('branch <ticket>')
  .description('Create a git branch for a ticket and record it in frontmatter')
  .option('--name <branch>', 'Branch name (default: derived from ticket title)')
  .option('--base <branch>', 'Base branch to branch from (default: current HEAD)')
  .option('--force', 'Add an additional branch even if one already exists')
  .action(require('../commands/branch'));

program
  .command('review <subcommand> <ticket>')
  .description('Tract Review: open, approve, status, check')
  .option('--base <branch>', 'Base branch for PR (default: main)')
  .option('--policy <policy>', 'Review policy: agent-only, 1-human, 2-human, none')
  .option('--repo <owner/repo>', 'Forgejo repo path (default: detected from git remote)')
  .option('--comment <text>', 'Approval comment (used with approve subcommand)')
  .option('--force', 'Re-open an already in-review ticket')
  .action(require('../commands/review'));

program
  .command('skills [name]')
  .description('List available LLM skill prompts, or print one to stdout')
  .action(require('../commands/skills'));

// detect-fields — sample Jira tickets and use Claude to identify custom fields
program
  .command('detect-fields [project]')
  .description('Sample Jira tickets and identify custom field mappings using Claude')
  .option('--tract <dir>', 'Tract ticket repository directory (defaults to current)', '.')
  .option('--jira <url>', 'Jira URL (or set jira.url in config.yaml)')
  .option('--project <key>', 'Project key (or pass as argument)')
  .option('--user <username>', 'Jira username (or JIRA_USERNAME env var)')
  .option('--token <token>', 'Jira API token (or JIRA_TOKEN env var)')
  .option('--api-key <key>', 'Anthropic API key (or ANTHROPIC_API_KEY env var)')
  .option('--per-type <n>', 'Tickets to fetch per issue type (default: 2)', '2')
  .option('--model <model>', 'Claude model to use', 'claude-sonnet-4-6')
  .option('--reuse', 'Re-analyze the last saved payload without fetching from Jira again')
  .option('--payload <file>', 'Re-analyze a specific compact JSON payload file')
  .option('--agent', 'Write field data to a file for analysis by an LLM agent (skips AI API call)')
  .option('--agent-output <file>', 'Output path for --agent mode (default: /tmp/tract-field-data.json)')
  .action(require('../commands/detect-fields'));

// auth — register Jira API token on sync server
program
  .command('auth')
  .description('Register your Jira API token on the sync server')
  .option('--server <host>', 'Sync server hostname (or set sync_server in ~/.tract/workspace.yaml)')
  .option('--user <sshuser>', 'SSH user on server', 'tract')
  .action(require('../commands/auth.js'));

program.parse(process.argv);
