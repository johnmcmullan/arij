const axios = require('axios');
const chalk = require('chalk');

async function worklogs(issue, options) {
  try {
    // Get sync server URL
    const serverUrl = options.server || process.env.TRACT_SYNC_SERVER;
    if (!serverUrl) {
      console.error(chalk.red('❌ Sync server URL required'));
      console.error(chalk.gray('Set TRACT_SYNC_SERVER env var or use --server option'));
      process.exit(1);
    }

    // Fetch worklogs
    const response = await axios.get(
      `${serverUrl}/worklog/${issue}`,
      { timeout: 10000 }
    );

    const { worklogs, total, totalSeconds } = response.data;

    if (worklogs.length === 0) {
      console.log(chalk.yellow(`\n⚠️  No worklogs found for ${issue}`));
      return;
    }

    console.log(chalk.bold.cyan(`\nWorklogs for ${issue}:`));
    console.log(chalk.gray('─'.repeat(70)));

    for (const log of worklogs) {
      const date = new Date(log.started);
      const timeStr = date.toISOString().split('T')[0] + ' ' + 
                      date.toTimeString().split(' ')[0];
      const duration = formatSeconds(log.seconds);
      
      console.log(chalk.white(`${timeStr}  ${chalk.cyan(duration.padEnd(8))}  ${log.author}`));
      if (log.comment) {
        console.log(chalk.gray(`  ${log.comment}`));
      }
    }

    console.log(chalk.gray('─'.repeat(70)));
    console.log(chalk.bold.green(`Total: ${total}`));
    console.log();

  } catch (error) {
    if (error.response) {
      console.error(chalk.red(`\n❌ Server error: ${error.response.data.error || error.message}`));
    } else if (error.request) {
      console.error(chalk.red(`\n❌ Could not reach sync server`));
    } else {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
    }
    process.exit(1);
  }
}

function formatSeconds(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}m`;
  }
}

module.exports = worklogs;
