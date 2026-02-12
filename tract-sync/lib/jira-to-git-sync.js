const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const simpleGit = require('simple-git');

class JiraToGitSync {
  constructor(config) {
    this.repoPath = config.repoPath;
    this.issuesDir = path.join(this.repoPath, 'issues');
    this.git = simpleGit(this.repoPath);
    this.syncUser = config.syncUser || 'tract-sync';
    this.syncEmail = config.syncEmail || 'tract-sync@localhost';
  }

  // Convert Jira markdown to Tract markdown
  convertJiraMarkdown(text) {
    if (!text) return '';
    
    let converted = text;
    
    // Code blocks: {code:language} ... {code} → ```language ... ```
    converted = converted.replace(/\{code:([^}]+)\}([\s\S]*?)\{code\}/g, (match, lang, code) => {
      return '```' + lang + '\n' + code.trim() + '\n```';
    });
    converted = converted.replace(/\{code\}([\s\S]*?)\{code\}/g, (match, code) => {
      return '```\n' + code.trim() + '\n```';
    });
    
    // Noformat blocks: {noformat} ... {noformat} → ``` ... ```
    converted = converted.replace(/\{noformat\}([\s\S]*?)\{noformat\}/g, (match, content) => {
      return '```\n' + content.trim() + '\n```';
    });
    
    // Headings: h1. → #, h2. → ##, etc.
    converted = converted.replace(/^h1\.\s+(.*)$/gm, '# $1');
    converted = converted.replace(/^h2\.\s+(.*)$/gm, '## $1');
    converted = converted.replace(/^h3\.\s+(.*)$/gm, '### $1');
    converted = converted.replace(/^h4\.\s+(.*)$/gm, '#### $1');
    
    // Bold/italic: *bold* → **bold**, _italic_ → *italic*
    converted = converted.replace(/\*([^*]+)\*/g, '**$1**');
    converted = converted.replace(/_([^_]+)_/g, '*$1*');
    
    // Lists: * item → - item (for consistency)
    converted = converted.replace(/^\*\s+/gm, '- ');
    
    // Line endings: normalize to Unix
    converted = converted.replace(/\r\n/g, '\n');
    converted = converted.replace(/\r/g, '\n');
    
