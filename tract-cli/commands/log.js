const axios = require('axios');
const { execSync } = require('child_process');
const chalk = require('chalk');

async function log(issue, time, comment, options) {
  try {
    // Get sync server URL
    const serverUrl = options.server || process.env.TRACT_SYNC_SERVER;
    if (!serverUrl) {
      console.error(chalk.red('❌ Sync server URL required'));
      console.error(chalk.gray('Set TRACT_SYNC_SERVER env var or use --server option'));
      console.error(chalk.gray('Example: export TRACT_SYNC_SERVER=http://tract-server:3100'));
      process.exit(1);
    }

    // Get author name (from git config if not specified)
    let author = options.author;
    if (!author) {
      try {
        author = execSync('git config user.name', { encoding: 'utf8' }).trim();
      } catch (error) {
        console.error(chalk.red('❌ Could not determine author name'));
        console.error(chalk.gray('Use --author option or configure git user.name'));
        process.exit(1);
      }
    }

    // Prepare request
    const payload = {
      author,
      time,
      comment: comment || '',
      started: options.started
    };

    console.log(chalk.cyan(`\n📝 Logging time to ${issue}...`));
    console.log(chalk.gray(`   Author: ${author}`));
    console.log(chalk.gray(`   Time:   ${time}`));
    if (comment) {
      console.log(chalk.gray(`   Work:   ${comment}`));
    }

    // Post to sync server
    const response = await axios.post(
      `${serverUrl}/worklog/${issue}`,
      payload,
      { timeout: 10000 }
    );

    console.log(chalk.green(`\n✅ Time logged successfully!`));
    console.log(chalk.gray(`   Entry: ${response.data.entry.started}`));
    console.log(chalk.gray(`   Synced to Jira and committed to git`));

  } catch (error) {
    if (error.response) {
      console.error(chalk.red(`\n❌ Server error: ${error.response.data.error || error.message}`));
      if (error.response.status === 404) {
        console.error(chalk.yellow(`\n💡 Tip: Ticket ${issue} might not exist`));
        console.error(chalk.gray(`   Check issue key is correct (e.g., APP-1234)`));
      }
    } else if (error.request) {
      console.error(chalk.red(`\n❌ Could not reach sync server at ${serverUrl}`));
      console.error(chalk.yellow(`\n💡 Troubleshooting:`));
      console.error(chalk.gray(`   1. Is the service running? ssh tract-server systemctl status tract-sync`));
      console.error(chalk.gray(`   2. Is the URL correct? Try: curl ${serverUrl}/health`));
      console.error(chalk.gray(`   3. Are you on the right network/VPN?`));
      console.error(chalk.gray(`\n   For offline time logging, edit worklogs/YYYY-MM.jsonl directly`));
    } else {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
    }
    process.exit(1);
  }
}

module.exports = log;
