// IMPORTANT — READ BEFORE TRUSTING THIS FILE AS APP COVERAGE:
//
// Every test below asserts against TestEnv's own validateTicketKey()
// (tests/helpers/test-env.js), not the real app. tract-cli/commands/create.js
// never accepts a user-supplied ticket key — it auto-generates the next
// sequential id itself — so there is no real key-format validator for these
// cases (uppercase enforcement, hyphen rules, path-traversal, length limits)
// to exercise. Ticket keys the app does read externally come from Jira via
// tract-sync (Rust; see tract-sync/src/ticket_writer.rs), which is outside
// this JS suite's reach entirely.
//
// This file is still useful as coverage of TestEnv's fixture-building logic,
// but a pass here says nothing about real key handling in tract. If a real
// key validator gets added to tract-cli, point these assertions at it.
const TestEnv = require('../../helpers/test-env');
const path = require('path');
const fs = require('fs').promises;

describe('Ticket Key Validation (tests/helpers/test-env.js validator, not app code — see banner above)', () => {
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

  describe('Valid ticket key formats', () => {
    test('accepts standard PROJECT-123 format', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-123',
        title: 'Valid ticket',
        type: 'bug'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-123.md');
      const exists = await fs.access(ticketPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    test('accepts project keys with multiple words', async () => {
      const multiWordRepo = await env.createRepo('multi-word', { project: 'MYPROJECT' });
      await env.createTicket('multi-word', {
        key: 'MYPROJECT-1',
        title: 'Valid ticket',
        type: 'task'
      });

      const ticketPath = path.join(multiWordRepo.path, 'issues', 'MYPROJECT-1.md');
      const exists = await fs.access(ticketPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    test('accepts single digit ticket numbers', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'First ticket',
        type: 'story'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const exists = await fs.access(ticketPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    test('accepts large ticket numbers', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-999999',
        title: 'High number ticket',
        type: 'epic'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-999999.md');
      const exists = await fs.access(ticketPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('Invalid ticket key formats', () => {
    test('rejects lowercase project key', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'test-1',
          title: 'Invalid lowercase',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|uppercase/i);
    });

    test('rejects mixed case project key', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'Test-1',
          title: 'Invalid mixed case',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|uppercase/i);
    });

    test('rejects ticket key without number', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST-',
          title: 'No number',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|number.*required/i);
    });

    test('rejects ticket key without hyphen', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST123',
          title: 'No hyphen',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|hyphen|separator/i);
    });

    test('rejects ticket key with spaces', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST - 1',
          title: 'Spaces in key',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|space/i);
    });

    test('rejects ticket key with special characters', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST@1',
          title: 'Special char in key',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|special.*character/i);
    });

    test('rejects ticket key with path traversal attempt', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: '../../../etc/TEST-1',
          title: 'Path traversal',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|path.*traversal|security/i);
    });

    test('rejects ticket key with forward slash', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST/1',
          title: 'Slash in key',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|slash/i);
    });

    test('rejects ticket key with backslash', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST\\1',
          title: 'Backslash in key',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|backslash/i);
    });

    test('rejects excessively long ticket key', async () => {
      const longKey = 'PROJECT-' + '1'.repeat(1000);
      await expect(
        env.createTicket('test-repo', {
          key: longKey,
          title: 'Very long key',
          type: 'bug'
        })
      ).rejects.toThrow(/key.*too.*long|exceeds.*limit/i);
    });

    test('rejects negative ticket numbers', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST--1',
          title: 'Negative number',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|negative|number/i);
    });

    test('rejects zero ticket number', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST-0',
          title: 'Zero number',
          type: 'bug'
        })
      ).rejects.toThrow(/invalid.*key.*format|zero|positive/i);
    });
  });

  describe('Missing or empty ticket keys', () => {
    test('rejects ticket with missing key field', async () => {
      await expect(
        env.createTicket('test-repo', {
          title: 'No key',
          type: 'bug'
        })
      ).rejects.toThrow(/key.*required|missing.*key/i);
    });

    test('rejects ticket with empty string key', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: '',
          title: 'Empty key',
          type: 'bug'
        })
      ).rejects.toThrow(/key.*required|empty.*key/i);
    });

    test('rejects ticket with null key', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: null,
          title: 'Null key',
          type: 'bug'
        })
      ).rejects.toThrow(/key.*required|invalid.*key/i);
    });

    test('rejects ticket with undefined key', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: undefined,
          title: 'Undefined key',
          type: 'bug'
        })
      ).rejects.toThrow(/key.*required|missing.*key/i);
    });

    test('rejects ticket with whitespace-only key', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: '   ',
          title: 'Whitespace key',
          type: 'bug'
        })
      ).rejects.toThrow(/key.*required|empty.*key/i);
    });
  });

  describe('Duplicate ticket key detection', () => {
    test('rejects duplicate ticket key in same repo', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'First ticket',
        type: 'bug'
      });

      await expect(
        env.createTicket('test-repo', {
          key: 'TEST-1',
          title: 'Duplicate ticket',
          type: 'story'
        })
      ).rejects.toThrow(/duplicate.*key|already.*exists|TEST-1/i);
    });

    test('allows same ticket key in different repos', async () => {
      const repo1 = await env.createRepo('repo1', { project: 'PROJ1' });
      const repo2 = await env.createRepo('repo2', { project: 'PROJ2' });

      await env.createTicket('repo1', {
        key: 'PROJ1-1',
        title: 'Ticket in repo1',
        type: 'bug'
      });

      await env.createTicket('repo2', {
        key: 'PROJ2-1',
        title: 'Ticket in repo2',
        type: 'bug'
      });

      // Both should exist
      const ticket1 = path.join(repo1.path, 'issues', 'PROJ1-1.md');
      const ticket2 = path.join(repo2.path, 'issues', 'PROJ2-1.md');

      const exists1 = await fs.access(ticket1).then(() => true).catch(() => false);
      const exists2 = await fs.access(ticket2).then(() => true).catch(() => false);

      expect(exists1).toBe(true);
      expect(exists2).toBe(true);
    });

    test('detects duplicate after case-insensitive check', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'First ticket',
        type: 'bug'
      });

      // On case-insensitive filesystems (macOS, Windows), this would conflict
      await expect(
        env.createTicket('test-repo', {
          key: 'test-1',
          title: 'Case variant',
          type: 'story'
        })
      ).rejects.toThrow(/duplicate.*key|already.*exists|case.*insensitive/i);
    });
  });

  describe('Project key mismatch', () => {
    test('rejects ticket key with wrong project prefix', async () => {
      // Repo is configured for project 'TEST'
      await expect(
        env.createTicket('test-repo', {
          key: 'WRONG-1',
          title: 'Wrong project',
          type: 'bug'
        })
      ).rejects.toThrow(/project.*mismatch|wrong.*project|expected.*TEST/i);
    });

    test('accepts ticket key matching repo project', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Correct project',
        type: 'bug'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const exists = await fs.access(ticketPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
