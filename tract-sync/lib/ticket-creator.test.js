const TicketCreator = require('./ticket-creator');
const fs = require('fs').promises;
const path = require('path');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn()
  }
}));

jest.mock('simple-git', () => {
  return jest.fn(() => ({
    add: jest.fn().mockResolvedValue({}),
    commit: jest.fn().mockResolvedValue({})
  }));
});

describe('TicketCreator', () => {
  let ticketCreator;
  let mockJiraClient;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockJiraClient = {
      post: jest.fn()
    };

    ticketCreator = new TicketCreator({
      repoPath: '/test/repo',
      jiraClient: mockJiraClient,
      syncUser: 'test-user',
      syncEmail: 'test@example.com'
    });
  });

  describe('createTicket - Online Mode', () => {
    it('should create ticket in Jira and return real ID', async () => {
      mockJiraClient.post.mockResolvedValue({
        data: {
          key: 'APP-3350',
          id: '12345'
        }
      });

      const result = await ticketCreator.createTicket('APP', {
        title: 'Test ticket',
        type: 'bug',
        priority: 'high'
      });

      expect(result.status).toBe('created');
      expect(result.issueKey).toBe('APP-3350');
      expect(mockJiraClient.post).toHaveBeenCalledWith(
        '/rest/api/2/issue',
        expect.objectContaining({
          fields: expect.objectContaining({
            project: { key: 'APP' },
            summary: 'Test ticket',
            issuetype: { name: 'Bug' },
            priority: { name: 'High' }
          })
        })
      );
    });

    it('should create markdown file with proper frontmatter', async () => {
      mockJiraClient.post.mockResolvedValue({
        data: { key: 'APP-3350' }
      });

      await ticketCreator.createTicket('APP', {
        title: 'Test ticket',
        type: 'bug',
        priority: 'high',
        description: 'Test description'
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('APP-3350.md'),
        expect.stringContaining('id: APP-3350')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('title: Test ticket')
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('type: bug')
      );
    });
  });

  describe('createTicket - Offline Mode', () => {
    it('should create offline ticket when Jira is unavailable', async () => {
      mockJiraClient.post.mockRejectedValue(new Error('Network error'));

      const result = await ticketCreator.createTicket('APP', {
        title: 'Offline ticket',
        type: 'task'
      });

      expect(result.status).toBe('offline');
      expect(result.issueKey).toMatch(/^APP-TEMP-\d+$/);
      expect(result.queued).toBe(true);
    });

    it('should create queue file for offline ticket', async () => {
      mockJiraClient.post.mockRejectedValue(new Error('Network error'));

      await ticketCreator.createTicket('APP', {
        title: 'Offline ticket',
        type: 'bug',
        priority: 'critical'
      });

      // Check queue file was written
      const queueCalls = fs.writeFile.mock.calls.filter(call => 
        call[0].includes('.tract/queue/')
      );
      expect(queueCalls.length).toBe(1);
      
      const queueContent = JSON.parse(queueCalls[0][1]);
      expect(queueContent.title).toBe('Offline ticket');
      expect(queueContent.type).toBe('bug');
      expect(queueContent.priority).toBe('critical');
    });

    it('should set _offline flag in frontmatter', async () => {
      mockJiraClient.post.mockRejectedValue(new Error('Network error'));

      await ticketCreator.createTicket('APP', {
        title: 'Offline ticket'
      });

      const markdownCalls = fs.writeFile.mock.calls.filter(call =>
        call[0].includes('.md') && !call[0].includes('queue')
      );
      expect(markdownCalls[0][1]).toContain('_offline: true');
    });
  });

  describe('processQueue', () => {
    it('should sync queued tickets when Jira is available', async () => {
      // Mock queue directory with one file
      fs.readdir.mockResolvedValue(['APP-TEMP-1234567890.json']);
      fs.readFile.mockResolvedValue(JSON.stringify({
        tempId: 'APP-TEMP-1234567890',
        title: 'Queued ticket',
        type: 'bug',
        priority: 'high'
      }));

      mockJiraClient.post.mockResolvedValue({
        data: { key: 'APP-3351' }
      });

      const result = await ticketCreator.processQueue();

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockJiraClient.post).toHaveBeenCalled();
    });

    it('should rename file from temp ID to real ID', async () => {
      fs.readdir.mockResolvedValue(['APP-TEMP-1234567890.json']);
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify({
          tempId: 'APP-TEMP-1234567890',
          title: 'Queued ticket'
        }))
        .mockResolvedValueOnce('---\nid: APP-TEMP-1234567890\n---\n');

      mockJiraClient.post.mockResolvedValue({
        data: { key: 'APP-3351' }
      });

      await ticketCreator.processQueue();

      expect(fs.rename).toHaveBeenCalledWith(
        expect.stringContaining('APP-TEMP-1234567890.md'),
        expect.stringContaining('APP-3351.md')
      );
    });

    it('should remove _offline flag after sync', async () => {
      fs.readdir.mockResolvedValue(['APP-TEMP-1234567890.json']);
      fs.readFile
        .mockResolvedValueOnce(JSON.stringify({
          tempId: 'APP-TEMP-1234567890',
          title: 'Test'
        }))
        .mockResolvedValueOnce('---\nid: APP-TEMP-1234567890\n_offline: true\n---\n');

      mockJiraClient.post.mockResolvedValue({
        data: { key: 'APP-3351' }
      });

      await ticketCreator.processQueue();

      // Check that file was written without _offline flag
      const writeCalls = fs.writeFile.mock.calls.filter(call =>
        call[0].includes('APP-3351.md')
      );
      expect(writeCalls[0][1]).not.toContain('_offline: true');
    });

    it('should delete queue file after successful sync', async () => {
      fs.readdir.mockResolvedValue(['APP-TEMP-1234567890.json']);
      fs.readFile.mockResolvedValue(JSON.stringify({
        tempId: 'APP-TEMP-1234567890',
        title: 'Test'
      }));

      mockJiraClient.post.mockResolvedValue({
        data: { key: 'APP-3351' }
      });

      await ticketCreator.processQueue();

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('APP-TEMP-1234567890.json')
      );
    });

    it('should handle queue processing errors gracefully', async () => {
      fs.readdir.mockResolvedValue(['APP-TEMP-1234567890.json']);
      fs.readFile.mockResolvedValue(JSON.stringify({
        tempId: 'APP-TEMP-1234567890',
        title: 'Test'
      }));

      mockJiraClient.post.mockRejectedValue(new Error('Still offline'));

      const result = await ticketCreator.processQueue();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(fs.unlink).not.toHaveBeenCalled(); // Don't delete failed items
    });
  });

  describe('ID Generation', () => {
    it('should generate unique temp IDs', async () => {
      mockJiraClient.post.mockRejectedValue(new Error('Offline'));

      const result1 = await ticketCreator.createTicket('APP', { title: 'Test 1' });
      await new Promise(resolve => setTimeout(resolve, 10)); // Wait 10ms
      const result2 = await ticketCreator.createTicket('APP', { title: 'Test 2' });

      expect(result1.issueKey).not.toBe(result2.issueKey);
      expect(result1.issueKey).toMatch(/^APP-TEMP-\d+$/);
      expect(result2.issueKey).toMatch(/^APP-TEMP-\d+$/);
    });
  });
});
