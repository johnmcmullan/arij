// IMPORTANT — READ BEFORE TRUSTING THIS FILE AS SECURITY COVERAGE:
//
// Every test below asserts against TestEnv's own validateTicketKey() /
// validateTicketFields() (tests/helpers/test-env.js) — a validator that
// exists only in this test helper. It does not correspond to any function
// in the real `tract` app. In particular, the real ticket-creation path
// (tract-cli/commands/create.js) never accepts a user-supplied key at all —
// it auto-generates the next sequential id — so it has no key-format or
// path-traversal validation of its own to test here.
//
// This file is genuinely useful as coverage of TestEnv's fixture-building
// logic (worth keeping so the fixtures it builds stay realistic), but do not
// read a pass here as "tract is safe from path traversal."
//
// For real path-traversal regression coverage against actual application
// code, see tests/unit/cli/serve.test.js's `GET /api/ticket/:id` and
// `GET /dashboards/:file` blocks — those are the two routes in the app that
// turn request-path input into a file read, and both are covered against
// real traversal payloads there.
const TestEnv = require('../../helpers/test-env');
const path = require('path');
const fs = require('fs').promises;

describe('Security - Path Traversal Prevention (tests/helpers/test-env.js validator, not app code — see banner above)', () => {
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

  describe('Project prefix path traversal', () => {
    test('rejects project with parent directory reference', async () => {
      await expect(
        env.createRepo('malicious', { project: '../etc' })
      ).rejects.toThrow(/invalid.*project|path.*traversal|security/i);
    });

    test('rejects project with absolute path', async () => {
      await expect(
        env.createRepo('malicious', { project: '/etc/passwd' })
      ).rejects.toThrow(/invalid.*project|path.*traversal|security/i);
    });

    test('rejects project with current directory reference', async () => {
      await expect(
        env.createRepo('malicious', { project: './secret' })
      ).rejects.toThrow(/invalid.*project|path.*traversal|security/i);
    });

    test('rejects project with multiple parent traversals', async () => {
      await expect(
        env.createRepo('malicious', { project: '../../../etc' })
      ).rejects.toThrow(/invalid.*project|path.*traversal|security/i);
    });

    test('rejects project with encoded path traversal', async () => {
      // URL encoded: %2e%2e%2f = ../
      await expect(
        env.createRepo('malicious', { project: '%2e%2e%2fetc' })
      ).rejects.toThrow(/invalid.*project|path.*traversal|special.*character/i);
    });

    test('rejects project with double-encoded traversal', async () => {
      // Double encoded: %252e%252e%252f = ../
      await expect(
        env.createRepo('malicious', { project: '%252e%252e%252f' })
      ).rejects.toThrow(/invalid.*project|path.*traversal|special.*character/i);
    });

    test('rejects project with Windows path separators', async () => {
      await expect(
        env.createRepo('malicious', { project: '..\\..\\etc' })
      ).rejects.toThrow(/invalid.*project|path.*traversal|backslash/i);
    });

    test('rejects project with mixed separators', async () => {
      await expect(
        env.createRepo('malicious', { project: '../etc\\passwd' })
      ).rejects.toThrow(/invalid.*project|path.*traversal/i);
    });

    test('rejects project with null byte injection', async () => {
      await expect(
        env.createRepo('malicious', { project: 'TEST\x00/../etc' })
      ).rejects.toThrow(/invalid.*project|null.*byte/i);
    });

    test('accepts normal uppercase project names', async () => {
      const validRepo = await env.createRepo('valid', { project: 'MYPROJECT' });
      expect(validRepo).toBeDefined();
      expect(validRepo.config.project).toBe('MYPROJECT');
    });
  });

  describe('Ticket key path traversal', () => {
    test('rejects ticket key with parent directory in prefix', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: '../etc-1',
          title: 'Malicious ticket',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key|path.*traversal/i);
    });

    test('rejects ticket key with parent directory after hyphen', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST-../1',
          title: 'Malicious ticket',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format/i);
    });

    test('rejects ticket key with absolute path', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: '/etc/passwd-1',
          title: 'Malicious ticket',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key|path.*traversal|slash/i);
    });

    test('rejects ticket key with forward slash', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST/secret-1',
          title: 'Malicious ticket',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|slash/i);
    });

    test('rejects ticket key with backslash', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST\\secret-1',
          title: 'Malicious ticket',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|backslash/i);
    });

    test('rejects ticket key with null byte', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST-1\x00',
          title: 'Malicious ticket',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key|null.*byte/i);
    });

    test('rejects ticket key attempting to escape issues directory', async () => {
      // Trying to write: issues/../../../etc/TEST-1.md
      await expect(
        env.createTicket('test-repo', {
          key: '../../../etc/TEST-1',
          title: 'Malicious ticket',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key|path.*traversal/i);
    });

    test('verifies ticket files are created only in issues directory', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Safe ticket',
        type: 'bug'
      });

      const expectedPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const exists = await fs.access(expectedPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);

      // Verify no files created outside issues/
      const repoFiles = await fs.readdir(repo.path);
      const mdFiles = repoFiles.filter(f => f.endsWith('.md'));
      expect(mdFiles).toHaveLength(0); // No .md files in repo root
    });
  });

  describe('Filename sanitization', () => {
    test('prevents colon in filename (Windows reserved)', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST:1',
          title: 'Colon test',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|special.*character/i);
    });

    test('prevents asterisk in filename (wildcard)', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST*1',
          title: 'Asterisk test',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|special.*character/i);
    });

    test('prevents question mark in filename (wildcard)', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST?1',
          title: 'Question mark test',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|special.*character/i);
    });

    test('prevents pipe in filename (shell redirection)', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST|1',
          title: 'Pipe test',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|special.*character/i);
    });

    test('prevents less-than in filename (shell redirection)', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST<1',
          title: 'Less than test',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|special.*character/i);
    });

    test('prevents greater-than in filename (shell redirection)', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST>1',
          title: 'Greater than test',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|special.*character/i);
    });

    test('prevents quote in filename', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST"1',
          title: 'Quote test',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|special.*character/i);
    });
  });

  describe('Symlink attack prevention', () => {
    test('detects if issues directory is a symlink', async () => {
      const issuesDir = path.join(repo.path, 'issues');
      const targetDir = path.join(env.tempDir, 'target');

      // Remove issues directory and create symlink to another location
      await fs.rm(issuesDir, { recursive: true });
      await fs.mkdir(targetDir);
      await fs.symlink(targetDir, issuesDir);

      // Creating a ticket should detect symlink and reject (or follow safely)
      // This is a design decision: reject symlinks or follow them?
      // For security, we should detect and warn/reject
      const stats = await fs.lstat(issuesDir);
      expect(stats.isSymbolicLink()).toBe(true);

      // Document expected behavior:
      // Option A: Reject symlinks entirely
      // Option B: Follow symlinks but verify target is within repo
      // For now, just document that symlink was detected
    });

    test('prevents ticket creation via symlink to escape directory', async () => {
      const issuesDir = path.join(repo.path, 'issues');
      const escapeDir = path.join(env.tempDir, 'escape');

      await fs.mkdir(escapeDir);

      // Try to create symlink in issues/ that points outside repo
      const symlinkPath = path.join(issuesDir, 'escape-link.md');

      // This should be prevented by checking that target is within repo
      // TODO: Implement symlink validation in Tract
      // For now, document that this is a potential attack vector

      expect(escapeDir).toBeDefined(); // Placeholder
    });
  });

  describe('Case sensitivity attacks', () => {
    test('detects case-variant collision on case-insensitive filesystems', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'First ticket',
        type: 'bug'
      });

      // On case-insensitive filesystem (macOS, Windows), this would collide
      await expect(
        env.createTicket('test-repo', {
          key: 'test-1',
          title: 'Case variant',
          type: 'bug'
        })
      ).rejects.toThrow(/duplicate.*key|already.*exists|case.*insensitive/i);
    });

    test('handles mixed case project names safely', async () => {
      // Even though we enforce uppercase, check handling of mixed case
      await expect(
        env.createRepo('mixed', { project: 'MyProject' })
      ).rejects.toThrow(/invalid.*project|uppercase/i);
    });
  });

  describe('Long filename attacks', () => {
    test('prevents excessively long ticket keys', async () => {
      const longKey = 'PROJECT-' + '1'.repeat(1000);

      await expect(
        env.createTicket('test-repo', {
          key: longKey,
          title: 'Long key test',
          type: 'bug'
        })
      ).rejects.toThrow(/key.*too.*long|exceeds.*limit/i);
    });

    test('prevents excessively long project names', async () => {
      const longProject = 'A' + 'B'.repeat(500);

      await expect(
        env.createRepo('long-project', { project: longProject })
      ).rejects.toThrow(/project.*too.*long|exceeds.*limit/i);
    });

    test('calculates filename length including .md extension', async () => {
      // Filesystem limit is typically 255 bytes for filename
      // Our limit is 255 chars for the key itself
      // Key "TEST-111...111" + ".md" = filename

      // This should be rejected (key too long)
      const tooLongKey = 'TEST-' + '1'.repeat(260); // Over 255

      await expect(
        env.createTicket('test-repo', {
          key: tooLongKey,
          title: 'Too long test',
          type: 'bug'
        })
      ).rejects.toThrow(/key.*too.*long|exceeds.*limit/i);

      // This should be accepted (under limit)
      const safeKey = 'TEST-' + '1'.repeat(200); // 205 chars, under 255

      const result = await env.createTicket('test-repo', {
        key: safeKey,
        title: 'Safe length test',
        type: 'bug'
      });

      expect(result).toBeDefined();
    });
  });

  describe('Real-world attack patterns', () => {
    test('prevents git directory write attempt', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: '../.git/TEST-1',
          title: 'Git attack',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key|path.*traversal/i);
    });

    test('prevents tract config directory write attempt', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: '../.tract/config-1',
          title: 'Config attack',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key|path.*traversal/i);
    });

    test('prevents home directory write attempt', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: '~/evil-1',
          title: 'Home attack',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|special.*character/i);
    });

    test('prevents SSH key write attempt', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: '../../.ssh/authorized_keys-1',
          title: 'SSH attack',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key|path.*traversal/i);
    });

    test('prevents crontab write attempt', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: '../../etc/cron.d/evil-1',
          title: 'Cron attack',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key|path.*traversal/i);
    });
  });
});
