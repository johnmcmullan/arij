'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');

/**
 * Root directory for all security state (tokens/permissions/audit).
 * Matches docs/SECURITY.md's deployment convention — override with
 * TRACT_SECURITY_HOME for local dev/testing.
 */
function securityHome() {
  return process.env.TRACT_SECURITY_HOME || '/opt/tract/.tract';
}

function tokensDir() {
  return path.join(securityHome(), 'tokens');
}

/**
 * Hash a raw token for storage/lookup. Tokens are bearer secrets — storing
 * them raw on disk (even server-side) means a leaked backup or misconfigured
 * permission is a direct credential leak. Only the hash is ever persisted;
 * the raw token is shown to the user exactly once, at creation time.
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/**
 * Generate a new raw PAT for `email`.
 * Format: tract_<base64(email:randomhex)> — matches the existing Jira
 * bridge PAT pattern referenced in docs/SECURITY.md. The email is
 * recoverable from the token (base64, not encryption) purely as a
 * convenience hint; the actual secret is the random suffix.
 */
function generateRawToken(email) {
  const random = crypto.randomBytes(16).toString('hex');
  const payload = `${email}:${random}`;
  return `tract_${Buffer.from(payload, 'utf8').toString('base64')}`;
}

function tokenFilePath(hash) {
  return path.join(tokensDir(), `${hash}.yaml`);
}

/**
 * Create and persist a new token for `email`. Returns the raw token —
 * this is the only time it's ever available; only its hash is stored.
 */
function createToken({ email, name, ttlDays = 365 }) {
  if (!email) throw new Error('email is required');
  if (!name) throw new Error('name is required');

  const rawToken = generateRawToken(email);
  const hash = hashToken(rawToken);
  const now = new Date();
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);

  const record = {
    email,
    name,
    created: now.toISOString(),
    expires: expires.toISOString(),
    lastUsed: null,
  };

  fs.mkdirSync(tokensDir(), { recursive: true });
  fs.writeFileSync(tokenFilePath(hash), yaml.dump(record), 'utf8');

  return rawToken;
}

/**
 * List all stored token records (never raw tokens). Pass `email` to scope
 * to one user; omit for all tokens (callers must enforce admin-only access
 * to the unscoped form themselves).
 */
function listTokens(email = null) {
  const dir = tokensDir();
  if (!fs.existsSync(dir)) return [];

  const records = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.yaml')) continue;
    try {
      const record = yaml.load(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (!record) continue;
      if (email && record.email !== email) continue;
      records.push({ ...record, hash: path.basename(file, '.yaml') });
    } catch {
      // Skip unreadable/corrupt token files rather than failing the whole list.
    }
  }
  return records;
}

/**
 * Revoke a token by raw token string or by name (scoped to `email` — a
 * user can only revoke their own tokens through this function; callers
 * enforce any admin override themselves). Returns true if a token was
 * removed.
 */
function revokeToken(tokenOrName, email) {
  const dir = tokensDir();
  if (!fs.existsSync(dir)) return false;

  const targetHash = tokenOrName.startsWith('tract_') ? hashToken(tokenOrName) : null;

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.yaml')) continue;
    const hash = path.basename(file, '.yaml');
    if (targetHash && hash !== targetHash) continue;

    try {
      const record = yaml.load(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (!record || record.email !== email) continue;
      if (!targetHash && record.name !== tokenOrName) continue;

      fs.unlinkSync(path.join(dir, file));
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Validate a raw token from an incoming request. Returns the token record
 * ({ email, name, ... }) if valid and not expired, else null. Updates
 * lastUsed as a side effect (best-effort — a failed write doesn't fail
 * validation).
 */
function validateToken(rawToken) {
  if (!rawToken || !rawToken.startsWith('tract_')) return null;

  const hash = hashToken(rawToken);
  const filePath = tokenFilePath(hash);
  if (!fs.existsSync(filePath)) return null;

  let record;
  try {
    record = yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
  if (!record) return null;

  if (record.expires && new Date(record.expires).getTime() < Date.now()) {
    return null;
  }

  try {
    record.lastUsed = new Date().toISOString();
    fs.writeFileSync(filePath, yaml.dump(record), 'utf8');
  } catch {
    // Non-fatal — validation still succeeds even if we can't record lastUsed.
  }

  return record;
}

module.exports = {
  securityHome,
  tokensDir,
  hashToken,
  generateRawToken,
  createToken,
  listTokens,
  revokeToken,
  validateToken,
};
