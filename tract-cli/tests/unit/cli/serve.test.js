const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const yaml = require('js-yaml');

// Mock chokidar so we don't need real file watching in tests
jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    close: jest.fn()
  }))
}));

const serveCommand = require(path.join(__dirname, '../../../commands/serve'));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tract-serve-test-'));
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
    estimate: ticket.estimate || null
  };
  fs.writeFileSync(
    path.join(ticketsDir, `${ticket.id}.md`),
    `---\n${yaml.dump(frontmatter)}---\n\nDescription.\n`
  );
}

function createSprintFile(sprintsDir, id, state) {
  fs.mkdirSync(sprintsDir, { recursive: true });
  fs.writeFileSync(
    path.join(sprintsDir, `${id}.yaml`),
    yaml.dump({ name: `Sprint ${id}`, state, start: '2026-02-01', end: '2026-02-14' })
  );
}

// Track open servers so we can close them after each test
const openServers = [];

/**
 * Start the serve command on a random available port.
 * Returns { port, close }.
 */
async function startServer(tmpDir, opts = {}) {
  // Find a free port by binding to :0 then releasing
  const port = await new Promise((resolve, reject) => {
    const s = http.createServer();
    s.listen(0, () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
    s.on('error', reject);
  });

  const cmdObj = {
    port: String(port),
    workspace: tmpDir,
    project: opts.project || null
  };

  // serveCommand starts the server and returns after listen() — intercept
  // http.createServer so we can grab the server handle for cleanup.
  let serverHandle;
  const origCreateServer = http.createServer.bind(http);
  jest.spyOn(http, 'createServer').mockImplementationOnce((handler) => {
    serverHandle = origCreateServer(handler);
    openServers.push(serverHandle);
    return serverHandle;
  });

  await serveCommand(cmdObj);

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 50));

  const get = (urlPath) => new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${urlPath}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    }).on('error', reject);
  });

  return { port, get };
}

afterEach(() => {
  // Close all servers opened during this test
  for (const s of openServers) {
    try { s.close(); } catch { /* ignore */ }
  }
  openServers.length = 0;
  jest.restoreAllMocks();
});

// ─── /api/tickets ─────────────────────────────────────────────────────────────

