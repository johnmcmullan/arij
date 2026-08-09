'use strict';

const UNIT_MS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
};

/**
 * Parse a "<count>/<unit>" rate limit spec, e.g. "1000/hour". Returns
 * { count, windowMs } or null if the spec is malformed.
 */
function parseRateLimit(spec) {
  if (typeof spec !== 'string') return null;
  const match = spec.trim().match(/^(\d+)\s*\/\s*(minute|hour|day)$/);
  if (!match) return null;
  const count = parseInt(match[1], 10);
  const windowMs = UNIT_MS[match[2]];
  if (!count || !windowMs) return null;
  return { count, windowMs };
}

/**
 * In-memory fixed-window rate limiter, scoped per (key, bucket). Simple by
 * design (per docs/SECURITY.md's "Simple over complex" principle) — counts
 * reset per process, so this only makes sense for a single `tract serve`
 * instance, not a load-balanced deployment. That matches the current
 * architecture (one server, no shared state).
 */
class RateLimiter {
  constructor() {
    this.windows = new Map(); // "key:bucket" -> { windowStart, count }
  }

  /**
   * Check and record a request for `key` (e.g. a user's email) against
   * `bucket` (e.g. "api", "embeddings") under the given "<count>/<unit>"
   * spec. Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
   * A null/unparseable spec means unlimited.
   */
  check(key, bucket, spec) {
    const parsed = parseRateLimit(spec);
    if (!parsed) return { allowed: true };

    const mapKey = `${key}:${bucket}`;
    const now = Date.now();
    let entry = this.windows.get(mapKey);

    if (!entry || now - entry.windowStart >= parsed.windowMs) {
      entry = { windowStart: now, count: 0 };
      this.windows.set(mapKey, entry);
    }

    if (entry.count >= parsed.count) {
      const retryAfterSeconds = Math.ceil((entry.windowStart + parsed.windowMs - now) / 1000);
      return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
    }

    entry.count += 1;
    return { allowed: true };
  }

  /** Drop all tracked state — mainly useful for tests. */
  reset() {
    this.windows.clear();
  }
}

module.exports = { RateLimiter, parseRateLimit };
