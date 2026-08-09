'use strict';
const fs = require('fs');
const path = require('path');

/**
 * Parse a shell env file (KEY=value lines) into a plain object.
 * Silently returns {} if the file is missing or unreadable.
 */
function parseEnvFile(filePath) {
  const vars = {};
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) vars[m[1]] = m[2].trim();
    }
  } catch (_) { /* not readable — skip */ }
  return vars;
}

/**
 * Walk up from `startDir` looking for a tract server root, then read
 * /etc/tract-sync/env or <server>/bin/env for stored credentials.
 *
 * Returns an object with:
 *   jiraUrl   — JIRA_BASE_URL (trailing slash stripped)
 *   username  — JIRA_USERNAME (may be empty string — bearer auth)
 *   token     — JIRA_API_TOKEN
 *   envFile   — path of the env file that was read (or null)
 */
function loadServerEnv(startDir) {
  const candidates = [
    '/etc/tract-sync/env',
  ];

  let dir = path.resolve(startDir || '.');
  for (let i = 0; i < 5; i++) {
    candidates.push(path.join(dir, 'bin', 'env'));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  for (const f of candidates) {
    if (fs.existsSync(f)) {
      const env = parseEnvFile(f);
      if (env.JIRA_API_TOKEN || env.JIRA_BASE_URL) {
        return {
          jiraUrl:  env.JIRA_BASE_URL ? env.JIRA_BASE_URL.replace(/\/$/, '') : null,
          username: env.JIRA_USERNAME || '',
          token:    env.JIRA_API_TOKEN || null,
          envFile:  f,
          raw:      env,
        };
      }
    }
  }
  return { jiraUrl: null, username: null, token: null, envFile: null, raw: {} };
}

module.exports = { loadServerEnv, parseEnvFile };
