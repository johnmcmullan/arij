const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const chalk = require('chalk');
const ora = require('ora');

/**
 * Shard directory for a ticket key — mirrors the Rust daemon's shard_for().
 * Uses the last digit of the numeric suffix: APP-33020 → "0", APP-47669 → "9".
 */
function shardFor(key) {
  const pos = key.lastIndexOf('-');
  if (pos !== -1) {
    const num = key.slice(pos + 1);
    if (num.length > 0) return num[num.length - 1];
  }
  return 'other';
}

class TicketImporter {
  constructor(jiraClient, tractDir, tractHome = path.join(os.homedir(), '.tract')) {
    this.jiraClient = jiraClient;
    this.tractDir = tractDir;
    this.tractHome = tractHome;  // ~/.tract — shared cross-project metadata
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
      status = 'all',         // changed default: 'open' broke TB/PRD (project-specific status names)
      limit = null,
      jql = null,
      resume = false,         // skip tickets that already have a .md file
      concurrency = null,     // parallel page requests (null = auto from RTT probe)
    } = options;

    console.log(chalk.bold.cyan('\n📥 Importing Jira Tickets\n'));

    // ── Build JQL ─────────────────────────────────────────────────────────────
    // Always add ORDER BY id ASC so pages are stable and resume is predictable.
    let query;
    if (jql) {
      query = jql;
      if (!query.toUpperCase().includes('ORDER BY')) query += ' ORDER BY id ASC';
    } else if (status === 'all') {
      query = `project = ${this.config.prefix} ORDER BY id ASC`;
    } else {
      // User passed an explicit status — use it as a JQL fragment.
      // For status names that contain spaces, quote them.
      const statusClause = status.includes(' ') ? `"${status}"` : status;
      query = `project = ${this.config.prefix} AND status = ${statusClause} ORDER BY id ASC`;
    }

    console.log(chalk.gray(`JQL: ${query}`));
    if (limit) console.log(chalk.gray(`Limit: ${limit}`));
    if (resume) console.log(chalk.gray(`Mode: resume (existing files will be skipped)`));
    console.log();

    // ── Prepare tickets directory ──────────────────────────────────────────────
    const ticketsDir = path.join(this.tractDir, 'tickets');
    if (!fs.existsSync(ticketsDir)) {
      fs.mkdirSync(ticketsDir, { recursive: true });
    }

    // Index existing files for O(1) lookup (needed for resume and updated count).
    // Scan both sharded subdirs (daemon format) and flat files (legacy imports).
    const existingKeys = new Set();
    for (const entry of fs.readdirSync(ticketsDir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        for (const f of fs.readdirSync(path.join(ticketsDir, entry.name))) {
          if (f.endsWith('.md')) existingKeys.add(f.slice(0, -3));
        }
      } else if (entry.name.endsWith('.md')) {
        existingKeys.add(entry.name.slice(0, -3));
      }
    }

    if (resume && existingKeys.size > 0) {
      console.log(chalk.gray(`Resuming: ${existingKeys.size} existing tickets will be skipped\n`));
    }

    // ── Streaming fetch + write ────────────────────────────────────────────────
    // We use the onPage callback to write each page as it arrives rather than
    // accumulating everything in memory. For 10,000+ tickets this matters.

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let fetched = 0;
    const t0 = Date.now();

    const allWorklogs = [];
    const allSprints  = new Map();
    const allVersions = new Map();

