const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const {
  findWorkspace,
  loadProjectDirs,
  loadTicketsFromDir,
  loadTickets,
  listTicketFiles,
  findTicketFile,
  shardFor
} = require(path.join(__dirname, '../../../lib/ticket-loader'));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tract-loader-test-'));
}

function writeYaml(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.dump(data));
}

function createTicket(ticketsDir, ticket) {
  fs.mkdirSync(ticketsDir, { recursive: true });
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
    ...(ticket.extra || {})
  };
  const content = `---\n${yaml.dump(frontmatter)}---\n\nDescription.\n`;
  fs.writeFileSync(path.join(ticketsDir, `${ticket.id}.md`), content);
}

// ─── findWorkspace ────────────────────────────────────────────────────────────

describe('findWorkspace()', () => {
  let tmp;

  beforeEach(() => { tmp = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('returns null when no workspace.yaml exists', () => {
    expect(findWorkspace(tmp)).toBeNull();
  });

  it('returns the directory containing .tract/workspace.yaml', () => {
    fs.mkdirSync(path.join(tmp, '.tract'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.tract', 'workspace.yaml'), 'projects: []');
    expect(findWorkspace(tmp)).toBe(tmp);
  });

  it('finds workspace.yaml by walking up from a subdirectory', () => {
    fs.mkdirSync(path.join(tmp, '.tract'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.tract', 'workspace.yaml'), 'projects: []');
    const deep = path.join(tmp, 'projectA', 'src', 'lib');
    fs.mkdirSync(deep, { recursive: true });
    expect(findWorkspace(deep)).toBe(tmp);
  });

  it('returns null when workspace.yaml is in an unrelated directory', () => {
    // No workspace.yaml anywhere in tmp
    const sub = path.join(tmp, 'a', 'b');
    fs.mkdirSync(sub, { recursive: true });
    expect(findWorkspace(sub)).toBeNull();
  });
});

// ─── loadProjectDirs ──────────────────────────────────────────────────────────

describe('loadProjectDirs()', () => {
  let tmp;

  beforeEach(() => { tmp = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  function setup(workspaceYaml, dirs = []) {
    fs.mkdirSync(path.join(tmp, '.tract'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.tract', 'workspace.yaml'), yaml.dump(workspaceYaml));
    for (const d of dirs) {
      fs.mkdirSync(path.join(tmp, d), { recursive: true });
    }
  }

  it('returns empty array for empty projects list', () => {
    setup({ projects: [] });
    expect(loadProjectDirs(tmp, null)).toEqual([]);
  });

  it('returns project dirs for projects that exist', () => {
    setup(
      { projects: [{ prefix: 'APP', name: 'app' }] },
      ['app/tickets']
    );
    const dirs = loadProjectDirs(tmp, null);
    expect(dirs).toHaveLength(1);
    expect(dirs[0].prefix).toBe('APP');
    expect(dirs[0].name).toBe('app');
    expect(dirs[0].ticketsDir).toBe(path.join(tmp, 'app', 'tickets'));
  });

  it('skips projects whose tickets dir does not exist', () => {
    setup({ projects: [
      { prefix: 'APP', name: 'app' },
      { prefix: 'FE', name: 'frontend' }
    ]}, ['app/tickets']); // frontend/tickets missing

    const dirs = loadProjectDirs(tmp, null);
    expect(dirs).toHaveLength(1);
    expect(dirs[0].prefix).toBe('APP');
  });

  it('filters by projectFilter (comma-separated prefixes)', () => {
    setup({ projects: [
      { prefix: 'APP', name: 'app' },
      { prefix: 'FE', name: 'frontend' },
      { prefix: 'BE', name: 'backend' }
    ]}, ['app/tickets', 'frontend/tickets', 'backend/tickets']);

    const dirs = loadProjectDirs(tmp, 'APP,FE');
    expect(dirs.map(d => d.prefix).sort()).toEqual(['APP', 'FE']);
  });

  it('projectFilter is case-insensitive', () => {
    setup({ projects: [{ prefix: 'APP', name: 'app' }] }, ['app/tickets']);
    const dirs = loadProjectDirs(tmp, 'app');
    expect(dirs).toHaveLength(1);
  });

  it('uses p.path when specified', () => {
    setup({ projects: [{ prefix: 'APP', path: 'custom/path' }] }, ['custom/path/tickets']);
    const dirs = loadProjectDirs(tmp, null);
    expect(dirs[0].ticketsDir).toBe(path.join(tmp, 'custom', 'path', 'tickets'));
  });

  it('returns empty array and logs warning when workspace.yaml is malformed', () => {
    fs.mkdirSync(path.join(tmp, '.tract'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.tract', 'workspace.yaml'), 'not: valid: yaml: [[[');
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const dirs = loadProjectDirs(tmp, null);
    expect(dirs).toEqual([]);
    consoleSpy.mockRestore();
  });
});

// ─── loadTicketsFromDir ───────────────────────────────────────────────────────

describe('loadTicketsFromDir()', () => {
  let ticketsDir;
  let tmp;

  beforeEach(() => {
    tmp = makeTempDir();
    ticketsDir = path.join(tmp, 'tickets');
    fs.mkdirSync(ticketsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns empty array for empty directory', () => {
    expect(loadTicketsFromDir(ticketsDir, 'APP')).toEqual([]);
  });

  it('loads a ticket with all standard fields', () => {
    createTicket(ticketsDir, {
      id: 'APP-1',
      title: 'Fix auth bug',
      status: 'in-progress',
      priority: 'critical',
      labels: ['auth', 'backend'],
      assignee: 'alice',
      sprints: ['2026-W06', '2026-W07'],
      type: 'bug',
      estimate: '4h'
    });

    const tickets = loadTicketsFromDir(ticketsDir, 'APP');
    expect(tickets).toHaveLength(1);
    const t = tickets[0];
    expect(t.id).toBe('APP-1');
    expect(t.title).toBe('Fix auth bug');
    expect(t.status).toBe('in-progress');
    expect(t.priority).toBe('critical');
    expect(t.labels).toEqual(['auth', 'backend']);
    expect(t.assignee).toBe('alice');
    expect(t.sprint).toBe('2026-W07');
    expect(t.sprints).toEqual(['2026-W06', '2026-W07']);
    expect(t.type).toBe('bug');
    expect(t.estimate).toBe('4h');
    expect(t.project).toBe('APP');
  });

  it('derives project from prefix argument when frontmatter lacks it', () => {
    createTicket(ticketsDir, { id: 'APP-1', title: 'Test' });
    const tickets = loadTicketsFromDir(ticketsDir, 'APP');
    expect(tickets[0].project).toBe('APP');
  });

  it('derives project from ticket ID when no prefix provided', () => {
    createTicket(ticketsDir, { id: 'MYPROJ-42', title: 'Test' });
    const tickets = loadTicketsFromDir(ticketsDir, null);
    expect(tickets[0].project).toBe('MYPROJ');
  });

  it('sets sprint to last element of sprints array', () => {
    createTicket(ticketsDir, { id: 'T-1', title: 'x', sprints: ['s1', 's2', 's3'] });
    expect(loadTicketsFromDir(ticketsDir, null)[0].sprint).toBe('s3');
  });

  it('sets sprint to null when sprints array is empty', () => {
    createTicket(ticketsDir, { id: 'T-1', title: 'x', sprints: [] });
    expect(loadTicketsFromDir(ticketsDir, null)[0].sprint).toBeNull();
  });

  it('skips files without YAML frontmatter', () => {
    fs.writeFileSync(path.join(ticketsDir, 'no-fm.md'), '# Just a heading\n\nNo YAML.');
    expect(loadTicketsFromDir(ticketsDir, 'APP')).toHaveLength(0);
  });

  it('ignores non-.md files', () => {
    fs.writeFileSync(path.join(ticketsDir, 'README.txt'), 'not a ticket');
    fs.writeFileSync(path.join(ticketsDir, 'data.json'), '{}');
    expect(loadTicketsFromDir(ticketsDir, 'APP')).toHaveLength(0);
  });

  it('includes logged/remaining/loggedSeconds/estimateSeconds fields', () => {
    createTicket(ticketsDir, { id: 'T-1', title: 'x', estimate: '4h' });
    const t = loadTicketsFromDir(ticketsDir, null)[0];
    expect(t).toHaveProperty('logged');
    expect(t).toHaveProperty('remaining');
    expect(t).toHaveProperty('loggedSeconds');
    expect(t).toHaveProperty('estimateSeconds');
  });
});

// ─── loadTickets ─────────────────────────────────────────────────────────────

describe('loadTickets()', () => {
  let tmp;

  beforeEach(() => { tmp = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('returns empty array for no project dirs', () => {
    expect(loadTickets([])).toEqual([]);
  });

  it('aggregates tickets from multiple project dirs', () => {
    const dir1 = path.join(tmp, 'proj1', 'tickets');
    const dir2 = path.join(tmp, 'proj2', 'tickets');
    createTicket(dir1, { id: 'APP-1', title: 'A' });
    createTicket(dir1, { id: 'APP-2', title: 'B' });
    createTicket(dir2, { id: 'FE-1', title: 'C' });

    const projectDirs = [
      { ticketsDir: dir1, prefix: 'APP', name: 'app' },
      { ticketsDir: dir2, prefix: 'FE', name: 'frontend' }
    ];
    const tickets = loadTickets(projectDirs);
    expect(tickets).toHaveLength(3);
    expect(tickets.map(t => t.id).sort()).toEqual(['APP-1', 'APP-2', 'FE-1']);
  });

  it('skips project dirs that do not exist', () => {
    const dir1 = path.join(tmp, 'real', 'tickets');
    createTicket(dir1, { id: 'APP-1', title: 'A' });

    const projectDirs = [
      { ticketsDir: dir1, prefix: 'APP', name: 'app' },
      { ticketsDir: path.join(tmp, 'missing', 'tickets'), prefix: 'FE', name: 'frontend' }
    ];
    expect(loadTickets(projectDirs)).toHaveLength(1);
  });

  it('assigns correct project prefix per dir', () => {
    const dir1 = path.join(tmp, 'p1', 'tickets');
    const dir2 = path.join(tmp, 'p2', 'tickets');
    createTicket(dir1, { id: 'APP-1', title: 'A' });
    createTicket(dir2, { id: 'FE-1', title: 'B' });

    const tickets = loadTickets([
      { ticketsDir: dir1, prefix: 'APP', name: 'app' },
      { ticketsDir: dir2, prefix: 'FE', name: 'fe' }
    ]);
    const app = tickets.find(t => t.id === 'APP-1');
    const fe = tickets.find(t => t.id === 'FE-1');
    expect(app.project).toBe('APP');
    expect(fe.project).toBe('FE');
  });
});

// ─── shardFor ────────────────────────────────────────────────────────────────

describe('shardFor()', () => {
  it('returns the last digit of the numeric suffix', () => {
    expect(shardFor('APP-123')).toBe('3');
    expect(shardFor('TB-10')).toBe('0');
  });

  it('returns "other" when there is no numeric suffix', () => {
    expect(shardFor('NONUMBER')).toBe('other');
  });
});

// ─── listTicketFiles ─────────────────────────────────────────────────────────

describe('listTicketFiles()', () => {
  let tmp, ticketsDir;

  beforeEach(() => {
    tmp = makeTempDir();
    ticketsDir = path.join(tmp, 'tickets');
    fs.mkdirSync(ticketsDir, { recursive: true });
  });

  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('loads a ticket from a digit shard directory (tickets/3/APP-123.md)', () => {
    createTicket(path.join(ticketsDir, '3'), { id: 'APP-123', title: 'Sharded ticket' });

    const files = listTicketFiles(ticketsDir);
    expect(files).toHaveLength(1);
    expect(files[0].id).toBe('APP-123');
    expect(files[0].path).toBe(path.join(ticketsDir, '3', 'APP-123.md'));
  });

  it('still loads flat tickets/APP-1.md', () => {
    createTicket(ticketsDir, { id: 'APP-1', title: 'Flat ticket' });

    const files = listTicketFiles(ticketsDir);
    expect(files).toHaveLength(1);
    expect(files[0].id).toBe('APP-1');
    expect(files[0].path).toBe(path.join(ticketsDir, 'APP-1.md'));
  });

  it('does not load drafts under tickets/new/', () => {
    createTicket(path.join(ticketsDir, 'new'), { id: 'NEW', title: 'foo' });
    // createTicket names the file after the id ("NEW.md"); simulate the real
    // draft filename shape (slug-timestamp.md) too, to be thorough.
    fs.writeFileSync(path.join(ticketsDir, 'new', 'foo.md'), '---\nid: NEW\ntitle: foo\n---\n');

    const files = listTicketFiles(ticketsDir);
    expect(files).toHaveLength(0);
  });

  it('ignores non-digit, non-"new" directories', () => {
    createTicket(path.join(ticketsDir, 'archive'), { id: 'OLD-1', title: 'old' });

    const files = listTicketFiles(ticketsDir);
    expect(files).toHaveLength(0);
  });

  it('combines sharded and flat tickets in one listing', () => {
    createTicket(ticketsDir, { id: 'APP-1', title: 'Flat' });
    createTicket(path.join(ticketsDir, '3'), { id: 'APP-123', title: 'Sharded' });

    const files = listTicketFiles(ticketsDir);
    expect(files.map(f => f.id).sort()).toEqual(['APP-1', 'APP-123']);
  });

  it('returns empty array when the directory does not exist', () => {
    expect(listTicketFiles(path.join(tmp, 'missing'))).toEqual([]);
  });
});

// ─── findTicketFile ──────────────────────────────────────────────────────────

describe('findTicketFile()', () => {
  let tmp, ticketsDir;

  beforeEach(() => {
    tmp = makeTempDir();
    ticketsDir = path.join(tmp, 'tickets');
    fs.mkdirSync(ticketsDir, { recursive: true });
  });

  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('finds a flat ticket file', () => {
    createTicket(ticketsDir, { id: 'APP-1', title: 'Flat' });
    expect(findTicketFile(ticketsDir, 'APP-1')).toBe(path.join(ticketsDir, 'APP-1.md'));
  });

  it('finds a sharded ticket file', () => {
    createTicket(path.join(ticketsDir, '3'), { id: 'APP-123', title: 'Sharded' });
    expect(findTicketFile(ticketsDir, 'APP-123')).toBe(path.join(ticketsDir, '3', 'APP-123.md'));
  });

  it('returns null when the ticket does not exist anywhere', () => {
    expect(findTicketFile(ticketsDir, 'APP-999')).toBeNull();
  });
});

// ─── loadTicketsFromDir — sharded layout ──────────────────────────────────────

describe('loadTicketsFromDir() with sharded tickets', () => {
  let tmp, ticketsDir;

  beforeEach(() => {
    tmp = makeTempDir();
    ticketsDir = path.join(tmp, 'tickets');
    fs.mkdirSync(ticketsDir, { recursive: true });
  });

  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('loads tickets from both flat and sharded layouts, excluding drafts', () => {
    createTicket(ticketsDir, { id: 'APP-1', title: 'Flat' });
    createTicket(path.join(ticketsDir, '3'), { id: 'APP-123', title: 'Sharded' });
    createTicket(path.join(ticketsDir, 'new'), { id: 'NEW', title: 'Draft' });

    const tickets = loadTicketsFromDir(ticketsDir, 'APP');
    expect(tickets.map(t => t.id).sort()).toEqual(['APP-1', 'APP-123']);
  });
});
