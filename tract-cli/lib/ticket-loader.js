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
 * Load tickets from a single directory.
 * prefix is used to fill ticket.project if frontmatter doesn't have it.
 */
function loadTicketsFromDir(ticketsDir, prefix) {
  const files = fs.readdirSync(ticketsDir).filter(f => f.endsWith('.md'));
  const tickets = [];

  files.forEach(file => {
    const filePath = path.join(ticketsDir, file);
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

module.exports = { findTicketsDir, findWorkspace, loadProjectDirs, loadTicketsFromDir, loadTickets };
