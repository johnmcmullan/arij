const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const JiraClient = require('../lib/jira-client');
const TicketImporter = require('../lib/ticket-importer');

async function importCommand(options) {
  const tractDir = path.resolve(options.tract || '.');
  
  // Load config FIRST (before asking for credentials)
  const configPath = path.join(tractDir, '.tract', 'config.yaml');
  if (!fs.existsSync(configPath)) {
    console.error(chalk.red(`❌ Error: .tract/config.yaml not found at ${tractDir}`));
    console.error(chalk.yellow('   Run tract onboard first or use --tract <path>'));
    process.exit(1);
  }

  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  
  // Two modes: 
  // 1. Sync configured (use config) - ongoing bidirectional sync
  // 2. One-time import (use --jira flag) - migration to Tract-only
  
  let jiraUrl = options.jira || config.jira?.url;
  const projectKey = options.project || config.project;
  
  // Clean up null values from YAML
  if (jiraUrl === 'null' || jiraUrl === null) {
    jiraUrl = null;
  }
  
  // Guard: Need EITHER config OR --jira flag
  if (!jiraUrl) {
    console.error(chalk.red('❌ Error: Jira URL required\n'));
    console.error(chalk.yellow('Two ways to import:\n'));
    console.error(chalk.bold('Option 1: One-time import (migration to Tract-only)\n'));
    console.error(chalk.gray('   tract import \\'));
    console.error(chalk.gray('     --jira https://jira.company.com \\'));
    console.error(chalk.gray('     --project APP \\'));
    console.error(chalk.gray('     --user you@company.com \\'));
    console.error(chalk.gray('     --token <api-token>\n'));
    console.error(chalk.gray('   Downloads tickets once, no ongoing sync.\n'));
    console.error(chalk.bold('Option 2: Ongoing sync (bidirectional)\n'));
    console.error(chalk.gray('   1. Edit .tract/config.yaml:'));
    console.error(chalk.gray('      jira:'));
    console.error(chalk.gray('        url: https://jira.company.com'));
    console.error(chalk.gray('        project: APP'));
    console.error(chalk.gray(''));
    console.error(chalk.gray('   2. Set credentials:'));
    console.error(chalk.gray('      export JIRA_USERNAME=you@company.com'));
    console.error(chalk.gray('      export JIRA_TOKEN=<api-token>'));
    console.error(chalk.gray(''));
    console.error(chalk.gray('   3. Import:'));
    console.error(chalk.gray('      tract import\n'));
    process.exit(1);
  }
  
  if (!projectKey) {
    console.error(chalk.red('❌ Error: Project key required\n'));
    console.error(chalk.yellow('Specify with --project or set in .tract/config.yaml\n'));
    process.exit(1);
  }
  
  // Get auth from environment or options
  const username = options.user || process.env.JIRA_USERNAME;
  const password = options.password || process.env.JIRA_PASSWORD;
  const token = options.token || process.env.JIRA_TOKEN;

  if (!username || !(password || token)) {
    console.error(chalk.red('❌ Error: Jira credentials required\n'));
    console.error(chalk.yellow('Set environment variables:'));
    console.error(chalk.gray('   export JIRA_USERNAME=you@company.com'));
    console.error(chalk.gray('   export JIRA_TOKEN=<your-api-token>\n'));
    console.error(chalk.yellow('Or use command options:'));
    console.error(chalk.gray('   tract import --user <username> --token <token>\n'));
    process.exit(1);
  }
  
  // Detect mode
  const isOneTimeImport = !!options.jira; // User provided --jira flag
  const isSyncMode = !isOneTimeImport;    // Using config
  
  if (isOneTimeImport) {
    console.log(chalk.bold.cyan('📦 One-Time Import (Migration)\n'));
    console.log(chalk.gray('Downloading tickets from Jira...'));
    console.log(chalk.gray('No ongoing sync will be configured.\n'));
  } else {
    console.log(chalk.bold.cyan('🔄 Import with Sync Configured\n'));
    console.log(chalk.gray('Using Jira config from .tract/config.yaml\n'));
  }

  // Create Jira client
  const auth = {
    username,
    password: password || token
  };

  const jiraClient = new JiraClient(jiraUrl, auth);
  const importer = new TicketImporter(jiraClient, tractDir);

  // Import options
  const importOptions = {
    status: options.status || 'open',
    limit: options.limit ? parseInt(options.limit) : null,
    jql: options.jql,
    projectKey: projectKey  // Pass project key for import
  };

  try {
    const result = await importer.importTickets(importOptions);
    
    // Show what happened
    if (isOneTimeImport) {
      console.log(chalk.bold.green('\n✅ One-time import complete!\n'));
      console.log(chalk.gray('You are now Tract-only (no ongoing sync).'));
      console.log(chalk.gray('Tickets are in: issues/\n'));
      console.log(chalk.bold('Next steps:\n'));
      console.log(chalk.gray('   # Work with tickets locally:'));
      console.log(chalk.gray('   tract create ' + projectKey + ' --title "New ticket"'));
      console.log(chalk.gray('   tract log ' + projectKey + '-1 2h "Worked on migration"\n'));
      console.log(chalk.gray('   # Git is your source of truth:'));
      console.log(chalk.gray('   git add issues/'));
      console.log(chalk.gray('   git commit -m "Import from Jira"'));
      console.log(chalk.gray('   git push\n'));
    }
    
    // Auto-commit if requested
    if (options.commit && result.total > 0) {
      const { execSync } = require('child_process');
      try {
        execSync('git add issues/', { cwd: tractDir, stdio: 'pipe' });
        const commitMsg = result.created > 0 
          ? `Import ${result.created} new tickets from Jira`
          : `Update ${result.updated} tickets from Jira`;
        execSync(`git commit -m "${commitMsg}"`, { cwd: tractDir, stdio: 'pipe' });
        console.log(chalk.green(`✓ Changes committed to git\n`));
      } catch (err) {
        console.log(chalk.yellow(`⚠ Could not auto-commit (commit manually)\n`));
      }
    }

    return result;
  } catch (error) {
    console.error(chalk.red('\n❌ Import failed\n'));
    
    if (error.response) {
      console.error(chalk.red(`   Jira API Error: ${error.response.status} ${error.response.statusText}`));
      if (error.response.data?.errorMessages) {
        error.response.data.errorMessages.forEach(msg => {
          console.error(chalk.red(`   ${msg}`));
        });
      }
      if (error.response.status === 401) {
        console.error(chalk.yellow('\n💡 Tip: Check your username and token'));
        console.error(chalk.gray('   export JIRA_USERNAME=you@company.com'));
        console.error(chalk.gray('   export JIRA_TOKEN=<your-api-token>\n'));
      }
    } else {
      console.error(chalk.red(`   ${error.message}\n`));
    }
    
    process.exit(1);
  }
}

module.exports = importCommand;
