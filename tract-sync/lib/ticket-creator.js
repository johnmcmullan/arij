const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const simpleGit = require('simple-git');

class TicketCreator {
  constructor(config) {
    this.repoPath = config.repoPath;
    this.issuesDir = path.join(this.repoPath, 'issues');
    this.queueDir = path.join(this.repoPath, '.tract', 'queue');
    this.git = simpleGit(this.repoPath);
    this.jiraClient = config.jiraClient;
    this.syncUser = config.syncUser || 'tract-sync';
    this.syncEmail = config.syncEmail || 'tract-sync@localhost';
    
    // Ensure queue directory exists
    if (!fs.existsSync(this.queueDir)) {
      fs.mkdirSync(this.queueDir, { recursive: true });
    }
  }

  // Create a new ticket
  async createTicket(projectKey, options) {
    const { title, type, priority, assignee, description, components, labels } = options;
    
    try {
      // Try to create in Jira first
      console.log(`📝 Creating ticket in Jira...`);
      
      const jiraIssue = {
        fields: {
          project: { key: projectKey },
          summary: title,
          issuetype: { name: type || 'Task' },
          priority: priority ? { name: priority } : undefined,
          assignee: assignee ? { name: assignee } : undefined,
          description: description || '',
          components: components ? components.map(c => ({ name: c })) : undefined,
          labels: labels || []
        }
      };
      
      // Remove undefined fields
      Object.keys(jiraIssue.fields).forEach(key => 
        jiraIssue.fields[key] === undefined && delete jiraIssue.fields[key]
      );
      
      const response = await this.jiraClient.post('/rest/api/2/issue', jiraIssue);
      const issueKey = response.data.key;
      
      console.log(`  ✅ Created ${issueKey} in Jira`);
      
      // Create markdown file
      await this.createMarkdownFile(issueKey, {
        title,
        type: type || 'task',
        priority: priority || 'medium',
        assignee,
        description,
        components,
        labels,
        status: 'open',
        created: new Date().toISOString(),
        updated: new Date().toISOString()
      });
      
      return { issueKey, status: 'created' };
      
    } catch (error) {
      console.error(`  ❌ Jira unavailable: ${error.message}`);
      
      // Create with temporary ID and queue for later
      return await this.createOffline(projectKey, options);
    }
  }

  // Create offline with temporary ID
  async createOffline(projectKey, options) {
    const { title, type, priority, assignee, description, components, labels } = options;
    
    // Generate temporary ID
    const timestamp = Date.now();
    const tempId = `${projectKey}-TEMP-${timestamp}`;
    
    console.log(`  ⏸️  Creating offline as ${tempId}`);
    
    // Create markdown file
    await this.createMarkdownFile(tempId, {
      title,
      type: type || 'task',
      priority: priority || 'medium',
      assignee,
      description,
      components,
      labels,
      status: 'open',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      _offline: true  // Mark as offline creation
    });
    
    // Queue for Jira creation
    const queueFile = path.join(this.queueDir, `${tempId}.json`);
    fs.writeFileSync(queueFile, JSON.stringify({
      tempId,
      projectKey,
      options,
      created: new Date().toISOString()
    }, null, 2));
    
    console.log(`  📋 Queued for Jira sync when online`);
    
    return { issueKey: tempId, status: 'offline', queued: true };
  }

  // Process offline queue
  async processQueue() {
    const queueFiles = fs.readdirSync(this.queueDir)
      .filter(f => f.endsWith('.json'));
    
    if (queueFiles.length === 0) {
      return { processed: 0, failed: 0 };
    }
    
    console.log(`\n🔄 Processing ${queueFiles.length} queued ticket(s)...`);
    
    let processed = 0;
    let failed = 0;
    
    for (const file of queueFiles) {
      const queuePath = path.join(this.queueDir, file);
      const queueData = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
      
      try {
        // Create in Jira
        const jiraIssue = {
          fields: {
            project: { key: queueData.projectKey },
            summary: queueData.options.title,
            issuetype: { name: queueData.options.type || 'Task' },
            priority: queueData.options.priority ? { name: queueData.options.priority } : undefined,
            assignee: queueData.options.assignee ? { name: queueData.options.assignee } : undefined,
            description: queueData.options.description || '',
            components: queueData.options.components ? queueData.options.components.map(c => ({ name: c })) : undefined,
            labels: queueData.options.labels || []
          }
        };
        
        Object.keys(jiraIssue.fields).forEach(key => 
          jiraIssue.fields[key] === undefined && delete jiraIssue.fields[key]
        );
        
        const response = await this.jiraClient.post('/rest/api/2/issue', jiraIssue);
        const realKey = response.data.key;
        
        // Rename markdown file
        const oldPath = path.join(this.issuesDir, `${queueData.tempId}.md`);
        const newPath = path.join(this.issuesDir, `${realKey}.md`);
        
        if (fs.existsSync(oldPath)) {
          // Update ID in frontmatter
          let content = fs.readFileSync(oldPath, 'utf8');
          const match = content.match(/^---\n([\s\S]*?)\n---/);
          if (match) {
            const frontmatter = yaml.load(match[1]);
            delete frontmatter._offline;
            frontmatter.id = realKey;
            
            const newFrontmatter = yaml.dump(frontmatter, { lineWidth: -1 });
            content = content.replace(/^---\n[\s\S]*?\n---/, `---\n${newFrontmatter}---`);
          }
          
          fs.writeFileSync(newPath, content);
          fs.unlinkSync(oldPath);
          
          // Git rename
          await this.git.add([newPath, oldPath]);
          await this.git.commit(
            `Sync ${queueData.tempId} → ${realKey} from offline queue\n\n[tract-sync]`,
            { '--author': `"${this.syncUser} <${this.syncEmail}>"` }
          );
        }
        
        // Remove from queue
        fs.unlinkSync(queuePath);
        
        console.log(`  ✅ ${queueData.tempId} → ${realKey}`);
        processed++;
        
      } catch (error) {
        console.error(`  ❌ Failed to sync ${queueData.tempId}: ${error.message}`);
        failed++;
      }
    }
    
    return { processed, failed };
  }

  // Create markdown file
  async createMarkdownFile(issueKey, data) {
    const frontmatter = {
      id: issueKey,
      title: data.title,
      type: data.type,
      status: data.status,
      priority: data.priority,
      created: data.created,
      updated: data.updated
    };
    
    if (data.assignee) frontmatter.assignee = data.assignee;
    if (data.components) frontmatter.components = data.components;
    if (data.labels) frontmatter.labels = data.labels;
    if (data._offline) frontmatter._offline = true;
    
    const markdown = `---
${yaml.dump(frontmatter, { lineWidth: -1 }).trim()}
---

${data.description || ''}
`;
    
    const filePath = path.join(this.issuesDir, `${issueKey}.md`);
    fs.writeFileSync(filePath, markdown, 'utf8');
    
    // Git commit
    await this.git.add(filePath);
    await this.git.commit(
      `Create ${issueKey}: ${data.title}\n\n[tract-sync]`,
      { '--author': `"${this.syncUser} <${this.syncEmail}>"` }
    );
    
    console.log(`  📄 Created ${filePath}`);
  }
}

module.exports = TicketCreator;
