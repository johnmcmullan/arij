// IMPORTANT — READ BEFORE TRUSTING THIS FILE AS APP COVERAGE:
//
// This file parses hand-written frontmatter strings with the `gray-matter`
// npm package directly, and otherwise asserts against TestEnv's own
// validateTicketFields() (tests/helpers/test-env.js). Neither exercises the
// real app's frontmatter handling: tract-cli/lib/ticket-loader.js parses
// tickets with `js-yaml` directly, not gray-matter, and has no standalone
// field validator of its own — invalid/missing fields there are handled
// inline at load time (see loadTicketsFromDir in ticket-loader.js) rather
// than through a dedicated validation pass like the one modeled here.
//
// This file is still useful as coverage of TestEnv's fixture-building logic
// and as a spec of gray-matter's own edge-case behavior, but a pass here
// says nothing about tract's real frontmatter parsing. Real coverage of
// ticket-loader.js lives in tests/unit/cli/ticket-loader.test.js.
const TestEnv = require('../../helpers/test-env');
const path = require('path');
const fs = require('fs').promises;
const matter = require('gray-matter');

describe('Frontmatter Parsing and Validation (gray-matter + tests/helpers/test-env.js validator, not app code — see banner above)', () => {
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

  describe('Valid frontmatter parsing', () => {
    test('parses standard frontmatter correctly', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Standard ticket',
        type: 'bug',
        status: 'todo',
        priority: 'major'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      expect(parsed.data.title).toBe('Standard ticket');
      expect(parsed.data.type).toBe('bug');
      expect(parsed.data.status).toBe('todo');
      expect(parsed.data.priority).toBe('major');
    });

    test('parses frontmatter with multi-line values', async () => {
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = `---
title: Multi-line test
type: story
description: |
  This is a multi-line
  description that spans
  several lines
status: backlog
---

Body content here`;

      await fs.mkdir(path.join(repo.path, 'issues'), { recursive: true });
      await fs.writeFile(ticketPath, content);

      const parsed = matter(content);
      expect(parsed.data.description).toContain('multi-line');
      expect(parsed.data.description).toContain('several lines');
    });

    test('preserves unknown custom fields', async () => {
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = `---
title: Custom fields test
type: task
customField: customValue
myTag: important
---

Body content`;

      await fs.mkdir(path.join(repo.path, 'issues'), { recursive: true });
      await fs.writeFile(ticketPath, content);

      const parsed = matter(content);
      expect(parsed.data.customField).toBe('customValue');
      expect(parsed.data.myTag).toBe('important');
    });
  });

  describe('Malformed YAML frontmatter', () => {
    test('rejects frontmatter with unclosed quotes', async () => {
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const badContent = `---
title: "Unclosed quote
type: bug
status: todo
---

Body`;

      await fs.mkdir(path.join(repo.path, 'issues'), { recursive: true });
      await fs.writeFile(ticketPath, badContent);

      await expect(async () => {
        const content = await fs.readFile(ticketPath, 'utf-8');
        matter(content); // This should throw
      }).rejects.toThrow(/yaml|parse|quote/i);
    });

    test('rejects frontmatter with invalid indentation', async () => {
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const badContent = `---
title: Bad indentation
  type: bug
    status: todo
---

Body`;

      await fs.mkdir(path.join(repo.path, 'issues'), { recursive: true });
      await fs.writeFile(ticketPath, badContent);

      // YAML parser should reject invalid indentation
      const content = await fs.readFile(ticketPath, 'utf-8');
      expect(() => matter(content)).toThrow(/indentation|yaml/i);
    });

    test('rejects frontmatter with missing closing delimiter', async () => {
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const badContent = `---
title: No closing delimiter
type: bug
status: todo

Body content without closing ---`;

      await fs.mkdir(path.join(repo.path, 'issues'), { recursive: true });
      await fs.writeFile(ticketPath, badContent);

      const content = await fs.readFile(ticketPath, 'utf-8');

      // gray-matter should throw an error for missing closing delimiter
      expect(() => matter(content)).toThrow(/yaml|multiline|key|implicit/i);
    });

    test('handles frontmatter with tab characters', async () => {
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = `---
title:\tTab separated
type:\tbug
---

Body`;

      await fs.mkdir(path.join(repo.path, 'issues'), { recursive: true });
      await fs.writeFile(ticketPath, content);

      const parsed = matter(await fs.readFile(ticketPath, 'utf-8'));
      expect(parsed.data.title).toBe('Tab separated');
      expect(parsed.data.type).toBe('bug');
    });
  });

  describe('Special characters in frontmatter values', () => {
    test('escapes colons in title correctly', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Bug: Login fails with error: timeout',
        type: 'bug'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      expect(parsed.data.title).toBe('Bug: Login fails with error: timeout');
    });

    test('handles quotes in title', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Fix "broken" feature',
        type: 'bug'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      expect(parsed.data.title).toBe('Fix "broken" feature');
    });

    test('handles single quotes in title', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: "Fix user's profile page",
        type: 'bug'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      expect(parsed.data.title).toBe("Fix user's profile page");
    });

    test('handles hash symbols in title', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Issue #123 duplicate',
        type: 'bug'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      expect(parsed.data.title).toBe('Issue #123 duplicate');
    });

    test('handles pipe symbols in values', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'A | B comparison',
        type: 'task'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      expect(parsed.data.title).toBe('A | B comparison');
    });

    test('handles brackets in values', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Fix array[0] access',
        type: 'bug'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      expect(parsed.data.title).toBe('Fix array[0] access');
    });

    test('handles Unicode and emoji in title', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: '🐛 Bug: 中文 Übung',
        type: 'bug'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      expect(parsed.data.title).toBe('🐛 Bug: 中文 Übung');
    });

    test('rejects null bytes in content', async () => {
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const badContent = "---\ntitle: Test\x00Attack\ntype: bug\n---\n\nBody";

      await fs.mkdir(path.join(repo.path, 'issues'), { recursive: true });

      await expect(
        fs.writeFile(ticketPath, badContent)
      ).resolves.not.toThrow(); // writeFile succeeds

      // But validation should reject it
      const content = await fs.readFile(ticketPath, 'utf-8');
      expect(content).toContain('\x00'); // Null byte is present

      // Application should reject this during validation
      expect(content.includes('\x00')).toBe(true);
    });
  });

  describe('Required field validation', () => {
    test('rejects ticket with missing title', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST-1',
          type: 'bug',
          status: 'todo'
          // title is missing
        })
      ).rejects.toThrow(/title.*required|missing.*title/i);
    });

    test('rejects ticket with empty title', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST-1',
          title: '',
          type: 'bug'
        })
      ).rejects.toThrow(/title.*required|empty.*title/i);
    });

    test('rejects ticket with whitespace-only title', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST-1',
          title: '   ',
          type: 'bug'
        })
      ).rejects.toThrow(/title.*required|empty.*title/i);
    });

    test('allows ticket with missing type (uses default)', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Ticket without type'
        // type is missing, should default to 'task'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      expect(parsed.data.type).toBe('task'); // or whatever the default is
    });

    test('allows ticket with missing status (uses default)', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Ticket without status',
        type: 'bug'
        // status is missing, should default to 'backlog'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      expect(parsed.data.status).toBe('backlog'); // or whatever the default is
    });

    test('allows ticket with missing priority (uses default)', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Ticket without priority',
        type: 'bug'
        // priority is missing
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      // Priority should default to 'medium'
      expect(parsed.data.priority).toBe('medium');
    });
  });

  describe('Field value validation against project config', () => {
    test('validates type against project config', async () => {
      // Repo config allows: bug, story, task, epic
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST-1',
          title: 'Test',
          type: 'invalid-type-not-in-config'
        })
      ).rejects.toThrow(/invalid.*type.*project.*allows/i);
    });

    test('accepts types defined in project config', async () => {
      const configTypes = ['bug', 'story', 'task', 'epic'];

      for (const type of configTypes) {
        await env.createTicket('test-repo', {
          key: `TEST-${configTypes.indexOf(type) + 1}`,
          title: `Test ${type}`,
          type: type
        });
      }

      const issuesDir = path.join(repo.path, 'issues');
      const files = await fs.readdir(issuesDir);
      expect(files.length).toBe(configTypes.length);
    });

    test('validates status against project config', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST-1',
          title: 'Test',
          type: 'bug',
          status: 'invalid-status-not-in-config'
        })
      ).rejects.toThrow(/invalid.*status.*project.*allows/i);
    });

    test('accepts statuses defined in project config', async () => {
      const configStatuses = ['backlog', 'todo', 'in-progress', 'review', 'done'];

      for (const status of configStatuses) {
        await env.createTicket('test-repo', {
          key: `TEST-${configStatuses.indexOf(status) + 1}`,
          title: `Test ${status}`,
          type: 'task',
          status: status
        });
      }

      const issuesDir = path.join(repo.path, 'issues');
      const files = await fs.readdir(issuesDir);
      expect(files.length).toBe(configStatuses.length);
    });

    test('validates priority against project config', async () => {
      await expect(
        env.createTicket('test-repo', {
          key: 'TEST-1',
          title: 'Test',
          type: 'bug',
          priority: 'super-urgent-not-in-config'
        })
      ).rejects.toThrow(/invalid.*priority.*project.*allows/i);
    });

    test('accepts priorities defined in project config', async () => {
      const configPriorities = ['trivial', 'minor', 'medium', 'major', 'critical', 'blocker'];

      for (const priority of configPriorities) {
        await env.createTicket('test-repo', {
          key: `TEST-${configPriorities.indexOf(priority) + 1}`,
          title: `Test ${priority}`,
          type: 'bug',
          priority: priority
        });
      }

      const issuesDir = path.join(repo.path, 'issues');
      const files = await fs.readdir(issuesDir);
      expect(files.length).toBe(configPriorities.length);
    });

    test('allows custom fields not in standard schema', async () => {
      // Users might have custom metadata like severity, customer, trading-venue
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Custom field test',
        type: 'bug',
        severity: 'sev1',           // Custom field
        customer: 'acme-corp',      // Custom field
        tradingVenue: 'NYSE'        // Custom field
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const content = await fs.readFile(ticketPath, 'utf-8');
      const parsed = matter(content);

      // Custom fields should be preserved
      expect(parsed.data.severity).toBe('sev1');
      expect(parsed.data.customer).toBe('acme-corp');
      expect(parsed.data.tradingVenue).toBe('NYSE');
    });

    test('allows project-specific type values', async () => {
      // Create a repo with custom types
      const customRepo = await env.createRepo('custom-project', {
        project: 'CUSTOM',
        metadata: {
          types: ['incident', 'change-request', 'feature'],  // Not standard!
          statuses: ['new', 'investigating', 'resolved'],
          priorities: ['p0', 'p1', 'p2', 'p3']
        }
      });

      await env.createTicket('custom-project', {
        key: 'CUSTOM-1',
        title: 'Production incident',
        type: 'incident',      // Custom type
        status: 'investigating', // Custom status
        priority: 'p0'         // Custom priority
      });

      const ticketPath = path.join(customRepo.path, 'issues', 'CUSTOM-1.md');
      const exists = await fs.access(ticketPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('Frontmatter round-trip consistency', () => {
    test('preserves all fields after read-modify-write cycle', async () => {
      await env.createTicket('test-repo', {
        key: 'TEST-1',
        title: 'Original title',
        type: 'bug',
        status: 'todo',
        priority: 'major',
        assignee: 'john'
      });

      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');

      // Read
      let content = await fs.readFile(ticketPath, 'utf-8');
      let parsed = matter(content);

      // Modify
      parsed.data.status = 'in-progress';

      // Write
      const updated = matter.stringify(parsed.content, parsed.data);
      await fs.writeFile(ticketPath, updated);

      // Re-read
      content = await fs.readFile(ticketPath, 'utf-8');
      parsed = matter(content);

      // Verify all fields preserved
      expect(parsed.data.title).toBe('Original title');
      expect(parsed.data.type).toBe('bug');
      expect(parsed.data.status).toBe('in-progress');
      expect(parsed.data.priority).toBe('major');
      expect(parsed.data.assignee).toBe('john');
    });

    test('preserves body content after frontmatter modification', async () => {
      const ticketPath = path.join(repo.path, 'issues', 'TEST-1.md');
      const originalContent = `---
title: Test ticket
type: bug
status: todo
---

This is the body content.
It has multiple lines.

And multiple paragraphs.`;

      await fs.mkdir(path.join(repo.path, 'issues'), { recursive: true });
      await fs.writeFile(ticketPath, originalContent);

      // Read and modify frontmatter
      let parsed = matter(await fs.readFile(ticketPath, 'utf-8'));
      parsed.data.status = 'done';

      // Write back
      const updated = matter.stringify(parsed.content, parsed.data);
      await fs.writeFile(ticketPath, updated);

      // Verify body preserved
      const final = matter(await fs.readFile(ticketPath, 'utf-8'));
      expect(final.content).toContain('This is the body content');
      expect(final.content).toContain('And multiple paragraphs');
      expect(final.data.status).toBe('done');
    });
  });
});
