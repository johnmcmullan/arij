const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

// Mock terminal dependencies before requiring board.js
jest.mock('blessed', () => ({
  screen: jest.fn(() => ({ key: jest.fn(), on: jest.fn(), render: jest.fn(), destroy: jest.fn() }))
}));
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({ on: jest.fn() }))
}));
// Use string concat (not path.join) because jest.mock is hoisted before imports
jest.mock(
  __dirname + '/../../../views/kanban',
  () => jest.fn(() => ({ render: jest.fn(), update: jest.fn() }))
);

const { BoardCommand } = require(path.join(__dirname, '../../../commands/board'));
const { loadTickets } = require(path.join(__dirname, '../../../lib/ticket-loader'));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tract-board-test-'));
}

function createSprintFile(sprintsDir, id, state, extra = {}) {
  if (!fs.existsSync(sprintsDir)) {
    fs.mkdirSync(sprintsDir, { recursive: true });
  }
  const sprint = { name: `Sprint ${id}`, state, start: '2026-02-01', end: '2026-02-14', ...extra };
  fs.writeFileSync(path.join(sprintsDir, `${id}.yaml`), yaml.dump(sprint));
}

function createTicketFile(ticketsDir, ticket) {
  if (!fs.existsSync(ticketsDir)) {
    fs.mkdirSync(ticketsDir, { recursive: true });
  }
  const frontmatter = {
    id: ticket.id,
    title: ticket.title || 'Test ticket',
    status: ticket.status || 'todo',
    priority: ticket.priority || 'medium',
    labels: ticket.labels || [],
    assignee: ticket.assignee || null,
    sprints: ticket.sprints || [],
    type: ticket.type || 'task',
    estimate: ticket.estimate || null,
  };
  const content = `---\n${yaml.dump(frontmatter)}---\n\nDescription here.\n`;
  fs.writeFileSync(path.join(ticketsDir, `${ticket.id}.md`), content);
}

function makeBoard(overrides = {}) {
  const tempDir = makeTempDir();
  const options = {
    ticketsDir: path.join(tempDir, 'tickets'),
    sprint: null,
    label: null,
    assignee: null,
    status: null,
    excludeStatus: null,
    ...overrides
  };
  const board = new BoardCommand(options);
  // Point sprintsDir at our temp dir (avoids touching real ~/.tract/sprints)
  board.sprintsDir = path.join(tempDir, '.tract', 'sprints');
  board._tempDir = tempDir;
  return board;
}

// ─── detectOpenSprint ────────────────────────────────────────────────────────

describe('BoardCommand.detectOpenSprint()', () => {
  let board;

  beforeEach(() => {
    board = makeBoard();
  });

  afterEach(() => {
    fs.rmSync(board._tempDir, { recursive: true, force: true });
  });

  it('returns null when sprints directory does not exist', () => {
    expect(board.detectOpenSprint()).toBeNull();
  });

  it('returns null when no sprints exist', () => {
    fs.mkdirSync(board.sprintsDir, { recursive: true });
    expect(board.detectOpenSprint()).toBeNull();
  });

  it('returns null when all sprints are closed', () => {
    createSprintFile(board.sprintsDir, 'sprint-1', 'closed');
    createSprintFile(board.sprintsDir, 'sprint-2', 'closed');
    expect(board.detectOpenSprint()).toBeNull();
  });

  it('returns the ID of the open sprint', () => {
    createSprintFile(board.sprintsDir, 'sprint-1', 'closed');
    createSprintFile(board.sprintsDir, 'sprint-2', 'open');
    expect(board.detectOpenSprint()).toBe('sprint-2');
  });

  it('returns the first open sprint if multiple are open', () => {
    createSprintFile(board.sprintsDir, 'sprint-1', 'open');
    createSprintFile(board.sprintsDir, 'sprint-2', 'open');
    const result = board.detectOpenSprint();
    expect(['sprint-1', 'sprint-2']).toContain(result);
  });

  it('skips malformed sprint files', () => {
    createSprintFile(board.sprintsDir, 'sprint-good', 'open');
    fs.writeFileSync(path.join(board.sprintsDir, 'broken.yaml'), 'not: valid: yaml: [[[');
    // Should still find the good sprint (or return null, not throw)
    const result = board.detectOpenSprint();
    // May be 'sprint-good' or null depending on file order, but must not throw
    expect(typeof result === 'string' || result === null).toBe(true);
  });
});

// ─── loadTickets (now in ticket-loader.js) ───────────────────────────────────
// loadTickets was extracted from BoardCommand into lib/ticket-loader.js.
// These tests verify board.projectDirs is wired correctly so loadTickets
// picks up the right directory.