describe('GET /api/tickets', () => {
  let tmp, ticketsDir;

  beforeEach(() => {
    tmp = makeTempDir();
    ticketsDir = path.join(tmp, 'tickets');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns empty array when no tickets exist', async () => {
    fs.mkdirSync(ticketsDir, { recursive: true });
    const { get } = await startServer(tmp);
    const { status, body } = await get('/api/tickets');
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual([]);
  });

  it('returns all tickets as JSON array', async () => {
    createTicket(ticketsDir, { id: 'APP-1', title: 'First', status: 'todo' });
    createTicket(ticketsDir, { id: 'APP-2', title: 'Second', status: 'done' });
    const { get } = await startServer(tmp);
    const { status, body } = await get('/api/tickets');
    expect(status).toBe(200);
    const tickets = JSON.parse(body);
    expect(tickets).toHaveLength(2);
    expect(tickets.map(t => t.id).sort()).toEqual(['APP-1', 'APP-2']);
  });

  it('returns all expected fields on each ticket', async () => {
    createTicket(ticketsDir, {
      id: 'APP-1', title: 'T', status: 'in-progress',
      priority: 'major', labels: ['auth'], assignee: 'alice',
      sprints: ['2026-W07'], type: 'bug', estimate: '4h'
    });
    const { get } = await startServer(tmp);
    const [t] = JSON.parse((await get('/api/tickets')).body);
    const expectedFields = [
      'id', 'title', 'status', 'assignee', 'priority', 'labels',
      'sprints', 'sprint', 'blocked_by', 'blocks', 'created', 'updated',
      'type', 'estimate', 'due', 'epic', 'component', 'project',
      'logged', 'remaining', 'loggedSeconds', 'estimateSeconds'
    ];
    for (const f of expectedFields) {
      expect(t).toHaveProperty(f);
    }
  });

  it('sets Content-Type to application/json', async () => {
    fs.mkdirSync(ticketsDir, { recursive: true });
    const { get } = await startServer(tmp);
    const { headers } = await get('/api/tickets');
    expect(headers['content-type']).toMatch(/application\/json/);
  });

  it('filters by ?status=', async () => {
    createTicket(ticketsDir, { id: 'APP-1', status: 'todo' });
    createTicket(ticketsDir, { id: 'APP-2', status: 'done' });
    createTicket(ticketsDir, { id: 'APP-3', status: 'todo' });
    const { get } = await startServer(tmp);
    const tickets = JSON.parse((await get('/api/tickets?status=todo')).body);
    expect(tickets).toHaveLength(2);
    expect(tickets.every(t => t.status === 'todo')).toBe(true);
  });

  it('filters by ?assignee=', async () => {
    createTicket(ticketsDir, { id: 'APP-1', assignee: 'alice' });
    createTicket(ticketsDir, { id: 'APP-2', assignee: 'bob' });
    const { get } = await startServer(tmp);
    const tickets = JSON.parse((await get('/api/tickets?assignee=alice')).body);
    expect(tickets).toHaveLength(1);
    expect(tickets[0].id).toBe('APP-1');
  });

  it('filters by ?sprint=', async () => {
    createTicket(ticketsDir, { id: 'APP-1', sprints: ['2026-W07'] });
    createTicket(ticketsDir, { id: 'APP-2', sprints: ['2026-W08'] });
    const { get } = await startServer(tmp);
    const tickets = JSON.parse((await get('/api/tickets?sprint=2026-W07')).body);
    expect(tickets).toHaveLength(1);
    expect(tickets[0].id).toBe('APP-1');
  });

  it('returns Access-Control-Allow-Origin header', async () => {
    fs.mkdirSync(ticketsDir, { recursive: true });
    const { get } = await startServer(tmp);
    const { headers } = await get('/api/tickets');
    expect(headers['access-control-allow-origin']).toBe('*');
  });
});

