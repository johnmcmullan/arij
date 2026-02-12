const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const ora = require('ora');

class TicketImporter {
  constructor(jiraClient, tractDir) {
    this.jiraClient = jiraClient;
    this.tractDir = tractDir;
    this.config = this.loadConfig();
    this.components = this.loadComponents();
  }

  loadConfig() {
    const configPath = path.join(this.tractDir, '.tract', 'config.yaml');
    return yaml.load(fs.readFileSync(configPath, 'utf8'));
  }

  loadComponents() {
    const componentsPath = path.join(this.tractDir, '.tract', 'components.yaml');
    const data = yaml.load(fs.readFileSync(componentsPath, 'utf8'));
    return data.components || {};
  }

  async importTickets(options = {}) {
    const {
      status = 'open',
      limit = null,
      jql = null
    } = options;

    console.log(chalk.bold.cyan('\n📥 Importing Jira Tickets\n'));

    // Build JQL query
    let query;
    if (jql) {
      query = jql;
    } else if (status === 'all') {
      query = `project = ${this.config.prefix}`;
    } else {
      query = `project = ${this.config.prefix} AND status = "${status}"`;
    }

    if (limit) {
      console.log(chalk.gray(`Query: ${query}`));
      console.log(chalk.gray(`Limit: ${limit} tickets\n`));
    } else {
      console.log(chalk.gray(`Query: ${query}\n`));
    }

    // Fetch tickets from Jira
    const spinner = ora('Fetching tickets from Jira...').start();
    const issues = await this.jiraClient.searchIssues(query, limit);
    spinner.succeed(chalk.green(`✓ Fetched ${issues.length} tickets`));

    // Create issues directory
    const issuesDir = path.join(this.tractDir, 'issues');
    if (!fs.existsSync(issuesDir)) {
      fs.mkdirSync(issuesDir, { recursive: true });
    }

    // Convert and write tickets
    const writeSpinner = ora('Converting tickets to markdown...').start();
    let created = 0;
    let updated = 0;

    for (const issue of issues) {
      const ticketPath = path.join(issuesDir, `${issue.key}.md`);
      const existed = fs.existsSync(ticketPath);
      
      const markdown = this.convertToMarkdown(issue);
      fs.writeFileSync(ticketPath, markdown, 'utf8');
      
      if (existed) {
        updated++;
      } else {
        created++;
      }
    }

    writeSpinner.succeed(chalk.green(`✓ Converted ${issues.length} tickets to markdown`));

    console.log(chalk.bold.green('\n✅ Import Complete!\n'));
    console.log(chalk.gray(`  Created: ${created} tickets`));
    console.log(chalk.gray(`  Updated: ${updated} tickets`));
    console.log(chalk.gray(`  Location: ${path.relative(process.cwd(), issuesDir)}/\n`));

    return { created, updated, total: issues.length };
  }

