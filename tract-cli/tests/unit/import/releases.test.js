const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const TicketImporter = require(path.join(__dirname, '../../../lib/ticket-importer'));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tract-releases-test-'));
}

function makeImporter(configOverrides = {}) {
  const tempDir = makeTempDir();
  const tractDir = path.join(tempDir, '.tract');
  fs.mkdirSync(tractDir, { recursive: true });

  const config = {
    prefix: 'TEST',
    types: ['bug', 'task'],
    statuses: ['todo', 'done'],
    priorities: ['medium'],
    ...configOverrides
  };
  fs.writeFileSync(path.join(tractDir, 'config.yaml'), yaml.dump(config));
  fs.writeFileSync(path.join(tractDir, 'components.yaml'), yaml.dump({ components: {} }));

  const importer = new TicketImporter(null, tempDir);
  importer._tempDir = tempDir;
  importer._releasesDir = path.join(tractDir, 'releases');
  return importer;
}

function makeIssue(fieldOverrides = {}) {
  return {
    key: 'TEST-1',
    fields: {
      summary: 'Test issue',
      issuetype: { name: 'Bug' },
      status: { name: 'Todo' },
      priority: { name: 'Medium' },
      created: '2026-02-01T10:00:00.000Z',
      updated: '2026-02-10T10:00:00.000Z',
      ...fieldOverrides
    }
  };
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error('No frontmatter found');
  return yaml.load(match[1]);
}

function readRelease(importer, filename) {
  return yaml.load(fs.readFileSync(path.join(importer._releasesDir, filename), 'utf8'));
}

// ─── fix_versions on ticket ───────────────────────────────────────────────────

describe('fix_versions field on ticket', () => {
  let importer;
  afterEach(() => fs.rmSync(importer._tempDir, { recursive: true, force: true }));

  it('writes fix_versions as an array', () => {
    importer = makeImporter();
    const issue = makeIssue({
      fixVersions: [{ name: '6.8.0', released: false }]
    });
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.fix_versions).toEqual(['6.8.0']);
  });

  it('captures multiple fix versions', () => {
    importer = makeImporter();
    const issue = makeIssue({
      fixVersions: [
        { name: '6.8.0', released: false },
        { name: '6.7.1', released: true }  // backport
      ]
    });
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.fix_versions).toEqual(['6.8.0', '6.7.1']);
  });

  it('omits fix_versions when field is absent', () => {
    importer = makeImporter();
    const issue = makeIssue();
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.fix_versions).toBeUndefined();
  });

  it('writes affected_versions as an array', () => {
    importer = makeImporter();
    const issue = makeIssue({
      versions: [{ name: '6.7.2' }, { name: '6.7.1' }]
    });
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.affected_versions).toEqual(['6.7.2', '6.7.1']);
  });

  it('omits affected_versions when field is absent', () => {
    importer = makeImporter();
    const issue = makeIssue();
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.affected_versions).toBeUndefined();
  });

  it('no longer writes singular fix_version field', () => {
    importer = makeImporter();
    const issue = makeIssue({ fixVersions: [{ name: '6.8.0' }] });
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.fix_version).toBeUndefined();
  });

  it('no longer writes singular affected_version field', () => {
    importer = makeImporter();
    const issue = makeIssue({ versions: [{ name: '6.7.2' }] });
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.affected_version).toBeUndefined();
  });

  it('collects _versions metadata on the issue object', () => {
    importer = makeImporter();
    const issue = makeIssue({
      fixVersions: [{
        name: '6.8.0',
        description: 'Stability release',
        releaseDate: '2026-03-15',
        startDate: '2026-02-01',
        released: false,
        archived: false
      }]
    });
    importer.convertToMarkdown(issue);
    expect(issue._versions).toHaveLength(1);
    expect(issue._versions[0]).toMatchObject({
      name: '6.8.0',
      description: 'Stability release',
      releaseDate: '2026-03-15',
      startDate: '2026-02-01',
      released: false,
      archived: false,
      project: 'TEST'
    });
  });
});

// ─── normalizeVersionName ─────────────────────────────────────────────────────

describe('normalizeVersionName()', () => {
  let importer;
  beforeEach(() => { importer = makeImporter(); });
  afterEach(() => fs.rmSync(importer._tempDir, { recursive: true, force: true }));

  it('keeps semantic version as-is', () => {
    expect(importer.normalizeVersionName('6.8.0')).toBe('6.8.0');
  });

  it('lowercases and hyphenates spaces', () => {
    expect(importer.normalizeVersionName('Q1 2026')).toBe('q1-2026');
  });

  it('strips special characters', () => {
    expect(importer.normalizeVersionName('v6.8.0 (beta!)')).toBe('v6.8.0-beta');
  });

  it('truncates at 64 characters', () => {
    const long = 'a'.repeat(100);
    expect(importer.normalizeVersionName(long)).toHaveLength(64);
  });

  it('returns "unknown" for null', () => {
    expect(importer.normalizeVersionName(null)).toBe('unknown');
  });
});

// ─── importReleases ───────────────────────────────────────────────────────────

