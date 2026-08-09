const TestEnv = require('../helpers/test-env');
const { sampleTickets } = require('../helpers/fixtures');
const path = require('path');
const fs = require('fs').promises;

describe('Federated - Multi-Developer Workflow', () => {
  let env;

  beforeEach(async () => {
    env = new TestEnv();
    await env.init();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  test('developer clones and sees existing tickets', async () => {
    // Dev1 creates a repo with tickets
    const dev1 = await env.createRepo('dev1', { project: 'TEAM' });
    await env.createTicket('dev1', { ...sampleTickets.bug, key: 'TEAM-1' });
    await env.createTicket('dev1', { ...sampleTickets.story, key: 'TEAM-2' });

    // Dev2 clones the repo
    const dev2 = await env.cloneRepo('dev1', 'dev2');

    // Dev2 should see the tickets
    const ticketsDir = path.join(dev2.path, 'issues');
    const tickets = await fs.readdir(ticketsDir);

    expect(tickets).toContain('TEAM-1.md');
    expect(tickets).toContain('TEAM-2.md');
  });

  test('concurrent ticket creation by two developers', async () => {
    // Dev1 creates repo
    const dev1 = await env.createRepo('dev1', { project: 'TEAM' });
    
    // Dev2 clones
    const dev2 = await env.cloneRepo('dev1', 'dev2');
    
    // Dev1 creates TEST-1
    await env.createTicket('dev1', { ...sampleTickets.bug, key: 'TEAM-1' });
    
    // Dev2 creates TEST-2 (without pulling first)
    await env.createTicket('dev2', { ...sampleTickets.story, key: 'TEAM-2' });
    
    // Dev1 pushes (simulated - both repos exist)
    // Dev2 would need to pull and merge
    
    // Both tickets should exist independently
    const dev1Tickets = await fs.readdir(path.join(dev1.path, 'issues'));
    const dev2Tickets = await fs.readdir(path.join(dev2.path, 'issues'));
    
    expect(dev1Tickets).toContain('TEAM-1.md');
    expect(dev2Tickets).toContain('TEAM-2.md');
  });

  test('ticket update by one developer is committed and visible in git log', async () => {
    // Setup: both devs have the same starting state
    const dev1 = await env.createRepo('dev1', { project: 'TEAM' });
    await env.createTicket('dev1', { ...sampleTickets.bug, key: 'TEAM-1' });

    const dev2 = await env.cloneRepo('dev1', 'dev2');

    // Dev1 updates the ticket status
    const ticketPath = path.join(dev1.path, 'issues', 'TEAM-1.md');
    let content = await fs.readFile(ticketPath, 'utf-8');
    content = content.replace('status: todo', 'status: in-progress');
    await fs.writeFile(ticketPath, content);
    await dev1.git.add('issues');
    await dev1.git.commit('Update TEAM-1 status');

    const dev1Log = await dev1.git.log();
    expect(dev1Log.latest.message).toContain('Update TEAM-1 status');
  });

  // Not implemented yet — the second half of the scenario above (dev2 actually
  // pulling dev1's commit and merging) previously ended in a bare
  // `expect(true).toBe(true)`, asserting nothing. Left as an honest todo.
  test.todo('dev2 pulls dev1\'s commit and sees the merged update');

  // TODO: Enrich with scenarios
  test.todo('merge conflicts on same ticket');
  test.todo('branching strategies');
  test.todo('pull request workflows');
  test.todo('concurrent worklog additions');
  test.todo('team-wide sprint updates');
});
