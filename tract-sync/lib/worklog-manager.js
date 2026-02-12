const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');

class WorklogManager {
  constructor(config) {
    this.repoPath = config.repoPath;
    this.worklogsDir = path.join(this.repoPath, 'worklogs');
    this.git = simpleGit(this.repoPath);
    this.jiraClient = config.jiraClient;
    this.syncUser = config.syncUser || 'tract-sync';
    this.syncEmail = config.syncEmail || 'tract-sync@localhost';
    
    // Ensure worklogs directory exists
    if (!fs.existsSync(this.worklogsDir)) {
      fs.mkdirSync(this.worklogsDir, { recursive: true });
    }
    
    // Track pending commits
    this.pendingCommit = false;
    this.commitTimer = null;
  }

  // Add a worklog entry
  async addWorklog(issueKey, entry) {
    const { author, time, comment, started } = entry;
    
    // Parse time to seconds
    const seconds = this.parseTimeToSeconds(time);
    if (!seconds) {
      throw new Error(`Invalid time format: ${time}`);
    }
    
    // Default started to now if not provided
    const startedDate = started || new Date().toISOString();
    
    // Create JSONL entry
    const logEntry = {
      author: author,
      started: startedDate,
      seconds: seconds,
      comment: comment || ''
    };
    
    // Append to file
    const filePath = path.join(this.worklogsDir, `${issueKey}.jsonl`);
    fs.appendFileSync(filePath, JSON.stringify(logEntry) + '\n', 'utf8');
    
    console.log(`📝 Added worklog: ${issueKey} - ${author} - ${time}`);
    
    // Post to Jira immediately
    try {
      await this.jiraClient.post(`/rest/api/2/issue/${issueKey}/worklog`, {
        timeSpentSeconds: seconds,
        comment: comment,
        started: startedDate
      });
      console.log(`  ✅ Posted to Jira`);
    } catch (error) {
      console.error(`  ❌ Failed to post to Jira:`, error.response?.data || error.message);
      // Continue - it's in git at least
    }
    
    // Schedule batch commit
    this.scheduleBatchCommit();
    
    return logEntry;
  }

  // Get all worklogs for an issue
  getWorklogs(issueKey) {
    const filePath = path.join(this.worklogsDir, `${issueKey}.jsonl`);
    
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);
    
    return lines.map(line => JSON.parse(line));
  }

  // Get timesheet for a user (day, week, or month)
  getTimesheet(author, options = {}) {
    const { date, week, month } = options;
    
    // Read all worklog files
    const files = fs.readdirSync(this.worklogsDir)
      .filter(f => f.endsWith('.jsonl'));
    
    const entries = [];
    
    for (const file of files) {
      const issueKey = file.replace('.jsonl', '');
      const worklogs = this.getWorklogs(issueKey);
      
      for (const log of worklogs) {
        if (log.author === author) {
          entries.push({
            issue: issueKey,
            ...log
          });
        }
      }
    }
    
    // Filter by date/week/month
    let filtered = entries;
    
    if (date) {
      const targetDate = new Date(date).toISOString().split('T')[0];
      filtered = entries.filter(e => {
        const entryDate = new Date(e.started).toISOString().split('T')[0];
        return entryDate === targetDate;
      });
    } else if (week) {
      // Filter by ISO week
      filtered = entries.filter(e => {
        const entryWeek = this.getISOWeek(new Date(e.started));
        return entryWeek === week;
      });
    } else if (month) {
      // Filter by month (YYYY-MM)
      filtered = entries.filter(e => {
        const entryMonth = new Date(e.started).toISOString().slice(0, 7);
        return entryMonth === month;
      });
    }
    
    // Sort by started time
    filtered.sort((a, b) => new Date(a.started) - new Date(b.started));
    
    return filtered;
  }

  // Schedule batch commit (debounced)
  scheduleBatchCommit() {
    this.pendingCommit = true;
    
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
    }
    
    // Batch commits every 5 minutes
    this.commitTimer = setTimeout(() => {
      this.performBatchCommit();
    }, 5 * 60 * 1000);
  }

  // Perform the actual git commit
  async performBatchCommit() {
    if (!this.pendingCommit) return;
    
    try {
      // Check if there are changes in worklogs/
      const status = await this.git.status();
      const worklogChanges = status.files.filter(f => f.path.startsWith('worklogs/'));
      
      if (worklogChanges.length === 0) {
        this.pendingCommit = false;
        return;
      }
      
      // Commit worklog changes
      await this.git.add('worklogs/');
      const timestamp = new Date().toISOString().split('T')[0] + ' ' + 
                       new Date().toTimeString().split(' ')[0];
      await this.git.commit(
        `Worklog entries ${timestamp}\n\n[tract-sync]`,
        { '--author': `"${this.syncUser} <${this.syncEmail}>"` }
      );
      
      console.log(`📦 Committed worklog batch`);
      this.pendingCommit = false;
    } catch (error) {
      console.error(`❌ Failed to commit worklogs:`, error.message);
    }
  }

  // Force immediate commit (for shutdown)
  async flush() {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
    await this.performBatchCommit();
  }

  // Parse time string to seconds
  parseTimeToSeconds(timeStr) {
    if (!timeStr) return null;
    
    const match = timeStr.match(/^(\d+(?:\.\d+)?)\s*([hdmw]?)$/i);
    if (!match) return null;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase() || 'h';
    
    const multipliers = {
      'm': 60,
      'h': 3600,
      'd': 28800, // 8 hour workday
      'w': 144000 // 5 day work week
    };
    
    return Math.round(value * (multipliers[unit] || 3600));
  }

  // Format seconds to human-readable time
  formatSeconds(seconds) {
    if (!seconds || seconds === 0) return '0m';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours >= 8) {
      const days = Math.floor(hours / 8);
      const remainingHours = hours % 8;
      if (remainingHours > 0) {
        return `${days}d ${remainingHours}h`;
      }
      return `${days}d`;
    } else if (hours > 0) {
      if (minutes > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  }

  // Get ISO week number
  getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }
}

module.exports = WorklogManager;
