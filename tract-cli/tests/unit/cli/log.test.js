/**
 * tract log is offline-first (see commands/log.js): it writes a JSONL line
 * directly to a local worklogs git repo and commits it, rather than calling
 * a sync server over HTTP. tract-sync's daemon (git_to_jira.rs::push_worklogs
 * on the Rust side) is what later pushes unsynced entries to Jira. There is
 * no HTTP call in this command to mock — the only external interface is the
 * worklogs git repo on disk.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const log = require(path.join(__dirname, '../../../commands/log'));

function makeWorklogsRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tract-log-test-worklogs-'));
  execSync('git init -q', { cwd: dir });
  execSync('git config user.email "test@example.com"', { cwd: dir });
  execSync('git config user.name "Test"', { cwd: dir });
  return dir;
}

function readJsonlEntries(worklogsDir, month) {
  const filePath = path.join(worklogsDir, `${month}.jsonl`);
  return fs.readFileSync(filePath, 'utf8')
    .trim()
    .split('\n')
    .map(line => JSON.parse(line));
}

describe('tract log', () => {
  let exitMock, worklogsDir;

  beforeEach(() => {
    jest.clearAllMocks();
    exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    worklogsDir = makeWorklogsRepo();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(worklogsDir, { recursive: true, force: true });
  });

  test('appends a JSONL entry to <worklogsDir>/<YYYY-MM>.jsonl', async () => {
    const started = new Date('2026-02-21T09:00:00Z');
    await log('APP-1', '2h', 'Fixed the bug', {
      worklogsDir, author: 'john', started: started.toISOString()
    });

    const entries = readJsonlEntries(worklogsDir, '2026-02');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      issue: 'APP-1',
      author: 'john',
      seconds: 7200,
      comment: 'Fixed the bug',
      jiraId: '',
    });
  });

  test('worklog references correct ticket', async () => {
    await log('TEST-42', '1h', 'work', {
      worklogsDir, author: 'alice', started: '2026-02-21T09:00:00Z'
    });
    const entries = readJsonlEntries(worklogsDir, '2026-02');
    expect(entries[0].issue).toBe('TEST-42');
  });

  test.each([
    ['2h', 7200],
    ['30m', 1800],
    ['1h30m', 5400],
    ['1d', 28800],       // 1d = 8h by convention (see parseTimeToSeconds)
    ['90', 5400],        // bare number = minutes
  ])('parses time format %s as %i seconds', async (input, expectedSeconds) => {
    await log('APP-1', input, 'design session', {
      worklogsDir, author: 'bob', started: '2026-02-21T09:00:00Z'
    });
    const entries = readJsonlEntries(worklogsDir, '2026-02');
    expect(entries[entries.length - 1].seconds).toBe(expectedSeconds);
  });

  test('commits the worklog entry to git', async () => {
    await log('APP-1', '1h', 'work', {
      worklogsDir, author: 'john', started: '2026-02-21T09:00:00Z'
    });

    const log_ = execSync('git log --format=%s', { cwd: worklogsDir, encoding: 'utf8' });
    expect(log_).toContain('worklog: APP-1 1h');
  });

  test('rejects an unparseable time string', async () => {
    await expect(
      log('APP-1', 'not-a-time', 'work', { worklogsDir, author: 'john' })
    ).rejects.toThrow('process.exit:1');

    const errorOutput = console.error.mock.calls.flat().join('\n');
    expect(errorOutput).toMatch(/Could not parse time/);
    expect(fs.existsSync(path.join(worklogsDir, `${new Date().toISOString().slice(0, 7)}.jsonl`))).toBe(false);
  });

  test('rejects an invalid --started date', async () => {
    await expect(
      log('APP-1', '1h', 'work', { worklogsDir, author: 'john', started: 'not-a-date' })
    ).rejects.toThrow('process.exit:1');

    const errorOutput = console.error.mock.calls.flat().join('\n');
    expect(errorOutput).toMatch(/Invalid --started date/);
  });

  test('errors when no worklogs repo can be found', async () => {
    // No worklogsDir option, no TRACT_WORKLOGS_DIR, and HOME points at an
    // empty directory with no ~/.tract — findWorklogsRepo() has nothing to find.
    const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tract-log-test-empty-home-'));
    const prevHome = process.env.HOME;
    const prevDir = process.env.TRACT_WORKLOGS_DIR;
    delete process.env.TRACT_WORKLOGS_DIR;
    process.env.HOME = emptyHome;
    try {
      await expect(
        log('APP-1', '1h', 'work', { author: 'john', started: '2026-02-21T09:00:00Z' })
      ).rejects.toThrow('process.exit:1');
      const errorOutput = console.error.mock.calls.flat().join('\n');
      expect(errorOutput).toMatch(/Could not find local worklogs repo/);
    } finally {
      process.env.HOME = prevHome;
      if (prevDir === undefined) delete process.env.TRACT_WORKLOGS_DIR;
      else process.env.TRACT_WORKLOGS_DIR = prevDir;
      fs.rmSync(emptyHome, { recursive: true, force: true });
    }
  });
});
