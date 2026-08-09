'use strict';

const fs = require('fs');
const path = require('path');
const { securityHome } = require('./token-store');

function auditDir() {
  return path.join(securityHome(), 'audit');
}

function logFilePath(date = new Date()) {
  const day = date.toISOString().slice(0, 10); // "2026-03-16"
  return path.join(auditDir(), `${day}.jsonl`);
}

/**
 * Append one audit entry as a JSON line, per docs/SECURITY.md's format.
 * Best-effort: a server that isn't deployed to /opt/tract (e.g. a single
 * developer running `tract serve` locally, or TRACT_SECURITY_HOME pointing
 * somewhere that doesn't exist) should never have requests fail just
 * because audit logging couldn't write — this fires in "monitoring mode"
 * on every request regardless of whether auth is even enabled.
 */
function logAccess(entry) {
  // timestamp always wins over anything in `entry` — an audit log's own
  // notion of "when" must not be spoofable by whatever data is being logged.
  const record = {
    ...entry,
    timestamp: new Date().toISOString(),
  };
  try {
    fs.mkdirSync(auditDir(), { recursive: true });
    fs.appendFileSync(logFilePath(), JSON.stringify(record) + '\n', 'utf8');
  } catch {
    // Non-fatal — see comment above.
  }
}

module.exports = { auditDir, logFilePath, logAccess };
