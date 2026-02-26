#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const blessed = require('blessed');
const chokidar = require('chokidar');
const KanbanView = require('../views/kanban');
const { findWorkspace, loadProjectDirs, loadTicketsFromDir, loadTickets } = require('../lib/ticket-loader');

/**
 * Tract Board - Beautiful TUI dashboard
 * View-only, real-time updates, responsive design
 */

class BoardCommand {
  constructor(options = {}) {
    this.options = options;
    this.sprintsDir = options.sprintsDir || path.join(os.homedir(), '.tract', 'sprints');
    this.tickets = [];
    this.screen = null;
    this.view = null;
    this.watcher = null;
    // Multi-project: detect workspace or fall back to single-project
    const workspaceRoot = findWorkspace(options.workspace || process.cwd());
    if (workspaceRoot) {
      this.workspaceRoot = workspaceRoot;
      this.projectDirs = loadProjectDirs(workspaceRoot, options.project);
      this.boardsDir = path.join(workspaceRoot, '.tract', 'boards');
    } else {
      // Single-project fallback
      this.workspaceRoot = null;
      const singleDir = options.ticketsDir || path.join(process.cwd(), 'tickets');
      // Derive prefix from .tract/config.yaml if present
      const cfgPath = path.join(path.dirname(singleDir), '.tract', 'config.yaml');
      let prefix = null;
      if (fs.existsSync(cfgPath)) {
        try { prefix = yaml.load(fs.readFileSync(cfgPath, 'utf8')).prefix || null; } catch { /* ok */ }
      }
      this.projectDirs = [{ ticketsDir: singleDir, prefix, name: prefix || 'default' }];
      this.boardsDir = path.join(path.dirname(singleDir), '.tract', 'boards');
    }
  }

  /**
   * Detect currently open sprint from .tract/sprints/ directory
   * Returns sprint ID if found, null otherwise
   */
  detectOpenSprint() {
    if (!fs.existsSync(this.sprintsDir)) {
      return null;
    }

    const sprintFiles = fs.readdirSync(this.sprintsDir)
      .filter(f => f.endsWith('.yaml'));

    for (const file of sprintFiles) {
      try {
        const content = fs.readFileSync(path.join(this.sprintsDir, file), 'utf8');
        const sprint = yaml.load(content);

        if (sprint.state === 'open') {
          return path.basename(file, '.yaml'); // Return sprint ID
        }
      } catch (err) {
        // Skip malformed files
        continue;
      }
    }

    return null;
  }

