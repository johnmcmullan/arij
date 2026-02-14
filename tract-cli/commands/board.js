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
    this.boardsDir = path.join(process.cwd(), '.tract', 'boards');
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
      const assignee = this.normalizeUsername(this.options.assignee);
      filtered = filtered.filter(t => 
        t.assignee && t.assignee.toLowerCase() === assignee
      );
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
   * Normalize username (handle @user, ~user, user)
   */
  normalizeUsername(username) {
    if (!username) return null;
    
    // Handle @me or ~me
    if (username === '@me' || username === '~me') {
      return this.getCurrentUser();
    }
    
    // Strip @ or ~ prefix
    return username.replace(/^[@~]/, '').toLowerCase();
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
   * Save current board configuration
   */
  saveBoard(name) {
    if (!fs.existsSync(this.boardsDir)) {
      fs.mkdirSync(this.boardsDir, { recursive: true });
    }

    const config = {
      name: name,
      created: new Date().toISOString(),
      filters: {}
    };

    if (this.options.sprint) config.filters.sprint = this.options.sprint;
    if (this.options.label) config.filters.labels = this.options.label.split(',').map(l => l.trim());
    if (this.options.assignee) config.filters.assignee = this.options.assignee;
    if (this.options.status) config.filters.status = this.options.status.split(',').map(s => s.trim());
    if (this.options.excludeStatus) config.filters.exclude_status = this.options.excludeStatus.split(',').map(s => s.trim());

    const configPath = path.join(this.boardsDir, `${name}.yaml`);
    fs.writeFileSync(configPath, yaml.dump(config), 'utf8');

    console.log(`✓ Saved board config: ${name}`);
    console.log(`  Location: ${configPath}`);
    console.log(`\nRun with: tract board ${name}`);
    process.exit(0);
  }

  /**
   * Load saved board configuration
   */
  loadBoardConfig(name) {
    const configPath = path.join(this.boardsDir, `${name}.yaml`);
    
    if (!fs.existsSync(configPath)) {
      console.error(`Board config not found: ${name}`);
      console.error(`Location checked: ${configPath}`);
      console.error(`\nList available boards: tract board --list`);
      process.exit(1);
    }

    const content = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(content);

    // Merge config filters into options
    if (config.filters) {
      if (config.filters.sprint) this.options.sprint = config.filters.sprint;
      if (config.filters.labels) this.options.label = config.filters.labels.join(',');
      if (config.filters.assignee) this.options.assignee = config.filters.assignee;
      if (config.filters.status) this.options.status = config.filters.status.join(',');
      if (config.filters.exclude_status) this.options.excludeStatus = config.filters.exclude_status.join(',');
    }

    console.log(`Loaded board: ${config.name || name}`);
  }

  /**
   * List saved board configurations
   */
  listBoards() {
    if (!fs.existsSync(this.boardsDir)) {
      console.log('No saved boards yet.');
      console.log('\nCreate one with: tract board [filters] --save <name>');
      process.exit(0);
    }

    const boards = fs.readdirSync(this.boardsDir)
      .filter(f => f.endsWith('.yaml'))
      .map(f => {
        const configPath = path.join(this.boardsDir, f);
        const content = fs.readFileSync(configPath, 'utf8');
        const config = yaml.load(content);
        return {
          name: path.basename(f, '.yaml'),
          config: config
        };
      });

    if (boards.length === 0) {
      console.log('No saved boards yet.');
      console.log('\nCreate one with: tract board [filters] --save <name>');
      process.exit(0);
    }

    console.log('Saved Boards:\n');
    boards.forEach(b => {
      console.log(`  ${b.name}`);
      if (b.config.name) console.log(`    Name: ${b.config.name}`);
      if (b.config.filters) {
        const filters = [];
        if (b.config.filters.sprint) filters.push(`sprint: ${b.config.filters.sprint}`);
        if (b.config.filters.labels) filters.push(`labels: ${b.config.filters.labels.join(', ')}`);
        if (b.config.filters.assignee) filters.push(`assignee: ${b.config.filters.assignee}`);
        if (filters.length > 0) {
          console.log(`    Filters: ${filters.join(' | ')}`);
        }
      }
      console.log('');
    });

    console.log(`Run with: tract board <name>`);
    process.exit(0);
  }

  /**
   * Run the board
   */
  run() {
    // Handle --list flag
    if (this.options.list) {
      return this.listBoards();
    }

    // Handle --save flag
    if (this.options.save) {
      return this.saveBoard(this.options.save);
    }

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
async function boardCommand(args, configName) {
  const options = {
    issuesDir: path.join(process.cwd(), 'issues'),
    sprint: args.sprint || null,
    label: args.label || null,
    assignee: args.assignee || null,
    status: args.status || null,
    excludeStatus: args['exclude-status'] || null,
    noWatch: args['no-watch'] || false,
    save: args.save || null,
    list: args.list || false
  };

  const board = new BoardCommand(options);

  // If config name provided as positional arg, load it
  if (configName && !options.save && !options.list) {
    board.loadBoardConfig(configName);
  }

  board.run();
}

module.exports = boardCommand;
