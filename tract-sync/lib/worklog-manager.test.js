const WorklogManager = require('./worklog-manager');
const fs = require('fs').promises;

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    appendFile: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn()
  }
}));

jest.mock('simple-git', () => {
  return jest.fn(() => ({
    add: jest.fn().mockResolvedValue({}),
    commit: jest.fn().mockResolvedValue({})
  }));
});

describe('WorklogManager', () => {
  let worklogManager;
  let mockJiraClient;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockJiraClient = {
      post: jest.fn().mockResolvedValue({ data: {} })
    };

    worklogManager = new WorklogManager({
      repoPath: '/test/repo',
      jiraClient: mockJiraClient,
      syncUser: 'test-user',
      syncEmail: 'test@example.com'
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('addWorklog', () => {
    it('should add worklog to Jira', async () => {
      await worklogManager.addWorklog('APP-3350', {
        author: 'john',
        started: '2026-02-12T10:00:00Z',
        seconds: 7200,
        comment: 'Fixed bug'
      });

      expect(mockJiraClient.post).toHaveBeenCalledWith(
        '/rest/api/2/issue/APP-3350/worklog',
        expect.objectContaining({
          started: '2026-02-12T10:00:00.000+0000',
          timeSpentSeconds: 7200,
          comment: 'Fixed bug'
        })
      );
    });

    it('should append to monthly JSONL file', async () => {
      const started = new Date('2026-02-12T10:00:00Z');
      
      await worklogManager.addWorklog('APP-3350', {
        author: 'john',
        started: started.toISOString(),
        seconds: 7200,
        comment: 'Fixed bug'
      });

      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('worklogs/2026-02.jsonl'),
        expect.stringContaining('"issue":"APP-3350"')
      );
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"author":"john"')
      );
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"seconds":7200')
      );
    });

    it('should batch git commits', async () => {
      const simpleGit = require('simple-git');
      const git = simpleGit();

      await worklogManager.addWorklog('APP-3350', {
        author: 'john',
        started: '2026-02-12T10:00:00Z',
        seconds: 3600
      });

      // Should not commit immediately
      expect(git.commit).not.toHaveBeenCalled();

      // Fast-forward 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Now should commit
      await jest.runAllTimersAsync();
      expect(git.commit).toHaveBeenCalled();
    });

    it('should handle time formats correctly', async () => {
      await worklogManager.addWorklog('APP-3350', {
        author: 'john',
        started: '2026-02-12T14:30:00Z',
        seconds: 7200 // 2 hours
      });

      const appendCall = fs.appendFile.mock.calls[0][1];
      const entry = JSON.parse(appendCall);
      
      expect(entry.seconds).toBe(7200);
      expect(entry.started).toBe('2026-02-12T14:30:00.000Z');
    });
  });

  describe('getWorklogs', () => {
    it('should read and filter worklogs by issue', async () => {
      fs.readdir.mockResolvedValue(['2026-02.jsonl', '2026-01.jsonl']);
      fs.readFile.mockResolvedValue(
        '{"issue":"APP-3350","author":"john","started":"2026-02-12T10:00:00Z","seconds":7200,"comment":"Work 1"}\n' +
        '{"issue":"APP-3351","author":"sarah","started":"2026-02-12T11:00:00Z","seconds":3600,"comment":"Work 2"}\n' +
        '{"issue":"APP-3350","author":"john","started":"2026-02-12T14:00:00Z","seconds":1800,"comment":"Work 3"}\n'
      );

      const worklogs = await worklogManager.getWorklogs('APP-3350');

      expect(worklogs.length).toBe(2);
      expect(worklogs[0].comment).toBe('Work 1');
      expect(worklogs[1].comment).toBe('Work 3');
    });

    it('should return empty array for issue with no worklogs', async () => {
      fs.readdir.mockResolvedValue(['2026-02.jsonl']);
      fs.readFile.mockResolvedValue(
        '{"issue":"APP-3351","author":"sarah","started":"2026-02-12T11:00:00Z","seconds":3600}\n'
      );

      const worklogs = await worklogManager.getWorklogs('APP-3350');

      expect(worklogs).toEqual([]);
    });

    it('should handle multiple monthly files', async () => {
      fs.readdir.mockResolvedValue(['2026-02.jsonl', '2026-01.jsonl']);
      fs.readFile
        .mockResolvedValueOnce('{"issue":"APP-3350","seconds":3600}\n') // Feb
        .mockResolvedValueOnce('{"issue":"APP-3350","seconds":7200}\n'); // Jan

      const worklogs = await worklogManager.getWorklogs('APP-3350');

      expect(worklogs.length).toBe(2);
      expect(fs.readFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('getTimesheet', () => {
    beforeEach(() => {
      fs.readdir.mockResolvedValue(['2026-02.jsonl']);
    });

    it('should filter by author', async () => {
      fs.readFile.mockResolvedValue(
        '{"issue":"APP-3350","author":"john","started":"2026-02-12T10:00:00Z","seconds":7200}\n' +
        '{"issue":"APP-3351","author":"sarah","started":"2026-02-12T11:00:00Z","seconds":3600}\n' +
        '{"issue":"APP-3352","author":"john","started":"2026-02-12T14:00:00Z","seconds":1800}\n'
      );

      const timesheet = await worklogManager.getTimesheet('john');

      expect(timesheet.length).toBe(2);
      expect(timesheet.every(e => e.author === 'john')).toBe(true);
    });

    it('should filter by date', async () => {
      fs.readFile.mockResolvedValue(
        '{"issue":"APP-3350","author":"john","started":"2026-02-12T10:00:00Z","seconds":7200}\n' +
        '{"issue":"APP-3351","author":"john","started":"2026-02-13T11:00:00Z","seconds":3600}\n'
      );

      const timesheet = await worklogManager.getTimesheet('john', {
        date: '2026-02-12'
      });

      expect(timesheet.length).toBe(1);
      expect(timesheet[0].issue).toBe('APP-3350');
    });

    it('should filter by week', async () => {
      fs.readFile.mockResolvedValue(
        '{"issue":"APP-3350","author":"john","started":"2026-02-09T10:00:00Z","seconds":7200}\n' + // Monday W07
        '{"issue":"APP-3351","author":"john","started":"2026-02-12T11:00:00Z","seconds":3600}\n' + // Thursday W07
        '{"issue":"APP-3352","author":"john","started":"2026-02-16T11:00:00Z","seconds":1800}\n'  // Monday W08
      );

      const timesheet = await worklogManager.getTimesheet('john', {
        week: '2026-W07'
      });

      expect(timesheet.length).toBe(2);
    });

    it('should calculate total hours', async () => {
      fs.readFile.mockResolvedValue(
        '{"issue":"APP-3350","author":"john","started":"2026-02-12T10:00:00Z","seconds":7200}\n' +  // 2h
        '{"issue":"APP-3351","author":"john","started":"2026-02-12T14:00:00Z","seconds":5400}\n'   // 1.5h
      );

      const timesheet = await worklogManager.getTimesheet('john', {
        date: '2026-02-12'
      });

      const totalSeconds = timesheet.reduce((sum, e) => sum + e.seconds, 0);
      expect(totalSeconds).toBe(12600); // 3.5 hours
    });

    it('should group by day', async () => {
      fs.readFile.mockResolvedValue(
        '{"issue":"APP-3350","author":"john","started":"2026-02-12T10:00:00Z","seconds":7200}\n' +
        '{"issue":"APP-3351","author":"john","started":"2026-02-12T14:00:00Z","seconds":3600}\n' +
        '{"issue":"APP-3352","author":"john","started":"2026-02-13T10:00:00Z","seconds":1800}\n'
      );

      const timesheet = await worklogManager.getTimesheet('john');

      const byDay = {};
      timesheet.forEach(entry => {
        const date = entry.started.split('T')[0];
        byDay[date] = (byDay[date] || 0) + entry.seconds;
      });

      expect(byDay['2026-02-12']).toBe(10800); // 3 hours
      expect(byDay['2026-02-13']).toBe(1800);  // 0.5 hours
    });
  });

  describe('Error Handling', () => {
    it('should handle Jira API failures gracefully', async () => {
      mockJiraClient.post.mockRejectedValue(new Error('Jira unavailable'));

      await expect(
        worklogManager.addWorklog('APP-3350', {
          author: 'john',
          started: '2026-02-12T10:00:00Z',
          seconds: 7200
        })
      ).rejects.toThrow('Jira unavailable');

      // JSONL should still be written
      expect(fs.appendFile).toHaveBeenCalled();
    });

    it('should handle invalid JSONL gracefully', async () => {
      fs.readdir.mockResolvedValue(['2026-02.jsonl']);
      fs.readFile.mockResolvedValue(
        '{"issue":"APP-3350","seconds":7200}\n' +
        'invalid json line\n' +
        '{"issue":"APP-3351","seconds":3600}\n'
      );

      const worklogs = await worklogManager.getWorklogs('APP-3350');

      // Should skip invalid line and return valid entries
      expect(worklogs.length).toBe(1);
    });
  });
});
