const axios = require('axios');
const path  = require('path');
const fs    = require('fs');
const os    = require('os');

// Retry configuration for 429 / 5xx responses.
const MAX_RETRIES    = 4;
const RETRY_BASE_MS  = 1000; // doubles each attempt: 1s, 2s, 4s, 8s

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Persistent rate cache: ~/.tract/jira-rates.json
// Keyed by Jira hostname so different servers have independent profiles.
// Skips load/save silently if ~/.tract/ doesn't exist yet.
function rateCachePath() {
  return path.join(os.homedir(), '.tract', 'jira-rates.json');
}

function loadRateCache() {
  try {
    return JSON.parse(fs.readFileSync(rateCachePath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveRateCache(cache) {
  try {
    const p = rateCachePath();
    if (fs.existsSync(path.dirname(p))) {
      fs.writeFileSync(p, JSON.stringify(cache, null, 2), 'utf8');
    }
  } catch {
    // Non-fatal — just skip persistence
  }
}

class JiraClient {
  constructor(baseUrl, auth) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.auth = auth;
    this.client = axios.create({
      baseURL: this.baseUrl,
      auth: this.auth,
      headers: { 'Content-Type': 'application/json' },
    });

    // Hostname key for the rate cache
    try {
      this._hostKey = new URL(this.baseUrl).hostname;
    } catch {
      this._hostKey = this.baseUrl;
    }
  }

  // ── Retry-capable request ──────────────────────────────────────────────────
  //
  // Wraps axios with exponential backoff on 429 (rate-limited) and 5xx.
  // Respects Retry-After header when present.

  async request(method, url, config = {}) {
    let attempt = 0;

    while (true) {
      try {
        return await this.client[method](url, config);
      } catch (err) {
        const status = err.response?.status;
        const isRetryable = status === 429 || (status >= 500 && status < 600);

        if (!isRetryable || attempt >= MAX_RETRIES) throw err;

        const retryAfterSec = err.response?.headers?.['retry-after'];
        const parsed = parseInt(retryAfterSec, 10);
        const waitMs = !isNaN(parsed)
          ? parsed * 1000
          : RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 200;

        attempt++;
        console.warn(`  [jira] ${status} – retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(waitMs);
      }
    }
  }

  // ── Single-page search (internal) ─────────────────────────────────────────

  async _fetchPage(jql, startAt, pageSize) {
    const response = await this.request('get', '/rest/api/2/search', {
      params: {
        jql,
        fields: '*all',
        expand: 'renderedFields',
        startAt,
        maxResults: pageSize,
      },
    });
    return response.data; // { issues, total, startAt, maxResults }
  }

  // ── RTT → concurrency mapping ──────────────────────────────────────────────
  //
  // High latency means we need more in-flight requests to keep throughput up.
  // These values are conservative enough not to hammer any Jira server.
  //
  //   < 30ms  (local / same DC)    → 3 concurrent
  //   30-80ms (same region)        → 4
  //   80-150ms (different country) → 6
  //   > 150ms (intercontinental)   → 8

  _autoConcurrency(rttMs) {
    if (rttMs > 150) return 8;
    if (rttMs >  80) return 6;
    if (rttMs >  30) return 4;
    return 3;
  }

  // ── Paginated search with parallel fetching ────────────────────────────────
  //
  // Options:
  //   concurrency {number|null}  - parallel page requests (null = auto from RTT)
  //   pageSize    {number}       - tickets per page (max 100, Jira hard limit)
  //   maxResults  {number|null}  - cap total returned (null = all)
  //   onPage      {Function}     - called with (issues, fetched, total) as each
  //                                page arrives; use this to stream-write tickets
  //
  // Algorithm:
  //   1. Probe page 0 — measures RTT, gets total count
  //   2. Auto-set concurrency if not provided (saved to ~/.tract/jira-rates.json)
  //   3. Divide remaining offsets into batches of `concurrency`
  //   4. Fetch each batch with Promise.all (pages within a batch are parallel;
  //      batches are sequential so we can call onPage in order)

  async searchIssues(jql, maxResults = null, options = {}) {
    const {
      concurrency: userConcurrency = null,
      pageSize = 100,
      onPage = null,
    } = options;

    // ── Step 1: Probe first page ─────────────────────────────────────────────
    const t0 = Date.now();
    const firstPage = await this._fetchPage(jql, 0, pageSize);
    const rttMs = Date.now() - t0;

    const total      = firstPage.total;
    const maxToFetch = maxResults ? Math.min(maxResults, total) : total;

    // ── Step 2: Determine concurrency ─────────────────────────────────────────
    let concurrency;
    if (userConcurrency) {
      concurrency = userConcurrency;
    } else {
      // Load cached value if available, otherwise compute from RTT
      const cache = loadRateCache();
      if (cache[this._hostKey]?.concurrency) {
        concurrency = cache[this._hostKey].concurrency;
      } else {
        concurrency = this._autoConcurrency(rttMs);
        // Save learned value for next run
        cache[this._hostKey] = { concurrency, rttMs, measuredAt: new Date().toISOString() };
        saveRateCache(cache);
      }
    }

    console.log(
      `  [jira] ${total} tickets · RTT ${rttMs}ms · ${concurrency}x parallel pages`
    );

    // ── Step 3: Emit page 0 ───────────────────────────────────────────────────
    const firstIssues = firstPage.issues;
    if (onPage) await onPage(firstIssues, firstIssues.length, maxToFetch);

    if (firstIssues.length >= maxToFetch) {
      return firstIssues.slice(0, maxToFetch);
    }

    // ── Step 4: Remaining pages in parallel batches ───────────────────────────
    const offsets = [];
    for (let start = pageSize; start < maxToFetch; start += pageSize) {
      offsets.push(start);
    }

    const allIssues = [...firstIssues];

    for (let i = 0; i < offsets.length; i += concurrency) {
      const batchOffsets = offsets.slice(i, i + concurrency);

      // Fetch this batch in parallel
      const pages = await Promise.all(
        batchOffsets.map(startAt => this._fetchPage(jql, startAt, pageSize))
      );

      for (const page of pages) {
        allIssues.push(...page.issues);
        if (onPage) await onPage(page.issues, allIssues.length, maxToFetch);
      }
    }

    return maxResults ? allIssues.slice(0, maxResults) : allIssues;
  }

  // ── Everything below is unchanged ─────────────────────────────────────────

  async getProject(projectKey) {
    const response = await this.request('get', `/rest/api/2/project/${projectKey}`);
    return response.data;
  }

  async getProjectComponents(projectKey) {
    const response = await this.request('get', `/rest/api/2/project/${projectKey}/components`);
    return response.data;
  }

  async getProjectStatuses(projectKey) {
    const response = await this.request('get', `/rest/api/2/project/${projectKey}/statuses`);
    return response.data;
  }

  async getIssueTypes(projectKey) {
    const project = await this.getProject(projectKey);
    return project.issueTypes || [];
  }

  async getPriorities() {
    const response = await this.request('get', '/rest/api/2/priority');
    return response.data;
  }

  async getCustomFields() {
    const response = await this.request('get', '/rest/api/2/field');
    return response.data.filter(field => field.custom);
  }

  async detectSprintField(projectKey) {
    try {
      const response = await this.request('get', '/rest/api/2/search', {
        params: { jql: `project = ${projectKey}`, maxResults: 1, fields: '*all' },
      });

      if (response.data.issues.length === 0) return null;

      const fields = response.data.issues[0].fields;

      for (const [key, value] of Object.entries(fields)) {
        if (key.toLowerCase().includes('sprint')) return key;
        if (value) {
          const valueStr = JSON.stringify(value).toLowerCase();
          if (valueStr.includes('sprint') && (valueStr.includes('state') || valueStr.includes('goal'))) {
            return key;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('Error detecting sprint field:', error.message);
      return null;
    }
  }

  async getProjectMetadata(projectKey) {
    console.log(`  Fetching project details...`);
    const project = await this.getProject(projectKey);

    console.log(`  Fetching components...`);
    const components = await this.getProjectComponents(projectKey);

    console.log(`  Fetching statuses...`);
    const statusData = await this.getProjectStatuses(projectKey);

    const statusSet = new Set();
    statusData.forEach(issueTypeStatus => {
      issueTypeStatus.statuses.forEach(status => statusSet.add(status.name));
    });

    console.log(`  Fetching priorities...`);
    const priorities = await this.getPriorities();

    console.log(`  Fetching custom fields...`);
    const customFields = await this.getCustomFields();

    return {
      project,
      components,
      statuses: Array.from(statusSet),
      issueTypes: project.issueTypes || [],
      priorities,
      customFields,
    };
  }
}

module.exports = JiraClient;
