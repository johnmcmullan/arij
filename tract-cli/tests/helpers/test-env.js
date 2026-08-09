const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const simpleGit = require('simple-git');

/**
 * Test environment helper - creates isolated tract repos for testing
 */
class TestEnv {
  constructor() {
    this.repos = [];
    this.tempDir = null;
  }

  /**
   * Initialize a temporary test directory
   */
  async init() {
    this.tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tract-test-'));
    return this.tempDir;
  }

  /**
   * Validate project name for security
   */
  validateProjectName(project) {
    if (!project || typeof project !== 'string') {
      throw new Error('Project name is required');
    }

    const trimmed = project.trim();

    // Check for empty
    if (trimmed === '') {
      throw new Error('Project name cannot be empty');
    }

    // Security: prevent path traversal
    if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
      throw new Error('Invalid project name: path traversal or path separators not allowed');
    }

    // Security: prevent null bytes
    if (trimmed.includes('\x00')) {
      throw new Error('Invalid project name: null bytes not allowed');
    }

    // Security: prevent special filesystem characters
    if (trimmed.match(/[<>:"|?*~]/)) {
      throw new Error('Invalid project name: special characters not allowed');
    }

    // Must be uppercase alphanumeric
    if (!trimmed.match(/^[A-Z][A-Z0-9]*$/)) {
      throw new Error('Invalid project name: must be uppercase letters and numbers only');
    }

    // Length check
    if (trimmed.length > 100) {
      throw new Error('Project name too long: exceeds limit of 100 characters');
    }

    return trimmed;
  }

  /**
   * Create a new tract repository
   * @param {string} name - Repo name (e.g., 'dev1', 'dev2')
   * @param {object} options - Configuration options
   */
  async createRepo(name, options = {}) {
    // Validate project name for security
    const validProject = this.validateProjectName(options.project || 'TEST');

    const repoPath = path.join(this.tempDir, name);
    await fs.mkdir(repoPath, { recursive: true });

    const git = simpleGit(repoPath);
    await git.init();
    await git.addConfig('user.name', options.userName || 'Test User');
    await git.addConfig('user.email', options.userEmail || 'test@example.com');

    // Create .tract directory structure
    const tractDir = path.join(repoPath, '.tract');
    await fs.mkdir(tractDir, { recursive: true });
    await fs.mkdir(path.join(repoPath, 'issues'), { recursive: true });
    await fs.mkdir(path.join(repoPath, 'worklogs'), { recursive: true });

    // Create minimal config (merge with provided metadata)
    const config = {
      project: validProject,
      mode: options.mode || 'local',
      metadata: options.metadata || {
        types: ['bug', 'story', 'task', 'epic'],
        statuses: ['backlog', 'todo', 'in-progress', 'review', 'done'],
        priorities: ['trivial', 'minor', 'medium', 'major', 'critical', 'blocker']
      }
    };

    if (options.syncUrl) {
      config.sync = {
        enabled: true,
        url: options.syncUrl
      };
    }

    await fs.writeFile(
      path.join(tractDir, 'config.yaml'),
      `# Tract Configuration\nproject: ${config.project}\nmode: ${config.mode}\n`
    );

    // Initial commit
    await git.add('.tract');
    await git.commit('Initial tract setup');

    this.repos.push({ name, path: repoPath, git, config });
    return { path: repoPath, git, config };
  }

  /**
   * Validate ticket key format
   */
  validateTicketKey(key, projectKey) {
    // Check if key exists
    if (key === null || key === undefined) {
      throw new Error('Ticket key is required');
    }

    // Convert to string and trim
    const keyStr = String(key).trim();

    // Check if empty or whitespace-only
    if (keyStr === '') {
      throw new Error('Ticket key is required: empty key not allowed');
    }

    // Check for path traversal attempts
    if (keyStr.includes('..') || keyStr.includes('/') || keyStr.includes('\\')) {
      throw new Error('Invalid ticket key format: path traversal or invalid characters detected');
    }

    // Check for null bytes
    if (keyStr.includes('\x00')) {
      throw new Error('Invalid ticket key format: null bytes not allowed');
    }

    // Validate format: PROJECT-NUMBER
    const keyPattern = /^([A-Z][A-Z0-9]*)-([1-9][0-9]*)$/;
    const match = keyStr.match(keyPattern);

    if (!match) {
      // Provide specific error messages for common mistakes
      if (keyStr.includes(' ')) {
        throw new Error('Invalid ticket key format: spaces not allowed');
      }
      if (keyStr.match(/^[a-z]/)) {
        throw new Error('Invalid ticket key format: project key must be uppercase');
      }
      if (keyStr.match(/^[A-Z]+-$/)) {
        throw new Error('Invalid ticket key format: ticket number is required');
      }
      if (keyStr.match(/^[A-Z]+-0$/)) {
        throw new Error('Invalid ticket key format: ticket number must be positive (not zero)');
      }
      if (keyStr.match(/^[A-Z]+--/)) {
        throw new Error('Invalid ticket key format: negative ticket numbers not allowed');
      }
      if (!keyStr.includes('-')) {
        throw new Error('Invalid ticket key format: hyphen separator required between project and number');
      }
      if (keyStr.match(/[@#$%^&*()+=\[\]{}|;:'",.<>?]/)) {
        throw new Error('Invalid ticket key format: special characters not allowed');
      }

      throw new Error(`Invalid ticket key format: expected PROJECT-NUMBER (e.g., ${projectKey}-1)`);
    }

    const [, project, number] = match;

    // Check length
    if (keyStr.length > 255) {
      throw new Error('Ticket key too long: exceeds limit of 255 characters');
    }

    // Validate project matches repo configuration
    if (projectKey && project !== projectKey) {
      throw new Error(`Project key mismatch: expected ${projectKey} but got ${project}`);
    }

    return { project, number: parseInt(number, 10) };
  }

  /**
   * Validate ticket frontmatter fields
   * Only validates required fields and critical security issues.
   * Field values (type, status, priority) should be validated against
   * project config, not hardcoded lists.
   */
  validateTicketFields(ticket, config) {
    // Required: title must exist and be non-empty
    if (!ticket.title || String(ticket.title).trim() === '') {
      throw new Error('Ticket title is required and cannot be empty');
    }

    // Optional: validate against project config if provided
    if (config && config.metadata) {
      // Validate type if specified and config has type constraints
      if (ticket.type && config.metadata.types && config.metadata.types.length > 0) {
        if (!config.metadata.types.includes(ticket.type)) {
          throw new Error(
            `Invalid ticket type: ${ticket.type}. ` +
            `Project allows: ${config.metadata.types.join(', ')}`
          );
        }
      }

      // Validate status if specified and config has status constraints
      if (ticket.status && config.metadata.statuses && config.metadata.statuses.length > 0) {
        if (!config.metadata.statuses.includes(ticket.status)) {
          throw new Error(
            `Invalid ticket status: ${ticket.status}. ` +
            `Project allows: ${config.metadata.statuses.join(', ')}`
          );
        }
      }

      // Validate priority if specified and config has priority constraints
      if (ticket.priority && config.metadata.priorities && config.metadata.priorities.length > 0) {
        if (!config.metadata.priorities.includes(ticket.priority)) {
          throw new Error(
            `Invalid ticket priority: ${ticket.priority}. ` +
            `Project allows: ${config.metadata.priorities.join(', ')}`
          );
        }
      }
    }

    // Note: Allow custom fields - don't reject unknown properties
    // Users may have custom metadata like severity, customer, etc.
  }

  /**
   * Create a ticket in a repo
   */
  async createTicket(repoName, ticket) {
    const repo = this.repos.find(r => r.name === repoName);
    if (!repo) throw new Error(`Repo ${repoName} not found`);

    // Ensure issues directory exists
    const issuesDir = path.join(repo.path, 'issues');
    await fs.mkdir(issuesDir, { recursive: true });

    // Check for duplicate ticket key FIRST (before validation)
    // This catches case-insensitive conflicts even with malformed keys
    const ticketPath = path.join(issuesDir, `${ticket.key}.md`);
    const exists = await fs.access(ticketPath).then(() => true).catch(() => false);
    if (exists) {
      throw new Error(`Duplicate ticket key: ${ticket.key} already exists`);
    }

    // Also check case-insensitive duplicates (for case-insensitive filesystems)
    const files = await fs.readdir(issuesDir).catch(() => []);
    const lowerKey = `${ticket.key}.md`.toLowerCase();
    const caseConflict = files.find(f => f.toLowerCase() === lowerKey && f !== `${ticket.key}.md`);
    if (caseConflict) {
      throw new Error(`Duplicate ticket key: ${ticket.key} already exists (case-insensitive filesystem conflict)`);
    }

    // Validate ticket key format (SECURITY CRITICAL)
    this.validateTicketKey(ticket.key, repo.config.project);

    // Validate ticket fields against project config (if config provided)
    this.validateTicketFields(ticket, repo.config);

    // Build frontmatter with all provided fields (including custom ones)
    const frontmatter = {
      title: ticket.title,
      type: ticket.type || 'task',
      status: ticket.status || 'backlog',
      priority: ticket.priority || 'medium',
      created: ticket.created || new Date().toISOString()
    };

    if (ticket.assignee) frontmatter.assignee = ticket.assignee;

    // Add all other fields from ticket (custom fields)
    const standardFields = ['key', 'title', 'type', 'status', 'priority', 'assignee', 'created', 'description'];
    for (const [key, value] of Object.entries(ticket)) {
      if (!standardFields.includes(key) && value !== undefined) {
        frontmatter[key] = value;
      }
    }

    // Use js-yaml to properly serialize frontmatter
    // Use flowLevel: -1 to avoid inline formatting, and let it handle escaping
    const yaml = require('js-yaml');
    const content = `---
${yaml.dump(frontmatter, {
  lineWidth: -1,
  noCompatMode: true,
  sortKeys: false
}).trim()}
---

${ticket.description || 'No description'}
`;

    await fs.writeFile(ticketPath, content);
    await repo.git.add('issues');
    await repo.git.commit(`Create ${ticket.key}: ${ticket.title}`);

    return ticketPath;
  }

  /**
   * Clone a repo (simulates another developer cloning)
   */
  async cloneRepo(sourceName, targetName) {
    const source = this.repos.find(r => r.name === sourceName);
    if (!source) throw new Error(`Source repo ${sourceName} not found`);

    const targetPath = path.join(this.tempDir, targetName);
    const git = simpleGit();
    await git.clone(source.path, targetPath);

    const targetGit = simpleGit(targetPath);
    const config = source.config;

    // Clones don't inherit local git config from their source — set identity
    // explicitly rather than relying on a global user.name/user.email being
    // present (true on most dev machines, not true on a clean CI runner).
    await targetGit.addConfig('user.name', 'Test User');
    await targetGit.addConfig('user.email', 'test@example.com');

    this.repos.push({ name: targetName, path: targetPath, git: targetGit, config });
    return { path: targetPath, git: targetGit, config };
  }

  /**
   * Get repo by name
   */
  getRepo(name) {
    return this.repos.find(r => r.name === name);
  }

  /**
   * Cleanup all test repos
   */
  async cleanup() {
    if (this.tempDir) {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    }
    this.repos = [];
    this.tempDir = null;
  }
}

module.exports = TestEnv;
