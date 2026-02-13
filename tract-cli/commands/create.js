const axios = require('axios');
const chalk = require('chalk');

async function create(project, options) {
  try {
    // Get sync server URL
    const serverUrl = options.server || process.env.TRACT_SYNC_SERVER;
    if (!serverUrl) {
      console.error(chalk.red('❌ Sync server URL required'));
      console.error(chalk.gray('Set TRACT_SYNC_SERVER env var or use --server option'));
      console.error(chalk.gray('Example: export TRACT_SYNC_SERVER=http://reek:3100'));
      process.exit(1);
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
    } else if (error.request) {
      console.error(chalk.red(`\n❌ Could not reach sync server at ${serverUrl}`));
      console.error(chalk.gray('   Is the service running?'));
    } else {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
    }
    process.exit(1);
  }
}

module.exports = create;
