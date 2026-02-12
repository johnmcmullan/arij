const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const axios = require('axios');

class GitToJiraSync {
  constructor(config) {
    this.jiraUrl = config.jiraUrl;
    this.jiraUsername = config.jiraUsername;
    this.jiraPassword = config.jiraPassword;
    this.repoPath = config.repoPath;
    this.issuesDir = path.join(this.repoPath, 'issues');
    
    this.jiraClient = axios.create({
      baseURL: this.jiraUrl,
      auth: {
        username: this.jiraUsername,
        password: this.jiraPassword
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  // Parse markdown file into frontmatter + body
  parseMarkdown(content) {
    // Extract YAML frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) {
      throw new Error(`Invalid markdown format`);
    }
    
    const frontmatter = yaml.load(match[1]);
    const body = match[2];
    
    // Parse comments section
    const commentsMatch = body.match(/## Comments\n\n([\s\S]*)/);
    const comments = [];
    
    if (commentsMatch) {
      const commentsText = commentsMatch[1];
      // Parse comment blocks: ### [author] - [timestamp]\n\n[body]
      const commentBlocks = commentsText.split(/\n### /);
      
      for (const block of commentBlocks) {
        if (!block.trim()) continue;
        
        const headerMatch = block.match(/^(.+?) - (.+?)\n\n([\s\S]*?)(?=\n### |\n*$)/);
        if (headerMatch) {
          comments.push({
            author: headerMatch[1],
            timestamp: headerMatch[2],
            body: headerMatch[3].trim()
          });
        }
      }
    }
    
    // Extract description (everything before ## Comments)
    const descMatch = body.match(/^([\s\S]*?)(?=\n## Comments|\n*$)/);
    const description = descMatch ? descMatch[1].trim() : '';
    
    return {
      frontmatter,
      description,
      comments
    };
  }

  // Detect changes between old and new parsed markdown
  detectChanges(oldData, newData) {
    const changes = {};
    
    // Check frontmatter changes
    const oldFM = oldData.frontmatter;
    const newFM = newData.frontmatter;
    
    if (oldFM.status !== newFM.status) {
      changes.status = newFM.status;
    }
    
    if (oldFM.assignee !== newFM.assignee) {
      changes.assignee = newFM.assignee;
    }
    
    if (oldFM.priority !== newFM.priority) {
      changes.priority = newFM.priority;
    }
    
    if (oldFM.labels?.join(',') !== newFM.labels?.join(',')) {
      changes.labels = newFM.labels;
    }
    
    if (oldFM.components?.join(',') !== newFM.components?.join(',')) {
      changes.components = newFM.components;
    }
    
    if (oldFM.fix_version !== newFM.fix_version) {
      changes.fix_version = newFM.fix_version;
    }
    
    if (oldFM.affected_version !== newFM.affected_version) {
      changes.affected_version = newFM.affected_version;
    }
    
    // Check for link changes
    const oldLinks = JSON.stringify(oldFM.links || []);
    const newLinks = JSON.stringify(newFM.links || []);
    if (oldLinks !== newLinks) {
      changes.links = newFM.links;
    }
    
    // Check for time tracking changes
    if (oldFM.estimate !== newFM.estimate) {
      changes.estimate = newFM.estimate;
    }
    
    if (oldFM.logged !== newFM.logged) {
      changes.logged = newFM.logged;
    }
    
    if (oldFM.remaining !== newFM.remaining) {
      changes.remaining = newFM.remaining;
    }
    
    if (oldData.description !== newData.description) {
      changes.description = newData.description;
    }
    
    // Check for new comments
    const newComments = newData.comments.filter(nc => {
      return !oldData.comments.some(oc => 
        oc.author === nc.author && 
        oc.timestamp === nc.timestamp &&
        oc.body === nc.body
      );
    });
    
    if (newComments.length > 0) {
      changes.newComments = newComments;
    }
    
    return changes;
  }

  // Update Jira issue with changes
  async updateJiraIssue(issueKey, changes) {
    const updates = { fields: {} };
    
    // Map Tract fields to Jira fields
    if (changes.status) {
      // Status changes require transition API
      await this.transitionIssue(issueKey, changes.status);
    }
    
    if (changes.assignee !== undefined) {
      updates.fields.assignee = changes.assignee ? { name: changes.assignee } : null;
    }
    
    if (changes.priority) {
      updates.fields.priority = { name: changes.priority };
    }
    
    if (changes.labels) {
      updates.fields.labels = changes.labels;
    }
    
    if (changes.components) {
      updates.fields.components = changes.components.map(c => ({ name: c }));
    }
    
    if (changes.fix_version !== undefined) {
      updates.fields.fixVersions = changes.fix_version 
        ? [{ name: changes.fix_version }]
        : [];
    }
    
    if (changes.affected_version !== undefined) {
      updates.fields.versions = changes.affected_version
        ? [{ name: changes.affected_version }]
        : [];
    }
    
    if (changes.description !== undefined) {
      updates.fields.description = changes.description;
    }
    
    // Time tracking fields
    if (changes.estimate !== undefined) {
      const seconds = this.parseTimeToSeconds(changes.estimate);
      updates.fields.timeestimate = seconds;
    }
    
    if (changes.remaining !== undefined) {
      const seconds = this.parseTimeToSeconds(changes.remaining);
      updates.fields.timeoriginalestimate = seconds;
    }
    
    // Update fields if any changed
    if (Object.keys(updates.fields).length > 0) {
      try {
        await this.jiraClient.put(`/rest/api/2/issue/${issueKey}`, updates);
        console.log(`✅ Updated ${issueKey} fields in Jira`);
      } catch (error) {
        console.error(`❌ Failed to update ${issueKey}:`, error.response?.data || error.message);
      }
    }
    
    // Handle issue link changes
    if (changes.links) {
      await this.updateIssueLinks(issueKey, changes.links);
    }
    
    // Handle worklog changes (logged time)
    if (changes.logged !== undefined) {
      // Note: We can't easily determine what changed in worklog, so we just add a new entry
      // Jira worklogs are immutable - can't edit existing entries easily
      // This is more of a "log additional time" operation
      console.log(`⏱️  Worklog change detected for ${issueKey}, but sync not yet implemented (worklogs are append-only)`);
    }
    
    // Add comments
    if (changes.newComments && changes.newComments.length > 0) {
      for (const comment of changes.newComments) {
        await this.addJiraComment(issueKey, comment.body, comment.author);
      }
    }
  }

  // Update issue links (add/remove)
  async updateIssueLinks(issueKey, newLinks) {
    try {
      // Get existing links from Jira
      const issueResp = await this.jiraClient.get(`/rest/api/2/issue/${issueKey}?fields=issuelinks`);
      const existingLinks = issueResp.data.fields.issuelinks || [];
      
      // Map Tract relations back to Jira link types
      const relMap = {
        'blocks': 'Blocks',
        'blocked_by': 'Blocks', // inverted
        'duplicates': 'Duplicate',
        'duplicated_by': 'Duplicate', // inverted
        'relates': 'Relates',
        'depends_on': 'Depends',
        'required_by': 'Depends', // inverted
        'causes': 'Causes',
        'caused_by': 'Causes', // inverted
        'clones': 'Cloners',
        'cloned_by': 'Cloners' // inverted
      };
      
      // Determine which links to add and remove
      const existingLinkSet = new Set(existingLinks.map(l => {
        const isOutward = !!l.outwardIssue;
        const linkedKey = isOutward ? l.outwardIssue.key : l.inwardIssue.key;
        const linkType = l.type.name;
        return `${linkType}:${linkedKey}`;
      }));
      
      const newLinkSet = new Set((newLinks || []).map(l => 
        `${relMap[l.rel] || 'Relates'}:${l.ref}`
      ));
      
      // Remove deleted links
      for (const link of existingLinks) {
        const isOutward = !!link.outwardIssue;
        const linkedKey = isOutward ? link.outwardIssue.key : link.inwardIssue.key;
        const linkType = link.type.name;
        const key = `${linkType}:${linkedKey}`;
        
        if (!newLinkSet.has(key)) {
          await this.jiraClient.delete(`/rest/api/2/issueLink/${link.id}`);
          console.log(`🔗 Removed link ${issueKey} -> ${linkedKey} (${linkType})`);
        }
      }
      
      // Add new links
      for (const link of (newLinks || [])) {
        const linkType = relMap[link.rel] || 'Relates';
        const key = `${linkType}:${link.ref}`;
        
        if (!existingLinkSet.has(key)) {
          const isInverted = ['blocked_by', 'duplicated_by', 'required_by', 'caused_by', 'cloned_by'].includes(link.rel);
          
          await this.jiraClient.post(`/rest/api/2/issueLink`, {
            type: { name: linkType },
            inwardIssue: { key: isInverted ? issueKey : link.ref },
            outwardIssue: { key: isInverted ? link.ref : issueKey }
          });
          console.log(`🔗 Added link ${issueKey} -> ${link.ref} (${link.rel})`);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to update links for ${issueKey}:`, error.response?.data || error.message);
    }
  }

  // Parse time string to seconds (e.g., "2h", "30m", "1.5d")
  parseTimeToSeconds(timeStr) {
    if (!timeStr) return null;
    
    const match = timeStr.match(/^(\d+(?:\.\d+)?)\s*([hdmw]?)$/i);
    if (!match) return null;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase() || 'h';
    
    const multipliers = {
      'm': 60,
      'h': 3600,
      'd': 28800, // 8 hour workday
      'w': 144000 // 5 day work week
    };
    
    return Math.round(value * (multipliers[unit] || 3600));
  }

  // Transition issue to new status
  async transitionIssue(issueKey, targetStatus) {
    try {
      // Get available transitions
      const transitionsResp = await this.jiraClient.get(`/rest/api/2/issue/${issueKey}/transitions`);
      const transitions = transitionsResp.data.transitions;
      
      // Find transition that leads to target status
      const transition = transitions.find(t => 
        t.to.name.toLowerCase() === targetStatus.toLowerCase()
      );
      
      if (!transition) {
        console.warn(`⚠️  No transition found to status "${targetStatus}" for ${issueKey}`);
        return;
      }
      
      // Execute transition
      await this.jiraClient.post(`/rest/api/2/issue/${issueKey}/transitions`, {
        transition: { id: transition.id }
      });
      
      console.log(`✅ Transitioned ${issueKey} to ${targetStatus}`);
    } catch (error) {
      console.error(`❌ Failed to transition ${issueKey}:`, error.response?.data || error.message);
    }
  }

  // Add comment to Jira issue
  async addJiraComment(issueKey, body, author) {
    try {
      // Add author attribution if different from sync user
      const commentBody = author !== this.jiraUsername 
        ? `[${author}]\n\n${body}`
        : body;
      
      await this.jiraClient.post(`/rest/api/2/issue/${issueKey}/comment`, {
        body: commentBody
      });
      
      console.log(`✅ Added comment to ${issueKey}`);
    } catch (error) {
      console.error(`❌ Failed to add comment to ${issueKey}:`, error.response?.data || error.message);
    }
  }

  // Process a single changed file
  async processChangedFile(filePath, oldContent, newContent) {
    const issueKey = path.basename(filePath, '.md');
    
    console.log(`\n🔄 Processing ${issueKey}...`);
    
    try {
      // Parse old and new versions
      const oldData = this.parseMarkdown(oldContent || newContent);
      const newData = this.parseMarkdown(newContent);
      
      // Detect what changed
      const changes = this.detectChanges(oldData, newData);
      
      if (Object.keys(changes).length === 0) {
        console.log(`  No changes detected`);
        return;
      }
      
      console.log(`  Detected changes:`, Object.keys(changes).join(', '));
      
      // Update Jira
      await this.updateJiraIssue(issueKey, changes);
      
    } catch (error) {
      console.error(`❌ Error processing ${issueKey}:`, error.message);
    }
  }
}

module.exports = GitToJiraSync;
