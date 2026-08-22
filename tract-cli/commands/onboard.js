const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, execFileSync } = require('child_process');
const chalk = require('chalk');
const ora = require('ora');
const { prompt } = require('enquirer');
const JiraClient = require('../lib/jira-client');
const ConfigGenerator = require('../lib/config-generator');
const TicketImporter = require('../lib/ticket-importer');
const { loadServerEnv, parseEnvFile } = require('../lib/server-env');


/**
 * Setup ~/.tract/ as a git repository for shared cross-project metadata.
 * Holds sprints/, worklogs/, and a gitignored config.yaml.
 * Can be cloned from an existing remote or initialized fresh.
 */
async function setupTractHome(remoteUrl) {
  const tractHome = path.join(os.homedir(), '.tract');

  // Already a git repo — nothing to do
  if (fs.existsSync(path.join(tractHome, '.git'))) {
    return { status: 'exists', path: tractHome };
  }

  if (remoteUrl) {
    // Clone shared metadata repo
    try {
      execFileSync('git', ['clone', remoteUrl, tractHome], { stdio: 'pipe' });
      return { status: 'cloned', path: tractHome, url: remoteUrl };
    } catch (err) {
      return { status: 'error', message: `Failed to clone: ${err.message}` };
    }
  }

  // Initialize fresh
  try {
    fs.mkdirSync(path.join(tractHome, 'sprints'),  { recursive: true });
    fs.mkdirSync(path.join(tractHome, 'worklogs'), { recursive: true });

    execSync('git init', { cwd: tractHome, stdio: 'pipe' });

    // Machine-local files — never committed
    fs.writeFileSync(path.join(tractHome, '.gitignore'), 'config.yaml\njira-rates.json\n');

    // JSONL worklog files use git's union merge driver — no conflicts on concurrent push
    fs.writeFileSync(path.join(tractHome, '.gitattributes'), '*.jsonl merge=union\n');

    execSync('git add .gitignore .gitattributes sprints worklogs', { cwd: tractHome, stdio: 'pipe' });
    execSync('git commit -m "Initialize ~/.tract shared metadata"', { cwd: tractHome, stdio: 'pipe' });

    return { status: 'initialized', path: tractHome };
  } catch (err) {
    return { status: 'error', message: `Failed to initialize ~/.tract: ${err.message}` };
  }
}

