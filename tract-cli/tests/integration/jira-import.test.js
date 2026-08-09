/**
 * Integration tests for the full Jira → Tract import pipeline.
 *
 * Uses nock to intercept HTTP calls so no real Jira instance is needed.
 * The fixture in tests/fixtures/jira/search-response.json matches the
 * shape of a real Jira REST API v2 /search response and covers all
 * field types the importer handles.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const nock = require('nock');

const JiraClient = require(path.join(__dirname, '../../lib/jira-client'));
const TicketImporter = require(path.join(__dirname, '../../lib/ticket-importer'));

const JIRA_BASE = 'https://jira.example.com';
const searchFixture = require('../fixtures/jira/search-response.json');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tract-jira-import-test-'));
}

function makeEnv(configOverrides = {}) {
  const tempDir = makeTempDir();
  const tractDir = path.join(tempDir, '.tract');
  const tractHome = makeTempDir();  // stands in for ~/.tract in tests
  fs.mkdirSync(tractDir, { recursive: true });

  const config = {
    prefix: 'TB',
    types: ['bug', 'story', 'task', 'epic'],
    statuses: ['todo', 'in-progress', 'done', 'closed'],
    priorities: ['critical', 'high', 'medium', 'low'],
    jira: {
      sprint_field: 'customfield_10020',
      rank_field: 'customfield_10019',
      custom_field_map: {
        customfield_10042: 'customer',
        customfield_10100: 'account_id'
      }
    },
    ...configOverrides
  };
  fs.writeFileSync(path.join(tractDir, 'config.yaml'), yaml.dump(config));
  fs.writeFileSync(path.join(tractDir, 'components.yaml'), yaml.dump({ components: {} }));

  const client = new JiraClient(JIRA_BASE, { username: 'test', password: 'test' });
  const importer = new TicketImporter(client, tempDir, tractHome);

  return { tempDir, tractDir, tractHome, client, importer };
}

// Mirrors ticket-importer.js's shardFor() / the Rust daemon's shard_for() —
// tickets live at tickets/<last-digit-of-number>/<KEY>.md, not flat.
function shardFor(key) {
  const pos = key.lastIndexOf('-');
  if (pos !== -1) {
    const num = key.slice(pos + 1);
    if (num.length > 0) return num[num.length - 1];
  }
  return 'other';
}

function readTicket(tempDir, key) {
  const filePath = path.join(tempDir, 'tickets', shardFor(key), `${key}.md`);
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  return {
    frontmatter: yaml.load(match[1]),
    body: match[2].trim()
  };
}

function readRelease(tractDir, filename) {
  return yaml.load(fs.readFileSync(path.join(tractDir, 'releases', filename), 'utf8'));
}

function readSprint(tractHome, filename) {
  return yaml.load(fs.readFileSync(path.join(tractHome, 'sprints', filename), 'utf8'));
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

let env;

beforeEach(() => {
  env = makeEnv();
  nock.cleanAll();
});

afterEach(() => {
  fs.rmSync(env.tempDir, { recursive: true, force: true });
  fs.rmSync(env.tractHome, { recursive: true, force: true });
  nock.cleanAll();
  nock.enableNetConnect();
});

// ─── Full import pipeline ─────────────────────────────────────────────────────

describe('Jira → Tract full import', () => {
  function interceptSearch(fixture = searchFixture) {
    nock(JIRA_BASE)
      .get('/rest/api/2/search')
      .query(true)
      .reply(200, fixture);
  }

  it('imports all tickets from the search response', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    expect(fs.existsSync(path.join(env.tempDir, 'tickets', shardFor('TB-042'), 'TB-042.md'))).toBe(true);
    expect(fs.existsSync(path.join(env.tempDir, 'tickets', shardFor('TB-055'), 'TB-055.md'))).toBe(true);
    expect(fs.existsSync(path.join(env.tempDir, 'tickets', shardFor('TB-060'), 'TB-060.md'))).toBe(true);
  });

  it('normalises status from Jira name to Tract slug', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    expect(readTicket(env.tempDir, 'TB-042').frontmatter.status).toBe('in-progress');
    expect(readTicket(env.tempDir, 'TB-060').frontmatter.status).toBe('done');
  });

  it('normalises priority', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    expect(readTicket(env.tempDir, 'TB-042').frontmatter.priority).toBe('critical');
  });

  it('writes fix_versions as an array', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    expect(readTicket(env.tempDir, 'TB-042').frontmatter.fix_versions).toEqual(['6.8.0']);
    // TB-055 targets two releases
    expect(readTicket(env.tempDir, 'TB-055').frontmatter.fix_versions).toEqual(['6.8.0', '6.7.3']);
  });

  it('writes affected_versions as an array', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    expect(readTicket(env.tempDir, 'TB-042').frontmatter.affected_versions).toEqual(['6.7.2']);
    // TB-055 has no affected versions
    expect(readTicket(env.tempDir, 'TB-055').frontmatter.affected_versions).toBeUndefined();
  });

  it('writes rank from configured rank_field', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    expect(readTicket(env.tempDir, 'TB-042').frontmatter.rank).toBe('0|hzzzzz:');
    expect(readTicket(env.tempDir, 'TB-055').frontmatter.rank).toBe('0|iaaaaaa:');
  });

  it('writes environment field', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    expect(readTicket(env.tempDir, 'TB-042').frontmatter.environment)
      .toBe('production - EU London (16:28-16:35 GMT window)');
  });

  it('maps custom fields via custom_field_map', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    const tb042 = readTicket(env.tempDir, 'TB-042').frontmatter;
    expect(tb042.customer).toBe('Acme Trading Ltd');
    expect(tb042.account_id).toBe('ACC-001');

    // TB-055 has null custom fields — should not appear
    const tb055 = readTicket(env.tempDir, 'TB-055').frontmatter;
    expect(tb055.customer).toBeUndefined();
  });

  it('writes reporter', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    expect(readTicket(env.tempDir, 'TB-042').frontmatter.reporter).toBe('sarah');
  });

  it('writes resolution and resolved date', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    const tb060 = readTicket(env.tempDir, 'TB-060').frontmatter;
    expect(tb060.resolution).toBe('Fixed');
    expect(tb060.resolved).toBeTruthy();

    // Unresolved ticket should have no resolution field
    expect(readTicket(env.tempDir, 'TB-042').frontmatter.resolution).toBeUndefined();
  });

  it('writes issue links with typed relationships', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    const links042 = readTicket(env.tempDir, 'TB-042').frontmatter.links;
    expect(links042).toHaveLength(1);
    expect(links042[0]).toMatchObject({ rel: 'blocks', ref: 'TB-055' });

    const links055 = readTicket(env.tempDir, 'TB-055').frontmatter.links;
    expect(links055[0]).toMatchObject({ rel: 'blocked_by', ref: 'TB-042' });
  });

  it('writes sprint history from configured sprint_field', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    expect(readTicket(env.tempDir, 'TB-042').frontmatter.sprints).toContain('sprint-7');
  });

  it('converts Jira wiki markup to Markdown in description', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    const { body } = readTicket(env.tempDir, 'TB-042');
    // h2. Summary → ## Summary
    expect(body).toMatch(/^## Summary/m);
    // h3. Steps → ### Steps
    expect(body).toMatch(/^### Steps/m);
  });

  it('writes comments section', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    const { body } = readTicket(env.tempDir, 'TB-042');
    expect(body).toMatch(/## Comments/);
    expect(body).toMatch(/dave/);
    expect(body).toMatch(/Nagle algorithm/);
  });

  it('writes time estimate in frontmatter', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    // TB-042: 28800s = 8h (importer uses simple hour conversion)
    expect(readTicket(env.tempDir, 'TB-042').frontmatter.estimate).toBe('8h');
    // TB-055: 57600s = 16h
    expect(readTicket(env.tempDir, 'TB-055').frontmatter.estimate).toBe('16h');
    // TB-060: no estimate
    expect(readTicket(env.tempDir, 'TB-060').frontmatter.estimate).toBeUndefined();
  });

  it('imports worklogs to ~/.tract/worklogs/ JSONL', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    const worklogsDir = path.join(env.tractHome, 'worklogs');
    expect(fs.existsSync(worklogsDir)).toBe(true);
    const files = fs.readdirSync(worklogsDir).filter(f => f.endsWith('.jsonl'));
    expect(files.length).toBeGreaterThan(0);

    const content = fs.readFileSync(path.join(worklogsDir, files[0]), 'utf8');
    const entry = JSON.parse(content.trim().split('\n')[0]);
    expect(entry.issue).toBe('TB-042');
    expect(entry.author).toBe('john');
    expect(entry.seconds).toBe(10800);
  });

  it('creates sprint YAML files in ~/.tract/sprints/', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    const sprint7 = readSprint(env.tractHome, 'sprint-7.yaml');
    expect(sprint7.name).toBe('Sprint 7');
    expect(sprint7.state).toBe('open');

    const sprint6 = readSprint(env.tractHome, 'sprint-6.yaml');
    expect(sprint6.state).toBe('closed');
  });

  it('creates release YAML files in .tract/releases/', async () => {
    interceptSearch();
    await env.importer.importTickets({ jql: 'project = TB', limit: 10 });

    const rel680 = readRelease(env.tractDir, '6.8.0.yaml');
    expect(rel680.name).toBe('6.8.0');
    expect(rel680.status).toBe('planned');
    expect(rel680.target_date).toBe('2026-03-15');
    expect(rel680.notes).toBe('FIX stability and OAuth release');

    expect(fs.existsSync(path.join(env.tractDir, 'releases', '6.7.3.yaml'))).toBe(true);
  });
});

// ─── Rate limiting / retry ───────────────────────────────────────────────────

describe('JiraClient retry behaviour', () => {
  it('retries once on 429 then succeeds', async () => {
    nock(JIRA_BASE)
      .get('/rest/api/2/search')
      .query(true)
      .reply(429, '', { 'retry-after': '0' });  // immediate retry for test speed

    nock(JIRA_BASE)
      .get('/rest/api/2/search')
      .query(true)
      .reply(200, { ...searchFixture, total: 0, issues: [] });

    const result = await env.client.searchIssues('project = TB', 10);
    expect(result).toEqual([]);
  });

  it('retries on 503 then succeeds', async () => {
    nock(JIRA_BASE)
      .get('/rest/api/2/search')
      .query(true)
      .reply(503, 'Service Unavailable');

    nock(JIRA_BASE)
      .get('/rest/api/2/search')
      .query(true)
      .reply(200, { ...searchFixture, total: 0, issues: [] });

    const result = await env.client.searchIssues('project = TB', 10);
    expect(result).toEqual([]);
  });

  it('throws after MAX_RETRIES exhausted', async () => {
    // Reply with 429 five times (more than MAX_RETRIES=4)
    nock(JIRA_BASE)
      .get('/rest/api/2/search')
      .query(true)
      .times(5)
      .reply(429, '', { 'retry-after': '0' });

    await expect(env.client.searchIssues('project = TB', 10)).rejects.toThrow();
  });

  it('does not retry on 4xx client errors', async () => {
    nock(JIRA_BASE)
      .get('/rest/api/2/search')
      .query(true)
      .reply(403, { errorMessages: ['You do not have permission'] });

    // Should not retry — only one interceptor registered
    await expect(env.client.searchIssues('project = TB', 10)).rejects.toThrow();
  });
});
