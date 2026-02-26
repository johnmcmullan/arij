#!/usr/bin/env node
'use strict';

const blessed = require('blessed');
const contrib = require('blessed-contrib');

/**
 * Kanban Board View - btop-inspired Terminal UI
 * Beautiful, responsive, view-only dashboard
 */

class KanbanView {
  constructor(screen, tickets, config = {}) {
    this.screen = screen;
    this.tickets = tickets;
    this.config = config;
    this.swimlanes = config.swimlanes || null;  // Swimlane configuration from board YAML
    this.grid = null;
    this.lists = {};
    this.boxes = {};
    this.rendering = false;  // Flag to prevent concurrent renders

    // btop color palette (using blessed's 256-color support)
    this.colors = {
      cyan: '#89dceb',
      blue: '#89b4fa',
      pink: '#f5c2e7',
      purple: '#cba6f7',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      peach: '#fab387',
      red: '#f38ba8',
      bg: '#1e1e2e',
      bgAlt: '#313244',
      fg: '#cdd6f4',
      fgDim: '#6c7086'
    };
  }

  /**
   * Get detail level based on terminal width
   */
  getDetailLevel() {
    const width = this.screen.width;
    const height = this.screen.height;

    // Backlog mode: thresholds based on minimum content width
    // Progress bar is 2/3 of (width-10), so cards stay visible until
    // the terminal is barely wider than a progress bar
    if (this.config.backlogMode) {
      if (width >= 80 && height >= 30) return 'ultra';
      if (width >= 50) return 'spacious';  // Cards down to ~50 chars wide
      if (width >= 40) return 'wide';
      return 'compact';
    }

    // Multi-column mode: higher thresholds needed
    if (width >= 220 && height >= 50) return 'ultra';
    if (width >= 180 && height >= 40) return 'spacious';
    if (width >= 140 && height >= 30) return 'wide';
    if (width >= 100) return 'standard';
    return 'compact';
  }

  /**
   * Group tickets by status
   */
  groupByStatus() {
    // Backlog mode: single group with all tickets
    if (this.config.backlogMode) {
      return {
        all: this.tickets
      };
    }

    const groups = {
      backlog: [],
      todo: [],
      'in-progress': [],
      review: [],
      done: []
    };

    this.tickets.forEach(ticket => {
      const status = (ticket.status || 'todo').replace('_', '-');
      if (groups[status]) {
        groups[status].push(ticket);
      } else {
        // Unknown status goes to todo
        groups.todo.push(ticket);
      }
    });

    return groups;
  }

  /**
   * Get columns from board config or use defaults
   */
  getColumnsFromConfig() {
    // If board config has columns, use those
    if (this.config.columns && this.config.columns.length > 0) {
      return this.config.columns.map(col => ({
        name: col.name,
        filter: col.filter || {},
        color: this.getColumnColor(col.name, col.filter)
      }));
    }

    // Otherwise use default status-based columns
    const defaultCols = this.getColumnConfig(this.getDetailLevel());
    return defaultCols.filter(c => c.visible).map(c => ({
      name: c.label,
      filter: { status: c.status },
      color: c.color
    }));
  }

