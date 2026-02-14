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
  
  // Check sync configuration EARLY (before asking for credentials)
  const jiraUrl = config.jira?.url;
  const syncEnabled = config.sync?.enabled !== false; // Default true if not explicitly set
  
  // Guard: Sync must be configured
  if (!jiraUrl || jiraUrl === 'null' || jiraUrl === null) {
    console.error(chalk.red('❌ Error: Sync not configured\n'));
    console.error(chalk.yellow('This is a local-only Tract project.'));
    console.error(chalk.yellow('To import from Jira, you need to configure sync first.\n'));
    console.error(chalk.bold('Steps to enable sync:\n'));
    console.error(chalk.gray('1. Edit .tract/config.yaml:'));
    console.error(chalk.gray('   '));
    console.error(chalk.gray('   jira:'));
    console.error(chalk.gray('     url: https://jira.company.com'));
    console.error(chalk.gray('     project: ' + (config.project || 'YOUR_PROJECT')));
    console.error(chalk.gray('   sync:'));
    console.error(chalk.gray('     enabled: true'));
    console.error(chalk.gray(''));
    console.error(chalk.gray('2. Set credentials (secure):'));
    console.error(chalk.gray('   export JIRA_USERNAME=you@company.com'));
    console.error(chalk.gray('   export JIRA_TOKEN=<your-api-token>'));
    console.error(chalk.gray(''));
    console.error(chalk.gray('3. Try import again:'));
    console.error(chalk.gray('   tract import\n'));
    process.exit(1);
  }
  
  // Get auth from environment or options (NOW we ask, because sync is configured)
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
    jql: options.jql
  };

  try {
    const result = await importer.importTickets(importOptions);
    
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