describe('importReleases()', () => {
  let importer;
  afterEach(() => fs.rmSync(importer._tempDir, { recursive: true, force: true }));

  it('creates releases directory if absent', async () => {
    importer = makeImporter();
    await importer.importReleases([{
      name: '6.8.0', released: false, archived: false, project: 'TEST'
    }]);
    expect(fs.existsSync(importer._releasesDir)).toBe(true);
  });

  it('writes a YAML file for each release', async () => {
    importer = makeImporter();
    await importer.importReleases([
      { name: '6.8.0', released: false, archived: false, project: 'TEST' },
      { name: '6.7.1', released: true,  archived: false, project: 'TEST' }
    ]);
    expect(fs.existsSync(path.join(importer._releasesDir, '6.8.0.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(importer._releasesDir, '6.7.1.yaml'))).toBe(true);
  });

  it('sets status: planned for unreleased versions', async () => {
    importer = makeImporter();
    await importer.importReleases([{
      name: '6.8.0', released: false, archived: false, project: 'TEST'
    }]);
    expect(readRelease(importer, '6.8.0.yaml').status).toBe('planned');
  });

  it('sets status: released for released versions', async () => {
    importer = makeImporter();
    await importer.importReleases([{
      name: '6.7.1', released: true, archived: false, project: 'TEST'
    }]);
    expect(readRelease(importer, '6.7.1.yaml').status).toBe('released');
  });

  it('sets status: archived for archived versions', async () => {
    importer = makeImporter();
    await importer.importReleases([{
      name: '6.6.0', released: true, archived: true, project: 'TEST'
    }]);
    expect(readRelease(importer, '6.6.0.yaml').status).toBe('archived');
  });

  it('writes target_date, start_date, and notes from Jira metadata', async () => {
    importer = makeImporter();
    await importer.importReleases([{
      name: '6.8.0',
      released: false,
      archived: false,
      project: 'TEST',
      releaseDate: '2026-03-15',
      startDate: '2026-02-01',
      description: 'FIX stability release'
    }]);
    const rel = readRelease(importer, '6.8.0.yaml');
    expect(rel.target_date).toBe('2026-03-15');
    expect(rel.start_date).toBe('2026-02-01');
    expect(rel.notes).toBe('FIX stability release');
  });

  it('omits optional fields when absent in Jira', async () => {
    importer = makeImporter();
    await importer.importReleases([{
      name: '6.8.0', released: false, archived: false, project: 'TEST'
    }]);
    const rel = readRelease(importer, '6.8.0.yaml');
    expect(rel.target_date).toBeUndefined();
    expect(rel.start_date).toBeUndefined();
    expect(rel.notes).toBeUndefined();
  });

  it('records the project in the projects array', async () => {
    importer = makeImporter();
    await importer.importReleases([{
      name: '6.8.0', released: false, archived: false, project: 'TEST'
    }]);
    expect(readRelease(importer, '6.8.0.yaml').projects).toEqual(['TEST']);
  });

  describe('update logic — only advance state, never downgrade', () => {
    it('advances planned → released when Jira says released', async () => {
      importer = makeImporter();
      // First import: planned
      await importer.importReleases([{
        name: '6.8.0', released: false, archived: false, project: 'TEST'
      }]);
      // Second import: now released
      await importer.importReleases([{
        name: '6.8.0', released: true, archived: false, project: 'TEST'
      }]);
      expect(readRelease(importer, '6.8.0.yaml').status).toBe('released');
    });

    it('advances released → archived', async () => {
      importer = makeImporter();
      await importer.importReleases([{
        name: '6.8.0', released: true, archived: false, project: 'TEST'
      }]);
      await importer.importReleases([{
        name: '6.8.0', released: true, archived: true, project: 'TEST'
      }]);
      expect(readRelease(importer, '6.8.0.yaml').status).toBe('archived');
    });

    it('does not downgrade released → planned', async () => {
      importer = makeImporter();
      await importer.importReleases([{
        name: '6.8.0', released: true, archived: false, project: 'TEST'
      }]);
      // Jira returns inconsistent data
      await importer.importReleases([{
        name: '6.8.0', released: false, archived: false, project: 'TEST'
      }]);
      expect(readRelease(importer, '6.8.0.yaml').status).toBe('released');
    });

    it('preserves manually added fields (branch, nightly) on update', async () => {
      importer = makeImporter();
      await importer.importReleases([{
        name: '6.8.0', released: false, archived: false, project: 'TEST'
      }]);

      // Simulate user manually adding branch and nightly fields
      const filePath = path.join(importer._releasesDir, '6.8.0.yaml');
      const existing = yaml.load(fs.readFileSync(filePath, 'utf8'));
      existing.branch = 'release/6.8.0';
      existing.nightly = true;
      fs.writeFileSync(filePath, yaml.dump(existing, { lineWidth: -1 }), 'utf8');

      // Re-import with status change
      await importer.importReleases([{
        name: '6.8.0', released: true, archived: false, project: 'TEST'
      }]);

      const updated = readRelease(importer, '6.8.0.yaml');
      expect(updated.status).toBe('released');
      expect(updated.branch).toBe('release/6.8.0');
      expect(updated.nightly).toBe(true);
    });
  });
});
