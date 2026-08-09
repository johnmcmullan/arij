/**
 * Test fixtures - sample data for testing
 */

const sampleTickets = {
  bug: {
    key: 'TEST-1',
    title: 'Login button not working',
    type: 'bug',
    status: 'todo',
    priority: 'critical',
    description: 'Users cannot log in when clicking the login button.'
  },
  story: {
    key: 'TEST-2',
    title: 'Add user profile page',
    type: 'story',
    status: 'backlog',
    priority: 'medium',
    description: 'As a user, I want to view my profile so I can see my information.'
  },
  task: {
    key: 'TEST-3',
    title: 'Update dependencies',
    type: 'task',
    status: 'done',
    priority: 'minor',
    description: 'Update npm dependencies to latest versions.'
  }
};

const sampleWorklogs = {
  simple: {
    ticket: 'TEST-1',
    time: '2h',
    comment: 'Fixed the login button issue'
  },
  detailed: {
    ticket: 'TEST-2',
    time: '4h 30m',
    comment: 'Implemented user profile page with avatar upload',
    started: '2026-02-15T09:00:00Z'
  }
};

const sampleProjects = {
  simple: {
    key: 'TEST',
    name: 'Test Project',
    mode: 'local'
  },
  withJira: {
    key: 'PROD',
    name: 'Production Project',
    mode: 'jira',
    jira: {
      url: 'https://jira.example.com',
      project: 'PROD'
    }
  }
};

module.exports = {
  sampleTickets,
  sampleWorklogs,
  sampleProjects
};
