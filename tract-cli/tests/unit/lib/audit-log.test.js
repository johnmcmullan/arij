const fs = require('fs');
const os = require('os');
const path = require('path');

describe('audit-log', () => {
  let securityHome, auditLog;

  beforeEach(() => {
    securityHome = fs.mkdtempSync(path.join(os.tmpdir(), 'tract-audit-log-test-'));
    process.env.TRACT_SECURITY_HOME = securityHome;
    jest.resetModules();
    auditLog = require('../../../lib/audit-log');
  });

  afterEach(() => {
    delete process.env.TRACT_SECURITY_HOME;
    fs.rmSync(securityHome, { recursive: true, force: true });
  });

  test("appends to today's dated JSONL file", () => {
    auditLog.logAccess({ user: 'alice@example.com', action: 'read:tickets', status: 200 });

    const today = new Date().toISOString().slice(0, 10);
    const filePath = path.join(securityHome, 'audit', `${today}.jsonl`);
    expect(fs.existsSync(filePath)).toBe(true);

    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.user).toBe('alice@example.com');
    expect(entry.action).toBe('read:tickets');
    expect(entry.status).toBe(200);
    expect(entry.timestamp).toBeDefined();
  });

  test('multiple calls append multiple lines, each valid JSON', () => {
    auditLog.logAccess({ user: 'alice@example.com', status: 200 });
    auditLog.logAccess({ user: 'bob@example.com', status: 401 });
    auditLog.logAccess({ user: 'alice@example.com', status: 429 });

    const today = new Date().toISOString().slice(0, 10);
    const lines = fs.readFileSync(path.join(securityHome, 'audit', `${today}.jsonl`), 'utf8')
      .trim().split('\n');
    expect(lines).toHaveLength(3);
    const parsed = lines.map(l => JSON.parse(l));
    expect(parsed.map(e => e.status)).toEqual([200, 401, 429]);
  });

  test('does not throw when the audit directory cannot be created', () => {
    // Point TRACT_SECURITY_HOME at a path whose parent is a *file*, not a
    // directory — mkdirSync(..., {recursive:true}) must fail here, and
    // logAccess must swallow that rather than crashing the caller (the HTTP
    // server, mid-request).
    const blockerFile = path.join(securityHome, 'not-a-directory');
    fs.writeFileSync(blockerFile, 'x');
    process.env.TRACT_SECURITY_HOME = path.join(blockerFile, 'nested');
    jest.resetModules();
    const auditLogBroken = require('../../../lib/audit-log');

    expect(() => auditLogBroken.logAccess({ user: 'alice', status: 200 })).not.toThrow();
  });

  test('entry always includes a fresh ISO timestamp even if one is passed in', () => {
    const before = Date.now();
    auditLog.logAccess({ timestamp: 'not-a-real-timestamp', user: 'alice', status: 200 });
    const today = new Date().toISOString().slice(0, 10);
    const line = fs.readFileSync(path.join(securityHome, 'audit', `${today}.jsonl`), 'utf8').trim();
    const entry = JSON.parse(line);
    expect(new Date(entry.timestamp).getTime()).toBeGreaterThanOrEqual(before);
  });
});
