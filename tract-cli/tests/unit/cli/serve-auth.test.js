const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const yaml = require('js-yaml');

// serve.js reads TRACT_AUTH_ENABLED once, at require time — must be set
// before the require below. This is why auth-enforcement tests live in
// their own file rather than alongside serve.test.js's monitoring-mode
// tests (which need AUTH disabled).
process.env.TRACT_AUTH_ENABLED = 'true';

jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({ on: jest.fn().mockReturnThis(), close: jest.fn() })),
}));

const serveCommand = require(path.join(__dirname, '../../../commands/serve'));
const tokenStore = require(path.join(__dirname, '../../../lib/token-store'));

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createTicket(ticketsDir, ticket) {
  fs.mkdirSync(ticketsDir, { recursive: true });
  const frontmatter = {
    id: ticket.id,
    title: ticket.title || 'Test ticket',
    status: ticket.status || 'todo',
    priority: ticket.priority || 'medium',
    labels: ticket.labels || [],
    component: ticket.component || null,
    assignee: ticket.assignee || null,
    sprints: ticket.sprints || [],
    type: ticket.type || 'task',
    estimate: ticket.estimate || null,
  };
  fs.writeFileSync(
    path.join(ticketsDir, `${ticket.id}.md`),
    `---\n${yaml.dump(frontmatter)}---\n\nBody.\n`
  );
}

function writePermissions(securityHome, doc) {
  fs.writeFileSync(path.join(securityHome, 'permissions.yaml'), yaml.dump(doc), 'utf8');
}

const openServers = [];

