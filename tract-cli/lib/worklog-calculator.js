const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Calculate logged time and remaining from JSONL worklogs in ~/.tract/worklogs/
 * Worklogs are cross-project, stored in the developer's shared ~/.tract/ git repo.
 * Implements Option A: estimate in frontmatter, logged/remaining calculated
 */
class WorklogCalculator {
  constructor(worklogsPath) {
    this.worklogsPath = worklogsPath || path.join(os.homedir(), '.tract', 'worklogs');
    this.cache = null; // Cache of all worklogs by issue
  }

  /**
   * Load all worklogs into cache (called once on first use)
   */
  loadAllWorklogs() {
    if (!this.worklogsPath || !fs.existsSync(this.worklogsPath)) {
      return {};
    }

    const files = fs.readdirSync(this.worklogsPath)
      .filter(f => f.endsWith('.jsonl') && f.match(/^\d{4}-\d{2}\.jsonl$/));

    const byIssue = {};

    for (const file of files) {
      const filePath = path.join(this.worklogsPath, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n').filter(line => line.length > 0);

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (!byIssue[entry.issue]) {
              byIssue[entry.issue] = [];
            }
            byIssue[entry.issue].push(entry);
          } catch (parseErr) {
            // Skip malformed lines
            continue;
          }
        }
      } catch (readErr) {
        // Skip unreadable files
        continue;
      }
    }

    // Sort each issue's worklogs by started time
    for (const issueKey in byIssue) {
      byIssue[issueKey].sort((a, b) => new Date(a.started) - new Date(b.started));
    }

    return byIssue;
  }

  /**
   * Get all worklogs for a ticket (across all authors)
   */
  getWorklogs(issueKey) {
    // Load cache on first use
    if (this.cache === null) {
      this.cache = this.loadAllWorklogs();
    }

    return this.cache[issueKey] || [];
  }

  /**
   * Calculate total logged time in seconds for a ticket
   */
  calculateLoggedSeconds(issueKey) {
    const worklogs = this.getWorklogs(issueKey);
    return worklogs.reduce((sum, entry) => sum + (entry.seconds || 0), 0);
  }

  /**
   * Calculate logged time as formatted string (e.g., "3h", "2d 4h")
   */
  calculateLogged(issueKey) {
    const seconds = this.calculateLoggedSeconds(issueKey);
    return this.formatSeconds(seconds);
  }

  /**
   * Calculate remaining time
   * @param {string} issueKey - Ticket ID
   * @param {string|number} estimate - Estimate from frontmatter (e.g., "8h", "3d", 5)
   * @param {string|number} manualRemaining - Optional manual override from frontmatter
   * @returns {string} Remaining time (e.g., "3h")
   */
  calculateRemaining(issueKey, estimate, manualRemaining = null) {
    // If manual override provided, use it
    if (manualRemaining) {
      return manualRemaining;
    }

    // No estimate = can't calculate
    if (!estimate) {
      return null;
    }

    const estimateSeconds = this.parseTimeToSeconds(estimate);
    const loggedSeconds = this.calculateLoggedSeconds(issueKey);

    const remainingSeconds = Math.max(0, estimateSeconds - loggedSeconds);
    return this.formatSeconds(remainingSeconds);
  }

  /**
   * Get time tracking summary for a ticket
   */
  getTimeTracking(ticket) {
    const estimate = ticket.estimate || null;
    const logged = this.calculateLogged(ticket.id);
    const remaining = this.calculateRemaining(ticket.id, estimate, ticket.remaining);

    return {
      estimate,
      logged,
      remaining,
      loggedSeconds: this.calculateLoggedSeconds(ticket.id),
      estimateSeconds: estimate ? this.parseTimeToSeconds(estimate) : null
    };
  }

  /**
   * Parse time string to seconds (handles "3d", "8h", "5", etc.)
   */
  parseTimeToSeconds(timeStr) {
    if (!timeStr) return 0;
    const str = String(timeStr).toLowerCase().trim();

    // Story points (just a number) - treat as hours
    if (/^\d+$/.test(str)) {
      return parseInt(str, 10) * 3600;
    }

    // Hours: "8h", "4.5h"
    const hoursMatch = str.match(/^(\d+(?:\.\d+)?)h$/);
    if (hoursMatch) {
      return Math.round(parseFloat(hoursMatch[1]) * 3600);
    }

    // Days: "3d", "2.5d" - convert to hours (8 hours per day)
    const daysMatch = str.match(/^(\d+(?:\.\d+)?)d$/);
    if (daysMatch) {
      return Math.round(parseFloat(daysMatch[1]) * 8 * 3600);
    }

    // Weeks: "2w"
    const weeksMatch = str.match(/^(\d+(?:\.\d+)?)w$/);
    if (weeksMatch) {
      return Math.round(parseFloat(weeksMatch[1]) * 40 * 3600); // 5 days * 8 hours
    }

    // Minutes: "30m"
    const minutesMatch = str.match(/^(\d+(?:\.\d+)?)m$/);
    if (minutesMatch) {
      return Math.round(parseFloat(minutesMatch[1]) * 60);
    }

    return 0;
  }

  /**
   * Format seconds to human-readable time (e.g., "3h", "2d 4h")
   */
  formatSeconds(seconds) {
    if (!seconds || seconds === 0) return '0h';

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
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return '0h';
    }
  }
}

module.exports = WorklogCalculator;
