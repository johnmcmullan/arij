const TestEnv = require('../../helpers/test-env');
const path = require('path');
const fs = require('fs').promises;

describe('tract onboard', () => {
  let env;

  beforeEach(async () => {
    env = new TestEnv();
    await env.init();
  });

  afterEach(async () => {
    await env.cleanup();
  });

  test('creates local-only project structure', async () => {
    const repo = await env.createRepo('test-project', { project: 'APP', mode: 'local' });
    
    const tractDir = path.join(repo.path, '.tract');
    const issuesDir = path.join(repo.path, 'issues');
    const worklogsDir = path.join(repo.path, 'worklogs');
    
    const tractExists = await fs.access(tractDir).then(() => true).catch(() => false);
    const issuesExists = await fs.access(issuesDir).then(() => true).catch(() => false);
    const worklogsExists = await fs.access(worklogsDir).then(() => true).catch(() => false);
    
    expect(tractExists).toBe(true);
    expect(issuesExists).toBe(true);
    expect(worklogsExists).toBe(true);
  });

  test('creates config.yaml', async () => {
    const repo = await env.createRepo('test-project', { project: 'APP' });
    
    const configPath = path.join(repo.path, '.tract', 'config.yaml');
    const exists = await fs.access(configPath).then(() => true).catch(() => false);
    
    expect(exists).toBe(true);
  });

  test('initializes git repository', async () => {
    const repo = await env.createRepo('test-project', { project: 'APP' });
    
    const log = await repo.git.log();
    expect(log.all.length).toBeGreaterThan(0);
    expect(log.latest.message).toContain('Initial tract setup');
  });

  // TODO: Enrich with scenarios
  // - Jira sync mode setup
  // - Interactive mode
  // - Invalid project keys
  // - Existing .tract directory
});
