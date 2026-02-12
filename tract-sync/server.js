#!/usr/bin/env node

const express = require('express');
const bodyParser = require('body-parser');
const GitToJiraSync = require('./lib/git-to-jira-sync');
const JiraToGitSync = require('./lib/jira-to-git-sync');
const WorklogManager = require('./lib/worklog-manager');
const TicketCreator = require('./lib/ticket-creator');

const app = express();
app.use(bodyParser.json());

// Configuration from environment
const config = {
  jiraUrl: process.env.JIRA_URL || 'https://jira.orcsoftware.com',
  jiraUsername: process.env.JIRA_USERNAME,
  jiraPassword: process.env.JIRA_PASSWORD,
  repoPath: process.env.TRACT_REPO_PATH,
  syncUser: process.env.SYNC_USER || 'tract-sync',
  syncEmail: process.env.SYNC_EMAIL || 'tract-sync@localhost',
  port: process.env.PORT || 3000,
  webhookSecret: process.env.WEBHOOK_SECRET
};

// Validate required config
if (!config.jiraUsername || !config.jiraPassword) {
  console.error('❌ JIRA_USERNAME and JIRA_PASSWORD required');
  process.exit(1);
}

if (!config.repoPath) {
  console.error('❌ TRACT_REPO_PATH required');
  process.exit(1);
}

// Initialize sync handlers
const gitToJira = new GitToJiraSync(config);
const jiraToGit = new JiraToGitSync(config);

// Initialize worklog manager
const axios = require('axios');
const jiraClient = axios.create({
  baseURL: config.jiraUrl,
  auth: {
    username: config.jiraUsername,
    password: config.jiraPassword
  },
  headers: {
    'Content-Type': 'application/json'
  }
});

const worklogManager = new WorklogManager({
  repoPath: config.repoPath,
  jiraClient: jiraClient,
  syncUser: config.syncUser,
  syncEmail: config.syncEmail
});

const ticketCreator = new TicketCreator({
  repoPath: config.repoPath,
  jiraClient: jiraClient,
  syncUser: config.syncUser,
  syncEmail: config.syncEmail
});

// Process offline queue on startup
setTimeout(async () => {
  try {
    const result = await ticketCreator.processQueue();
    if (result.processed > 0) {
      console.log(`✅ Synced ${result.processed} offline ticket(s) to Jira`);
    }
    if (result.failed > 0) {
      console.log(`⚠️  ${result.failed} ticket(s) failed to sync`);
    }
  } catch (error) {
    console.error('Queue processing error:', error.message);
  }
}, 5000); // Wait 5s after startup

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'tract-sync' });
});