  convertToMarkdown(issue) {
    // Extract fields
    const fields = issue.fields;
    const key = issue.key;
    
    // Build frontmatter
    const frontmatter = {
      id: key,
      title: fields.summary || '',
      type: this.normalizeType(fields.issuetype?.name),
      status: this.normalizeStatus(fields.status?.name),
      priority: this.normalizePriority(fields.priority?.name),
      created: fields.created || new Date().toISOString(),
      updated: fields.updated || new Date().toISOString(),
    };

    // Add optional fields
    if (fields.assignee) {
      frontmatter.assignee = fields.assignee.name || fields.assignee.displayName;
    }

    if (fields.reporter) {
      frontmatter.reporter = fields.reporter.name || fields.reporter.displayName;
    }

    if (fields.components && fields.components.length > 0) {
      frontmatter.components = fields.components.map(c => c.name);
    }

    if (fields.labels && fields.labels.length > 0) {
      frontmatter.labels = fields.labels;
    }

    // Fix versions (target release)
    if (fields.fixVersions && fields.fixVersions.length > 0) {
      frontmatter.fix_version = fields.fixVersions[0].name;
    }

    // Affected versions (where bug was found)
    if (fields.versions && fields.versions.length > 0) {
      frontmatter.affected_version = fields.versions[0].name;
    }

    if (fields.resolution) {
      frontmatter.resolution = fields.resolution.name;
    }

    if (fields.resolutiondate) {
      frontmatter.resolved = fields.resolutiondate;
    }

    // Parent link for subtasks
    if (fields.parent) {
      frontmatter.parent = fields.parent.key;
    }

    // Description
    let description = '';
    if (fields.description) {
      description = this.convertJiraMarkdown(fields.description);
    }

    // Comments
    let commentsSection = '';
    if (fields.comment && fields.comment.comments && fields.comment.comments.length > 0) {
      commentsSection = '\n## Comments\n\n';
      for (const comment of fields.comment.comments) {
        const author = comment.author?.name || comment.author?.displayName || 'Unknown';
        const created = new Date(comment.created).toISOString();
        const body = this.convertJiraMarkdown(comment.body);
        commentsSection += `### ${author} - ${created}\n\n${body}\n\n`;
      }
    }

    // Build markdown file
    const yamlFrontmatter = yaml.dump(frontmatter, { lineWidth: -1 });
    return `---\n${yamlFrontmatter}---\n\n${description}${commentsSection}`;
  }

  normalizeType(typeName) {
    if (!typeName) return 'task';
    const normalized = typeName.toLowerCase().replace(/\s+/g, '-');
    // Check if it's in our config
    if (this.config.types.includes(normalized)) {
      return normalized;
    }
    // Try to find close match
    for (const type of this.config.types) {
      if (type.includes(normalized) || normalized.includes(type)) {
        return type;
      }
    }
    return 'task'; // default
  }

  normalizeStatus(statusName) {
    if (!statusName) return 'open';
    const normalized = statusName.toLowerCase().replace(/\s+/g, '-');
    if (this.config.statuses.includes(normalized)) {
      return normalized;
    }
    // Try to find close match
    for (const status of this.config.statuses) {
      if (status.includes(normalized) || normalized.includes(status)) {
        return status;
      }
    }
    return 'open'; // default
  }

  normalizePriority(priorityName) {
    if (!priorityName) return 'medium';
    const normalized = priorityName.toLowerCase().replace(/\s+/g, '-');
    if (this.config.priorities.includes(normalized)) {
      return normalized;
    }
    return 'medium'; // default
  }

  convertJiraMarkdown(text) {
    if (!text) return '';
    
    // First, normalize line endings (remove \r)
    let converted = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Headers
    converted = converted.replace(/^h1\.\s+/gm, '# ');
    converted = converted.replace(/^h2\.\s+/gm, '## ');
    converted = converted.replace(/^h3\.\s+/gm, '### ');
    converted = converted.replace(/^h4\.\s+/gm, '#### ');
    converted = converted.replace(/^h5\.\s+/gm, '##### ');
    converted = converted.replace(/^h6\.\s+/gm, '###### ');
    
    // Bold and italic
    converted = converted.replace(/\*([^*]+)\*/g, '**$1**'); // bold
    converted = converted.replace(/_([^_]+)_/g, '*$1*'); // italic
    
    // Code blocks
    converted = converted.replace(/\{code(?::([a-z]+))?\}([\s\S]*?)\{code\}/g, (match, lang, code) => {
      return '```' + (lang || '') + '\n' + code.trim() + '\n```';
    });
    
    // Noformat blocks (same as code blocks but no language)
    converted = converted.replace(/\{noformat\}([\s\S]*?)\{noformat\}/g, (match, content) => {
      return '```\n' + content.trim() + '\n```';
    });
    
    // Inline code
    converted = converted.replace(/\{\{([^}]+)\}\}/g, '`$1`');
    
    // Lists - Jira uses * for bullets, # for numbered
    // These should already work in markdown
    
    // Links
    converted = converted.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '[$1]($2)');
    
    return converted.trim();
  }
}

module.exports = TicketImporter;
