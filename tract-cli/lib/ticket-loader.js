'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const WorklogCalculator = require('./worklog-calculator');

const worklogCalc = new WorklogCalculator();

const TICKET_SUBDIRS = ['tickets', 'issues'];

/**
 * Find the tickets directory within a project root.
 * Checks 'tickets/' then 'issues/' — returns null if neither exists.
 */
function findTicketsDir(projectRoot) {
  for (const sub of TICKET_SUBDIRS) {
    const candidate = path.join(projectRoot, sub);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Walk up from startDir looking for .tract/workspace.yaml
 * Returns the directory containing .tract/workspace.yaml, or null.
 */
function findWorkspace(startDir) {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (dir !== root) {
    const candidate = path.join(dir, '.tract', 'workspace.yaml');
    if (fs.existsSync(candidate)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Parse workspace.yaml and return project dirs.
 * If projectFilter is set (comma-separated prefixes), only those projects are returned.
 * Returns [{ticketsDir, prefix, name}]
 */
function loadProjectDirs(workspaceRoot, projectFilter) {
  const wsPath = path.join(workspaceRoot, '.tract', 'workspace.yaml');
  let ws;
  try {
    ws = yaml.load(fs.readFileSync(wsPath, 'utf8'));
  } catch (err) {
    console.error(`Warning: could not parse workspace.yaml: ${err.message}`);
    return [];
  }

  const projects = ws.projects || [];
  const filterPrefixes = projectFilter
    ? projectFilter.split(',').map(p => p.trim().toUpperCase())
    : null;

  return projects
    .filter(p => !filterPrefixes || filterPrefixes.includes((p.prefix || '').toUpperCase()))
    .map(p => {
      const projectRoot = p.path
        ? path.resolve(workspaceRoot, p.path)
        : path.join(workspaceRoot, p.name || p.prefix);
      const ticketsDir = findTicketsDir(projectRoot);
      return {
        ticketsDir,
        prefix: (p.prefix || '').toUpperCase(),
        name: p.name || p.prefix
      };
    })
    .filter(p => p.ticketsDir !== null);
}

/**
 * Returns the shard directory name for a ticket key: the last digit of the
 * numeric suffix (e.g. APP-123 -> "3", TB-10 -> "0"). Mirrors
 * tract-sync's ticket_writer::shard_for. Keys without a numeric suffix
 * shard to "other" (the CLI never writes there).
 */
function shardFor(key) {
  const idx = key.lastIndexOf('-');
  if (idx === -1) return 'other';
  const num = key.slice(idx + 1);
  if (num.length === 0) return 'other';
  return num[num.length - 1];
}

const SHARD_DIR_RE = /^[0-9]$/;

/**
 * List ticket files in a tickets/issues directory: flat *.md files plus one
 * level of digit-named shard directories (tickets/<0-9>/*.md). Does not
 * descend into tickets/new/ (Jira-create drafts) or other non-shard dirs.
 * Returns [{ id, path }].
 */
function listTicketFiles(ticketsDir) {
  const results = [];
  if (!fs.existsSync(ticketsDir)) return results;

  const entries = fs.readdirSync(ticketsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile()) {
      if (!entry.name.endsWith('.md')) continue;
      results.push({ id: path.basename(entry.name, '.md'), path: path.join(ticketsDir, entry.name) });
    } else if (entry.isDirectory() && SHARD_DIR_RE.test(entry.name)) {
      const shardDir = path.join(ticketsDir, entry.name);
      const shardEntries = fs.readdirSync(shardDir, { withFileTypes: true });
      for (const shardEntry of shardEntries) {
        if (!shardEntry.isFile() || !shardEntry.name.endsWith('.md')) continue;
        results.push({ id: path.basename(shardEntry.name, '.md'), path: path.join(shardDir, shardEntry.name) });
      }
    }
    // Non-digit directories (e.g. "new") are drafts/other data — skipped.
  }

  return results;
}

/**
 * Find a single ticket's file path within ticketsDir, checking flat layout,
 * then the shard its id hashes to, then scanning all shards as a fallback
 * (covers ids that were re-keyed after their file was written).
 * Returns the path, or null if not found.
 */
function findTicketFile(ticketsDir, id) {
  const flat = path.join(ticketsDir, `${id}.md`);
  if (fs.existsSync(flat)) return flat;

  const shard = shardFor(id);
  if (shard !== 'other') {
    const sharded = path.join(ticketsDir, shard, `${id}.md`);
    if (fs.existsSync(sharded)) return sharded;
  }

  if (fs.existsSync(ticketsDir)) {
    for (const entry of fs.readdirSync(ticketsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !SHARD_DIR_RE.test(entry.name)) continue;
      const candidate = path.join(ticketsDir, entry.name, `${id}.md`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

/**
 * Load tickets from a single directory (sharded and/or flat).
 * prefix is used to fill ticket.project if frontmatter doesn't have it.
 */
function loadTicketsFromDir(ticketsDir, prefix) {
  const files = listTicketFiles(ticketsDir);
  const tickets = [];

  files.forEach(({ path: filePath }) => {
    const file = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');

    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return;

    try {
      const frontmatter = yaml.load(frontmatterMatch[1]);
      const id = frontmatter.id || path.basename(file, '.md');

      const derivedPrefix = frontmatter.project ||
        prefix ||
        (id.match(/^([A-Z][A-Z0-9-]*)-\d+$/i) ? id.replace(/-\d+$/, '').toUpperCase() : null);

      const ticket = {
        id,
        title: frontmatter.title || '',
        status: frontmatter.status || 'todo',
        assignee: frontmatter.assignee || null,
        priority: frontmatter.priority || 'medium',
        labels: frontmatter.labels || [],
        sprints: frontmatter.sprints || [],
        sprint: (frontmatter.sprints && frontmatter.sprints.length) ? frontmatter.sprints[frontmatter.sprints.length - 1] : null,
        blocked_by: frontmatter.blocked_by || null,
        blocks: frontmatter.blocks || null,
        created: frontmatter.created || null,
        updated: frontmatter.updated || null,
        type: frontmatter.type || 'task',
        estimate: frontmatter.estimate || null,
        due: frontmatter.due || null,
        epic: frontmatter.epic || null,
        component: frontmatter.component || null,
        project: derivedPrefix
      };

      const timeTracking = worklogCalc.getTimeTracking(ticket);
      ticket.logged = timeTracking.logged;
      ticket.remaining = timeTracking.remaining;
      ticket.loggedSeconds = timeTracking.loggedSeconds;
      ticket.estimateSeconds = timeTracking.estimateSeconds;

      tickets.push(ticket);
    } catch (err) {
      console.error(`Error parsing ${file}:`, err.message);
    }
  });

  return tickets;
}

/**
 * Load all tickets from an array of project dirs.
 * projectDirs: [{ticketsDir, prefix, name}]
 */
function loadTickets(projectDirs) {
  const tickets = [];
  for (const { ticketsDir, prefix } of projectDirs) {
    if (fs.existsSync(ticketsDir)) {
      tickets.push(...loadTicketsFromDir(ticketsDir, prefix));
    }
  }
  return tickets;
}

module.exports = {
  findTicketsDir,
  findWorkspace,
  loadProjectDirs,
  loadTicketsFromDir,
  loadTickets,
  listTicketFiles,
  findTicketFile,
  shardFor
};
