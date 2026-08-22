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
    console.log(chalk.white('  1. Clone a project from your team\'s catalog:'));
    console.log(chalk.gray('     tract catalog list             # see what\'s available'));
    console.log(chalk.gray('     tract clone <PROJECT>          # clone it + dependencies\n'));
    console.log(chalk.white('  2. Clone an existing ticket repo manually:'));
    console.log(chalk.gray('     git clone <your-tract-repo-url>'));
    console.log(chalk.gray('     cd <repo-name>'));
    console.log(chalk.gray('     tract doctor\n'));
    console.log(chalk.white('  3. Create a new project with Jira sync:'));
    console.log(chalk.gray('     mkdir my-tickets && cd my-tickets'));
    console.log(chalk.gray('     tract onboard --jira <url> --project <KEY>\n'));
    console.log(chalk.white('  4. Create a local-only project:'));
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
  
  // 5. Tickets directory exists
  check('Tickets directory exists', () => {
    const { listTicketFiles } = require('../lib/ticket-loader');
    const ticketsDir = path.join(tractDir, 'tickets');
    const issuesDir = path.join(tractDir, 'issues');

    const ticketsExists = fs.existsSync(ticketsDir);
    const issuesExists = fs.existsSync(issuesDir);

    if (!ticketsExists && !issuesExists) {
      return {
        status: 'warning',
        message: 'tickets/ directory not found',
        fix: 'mkdir tickets && git add tickets && git commit -m "Add tickets directory"'
      };
    }

    const ticketsCount = ticketsExists ? listTicketFiles(ticketsDir).length : 0;
    const issuesCount = issuesExists ? listTicketFiles(issuesDir).length : 0;

    const counts = [];
    if (ticketsExists) counts.push(`${ticketsCount} in tickets/`);
    if (issuesExists) counts.push(`${issuesCount} in issues/`);

    const total = ticketsCount + issuesCount;
    if (total === 0) {
      return { status: 'info', message: `No tickets yet (${counts.join(', ')})` };
    }

    return { status: 'info', message: `${total} ticket(s) found (${counts.join(', ')})` };
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
  
  // 10. Catalog server configured
  const yaml = require('js-yaml');
  const globalConfigPath = path.join(process.env.HOME, '.tract', 'config.yaml');
  let catalogServerUrl = null;
  check('Catalog server configured', () => {
    if (!fs.existsSync(globalConfigPath)) {
      return {
        status: 'info',
        message: 'No catalog server set (run: tract catalog set <url>)'
      };
    }
    const globalConfig = yaml.load(fs.readFileSync(globalConfigPath, 'utf8')) || {};
    catalogServerUrl = globalConfig.catalog_server;
    if (!catalogServerUrl) {
      return {
        status: 'info',
        message: 'No catalog server set (run: tract catalog set <url>)'
      };
    }
    return { status: 'info', message: catalogServerUrl };
  });

  // 11. Catalog server reachable (if configured)
  if (catalogServerUrl) {
    check('Catalog server reachable', () => {
      const mod = catalogServerUrl.startsWith('https') ? require('https') : require('http');
      return new Promise((resolve, reject) => {
        const req = mod.get(`${catalogServerUrl}/version`, { timeout: 5000 }, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const { version } = JSON.parse(body);
                resolve({ status: 'info', message: `serving tract v${version}` });
              } catch {
                resolve({ status: 'info', message: 'reachable' });
              }
            } else {
              resolve({ status: 'warning', message: `server returned ${res.statusCode}`,
                fix: `curl ${catalogServerUrl}/version` });
            }
          });
        });
        req.on('error', (err) => {
          const error = new Error(`Cannot reach catalog server: ${err.message}`);
          error.fix = `Check the server is running: curl ${catalogServerUrl}/version`;
          reject(error);
        });
        req.on('timeout', () => {
          req.destroy();
          const error = new Error('Catalog server timed out (5s)');
          error.fix = `Check: curl ${catalogServerUrl}/version`;
          reject(error);
        });
      });
    });
  }

  // 13. Check for old .arij directory (migration warning)
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
  
  // 14. Check worklogs directory
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
  
  // 15. Check for ticket body mentions not reflected in links frontmatter
  check('Ticket mention consistency (body → links)', () => {
    const { findWorkspace, loadProjectDirs, findTicketsDir, listTicketFiles } = require('../lib/ticket-loader');

    // Discover ticket directories using the same logic as serve/board
    let projectDirs;
    const workspaceRoot = findWorkspace(tractDir);
    if (workspaceRoot) {
      projectDirs = loadProjectDirs(workspaceRoot, null);
    } else {
      const ticketsDir = findTicketsDir(tractDir);
      projectDirs = ticketsDir ? [{ ticketsDir, prefix: null, name: 'default' }] : [];
    }

    if (projectDirs.length === 0) {
      return { status: 'info', message: 'No ticket directories found to scan' };
    }

    const TICKET_RE = /\b([A-Z]+-\d+)\b/g;
    const unlinked = [];

    for (const proj of projectDirs) {
      if (!fs.existsSync(proj.ticketsDir)) continue;
      const files = listTicketFiles(proj.ticketsDir);

      for (const { path: filePath } of files) {
        const content = fs.readFileSync(filePath, 'utf8');
        // Extract body (everything after the closing --- of frontmatter)
        const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
        if (!bodyMatch) continue;
        const body = bodyMatch[1];

        // Parse frontmatter
        let frontmatter;
        try {
          const fmMatch = content.match(/^---([\s\S]*?)\n---/);
          if (!fmMatch) continue;
          frontmatter = yaml.load(fmMatch[1]) || {};
        } catch { continue; }

        const ticketId = (frontmatter.id || '').toUpperCase();
        if (!ticketId) continue;

        // Collect all ticket IDs mentioned in the body (excluding self)
        const mentions = new Set();
        TICKET_RE.lastIndex = 0;
        let m;
        while ((m = TICKET_RE.exec(body)) !== null) {
          if (m[1].toUpperCase() !== ticketId) mentions.add(m[1].toUpperCase());
        }
        if (mentions.size === 0) continue;

        // Collect all explicitly linked ticket IDs from frontmatter
        const linked = new Set();
        if (Array.isArray(frontmatter.links)) {
          for (const link of frontmatter.links) {
            if (link.ref) linked.add(String(link.ref).toUpperCase());
          }
        }
        // Shorthand fields also count as links
        if (frontmatter.blocked_by) linked.add(String(frontmatter.blocked_by).toUpperCase());
        if (frontmatter.blocks) linked.add(String(frontmatter.blocks).toUpperCase());
        if (frontmatter.moved_to) linked.add(String(frontmatter.moved_to).toUpperCase());
        if (frontmatter.moved_from) linked.add(String(frontmatter.moved_from).toUpperCase());
        // Epic has its own field — don't require it in links too
        if (frontmatter.epic) linked.add(String(frontmatter.epic).toUpperCase());

        for (const mentioned of mentions) {
          if (!linked.has(mentioned)) {
            unlinked.push({ ticketId, mentioned });
          }
        }
      }
    }

    if (unlinked.length === 0) return true;

    const lines = unlinked.slice(0, 5).map(u => `${u.ticketId} mentions ${u.mentioned} (not in links frontmatter)`);
    const extra = unlinked.length > 5 ? ` (+${unlinked.length - 5} more)` : '';
    return {
      status: 'warning',
      message: `${unlinked.length} ticket(s) mention other tickets without a frontmatter link:\n    ${lines.join('\n    ')}${extra}\n  Fix: add links: [{rel: related_to, ref: TICKET-ID}] to frontmatter`
    };
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
