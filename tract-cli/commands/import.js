const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const JiraClient = require('../lib/jira-client');
const TicketImporter = require('../lib/ticket-importer');

async function importCommand(options) {
  const tractDir = path.resolve(options.tract || '.');
  
  // Load config to get Jira details
  const configPath = path.join(tractDir, '.tract', 'config.yaml');
  if (!fs.existsSync(configPath)) {
    console.error(chalk.red(`❌ Error: .tract/config.yaml not found at ${tractDir}`));
    console.error(chalk.yellow('   Run tract onboard first or use --tract <path>'));
    process.exit(1);
  }

  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  
  // Get auth from environment or options
  const username = options.user || process.env.JIRA_USERNAME;
  const password = options.password || process.env.JIRA_PASSWORD;
  const token = options.token || process.env.JIRA_TOKEN;

  if (!username || !(password || token)) {
    console.error(chalk.red('❌ Error: Jira credentials required'));
    console.error(chalk.yellow('   Set JIRA_USERNAME and JIRA_PASSWORD environment variables'));
    console.error(chalk.yellow('   Or use --user and --password/--token options'));
    process.exit(1);
  }

  // Create Jira client
  const auth = {
    username,
    password: password || token
  };

  const jiraUrl = config.jira?.url;
  if (!jiraUrl) {
    console.error(chalk.red('❌ Error: Jira URL not found in .tract/config.yaml'));
    process.exit(1);
  }

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
    console.error(chalk.red('\n❌ Import failed'));
    
    if (error.response) {
      console.error(chalk.red(`   Jira API Error: ${error.response.status} ${error.response.statusText}`));
      if (error.response.data?.errorMessages) {
        error.response.data.errorMessages.forEach(msg => {
          console.error(chalk.red(`   ${msg}`));
        });
      }
    } else {
      console.error(chalk.red(`   ${error.message}`));
    }
    
    process.exit(1);
  }
}

module.exports = importCommand;