  /**
   * Get color for a column based on its name or filter
   */
  getColumnColor(name, filter) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('backlog')) return '#6c7086';
    if (nameLower.includes('todo') || nameLower.includes('to do')) return '#89b4fa';
    if (nameLower.includes('progress') || nameLower.includes('active')) return '#f9e2af';
    if (nameLower.includes('review')) return '#cba6f7';
    if (nameLower.includes('done') || nameLower.includes('complete')) return '#a6e3a1';

    // Default based on status filter
    if (filter.status) {
      const status = Array.isArray(filter.status) ? filter.status[0] : filter.status;
      const statusStr = String(status).replace('_', '-');
      if (statusStr === 'backlog') return '#6c7086';
      if (statusStr === 'todo') return '#89b4fa';
      if (statusStr === 'in-progress') return '#f9e2af';
      if (statusStr === 'review') return '#cba6f7';
      if (statusStr === 'done') return '#a6e3a1';
    }

    return '#89dceb'; // Default cyan
  }

  /**
   * Check if a ticket matches a filter
   */
  ticketMatchesFilter(ticket, filter) {
    for (const [field, value] of Object.entries(filter)) {
      const ticketValue = ticket[field];

      if (Array.isArray(value)) {
        // OR condition: ticket value must be in the list
        if (!value.includes(ticketValue)) {
          return false;
        }
      } else {
        // Exact match
        if (ticketValue !== value) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Group tickets by swimlane field, then by column filter
   * Returns: { swimlaneValue: { columnIndex: [tickets] } }
   */
  groupBySwimlanes() {
    if (!this.swimlanes || !this.swimlanes.by) {
      return null;
    }

    const swimlaneField = this.swimlanes.by;
    const columns = this.getColumnsFromConfig();
    const swimlaneGroups = {};

    // Group tickets by swimlane value, then by column
    this.tickets.forEach(ticket => {
      let swimlaneValue = ticket[swimlaneField] || null;

      // Handle special case for 'project' - derive from ticket ID
      if (swimlaneField === 'project' && !swimlaneValue) {
        const match = ticket.id?.match(/^([A-Z]+)-/);
        swimlaneValue = match ? match[1] : null;
      }

      const swimlaneKey = swimlaneValue || '__null__';

      if (!swimlaneGroups[swimlaneKey]) {
        swimlaneGroups[swimlaneKey] = {};
        columns.forEach((col, idx) => {
          swimlaneGroups[swimlaneKey][idx] = [];
        });
      }

      // Find which column this ticket belongs to (first match wins)
      for (let i = 0; i < columns.length; i++) {
        if (this.ticketMatchesFilter(ticket, columns[i].filter)) {
          swimlaneGroups[swimlaneKey][i].push(ticket);
          break; // Ticket goes in first matching column only
        }
      }
    });

    // Apply ordering if specified
    const orderedKeys = this.getOrderedSwimlaneKeys(Object.keys(swimlaneGroups));

    // Filter empty swimlanes if configured
    const showEmpty = this.swimlanes.show_empty !== false; // Default true
    const result = {};
    orderedKeys.forEach(key => {
      const hasTickets = Object.values(swimlaneGroups[key]).some(arr => arr.length > 0);
      if (showEmpty || hasTickets) {
        result[key] = swimlaneGroups[key];
      }
    });

    return result;
  }

  /**
   * Get ordered swimlane keys based on config
   */
  getOrderedSwimlaneKeys(keys) {
    if (!this.swimlanes.order || this.swimlanes.order.length === 0) {
      // Default: alphabetical, with null last
      return keys.sort((a, b) => {
        if (a === '__null__') return 1;
        if (b === '__null__') return -1;
        return a.localeCompare(b);
      });
    }

    // Use explicit order from config
    const order = this.swimlanes.order.map(v => v === null ? '__null__' : String(v));
    const ordered = [];
    const remaining = new Set(keys);

    // Add keys in specified order
    order.forEach(key => {
      if (remaining.has(key)) {
        ordered.push(key);
        remaining.delete(key);
      }
    });

    // Add any remaining keys at the end
    remaining.forEach(key => ordered.push(key));

    return ordered;
  }

  /**
   * Get display label for swimlane
   */
  getSwimlaneLabel(swimlaneKey) {
    if (swimlaneKey === '__null__') {
      return this.swimlanes.null_label || 'Unassigned';
    }
    return swimlaneKey;
  }

  /**
   * Format ticket as single line (for list-based rendering)
   */
  formatTicketSingleLine(ticket, detailLevel) {
    const id = ticket.id || '???';
    const title = ticket.title || 'Untitled';
    const assignee = ticket.assignee ? ticket.assignee.split('.')[0] : 'unassigned';
    const priority = ticket.priority || 'medium';
    const type = ticket.type || 'task';
    const estimate = ticket.estimate || null;
    const due = ticket.due || null;

    const symbols = {
      type: { epic: '◆', story: '●', task: '○', bug: '✕' },
      estimate: '◷',
      due: '!'
    };

    const typeSym = symbols.type[type.toLowerCase()] || '○';
    const daysToCompletion = this.calculateDaysTo(due);

    switch (detailLevel) {
      case 'compact':
        return `${typeSym} {cyan-fg}${id}{/}`;

      case 'standard':
        const truncTitle = title.length > 25 ? title.substring(0, 22) + '…' : title;
        const dueInfo = due && daysToCompletion !== null ? `{#fab387-fg}${symbols.due}${daysToCompletion}d{/}` : '';
        return `${typeSym} {cyan-fg}${id}{/} ${truncTitle}  {#6c7086-fg}@${assignee}{/}  ${dueInfo}`;

      case 'wide':
        const wideTitle = title.length > 35 ? title.substring(0, 32) + '…' : title;
        const estimateInfo = estimate ? `{#cba6f7-fg}${symbols.estimate}${estimate}{/}` : '';
        const dueWide = this.formatDueDate(due, daysToCompletion);
        return `${typeSym} {cyan-fg}{bold}${id}{/bold}{/} ${estimateInfo}  ${wideTitle}  {#89b4fa-fg}@${assignee}{/}  ${dueWide}`;

      default:
        return `${id} ${title}`;
    }
  }

  /**
   * Format ticket as multi-line card (for box-based rendering)
   */
  formatTicketCard(ticket, detailLevel) {
    const id = ticket.id || '???';
    const title = ticket.title || 'Untitled';
    const assignee = ticket.assignee ? ticket.assignee.split('.')[0] : 'unassigned';
    const priority = ticket.priority || 'medium';
    const type = ticket.type || 'task';
    const labels = ticket.labels || [];
    const estimate = ticket.estimate || null;
    const logged = ticket.logged || null;
    const remaining = ticket.remaining || null;
    const due = ticket.due || null;
    const created = ticket.created || null;

    const symbols = {
      priority: {
        blocker: '▰▰▰', critical: '▰▰▱', major: '▰▱▱',
        minor: '▱▱▱', trivial: '···'
      },
      type: { epic: '◆', story: '●', task: '○', bug: '✕' },
      estimate: '◷',
      due: '!',
      calendar: '@',
      blocked: '⊗',
      blocks: '⊘'
    };

    const typeSym = symbols.type[type.toLowerCase()] || '○';
    const prioritySym = symbols.priority[priority.toLowerCase()] || '▱▱▱';
    const priorityColor = this.getPriorityColor(priority);
    const daysToCompletion = this.calculateDaysTo(due);
    const daysSinceCreated = this.calculateDaysSince(created);
    const progressPercent = this.calculateProgress(estimate, logged, remaining);

    if (detailLevel === 'spacious') {
      // Multi-line card with progress bar
      const labelsSp = labels.length > 0 ? `{#89dceb-fg}${labels.slice(0, 2).map(l => `#${l}`).join(' ')}{/}` : '';
      const estimateSp = estimate ? `{#cba6f7-fg}${symbols.estimate} ${estimate}{/}` : '';
      const dueSp = this.formatDueDate(due, daysToCompletion);
      // Progress bar about 2/3 of available width
      const progressBarWidth = this.config.backlogMode
        ? Math.floor((this.screen.width - 10) * 0.67)  // 2/3 of available width
        : 12;
      const progressBar = this.formatProgressBar(progressPercent, progressBarWidth);

      return `${typeSym} {cyan-fg}{bold}${id}{/bold}{/} ${estimateSp}
{bold}${title}{/bold}
{${priorityColor}}${prioritySym}{/} {#89b4fa-fg}@${assignee}{/}  ${dueSp}  ${labelsSp}
${progressBar}`;
    }

    // Ultra mode - full detail
    const allLabels = labels.length > 0 ? `{#89dceb-fg}${labels.map(l => `#${l}`).join(' ')}{/}` : '';

    // Time tracking
    let timeTracking = '';
    if (estimate || logged || remaining) {
      const parts = [];
      if (estimate) parts.push(`Est:{#cba6f7-fg}${estimate}{/}`);
      if (logged) parts.push(`Log:{#a6e3a1-fg}${logged}{/}`);
      if (remaining) parts.push(`Rem:{#f9e2af-fg}${remaining}{/}`);
      timeTracking = `\n{#6c7086-fg}${symbols.estimate}{/} ${parts.join(' • ')}`;
    }

    // Progress bar about 2/3 of available width
    const progressBarWidthUltra = this.config.backlogMode
      ? Math.floor((this.screen.width - 10) * 0.67)  // 2/3 of available width
      : 20;
    const progressBarUltra = this.formatProgressBar(progressPercent, progressBarWidthUltra);
    const progressLine = progressPercent !== null ? `\n${progressBarUltra}` : '';
    const dueUltra = this.formatDueDate(due, daysToCompletion, true);
    const dueLine = due ? `\n${symbols.due} ${dueUltra}` : '';
    const ageLine = created && daysSinceCreated !== null ? `{#6c7086-fg}${symbols.calendar}${daysSinceCreated}d{/}` : '';
    const epicLine = ticket.epic ? `{#cba6f7-fg}Epic:${ticket.epic}{/}` : '';
    const blockedBy = ticket.blocked_by ? `\n{#f38ba8-fg}${symbols.blocked} Blocked by ${ticket.blocked_by}{/}` : '';

    return `${typeSym} {cyan-fg}{bold}${id}{/bold}{/}
{bold}${title}{/bold}
{${priorityColor}}${prioritySym}{/} {#6c7086-fg}${priority}{/} • {#cba6f7-fg}${type}{/} • {#89b4fa-fg}@${assignee}{/} ${ageLine} ${epicLine}
${allLabels}${timeTracking}${progressLine}${dueLine}${blockedBy}`;
  }

  /**
   * Get card height based on detail level
   */
  getCardHeight(detailLevel) {
    // Tighter spacing in backlog mode
    if (this.config.backlogMode) {
      return detailLevel === 'ultra' ? 6 : 4; // Tighter vertical spacing
    }
    return detailLevel === 'ultra' ? 9 : 5; // Multi-column: more space
  }

  /**
   * Format ticket for display based on detail level (legacy - kept for compatibility)
   */
  formatTicket(ticket, detailLevel) {
    const id = ticket.id || '???';
    const title = ticket.title || 'Untitled';
    const assignee = ticket.assignee ? ticket.assignee.split('.')[0] : 'unassigned';
    const priority = ticket.priority || 'medium';
    const type = ticket.type || 'task';
    const labels = ticket.labels || [];

    // Time tracking
    const estimate = ticket.estimate || null;
    const logged = ticket.logged || null;
    const remaining = ticket.remaining || null;
    const due = ticket.due || null;
    const created = ticket.created || null;

    // Unicode symbols (btop style)
    const symbols = {
      priority: {
        blocker: '▰▰▰',
        critical: '▰▰▱',
        major: '▰▱▱',
        minor: '▱▱▱',
        trivial: '···'
      },
      type: {
        epic: '◆',
        story: '●',
        task: '○',
        bug: '✕'
      },
      blocked: '⊗',
      blocks: '⊘',
      estimate: '◷',
      due: '!',
      calendar: '@'
    };

    const prioritySym = symbols.priority[priority.toLowerCase()] || '▱▱▱';
    const typeSym = symbols.type[type.toLowerCase()] || '○';
    const priorityColor = this.getPriorityColor(priority);

    // Calculate time-based metrics
    const daysToCompletion = this.calculateDaysTo(due);
    const daysSinceCreated = this.calculateDaysSince(created);
    const progressPercent = this.calculateProgress(estimate, logged, remaining);

    switch (detailLevel) {
      case 'compact':
        // Minimal: ID and type symbol
        return `${typeSym} {cyan-fg}${id}{/}`;

      case 'standard':
        // ID, type, priority, title (truncated)
        const truncTitle = title.length > 25 ? title.substring(0, 22) + '…' : title;
        const dueInfo = due && daysToCompletion !== null ? `{#fab387-fg}${symbols.due}${daysToCompletion}d{/}` : '';
        return `${typeSym} {cyan-fg}${id}{/} ${truncTitle}\n{#6c7086-fg}${prioritySym} @${assignee}{/}  ${dueInfo}`;

      case 'wide':
        // Add full title, assignee, estimate
        const wideTitle = title.length > 40 ? title.substring(0, 37) + '…' : title;
        const labelsWide = labels.length > 0 ? `{#89dceb-fg}#${labels.slice(0, 2).join(' #')}{/}` : '';
        const estimateWide = estimate ? `{#cba6f7-fg}${symbols.estimate}${estimate}{/}` : '';
        const dueWide = this.formatDueDate(due, daysToCompletion);
        return `╭─ ${typeSym} {cyan-fg}{bold}${id}{/bold}{/} ${estimateWide}\n│ ${wideTitle}\n╰─ {#6c7086-fg}${prioritySym} @${assignee}{/}  ${labelsWide}  ${dueWide}`;

      case 'spacious':
        // Card-style with time tracking
        const spaciousTitle = title.length > 50 ? title.substring(0, 47) + '…' : title;
        const labelsSp = labels.length > 0 ? `\n│ {#89dceb-fg}${labels.slice(0, 3).map(l => `#${l}`).join(' ')}{/}` : '';
        const estimateSp = estimate ? `{#cba6f7-fg}${symbols.estimate} ${estimate}{/}` : '';
        const dueSp = this.formatDueDate(due, daysToCompletion);
        const progressBar = this.formatProgressBar(progressPercent, 15);

        return `╭─ ${typeSym} {cyan-fg}{bold}${id}{/bold}{/} ${estimateSp} ${'─'.repeat(8)}\n│ {bold}${spaciousTitle}{/bold}\n│ \n│ {${priorityColor}}${prioritySym}{/} {#6c7086-fg}${priority}{/}  •  {#89b4fa-fg}@${assignee}{/}  •  ${dueSp}${labelsSp}\n│ ${progressBar}\n╰${'─'.repeat(25)}`;

      case 'ultra':
        // Full Jira-style detail: all metadata, time tracking, blockers
        const allLabels = labels.length > 0 ? `{#89dceb-fg}${labels.map(l => `#${l}`).join(' ')}{/}` : '';
        const blockedBy = ticket.blocked_by ? `\n│ {#f38ba8-fg}${symbols.blocked} Blocked by ${ticket.blocked_by}{/}` : '';
        const blocks = ticket.blocks ? `\n│ {#fab387-fg}${symbols.blocks} Blocks others{/}` : '';

        // Time tracking section
        let timeTracking = '';
        if (estimate || logged || remaining) {
          const estimateStr = estimate ? `Est: {#cba6f7-fg}${estimate}{/}` : '';
          const loggedStr = logged ? `Logged: {#a6e3a1-fg}${logged}{/}` : '';
          const remainingStr = remaining ? `Rem: {#f9e2af-fg}${remaining}{/}` : '';
          timeTracking = `\n│ {#6c7086-fg}${symbols.estimate}{/} ${[estimateStr, loggedStr, remainingStr].filter(Boolean).join('  •  ')}`;
        }

        // Progress bar (wider for ultra mode)
        const progressBarUltra = this.formatProgressBar(progressPercent, 25);
        const progressLine = progressPercent !== null ? `\n│ ${progressBarUltra}` : '';

        // Due date with warning colors
        const dueUltra = this.formatDueDate(due, daysToCompletion, true);
        const dueLine = due ? `\n│ ${symbols.due} ${dueUltra}` : '';

        // Age
        const ageLine = created && daysSinceCreated !== null ? `\n│ {#6c7086-fg}${symbols.calendar} Created ${daysSinceCreated}d ago{/}` : '';

        // Epic
        const epicLine = ticket.epic ? `\n│ {#cba6f7-fg}◆ Epic: ${ticket.epic}{/}` : '';

        return `╭─ ${typeSym} {cyan-fg}{bold}${id}{/bold}{/} ${'─'.repeat(30)}\n│ {bold}${title}{/bold}\n│ \n│ {${priorityColor}}${prioritySym}{/} {#6c7086-fg}${priority.toUpperCase()}{/}  •  {#cba6f7-fg}${type.toUpperCase()}{/}  •  {#89b4fa-fg}@${assignee}{/}  •  ${allLabels}${timeTracking}${progressLine}${dueLine}${ageLine}${epicLine}${blockedBy}${blocks}\n╰${'─'.repeat(40)}`;

      default:
        return `${id} ${title}`;
    }
  }

  /**
   * Get color for priority level
   */
  getPriorityColor(priority) {
    const colors = {
      blocker: '#f38ba8-fg',
      critical: '#f38ba8-fg',
      major: '#fab387-fg',
      minor: '#f9e2af-fg',
      trivial: '#6c7086-fg'
    };
    return colors[priority.toLowerCase()] || '#f9e2af-fg';
  }

  /**
   * Calculate days until due date
   */
  calculateDaysTo(dueDate) {
    if (!dueDate) return null;
    try {
      const due = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
      return diff;
    } catch (e) {
      return null;
    }
  }

  /**
   * Calculate days since creation
   */
  calculateDaysSince(createdDate) {
    if (!createdDate) return null;
    try {
      const created = new Date(createdDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      created.setHours(0, 0, 0, 0);
      const diff = Math.ceil((today - created) / (1000 * 60 * 60 * 24));
      return diff;
    } catch (e) {
      return null;
    }
  }

  /**
   * Calculate progress percentage from time tracking
   */
  calculateProgress(estimate, logged, remaining) {
    // If we have logged and remaining, calculate from those
    if (logged && remaining) {
      const loggedHours = this.parseTimeToHours(logged);
      const remainingHours = this.parseTimeToHours(remaining);
      if (loggedHours !== null && remainingHours !== null) {
        const total = loggedHours + remainingHours;
        return total > 0 ? Math.round((loggedHours / total) * 100) : 0;
      }
    }

    // If we have estimate and remaining, calculate from those
    if (estimate && remaining) {
      const estimateHours = this.parseTimeToHours(estimate);
      const remainingHours = this.parseTimeToHours(remaining);
      if (estimateHours !== null && remainingHours !== null && estimateHours > 0) {
        const done = estimateHours - remainingHours;
        return Math.round((done / estimateHours) * 100);
      }
    }

    // If we have estimate and logged, calculate from those
    if (estimate && logged) {
      const estimateHours = this.parseTimeToHours(estimate);
      const loggedHours = this.parseTimeToHours(logged);
      if (estimateHours !== null && loggedHours !== null && estimateHours > 0) {
        return Math.round((loggedHours / estimateHours) * 100);
      }
    }

    return null;
  }

  /**
   * Parse time string to hours (handles "3d", "8h", "5", etc.)
   */
  parseTimeToHours(timeStr) {
    if (!timeStr) return null;
    const str = String(timeStr).toLowerCase().trim();

    // Story points (just a number) - treat as hours for progress calc
    if (/^\d+$/.test(str)) {
      return parseInt(str, 10);
    }

    // Hours: "8h", "4.5h"
    const hoursMatch = str.match(/^(\d+(?:\.\d+)?)h$/);
    if (hoursMatch) {
      return parseFloat(hoursMatch[1]);
    }

    // Days: "3d", "2.5d" - convert to hours (8 hours per day)
    const daysMatch = str.match(/^(\d+(?:\.\d+)?)d$/);
    if (daysMatch) {
      return parseFloat(daysMatch[1]) * 8;
    }

    // Weeks: "2w"
    const weeksMatch = str.match(/^(\d+(?:\.\d+)?)w$/);
    if (weeksMatch) {
      return parseFloat(weeksMatch[1]) * 40; // 5 days * 8 hours
    }

    return null;
  }

  /**
   * Format due date with color coding
   */
  formatDueDate(due, daysTo, detailed = false) {
    if (!due || daysTo === null) return '';

    let color, label;

    if (daysTo < 0) {
      // Overdue
      color = '#f38ba8-fg';
      label = detailed ? `OVERDUE by ${Math.abs(daysTo)}d` : `${daysTo}d`;
    } else if (daysTo === 0) {
      // Due today
      color = '#fab387-fg';
      label = 'TODAY';
    } else if (daysTo <= 2) {
      // Due very soon
      color = '#fab387-fg';
      label = detailed ? `Due in ${daysTo}d` : `${daysTo}d`;
    } else if (daysTo <= 7) {
      // Due this week
      color = '#f9e2af-fg';
      label = detailed ? `Due in ${daysTo}d` : `${daysTo}d`;
    } else {
      // Due later
      color = '#6c7086-fg';
      label = detailed ? `Due in ${daysTo}d` : `${daysTo}d`;
    }

    return `{${color}}! ${label}{/}`;  // Changed ⏰ to !
  }

  /**
   * Format progress bar
   */
  formatProgressBar(percent, width = 20) {
    if (percent === null) return '';

    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;

    let color;
    if (percent >= 80) color = '#a6e3a1-fg';       // green
    else if (percent >= 50) color = '#f9e2af-fg';  // yellow
    else if (percent >= 25) color = '#fab387-fg';  // peach
    else color = '#6c7086-fg';                      // dim

    // Use dash for empty portion with visible gray color
    return `{${color}}${'█'.repeat(filled)}{/}{#6c7086-fg}${'-'.repeat(empty)}{/} {#6c7086-fg}${percent}%{/}`;
  }

  /**
   * Render the Kanban board - btop-inspired beauty
   */
  render() {
    // Prevent concurrent renders
    if (this.rendering) {
      return;
    }
    this.rendering = true;

    try {
      const detailLevel = this.getDetailLevel();

      // Completely clear screen
      // First, destroy all children properly
      const children = this.screen.children.slice(); // Copy array
      children.forEach(child => {
        if (child.destroy) {
          child.destroy();
        } else {
          this.screen.remove(child);
        }
      });

      // Destroy old grid if it exists
      if (this.grid) {
        this.grid = null;
      }

      // Clear any stored references
      this.lists = {};
      this.boxes = {};

      // Reset screen buffer
      this.screen.alloc();
      this.screen.realloc();

      // Direct terminal clear using escape codes
      if (process.stdout.isTTY) {
        process.stdout.write('\x1b[2J');  // Clear entire screen
        process.stdout.write('\x1b[H');   // Move cursor to home
      }

      // Render header
      this.renderHeader(detailLevel);

    // Determine layout: swimlanes or classic kanban
    if (this.swimlanes && this.swimlanes.by) {
      // Swimlane layout (2D grid)
      const swimlaneGroups = this.groupBySwimlanes();
      this.renderSwimlaneBoard(swimlaneGroups, detailLevel);
    } else {
      // Classic kanban layout
      const grouped = this.groupByStatus();
      const columns = this.getColumnConfig(detailLevel);
      const visibleCols = columns.filter(c => c.visible);

      // For ultra/spacious mode, use individual card boxes. Otherwise use lists.
      if (detailLevel === 'ultra' || detailLevel === 'spacious') {
        this.renderCardBasedColumns(visibleCols, grouped, detailLevel);
      } else {
        this.renderListBasedColumns(visibleCols, grouped, detailLevel);
      }

      // Status bar at bottom
      this.renderStatusBar(grouped, detailLevel);
    }

      // Force full screen render
      this.screen.render();
    } finally {
      // Always reset rendering flag
      this.rendering = false;
    }
  }

  /**
   * Render columns using blessed.list (for compact/standard/wide modes)
   */
  renderListBasedColumns(visibleCols, grouped, detailLevel) {
    // Ensure we have at least one column
    if (!visibleCols || visibleCols.length === 0) {
      return;
    }

    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });

    // Backlog mode: single column, full width
    if (this.config.backlogMode) {
      const colWidth = 12;  // Full width
      const colOffset = 0;  // No margin

      const statusKey = visibleCols[0].status;
      const columnData = grouped[statusKey] || [];

      this.lists[statusKey] = this.grid.set(1, colOffset, 10, colWidth, blessed.list, {
        label: ` ${visibleCols[0].label} (${columnData.length}) `,
        tags: true,
        style: {
          fg: visibleCols[0].color,
          border: { fg: visibleCols[0].color },
          selected: {
            bg: visibleCols[0].color,
            fg: 'black'
          }
        },
        border: { type: 'line' },
        interactive: false,
        keys: false,
        mouse: false,
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
          ch: '█',
          style: { fg: visibleCols[0].color }
        },
        items: columnData.map(t => this.formatTicketSingleLine(t, detailLevel))
      });
      return;
    }

    const colWidth = Math.max(1, Math.floor(12 / visibleCols.length));

    visibleCols.forEach((col, index) => {
      const statusKey = col.status;
      const columnData = grouped[statusKey] || [];

      this.lists[statusKey] = this.grid.set(1, index * colWidth, 10, colWidth, blessed.list, {
        label: ` ${col.label} (${columnData.length}) `,
        tags: true,
        style: {
          fg: col.color,
          border: { fg: col.color },
          selected: {
            bg: col.color,
            fg: 'black'
          }
        },
        border: { type: 'line' },
        interactive: false,
        keys: false,
        mouse: false,
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
          ch: '█',
          style: { fg: col.color }
        },
        items: columnData.map(t => this.formatTicketSingleLine(t, detailLevel))
      });
    });
  }

  /**
   * Render columns using individual card boxes (for spacious/ultra modes)
   */
  renderCardBasedColumns(visibleCols, grouped, detailLevel) {
    const screenWidth = this.screen.width;
    const screenHeight = this.screen.height;
    const headerHeight = 1;
    const statusBarHeight = 1;
    const columnHeight = screenHeight - headerHeight - statusBarHeight;

    // Backlog mode: single column, full width
    if (this.config.backlogMode) {
      const colWidth = screenWidth; // Full width
      const leftOffset = 0; // No margin

      const statusKey = visibleCols[0].status;
      const columnData = grouped[statusKey] || [];

      const columnBox = blessed.box({
        top: headerHeight,
        left: leftOffset,
        width: colWidth,
        height: columnHeight,
        label: ` ${visibleCols[0].label} (${columnData.length}) `,
        tags: true,
        border: { type: 'line' },
        style: {
          fg: visibleCols[0].color,
          border: { fg: visibleCols[0].color }
        },
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
          ch: '█',
          style: { fg: visibleCols[0].color }
        }
      });

      this.screen.append(columnBox);

      // Add ticket cards
      let yOffset = 0;
      columnData.forEach((ticket, ticketIndex) => {
        const cardContent = this.formatTicketCard(ticket, detailLevel);
        const cardHeight = this.getCardHeight(detailLevel);

        const cardBox = blessed.box({
          top: yOffset,
          left: 0,
          width: '100%-2',
          height: cardHeight,
          content: cardContent,
          tags: true,
          style: {
            fg: '#cdd6f4',
            bg: '#313244'
          },
          padding: { left: 1, right: 1 }
        });

        columnBox.append(cardBox);
        yOffset += cardHeight;
      });

      return;
    }

    const colWidth = Math.floor(screenWidth / visibleCols.length);

    visibleCols.forEach((col, index) => {
      const statusKey = col.status;
      const columnData = grouped[statusKey] || [];

      // Create column container
      const columnBox = blessed.box({
        top: headerHeight,
        left: index * colWidth,
        width: colWidth,
        height: columnHeight,
        label: ` ${col.label} (${columnData.length}) `,
        tags: true,
        border: { type: 'line' },
        style: {
          fg: col.color,
          border: { fg: col.color }
        },
        scrollable: true,
        alwaysScroll: true,
        scrollbar: {
          ch: '█',
          style: { fg: col.color }
        }
      });

      this.screen.append(columnBox);

      // Add ticket cards inside the column
      let yOffset = 0;
      columnData.forEach((ticket, ticketIndex) => {
        const cardContent = this.formatTicketCard(ticket, detailLevel);
        const cardHeight = this.getCardHeight(detailLevel);

        const cardBox = blessed.box({
          top: yOffset,
          left: 0,
          width: '100%-2',
          height: cardHeight,
          content: cardContent,
          tags: true,
          style: {
            fg: 'white'
          }
        });

        columnBox.append(cardBox);
        yOffset += cardHeight + 1; // +1 for spacing between cards
      });

      this.boxes[statusKey] = columnBox;
    });
  }

  /**
   * Get column configuration based on terminal size
   */
  getColumnConfig(detailLevel) {
    // Backlog mode: single column with all incomplete tickets
    if (this.config.backlogMode) {
      return [
        { status: 'all', label: 'BACKLOG', color: '#89b4fa', visible: true }
      ];
    }

    const allColumns = [
      { status: 'backlog', label: 'BACKLOG', color: '#6c7086', visible: false },
      { status: 'todo', label: 'TODO', color: '#89b4fa', visible: true },
      { status: 'in-progress', label: 'IN PROGRESS', color: '#f9e2af', visible: true },
      { status: 'review', label: 'REVIEW', color: '#cba6f7', visible: true },
      { status: 'done', label: 'DONE', color: '#a6e3a1', visible: true }
    ];

    // Show different columns based on detail level
    if (detailLevel === 'ultra' || detailLevel === 'spacious') {
      // Show all 5 columns
      allColumns[0].visible = true; // backlog
    } else if (detailLevel === 'wide') {
      // Show 4 columns (no backlog)
      allColumns[0].visible = false;
    } else if (detailLevel === 'standard') {
      // Show 3 columns (no backlog, no review)
      allColumns[0].visible = false;
      allColumns[3].visible = false;
    } else {
      // compact: Show 3 columns
      allColumns[0].visible = false;
      allColumns[3].visible = false;
    }

    return allColumns;
  }

  /**
   * Render beautiful header bar
   */
  renderHeader(detailLevel) {
    // Use board name from config, or detect type
    let title;
    if (this.config.boardConfig && this.config.boardConfig.name) {
      title = this.config.boardConfig.name.toUpperCase();
    } else if (this.swimlanes && this.swimlanes.by) {
      title = detailLevel === 'compact' ? 'SCRUM' : 'TRACT SCRUM BOARD';
    } else {
      title = detailLevel === 'compact' ? 'KANBAN' : 'TRACT KANBAN BOARD';
    }

    const totalTickets = this.tickets.length;

    const headerBox = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: ` {cyan-fg}{bold}▐ ${title}{/bold}{/}  {#6c7086-fg}│{/}  {#89b4fa-fg}${totalTickets} tickets{/}  {#6c7086-fg}│{/}  {#a6e3a1-fg}${new Date().toLocaleDateString()}{/}`,
      tags: true,
      style: {
        fg: 'white',
        bg: '#1e1e2e'
      }
    });

    this.screen.append(headerBox);
  }

  /**
   * Render swimlane board (2D grid layout)
   */
  renderSwimlaneBoard(swimlaneGroups, detailLevel) {
    const screenWidth = this.screen.width;
    const screenHeight = this.screen.height;
    const headerHeight = 1;
    const statusBarHeight = 1;
    const availableHeight = screenHeight - headerHeight - statusBarHeight;

    // Get columns from board config or use default
    const columns = this.getColumnsFromConfig();
    const numCols = Math.max(1, columns.length);

    // Calculate dimensions with safety checks
    const swimlaneKeys = Object.keys(swimlaneGroups);
    const numSwimlanes = Math.max(1, swimlaneKeys.length);

    // Ensure minimum screen dimensions
    if (screenWidth < 40 || screenHeight < 10) {
      // Screen too small, show error
      const errorBox = blessed.box({
        top: 'center',
        left: 'center',
        width: 'shrink',
        height: 'shrink',
        content: ' Terminal too small. Minimum: 40x10 ',
        tags: true,
        border: { type: 'line' },
        style: {
          border: { fg: 'red' },
          fg: 'red'
        }
      });
      this.screen.append(errorBox);
      return;
    }

    // Calculate label width (10-20 chars depending on screen)
    const swimlaneLabelWidth = Math.max(10, Math.min(20, Math.floor(screenWidth * 0.15)));
    const remainingWidth = Math.max(20, screenWidth - swimlaneLabelWidth - 2);
    const colWidth = Math.max(8, Math.floor(remainingWidth / numCols));

    // Calculate row height with bounds
    const totalRows = numSwimlanes + 1; // +1 for header row
    const idealRowHeight = Math.floor(availableHeight / totalRows);
    let rowHeight = Math.max(3, Math.min(idealRowHeight, 12)); // Between 3 and 12

    // Don't enforce minimum heights if screen is too small
    if (availableHeight > 20) {
      if (detailLevel === 'ultra' && rowHeight < 8) rowHeight = 8;
      else if (detailLevel === 'spacious' && rowHeight < 6) rowHeight = 6;
      else if (detailLevel === 'wide' && rowHeight < 5) rowHeight = 5;
      else if (detailLevel === 'standard' && rowHeight < 4) rowHeight = 4;
    }

    // Ensure we don't exceed available height
    const totalNeededHeight = (numSwimlanes + 1) * rowHeight + 2;
    if (totalNeededHeight > availableHeight) {
      rowHeight = Math.max(3, Math.floor((availableHeight - 2) / (numSwimlanes + 1)));
    }

    // Create table container
    const tableBox = blessed.box({
      top: headerHeight,
      left: 0,
      width: '100%',
      height: availableHeight,
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: '█',
        style: { fg: '#89dceb' }
      }
    });

    this.screen.append(tableBox);

    // Render column headers (with spacing)
    const columnHeaderHeight = 3; // Needs 3 lines minimum for border + content
    let xOffset = swimlaneLabelWidth + 1;
    columns.forEach((col, colIndex) => {
      // Ensure we don't render off-screen
      if (xOffset + colWidth > screenWidth) {
        return;
      }

      const headerBox = blessed.box({
        top: 0,
        left: xOffset,
        width: colWidth - 1,
        height: columnHeaderHeight,
        content: `{center}{bold}{${col.color}}${col.name}{/}{/}{/}`,
        tags: true,
        border: { type: 'line' },
        style: {
          border: { fg: col.color }
        }
      });
      tableBox.append(headerBox);
      xOffset += colWidth;
    });

    // Render swimlane rows (start after headers)
    let yOffset = columnHeaderHeight;
    swimlaneKeys.forEach((swimlaneKey, swimlaneIndex) => {
      // Stop rendering if we've run out of vertical space
      if (yOffset + rowHeight > availableHeight) {
        return;
      }

      const swimlaneLabel = this.getSwimlaneLabel(swimlaneKey);
      const columnGroups = swimlaneGroups[swimlaneKey];

      // Swimlane label (left column) - with spacing
      const labelBox = blessed.box({
        top: yOffset,
        left: 0,
        width: swimlaneLabelWidth - 1,
        height: rowHeight,
        content: `{bold}{#cba6f7-fg}${swimlaneLabel}{/}{/}`,
        tags: true,
        border: { type: 'line' },
        style: {
          border: { fg: '#6c7086' }
        }
      });
      tableBox.append(labelBox);

      // Cells for each column (with spacing)
      xOffset = swimlaneLabelWidth + 1;
      columns.forEach((col, colIndex) => {
        // Ensure we don't render off-screen
        if (xOffset + colWidth > screenWidth || yOffset + rowHeight > availableHeight) {
          return;
        }

        const tickets = columnGroups[colIndex] || [];

        // Render cell with spacing
        const cellBox = blessed.box({
          top: yOffset,
          left: xOffset,
          width: colWidth - 1,
          height: rowHeight,
          tags: true,
          border: { type: 'line' },
          style: {
            border: { fg: '#313244' }
          }
        });

        // Cell content
        const contentWidth = Math.max(1, colWidth - 3);
        const contentHeight = Math.max(1, rowHeight - 2);
        const content = this.formatSwimlaneCell(tickets, contentWidth, contentHeight, col.color);
        cellBox.setContent(content);

        tableBox.append(cellBox);
        xOffset += colWidth;
      });

      yOffset += rowHeight;
    });

    // Render swimlane-aware status bar
    this.renderSwimlaneStatusBar(swimlaneGroups, detailLevel);
  }

  /**
   * Format cell content for swimlane view
   */
  formatSwimlaneCell(tickets, width, height, color = '#89dceb-fg') {
    if (tickets.length === 0) {
      return '{center}{#6c7086-fg}·{/}{/}';
    }

    // Only show counts when height is truly tiny (< 3 rows)
    if (height < 3) {
      const countColor = tickets.length > 0 ? color : '#6c7086-fg';
      return `{center}{${countColor}}{bold}${tickets.length}{/}{/}{/}`;
    }

    // Determine detail level based on available space
    const detailLevel = this.getCellDetailLevel(width, height);
    const lines = [];
    const maxLines = Math.min(height - 1, tickets.length);

    for (let i = 0; i < maxLines; i++) {
      const ticket = tickets[i];
      lines.push(this.formatSwimlaneTicket(ticket, width, detailLevel));
    }

    if (tickets.length > maxLines) {
      lines.push(`{#6c7086-fg}+${tickets.length - maxLines} more{/}`);
    }

    return lines.join('\n');
  }

  /**
   * Get detail level for swimlane cell based on space
   */
  getCellDetailLevel(width, height) {
    if (width >= 50 && height >= 4) return 'rich';
    if (width >= 35 && height >= 3) return 'medium';
    if (width >= 20) return 'compact';
    return 'minimal';
  }

  /**
   * Format a single ticket for swimlane cell
   */
  formatSwimlaneTicket(ticket, width, detailLevel) {
    const id = ticket.id || '???';
    const title = ticket.title || 'Untitled';
    const typeSym = this.getTypeSymbol(ticket.type);
    const priority = ticket.priority || 'medium';
    const assignee = ticket.assignee ? ticket.assignee.split('.')[0] : null;
    const estimate = ticket.estimate || null;
    const due = ticket.due || null;

    const prioritySym = this.getPrioritySymbol(priority);
    const daysToCompletion = this.calculateDaysTo(due);

    switch (detailLevel) {
      case 'minimal':
        // Just type + ID
        return `${typeSym} {cyan-fg}${id}{/}`;

      case 'compact':
        // Type + ID + priority
        return `${typeSym} {cyan-fg}${id}{/} ${prioritySym}`;

      case 'medium':
        // One line: type + ID + title, with metadata on the right
        const mediumMeta = [];
        if (assignee) mediumMeta.push(`{#89b4fa-fg}@${assignee}{/}`);
        mediumMeta.push(prioritySym);

        const mediumMetaStr = mediumMeta.join(' ');
        // Calculate space for title: total width - prefix - metadata - padding
        const mediumPrefix = `${typeSym} ${id} `;
        const mediumMetaPlain = assignee ? `@${assignee} ▱▱▱` : '▱▱▱'; // Rough width estimate
        const mediumTitleSpace = Math.max(10, width - mediumPrefix.length - mediumMetaPlain.length - 2);
        const mediumTitle = title.length > mediumTitleSpace ? title.substring(0, mediumTitleSpace - 1) + '…' : title;

        return `${typeSym} {cyan-fg}{bold}${id}{/bold}{/} ${mediumTitle.padEnd(mediumTitleSpace)} ${mediumMetaStr}`;

      case 'rich':
        // One line: type + ID + title (full width), metadata right-aligned
        const priorityColor = this.getPriorityColor(priority);
        const richMeta = [];
        if (assignee) richMeta.push(`{#89b4fa-fg}@${assignee}{/}`);
        richMeta.push(`{${priorityColor}}${prioritySym}{/}`);
        if (estimate) richMeta.push(`{#cba6f7-fg}~${estimate}{/}`);
        if (due && daysToCompletion !== null) {
          const dueStr = this.formatDueDate(due, daysToCompletion);
          richMeta.push(dueStr);
        }

        const richMetaStr = richMeta.join(' ');

        // Calculate space for title: total width - prefix - metadata - padding
        const richPrefix = `${typeSym} ${id} `;
        // Estimate metadata plain text width (rough approximation)
        const assigneeWidth = assignee ? assignee.length + 1 : 0;
        const estimateWidth = estimate ? estimate.length + 1 : 0;
        const dueWidth = (due && daysToCompletion !== null) ? 6 : 0;
        const richMetaPlain = assigneeWidth + 4 + estimateWidth + dueWidth; // +4 for priority symbols
        const richTitleSpace = Math.max(15, width - richPrefix.length - richMetaPlain - 2);
        const richTitle = title.length > richTitleSpace ? title.substring(0, richTitleSpace - 1) + '…' : title;

        return `${typeSym} {cyan-fg}{bold}${id}{/bold}{/} ${richTitle.padEnd(richTitleSpace)} ${richMetaStr}`;

      default:
        return `${id}`;
    }
  }

  /**
   * Get priority symbol
   */
  getPrioritySymbol(priority) {
    const symbols = {
      blocker: '▰▰▰',
      critical: '▰▰▱',
      major: '▰▱▱',
      minor: '▱▱▱',
      trivial: '···'
    };
    return symbols[priority.toLowerCase()] || '▱▱▱';
  }

  /**
   * Get type symbol for ticket
   */
  getTypeSymbol(type) {
    const symbols = { epic: '◆', story: '●', task: '○', bug: '✕' };
    return symbols[(type || 'task').toLowerCase()] || '○';
  }

  /**
   * Render status bar for swimlane view
   */
  renderSwimlaneStatusBar(swimlaneGroups, detailLevel) {
    const totalTickets = this.tickets.length;
    const numSwimlanes = Object.keys(swimlaneGroups).length;
    const swimlaneField = this.swimlanes.by;

    const statusContent = ` {bold}${totalTickets} tickets{/}  {#6c7086-fg}│{/}  ${numSwimlanes} ${swimlaneField}s  {#6c7086-fg}│{/}  View: {#cba6f7-fg}${detailLevel}{/}  {#6c7086-fg}│{/}  {#6c7086-fg}[q]uit [r]efresh{/}`;

    const statusBar = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: statusContent,
      tags: true,
      style: {
        fg: '#cdd6f4',
        bg: '#1e1e2e'
      }
    });

    this.screen.append(statusBar);
  }

  /**
   * Render status bar with beautiful btop-style info
   */
  renderStatusBar(grouped, detailLevel) {
    const totalTickets = this.tickets.length;

    // Backlog mode: simpler status bar
    if (this.config.backlogMode) {
      const statusContent = ` {#89b4fa-fg}Backlog{/} {#6c7086-fg}│{/} {#cdd6f4-fg}${totalTickets} tickets{/} {#6c7086-fg}│{/} {#6c7086-fg}[q]uit [r]efresh{/}`;
      const statusBar = blessed.box({
        bottom: 0,
        left: 0,
        width: '100%',
        height: 1,
        content: statusContent,
        tags: true,
        style: {
          fg: '#cdd6f4',
          bg: '#1e1e2e'
        }
      });
      this.screen.append(statusBar);
      return;
    }

    const doneCount = grouped.done ? grouped.done.length : 0;
    const inProgressCount = grouped['in-progress'] ? grouped['in-progress'].length : 0;
    const percentage = totalTickets > 0 ? Math.round((doneCount / totalTickets) * 100) : 0;

    // Build progress bar
    const barWidth = 20;
    const filled = Math.round((percentage / 100) * barWidth);
    const progressBar = `{#a6e3a1-fg}${'█'.repeat(filled)}{/}{#313244-fg}${'░'.repeat(barWidth - filled)}{/}`;

    let statusContent;
    if (detailLevel === 'compact') {
      statusContent = ` ${progressBar} ${percentage}% {#6c7086-fg}│{/} [q]uit [r]efresh`;
    } else if (detailLevel === 'standard') {
      statusContent = ` ${progressBar} {#a6e3a1-fg}${doneCount}{/}{#6c7086-fg}/{/}${totalTickets} {#6c7086-fg}│{/} {#f9e2af-fg}${inProgressCount} active{/} {#6c7086-fg}│{/} {#6c7086-fg}[q]uit [r]efresh{/}`;
    } else {
      statusContent = ` ${progressBar} {bold}${percentage}%{/bold} Complete  {#6c7086-fg}│{/}  Done: {#a6e3a1-fg}${doneCount}{/} / ${totalTickets}  {#6c7086-fg}│{/}  Active: {#f9e2af-fg}${inProgressCount}{/}  {#6c7086-fg}│{/}  View: {#cba6f7-fg}${detailLevel}{/}  {#6c7086-fg}│{/}  {#6c7086-fg}[q]uit [r]efresh{/}`;
    }

    const statusBar = blessed.box({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: statusContent,
      tags: true,
      style: {
        fg: '#cdd6f4',
        bg: '#1e1e2e'
      }
    });

    this.screen.append(statusBar);
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
