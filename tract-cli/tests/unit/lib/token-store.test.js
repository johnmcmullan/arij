const fs = require('fs');
const os = require('os');
const path = require('path');

function freshTokenStore(securityHome) {
  jest.resetModules();
  process.env.TRACT_SECURITY_HOME = securityHome;
  return require('../../../lib/token-store');
}

describe('token-store', () => {
  let securityHome, tokenStore;

  beforeEach(() => {
    securityHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tract-token-store-test-'));
    tokenStore = freshTokenStore(securityHome);
  });

  afterEach(() => {
    delete process.env.TRACT_SECURITY_HOME;
    fs.rmSync(securityHome, { recursive: true, force: true });
  });

  describe('generateRawToken', () => {
    test('starts with tract_ and decodes to email:hex', () => {
      const raw = tokenStore.generateRawToken('alice@example.com');
      expect(raw.startsWith('tract_')).toBe(true);
      const decoded = Buffer.from(raw.slice('tract_'.length), 'base64').toString('utf8');
      expect(decoded).toMatch(/^alice@example\.com:[0-9a-f]{32}$/);
    });

    test('generates a different random suffix each time', () => {
      const a = tokenStore.generateRawToken('alice@example.com');
      const b = tokenStore.generateRawToken('alice@example.com');
      expect(a).not.toBe(b);
    });
  });

  describe('createToken / validateToken', () => {
    test('creates a token that validates back to the owner', () => {
      const raw = tokenStore.createToken({ email: 'alice@example.com', name: 'ci', ttlDays: 30 });
      const record = tokenStore.validateToken(raw);
      expect(record).not.toBeNull();
      expect(record.email).toBe('alice@example.com');
      expect(record.name).toBe('ci');
    });

    test('never persists the raw token on disk — only its hash', () => {
      const raw = tokenStore.createToken({ email: 'alice@example.com', name: 'ci', ttlDays: 30 });
      const files = fs.readdirSync(path.join(securityHome, 'tokens'));
      expect(files).toHaveLength(1);
      const content = fs.readFileSync(path.join(securityHome, 'tokens', files[0]), 'utf8');
      expect(content).not.toContain(raw);
      expect(files[0]).toBe(`${tokenStore.hashToken(raw)}.yaml`);
    });

    test('rejects an unknown token', () => {
      expect(tokenStore.validateToken('tract_not-a-real-token')).toBeNull();
    });

    test('rejects a token without the tract_ prefix', () => {
      expect(tokenStore.validateToken('garbage')).toBeNull();
      expect(tokenStore.validateToken('')).toBeNull();
      expect(tokenStore.validateToken(null)).toBeNull();
    });

    test('rejects an expired token', () => {
      const raw = tokenStore.createToken({ email: 'alice@example.com', name: 'ci', ttlDays: -1 });
      expect(tokenStore.validateToken(raw)).toBeNull();
    });

    test('updates lastUsed on successful validation', () => {
      const raw = tokenStore.createToken({ email: 'alice@example.com', name: 'ci', ttlDays: 30 });
      expect(tokenStore.listTokens('alice@example.com')[0].lastUsed).toBeNull();
      tokenStore.validateToken(raw);
      expect(tokenStore.listTokens('alice@example.com')[0].lastUsed).not.toBeNull();
    });
  });

  describe('listTokens', () => {
    test('scopes to the given email', () => {
      tokenStore.createToken({ email: 'alice@example.com', name: 'a1', ttlDays: 30 });
      tokenStore.createToken({ email: 'bob@example.com', name: 'b1', ttlDays: 30 });

      expect(tokenStore.listTokens('alice@example.com')).toHaveLength(1);
      expect(tokenStore.listTokens('bob@example.com')).toHaveLength(1);
    });

    test('returns everything when called with no email', () => {
      tokenStore.createToken({ email: 'alice@example.com', name: 'a1', ttlDays: 30 });
      tokenStore.createToken({ email: 'bob@example.com', name: 'b1', ttlDays: 30 });
      expect(tokenStore.listTokens()).toHaveLength(2);
    });

    test('returns an empty array when no tokens directory exists yet', () => {
      expect(tokenStore.listTokens('alice@example.com')).toEqual([]);
    });

    test('never includes the raw token in listed records', () => {
      const raw = tokenStore.createToken({ email: 'alice@example.com', name: 'a1', ttlDays: 30 });
      const records = tokenStore.listTokens('alice@example.com');
      expect(JSON.stringify(records)).not.toContain(raw);
    });
  });

  describe('revokeToken', () => {
    test('revokes by name, scoped to the owner', () => {
      tokenStore.createToken({ email: 'alice@example.com', name: 'ci', ttlDays: 30 });
      expect(tokenStore.revokeToken('ci', 'alice@example.com')).toBe(true);
      expect(tokenStore.listTokens('alice@example.com')).toHaveLength(0);
    });

    test('revokes by raw token', () => {
      const raw = tokenStore.createToken({ email: 'alice@example.com', name: 'ci', ttlDays: 30 });
      expect(tokenStore.revokeToken(raw, 'alice@example.com')).toBe(true);
      expect(tokenStore.validateToken(raw)).toBeNull();
    });

    test("cannot revoke another user's token by name", () => {
      tokenStore.createToken({ email: 'alice@example.com', name: 'ci', ttlDays: 30 });
      expect(tokenStore.revokeToken('ci', 'bob@example.com')).toBe(false);
      expect(tokenStore.listTokens('alice@example.com')).toHaveLength(1);
    });

    test('returns false for a name that does not exist', () => {
      expect(tokenStore.revokeToken('nonexistent', 'alice@example.com')).toBe(false);
    });
  });
});
