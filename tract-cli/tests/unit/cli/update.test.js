const path = require('path');
const fs = require('fs');

// Mock dependencies before requiring update.js
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

// jest.mock() calls are hoisted above `const` declarations in this file's
// babel config, which put `catalogPath`/`updateCheckPath` in the temporal
// dead zone when referenced as the hoisted call's first argument. jest.doMock()
// is not hoisted, so it can safely reference them in normal declaration order.
const catalogPath = path.join(__dirname, '../../../commands/catalog');
jest.doMock(catalogPath, () => ({
  readGlobalConfig: jest.fn()
}));

const updateCheckPath = path.join(__dirname, '../../../lib/update-check');
jest.doMock(updateCheckPath, () => ({
  clearNotice: jest.fn(),
  trigger: jest.fn()
}));

const { execSync } = require('child_process');
const { readGlobalConfig } = require(catalogPath);
const update = require(path.join(__dirname, '../../../commands/update'));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tract update', () => {
  let exitMock;
  let fsSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    fsSpy = jest.spyOn(fs, 'existsSync');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('isGitCheckout returns true when .git present in CLI parent', async () => {
    // Simulate .git existing in the CLI's parent directory
    fsSpy.mockReturnValue(true);
    readGlobalConfig.mockReturnValue({}); // no catalog server
    execSync.mockImplementation(() => {}); // git pull succeeds

    await update();

    // Should have called execSync with git pull
    expect(execSync).toHaveBeenCalledWith(
      'git pull --ff-only',
      expect.objectContaining({ stdio: 'inherit' })
    );
  });

  test('isGitCheckout returns false without .git', async () => {
    fsSpy.mockReturnValue(false); // no .git
    readGlobalConfig.mockReturnValue({}); // no catalog server

    await expect(update()).rejects.toThrow('process.exit:1');
    expect(execSync).not.toHaveBeenCalled();
  });

  test('no catalog server + git checkout → attempts git pull', async () => {
    fsSpy.mockReturnValue(true); // .git exists
    readGlobalConfig.mockReturnValue({}); // no catalog_server key
    execSync.mockImplementation(() => {}); // pull succeeds

    await update();

    expect(execSync).toHaveBeenCalledWith('git pull --ff-only', expect.any(Object));
  });

  test('no catalog server + not git checkout → error with instructions', async () => {
    fsSpy.mockReturnValue(false); // no .git
    readGlobalConfig.mockReturnValue({}); // no catalog server

    await expect(update()).rejects.toThrow('process.exit:1');
    expect(execSync).not.toHaveBeenCalled();
  });
});
