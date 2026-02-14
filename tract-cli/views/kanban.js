#!/usr/bin/env node
'use strict';

const blessed = require('blessed');
const contrib = require('blessed-contrib');

/**
 * Kanban Board View
 * View-only dashboard showing tickets in columns by status
 */

class KanbanView {
  constructor(screen, tickets, config = {}) {
    this.screen = screen;
    this.tickets = tickets;
    this.config = config;
    this.grid = null;
    this.lists = {};
  }

  /**
   * Get detail level based on terminal width
   */
  getDetailLevel() {
    const width = this.screen.width;
    if (width >= 200) return 'ultra';
    if (width >= 160) return 'wide';
    if (width >= 120) return 'standard';
    return 'minimal';
  }

  /**
   * Group tickets by status
   */
  groupByStatus() {
    const groups = {
      todo: [],
      'in-progress': [],
      review: [],
      done: []
    };

    this.tickets.forEach(ticket => {
      const status = ticket.status || 'todo';
      if (groups[status]) {
        groups[status].push(ticket);
      }
    });

    return groups;
  }

  /**
   * Format ticket for display based on detail level
   */
  formatTicket(ticket, detailLevel) {
    const id = ticket.id || '???';
    const title = ticket.title || 'Untitled';
    const assignee = ticket.assignee || 'unassigned';
    const priority = ticket.priority || 'medium';
    const labels = ticket.labels || [];

    // Priority emoji
    const priorityEmoji = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    }[priority.toLowerCase()] || '⚪';

    switch (detailLevel) {
      case 'minimal':
        // Just ID and priority
        return `${id} ${priorityEmoji}`;

      case 'standard':
        // ID, title (truncated), assignee, priority
        const truncTitle = title.length > 20 ? title.substring(0, 17) + '...' : title;
        return `${id} ${truncTitle}\n@${assignee}  ${priorityEmoji} ${priority}`;

      case 'wide':
        // Add labels
        const labelStr = labels.length > 0 ? `#${labels.slice(0, 2).join(' #')}` : '';
        return `${id} ${title}\n@${assignee}  ${priorityEmoji} ${priority}\n${labelStr}`;

      case 'ultra':
        // Everything
        const allLabels = labels.length > 0 ? `#${labels.join(' #')}` : '';
        const blockedBy = ticket.blocked_by ? `⛔ Blocked` : '';
        const blocks = ticket.blocks ? `🚧 Blocks ${ticket.blocks.length}` : '';
        return `${id} ${title}\n@${assignee}  ${priorityEmoji} ${priority}  ${allLabels}\n${blockedBy} ${blocks}`.trim();

      default:
        return `${id} ${title}`;
    }
  }

  /**
   * Render the Kanban board
   */
  render() {
    const detailLevel = this.getDetailLevel();
    const grouped = this.groupByStatus();

    // Clear screen
    this.screen.children.forEach(child => {
      this.screen.remove(child);
    });

    // Create grid layout
    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });

    // Column widths based on detail level
    let colWidth = 3;
    if (detailLevel === 'ultra') colWidth = 3;
    else if (detailLevel === 'wide') colWidth = 3;
    else if (detailLevel === 'standard') colWidth = 3;
    else colWidth = 4; // minimal gets 4 columns

    // Todo column
    this.lists.todo = this.grid.set(0, 0, 11, colWidth, blessed.list, {
      label: ` Todo (${grouped.todo.length}) `,
      tags: true,
      style: {
        fg: 'cyan',
        border: { fg: 'cyan' },
        selected: { bg: 'blue' }
      },
      border: { type: 'line' },
      interactive: false,
      keys: false,
      mouse: false,
      items: grouped.todo.map(t => this.formatTicket(t, detailLevel))
    });

    // In Progress column
    this.lists['in-progress'] = this.grid.set(0, colWidth, 11, colWidth, blessed.list, {
      label: ` In Progress (${grouped['in-progress'].length}) `,
      tags: true,
      style: {
        fg: 'yellow',
        border: { fg: 'yellow' },
        selected: { bg: 'yellow' }
      },
      border: { type: 'line' },
      interactive: false,
      keys: false,
      mouse: false,
      items: grouped['in-progress'].map(t => this.formatTicket(t, detailLevel))
    });

    // Review column (if space)
    if (this.screen.width >= 120) {
      this.lists.review = this.grid.set(0, colWidth * 2, 11, colWidth, blessed.list, {
        label: ` Review (${grouped.review.length}) `,
        tags: true,
        style: {
          fg: 'magenta',
          border: { fg: 'magenta' },
          selected: { bg: 'magenta' }
        },
        border: { type: 'line' },
        interactive: false,
        keys: false,
        mouse: false,
        items: grouped.review.map(t => this.formatTicket(t, detailLevel))
      });
    }

    // Done column
    const doneCol = this.screen.width >= 120 ? colWidth * 3 : colWidth * 2;
    this.lists.done = this.grid.set(0, doneCol, 11, colWidth, blessed.list, {
      label: ` Done (${grouped.done.length}) `,
      tags: true,
      style: {
        fg: 'green',
        border: { fg: 'green' },
        selected: { bg: 'green' }
      },
      border: { type: 'line' },
      interactive: false,
      keys: false,
      mouse: false,
      items: grouped.done.map(t => this.formatTicket(t, detailLevel))
    });

    // Status bar at bottom
    const totalTickets = this.tickets.length;
    const doneCount = grouped.done.length;
    const percentage = totalTickets > 0 ? Math.round((doneCount / totalTickets) * 100) : 0;
    
    const statusBar = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: ` Total: ${totalTickets} tickets | Done: ${doneCount} (${percentage}%) | Detail: ${detailLevel} | [q] Quit`,
      style: {
        fg: 'white',
        bg: 'black'
      }
    });

    this.screen.append(statusBar);

    // Render
    this.screen.render();
  }

  /**
   * Update with new ticket data
   */
  update(tickets) {
    this.tickets = tickets;
    this.render();
  }
}

module.exports = KanbanView;
