const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

/**
 * Tract Doctor - Health check and diagnostics
 * 
 * Checks:
 * - Git installation
 * - Tract repo structure
 * - Config validity
 * - Git remote setup
 * - Sync server connectivity (if configured)
 * - Common issues
 */

/**
 * Find tract project root by searching up directory tree
 * (like git does with .git/)
 */
function findTractRoot(startDir) {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;
  
  while (currentDir !== root) {
    const tractDir = path.join(currentDir, '.tract');
    if (fs.existsSync(tractDir)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}

async function doctor(options) {
  const startDir = path.resolve(options.tract || '.');
  const tractRoot = findTractRoot(startDir);
  
  // Not in a tract project - show friendly message and bail
  if (!tractRoot) {
    console.log(chalk.bold.cyan('\n🔍 Tract Doctor - Running diagnostics\n'));
    console.log(chalk.gray(`Directory: ${startDir}\n`));
    console.log(chalk.yellow('⚠ This doesn\'t look like a Tract project.\n'));
    console.log(chalk.white('To use Tract, either:\n'));
    console.log(chalk.white('  1. Clone an existing ticket repo:'));
    console.log(chalk.gray('     git clone <your-tract-repo-url>'));
    console.log(chalk.gray('     cd <repo-name>'));
    console.log(chalk.gray('     tract doctor\n'));
    console.log(chalk.white('  2. Create a new project with Jira sync:'));
    console.log(chalk.gray('     mkdir my-tickets && cd my-tickets'));
    console.log(chalk.gray('     tract onboard --jira <url> --project <KEY>\n'));
    console.log(chalk.white('  3. Create a local-only project:'));
    console.log(chalk.gray('     mkdir my-tickets && cd my-tickets'));
    console.log(chalk.gray('     tract onboard --project <KEY> --local\n'));
    console.log(chalk.gray('Run \'tract doctor\' inside a Tract project for full diagnostics.\n'));
    process.exit(1);
  }
  
  const tractDir = tractRoot;
  
  console.log(chalk.bold.cyan('\n🔍 Tract Doctor - Running diagnostics\n'));
  console.log(chalk.gray(`Directory: ${tractDir}\n`));
  
  const checks = [];
  let issuesFound = 0;
  let warningsFound = 0;
  
  // Helper to run checks
  const check = (name, fn) => {
    try {
      const result = fn();
      if (result === true) {
        console.log(chalk.green('✓'), chalk.white(name));
        checks.push({ name, status: 'pass' });
      } else if (result && result.status === 'warning') {
        console.log(chalk.yellow('⚠'), chalk.white(name));
        if (result.message) console.log(chalk.yellow(`  ${result.message}`));
        if (result.fix) console.log(chalk.gray(`  Fix: ${result.fix}`));
        checks.push({ name, status: 'warning', ...result });
        warningsFound++;
      } else if (result && result.status === 'info') {
        console.log(chalk.blue('ℹ'), chalk.white(name));
        if (result.message) console.log(chalk.blue(`  ${result.message}`));
        checks.push({ name, status: 'info', ...result });
      }
    } catch (err) {
      console.log(chalk.red('✗'), chalk.white(name));
      console.log(chalk.red(`  ${err.message}`));
      if (err.fix) console.log(chalk.gray(`  Fix: ${err.fix}`));
      checks.push({ name, status: 'fail', error: err.message, fix: err.fix });
      issuesFound++;
    }
  };
  
  // 1. Git installed
  check('Git installed', () => {
    try {
      const version = execSync('git --version', { encoding: 'utf8' }).trim();
      return { status: 'info', message: version };
    } catch (err) {
      const error = new Error('Git not found in PATH');
      error.fix = 'Install git: https://git-scm.com/downloads';
      throw error;
    }
  });
  
  // 2. Is this a git repo?
  check('Git repository initialized', () => {
    if (!fs.existsSync(path.join(tractDir, '.git'))) {
      const error = new Error('Not a git repository');
      error.fix = `cd ${tractDir} && git init`;
      throw error;
    }
    return true;
  });
  
  // 3. Tract config exists
  check('Tract config directory exists', () => {
    const tractConfigDir = path.join(tractDir, '.tract');
    if (!fs.existsSync(tractConfigDir)) {
      const error = new Error('.tract/ directory missing');
      error.fix = 'Run: tract onboard --jira <url> --project <KEY>';
      throw error;
    }
    return true;
  });
  
  // 4. Config file valid
  check('Tract config file valid', () => {
    const configPath = path.join(tractDir, '.tract', 'config.yaml');
    if (!fs.existsSync(configPath)) {
      const error = new Error('.tract/config.yaml missing');
      error.fix = 'Run: tract onboard --jira <url> --project <KEY>';
      throw error;
    }
    
    const yaml = require('js-yaml');
    try {
      const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
      if (!config.project) {
        const error = new Error('config.yaml missing "project" field');
        error.fix = 'Check .tract/config.yaml structure';
        throw error;
      }
      return { status: 'info', message: `Project: ${config.project}` };
    } catch (err) {
      const error = new Error(`Invalid YAML: ${err.message}`);
      error.fix = 'Check .tract/config.yaml syntax';
      throw error;
    }
  });
  
  // 5. Issues directory exists
  check('Issues directory exists', () => {
    const issuesDir = path.join(tractDir, 'issues');
    if (!fs.existsSync(issuesDir)) {
      return {
        status: 'warning',
        message: 'issues/ directory not found',
        fix: 'mkdir issues && git add issues && git commit -m "Add issues directory"'
      };
    }
    
    const tickets = fs.readdirSync(issuesDir).filter(f => f.endsWith('.md'));
    if (tickets.length === 0) {
      return {
        status: 'info',
        message: 'No tickets yet (empty issues/ directory)'
      };
    }
    
    return { status: 'info', message: `${tickets.length} ticket(s) found` };
  });
  
  // 6. Git user configured
  check('Git user configured', () => {
    try {
      const name = execSync('git config user.name', { encoding: 'utf8', cwd: tractDir }).trim();
      const email = execSync('git config user.email', { encoding: 'utf8', cwd: tractDir }).trim();
      
      if (!name || !email) {
        return {
          status: 'warning',
          message: 'Git user not configured',
          fix: 'git config user.name "Your Name" && git config user.email "you@example.com"'
        };
      }
      
      return { status: 'info', message: `${name} <${email}>` };
    } catch (err) {
      return {
        status: 'warning',
        message: 'Git user not configured',
        fix: 'git config user.name "Your Name" && git config user.email "you@example.com"'
      };
    }
  });
  
  // 7. Git remote configured
  check('Git remote configured', () => {
    try {
      const remotes = execSync('git remote -v', { encoding: 'utf8', cwd: tractDir }).trim();
      if (!remotes) {
        return {
          status: 'warning',
          message: 'No git remote configured',
          fix: 'git remote add origin <url> (e.g., ssh://git@server/path/to/tickets.git)'
        };
      }
      
      const lines = remotes.split('\n');
      const origin = lines.find(l => l.startsWith('origin'));
      if (origin) {
        const url = origin.split(/\s+/)[1];
        return { status: 'info', message: `origin → ${url}` };
      }
      
      return { status: 'info', message: remotes };
    } catch (err) {
      return {
        status: 'warning',
        message: 'Could not read git remotes',
        fix: 'git remote add origin <url>'
      };
    }
  });
  
  // 8. Sync server environment variable
  check('Sync server configured', () => {
    const serverUrl = process.env.TRACT_SYNC_SERVER;
    if (!serverUrl) {
      return {
        status: 'warning',
        message: 'TRACT_SYNC_SERVER not set (optional for local-only use)',
        fix: 'export TRACT_SYNC_SERVER=http://your-server:3100'
      };
    }
    return { status: 'info', message: serverUrl };
  });
  
  // 9. Sync server connectivity (if configured)
  if (process.env.TRACT_SYNC_SERVER) {
    check('Sync server reachable', () => {
      const serverUrl = process.env.TRACT_SYNC_SERVER;
      try {
        const https = serverUrl.startsWith('https') ? require('https') : require('http');
        const url = new URL(serverUrl + '/health');
        
        return new Promise((resolve, reject) => {
          const req = https.get(url, { timeout: 5000 }, (res) => {
            if (res.statusCode === 200) {
              resolve({ status: 'info', message: 'Server healthy' });
            } else {
              resolve({
                status: 'warning',
                message: `Server returned ${res.statusCode}`,
                fix: 'Check server logs: journalctl -u tract-sync -n 50'
              });
            }
          });
          
          req.on('error', (err) => {
            const error = new Error(`Cannot reach server: ${err.message}`);
            error.fix = 'Check TRACT_SYNC_SERVER URL and server status';
            reject(error);
          });
          
          req.on('timeout', () => {
            req.destroy();
            const error = new Error('Connection timeout (5s)');
            error.fix = 'Check server is running: systemctl status tract-sync';
            reject(error);
          });
        });
      } catch (err) {
        const error = new Error(`Invalid server URL: ${err.message}`);
        error.fix = 'Check TRACT_SYNC_SERVER format (e.g., http://server:3100)';
        throw error;
      }
    });
  }
  
  // 10. Check for old .arij directory (migration warning)
  check('Migration check (.arij → .tract)', () => {
    const arijDir = path.join(tractDir, '.arij');
    if (fs.existsSync(arijDir)) {
      return {
        status: 'warning',
        message: 'Old .arij/ directory found (Arij → Tract migration incomplete)',
        fix: 'Move .arij/ contents to .tract/ if needed, then: rm -rf .arij/'
      };
    }
    return true;
  });
  
  // 11. Check worklogs directory
  check('Worklogs directory', () => {
    const worklogsDir = path.join(tractDir, 'worklogs');
    if (!fs.existsSync(worklogsDir)) {
      return {
        status: 'info',
        message: 'worklogs/ not found (created when logging time)'
      };
    }
    
    const files = fs.readdirSync(worklogsDir).filter(f => f.endsWith('.jsonl'));
    if (files.length === 0) {
      return { status: 'info', message: 'No time logged yet' };
    }
    
    return { status: 'info', message: `${files.length} worklog file(s)` };
  });
  
  // Summary
  console.log();
  console.log(chalk.bold('─'.repeat(60)));
  
  const passed = checks.filter(c => c.status === 'pass').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const failures = checks.filter(c => c.status === 'fail').length;
  const info = checks.filter(c => c.status === 'info').length;
  
  console.log(chalk.bold('Summary:'));
  console.log(`  ${chalk.green('✓ ' + passed + ' passed')}`);
  if (info > 0) console.log(`  ${chalk.blue('ℹ ' + info + ' info')}`);
  if (warnings > 0) console.log(`  ${chalk.yellow('⚠ ' + warnings + ' warnings')}`);
  if (failures > 0) console.log(`  ${chalk.red('✗ ' + failures + ' failed')}`);
  
  console.log();
  
  if (failures === 0 && warnings === 0) {
    console.log(chalk.green.bold('✓ All checks passed! Tract is healthy.\n'));
    process.exit(0);
  } else if (failures === 0) {
    console.log(chalk.yellow('⚠ Warnings found, but nothing critical.\n'));
    console.log(chalk.gray('Review warnings above and fix if needed.\n'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold('✗ Issues found. Fix errors above before using Tract.\n'));
    console.log(chalk.gray('Need help? Check docs: https://github.com/johnmcmullan/tract\n'));
    process.exit(1);
  }
}

module.exports = doctor;
