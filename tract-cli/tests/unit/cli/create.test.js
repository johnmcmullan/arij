const TestEnv = require('../../helpers/test-env');
const { sampleTickets } = require('../../helpers/fixtures');
const fs = require('fs').promises;
const path = require('path');

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
