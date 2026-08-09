'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { securityHome } = require('./token-store');
const { parseRateLimit } = require('./rate-limiter');

function permissionsPath() {
  return path.join(securityHome(), 'permissions.yaml');
}

/**
 * Load and parse permissions.yaml fresh on every call — per docs/SECURITY.md
 * ("File is reloaded automatically on each request"), so permission changes
 * take effect immediately without restarting `tract serve`. Missing file =
 * no permissions configured (everyone gets nothing beyond what admins get).
 */
function loadPermissions() {
  const filePath = permissionsPath();
  if (!fs.existsSync(filePath)) {
    return { projects: {}, admins: [] };
  }
  try {
    const parsed = yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
    return {
      projects: parsed.projects || {},
      admins: parsed.admins || [],
    };
  } catch {
    return { projects: {}, admins: [] };
  }
}

function isAdmin(email) {
  if (!email) return false;
  const { admins } = loadPermissions();
  return admins.includes(email);
}

/**
 * All teams `email` belongs to for `project` (usually zero or one, but a
 * user can legitimately be on more than one team for the same project).
 */
function getUserTeams(email, project) {
  const { projects } = loadPermissions();
  const teams = (projects[project] && projects[project].teams) || [];
  return teams.filter(t => Array.isArray(t.members) && t.members.includes(email));
}

/**
 * True if `email` has `permission` on `project` — admins always pass.
 * A user's teams are ORed together: if they're on multiple teams for the
 * same project, they get the union of what any of those teams grants.
 */
function hasPermission(email, project, permission) {
  if (isAdmin(email)) return true;
  const teams = getUserTeams(email, project);
  return teams.some(t => Array.isArray(t.permissions) && t.permissions.includes(permission));
}

/**
 * Rate limit spec string (e.g. "1000/hour") for `email` on `project` for a
 * given bucket ("api" or "embeddings"). When a user matches multiple teams,
 * the most generous (highest) limit wins — the same "broadest membership
 * wins" reasoning as hasPermission. Admins are unlimited. No matching team
 * (or no limit configured) also means unlimited — permissions, not rate
 * limits, are what gates access in that case.
 */
function getRateLimit(email, project, bucket) {
  if (isAdmin(email)) return null;
  const teams = getUserTeams(email, project);
  const specs = teams
    .map(t => t.rate_limits && t.rate_limits[bucket])
    .filter(Boolean);
  if (specs.length === 0) return null;

  let best = null;
  for (const spec of specs) {
    const parsed = parseRateLimit(spec);
    if (!parsed) continue;
    const perMs = parsed.count / parsed.windowMs;
    if (!best || perMs > best.perMs) best = { spec, perMs };
  }
  return best ? best.spec : null;
}

/**
 * Rate limit for `email` across ALL of their team memberships, for requests
 * that aren't scoped to a single project (e.g. browsing /api/tickets with
 * no ?project= filter). Same "most generous limit wins" reasoning as
 * getRateLimit, just scanning every project the user has a team in rather
 * than one. No memberships anywhere = unlimited (permissions, not rate
 * limits, gate access for a user with no team at all).
 */
function getGlobalRateLimit(email, bucket) {
  if (isAdmin(email)) return null;
  const { projects } = loadPermissions();

  const specs = [];
  for (const project of Object.keys(projects)) {
    const teams = getUserTeams(email, project);
    for (const t of teams) {
      const spec = t.rate_limits && t.rate_limits[bucket];
      if (spec) specs.push(spec);
    }
  }
  if (specs.length === 0) return null;

  let best = null;
  for (const spec of specs) {
    const parsed = parseRateLimit(spec);
    if (!parsed) continue;
    const perMs = parsed.count / parsed.windowMs;
    if (!best || perMs > best.perMs) best = { spec, perMs };
  }
  return best ? best.spec : null;
}

/**
 * Merged ticket filters for `email` on `project`. When a user matches
 * multiple teams, a ticket is only filtered out if EVERY matching team
 * would exclude it — the broadest team membership determines visibility,
 * same reasoning as hasPermission/getRateLimit.
 */
function getTicketFilters(email, project) {
  if (isAdmin(email)) return null; // admins see everything
  const teams = getUserTeams(email, project);
  if (teams.length === 0) return { excludeLabels: [], excludeComponents: [] };

  const filterSets = teams.map(t => ({
    excludeLabels: new Set((t.filters && t.filters.exclude_labels) || []),
    excludeComponents: new Set((t.filters && t.filters.exclude_components) || []),
  }));

  return {
    // Intersection: only excluded if every matching team excludes it.
    excludeLabels: [...filterSets.reduce(
      (acc, f) => new Set([...acc].filter(x => f.excludeLabels.has(x))),
      filterSets[0].excludeLabels
    )],
    excludeComponents: [...filterSets.reduce(
      (acc, f) => new Set([...acc].filter(x => f.excludeComponents.has(x))),
      filterSets[0].excludeComponents
    )],
  };
}

/**
 * Filter a ticket list down to what `email` is allowed to see, applying
 * both project-level read:tickets permission and label/component filters.
 * Admins pass through unfiltered.
 */
function filterTickets(email, tickets) {
  if (isAdmin(email)) return tickets;

  return tickets.filter(ticket => {
    const project = ticket.project;
    if (!hasPermission(email, project, 'read:tickets')) return false;

    const filters = getTicketFilters(email, project);
    if (!filters) return true;
    const labels = ticket.labels || [];
    const component = ticket.component;
    if (labels.some(l => filters.excludeLabels.includes(l))) return false;
    if (component && filters.excludeComponents.includes(component)) return false;
    return true;
  });
}

module.exports = {
  permissionsPath,
  loadPermissions,
  isAdmin,
  getUserTeams,
  hasPermission,
  getRateLimit,
  getGlobalRateLimit,
  getTicketFilters,
  filterTickets,
};