describe('loadTickets() via board.projectDirs', () => {
  let board;

  beforeEach(() => {
    board = makeBoard();
  });

  afterEach(() => {
    fs.rmSync(board._tempDir, { recursive: true, force: true });
  });

  it('returns empty array when issues dir does not exist', () => {
    expect(loadTickets(board.projectDirs)).toEqual([]);
  });

  it('loads tickets from markdown files', () => {
    createTicketFile(board.options.ticketsDir, { id: 'TEST-1', title: 'First', status: 'todo' });
    createTicketFile(board.options.ticketsDir, { id: 'TEST-2', title: 'Second', status: 'done' });

    const tickets = loadTickets(board.projectDirs);
    expect(tickets).toHaveLength(2);
    expect(tickets.map(t => t.id).sort()).toEqual(['TEST-1', 'TEST-2']);
  });

  it('extracts status, title, priority, labels from frontmatter', () => {
    createTicketFile(board.options.ticketsDir, {
      id: 'TEST-1',
      title: 'Bug fix',
      status: 'in-progress',
      priority: 'critical',
      labels: ['urgent', 'backend']
    });

    const tickets = loadTickets(board.projectDirs);
    expect(tickets[0].title).toBe('Bug fix');
    expect(tickets[0].status).toBe('in-progress');
    expect(tickets[0].priority).toBe('critical');
    expect(tickets[0].labels).toEqual(['urgent', 'backend']);
  });

  it('derives sprint from last element of sprints array', () => {
    createTicketFile(board.options.ticketsDir, {
      id: 'TEST-1',
      title: 'Sprint ticket',
      sprints: ['sprint-1', 'sprint-2']
    });

    const tickets = loadTickets(board.projectDirs);
    expect(tickets[0].sprint).toBe('sprint-2');
    expect(tickets[0].sprints).toEqual(['sprint-1', 'sprint-2']);
  });

  it('skips files without frontmatter', () => {
    fs.mkdirSync(board.options.ticketsDir, { recursive: true });
    fs.writeFileSync(path.join(board.options.ticketsDir, 'no-frontmatter.md'), '# Just a heading\n\nNo YAML here.');

    const tickets = loadTickets(board.projectDirs);
    expect(tickets).toHaveLength(0);
  });

  it('ignores non-.md files', () => {
    fs.mkdirSync(board.options.ticketsDir, { recursive: true });
    fs.writeFileSync(path.join(board.options.ticketsDir, 'README.txt'), 'not a ticket');

    const tickets = loadTickets(board.projectDirs);
    expect(tickets).toHaveLength(0);
  });
});

// ─── applyFilters ────────────────────────────────────────────────────────────

