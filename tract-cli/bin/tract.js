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
  .command('onboard')
  .description('Bootstrap a new Tract project from Jira')
  .requiredOption('--jira <url>', 'Jira instance URL (e.g., https://jira.company.com)')
  .requiredOption('--project <key>', 'Jira project key (e.g., APP, TB)')
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

program.parse(process.argv);
