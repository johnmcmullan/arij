const TestEnv = require('../../helpers/test-env');
const { sampleTickets } = require('../../helpers/fixtures');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const yaml = require('js-yaml');
const create = require('../../../commands/create');

describe('tract create', () => {
  let env;
  let repo;

  beforeEach(async () => {
    env = new TestEnv();
    await env.init();
    repo = await env.createRepo('test-repo', { project: 'TEST' });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  test('creates a new ticket file', async () => {
    await env.createTicket('test-repo', sampleTickets.bug);
    
    const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
    const exists = await fs.access(ticketPath).then(() => true).catch(() => false);
    
    expect(exists).toBe(true);
  });

  test('ticket has correct frontmatter', async () => {
    await env.createTicket('test-repo', sampleTickets.bug);
    
    const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
    const content = await fs.readFile(ticketPath, 'utf-8');
    
    expect(content).toContain('title: Login button not working');
    expect(content).toContain('type: bug');
    expect(content).toContain('status: todo');
    expect(content).toContain('priority: critical');
  });

  test('creates git commit', async () => {
    await env.createTicket('test-repo', sampleTickets.bug);
    
    const log = await repo.git.log();
    expect(log.latest.message).toContain('TEST-1');
  });

  test('rejects duplicate ticket key', async () => {
    await env.createTicket('test-repo', sampleTickets.bug);
    await expect(env.createTicket('test-repo', { ...sampleTickets.bug }))
      .rejects.toThrow('Duplicate ticket key');
  });

  test('creates ticket with special characters in title', async () => {
    const ticket = {
      key: 'TEST-4',
      title: 'Fix: "double quotes" && shell $ metacharacters',
      type: 'bug',
      status: 'todo',
      priority: 'medium',
      description: 'Regression test for shell injection fix.'
    };
    const ticketPath = await env.createTicket('test-repo', ticket);
    const content = await fs.readFile(ticketPath, 'utf-8');
    expect(content).toContain('double quotes');
    expect(content).toContain('metacharacters');
  });

  test('rejects ticket key with invalid format', async () => {
    const ticket = {
      key: 'not-a-valid-key',
      title: 'Test Ticket',
      type: 'task',
      status: 'todo',
      priority: 'medium'
    };
    await expect(env.createTicket('test-repo', ticket)).rejects.toThrow();
  });
});

// ─── tract create (local/offline draft path) — exercises commands/create.js directly ──

describe('tract create — local draft creation', () => {
  let tmpDir;
  let originalCwd;
  let exitMock;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'tract-create-test-'));
    fsSync.mkdirSync(path.join(tmpDir, 'tickets'), { recursive: true });
    process.chdir(tmpDir);

    delete process.env.TRACT_SYNC_SERVER;
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fsSync.rmSync(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function draftFiles() {
    const dir = path.join(tmpDir, 'tickets', 'new');
    if (!fsSync.existsSync(dir)) return [];
    return fsSync.readdirSync(dir).filter(f => f.endsWith('.md'));
  }

  test('writes a draft under tickets/new/ with id: NEW, not a guessed Jira key', async () => {
    await create('APP', { title: 'Fix login bug', type: 'bug', priority: 'high' });

    const files = draftFiles();
    expect(files).toHaveLength(1);

    const content = fsSync.readFileSync(path.join(tmpDir, 'tickets', 'new', files[0]), 'utf8');
    const frontmatter = yaml.load(content.match(/^---\n([\s\S]*?)\n---/)[1]);

    expect(frontmatter.id).toBe('NEW');
    expect(frontmatter.title).toBe('Fix login bug');
    expect(frontmatter.type).toBe('bug');
    expect(frontmatter.priority).toBe('high');
  });

  test('draft filename is a slug of the title plus a timestamp', async () => {
    await create('APP', { title: 'Fix Login Bug!!', type: 'bug' });

    const files = draftFiles();
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^fix-login-bug-\d+\.md$/);
  });

  test('does not allocate a guessed max+1 Jira key even with existing sharded tickets', async () => {
    // Simulate an existing daemon clone with real Jira tickets already sharded.
    fsSync.mkdirSync(path.join(tmpDir, 'tickets', '1'), { recursive: true });
    fsSync.writeFileSync(
      path.join(tmpDir, 'tickets', '1', 'APP-1.md'),
      '---\nid: APP-1\ntitle: Existing\nstatus: todo\n---\n'
    );

    await create('APP', { title: 'Another ticket' });

    const files = draftFiles();
    expect(files).toHaveLength(1);
    const content = fsSync.readFileSync(path.join(tmpDir, 'tickets', 'new', files[0]), 'utf8');
    expect(content).toMatch(/id:\s*NEW/);
    // Must not have picked APP-2 (max+1 guess)
    expect(content).not.toMatch(/id:\s*APP-2/);
  });

  test('commits the draft to git when a repo is present', async () => {
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { cwd: tmpDir, stdio: 'pipe' });

    await create('APP', { title: 'Commit me' });

    const log = execSync('git log --oneline', { cwd: tmpDir, encoding: 'utf8' });
    expect(log).toMatch(/Commit me/);
  });

  test('errors when tickets/ directory does not exist', async () => {
    fsSync.rmSync(path.join(tmpDir, 'tickets'), { recursive: true, force: true });
    await expect(create('APP', { title: 'No tickets dir' })).rejects.toThrow('process.exit:1');
  });
});