async function startServer(tmpDir) {
  const port = await new Promise((resolve, reject) => {
    const s = http.createServer();
    s.listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
    s.on('error', reject);
  });

  let serverHandle;
  const origCreateServer = http.createServer.bind(http);
  jest.spyOn(http, 'createServer').mockImplementationOnce((handler) => {
    serverHandle = origCreateServer(handler);
    openServers.push(serverHandle);
    return serverHandle;
  });

  await serveCommand({ port: String(port), workspace: tmpDir, project: null });
  await new Promise(resolve => setTimeout(resolve, 50));

  const get = (urlPath, headers = {}) => new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${urlPath}`, { headers }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    }).on('error', reject);
  });

  return { port, get };
}

afterEach(() => {
  for (const s of openServers) { try { s.close(); } catch { /* ignore */ } }
  openServers.length = 0;
  jest.restoreAllMocks();
});

describe('serve.js with TRACT_AUTH_ENABLED=true', () => {
  let tmp, ticketsDir, securityHome;

  beforeEach(() => {
    tmp = makeTempDir('tract-serve-auth-test-');
    ticketsDir = path.join(tmp, 'tickets');
    securityHome = makeTempDir('tract-serve-auth-security-');
    process.env.TRACT_SECURITY_HOME = securityHome;
  });

  afterEach(() => {
    delete process.env.TRACT_SECURITY_HOME;
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(securityHome, { recursive: true, force: true });
  });

  test('rejects requests with no token', async () => {
    fs.mkdirSync(ticketsDir, { recursive: true });
    const { get } = await startServer(tmp);
    const { status, body } = await get('/api/tickets');
    expect(status).toBe(401);
    expect(JSON.parse(body).error).toMatch(/Authentication required/);
  });

  test('rejects requests with an invalid token', async () => {
    fs.mkdirSync(ticketsDir, { recursive: true });
    const { get } = await startServer(tmp);
    const { status } = await get('/api/tickets', { Authorization: 'Bearer tract_not-a-real-token' });
    expect(status).toBe(401);
  });

  test('accepts a valid token via Authorization: Bearer', async () => {
    fs.mkdirSync(ticketsDir, { recursive: true });
    const raw = tokenStore.createToken({ email: 'dev@example.com', name: 'test', ttlDays: 30 });
    writePermissions(securityHome, {
      projects: { APP: { teams: [{ name: 'eng', members: ['dev@example.com'], permissions: ['read:tickets'] }] } },
    });

    const { get } = await startServer(tmp);
    const { status } = await get('/api/tickets', { Authorization: `Bearer ${raw}` });
    expect(status).toBe(200);
  });

  test('accepts a valid token via X-Tract-Token', async () => {
    fs.mkdirSync(ticketsDir, { recursive: true });
    const raw = tokenStore.createToken({ email: 'dev@example.com', name: 'test', ttlDays: 30 });
    writePermissions(securityHome, {
      projects: { APP: { teams: [{ name: 'eng', members: ['dev@example.com'], permissions: ['read:tickets'] }] } },
    });

    const { get } = await startServer(tmp);
    const { status } = await get('/api/tickets', { 'X-Tract-Token': raw });
    expect(status).toBe(200);
  });

  test('filters tickets by excluded label — filtered ticket is absent from the list', async () => {
    createTicket(ticketsDir, { id: 'APP-1', labels: ['security'] });
    createTicket(ticketsDir, { id: 'APP-2', labels: [] });
    const raw = tokenStore.createToken({ email: 'dev@example.com', name: 'test', ttlDays: 30 });
    writePermissions(securityHome, {
      projects: {
        APP: {
          teams: [{
            name: 'eng', members: ['dev@example.com'], permissions: ['read:tickets'],
            filters: { exclude_labels: ['security'] },
          }],
        },
      },
    });

    const { get } = await startServer(tmp);
    const { status, body } = await get('/api/tickets', { Authorization: `Bearer ${raw}` });
    expect(status).toBe(200);
    const tickets = JSON.parse(body);
    expect(tickets.map(t => t.id)).toEqual(['APP-2']);
  });

  test('a filtered ticket 404s on direct fetch — invisible, not just denied', async () => {
    createTicket(ticketsDir, { id: 'APP-1', labels: ['security'] });
    const raw = tokenStore.createToken({ email: 'dev@example.com', name: 'test', ttlDays: 30 });
    writePermissions(securityHome, {
      projects: {
        APP: {
          teams: [{
            name: 'eng', members: ['dev@example.com'], permissions: ['read:tickets'],
            filters: { exclude_labels: ['security'] },
          }],
        },
      },
    });

    const { get } = await startServer(tmp);
    const { status } = await get('/api/ticket/APP-1', { Authorization: `Bearer ${raw}` });
    expect(status).toBe(404);
  });

  test('a user with no read:tickets permission sees an empty ticket list, not an error', async () => {
    createTicket(ticketsDir, { id: 'APP-1', labels: [] });
    const raw = tokenStore.createToken({ email: 'outsider@example.com', name: 'test', ttlDays: 30 });
    writePermissions(securityHome, { projects: {} });

    const { get } = await startServer(tmp);
    const { status, body } = await get('/api/tickets', { Authorization: `Bearer ${raw}` });
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual([]);
  });

  test('rate limits and sets Retry-After when exceeded', async () => {
    fs.mkdirSync(ticketsDir, { recursive: true });
    const raw = tokenStore.createToken({ email: 'dev@example.com', name: 'test', ttlDays: 30 });
    writePermissions(securityHome, {
      projects: {
        APP: {
          teams: [{ name: 'eng', members: ['dev@example.com'], permissions: ['read:tickets'], rate_limits: { api: '2/hour' } }],
        },
      },
    });

    const { get } = await startServer(tmp);
    const headers = { Authorization: `Bearer ${raw}` };
    expect((await get('/api/tickets', headers)).status).toBe(200);
    expect((await get('/api/tickets', headers)).status).toBe(200);
    const third = await get('/api/tickets', headers);
    expect(third.status).toBe(429);
    expect(third.headers['retry-after']).toBeDefined();
  });

  test('admin bypasses both permission checks and rate limits', async () => {
    createTicket(ticketsDir, { id: 'APP-1', labels: ['security'] });
    const raw = tokenStore.createToken({ email: 'admin@example.com', name: 'test', ttlDays: 30 });
    writePermissions(securityHome, { admins: ['admin@example.com'] });

    const { get } = await startServer(tmp);
    const { status, body } = await get('/api/tickets', { Authorization: `Bearer ${raw}` });
    expect(status).toBe(200);
    expect(JSON.parse(body).map(t => t.id)).toEqual(['APP-1']);
  });

  test('audit log records every request, including rejected ones', async () => {
    fs.mkdirSync(ticketsDir, { recursive: true });
    const { get } = await startServer(tmp);
    await get('/api/tickets');

    const today = new Date().toISOString().slice(0, 10);
    const auditFile = path.join(securityHome, 'audit', `${today}.jsonl`);
    expect(fs.existsSync(auditFile)).toBe(true);
    const entry = JSON.parse(fs.readFileSync(auditFile, 'utf8').trim().split('\n').pop());
    expect(entry.status).toBe(401);
    expect(entry.user).toBe('anonymous');
    expect(entry.action).toBe('read:tickets');
  });
});