  /**
   * Apply filters to tickets
   */
  applyFilters(tickets) {
    let filtered = [...tickets];

    // Sprint filter
    if (this.options.sprint) {
      if (this.options.sprint === 'all') {
        // No filter - show all tickets
      } else if (this.options.sprint === 'backlog') {
        // Backlog: incomplete tickets NOT in current sprint
        const openSprint = this.detectOpenSprint();
        if (openSprint) {
          // Exclude tickets in current sprint
          filtered = filtered.filter(t => t.sprint !== openSprint);
        }
        // Exclude done/closed tickets
        filtered = filtered.filter(t => !['done', 'closed'].includes(t.status));
      } else if (this.options.sprint === 'current') {
        // Find open sprint from sprint metadata
        const openSprint = this.detectOpenSprint();
        if (openSprint) {
          filtered = filtered.filter(t => t.sprint === openSprint);
        }
      } else if (this.options.sprint === 'latest') {
        // Find most recent sprint from tickets
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
      smartCSR: false,  // Disable smart CSR to avoid rendering artifacts
      title: 'Tract Board',
      fullUnicode: true,
      dockBorders: false,
      ignoreLocked: ['C-c']  // Ensure Ctrl-C always works
    });

    // Quit on Escape, q, or Ctrl-C
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.cleanup();
      process.exit(0);
    });

    // Manual refresh on 'r' key
    this.screen.key(['r'], () => {
      this.reload();
    });

    // Refresh on terminal resize
    this.screen.on('resize', () => {
      if (this.view) {
        this.view.render();
      }
    });
  }

  /**
   * Setup file watcher for real-time updates (all project dirs)
   */
  setupWatcher() {
    const patterns = this.projectDirs
      .filter(p => fs.existsSync(p.ticketsDir))
      .map(p => p.ticketsDir);

    if (patterns.length === 0) return;

    this.watcher = chokidar.watch(patterns, {
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
    const allTickets = loadTickets(this.projectDirs);
    this.tickets = this.applyFilters(allTickets);

    if (this.view) {
      // Destroy current view
      const children = this.screen.children.slice();
      children.forEach(child => {
        if (child.destroy) child.destroy();
        else this.screen.remove(child);
      });

      // Reset screen
      this.screen.alloc();
      this.screen.realloc();

      // Update with fresh render
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

    // Merge config filters into options (for old-style filter configs)
    if (config.filters) {
      if (config.filters.sprint) this.options.sprint = config.filters.sprint;
      if (config.filters.labels) this.options.label = config.filters.labels.join(',');
      if (config.filters.assignee) this.options.assignee = config.filters.assignee;
      if (config.filters.status) this.options.status = config.filters.status.join(',');
      if (config.filters.exclude_status) this.options.excludeStatus = config.filters.exclude_status.join(',');
    }

    // Store full config including swimlanes
    this.options.boardConfig = config;

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

    // Auto-detect sprint if not explicitly set
    if (!this.options.sprint) {
      const openSprint = this.detectOpenSprint();
      if (openSprint) {
        // Sprint is active - show scrum board with that sprint
        this.options.sprint = openSprint;
      }
      // If no open sprint, leave sprint filter as null (shows all tickets / backlog)
    }

    // Load initial data
    const allTickets = loadTickets(this.projectDirs);
    this.tickets = this.applyFilters(allTickets);

    if (this.tickets.length === 0) {
      if (this.workspaceRoot) {
        const dirs = this.projectDirs.map(p => p.ticketsDir).join(', ');
        console.log(`No tickets found across projects: ${dirs}`);
      } else {
        console.log(`No tickets found in ${this.projectDirs[0]?.ticketsDir || 'tickets/'}`);
        console.log('Create some tickets first:');
        console.log('  tract create "My first ticket"');
      }
      process.exit(0);
    }

    // Setup screen
    this.setupScreen();

    // Prepare view config (merge board config if loaded)
    const viewConfig = { ...this.options };
    if (this.options.boardConfig) {
      viewConfig.swimlanes = this.options.boardConfig.swimlanes;
      viewConfig.columns = this.options.boardConfig.columns;
    }

    // Multi-project: auto-enable swimlane-by-project and set header title
    if (this.workspaceRoot && this.projectDirs.length > 1 && !viewConfig.boardConfig?.swimlanes) {
      // Read workspace name for the header
      try {
        const ws = yaml.load(fs.readFileSync(path.join(this.workspaceRoot, '.tract', 'workspace.yaml'), 'utf8'));
        if (!viewConfig.boardConfig) viewConfig.boardConfig = {};
        if (!viewConfig.boardConfig.name) {
          const names = this.projectDirs.map(p => p.prefix).join('+');
          viewConfig.boardConfig.name = ws.workspace?.name
            ? `${ws.workspace.name.toUpperCase()} BOARD`
            : `${names} BOARD`;
        }
      } catch { /* ok — title falls back to KANBAN/SCRUM */ }
      // Swimlane by project so tickets from different repos are visually separated
      if (!viewConfig.swimlanes) {
        viewConfig.swimlanes = { by: 'project' };
      }
    }

    // Set backlog mode if no sprint is active
    viewConfig.backlogMode = !this.options.sprint || this.options.sprint === 'backlog';

    // Create Kanban view
    this.view = new KanbanView(this.screen, this.tickets, viewConfig);
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
 * Commander.js passes: (configName, cmdObj)
 */
async function boardCommand(configName, cmdObj) {
  const options = {
    ticketsDir: path.join(process.cwd(), 'tickets'),
    sprint: cmdObj.sprint || null,
    label: cmdObj.label || null,
    assignee: cmdObj.assignee || null,
    status: cmdObj.status || null,
    excludeStatus: cmdObj.excludeStatus || null,
    noWatch: !cmdObj.watch,
    save: cmdObj.save || null,
    list: cmdObj.list || false,
    project: cmdObj.project || null,       // NEW: filter by project prefix(es)
    workspace: cmdObj.workspace || null    // NEW: explicit workspace root
  };

  const board = new BoardCommand(options);

  // If config name provided as positional arg, load it
  if (configName && typeof configName === 'string' && !options.save && !options.list) {
    board.loadBoardConfig(configName);
  }

  board.run();
}

module.exports = boardCommand;
module.exports.BoardCommand = BoardCommand;