    await this.jiraClient.searchIssues(query, limit, {
      concurrency,
      onPage: (issues, runningTotal, total) => {
        fetched = runningTotal;

        // Live progress line (overwrites itself)
        const elapsed = (Date.now() - t0) / 1000;
        const rate    = elapsed > 0 ? fetched / elapsed : 0;
        const eta     = rate > 0 && total > fetched ? Math.round((total - fetched) / rate) : 0;
        const pct     = Math.round((fetched / total) * 100);
        const bar     = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
        process.stdout.write(
          `\r  [${bar}] ${pct}%  ${fetched}/${total}  ${Math.round(rate)}/s  ETA ${eta}s   `
        );

        for (const issue of issues) {
          const existed = existingKeys.has(issue.key);

          if (resume && existed) {
            skipped++;
            continue;
          }

          const markdown = this.convertToMarkdown(issue);
          const shardDir = path.join(ticketsDir, shardFor(issue.key));
          fs.mkdirSync(shardDir, { recursive: true });
          fs.writeFileSync(path.join(shardDir, `${issue.key}.md`), markdown, 'utf8');

          // Collect associated metadata for batch import after all pages land
          if (issue._worklogs?.length) allWorklogs.push(...issue._worklogs);
          if (issue._sprints?.length)  for (const s of issue._sprints)  allSprints.set(s.id, s);
          if (issue._versions?.length) for (const v of issue._versions) allVersions.set(v.name, v);

          existed ? updated++ : created++;
        }
      },
    });

    process.stdout.write('\n'); // end progress line

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(chalk.green(`\n✓ Fetched and wrote ${fetched} tickets in ${elapsed}s`));

    // ── Metadata import (worklogs, sprints, releases) ─────────────────────────
    if (allWorklogs.length > 0) await this.importWorklogs(allWorklogs);
    if (allSprints.size  > 0)   await this.importSprints(Array.from(allSprints.values()));
    if (allVersions.size > 0)   await this.importReleases(Array.from(allVersions.values()));

    // ── Post-import hooks ─────────────────────────────────────────────────────
    await this.runPostImportHooks(ticketsDir);

    console.log(chalk.bold.green('\n✅ Import Complete!\n'));
    console.log(chalk.gray(`  Created: ${created}`));
    console.log(chalk.gray(`  Updated: ${updated}`));
    if (skipped > 0)
      console.log(chalk.gray(`  Skipped: ${skipped} (resume)`));
    console.log(chalk.gray(`  Location: ${path.relative(process.cwd(), ticketsDir)}/\n`));

