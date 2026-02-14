const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function create(project, options) {
  try {
    // Get sync server URL
    const serverUrl = options.server || process.env.TRACT_SYNC_SERVER;
    
    // If no sync server, create locally
    if (!serverUrl) {
      return await createLocally(project, options);
    }

    // Prepare request
    const payload = {
      title: options.title,
      type: options.type,
      priority: options.priority,
      assignee: options.assignee,
      description: options.description,
      components: options.components ? options.components.split(',').map(c => c.trim()) : undefined,
      labels: options.labels ? options.labels.split(',').map(l => l.trim()) : undefined
    };

    console.log(chalk.cyan(`\n📝 Creating ticket in ${project}...`));
    if (options.title) {
      console.log(chalk.gray(`   Title: ${options.title}`));
    }
    if (options.type) {
      console.log(chalk.gray(`   Type: ${options.type}`));
    }

    // Post to sync server
    const response = await axios.post(
      `${serverUrl}/create/${project}`,
      payload,
      { timeout: 10000 }
    );

    const { issueKey, status, queued } = response.data;

    if (status === 'created') {
      console.log(chalk.green(`\n✅ Created ${issueKey}`));
      console.log(chalk.gray(`   File: issues/${issueKey}.md`));
      console.log(chalk.gray(`   Synced to Jira and committed to git`));
    } else if (status === 'offline') {
      console.log(chalk.yellow(`\n⏸️  Created ${issueKey} (offline)`));
      console.log(chalk.gray(`   File: issues/${issueKey}.md`));
      console.log(chalk.gray(`   Jira is unavailable - queued for sync when online`));
      console.log(chalk.gray(`   Temporary ID will be updated to real Jira ID automatically`));
    }

    console.log(chalk.cyan(`\n🔗 Edit: issues/${issueKey}.md`));

  } catch (error) {
    if (error.response) {
      console.error(chalk.red(`\n❌ Server error: ${error.response.data.error || error.message}`));
      if (error.response.status === 404) {
        console.error(chalk.yellow(`\n💡 Tip: Check the server URL and project key`));
        console.error(chalk.gray(`   Server: ${serverUrl}`));
        console.error(chalk.gray(`   Project: ${project}`));
      }
    } else if (error.request) {
      console.error(chalk.red(`\n❌ Could not reach sync server at ${serverUrl}`));
      console.error(chalk.yellow(`\n💡 Troubleshooting:`));
      console.error(chalk.gray(`   1. Is the service running? ssh tract-server systemctl status tract-sync`));
      console.error(chalk.gray(`   2. Is the URL correct? Try: curl ${serverUrl}/health`));
      console.error(chalk.gray(`   3. Are you on the right network/VPN?`));
      console.error(chalk.gray(`\n   For local-only use (no server), edit tickets directly in issues/`));
    } else {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
    }
    process.exit(1);
  }
}

async function createLocally(project, options) {
  // Local-only ticket creation (no sync server)
  const issuesDir = path.resolve('issues');
  
  // Check if issues/ exists
  if (!fs.existsSync(issuesDir)) {
    console.error(chalk.red('❌ issues/ directory not found'));
    console.error(chalk.yellow('💡 Are you in a Tract project directory?'));
    console.error(chalk.gray('   Run: tract doctor'));
    process.exit(1);
  }
  
  // Find next ticket ID
  const files = fs.readdirSync(issuesDir).filter(f => f.endsWith('.md'));
  let nextId = 1;
  
  if (files.length > 0) {
    // Extract numbers from existing tickets
    const numbers = files
      .map(f => f.replace(`${project}-`, '').replace('.md', ''))
      .map(n => parseInt(n))
      .filter(n => !isNaN(n));
    
    if (numbers.length > 0) {
      nextId = Math.max(...numbers) + 1;
    }
  }
  
  const issueKey = `${project}-${nextId}`;
  const filename = path.join(issuesDir, `${issueKey}.md`);
  
  // Check if file already exists
  if (fs.existsSync(filename)) {
    console.error(chalk.red(`❌ Ticket ${issueKey} already exists`));
    process.exit(1);
  }
  
  // Get git user for assignee default
  let gitUser = options.assignee;
  if (!gitUser) {
    try {
      gitUser = execSync('git config user.name', { encoding: 'utf8' }).trim();
    } catch (err) {
      gitUser = null;
    }
  }
  
  // Build frontmatter
  const now = new Date().toISOString();
  const frontmatter = {
    id: issueKey,
    title: options.title,
    type: options.type || 'task',
    status: 'backlog',
    priority: options.priority || 'medium',
    created: now,
  };
  
  if (gitUser) frontmatter.assignee = gitUser;
  if (options.components) {
    frontmatter.components = options.components.split(',').map(c => c.trim());
  }
  if (options.labels) {
    frontmatter.labels = options.labels.split(',').map(l => l.trim());
  }
  
  // Build markdown content
  const yaml = require('js-yaml');
  let content = '---\n';
  content += yaml.dump(frontmatter, { lineWidth: -1 });
  content += '---\n\n';
  
  if (options.description) {
    content += `# Description\n\n${options.description}\n\n`;
  } else {
    content += `# Description\n\nAdd description here.\n\n`;
  }
  
  content += `## Tasks\n\n`;
  content += `- [ ] Task 1\n`;
  content += `- [ ] Task 2\n\n`;
  
  content += `## Notes\n\n`;
  content += `Additional context and notes.\n`;
  
  // Write file
  fs.writeFileSync(filename, content);
  
  console.log(chalk.cyan(`\n📝 Created ticket locally`));
  console.log(chalk.gray(`   ID: ${issueKey}`));
  console.log(chalk.gray(`   File: issues/${issueKey}.md`));
  
  // Commit to git
  try {
    execSync(`git add "${filename}"`, { stdio: 'pipe' });
    execSync(`git commit -m "Create ${issueKey}: ${options.title}"`, { stdio: 'pipe' });
    console.log(chalk.green(`\n✅ Created ${issueKey}`));
    console.log(chalk.gray(`   Committed to git`));
  } catch (err) {
    console.log(chalk.yellow(`\n⚠️  Created ${issueKey} (not committed)`));
    console.log(chalk.gray(`   File created but git commit failed`));
    console.log(chalk.gray(`   Commit manually: git add issues/${issueKey}.md && git commit`));
  }
  
  console.log(chalk.cyan(`\n🔗 Edit: issues/${issueKey}.md`));
  console.log(chalk.gray(`   View: cat issues/${issueKey}.md`));
  
  if (!options.server && !process.env.TRACT_SYNC_SERVER) {
    console.log(chalk.gray(`\n💡 This is a local-only ticket (no Jira sync)`));
    console.log(chalk.gray(`   To enable sync, set TRACT_SYNC_SERVER`));
  }
}

module.exports = create;
