const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const chalk = require('chalk');
const ora = require('ora');
const JiraClient = require('../lib/jira-client');
const ConfigGenerator = require('../lib/config-generator');
const TicketImporter = require('../lib/ticket-importer');

async function onboard(options) {
  console.log(chalk.bold.cyan('\n🚀 Tract Onboarding\n'));

  // Validate inputs
  const jiraUrl = options.jira;
  const projectKey = options.project.toUpperCase();
  let outputDir = path.resolve(options.output);
  const submodulePath = options.submodule;
  const remoteUrl = options.remote;
  const isSubmoduleMode = !!submodulePath;
  const importTickets = options.importTickets;
  const ticketLimit = options.limit ? parseInt(options.limit) : null;

  // In submodule mode, we create the ticket repo in a temp location first
  let ticketRepoDir = outputDir;
  let parentRepoDir = null;
  
  if (isSubmoduleMode) {
    parentRepoDir = outputDir;
    // Create temp directory in parent repo's directory (same filesystem)
    const tmpDir = path.join(parentRepoDir, `.tract-tmp-${projectKey}-${Date.now()}`);
    ticketRepoDir = tmpDir;
    
    console.log(chalk.bold.cyan('📦 Submodule Mode Enabled\n'));
    console.log(chalk.gray(`Parent repo: ${parentRepoDir}`));
    console.log(chalk.gray(`Submodule:   ${submodulePath}`));
    if (remoteUrl) {
      console.log(chalk.gray(`Remote:      ${remoteUrl}`));
    } else {
      console.log(chalk.yellow(`Remote:      (configure later)`));
    }
    console.log();
    
    // Validate parent repo exists and is a git repo
    if (!fs.existsSync(parentRepoDir)) {
      console.error(chalk.red(`❌ Error: Parent directory does not exist: ${parentRepoDir}`));
      process.exit(1);
    }
    if (!fs.existsSync(path.join(parentRepoDir, '.git'))) {
      console.error(chalk.red(`❌ Error: Parent directory is not a git repository: ${parentRepoDir}`));
      console.error(chalk.yellow(`   Run: cd ${parentRepoDir} && git init`));
      process.exit(1);
    }
    
    // Check if submodule path already exists
    const submoduleFullPath = path.join(parentRepoDir, submodulePath);
    if (fs.existsSync(submoduleFullPath)) {
      console.error(chalk.red(`❌ Error: Submodule path already exists: ${submoduleFullPath}`));
      process.exit(1);
    }
    
    outputDir = ticketRepoDir;
  }

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
    if (!isSubmoduleMode) {
      console.log(chalk.yellow(`📁 Creating directory: ${outputDir}`));
    }
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Check if directory is empty (or has only .git)
  if (!isSubmoduleMode) {
    const existingFiles = fs.readdirSync(outputDir).filter(f => f !== '.git');
    if (existingFiles.length > 0) {
      console.error(chalk.red(`❌ Error: Directory not empty: ${outputDir}`));
      console.error(chalk.yellow(`   Remove files or use a different --output directory`));
      process.exit(1);
    }
  }

  if (!isSubmoduleMode) {
    console.log(chalk.gray(`Jira URL: ${jiraUrl}`));
    console.log(chalk.gray(`Project:  ${projectKey}`));
    console.log(chalk.gray(`Output:   ${outputDir}\n`));
  }

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
        
        // Add remote if provided
        if (remoteUrl) {
          execSync(`git remote add origin ${remoteUrl}`, { cwd: outputDir, stdio: 'pipe' });
          gitSpinner.text = 'Pushing to remote...';
          try {
            execSync('git push -u origin master', { cwd: outputDir, stdio: 'pipe' });
            gitSpinner.succeed(chalk.green('✓ Git repository initialized and pushed'));
          } catch (pushErr) {
            gitSpinner.succeed(chalk.green('✓ Git repository initialized (push failed - continue manually)'));
            console.log(chalk.yellow(`   Push failed: ${pushErr.message}`));
            console.log(chalk.gray(`   Retry: cd ${path.relative(process.cwd(), outputDir)} && git push -u origin master`));
          }
        } else {
          gitSpinner.succeed(chalk.green('✓ Git repository initialized'));
        }
      } catch (err) {
        gitSpinner.warn(chalk.yellow('⚠ Git initialization failed (non-fatal)'));
        console.log(chalk.gray(`   ${err.message}`));
      }
    }

    // Handle submodule mode
    if (isSubmoduleMode) {
      const submoduleSpinner = ora('Setting up git submodule...').start();
      try {
        const submoduleFullPath = path.join(parentRepoDir, submodulePath);
        
        if (remoteUrl) {
          // Add submodule using remote URL
          execSync(`git submodule add ${remoteUrl} ${submodulePath}`, { 
            cwd: parentRepoDir, 
            stdio: 'pipe' 
          });
        } else {
          // Add submodule using local path (can add remote later)
          // First move the ticket repo to the submodule location
          fs.renameSync(outputDir, submoduleFullPath);
          
          // Initialize as submodule
          execSync(`git submodule add ./${submodulePath}`, { 
            cwd: parentRepoDir, 
            stdio: 'pipe' 
          });
        }
        
        // Create/update .gitattributes to exclude tickets from client exports
        const gitattributesPath = path.join(parentRepoDir, '.gitattributes');
        let gitattributes = '';
        if (fs.existsSync(gitattributesPath)) {
          gitattributes = fs.readFileSync(gitattributesPath, 'utf8');
        }
        
        const exportIgnoreRules = [
          `${submodulePath}/ export-ignore`,
          '.gitmodules export-ignore'
        ];
        
        exportIgnoreRules.forEach(rule => {
          if (!gitattributes.includes(rule)) {
            gitattributes += `${rule}\n`;
          }
        });
        
        fs.writeFileSync(gitattributesPath, gitattributes);
        
        // Commit submodule and .gitattributes to parent repo
        execSync('git add .gitattributes .gitmodules ' + submodulePath, { 
          cwd: parentRepoDir, 
          stdio: 'pipe' 
        });
        execSync(`git commit -m "Add ${projectKey} tickets as submodule at ${submodulePath}"`, { 
          cwd: parentRepoDir, 
          stdio: 'pipe' 
        });
        
        submoduleSpinner.succeed(chalk.green('✓ Submodule configured and committed to parent repo'));
        
        console.log(chalk.bold('\n📦 Submodule Setup:'));
        console.log(chalk.gray(`   Tickets location: ${submodulePath}/`));
        console.log(chalk.gray(`   Export-ignore:    Configured (.gitattributes)`));
        console.log(chalk.gray(`   Parent commit:    Created\n`));
        
        if (!remoteUrl) {
          console.log(chalk.yellow('💡 Remote not configured. To add later:\n'));
          console.log(chalk.gray(`   cd ${path.join(parentRepoDir, submodulePath)}`));
          console.log(chalk.gray(`   git remote add origin <your-ticket-repo-url>`));
          console.log(chalk.gray(`   git push -u origin master\n`));
        }
        
      } catch (err) {
        submoduleSpinner.fail(chalk.red('✗ Submodule setup failed'));
        console.error(chalk.red(`   ${err.message}`));
        console.error(chalk.yellow('\n💡 Tip: You can manually add the submodule:'));
        console.error(chalk.gray(`   git submodule add <remote-url> ${submodulePath}`));
        process.exit(1);
      }
    }

    // Import tickets if requested
    if (importTickets) {
      const finalDir = isSubmoduleMode 
        ? path.join(parentRepoDir, submodulePath) 
        : outputDir;
      
      const importer = new TicketImporter(jiraClient, finalDir);
      const importResult = await importer.importTickets({
        status: 'open',
        limit: ticketLimit
      });
      
      // Commit imported tickets
      if (importResult.total > 0) {
        try {
          execSync('git add issues/', { cwd: finalDir, stdio: 'pipe' });
          execSync(`git commit -m "Import ${importResult.created} tickets from Jira"`, { 
            cwd: finalDir, 
            stdio: 'pipe' 
          });
          console.log(chalk.green(`✓ Committed ${importResult.total} tickets to git\n`));
        } catch (err) {
          console.log(chalk.yellow(`⚠ Could not auto-commit tickets (commit manually)\n`));
        }
      }
    }

    // Success message
    console.log(chalk.bold.green('\n✅ Onboarding complete!\n'));
    console.log(chalk.bold('Next Steps:\n'));
    
    const workingDir = isSubmoduleMode 
      ? path.join(parentRepoDir, submodulePath)
      : outputDir;
    
    if (workingDir !== process.cwd()) {
      console.log(chalk.gray(`   cd ${path.relative(process.cwd(), workingDir)}`));
    }
    
    console.log(chalk.gray('   # Review and edit configuration:'));
    console.log(chalk.gray('   cat .tract/config.yaml\n'));
    
    if (metadata.components.length > 0) {
      console.log(chalk.gray('   # Map component paths:'));
      console.log(chalk.gray(`   tract map-components --tract ${workingDir} --code <code-dir>\n`));
    }
    
    if (!importTickets) {
      console.log(chalk.gray('   # Import existing Jira issues:'));
      console.log(chalk.gray(`   tract import --tract ${workingDir}\n`));
    }
    
    if (isSubmoduleMode) {
      console.log(chalk.gray('   # Tickets are in a submodule - LLM handles git operations'));
      console.log(chalk.gray(`   # Client exports (git archive) will exclude ${submodulePath}/\n`));
    }
    
    console.log(chalk.gray('   # Use Copilot CLI with SCHEMA.md as your ticket interface'));
    console.log(chalk.gray(`   # LLM replaces the web UI, Git replaces the database\n`));

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
