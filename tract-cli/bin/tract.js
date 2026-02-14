#!/usr/bin/env node

const { Command } = require('commander');
const onboard = require('../commands/onboard');
const mapComponents = require('../commands/map-components');
const importCommand = require('../commands/import');
const packageJson = require('../package.json');

const program = new Command();

program
  .name('tract')
  .description('Tract CLI - Bootstrap Tract projects from Jira')
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
  .action(onboard);

program
  .command('map-components')
  .description('Map Jira components to code directory paths using LLM')
  .option('--tract <dir>', 'Tract ticket repository directory (defaults to current)', '.')
  .option('--code <dir>', 'Code repository root to scan (defaults to parent dir)', '..')
  .option('--confidence <percent>', 'Confidence threshold for auto-accept (default: 80)', '80')
  .option('--no-interactive', 'Skip interactive review (auto-accept all)')
  .action(mapComponents);

program
  .command('import')
  .description('Import tickets from Jira to Tract')
  .option('--tract <dir>', 'Tract ticket repository directory (defaults to current)', '.')
  .option('--user <username>', 'Jira username (or use JIRA_USERNAME env var)')
  .option('--token <token>', 'Jira API token (or use JIRA_TOKEN env var)')
  .option('--password <password>', 'Jira password (or use JIRA_PASSWORD env var)')
  .option('--status <status>', 'Import tickets with this status (default: open, or use "all")', 'open')
  .option('--limit <n>', 'Limit number of tickets to import')
  .option('--jql <query>', 'Custom JQL query (overrides --status)')
  .option('--commit', 'Auto-commit imported tickets to git')
  .action(importCommand);

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

program.parse(process.argv);