    return { created, updated, skipped, total: fetched };
  }

  async importWorklogs(worklogs) {
    const worklogSpinner = ora(`Importing ${worklogs.length} worklog entries...`).start();

    try {
      // Group worklogs by month
      const byMonth = {};
      for (const log of worklogs) {
        const date = new Date(log.started);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!byMonth[monthKey]) {
          byMonth[monthKey] = [];
        }
        byMonth[monthKey].push(log);
      }

      // Write to JSONL files in ~/.tract/worklogs/ (shared cross-project)
      const worklogsDir = path.join(this.tractHome, 'worklogs');
      if (!fs.existsSync(worklogsDir)) {
        fs.mkdirSync(worklogsDir, { recursive: true });
      }

      let totalWritten = 0;
      for (const [monthKey, logs] of Object.entries(byMonth)) {
        const filePath = path.join(worklogsDir, `${monthKey}.jsonl`);

        // Read existing entries if file exists
        let existing = [];
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          existing = content.trim().split('\n')
            .filter(line => line.length > 0)
            .map(line => JSON.parse(line));
        }

        // Add new entries (avoiding duplicates based on issue + started time)
        const existingKeys = new Set(existing.map(e => `${e.issue}-${e.started}`));
        const newEntries = logs.filter(log => !existingKeys.has(`${log.issue}-${log.started}`));

        if (newEntries.length > 0) {
          // Append to file
          const lines = newEntries.map(log => JSON.stringify(log)).join('\n');
          fs.appendFileSync(filePath, (existing.length > 0 ? '\n' : '') + lines + '\n', 'utf8');
          totalWritten += newEntries.length;
        }
      }

      worklogSpinner.succeed(chalk.green(`✓ Imported ${totalWritten} worklog entries to ~/.tract/worklogs/`));
    } catch (error) {
      worklogSpinner.fail(chalk.red(`✗ Failed to import worklogs: ${error.message}`));
    }
  }

  async importSprints(sprints) {
    const sprintSpinner = ora(`Importing ${sprints.length} sprints...`).start();

    try {
      // Create sprints directory in ~/.tract/ (shared cross-project)
      const sprintsDir = path.join(this.tractHome, 'sprints');
      if (!fs.existsSync(sprintsDir)) {
        fs.mkdirSync(sprintsDir, { recursive: true });
      }

      let newCount = 0;
      let updatedCount = 0;

      for (const sprint of sprints) {
        const filePath = path.join(sprintsDir, `${sprint.id}.yaml`);

        // Check if sprint file already exists
        if (fs.existsSync(filePath)) {
          // Read existing sprint data
          const existingContent = fs.readFileSync(filePath, 'utf8');
          const existingData = yaml.load(existingContent);

          // Only update state if it changed from open to closed
          // Don't overwrite manual edits (e.g., LLM closing sprint)
          if (existingData.state === 'open' && sprint.state === 'closed') {
            existingData.state = 'closed';
            fs.writeFileSync(filePath, yaml.dump(existingData, { lineWidth: -1 }), 'utf8');
            updatedCount++;
          }
          // Otherwise keep existing file as-is
        } else {
          // Create new sprint file
          const sprintData = {
            name: sprint.name,
            state: sprint.state,
            start: sprint.start,
            end: sprint.end,
            goal: sprint.goal
          };
          fs.writeFileSync(filePath, yaml.dump(sprintData, { lineWidth: -1 }), 'utf8');
          newCount++;
        }
      }

      const message = [];
      if (newCount > 0) message.push(`${newCount} new`);
      if (updatedCount > 0) message.push(`${updatedCount} updated`);

      sprintSpinner.succeed(chalk.green(`✓ Imported sprints: ${message.join(', ')}`));
    } catch (error) {
      sprintSpinner.fail(chalk.red(`✗ Failed to import sprints: ${error.message}`));
    }
  }

  async importReleases(versions) {
    const releaseSpinner = ora(`Importing ${versions.length} releases...`).start();

    try {
      const releasesDir = path.join(this.tractDir, '.tract', 'releases');
      if (!fs.existsSync(releasesDir)) {
        fs.mkdirSync(releasesDir, { recursive: true });
      }

      let newCount = 0;
      let updatedCount = 0;

      for (const version of versions) {
        const fileId = this.normalizeVersionName(version.name);
        const filePath = path.join(releasesDir, `${fileId}.yaml`);

        const incomingStatus = version.archived ? 'archived'
          : version.released ? 'released'
          : 'planned';

        if (fs.existsSync(filePath)) {
          const existing = yaml.load(fs.readFileSync(filePath, 'utf8'));

          // Only advance state, never downgrade — preserves manual edits
          const shouldUpdate =
            (existing.status === 'planned' && incomingStatus !== 'planned') ||
            (existing.status === 'released' && incomingStatus === 'archived');

          if (shouldUpdate) {
            existing.status = incomingStatus;
            fs.writeFileSync(filePath, yaml.dump(existing, { lineWidth: -1 }), 'utf8');
            updatedCount++;
          }
        } else {
          const releaseData = {
            name: version.name,
            status: incomingStatus,
            projects: [version.project]
          };
          if (version.startDate)   releaseData.start_date   = version.startDate;
          if (version.releaseDate) releaseData.target_date  = version.releaseDate;
          if (version.description) releaseData.notes        = version.description;

          fs.writeFileSync(filePath, yaml.dump(releaseData, { lineWidth: -1 }), 'utf8');
          newCount++;
        }
      }

      const message = [];
      if (newCount > 0) message.push(`${newCount} new`);
      if (updatedCount > 0) message.push(`${updatedCount} updated`);

      releaseSpinner.succeed(chalk.green(`✓ Imported releases: ${message.join(', ')}`));
    } catch (error) {
      releaseSpinner.fail(chalk.red(`✗ Failed to import releases: ${error.message}`));
    }
  }

  /**
   * Normalise a Jira version name to a safe filename.
   * "6.8.0" → "6.8.0", "Q1 2026" → "q1-2026"
   */
  normalizeVersionName(name) {
    if (!name) return 'unknown';
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9.\-]/g, '')
      .substring(0, 64);
  }

  async runPostImportHooks(ticketsDir) {
    const hooks = this.config.import?.hooks || ['sanitize-timestamps'];

    if (hooks.length === 0) return;

    const hookSpinner = ora('Running post-import hooks...').start();

    for (const hookName of hooks) {
      try {
        await this.runHook(hookName, ticketsDir);
      } catch (error) {
        hookSpinner.warn(chalk.yellow(`⚠ Hook '${hookName}' failed: ${error.message}`));
      }
    }

    hookSpinner.succeed(chalk.green('✓ Post-import hooks complete'));
  }

  async runHook(hookName, ticketsDir) {
    switch (hookName) {
      case 'sanitize-timestamps':
        await this.sanitizeTimestamps(ticketsDir);
        break;
      
      case 'normalize-labels':
        await this.normalizeLabels(ticketsDir);
        break;
      
      default:
        console.log(chalk.yellow(`  Unknown hook: ${hookName}`));
    }
  }

  async sanitizeTimestamps(ticketsDir) {
    const { execSync } = require('child_process');
    const files = fs.readdirSync(ticketsDir).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
      const filePath = path.join(ticketsDir, file);
      
      try {
        // Get git modified time (last commit that touched this file)
        const gitTimestamp = execSync(
          `git log -1 --format=%aI -- "${filePath}"`,
          { cwd: this.tractDir, encoding: 'utf8' }
        ).trim();
        
        if (!gitTimestamp) continue; // File not in git yet
        
        // Read ticket
        const content = fs.readFileSync(filePath, 'utf8');
        const parts = content.split('---\n');
        if (parts.length < 3) continue;
        
        const frontmatter = yaml.load(parts[1]);
        
        // Update 'updated' timestamp to match git
        frontmatter.updated = gitTimestamp;
        
        // Optionally update 'created' if it's after git time
        // (Jira import might have wrong creation date)
        if (frontmatter.created && new Date(frontmatter.created) > new Date(gitTimestamp)) {
          frontmatter.created = gitTimestamp;
        }
        
        // Rebuild file
        const newYaml = yaml.dump(frontmatter, { lineWidth: -1 });
        const newContent = `---\n${newYaml}---\n${parts.slice(2).join('---\n')}`;
        
        fs.writeFileSync(filePath, newContent, 'utf8');
      } catch (error) {
        // Skip files that error (might not be in git yet)
        continue;
      }
    }
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

    // Fix versions (target releases) — array, mirrors sprints pattern
    const versionMetadata = [];
    if (fields.fixVersions && fields.fixVersions.length > 0) {
      frontmatter.fix_versions = fields.fixVersions.map(v => v.name);
      for (const v of fields.fixVersions) {
        if (v.name) {
          versionMetadata.push({
            name: v.name,
            description: v.description || null,
            releaseDate: v.releaseDate || null,
            startDate: v.startDate || null,
            released: v.released || false,
            archived: v.archived || false,
            project: this.config.prefix
          });
        }
      }
    }
    issue._versions = versionMetadata;

    // Affected versions (where bug was found) — array, informational only
    if (fields.versions && fields.versions.length > 0) {
      frontmatter.affected_versions = fields.versions.map(v => v.name);
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

    // Issue links
    if (fields.issuelinks && fields.issuelinks.length > 0) {
      frontmatter.links = fields.issuelinks.map(link => {
        // Jira stores links as either outward or inward
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

    // Watchers
    if (fields.watches && fields.watches.watchCount > 0) {
      // Note: Jira API doesn't return watcher list by default, would need separate call
      // For now, just store the count as a comment
    }

    // Time estimate (only field stored in frontmatter - logged/remaining are calculated)
    if (fields.timeestimate) {
      const hours = Math.floor(fields.timeestimate / 3600);
      const minutes = Math.floor((fields.timeestimate % 3600) / 60);
      frontmatter.estimate = hours > 0 ? `${hours}h` : `${minutes}m`;
    }

    // Store Jira worklogs for later import into JSONL files
    // (returned separately so they can be written to .tract/worklogs/)
    const jiraWorklogs = [];
    if (fields.worklog && fields.worklog.worklogs && fields.worklog.worklogs.length > 0) {
      for (const log of fields.worklog.worklogs) {
        jiraWorklogs.push({
          issue: key,
          author: log.author?.name || log.author?.displayName || 'unknown',
          started: log.started,
          seconds: log.timeSpentSeconds || 0,
          comment: log.comment || ''
        });
      }
    }

    // Attach worklogs to issue for batch processing
    issue._worklogs = jiraWorklogs;

    // Sprint history (custom field - varies by Jira instance)
    const sprintMetadata = [];
    if (this.config.jira?.sprint_field) {
      const sprintField = fields[this.config.jira.sprint_field];

      if (sprintField) {
        // Sprint can be array or single value
        const sprints = Array.isArray(sprintField) ? sprintField : [sprintField];

        // Store all sprints as array (last one is current)
        const sprintIds = [];
        for (const sprint of sprints) {
          if (!sprint) continue;

          let sprintId, sprintData;
          if (typeof sprint === 'object' && sprint.name) {
            sprintId = this.normalizeSprintName(sprint.name);
            sprintIds.push(sprintId);

            // Extract full sprint metadata for later
            sprintData = {
              id: sprintId,
              name: sprint.name,
              state: sprint.state === 'active' ? 'open' : 'closed',
              start: sprint.startDate || null,
              end: sprint.endDate || null,
              goal: sprint.goal || null
            };
            sprintMetadata.push(sprintData);
          } else if (typeof sprint === 'string') {
            sprintId = this.normalizeSprintName(sprint);
            sprintIds.push(sprintId);
          }
        }

        if (sprintIds.length > 0) {
          frontmatter.sprints = sprintIds;
        }
      }
    }

    // Attach sprint metadata for batch processing
    issue._sprints = sprintMetadata;

    // Rank (lexorank string - preserves backlog ordering on round-trip)
    const rankField = this.config.jira?.rank_field || 'customfield_10019';
    if (fields[rankField]) {
      frontmatter.rank = fields[rankField];
    }

    // Environment (where the bug was found - native Jira field)
    if (fields.environment) {
      frontmatter.environment = this.extractText(fields.environment);
    }

    // Custom fields defined in config.jira.custom_field_map
    this.applyCustomFields(fields, frontmatter);

    // Attachments (extract Jira URLs)
    if (fields.attachment && fields.attachment.length > 0) {
      frontmatter.attachments = fields.attachment.map(att => ({
        name: att.filename,
        url: att.content // Jira API provides full URL in content field
      }));
    }

    // Description
    let description = '';
    if (fields.description) {
      description = this.sanitizeContent(this.convertJiraMarkdown(fields.description));
    }

    // Comments
    let commentsSection = '';
    if (fields.comment && fields.comment.comments && fields.comment.comments.length > 0) {
      commentsSection = '\n## Comments\n\n';
      for (const comment of fields.comment.comments) {
        const author = comment.author?.name || comment.author?.displayName || 'Unknown';
        const created = new Date(comment.created).toISOString();
        const body = this.sanitizeContent(this.convertJiraMarkdown(comment.body));
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

  normalizeSprintName(jiraSprintName) {
    if (!jiraSprintName) return null;
    
    // Option 1: Extract sprint number if present
    const numberMatch = jiraSprintName.match(/Sprint\s+(\d+)/i);
    if (numberMatch) {
      return `sprint-${numberMatch[1]}`;
    }
    
    // Option 2: Extract week number if present
    const weekMatch = jiraSprintName.match(/(?:W|Week)\s*(\d+)/i);
    if (weekMatch) {
      const year = new Date().getFullYear();
      return `${year}-W${String(weekMatch[1]).padStart(2, '0')}`;
    }
    
    // Option 3: Sanitize the name
    return jiraSprintName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 50); // Limit length
  }

  /**
   * Apply custom field mappings from config.jira.custom_field_map.
   * Mapped fields are written as readable frontmatter keys.
   * Unmapped customfield_NNNNN fields are written verbatim if
   * config.jira.custom_field_passthrough is true.
   */
  applyCustomFields(fields, frontmatter) {
    const fieldMap = this.config.jira?.custom_field_map || {};
    const passthrough = this.config.jira?.custom_field_passthrough || false;
    const mappedFields = new Set(Object.keys(fieldMap));

    // Apply explicit mappings
    for (const [jiraField, tractField] of Object.entries(fieldMap)) {
      const value = fields[jiraField];
      if (value != null && value !== '') {
        const normalized = this.normalizeCustomFieldValue(value);
        if (normalized != null) frontmatter[tractField] = normalized;
      }
    }

    // Passthrough unmapped customfield_NNNNN fields verbatim
    if (passthrough) {
      for (const [key, value] of Object.entries(fields)) {
        if (key.startsWith('customfield_') && !mappedFields.has(key) && value != null) {
          frontmatter[key] = this.normalizeCustomFieldValue(value);
        }
      }
    }
  }

  /**
   * Coerce a Jira custom field value to a plain scalar or array.
   * Jira returns custom fields as objects (user, option, version),
   * arrays of those, or plain strings/numbers.
   */
  normalizeCustomFieldValue(value) {
    if (value === null || value === undefined) return null;
    if (Array.isArray(value)) {
      return value.map(v => this.normalizeCustomFieldValue(v));
    }
    if (typeof value === 'object') {
      // User or reporter reference
      if (value.name !== undefined) return value.name;
      if (value.displayName !== undefined) return value.displayName;
      // Select list / radio button option
      if (value.value !== undefined) return value.value;
      // Fallback: JSON so nothing is silently lost
      return JSON.stringify(value);
    }
    if (typeof value === 'string') {
      // Drop Java object toString() dumps (Jira dev-status fields etc.)
      if (value.includes('com.atlassian.jira')) return null;
      // Drop raw HTML blobs injected by Jira as custom field help text
      if (value.includes('<div') || value.includes('<img') || value.includes('<span')) return null;
    }
    return value;
  }

  /**
   * Extract plain text from a field that may be a string or an
   * Atlassian Document Format (ADF) object (used in newer Jira Cloud).
   */
  extractText(field) {
    if (!field) return null;
    if (typeof field === 'string') return field;
    // ADF: { version: 1, type: 'doc', content: [...] }
    if (typeof field === 'object' && field.type === 'doc' && Array.isArray(field.content)) {
      return field.content
        .map(node => this.extractAdfText(node))
        .join('\n')
        .trim() || null;
    }
    return String(field);
  }

  extractAdfText(node) {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (Array.isArray(node.content)) {
      return node.content.map(n => this.extractAdfText(n)).join('');
    }
    return '';
  }

  convertJiraMarkdown(text) {
    if (!text) return '';

    // Normalize line endings
    let converted = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Code blocks (must come first to protect content inside them)
    converted = converted.replace(/\{code(?::([a-zA-Z]+))?\}([\s\S]*?)\{code\}/g, (match, lang, code) => {
      return '```' + (lang || '') + '\n' + code.trim() + '\n```';
    });

    // Noformat blocks
    converted = converted.replace(/\{noformat\}([\s\S]*?)\{noformat\}/g, (match, content) => {
      return '```\n' + content.trim() + '\n```';
    });

    // Inline code
    converted = converted.replace(/\{\{([^}]+)\}\}/g, '`$1`');

    // Headers
    converted = converted.replace(/^h1\.\s+/gm, '# ');
    converted = converted.replace(/^h2\.\s+/gm, '## ');
    converted = converted.replace(/^h3\.\s+/gm, '### ');
    converted = converted.replace(/^h4\.\s+/gm, '#### ');
    converted = converted.replace(/^h5\.\s+/gm, '##### ');
    converted = converted.replace(/^h6\.\s+/gm, '###### ');

    // Jira embedded images: !file.png|thumbnail! or !https://url!
    // Replace with null-byte placeholders before any inline formatting runs,
    // so hyphens in filenames can't be matched by the strikethrough pattern.
    // Placeholders are restored after all inline formatting is complete.
    const imageSlots = [];
    converted = converted.replace(/!\s*([^|!\n]+?)(?:\|[^!\n]*)?\s*!/g, (match, src) => {
      src = src.trim();
      const rendered = (src.startsWith('http://') || src.startsWith('https://'))
        ? `![](${src})`
        : `[attachment: ${src}]`;
      const idx = imageSlots.length;
      imageSlots.push(rendered);
      return `\x00IMG${idx}\x00`;
    });

    // Bold (before italic to avoid double-processing)
    converted = converted.replace(/\*([^*\n]+)\*/g, '**$1**');

    // Italic
    converted = converted.replace(/_([^_\n]+)_/g, '*$1*');

    // Strikethrough: -struck- → ~~struck~~
    converted = converted.replace(/-([^-\n]+)-/g, '~~$1~~');

    // Bullet lists: "* item" → "- item"
    converted = converted.replace(/^\*\s+/gm, '- ');

    // Links
    converted = converted.replace(/\[([^\]|]+)\|([^\]]+)\]/g, '[$1]($2)');

    // Mentions: [~username] → @username
    converted = converted.replace(/\[~([^\]]+)\]/g, '@$1');

    // Jira wiki tables → Markdown tables
    converted = this.convertJiraTables(converted);

    // Status icons → emoji
    converted = converted
      .replace(/\(\/\)/g, '✅')
      .replace(/\(x\)/g, '❌')
      .replace(/\(!\)/g, '⚠️')
      .replace(/\(i\)/g, 'ℹ️')
      .replace(/\(\?\)/g, '❓')
      .replace(/\(\+\)/g, '➕')
      .replace(/\(-\)/g, '➖')
      .replace(/\(\*\)/g, '⭐')
      .replace(/\(\*r\)/g, '🔴')
      .replace(/\(\*g\)/g, '🟢')
      .replace(/\(\*b\)/g, '🔵')
      .replace(/\(\*y\)/g, '🟡');

    // Restore image placeholders
    imageSlots.forEach((rendered, idx) => {
      converted = converted.replace(`\x00IMG${idx}\x00`, rendered);
    });

    // Trailing whitespace per line
    converted = converted.split('\n').map(l => l.trimEnd()).join('\n');

    return converted.trim();
  }

  /**
   * Convert Jira wiki tables to Markdown tables.
   * Header rows: ||col1||col2|| → | col1 | col2 |
   * Data rows:   |cell1|cell2|  → | cell1 | cell2 |
   */
  convertJiraTables(text) {
    const lines = text.split('\n');
    const out = [];
    let inTable = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('||')) {
        const cells = trimmed.split('||').filter(c => c !== '');
        out.push('| ' + cells.map(c => c.trim()).join(' | ') + ' |');
        out.push('| ' + cells.map(() => '---').join(' | ') + ' |');
        inTable = true;
        continue;
      }

      if (trimmed.startsWith('|') && !trimmed.startsWith('||')) {
        const cells = trimmed.split('|').filter(c => c !== '');
        out.push('| ' + cells.map(c => c.trim()).join(' | ') + ' |');
        inTable = true;
        continue;
      }

      if (inTable) inTable = false;
      out.push(line);
    }

    return out.join('\n');
  }

  /**
   * Strip email signatures, forwarded message blocks, confidentiality footers,
   * and HTML artefacts from converted ticket content.
   */
  sanitizeContent(text) {
    if (!text) return text;

    let s = text;

    // HTML entities and inline tags that survived Jira's parser
    s = s.replace(/&nbsp;/g, ' ')
         .replace(/&lt;/g, '<')
         .replace(/&gt;/g, '>')
         .replace(/&amp;/g, '&')
         .replace(/&quot;/g, '"')
         .replace(/&#39;/g, "'");
    s = s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?p>/gi, '\n');

    // Email signature blocks (RFC 3676 "-- " or bare "--" delimiter)
    s = this.stripEmailSignature(s);

    // Forwarded / original message chains
    s = s.replace(/\n-{4,}[ \t]*(?:Original Message|Forwarded message|Begin forwarded message).*/gi, '');

    // Legal / confidentiality footer (last paragraph heuristic)
    s = this.stripConfidentialityFooter(s);

    // Collapse 3+ blank lines to 2
    s = s.replace(/\n{3,}/g, '\n\n');

    return s.trimEnd();
  }

  stripEmailSignature(text) {
    const emailPattern = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;
    const phonePattern = /\+\d[\d\s\-()+]{5,}/;

    for (const pat of ['\n-- \n', '\n--\n']) {
      const pos = text.indexOf(pat);
      if (pos !== -1) {
        const sample = text.slice(pos + pat.length, pos + pat.length + 500);
        if (emailPattern.test(sample) || phonePattern.test(sample)) {
          return text.slice(0, pos);
        }
      }
    }
    return text;
  }

  stripConfidentialityFooter(text) {
    const lastBlank = text.lastIndexOf('\n\n');
    if (lastBlank !== -1) {
      const lastBlock = text.slice(lastBlank).toLowerCase();
      if (lastBlock.includes('confidential') || lastBlock.includes('disclaimer') || lastBlock.includes('privileged')) {
        return text.slice(0, lastBlank).trimEnd();
      }
    }
    return text;
  }

  async normalizeLabels(ticketsDir) {
    const files = fs.readdirSync(ticketsDir).filter(f => f.endsWith('.md'));
    
    // Load label mappings from config
    const labelMappings = this.config.labels?.mappings || {};
    const labelCase = this.config.labels?.case || 'lowercase';
    
    let totalNormalized = 0;
    
    for (const file of files) {
      const filePath = path.join(ticketsDir, file);
      
      try {
        // Read ticket
        const content = fs.readFileSync(filePath, 'utf8');
        const parts = content.split('---\n');
        if (parts.length < 3) continue;
        
        const frontmatter = yaml.load(parts[1]);
        
        if (!frontmatter.labels || !Array.isArray(frontmatter.labels)) {
          continue;
        }
        
        const originalLabels = [...frontmatter.labels];
        const normalizedLabels = frontmatter.labels.map(label => {
          // Apply explicit mappings first
          if (labelMappings[label]) {
            return labelMappings[label];
          }
          
          // Check case-insensitive mappings
          const lowerLabel = label.toLowerCase();
          for (const [key, value] of Object.entries(labelMappings)) {
            if (key.toLowerCase() === lowerLabel) {
              return value;
            }
          }
          
          // Apply case normalization
          switch (labelCase) {
            case 'lowercase':
              return label.toLowerCase();
            case 'uppercase':
              return label.toUpperCase();
            case 'title':
              return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
            default:
              return label;
          }
        });
        
        // Remove duplicates (case-insensitive)
        const uniqueLabels = [];
        const seen = new Set();
        for (const label of normalizedLabels) {
          const key = label.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            uniqueLabels.push(label);
          }
        }
        
        // Sort alphabetically
        uniqueLabels.sort();
        
        // Check if anything changed
        if (JSON.stringify(originalLabels) !== JSON.stringify(uniqueLabels)) {
          frontmatter.labels = uniqueLabels;
          totalNormalized++;
          
          // Rebuild file
          const newYaml = yaml.dump(frontmatter, { lineWidth: -1 });
          const newContent = `---\n${newYaml}---\n${parts.slice(2).join('---\n')}`;
          
          fs.writeFileSync(filePath, newContent, 'utf8');
        }
      } catch (error) {
        console.log(chalk.yellow(`    Warning: Could not normalize labels in ${file}: ${error.message}`));
        continue;
      }
    }
    
    if (totalNormalized > 0) {
      console.log(chalk.gray(`    Normalized labels in ${totalNormalized} tickets`));
    }
  }
}

module.exports = TicketImporter;
