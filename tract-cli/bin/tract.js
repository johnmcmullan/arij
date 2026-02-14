#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const program = new Command();

// Import commands
const initCommand = require('../commands/init');
const createCommand = require('../commands/create');
const onboardCommand = require('../commands/onboard');
const importCommand = require('../commands/import');
const doctorCommand = require('../commands/doctor');
const boardCommand = require('../commands/board');

program
  .name('tract')
  .description('Git-native project management with LLM interface')
  .version('0.1.0');

// init command
program
  .command('init')
  .description('Initialize a new Tract repository')
  .option('-p, --project <code>', 'Project code (e.g., APP, FRONT)')
  .option('--jira', 'Initialize for Jira import')
  .action(initCommand);

// create command
program
  .command('create <title>')
  .description('Create a new ticket')
  .option('-a, --assignee <name>', 'Assignee')
  .option('-p, --priority <level>', 'Priority (critical, high, medium, low)')
  .option('-s, --status <status>', 'Status (todo, in-progress, review, done)')
  .option('-l, --labels <labels>', 'Comma-separated labels')
  .option('--sprint <sprint>', 'Sprint name/number')
  .action(createCommand);

// onboard command
program
  .command('onboard')
  .description('Interactive onboarding wizard')
  .option('-i, --interactive', 'Run interactive mode')
  .action(onboardCommand);

// import command
program
  .command('import')
  .description('Import tickets from Jira')
  .option('--jira <url>', 'Jira instance URL')
  .option('--project <code>', 'Jira project key')
  .option('--limit <n>', 'Limit number of issues to import')
  .option('--update-existing', 'Update existing tickets')
  .action(importCommand);

// doctor command
program
  .command('doctor')
  .description('Check Tract repository health')
  .action(doctorCommand);

// board command - Beautiful TUI dashboard
program
  .command('board')
  .description('Show beautiful TUI dashboard (view-only, real-time)')
  .option('--sprint <sprint>', 'Filter by sprint (number, latest, current, all)')
  .option('--label <labels>', 'Filter by labels (comma-separated)')
  .option('--assignee <name>', 'Filter by assignee (@me for current user)')
  .option('--status <statuses>', 'Include only these statuses')
  .option('--exclude-status <statuses>', 'Exclude these statuses')
  .option('--no-watch', 'Disable real-time file watching')
  .action(boardCommand);

program.parse();