// Webhook endpoint for Jira
app.post('/webhook/jira', async (req, res) => {
  try {
    // Verify webhook secret if configured
    if (config.webhookSecret) {
      const signature = req.headers['x-jira-webhook-signature'];
      if (signature !== config.webhookSecret) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
    }
    
    // Handle event
    await jiraToGit.handleWebhookEvent(req.body);
    
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook endpoint for Git (post-receive hook will POST here)
app.post('/webhook/git', async (req, res) => {
  try {
    const { changedFiles } = req.body;
    
    if (!changedFiles || changedFiles.length === 0) {
      return res.json({ status: 'ok', message: 'No changes' });
    }
    
    console.log(`\n📥 Received git webhook with ${changedFiles.length} changed files`);
    
    // Process each changed file
    for (const file of changedFiles) {
      if (!file.path.startsWith('issues/') || !file.path.endsWith('.md')) {
        continue;
      }
      
      await gitToJira.processChangedFile(
        file.path,
        file.oldContent,
        file.newContent
      );
    }
    
    res.json({ status: 'ok', processed: changedFiles.length });
  } catch (error) {
    console.error('❌ Git webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manual sync endpoint (for testing/debugging)
app.post('/sync/git-to-jira/:issueKey', async (req, res) => {
  try {
    const { issueKey } = req.params;
    const filePath = `issues/${issueKey}.md`;
    const fs = require('fs');
    const path = require('path');
    
    const fullPath = path.join(config.repoPath, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    await gitToJira.processChangedFile(filePath, content, content);
    
    res.json({ status: 'ok', synced: issueKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Worklog endpoints
app.post('/worklog/:issueKey', async (req, res) => {
  try {
    const { issueKey } = req.params;
    const { author, time, comment, started } = req.body;
    
    if (!author || !time) {
      return res.status(400).json({ error: 'author and time required' });
    }
    
    const entry = await worklogManager.addWorklog(issueKey, {
      author,
      time,
      comment,
      started
    });
    
    res.json({ status: 'ok', entry });
  } catch (error) {
    console.error('❌ Worklog error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/worklog/:issueKey', async (req, res) => {
  try {
    const { issueKey } = req.params;
    const worklogs = worklogManager.getWorklogs(issueKey);
    
    // Calculate total time
    const totalSeconds = worklogs.reduce((sum, log) => sum + log.seconds, 0);
    
    res.json({
      issue: issueKey,
      worklogs,
      total: worklogManager.formatSeconds(totalSeconds),
      totalSeconds
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/timesheet/:author', async (req, res) => {
  try {
    const { author } = req.params;
    const { date, week, month } = req.query;
    
    const entries = worklogManager.getTimesheet(author, { date, week, month });
    
    // Calculate total time
    const totalSeconds = entries.reduce((sum, e) => sum + e.seconds, 0);
    
    res.json({
      author,
      filter: { date, week, month },
      entries,
      total: worklogManager.formatSeconds(totalSeconds),
      totalSeconds
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create ticket endpoint
app.post('/create/:project', async (req, res) => {
  try {
    const { project } = req.params;
    const { title, type, priority, assignee, description, components, labels } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'title required' });
    }
    
    const result = await ticketCreator.createTicket(project.toUpperCase(), {
      title,
      type,
      priority,
      assignee,
      description,
      components,
      labels
    });
    
    res.json(result);
  } catch (error) {
    console.error('❌ Create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process offline queue manually
app.post('/sync/queue', async (req, res) => {
  try {
    const result = await ticketCreator.processQueue();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Self-update endpoint  
app.post('/update', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const fs = require('fs');
    
    console.log('\n🔄 Self-update triggered...');
    
    // Get project name from config
    const projectName = process.env.PROJECT_NAME || 'app';
    const gitRepoPath = '/opt/tract/tract';
    const workingPath = '/opt/tract/tract-sync';
    const serviceName = `tract-sync@${projectName}.service`;
    
    // Return success immediately
    res.json({ 
      status: 'updating',
      message: 'Update started, check logs in 10 seconds',
      project: projectName
    });
    
    // Run update in background (after response sent)
    setTimeout(async () => {
      try {
        console.log('📥 Pulling latest code from GitHub...');
        execSync('git fetch origin && git reset --hard origin/master', {
          cwd: gitRepoPath,
          stdio: 'inherit'
        });
        
        console.log('📦 Copying updated files...');
        execSync(`cp -v ${gitRepoPath}/tract-sync/lib/*.js ${workingPath}/lib/`, { stdio: 'inherit' });
        execSync(`cp -v ${gitRepoPath}/tract-sync/server.js ${workingPath}/`, { stdio: 'inherit' });
        
        // Check for package.json changes
        const oldPkg = fs.existsSync(`${workingPath}/package.json`) ? 
          fs.readFileSync(`${workingPath}/package.json`, 'utf8') : '';
        const newPkg = fs.readFileSync(`${gitRepoPath}/tract-sync/package.json`, 'utf8');
        
        if (oldPkg !== newPkg) {
          console.log('📦 Package dependencies changed, installing...');
          execSync(`cp ${gitRepoPath}/tract-sync/package.json ${workingPath}/`, { stdio: 'inherit' });
          execSync('npm install --production', { cwd: workingPath, stdio: 'inherit' });
        }
        
        console.log('✅ Update complete! Exiting to trigger systemd restart...');
        process.exit(0); // Systemd will restart the service automatically
        
      } catch (error) {
        console.error('❌ Update failed:', error.message);
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(config.port, () => {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Tract Sync Service Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Port:      ${config.port}
Jira:      ${config.jiraUrl}
Repo:      ${config.repoPath}
Sync User: ${config.syncUser}

Endpoints:
  GET  /health              - Health check
  POST /webhook/jira        - Jira webhook
  POST /webhook/git         - Git post-receive hook
  POST /sync/git-to-jira/:issueKey - Manual sync
  POST /worklog/:issueKey   - Add worklog entry
  GET  /worklog/:issueKey   - Get worklogs for issue
  GET  /timesheet/:author   - Get timesheet for user
  POST /create/:project     - Create new ticket (offline capable)
  POST /sync/queue          - Process offline ticket queue
  POST /update              - Self-update from GitHub (restart service)

Ready to sync! 🚀
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

// Graceful shutdown - flush pending commits
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await worklogManager.flush();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await worklogManager.flush();
  process.exit(0);
});
