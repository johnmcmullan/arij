const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const ora = require('ora');
const JiraClient = require('../lib/jira-client');
const ConfigGenerator = require('../lib/config-generator');

async function onboard(options) {
  console.log(chalk.bold.cyan('\n🚀 Tract Onboarding\n'));

  // Validate inputs
  const jiraUrl = options.jira;
  const projectKey = options.project.toUpperCase();
  const outputDir = path.resolve(options.output);

  // Get credentials
  const username = options.user || process.env.JIRA_USERNAME;
  const token = options.token || process.env.JIRA_TOKEN;
  const password = options.password || process.env.JIRA_PASSWORD;

  if (!username) {
    console.error(chalk.red('❌ Error: --user required or set JIRA_USERNAME'));
    process.exit(1);
  }

  if (!token && !password) {
    console.error(chalk.red('❌ Error: --token or --password required, or set JIRA_TOKEN/JIRA_PASSWORD'));
    process.exit(1);
  }

  // Create output directory if needed
  if (!fs.existsSync(outputDir)) {
    console.log(chalk.yellow(`📁 Creating directory: ${outputDir}`));
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Check if directory is empty (or has only .git)
  const existingFiles = fs.readdirSync(outputDir).filter(f => f !== '.git');
  if (existingFiles.length > 0) {
    console.error(chalk.red(`❌ Error: Directory not empty: ${outputDir}`));
    console.error(chalk.yellow(`   Remove files or use a different --output directory`));
    process.exit(1);
  }

  console.log(chalk.gray(`Jira URL: ${jiraUrl}`));
  console.log(chalk.gray(`Project:  ${projectKey}`));
  console.log(chalk.gray(`Output:   ${outputDir}\n`));

  const spinner = ora('Connecting to Jira...').start();

  try {
    // Create Jira client
    const auth = {
      username: username,
      password: token || password
    };
    const jira = new JiraClient(jiraUrl, auth);

    spinner.text = 'Fetching project metadata from Jira...';
    const metadata = await jira.getProjectMetadata(projectKey);

    spinner.succeed(chalk.green('✓ Metadata fetched successfully'));

    // Display what we found
    console.log(chalk.bold('\n📊 Project Metadata:'));
    console.log(chalk.gray(`   Name:        ${metadata.project.name}`));
    console.log(chalk.gray(`   Key:         ${metadata.project.key}`));
    console.log(chalk.gray(`   Lead:        ${metadata.project.lead?.displayName || 'N/A'}`));
    console.log(chalk.gray(`   Issue Types: ${metadata.issueTypes.length}`));
    console.log(chalk.gray(`   Statuses:    ${metadata.statuses.length}`));
    console.log(chalk.gray(`   Priorities:  ${metadata.priorities.length}`));
    console.log(chalk.gray(`   Components:  ${metadata.components.length}`));
    
    if (metadata.issueTypes.length > 0) {
      console.log(chalk.gray(`\n   Types: ${metadata.issueTypes.map(t => t.name).join(', ')}`));
    }
    
    if (metadata.statuses.length > 0) {
      console.log(chalk.gray(`   Statuses: ${metadata.statuses.slice(0, 5).join(', ')}${metadata.statuses.length > 5 ? '...' : ''}`));
    }

    // Generate configuration files
    const genSpinner = ora('Generating configuration files...').start();
    const generator = new ConfigGenerator(metadata);
    const files = generator.writeFiles(outputDir);
    genSpinner.succeed(chalk.green('✓ Configuration files generated'));

    console.log(chalk.bold('\n📝 Created Files:'));
    files.forEach(file => {
      const relativePath = path.relative(process.cwd(), file);
      console.log(chalk.gray(`   ${relativePath}`));
    });

    // Initialize git if requested
    if (options.git) {
      const gitSpinner = ora('Initializing git repository...').start();
      try {
        if (!fs.existsSync(path.join(outputDir, '.git'))) {
          execSync('git init', { cwd: outputDir, stdio: 'pipe' });
        }
        execSync('git add .', { cwd: outputDir, stdio: 'pipe' });
        execSync(`git commit -m "Initial commit: onboard ${projectKey} from Jira"`, { 
          cwd: outputDir, 
          stdio: 'pipe' 
        });
        gitSpinner.succeed(chalk.green('✓ Git repository initialized'));
      } catch (err) {
        gitSpinner.warn(chalk.yellow('⚠ Git initialization failed (non-fatal)'));
        console.log(chalk.gray(`   ${err.message}`));
      }
    }

    // Success message
    console.log(chalk.bold.green('\n✅ Onboarding complete!\n'));
    console.log(chalk.bold('Next Steps:\n'));
    
    if (outputDir !== process.cwd()) {
      console.log(chalk.gray(`   cd ${path.relative(process.cwd(), outputDir)}`));
    }
    
    console.log(chalk.gray('   # Review and edit configuration:'));
    console.log(chalk.gray('   cat .arij/config.yaml\n'));
    
    if (metadata.components.length > 0) {
      console.log(chalk.gray('   # Add component paths:'));
      console.log(chalk.gray('   vim .arij/components.yaml\n'));
    }
    
    console.log(chalk.gray('   # Import existing Jira issues (future):'));
    console.log(chalk.gray(`   tract import --project ${projectKey}\n`));
    
    console.log(chalk.gray('   # Start creating tickets:'));
    console.log(chalk.gray(`   # Create tickets/${projectKey}-001.md manually or use Tract UI\n`));

  } catch (error) {
    spinner.fail(chalk.red('✗ Error during onboarding'));
    
    if (error.response) {
      console.error(chalk.red(`\n❌ Jira API Error: ${error.response.status} ${error.response.statusText}`));
      if (error.response.data?.errorMessages) {
        error.response.data.errorMessages.forEach(msg => {
          console.error(chalk.red(`   ${msg}`));
        });
      }
      if (error.response.status === 401) {
        console.error(chalk.yellow('\n💡 Tip: Check your username and token/password'));
      } else if (error.response.status === 404) {
        console.error(chalk.yellow(`\n💡 Tip: Project "${projectKey}" may not exist`));
      }
    } else {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      if (error.code === 'ENOTFOUND') {
        console.error(chalk.yellow(`\n💡 Tip: Check Jira URL: ${jiraUrl}`));
      }
    }
    
    process.exit(1);
  }
}

module.exports = onboard;