describe('BoardCommand.applyFilters()', () => {
  // Sample tickets covering various sprint/status combinations
  const tickets = [
    { id: 'T-1', status: 'todo',        sprint: 'sprint-2', sprints: ['sprint-1', 'sprint-2'], labels: ['backend'], assignee: 'alice' },
    { id: 'T-2', status: 'in-progress', sprint: 'sprint-2', sprints: ['sprint-2'],              labels: ['frontend'], assignee: 'bob' },
    { id: 'T-3', status: 'done',        sprint: 'sprint-2', sprints: ['sprint-1', 'sprint-2'], labels: ['backend'], assignee: 'alice' },
    { id: 'T-4', status: 'todo',        sprint: 'sprint-1', sprints: ['sprint-1'],              labels: ['devops'],   assignee: 'carol' },
    { id: 'T-5', status: 'backlog',     sprint: null,       sprints: [],                        labels: [],          assignee: null },
    { id: 'T-6', status: 'closed',      sprint: 'sprint-1', sprints: ['sprint-1'],              labels: ['backend'], assignee: 'alice' },
  ];

  function boardWith(options) {
    const board = new BoardCommand({ ticketsDir: '/fake', ...options });
    // Stub detectOpenSprint to return 'sprint-2' as the "current" open sprint
    board.detectOpenSprint = () => 'sprint-2';
    return board;
  }

  describe('sprint: all', () => {
    it('returns all tickets unfiltered', () => {
      const board = boardWith({ sprint: 'all' });
      expect(board.applyFilters(tickets)).toHaveLength(tickets.length);
    });
  });

  describe('sprint: specific ID', () => {
    it('returns only tickets in that sprint', () => {
      const board = boardWith({ sprint: 'sprint-1' });
      const result = board.applyFilters(tickets);
      expect(result.every(t => t.sprint === 'sprint-1')).toBe(true);
      expect(result.map(t => t.id).sort()).toEqual(['T-4', 'T-6']);
    });

    it('returns empty array for unknown sprint', () => {
      const board = boardWith({ sprint: 'sprint-99' });
      expect(board.applyFilters(tickets)).toHaveLength(0);
    });
  });

  describe('sprint: current', () => {
    it('returns tickets in the open sprint', () => {
      const board = boardWith({ sprint: 'current' });
      const result = board.applyFilters(tickets);
      expect(result.every(t => t.sprint === 'sprint-2')).toBe(true);
      expect(result).toHaveLength(3); // T-1, T-2, T-3
    });
  });

  describe('sprint: latest', () => {
    it('returns tickets in the most recent sprint (by sort order)', () => {
      const board = boardWith({ sprint: 'latest' });
      const result = board.applyFilters(tickets);
      // sprint-2 > sprint-1 alphabetically
      expect(result.every(t => t.sprint === 'sprint-2')).toBe(true);
    });
  });

  describe('sprint: backlog', () => {
    it('excludes tickets in the current sprint', () => {
      const board = boardWith({ sprint: 'backlog' });
      const result = board.applyFilters(tickets);
      expect(result.every(t => t.sprint !== 'sprint-2')).toBe(true);
    });

    it('excludes done and closed tickets', () => {
      const board = boardWith({ sprint: 'backlog' });
      const result = board.applyFilters(tickets);
      expect(result.every(t => !['done', 'closed'].includes(t.status))).toBe(true);
    });

    it('includes todo tickets not in current sprint', () => {
      const board = boardWith({ sprint: 'backlog' });
      const result = board.applyFilters(tickets);
      const ids = result.map(t => t.id);
      expect(ids).toContain('T-4'); // todo in sprint-1
      expect(ids).toContain('T-5'); // backlog with no sprint
    });

    it('excludes tickets in the current sprint even if not done', () => {
      const board = boardWith({ sprint: 'backlog' });
      const result = board.applyFilters(tickets);
      expect(result.find(t => t.id === 'T-1')).toBeUndefined(); // todo but in sprint-2
      expect(result.find(t => t.id === 'T-2')).toBeUndefined(); // in-progress in sprint-2
    });
  });

  describe('label filter', () => {
    it('returns tickets matching the label', () => {
      const board = boardWith({ label: 'backend' });
      const result = board.applyFilters(tickets);
      expect(result.every(t => t.labels.includes('backend'))).toBe(true);
      expect(result.map(t => t.id).sort()).toEqual(['T-1', 'T-3', 'T-6']);
    });

    it('supports comma-separated labels (OR logic)', () => {
      const board = boardWith({ label: 'frontend,devops' });
      const result = board.applyFilters(tickets);
      expect(result.map(t => t.id).sort()).toEqual(['T-2', 'T-4']);
    });
  });

  describe('assignee filter', () => {
    it('filters by username', () => {
      const board = boardWith({ assignee: 'alice' });
      const result = board.applyFilters(tickets);
      expect(result.every(t => t.assignee === 'alice')).toBe(true);
      expect(result).toHaveLength(3); // T-1, T-3, T-6
    });

    it('is case-insensitive', () => {
      const board = boardWith({ assignee: 'ALICE' });
      const result = board.applyFilters(tickets);
      expect(result).toHaveLength(3);
    });

    it('strips @ prefix', () => {
      const board = boardWith({ assignee: '@alice' });
      const result = board.applyFilters(tickets);
      expect(result).toHaveLength(3);
    });

    it('returns empty when no tickets match', () => {
      const board = boardWith({ assignee: 'nobody' });
      expect(board.applyFilters(tickets)).toHaveLength(0);
    });
  });

  describe('status filter', () => {
    it('includes only specified statuses', () => {
      const board = boardWith({ status: 'todo,done' });
      const result = board.applyFilters(tickets);
      expect(result.every(t => ['todo', 'done'].includes(t.status))).toBe(true);
    });
  });

  describe('excludeStatus filter', () => {
    it('excludes specified statuses', () => {
      const board = boardWith({ excludeStatus: 'done,closed' });
      const result = board.applyFilters(tickets);
      expect(result.every(t => !['done', 'closed'].includes(t.status))).toBe(true);
    });
  });

  describe('combined filters', () => {
    it('applies sprint and label together', () => {
      const board = boardWith({ sprint: 'sprint-2', label: 'backend' });
      const result = board.applyFilters(tickets);
      // T-1 and T-3 are in sprint-2 AND have label backend
      expect(result.map(t => t.id).sort()).toEqual(['T-1', 'T-3']);
    });
  });
});

// ─── normalizeUsername ───────────────────────────────────────────────────────

describe('BoardCommand.normalizeUsername()', () => {
  let board;

  beforeEach(() => {
    board = new BoardCommand({ ticketsDir: '/fake' });
    // Stub getCurrentUser to avoid git dependency
    board.getCurrentUser = () => 'testuser';
  });

  it('returns null for null input', () => {
    expect(board.normalizeUsername(null)).toBeNull();
  });

  it('lowercases plain username', () => {
    expect(board.normalizeUsername('Alice')).toBe('alice');
  });

  it('strips @ prefix', () => {
    expect(board.normalizeUsername('@alice')).toBe('alice');
  });

  it('strips ~ prefix', () => {
    expect(board.normalizeUsername('~alice')).toBe('alice');
  });

  it('resolves @me to current user', () => {
    expect(board.normalizeUsername('@me')).toBe('testuser');
  });

  it('resolves ~me to current user', () => {
    expect(board.normalizeUsername('~me')).toBe('testuser');
  });
});