// ─── /api/ticket/:id ────────────────────────────────────────────────────────
//
// This is the one route in serve.js that turns untrusted request-path input
// into a file read (commands/serve.js, "Single ticket API"). It's already
// safe by construction — `path.basename(urlPath)` strips any directory
// component before the id is ever used, and the lookup only reads a file
// that a real `fs.readdirSync(ticketsDir)` already enumerated, so a raw
// `fs.readFile(ticketsDir + id)` join never happens — but that safety had no
// regression test. These replace tests/unit/security/path-traversal.test.js's
// coverage of this route, which asserted against a hand-rolled validator in
// tests/helpers/test-env.js rather than this actual code path.
describe('GET /api/ticket/:id', () => {
  let tmp, ticketsDir;

  beforeEach(() => {
    tmp = makeTempDir();
    ticketsDir = path.join(tmp, 'tickets');
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('returns full ticket content including body', async () => {
    createTicket(ticketsDir, { id: 'APP-1', title: 'Real ticket' });
    const md = fs.readFileSync(path.join(ticketsDir, 'APP-1.md'), 'utf8');
    fs.writeFileSync(path.join(ticketsDir, 'APP-1.md'), md.replace('Description.', 'Full body text.'));

    const { get } = await startServer(tmp);
    const { status, body } = await get('/api/ticket/APP-1');
    expect(status).toBe(200);
    const ticket = JSON.parse(body);
    expect(ticket.id).toBe('APP-1');
    expect(ticket.body).toContain('Full body text.');
  });

  it('is case-insensitive on the ticket id', async () => {
    createTicket(ticketsDir, { id: 'APP-1' });
    const { get } = await startServer(tmp);
    const { status, body } = await get('/api/ticket/app-1');
    expect(status).toBe(200);
    expect(JSON.parse(body).id).toBe('APP-1');
  });

  it('returns 404 for a non-existent ticket', async () => {
    fs.mkdirSync(ticketsDir, { recursive: true });
    const { get } = await startServer(tmp);
    const { status } = await get('/api/ticket/APP-999');
    expect(status).toBe(404);
  });

  it('does not escape ticketsDir via a path-traversal id', async () => {
    createTicket(ticketsDir, { id: 'APP-1' });
    // A file that genuinely exists one level above ticketsDir — if traversal
    // worked, this is what an attacker would be reading.
    fs.writeFileSync(path.join(tmp, 'secret.txt'), 'top secret');

    const { get } = await startServer(tmp);
    const { status, body } = await get('/api/ticket/' + encodeURIComponent('../secret.txt'));
    expect(status).toBe(404);
    expect(body).not.toContain('top secret');
  });

  it('does not escape ticketsDir via an absolute-path-shaped id', async () => {
    fs.mkdirSync(ticketsDir, { recursive: true });
    const { get } = await startServer(tmp);
    const { status, body } = await get('/api/ticket/' + encodeURIComponent('/etc/passwd'));
    expect(status).toBe(404);
    expect(body).not.toMatch(/root:.*:0:0:/);
  });
});

// ─── /api/sprints ─────────────────────────────────────────────────────────────

describe('GET /api/sprints', () => {
  let tmp;

  beforeEach(() => { tmp = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('returns empty array when no sprints exist', async () => {
    const { get } = await startServer(tmp);
    const { status, body } = await get('/api/sprints');
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual([]);
  });

  it('returns parsed sprint objects with id field', async () => {
    const sprintsDir = path.join(tmp, '.tract', 'sprints');
    createSprintFile(sprintsDir, '2026-W07', 'open');
    createSprintFile(sprintsDir, '2026-W06', 'closed');
    const { get } = await startServer(tmp);
    const sprints = JSON.parse((await get('/api/sprints')).body);
    expect(sprints).toHaveLength(2);
    const open = sprints.find(s => s.id === '2026-W07');
    expect(open.state).toBe('open');
  });
});

// ─── /api/projects ────────────────────────────────────────────────────────────

describe('GET /api/projects', () => {
  let tmp, ticketsDir;

  beforeEach(() => {
    tmp = makeTempDir();
    ticketsDir = path.join(tmp, 'tickets');
  });

  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('returns a project entry with ticketCount', async () => {
    createTicket(ticketsDir, { id: 'APP-1' });
    createTicket(ticketsDir, { id: 'APP-2' });
    const { get } = await startServer(tmp);
    const projects = JSON.parse((await get('/api/projects')).body);
    expect(projects).toHaveLength(1);
    expect(projects[0].ticketCount).toBe(2);
  });
});

// ─── /api/meta ────────────────────────────────────────────────────────────────

describe('GET /api/meta', () => {
  let tmp;

  beforeEach(() => { tmp = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('returns workspace, port, and projects fields', async () => {
    const { get, port } = await startServer(tmp);
    const meta = JSON.parse((await get('/api/meta')).body);
    expect(meta).toHaveProperty('workspace');
    expect(meta.port).toBe(port);
    expect(Array.isArray(meta.projects)).toBe(true);
  });
});

// ─── / index ─────────────────────────────────────────────────────────────────

describe('GET /', () => {
  let tmp;

  beforeEach(() => { tmp = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('returns HTML with 200', async () => {
    const { get } = await startServer(tmp);
    const { status, headers } = await get('/');
    expect(status).toBe(200);
    expect(headers['content-type']).toMatch(/text\/html/);
  });

  it('lists per-user custom dashboards from ~/.tract/dashboards', async () => {
    // Dashboards are no longer picked up from a loose file dropped straight
    // into the workspace's dashboards/ dir — serve.js only auto-lists
    // ~/.tract/dashboards (tagged "custom") and its own shipped lib/dashboards
    // (see buildIndexHtml's `collect()` fallback in commands/serve.js).
    const userDashDir = path.join(tmp, 'fake-home', '.tract', 'dashboards');
    fs.mkdirSync(userDashDir, { recursive: true });
    fs.writeFileSync(path.join(userDashDir, 'sprint-board.html'), '<html></html>');
    const homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(path.join(tmp, 'fake-home'));

    const { get } = await startServer(tmp);
    const { body } = await get('/');
    expect(body).toContain('sprint-board');
    expect(body).toContain('custom');

    homedirSpy.mockRestore();
  });

  it('lists the built-in dashboards by default', async () => {
    // With no ~/.tract/dashboards and no workspace index.yaml, serve.js falls
    // back to auto-listing whatever ships in tract-cli/lib/dashboards — there
    // is no "no dashboards" empty state to hit in normal operation anymore.
    const { get } = await startServer(tmp);
    const { body } = await get('/');
    expect(body).not.toContain('No dashboards found');
    expect(body).toMatch(/control-chart|kanban|scrum/);
  });
});

// ─── /dashboards/:file ────────────────────────────────────────────────────────

describe('GET /dashboards/:file', () => {
  let tmp;

  beforeEach(() => { tmp = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('serves a per-user custom dashboard file', async () => {
    // GET /dashboards/:file only resolves against ~/.tract/dashboards and the
    // built-in lib/dashboards (see the userPath/libPath lookup in
    // commands/serve.js) — a file dropped straight into the workspace's own
    // dashboards/ dir is not in that lookup chain.
    const userDashDir = path.join(tmp, 'fake-home', '.tract', 'dashboards');
    fs.mkdirSync(userDashDir, { recursive: true });
    fs.writeFileSync(path.join(userDashDir, 'test.html'), '<h1>My Dashboard</h1>');
    const homedirSpy = jest.spyOn(os, 'homedir').mockReturnValue(path.join(tmp, 'fake-home'));

    const { get } = await startServer(tmp);
    const { status, body } = await get('/dashboards/test.html');
    expect(status).toBe(200);
    expect(body).toContain('My Dashboard');

    homedirSpy.mockRestore();
  });

  it('serves a built-in dashboard file', async () => {
    const { get } = await startServer(tmp);
    const { status } = await get('/dashboards/kanban.html');
    expect(status).toBe(200);
  });

  it('returns 404 for a non-existent dashboard', async () => {
    const { get } = await startServer(tmp);
    const { status } = await get('/dashboards/missing.html');
    expect(status).toBe(404);
  });

  it('returns 404 for non-html files (path traversal guard)', async () => {
    const { get } = await startServer(tmp);
    const { status } = await get('/dashboards/../../etc/passwd');
    expect(status).toBe(404);
  });
});

// ─── unknown routes ───────────────────────────────────────────────────────────

describe('unknown routes', () => {
  let tmp;

  beforeEach(() => { tmp = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('returns 404 for unknown paths', async () => {
    const { get } = await startServer(tmp);
    expect((await get('/api/unknown')).status).toBe(404);
    expect((await get('/foo/bar')).status).toBe(404);
  });
});

// ─── /api/events (SSE) ───────────────────────────────────────────────────────

describe('GET /api/events', () => {
  let tmp;

  beforeEach(() => { tmp = makeTempDir(); });
  afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

  it('responds with text/event-stream and initial comment', async () => {
    const { port } = await startServer(tmp);

    const result = await new Promise((resolve, reject) => {
      let buf = '';
      const timer = setTimeout(() => { req.destroy(); resolve({ body: buf }); }, 500);
      const settle = (value) => { clearTimeout(timer); resolve(value); };

      const req = http.get(`http://localhost:${port}/api/events`, (res) => {
        res.on('data', chunk => {
          buf += chunk;
          if (buf.includes(': connected')) {
            req.destroy();
            settle({ status: res.statusCode, headers: res.headers, body: buf });
          }
        });
        res.on('error', () => settle({ status: res.statusCode, headers: res.headers, body: buf }));
      });
      req.on('error', () => settle({}));
    });

    expect(result.headers?.['content-type']).toMatch(/text\/event-stream/);
    expect(result.body).toContain(': connected');
  });
});
