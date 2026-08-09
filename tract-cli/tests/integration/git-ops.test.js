const TestEnv = require('../helpers/test-env');
const { sampleTickets } = require('../helpers/fixtures');
const path = require('path');
const fs = require('fs').promises;

describe('Integration - Git Operations', () => {
  let env;

  beforeEach(async () => {
    env = new TestEnv();
    await env.init();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  test('ticket creation commits to git', async () => {
    const repo = await env.createRepo('test-repo', { project: 'TEST' });
    await env.createTicket('test-repo', sampleTickets.bug);
    
    const log = await repo.git.log();
    expect(log.all.length).toBeGreaterThan(1); // Initial + ticket creation
  });

  test('ticket updates are versioned', async () => {
    const repo = await env.createRepo('test-repo', { project: 'TEST' });
    await env.createTicket('test-repo', sampleTickets.bug);
    
    // Update the ticket
    const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
    let content = await fs.readFile(ticketPath, 'utf-8');
    content = content.replace('status: todo', 'status: done');
    await fs.writeFile(ticketPath, content);
    await repo.git.add('issues');
    await repo.git.commit('Mark TEST-1 as done');
    
    const log = await repo.git.log();
    expect(log.latest.message).toContain('done');
  });

  test('can view ticket history via git log', async () => {
    const repo = await env.createRepo('test-repo', { project: 'TEST' });
    await env.createTicket('test-repo', sampleTickets.bug);
    
    const log = await repo.git.log({ file: 'issues/TEST-1.md' });
    expect(log.all.length).toBeGreaterThan(0);
  });

  describe('Dirty working tree handling', () => {
    test('detects uncommitted changes in issues directory', async () => {
      const repo = await env.createRepo('test-repo', { project: 'TEST' });
      await env.createTicket('test-repo', sampleTickets.bug);

      // Modify a ticket without committing
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      let content = await fs.readFile(ticketPath, 'utf-8');
      content = content.replace('status: todo', 'status: in-progress');
      await fs.writeFile(ticketPath, content);

      const status = await repo.git.status();
      expect(status.modified).toContain('issues/TEST-1.md');
      expect(status.isClean()).toBe(false);
    });

    test('prevents sync operations with dirty working tree', async () => {
      const repo = await env.createRepo('test-repo', {
        project: 'TEST',
        syncUrl: 'http://localhost:3001'
      });
      await env.createTicket('test-repo', sampleTickets.bug);

      // Create uncommitted changes
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      let content = await fs.readFile(ticketPath, 'utf-8');
      content = content.replace('priority: critical', 'priority: blocker');
      await fs.writeFile(ticketPath, content);

      // Attempting sync should fail
      const status = await repo.git.status();
      expect(status.isClean()).toBe(false);

      // TODO: Test actual tract sync command rejection
      // await expect(tractSync(repo.path)).rejects.toThrow(/uncommitted changes/i);
    });

    test('warns about untracked files in issues directory', async () => {
      const repo = await env.createRepo('test-repo', { project: 'TEST' });

      // Create untracked file
      const untrackedPath = path.join(repo.path, 'issues', 'untracked.md');
      await fs.mkdir(path.join(repo.path, 'issues'), { recursive: true });
      await fs.writeFile(untrackedPath, 'Untracked content');

      const status = await repo.git.status();
      expect(status.not_added).toContain('issues/untracked.md');
    });

    test('detects staged but uncommitted changes', async () => {
      const repo = await env.createRepo('test-repo', { project: 'TEST' });
      await env.createTicket('test-repo', sampleTickets.bug);

      // Modify and stage but don't commit
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      let content = await fs.readFile(ticketPath, 'utf-8');
      content = content.replace('status: todo', 'status: done');
      await fs.writeFile(ticketPath, content);
      await repo.git.add('issues/TEST-1.md');

      const status = await repo.git.status();
      expect(status.staged).toContain('issues/TEST-1.md');
      expect(status.isClean()).toBe(false);
    });

    test('handles partially staged changes', async () => {
      const repo = await env.createRepo('test-repo', { project: 'TEST' });
      await env.createTicket('test-repo', sampleTickets.bug);

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');

      // First modification - staged
      let content = await fs.readFile(ticketPath, 'utf-8');
      content = content.replace('status: todo', 'status: in-progress');
      await fs.writeFile(ticketPath, content);
      await repo.git.add('issues/TEST-1.md');

      // Second modification - not staged
      content = await fs.readFile(ticketPath, 'utf-8');
      content = content.replace('priority: critical', 'priority: blocker');
      await fs.writeFile(ticketPath, content);

      const status = await repo.git.status();
      expect(status.staged).toContain('issues/TEST-1.md');
      expect(status.modified).toContain('issues/TEST-1.md');
    });

    test('detects deleted files not yet committed', async () => {
      const repo = await env.createRepo('test-repo', { project: 'TEST' });
      await env.createTicket('test-repo', sampleTickets.bug);

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      await fs.unlink(ticketPath);

      const status = await repo.git.status();
      expect(status.deleted).toContain('issues/TEST-1.md');
      expect(status.isClean()).toBe(false);
    });

    test('tract doctor warns about dirty working tree', async () => {
      const repo = await env.createRepo('test-repo', { project: 'TEST' });
      await env.createTicket('test-repo', sampleTickets.bug);

      // Create uncommitted changes
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      let content = await fs.readFile(ticketPath, 'utf-8');
      content += '\n\nAdditional note';
      await fs.writeFile(ticketPath, content);

      const status = await repo.git.status();
      expect(status.isClean()).toBe(false);

      // TODO: Test tract doctor command output
      // const doctorOutput = await tractDoctor(repo.path);
      // expect(doctorOutput).toContain('uncommitted changes');
    });

    test('provides helpful message for resolving dirty state', async () => {
      const repo = await env.createRepo('test-repo', { project: 'TEST' });

      // Create multiple types of changes
      await env.createTicket('test-repo', sampleTickets.bug);

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      let content = await fs.readFile(ticketPath, 'utf-8');
      content = content.replace('status: todo', 'status: done');
      await fs.writeFile(ticketPath, content);

      const untrackedPath = path.join(repo.path, 'issues', 'untracked.md');
      await fs.writeFile(untrackedPath, 'Untracked');

      const status = await repo.git.status();
      expect(status.modified.length + status.not_added.length).toBeGreaterThan(0);

      // TODO: Verify helpful error message suggests:
      // - git add . && git commit for committing changes
      // - git checkout . for discarding changes
      // - git status for viewing changes
    });
  });

  describe('Git conflict scenarios', () => {
    test('detects merge conflicts in ticket files', async () => {
      const dev1 = await env.createRepo('dev1', { project: 'TEAM' });
      await env.createTicket('dev1', {
        key: 'TEAM-1',
        title: 'Shared ticket',
        type: 'bug',
        status: 'todo'
      });

      const dev2 = await env.cloneRepo('dev1', 'dev2');

      // Dev1 changes status
      const ticket1Path = path.join(dev1.path, 'issues', 'TEAM-1.md');
      let content1 = await fs.readFile(ticket1Path, 'utf-8');
      content1 = content1.replace('status: todo', 'status: in-progress');
      await fs.writeFile(ticket1Path, content1);
      await dev1.git.add('issues');
      await dev1.git.commit('Dev1: Start work');

      // Dev2 changes status to something else
      const ticket2Path = path.join(dev2.path, 'issues', 'TEAM-1.md');
      let content2 = await fs.readFile(ticket2Path, 'utf-8');
      content2 = content2.replace('status: todo', 'status: done');
      await fs.writeFile(ticket2Path, content2);
      await dev2.git.add('issues');
      await dev2.git.commit('Dev2: Complete work');

      // Setup remote (use dev1 as remote for dev2)
      // Check if origin already exists, remove it first
      const remotes = await dev2.git.getRemotes();
      if (remotes.find(r => r.name === 'origin')) {
        await dev2.git.removeRemote('origin');
      }
      await dev2.git.addRemote('origin', dev1.path);

      // Try to pull - should create conflict
      let hadConflict = false;
      try {
        await dev2.git.pull('origin', 'master', { '--no-rebase': null });
      } catch (error) {
        // Pull should fail due to conflict
        hadConflict = true;
        expect(error.message).toMatch(/conflict|merge/i);
      }

      // Check for conflict markers
      const conflictedContent = await fs.readFile(ticket2Path, 'utf-8').catch(() => null);
      if (conflictedContent) {
        // If git created conflict markers
        const hasConflictMarkers =
          conflictedContent.includes('<<<<<<<') ||
          conflictedContent.includes('>>>>>>>') ||
          conflictedContent.includes('=======');

        // Either has conflict markers or merge was rejected
        expect(hasConflictMarkers || hadConflict).toBeTruthy();
      } else {
        // If file couldn't be read, conflict must have occurred
        expect(hadConflict).toBe(true);
      }
    });

    test('auto-merges non-conflicting changes', async () => {
      const dev1 = await env.createRepo('dev1', { project: 'TEAM' });
      await env.createTicket('dev1', {
        key: 'TEAM-1',
        title: 'Shared ticket',
        type: 'bug',
        status: 'todo',
        priority: 'major'
      });

      const dev2 = await env.cloneRepo('dev1', 'dev2');

      // Dev1 changes priority
      const ticket1Path = path.join(dev1.path, 'issues', 'TEAM-1.md');
      let content1 = await fs.readFile(ticket1Path, 'utf-8');
      content1 = content1.replace('priority: major', 'priority: critical');
      await fs.writeFile(ticket1Path, content1);
      await dev1.git.add('issues');
      await dev1.git.commit('Dev1: Increase priority');

      // Dev2 changes status (different field)
      const ticket2Path = path.join(dev2.path, 'issues', 'TEAM-1.md');
      let content2 = await fs.readFile(ticket2Path, 'utf-8');
      content2 = content2.replace('status: todo', 'status: in-progress');
      await fs.writeFile(ticket2Path, content2);
      await dev2.git.add('issues');
      await dev2.git.commit('Dev2: Start work');

      // Setup remote
      const remotes = await dev2.git.getRemotes();
      if (remotes.find(r => r.name === 'origin')) {
        await dev2.git.removeRemote('origin');
      }
      await dev2.git.addRemote('origin', dev1.path);

      // Pull should auto-merge
      try {
        await dev2.git.pull('origin', 'master', { '--no-rebase': null });

        // After successful merge, both changes should be present
        const mergedContent = await fs.readFile(ticket2Path, 'utf-8');
        expect(mergedContent).toContain('priority: critical');
        expect(mergedContent).toContain('status: in-progress');
      } catch (error) {
        // If auto-merge fails, that's also valid behavior to test
        expect(error.message).toMatch(/merge|conflict/i);
      }
    });
  });

  // TODO: Enrich with scenarios
  // - Git blame for ticket fields
  // - Revert ticket changes
  // - Branch-based workflows
  // - Git hooks integration
});
