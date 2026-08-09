const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

const tokenCommand = require(path.join(__dirname, '../../../commands/token'));
const tokenStore = require(path.join(__dirname, '../../../lib/token-store'));

const CURRENT_USER = 'dev@example.com';

describe('tract token', () => {
  let securityHome, exitMock, logSpy, errorSpy;

  beforeEach(() => {
    securityHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tract-token-cmd-test-'));
    process.env.TRACT_SECURITY_HOME = securityHome;
    execSync.mockReturnValue(`${CURRENT_USER}\n`);
    exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.TRACT_SECURITY_HOME;
    fs.rmSync(securityHome, { recursive: true, force: true });
  });

  function output() {
    return [...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join('\n');
  }

  describe('create', () => {
    test('creates a token for the current user and prints it', () => {
      tokenCommand('create', undefined, { name: 'my-laptop', ttl: '30' });

      expect(output()).toContain('Token created successfully');
      expect(output()).toMatch(/tract_[A-Za-z0-9+/=]+/);

      const records = tokenStore.listTokens(CURRENT_USER);
      expect(records).toHaveLength(1);
      expect(records[0].name).toBe('my-laptop');
    });

    test('errors without --name', () => {
      expect(() => tokenCommand('create', undefined, {})).toThrow('process.exit:1');
      expect(output()).toMatch(/--name is required/);
    });

    test('errors on invalid --ttl', () => {
      expect(() => tokenCommand('create', undefined, { name: 'x', ttl: 'not-a-number' })).toThrow('process.exit:1');
      expect(output()).toMatch(/Invalid --ttl/);
    });

    test('errors when git user.email cannot be resolved', () => {
      execSync.mockImplementation(() => { throw new Error('not a git repo'); });
      expect(() => tokenCommand('create', undefined, { name: 'x' })).toThrow('process.exit:1');
      expect(output()).toMatch(/Could not determine your email/);
    });
  });

  describe('create-service', () => {
    test('requires admin access', () => {
      expect(() =>
        tokenCommand('create-service', undefined, { user: 'svc@example.com', name: 'ci-bot', ttl: '90' })
      ).toThrow('process.exit:1');
      expect(output()).toMatch(/requires admin access/);
    });

    test('succeeds for an admin and creates a token owned by --user', () => {
      fs.writeFileSync(
        path.join(securityHome, 'permissions.yaml'),
        `admins:\n  - ${CURRENT_USER}\n`
      );

      tokenCommand('create-service', undefined, { user: 'svc@example.com', name: 'ci-bot', ttl: '90' });

      expect(output()).toContain('Token created successfully');
      const records = tokenStore.listTokens('svc@example.com');
      expect(records).toHaveLength(1);
      expect(records[0].name).toBe('ci-bot');
    });
  });

  describe('list', () => {
    test("shows only the current user's tokens by default", () => {
      tokenStore.createToken({ email: CURRENT_USER, name: 'mine', ttlDays: 30 });
      tokenStore.createToken({ email: 'other@example.com', name: 'theirs', ttlDays: 30 });

      tokenCommand('list', undefined, {});

      expect(output()).toContain('mine');
      expect(output()).not.toContain('theirs');
    });

    test('--all requires admin access', () => {
      expect(() => tokenCommand('list', undefined, { all: true })).toThrow('process.exit:1');
      expect(output()).toMatch(/--all requires admin access/);
    });

    test('--all shows every token for an admin', () => {
      fs.writeFileSync(path.join(securityHome, 'permissions.yaml'), `admins:\n  - ${CURRENT_USER}\n`);
      tokenStore.createToken({ email: CURRENT_USER, name: 'mine', ttlDays: 30 });
      tokenStore.createToken({ email: 'other@example.com', name: 'theirs', ttlDays: 30 });

      tokenCommand('list', undefined, { all: true });

      expect(output()).toContain('mine');
      expect(output()).toContain('theirs');
    });

    test('prints a friendly message with no tokens', () => {
      tokenCommand('list', undefined, {});
      expect(output()).toMatch(/No tokens found/);
    });
  });

  describe('revoke', () => {
    test('revokes a token by name', () => {
      tokenStore.createToken({ email: CURRENT_USER, name: 'stale', ttlDays: 30 });
      tokenCommand('revoke', 'stale', {});
      expect(output()).toMatch(/Revoked stale/);
      expect(tokenStore.listTokens(CURRENT_USER)).toHaveLength(0);
    });

    test('errors on a nonexistent token', () => {
      expect(() => tokenCommand('revoke', 'nonexistent', {})).toThrow('process.exit:1');
      expect(output()).toMatch(/No token found/);
    });

    test('errors without an argument', () => {
      expect(() => tokenCommand('revoke', undefined, {})).toThrow('process.exit:1');
      expect(output()).toMatch(/Usage: tract token revoke/);
    });
  });

  test('unknown subcommand errors with usage help', () => {
    expect(() => tokenCommand('bogus', undefined, {})).toThrow('process.exit:1');
    expect(output()).toMatch(/Unknown subcommand/);
  });
});
