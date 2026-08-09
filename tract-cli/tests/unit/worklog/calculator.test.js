const fs = require('fs');
const path = require('path');
const os = require('os');
const WorklogCalculator = require(path.join(__dirname, '../../../lib/worklog-calculator'));

describe('WorklogCalculator', () => {
  let tempDir;
  let worklogsDir;
  let calculator;

  beforeEach(() => {
    // Create temp directory for worklogs
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tract-worklog-test-'));
    worklogsDir = path.join(tempDir, 'worklogs');
    fs.mkdirSync(worklogsDir, { recursive: true });
    calculator = new WorklogCalculator(worklogsDir);
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('parseTimeToSeconds', () => {
    it('should parse hours', () => {
      expect(calculator.parseTimeToSeconds('3h')).toBe(10800); // 3 * 3600
      expect(calculator.parseTimeToSeconds('4.5h')).toBe(16200); // 4.5 * 3600
    });

    it('should parse days', () => {
      expect(calculator.parseTimeToSeconds('1d')).toBe(28800); // 8 * 3600
      expect(calculator.parseTimeToSeconds('2d')).toBe(57600); // 16 * 3600
    });

    it('should parse weeks', () => {
      expect(calculator.parseTimeToSeconds('1w')).toBe(144000); // 40 * 3600
    });

    it('should parse minutes', () => {
      expect(calculator.parseTimeToSeconds('30m')).toBe(1800); // 30 * 60
      expect(calculator.parseTimeToSeconds('90m')).toBe(5400); // 90 * 60
    });

    it('should parse story points as hours', () => {
      expect(calculator.parseTimeToSeconds('5')).toBe(18000); // 5 * 3600
      expect(calculator.parseTimeToSeconds('8')).toBe(28800); // 8 * 3600
    });

    it('should handle null/undefined', () => {
      expect(calculator.parseTimeToSeconds(null)).toBe(0);
      expect(calculator.parseTimeToSeconds(undefined)).toBe(0);
      expect(calculator.parseTimeToSeconds('')).toBe(0);
    });
  });

  describe('formatSeconds', () => {
    it('should format hours', () => {
      expect(calculator.formatSeconds(3600)).toBe('1h');
      expect(calculator.formatSeconds(7200)).toBe('2h');
    });

    it('should format hours and minutes', () => {
      expect(calculator.formatSeconds(5400)).toBe('1h 30m');
      expect(calculator.formatSeconds(9000)).toBe('2h 30m');
    });

    it('should format days', () => {
      expect(calculator.formatSeconds(28800)).toBe('1d');
      expect(calculator.formatSeconds(57600)).toBe('2d');
    });

    it('should format days and hours', () => {
      expect(calculator.formatSeconds(32400)).toBe('1d 1h');
      expect(calculator.formatSeconds(36000)).toBe('1d 2h');
    });

    it('should format minutes only', () => {
      expect(calculator.formatSeconds(1800)).toBe('30m');
      expect(calculator.formatSeconds(2700)).toBe('45m');
    });

    it('should handle zero', () => {
      expect(calculator.formatSeconds(0)).toBe('0h');
      expect(calculator.formatSeconds(null)).toBe('0h');
    });
  });

  describe('getWorklogs', () => {
    it('should return empty array if no worklogs exist', () => {
      const worklogs = calculator.getWorklogs('PROJ-123');
      expect(worklogs).toEqual([]);
    });

    it('should retrieve worklogs for a ticket', () => {
      // Create worklog file
      const worklogFile = path.join(worklogsDir, '2026-02.jsonl');
      const entries = [
        { issue: 'PROJ-123', author: 'john', started: '2026-02-15T10:00:00Z', seconds: 3600, comment: 'Work' },
        { issue: 'PROJ-124', author: 'john', started: '2026-02-15T11:00:00Z', seconds: 1800, comment: 'Other work' },
        { issue: 'PROJ-123', author: 'jane', started: '2026-02-15T14:00:00Z', seconds: 7200, comment: 'More work' }
      ];
      fs.writeFileSync(worklogFile, entries.map(e => JSON.stringify(e)).join('\n'));

      const worklogs = calculator.getWorklogs('PROJ-123');
      expect(worklogs).toHaveLength(2);
      expect(worklogs[0].author).toBe('john');
      expect(worklogs[1].author).toBe('jane');
    });

    it('should aggregate worklogs from multiple months', () => {
      // Create worklog files for two months
      const jan = path.join(worklogsDir, '2026-01.jsonl');
      const feb = path.join(worklogsDir, '2026-02.jsonl');

      fs.writeFileSync(jan, JSON.stringify({
        issue: 'PROJ-123', author: 'john', started: '2026-01-15T10:00:00Z', seconds: 3600
      }));
      fs.writeFileSync(feb, JSON.stringify({
        issue: 'PROJ-123', author: 'john', started: '2026-02-15T10:00:00Z', seconds: 1800
      }));

      const worklogs = calculator.getWorklogs('PROJ-123');
      expect(worklogs).toHaveLength(2);
    });

    it('should sort worklogs by started time', () => {
      const worklogFile = path.join(worklogsDir, '2026-02.jsonl');
      const entries = [
        { issue: 'PROJ-123', author: 'john', started: '2026-02-15T14:00:00Z', seconds: 1800 },
        { issue: 'PROJ-123', author: 'jane', started: '2026-02-15T10:00:00Z', seconds: 3600 }
      ];
      fs.writeFileSync(worklogFile, entries.map(e => JSON.stringify(e)).join('\n'));

      const worklogs = calculator.getWorklogs('PROJ-123');
      expect(worklogs[0].started).toBe('2026-02-15T10:00:00Z');
      expect(worklogs[1].started).toBe('2026-02-15T14:00:00Z');
    });

    it('should handle malformed JSONL gracefully', () => {
      const worklogFile = path.join(worklogsDir, '2026-02.jsonl');
      fs.writeFileSync(worklogFile,
        JSON.stringify({ issue: 'PROJ-123', seconds: 3600 }) + '\n' +
        'invalid json here\n' +
        JSON.stringify({ issue: 'PROJ-123', seconds: 1800 })
      );

      const worklogs = calculator.getWorklogs('PROJ-123');
      expect(worklogs).toHaveLength(2); // Should skip malformed line
    });
  });

  describe('calculateLoggedSeconds', () => {
    it('should return 0 for ticket with no worklogs', () => {
      const logged = calculator.calculateLoggedSeconds('PROJ-999');
      expect(logged).toBe(0);
    });

    it('should sum worklogs from single author', () => {
      const worklogFile = path.join(worklogsDir, '2026-02.jsonl');
      const entries = [
        { issue: 'PROJ-123', author: 'john', started: '2026-02-15T10:00:00Z', seconds: 3600 },
        { issue: 'PROJ-123', author: 'john', started: '2026-02-15T14:00:00Z', seconds: 1800 }
      ];
      fs.writeFileSync(worklogFile, entries.map(e => JSON.stringify(e)).join('\n'));

      const logged = calculator.calculateLoggedSeconds('PROJ-123');
      expect(logged).toBe(5400); // 3600 + 1800
    });

    it('should sum worklogs from multiple authors', () => {
      const worklogFile = path.join(worklogsDir, '2026-02.jsonl');
      const entries = [
        { issue: 'PROJ-123', author: 'john', started: '2026-02-15T10:00:00Z', seconds: 3600 },
        { issue: 'PROJ-123', author: 'jane', started: '2026-02-15T14:00:00Z', seconds: 7200 }
      ];
      fs.writeFileSync(worklogFile, entries.map(e => JSON.stringify(e)).join('\n'));

      const logged = calculator.calculateLoggedSeconds('PROJ-123');
      expect(logged).toBe(10800); // 3600 + 7200
    });
  });

  describe('calculateRemaining', () => {
    beforeEach(() => {
      // Setup worklogs: 3h logged for PROJ-123
      const worklogFile = path.join(worklogsDir, '2026-02.jsonl');
      fs.writeFileSync(worklogFile, JSON.stringify({
        issue: 'PROJ-123', author: 'john', started: '2026-02-15T10:00:00Z', seconds: 10800
      }));
    });

    it('should return null if no estimate provided', () => {
      const remaining = calculator.calculateRemaining('PROJ-123', null);
      expect(remaining).toBeNull();
    });

    it('should use manual override if provided', () => {
      const remaining = calculator.calculateRemaining('PROJ-123', '8h', '2h');
      expect(remaining).toBe('2h');
    });

    it('should calculate remaining: estimate - logged', () => {
      const remaining = calculator.calculateRemaining('PROJ-123', '8h');
      expect(remaining).toBe('5h'); // 8h - 3h
    });

    it('should return 0h if logged exceeds estimate', () => {
      const remaining = calculator.calculateRemaining('PROJ-123', '2h');
      expect(remaining).toBe('0h'); // 2h - 3h = 0h (capped at 0)
    });

    it('should handle different time formats', () => {
      const remaining = calculator.calculateRemaining('PROJ-123', '1d');
      expect(remaining).toBe('5h'); // 8h - 3h
    });
  });

  describe('getTimeTracking', () => {
    beforeEach(() => {
      // Setup worklogs: 4h logged for PROJ-123
      const worklogFile = path.join(worklogsDir, '2026-02.jsonl');
      fs.writeFileSync(worklogFile, JSON.stringify({
        issue: 'PROJ-123', author: 'john', started: '2026-02-15T10:00:00Z', seconds: 14400
      }));
    });

    it('should return full time tracking summary', () => {
      const ticket = { id: 'PROJ-123', estimate: '8h' };
      const tracking = calculator.getTimeTracking(ticket);

      expect(tracking.estimate).toBe('8h');
      expect(tracking.logged).toBe('4h');
      expect(tracking.remaining).toBe('4h');
      expect(tracking.loggedSeconds).toBe(14400);
      expect(tracking.estimateSeconds).toBe(28800);
    });

    it('should handle ticket with no estimate', () => {
      const ticket = { id: 'PROJ-123', estimate: null };
      const tracking = calculator.getTimeTracking(ticket);

      expect(tracking.estimate).toBeNull();
      expect(tracking.logged).toBe('4h');
      expect(tracking.remaining).toBeNull();
      expect(tracking.loggedSeconds).toBe(14400);
      expect(tracking.estimateSeconds).toBeNull();
    });

    it('should handle ticket with manual remaining override', () => {
      const ticket = { id: 'PROJ-123', estimate: '8h', remaining: '2h' };
      const tracking = calculator.getTimeTracking(ticket);

      expect(tracking.remaining).toBe('2h'); // Uses manual override
    });

    it('should handle ticket with no worklogs', () => {
      const ticket = { id: 'PROJ-999', estimate: '8h' };
      const tracking = calculator.getTimeTracking(ticket);

      expect(tracking.logged).toBe('0h');
      expect(tracking.remaining).toBe('1d'); // 8 hours formats as 1 day
      expect(tracking.loggedSeconds).toBe(0);
    });
  });

  describe('default worklogsPath', () => {
    it('defaults to ~/.tract/worklogs when no path given', () => {
      const calc = new WorklogCalculator();
      expect(calc.worklogsPath).toBe(path.join(os.homedir(), '.tract', 'worklogs'));
    });

    it('uses explicitly provided path instead of default', () => {
      const explicit = path.join(os.tmpdir(), 'my-worklogs');
      const calc = new WorklogCalculator(explicit);
      expect(calc.worklogsPath).toBe(explicit);
    });

    it('does not have findWorklogsDir (removed in favour of fixed ~/.tract path)', () => {
      const calc = new WorklogCalculator();
      expect(calc.findWorklogsDir).toBeUndefined();
    });
  });

  describe('Multi-developer scenario', () => {
    it('should aggregate time from all developers', () => {
      const worklogFile = path.join(worklogsDir, '2026-02.jsonl');
      const entries = [
        { issue: 'PROJ-123', author: 'john', started: '2026-02-14T10:00:00Z', seconds: 7200 }, // 2h
        { issue: 'PROJ-123', author: 'jane', started: '2026-02-15T10:00:00Z', seconds: 10800 }, // 3h
        { issue: 'PROJ-123', author: 'bob', started: '2026-02-15T14:00:00Z', seconds: 3600 }  // 1h
      ];
      fs.writeFileSync(worklogFile, entries.map(e => JSON.stringify(e)).join('\n'));

      const ticket = { id: 'PROJ-123', estimate: '1d' }; // 8h
      const tracking = calculator.getTimeTracking(ticket);

      expect(tracking.logged).toBe('6h'); // 2h + 3h + 1h
      expect(tracking.remaining).toBe('2h'); // 8h - 6h
    });
  });
});
