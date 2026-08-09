const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const doctor = require(path.join(__dirname, '../../../commands/doctor'));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a minimal tract project in a temp dir.
 * opts.withGit   (default true) — init a git repo
 * opts.withTract (default true) — create .tract/ and config.yaml
 * opts.config    (default 'project: TEST\n') — content of config.yaml; null = omit file
 */
function makeTmpTractDir(opts = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tract-doctor-test-'));

  if (opts.withTract !== false) {
    fs.mkdirSync(path.join(tmpDir, '.tract'), { recursive: true });
    const config = opts.config !== undefined ? opts.config : 'project: TEST\n';
    if (config !== null) {
      fs.writeFileSync(path.join(tmpDir, '.tract', 'config.yaml'), config);
    }
    fs.mkdirSync(path.join(tmpDir, 'issues'), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, 'worklogs'), { recursive: true });
  }

  if (opts.withGit !== false) {
    execSync('git init', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: tmpDir, stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { cwd: tmpDir, stdio: 'pipe' });
  }

  return tmpDir;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tract doctor', () => {
  let exitMock;
  let consoleLogMock;

  beforeEach(() => {
    // Throw on process.exit so doctor() rejects with a catchable error
    exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    delete process.env.TRACT_SYNC_SERVER;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('finds .tract in current directory', async () => {
    // Valid minimal project — doctor should complete with exit(0)
    const tmpDir = makeTmpTractDir();
    try {
      await expect(doctor({ tract: tmpDir })).rejects.toThrow('process.exit:0');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('finds .tract in parent directory', async () => {
    // Call doctor from a subdirectory — findTractRoot should traverse up
    const tmpDir = makeTmpTractDir();
    const subdir = path.join(tmpDir, 'src');
    fs.mkdirSync(subdir, { recursive: true });
    try {
      // Should succeed (exit 0), not crash with unhandled error
      await expect(doctor({ tract: subdir })).rejects.toThrow('process.exit:0');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('provides helpful message when not in tract repo', async () => {
    // No .tract directory anywhere in the tree — doctor shows onboarding help
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tract-no-tract-'));
    try {
      await expect(doctor({ tract: tmpDir })).rejects.toThrow('process.exit:1');
      const output = consoleLogMock.mock.calls.flat().join('\n');
      expect(output).toMatch(/tract onboard/i);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('validates config.yaml - reports error when project field missing', async () => {
    // config.yaml exists but has no "project:" field → check fails → exit(1)
    const tmpDir = makeTmpTractDir({ config: 'mode: local\n' });
    try {
      await expect(doctor({ tract: tmpDir })).rejects.toThrow('process.exit:1');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('warns about ticket body mentions without frontmatter links', async () => {
    // Check #15: ticket body references APP-2 but frontmatter has no links entry
    const tmpDir = makeTmpTractDir();
    fs.writeFileSync(
      path.join(tmpDir, 'issues', 'APP-1.md'),
      [
        '---',
        'id: APP-1',
        'title: Fix auth bug',
        'status: todo',
        '---',
        '',
        'This is related to APP-2 which has the root cause.',
        ''
      ].join('\n')
    );
    try {
      // Warnings don't block exit(0)
      await expect(doctor({ tract: tmpDir })).rejects.toThrow('process.exit:0');
      const output = consoleLogMock.mock.calls.flat().join('\n');
      expect(output).toMatch(/APP-1/);
      expect(output).toMatch(/APP-2/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
