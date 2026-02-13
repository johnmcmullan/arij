const axios = require('axios');
const { execSync } = require('child_process');
const chalk = require('chalk');

async function timesheet(author, options) {
  try {
    // Get sync server URL
    const serverUrl = options.server || process.env.TRACT_SYNC_SERVER;
    if (!serverUrl) {
      console.error(chalk.red('❌ Sync server URL required'));
      console.error(chalk.gray('Set TRACT_SYNC_SERVER env var or use --server option'));
      process.exit(1);
    }

    // Get author name (from git config if not specified)
    if (!author) {
      try {
        author = execSync('git config user.name', { encoding: 'utf8' }).trim();
      } catch (error) {
        console.error(chalk.red('❌ Could not determine author name'));
        console.error(chalk.gray('Use author argument or configure git user.name'));
        process.exit(1);
      }
    }

    // Build query params
    const params = {};
    if (options.date) {
      params.date = options.date;
    } else if (options.week !== undefined) {
      // If --week with no value, use current week
      params.week = options.week === true ? getCurrentISOWeek() : options.week;
    } else if (options.month) {
      params.month = options.month;
    } else {
      // Default to today
      params.date = new Date().toISOString().split('T')[0];
    }

    // Fetch timesheet
    const response = await axios.get(
      `${serverUrl}/timesheet/${author}`,
      { params, timeout: 10000 }
    );

    const { entries, total, totalSeconds, filter } = response.data;

    if (entries.length === 0) {
      console.log(chalk.yellow(`\n⚠️  No time logged`));
      console.log(chalk.gray(`   Author: ${author}`));
      console.log(chalk.gray(`   Filter: ${JSON.stringify(filter)}`));
      return;
    }

    // Output based on format
    if (options.format === 'json') {
      console.log(JSON.stringify(response.data, null, 2));
      return;
    }

    if (options.format === 'csv') {
      console.log('Date,Time,Duration,Issue,Comment');
      for (const entry of entries) {
        const date = new Date(entry.started);
        const dateStr = date.toISOString().split('T')[0];
        const timeStr = date.toTimeString().split(' ')[0];
        const duration = formatSeconds(entry.seconds);
        const comment = (entry.comment || '').replace(/"/g, '""');
        console.log(`${dateStr},${timeStr},${duration},${entry.issue},"${comment}"`);
      }
      return;
    }

    // Text format (default)
    const filterDesc = filter.date ? filter.date : 
                      filter.week ? `Week ${filter.week}` :
                      filter.month ? filter.month : 'All time';

    console.log(chalk.bold.cyan(`\nTimesheet: ${author}`));
    console.log(chalk.gray(`Period: ${filterDesc}`));
    console.log(chalk.gray('─'.repeat(80)));

    let currentDate = null;
    let dailyTotal = 0;
    const dailyEntries = [];

    for (const entry of entries) {
      const date = new Date(entry.started);
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
      
      if (currentDate !== dateStr) {
        // Print previous day's total
        if (currentDate !== null) {
          printDailyTotal(dailyTotal);
        }
        
        // Start new day
        currentDate = dateStr;
        dailyTotal = 0;
        console.log(chalk.bold.white(`\n${dateStr} (${getDayOfWeek(date)})`));
      }

      const duration = formatSeconds(entry.seconds);
      console.log(chalk.white(`  ${timeStr}  ${chalk.cyan(duration.padEnd(8))}  ${entry.issue.padEnd(12)}  ${chalk.gray(entry.comment || '')}`));
      
      dailyTotal += entry.seconds;
    }

    // Print final day's total
    if (currentDate !== null) {
      printDailyTotal(dailyTotal);
    }

    console.log(chalk.gray('─'.repeat(80)));
    
    // Overall total with target check
    const hours = totalSeconds / 3600;
    const targetHours = filter.week ? 40 : filter.date ? 8 : null;
    
    if (targetHours && hours < targetHours) {
      const needed = targetHours - hours;
      console.log(chalk.bold.yellow(`Total: ${total}  ⚠️  Need ${needed.toFixed(1)}h more`));
    } else if (targetHours) {
      console.log(chalk.bold.green(`Total: ${total}  ✓`));
    } else {
      console.log(chalk.bold.green(`Total: ${total}`));
    }
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

function printDailyTotal(seconds) {
  const hours = seconds / 3600;
  const total = formatSeconds(seconds);
  
  if (hours < 8) {
    console.log(chalk.yellow(`    ${' '.repeat(25)}Daily: ${total}  ⚠️  Need ${(8 - hours).toFixed(1)}h more`));
  } else {
    console.log(chalk.green(`    ${' '.repeat(25)}Daily: ${total}  ✓`));
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

function getDayOfWeek(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

function getCurrentISOWeek() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 4 - (date.getDay() || 7));
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

module.exports = timesheet;
