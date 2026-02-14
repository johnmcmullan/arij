#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const blessed = require('blessed');
const chokidar = require('chokidar');
const KanbanView = require('../views/kanban');

/**
 * Tract Board - Beautiful TUI dashboard
 * View-only, real-time updates, responsive design
 */

class BoardCommand {
  constructor(options = {}) {
    this.options = options;
    this.issuesDir = options.issuesDir || path.join(process.cwd(), 'issues');
    this.tickets = [];
    this.screen = null;
    this.view = null;
    this.watcher = null;
  }

  /**
   * Load all tickets from markdown files
   */
  loadTickets() {
    if (!fs.existsSync(this.issuesDir)) {
      return [];
    }

    const files = fs.readdirSync(this.issuesDir)
      .filter(f => f.endsWith('.md'));

    const tickets = [];

    files.forEach(file => {
      const filePath = path.join(this.issuesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');

      // Extract frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) return;

      try {
        const frontmatter = yaml.load(frontmatterMatch[1]);
        const ticket = {
          id: frontmatter.id || path.basename(file, '.md'),
          title: frontmatter.title || '',
          status: frontmatter.status || 'todo',
          assignee: frontmatter.assignee || null,
          priority: frontmatter.priority || 'medium',
          labels: frontmatter.labels || [],
          sprint: frontmatter.sprint || null,
          blocked_by: frontmatter.blocked_by || null,
          blocks: frontmatter.blocks || null,
          created: frontmatter.created || null,
          updated: frontmatter.updated || null
        };

        tickets.push(ticket);
      } catch (err) {
        console.error(`Error parsing ${file}:`, err.message);
      }
    });

    return tickets;
  }

  /**
   * Apply filters to tickets
   */
  applyFilters(tickets) {
    let filtered = [...tickets];

    // Sprint filter
    if (this.options.sprint) {
      if (this.options.sprint === 'all') {
        // No filter
      } else if (this.options.sprint === 'latest' || this.options.sprint === 'current') {
        // Find most recent sprint
        const sprints = tickets
          .map(t => t.sprint)
          .filter(Boolean)
          .sort()
          .reverse();
        
        const latestSprint = sprints[0];
        if (latestSprint) {
          filtered = filtered.filter(t => t.sprint === latestSprint);
        }
      } else {
        // Specific sprint
        filtered = filtered.filter(t => t.sprint === this.options.sprint);
      }
    }

    // Label filter
    if (this.options.label) {
      const labels = this.options.label.split(',').map(l => l.trim());
      filtered = filtered.filter(t => 
        labels.some(label => (t.labels || []).includes(label))
      );
    }

    // Assignee filter
    if (this.options.assignee) {
      const assignee = this.options.assignee === '@me' 
        ? this.getCurrentUser() 
        : this.options.assignee;
      
      filtered = filtered.filter(t => t.assignee === assignee);
    }

    // Status filter
    if (this.options.status) {
      const statuses = this.options.status.split(',').map(s => s.trim());
      filtered = filtered.filter(t => statuses.includes(t.status));
    }

    // Exclude status
    if (this.options.excludeStatus) {
      const excluded = this.options.excludeStatus.split(',').map(s => s.trim());
      filtered = filtered.filter(t => !excluded.includes(t.status));
    }

    return filtered;
  }

  /**
   * Get current user from git config
   */
  getCurrentUser() {
    try {
      const { execSync } = require('child_process');
      const gitUser = execSync('git config user.name', { encoding: 'utf8' }).trim();
      return gitUser.toLowerCase();
    } catch (err) {
      return process.env.USER || process.env.USERNAME || 'unknown';
    }
  }

  /**
   * Setup blessed screen
   */
  setupScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Tract Board',
      fullUnicode: true
    });

    // Quit on Escape, q, or Ctrl-C
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.cleanup();
      process.exit(0);
    });

    // Refresh on terminal resize
    this.screen.on('resize', () => {
      if (this.view) {
        this.view.render();
      }
    });
  }

  /**
   * Setup file watcher for real-time updates
   */
  setupWatcher() {
    this.watcher = chokidar.watch(`${this.issuesDir}/*.md`, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher
      .on('add', () => this.reload())
      .on('change', () => this.reload())
      .on('unlink', () => this.reload());
  }

  /**
   * Reload tickets and re-render
   */
  reload() {
    const allTickets = this.loadTickets();
    this.tickets = this.applyFilters(allTickets);
    
    if (this.view) {
      this.view.update(this.tickets);
    }
  }

  /**
   * Cleanup watchers and screen
   */
  cleanup() {
    if (this.watcher) {
      this.watcher.close();
    }
    if (this.screen) {
      this.screen.destroy();
    }
  }

  /**
   * Run the board
   */
  run() {
    // Load initial data
    const allTickets = this.loadTickets();
    this.tickets = this.applyFilters(allTickets);

    if (this.tickets.length === 0) {
      console.log('No tickets found in issues/');
      console.log('Create some tickets first:');
      console.log('  tract create "My first ticket"');
      process.exit(0);
    }

    // Setup screen
    this.setupScreen();

    // Create Kanban view
    this.view = new KanbanView(this.screen, this.tickets, this.options);
    this.view.render();

    // Setup file watcher for real-time updates
    if (!this.options.noWatch) {
      this.setupWatcher();
    }

    // Initial render
    this.screen.render();
  }
}

/**
 * Command handler
 */
async function boardCommand(args) {
  const options = {
    issuesDir: path.join(process.cwd(), 'issues'),
    sprint: args.sprint || null,
    label: args.label || null,
    assignee: args.assignee || null,
    status: args.status || null,
    excludeStatus: args['exclude-status'] || null,
    noWatch: args['no-watch'] || false
  };

  const board = new BoardCommand(options);
  board.run();
}

module.exports = boardCommand;