async function onboard(options) {
  console.log(chalk.bold.cyan('\n🚀 Tract Onboarding\n'));

  // Interactive mode - gather all inputs via prompts
  if (options.interactive) {
    console.log(chalk.gray('Interactive setup - I\'ll ask a few questions.\n'));
    
    const answers = await prompt([
      {
        type: 'input',
        name: 'projectKey',
        message: 'Project key (e.g., APP, TB)',
        initial: options.project || '',
        validate: (val) => val.length >= 2 || 'Project key required (2+ chars)'
      },
      {
        type: 'select',
        name: 'mode',
        message: 'Setup mode',
        choices: [
          { name: 'local', message: 'Local-only (no Jira sync)', value: 'local' },
          { name: 'jira', message: 'Connect to Jira', value: 'jira' }
        ],
        initial: options.local ? 0 : (options.jira ? 1 : 0)
      },
      {
        type: 'input',
        name: 'jiraUrl',
        message: 'Jira URL (e.g., https://jira.company.com)',
        initial: options.jira || '',
        skip() { return this.state.answers.mode === 'local'; },
        validate: (val) => val.startsWith('http') || 'Must be a valid URL'
      },
      {
        type: 'input',
        name: 'username',
        message: 'Jira username',
        initial: options.user || process.env.JIRA_USERNAME || '',
        skip() { return this.state.answers.mode === 'local'; },
        validate: (val) => val.length > 0 || 'Username required'
      },
      {
        type: 'password',
        name: 'token',
        message: 'Jira API token (or leave blank to use JIRA_TOKEN env var)',
        initial: '',
        skip() { 
          return this.state.answers.mode === 'local' || process.env.JIRA_TOKEN;
        }
      },
      {
        type: 'input',
        name: 'outputDir',
        message: 'Output directory',
        initial: options.output || '.',
        validate: (val) => val.length > 0 || 'Output directory required'
      },
      {
        type: 'confirm',
        name: 'importTickets',
        message: 'Import existing tickets?',
        initial: false,
        skip() { return this.state.answers.mode === 'local'; }
      },
      {
        type: 'input',
        name: 'worklogRepo',
        message: 'Worklog repository URL (or leave blank to skip)',
        initial: options.worklogRepo || '',
        skip() { return this.state.answers.mode === 'local'; }
      }
    ]);
    
    // Map answers back to options format
    options.project = answers.projectKey.toUpperCase();
    options.local = answers.mode === 'local';
    options.jira = answers.jiraUrl;
    options.user = answers.username;
    options.token = answers.token || process.env.JIRA_TOKEN;
    options.output = answers.outputDir;
    options.importTickets = answers.importTickets;
    options.worklogRepo = answers.worklogRepo;
    
    console.log();
  }

  // Validate inputs
  const isLocal = options.local;
  const projectKey = options.project ? options.project.toUpperCase() : null;
  
  if (!projectKey) {
    console.error(chalk.red('❌ Error: --project required (or use --interactive)'));
    process.exit(1);
  }
  let outputDir = path.resolve(options.output);

  // Load stored credentials from the server env file if present
  // (allows `tract onboard --project SERV` on a server without re-specifying credentials)
  const serverEnvData = loadServerEnv(outputDir);
  const serverEnvCandidates = ['/etc/tract-sync/env', path.join(outputDir, 'bin', 'env')];

  const jiraUrl = options.jira || serverEnvData.jiraUrl;
  const submodulePath = options.submodule;
  const remoteUrl = options.remote;
  const isSubmoduleMode = !!submodulePath;
  const importTickets = options.importTickets;
  const ticketLimit = options.limit ? parseInt(options.limit) : null;

  // Local-only mode: no Jira required
  if (isLocal) {
    console.log(chalk.bold.cyan('📦 Local-Only Mode\n'));
    console.log(chalk.gray(`Creating local Tract project without Jira sync...\n`));
    
    // Create directory structure
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const ticketsDir = path.join(outputDir, 'tickets');
    const worklogsDir = path.join(outputDir, 'worklogs');
    const tractDir = path.join(outputDir, '.tract');
    
    fs.mkdirSync(ticketsDir, { recursive: true });
    fs.mkdirSync(worklogsDir, { recursive: true });
    fs.mkdirSync(tractDir, { recursive: true });
    
    // Create config.yaml with sensible defaults
    const configPath = path.join(tractDir, 'config.yaml');
    const configContent = `# Tract Configuration
# Project: ${projectKey}

project: ${projectKey}

# Issue types - common ticket categories
types: [bug, story, task, epic]

# Workflow statuses - customize as needed
statuses: [backlog, todo, in-progress, review, done]

# Priority levels
priorities: [trivial, minor, major, critical, blocker]

# Jira sync (optional - configure later)
jira:
  url: null  # Add Jira URL later to enable sync
  project: ${projectKey}

sync:
  enabled: false  # Set to true when Jira is configured

# Default values for new tickets
defaults:
  type: task
  status: backlog
  priority: medium
`;
    fs.writeFileSync(configPath, configContent);
    
    // Create minimal SCHEMA.md
    const schemaPath = path.join(tractDir, 'SCHEMA.md');
    const schemaContent = `# Tract Schema - ${projectKey}

Local-only project. Add Jira configuration to .tract/config.yaml to enable sync.

See: https://github.com/johnmcmullan/tract
`;
    fs.writeFileSync(schemaPath, schemaContent);
    
    console.log(chalk.green('✓ Project structure created'));


    // Initialize git
    try {
      if (!fs.existsSync(path.join(outputDir, '.git'))) {
        execSync('git init', { cwd: outputDir, stdio: 'pipe' });
      }
      execSync('git add .', { cwd: outputDir, stdio: 'pipe' });
      execSync(`git commit -m "Initial commit: ${projectKey} (local-only)"`, { 
        cwd: outputDir, 
        stdio: 'pipe' 
      });
      console.log(chalk.green('✓ Git repository initialized'));
    } catch (err) {
      console.log(chalk.yellow('⚠ Git initialization failed (non-fatal)'));
    }

    console.log(chalk.bold.green('\n✅ Local project created!\n'));
    console.log(chalk.bold('Next steps:\n'));
    console.log(chalk.gray(`   cd ${path.relative(process.cwd(), outputDir)}`));
    console.log(chalk.gray(`   tract create ${projectKey} --title "My first ticket"`));
    console.log(chalk.gray('   tract serve                 # open http://localhost:7766\n'));

    return;
  }

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

  // Validate Jira mode requirements
  if (!jiraUrl) {
    console.error(chalk.red('❌ Error: --jira <url> required (or use --local for local-only project)'));
    process.exit(1);
  }

  // Get credentials — fall back to server env, then process env
  const username = options.user || serverEnvData.username || process.env.JIRA_USERNAME;
  const token = options.token || serverEnvData.token || process.env.JIRA_TOKEN;
  const password = options.password || process.env.JIRA_PASSWORD;

  if (!token && !password) {
    console.error(chalk.red('❌ Error: --token or --password required, or set JIRA_TOKEN/JIRA_PASSWORD'));
    if (serverEnvCandidates.some(f => fs.existsSync(f))) {
      console.error(chalk.yellow('   (JIRA_API_TOKEN not found in server env file)'));
    }
    process.exit(1);
  }

  // Detect if outputDir (or its parent) is an existing tract server root.
  // Handles two cases:
  //   1. `tract onboard` run from the server root → redirect to <root>/<PROJECT>
  //   2. `tract onboard` run from inside <root>/<PROJECT> → use parent as server root
  function isTractServerDir(dir) {
    try {
      return fs.readdirSync(dir).some(f => fs.existsSync(path.join(dir, f, '.tract', 'config.yaml')));
    } catch (_) { return false; }
  }

  let serverRootDir = null;
  if (!isSubmoduleMode) {
    if (fs.existsSync(outputDir) && fs.readdirSync(outputDir).filter(f => f !== '.git').length > 0) {
      if (isTractServerDir(outputDir)) {
        // Running from the server root itself
        serverRootDir = outputDir;
        outputDir = path.join(serverRootDir, projectKey);
        console.log(chalk.cyan(`ℹ  Detected existing tract server at ${serverRootDir}`));
        console.log(chalk.cyan(`   Adding ${projectKey} as new project → ${outputDir}\n`));
      } else if (isTractServerDir(path.dirname(outputDir))) {
        // Running from inside a project dir within a server (e.g. ~/SERV)
        serverRootDir = path.dirname(outputDir);
        console.log(chalk.cyan(`ℹ  Detected existing tract server at ${serverRootDir}`));
        console.log(chalk.cyan(`   Onboarding ${projectKey} in place at ${outputDir}\n`));
      } else {
        console.error(chalk.red(`❌ Error: Directory not empty: ${outputDir}`));
        console.error(chalk.yellow(`   Remove files or use a different --output directory`));
        process.exit(1);
      }
    }
  }

  // Create output directory if needed
  if (!fs.existsSync(outputDir)) {
    if (!isSubmoduleMode) {
      console.log(chalk.yellow(`📁 Creating directory: ${outputDir}`));
    }
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (!isSubmoduleMode) {
    console.log(chalk.gray(`Jira URL: ${jiraUrl}`));
    console.log(chalk.gray(`Project:  ${projectKey}`));
    console.log(chalk.gray(`Output:   ${outputDir}\n`));
  }

  const spinner = ora('Connecting to Jira...').start();

  try {
    // Create Jira client — omit username for bearer token (PAT) auth
    const auth = {
      username: username || '',
      password: token || password
    };
    const jira = new JiraClient(jiraUrl, auth);

    spinner.text = 'Fetching project metadata from Jira...';
    const metadata = await jira.getProjectMetadata(projectKey);

    spinner.succeed(chalk.green('✓ Metadata fetched successfully'));
    
    // Detect sprint field
    spinner.start('Detecting sprint field...');
    const sprintField = await jira.detectSprintField(projectKey);
    
    if (sprintField) {
      spinner.succeed(chalk.green(`✓ Sprint field detected: ${sprintField}`));
      metadata.sprintField = sprintField;
    } else {
      spinner.info(chalk.gray('No sprint field detected (will skip sprint sync)'));
    }

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
          execFileSync('git', ['remote', 'add', 'origin', remoteUrl], { cwd: outputDir, stdio: 'pipe' });
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
          execFileSync('git', ['submodule', 'add', remoteUrl, submodulePath], {
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

      const importer = new TicketImporter(jira, finalDir);
      const importResult = await importer.importTickets({
        status: 'all',
        limit: ticketLimit
      });

      // Commit imported tickets
      if (importResult.total > 0) {
        try {
          execSync('git add tickets/', { cwd: finalDir, stdio: 'pipe' });
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

    // Setup worklogs repository
    if (options.worklogRepo || options.worklogRepo === '') {
      const worklogSpinner = ora('Setting up worklogs repository...').start();
      const worklogResult = await setupWorklogs(options.worklogRepo || null);

      if (worklogResult.status === 'cloned') {
        worklogSpinner.succeed(chalk.green(`✓ Worklogs cloned from ${worklogResult.url}`));
        console.log(chalk.gray(`   Location: ${worklogResult.path}\n`));
      } else if (worklogResult.status === 'initialized') {
        worklogSpinner.succeed(chalk.green('✓ Worklogs repository initialized'));
        console.log(chalk.gray(`   Location: ${worklogResult.path}`));
        console.log(chalk.yellow('   💡 Add a remote to share worklogs with your team:'));
        console.log(chalk.gray(`      cd ${worklogResult.path}`));
        console.log(chalk.gray('      git remote add origin <worklog-repo-url>'));
        console.log(chalk.gray('      git push -u origin master\n'));
      } else if (worklogResult.status === 'exists') {
        worklogSpinner.info(chalk.gray('Worklogs repository already exists'));
        console.log(chalk.gray(`   Location: ${worklogResult.path}\n`));
      } else {
        worklogSpinner.fail(chalk.red('✗ Failed to setup worklogs'));
        console.log(chalk.yellow(`   ${worklogResult.message}`));
        console.log(chalk.gray('   You can manually setup worklogs later\n'));
      }
    }

    // If we added to an existing tract server, update the daemon env file
    if (serverRootDir) {
      const envCandidates = [
        '/etc/tract-sync/env',
        path.join(serverRootDir, 'bin', 'env'),
      ];
      let updatedEnv = false;
      for (const envFile of envCandidates) {
        if (fs.existsSync(envFile)) {
          try {
            let envContent = fs.readFileSync(envFile, 'utf8');
            const match = envContent.match(/^(JIRA_INCLUDE_PROJECTS=)(.+)$/m);
            if (match && !match[2].split(',').includes(projectKey)) {
              envContent = envContent.replace(
                /^(JIRA_INCLUDE_PROJECTS=)(.+)$/m,
                `$1${match[2]},${projectKey}`
              );
              fs.writeFileSync(envFile, envContent);
              console.log(chalk.green(`✓ Added ${projectKey} to JIRA_INCLUDE_PROJECTS in ${envFile}`));
              console.log(chalk.yellow(`  Restart the daemon to begin syncing: sudo systemctl restart tract-sync\n`));
              updatedEnv = true;
            } else if (match && match[2].split(',').includes(projectKey)) {
              console.log(chalk.gray(`  ${projectKey} already in JIRA_INCLUDE_PROJECTS in ${envFile}\n`));
              updatedEnv = true;
            }
            break;
          } catch (envErr) {
            // Permission denied — advise manually
            console.log(chalk.yellow(`⚠  Could not update ${envFile} (permission denied).`));
            console.log(chalk.gray(`   Run as root: sed -i 's/JIRA_INCLUDE_PROJECTS=.*/&,${projectKey}/' ${envFile}`));
            console.log(chalk.gray(`   Then: sudo systemctl reload tract-sync\n`));
            updatedEnv = true;
            break;
          }
        }
      }
      if (!updatedEnv) {
        console.log(chalk.yellow(`⚠  Could not find daemon env file. Add ${projectKey} to JIRA_INCLUDE_PROJECTS manually.`));
        console.log(chalk.gray(`   Then restart: sudo systemctl restart tract-sync\n`));
      }
    }

    // Success message
    const finalOutputDir = isSubmoduleMode
      ? path.join(parentRepoDir, submodulePath)
      : outputDir;
    const workingDir = finalOutputDir;

    console.log(chalk.bold.green('\n✅ Onboarding complete!\n'));
    console.log(chalk.bold('Next steps:\n'));

    if (workingDir !== process.cwd()) {
      console.log(chalk.gray(`   cd ${path.relative(process.cwd(), workingDir)}`));
    }

    if (serverRootDir) {
      console.log(chalk.yellow('   Reload the sync daemon to start pulling tickets:'));
      console.log(chalk.gray('     sudo systemctl reload tract-sync\n'));
    } else {
      if (!importTickets) {
        console.log(chalk.gray(`   tract import                # pull tickets from Jira`));
      }
    }

    if (metadata.components.length > 0) {
      console.log(chalk.gray(`   tract map-components        # map Jira components to code paths`));
      console.log(chalk.gray(`                               # (optional — skip straight to tract board)`));
    }

    console.log(chalk.gray(`   tract serve                 # open http://localhost:7766`));
    console.log(chalk.gray(`   tract board                 # terminal kanban board`));
    console.log(chalk.gray(`   tract doctor                # verify everything is healthy\n`));

    if (!serverRootDir) {
      console.log(chalk.bold('To enable live Jira sync:\n'));
      console.log(chalk.yellow('  Server admin — install the tract-sync daemon (requires sudo):'));
      console.log(chalk.gray('       See: tract-sync/README.md'));
      console.log(chalk.gray('       Or:  https://github.com/johnmcmullan/tract/tree/master/tract-sync\n'));
      console.log(chalk.gray('  Jira→git is poll-based (no webhook listener in the daemon).'));
      console.log(chalk.gray('  git→Jira: register with `tract auth`, edit ticket files or drafts,'));
      console.log(chalk.gray('  then `git push`. Use `tract clone --full` if you intend to push.\n'));
    }

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