    return converted;
  }

  // Create or update markdown file from Jira issue
  async createOrUpdateIssue(jiraIssue) {
    const issueKey = jiraIssue.key;
    const filePath = path.join(this.issuesDir, `${issueKey}.md`);
    
    console.log(`\n🔄 Syncing ${issueKey} from Jira...`);
    
    try {
      // Build frontmatter
      const frontmatter = {
        id: issueKey,
        title: jiraIssue.fields.summary,
        type: jiraIssue.fields.issuetype.name,
        status: jiraIssue.fields.status.name,
        priority: jiraIssue.fields.priority?.name || 'Medium',
        created: jiraIssue.fields.created,
        updated: jiraIssue.fields.updated,
        reporter: jiraIssue.fields.reporter?.name || 'unknown'
      };
      
      if (jiraIssue.fields.assignee) {
        frontmatter.assignee = jiraIssue.fields.assignee.name;
      }
      
      if (jiraIssue.fields.labels?.length > 0) {
        frontmatter.labels = jiraIssue.fields.labels;
      }
      
      if (jiraIssue.fields.components?.length > 0) {
        frontmatter.components = jiraIssue.fields.components.map(c => c.name);
      }
      
      if (jiraIssue.fields.fixVersions?.length > 0) {
        frontmatter.fix_version = jiraIssue.fields.fixVersions[0].name;
      }
      
      if (jiraIssue.fields.versions?.length > 0) {
        frontmatter.affected_version = jiraIssue.fields.versions[0].name;
      }
      
      if (jiraIssue.fields.resolution) {
        frontmatter.resolution = jiraIssue.fields.resolution.name;
      }
      
      // Issue links
      if (jiraIssue.fields.issuelinks?.length > 0) {
        frontmatter.links = jiraIssue.fields.issuelinks.map(link => {
          const isOutward = !!link.outwardIssue;
          const linkedIssue = isOutward ? link.outwardIssue : link.inwardIssue;
          const linkType = isOutward ? link.type.outward : link.type.inward;
          
          // Map Jira link types to Tract conventions
          const relMap = {
            'blocks': 'blocks',
            'is blocked by': 'blocked_by',
            'duplicates': 'duplicates',
            'is duplicated by': 'duplicated_by',
            'relates to': 'relates',
            'depends on': 'depends_on',
            'is depended on by': 'required_by',
            'causes': 'causes',
            'is caused by': 'caused_by',
            'clones': 'clones',
            'is cloned by': 'cloned_by'
          };
          
          const rel = relMap[linkType.toLowerCase()] || 'relates';
          
          return {
            rel: rel,
            ref: linkedIssue.key
          };
        });
      }
      
      // Watchers (count only, list requires separate API call)
      if (jiraIssue.fields.watches?.watchCount > 0) {
        // Store as comment for now since we don't have the full list
        frontmatter.watcher_count = jiraIssue.fields.watches.watchCount;
      }
      
      // Time tracking
      if (jiraIssue.fields.worklog?.worklogs?.length > 0) {
        const totalSeconds = jiraIssue.fields.worklog.worklogs.reduce((sum, log) => 
          sum + (log.timeSpentSeconds || 0), 0
        );
        frontmatter.logged = this.formatSeconds(totalSeconds);
      }
      
      if (jiraIssue.fields.timeestimate) {
        frontmatter.estimate = this.formatSeconds(jiraIssue.fields.timeestimate);
      }
      
      if (jiraIssue.fields.timeoriginalestimate) {
        frontmatter.remaining = this.formatSeconds(jiraIssue.fields.timeoriginalestimate);
      }
      
      // Build description
      const description = this.convertJiraMarkdown(jiraIssue.fields.description || '');
      
      // Build comments section
      let commentsSection = '';
      if (jiraIssue.fields.comment?.comments?.length > 0) {
        commentsSection = '\n## Comments\n\n';
        
        for (const comment of jiraIssue.fields.comment.comments) {
          const author = comment.author?.name || 'unknown';
          const timestamp = comment.created;
          const body = this.convertJiraMarkdown(comment.body);
          
          commentsSection += `### ${author} - ${timestamp}\n\n${body}\n\n`;
        }
      }
      
      // Build full markdown
      const markdown = `---
${yaml.dump(frontmatter, { lineWidth: -1 }).trim()}
---

${description}${commentsSection}`;
      
      // Write file
      fs.writeFileSync(filePath, markdown, 'utf8');
      console.log(`  ✅ Written to ${filePath}`);
      
      // Git commit
      await this.git.add(filePath);
      await this.git.commit(
        `Sync ${issueKey} from Jira\n\n[tract-sync]`,
        { '--author': `"${this.syncUser} <${this.syncEmail}>"` }
      );
      console.log(`  ✅ Committed to git`);
      
    } catch (error) {
      console.error(`❌ Error syncing ${issueKey}:`, error.message);
    }
  }

  // Format seconds to human-readable time (e.g., "2h", "30m", "1d 4h")
  formatSeconds(seconds) {
    if (!seconds || seconds === 0) return null;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours >= 8) {
      const days = Math.floor(hours / 8);
      const remainingHours = hours % 8;
      if (remainingHours > 0) {
        return `${days}d ${remainingHours}h`;
      }
      return `${days}d`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  }

  // Handle Jira webhook event
  async handleWebhookEvent(event) {
    const eventType = event.webhookEvent;
    
    console.log(`\n📥 Received webhook: ${eventType}`);
    
    // Check if this is a sync-originated event (avoid loops)
    if (this.isLoopback(event)) {
      console.log(`  ⏭️  Skipping (originated from sync)`);
      return;
    }
    
    switch (eventType) {
      case 'jira:issue_created':
      case 'jira:issue_updated':
        await this.createOrUpdateIssue(event.issue);
        break;
        
      case 'comment_created':
      case 'comment_updated':
        // Re-fetch full issue with comments and update
        const issueKey = event.issue.key;
        console.log(`  Fetching full issue ${issueKey}...`);
        // Note: This would need JiraClient to fetch full issue
        // For now, just log
        console.log(`  TODO: Re-fetch and update ${issueKey}`);
        break;
        
      default:
        console.log(`  ⏭️  Ignoring event type: ${eventType}`);
    }
  }

  // Detect if event originated from sync (to avoid loops)
  isLoopback(event) {
    // Check if comment/change was made by sync user
    if (event.user?.name === this.syncUser) {
      return true;
    }
    
    // Check for [tract-sync] marker in comments
    if (event.comment?.body?.includes('[tract-sync]')) {
      return true;
    }
    
    return false;
  }
}

module.exports = JiraToGitSync;
