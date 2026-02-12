#!/usr/bin/env node

const { Command } = require('commander');
const onboard = require('../commands/onboard');
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
  .option('--no-git', 'Skip git initialization')
  .action(onboard);

program.parse(process.argv);
