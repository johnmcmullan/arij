const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const TicketImporter = require(path.join(__dirname, '../../../lib/ticket-importer'));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'tract-importer-test-'));
}

function makeImporter(configOverrides = {}) {
  const tempDir = makeTempDir();

  // Minimal .tract directory
  const tractDir = path.join(tempDir, '.tract');
  fs.mkdirSync(tractDir, { recursive: true });

  const config = {
    prefix: 'TEST',
    types: ['bug', 'story', 'task', 'epic'],
    statuses: ['todo', 'in-progress', 'done', 'closed'],
    priorities: ['critical', 'high', 'medium', 'low'],
    ...configOverrides
  };
  fs.writeFileSync(path.join(tractDir, 'config.yaml'), yaml.dump(config));

  // components.yaml required by constructor
  fs.writeFileSync(path.join(tractDir, 'components.yaml'), yaml.dump({ components: {} }));

  const importer = new TicketImporter(null, tempDir);
  importer._tempDir = tempDir;
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

// ─── rank ────────────────────────────────────────────────────────────────────

describe('rank import', () => {
  let importer;

  afterEach(() => fs.rmSync(importer._tempDir, { recursive: true, force: true }));

  it('imports rank from default customfield_10019', () => {
    importer = makeImporter();
    const issue = makeIssue({ customfield_10019: '0|hzzzzz:' });
    const md = importer.convertToMarkdown(issue);
    expect(parseFrontmatter(md).rank).toBe('0|hzzzzz:');
  });

  it('uses configured rank_field if set', () => {
    importer = makeImporter({ jira: { rank_field: 'customfield_10099' } });
    const issue = makeIssue({ customfield_10099: '0|aaaaa:' });
    const md = importer.convertToMarkdown(issue);
    expect(parseFrontmatter(md).rank).toBe('0|aaaaa:');
  });

  it('omits rank when field is absent', () => {
    importer = makeImporter();
    const issue = makeIssue(); // no rank field
    const md = importer.convertToMarkdown(issue);
    expect(parseFrontmatter(md).rank).toBeUndefined();
  });

  it('does not import rank from wrong field when rank_field is configured', () => {
    importer = makeImporter({ jira: { rank_field: 'customfield_10099' } });
    // Default field present but configured field absent
    const issue = makeIssue({ customfield_10019: '0|hzzzzz:' });
    const md = importer.convertToMarkdown(issue);
    expect(parseFrontmatter(md).rank).toBeUndefined();
  });
});

// ─── environment ─────────────────────────────────────────────────────────────

describe('environment import', () => {
  let importer;

  afterEach(() => fs.rmSync(importer._tempDir, { recursive: true, force: true }));

  it('imports plain string environment', () => {
    importer = makeImporter();
    const issue = makeIssue({ environment: 'production' });
    const md = importer.convertToMarkdown(issue);
    expect(parseFrontmatter(md).environment).toBe('production');
  });

  it('extracts text from ADF environment object', () => {
    importer = makeImporter();
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'prod' },
            { type: 'text', text: '-eu-west-1' }
          ]
        }
      ]
    };
    const issue = makeIssue({ environment: adf });
    const md = importer.convertToMarkdown(issue);
    expect(parseFrontmatter(md).environment).toBe('prod-eu-west-1');
  });

  it('omits environment when field is absent', () => {
    importer = makeImporter();
    const issue = makeIssue();
    const md = importer.convertToMarkdown(issue);
    expect(parseFrontmatter(md).environment).toBeUndefined();
  });

  it('omits environment when field is empty string', () => {
    importer = makeImporter();
    const issue = makeIssue({ environment: '' });
    const md = importer.convertToMarkdown(issue);
    // extractText('') returns '' which is falsy → not set
    const fm = parseFrontmatter(md);
    expect(fm.environment == null || fm.environment === '').toBe(true);
  });
});

// ─── applyCustomFields ────────────────────────────────────────────────────────

describe('applyCustomFields()', () => {
  let importer;

  afterEach(() => fs.rmSync(importer._tempDir, { recursive: true, force: true }));

  it('maps configured custom fields to readable frontmatter keys', () => {
    importer = makeImporter({
      jira: {
        custom_field_map: {
          customfield_10042: 'customer',
          customfield_10100: 'account_id'
        }
      }
    });
    const issue = makeIssue({
      customfield_10042: 'Acme Corp',
      customfield_10100: 'ACC-001'
    });
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.customer).toBe('Acme Corp');
    expect(fm.account_id).toBe('ACC-001');
  });

  it('omits mapped field when Jira value is null', () => {
    importer = makeImporter({
      jira: { custom_field_map: { customfield_10042: 'customer' } }
    });
    const issue = makeIssue({ customfield_10042: null });
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.customer).toBeUndefined();
  });

  it('omits mapped field when Jira value is absent', () => {
    importer = makeImporter({
      jira: { custom_field_map: { customfield_10042: 'customer' } }
    });
    const issue = makeIssue(); // field not present at all
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.customer).toBeUndefined();
  });

  it('passes through unmapped customfield_NNNNN when passthrough enabled', () => {
    importer = makeImporter({
      jira: {
        custom_field_map: { customfield_10042: 'customer' },
        custom_field_passthrough: true
      }
    });
    const issue = makeIssue({
      customfield_10042: 'Acme',
      customfield_10999: 'some-value'  // unmapped
    });
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.customer).toBe('Acme');
    expect(fm.customfield_10999).toBe('some-value');
  });

  it('does not pass through unmapped fields when passthrough disabled', () => {
    importer = makeImporter({
      jira: {
        custom_field_map: {},
        custom_field_passthrough: false
      }
    });
    const issue = makeIssue({ customfield_10999: 'some-value' });
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.customfield_10999).toBeUndefined();
  });

  it('works with no custom_field_map in config', () => {
    importer = makeImporter(); // no jira config at all
    const issue = makeIssue({ customfield_10042: 'Acme' });
    // Should not throw, field should not appear
    const fm = parseFrontmatter(importer.convertToMarkdown(issue));
    expect(fm.customer).toBeUndefined();
  });
});

// ─── normalizeCustomFieldValue ────────────────────────────────────────────────

describe('normalizeCustomFieldValue()', () => {
  let importer;

  beforeEach(() => { importer = makeImporter(); });
  afterEach(() => fs.rmSync(importer._tempDir, { recursive: true, force: true }));

  it('returns plain string as-is', () => {
    expect(importer.normalizeCustomFieldValue('hello')).toBe('hello');
  });

  it('returns number as-is', () => {
    expect(importer.normalizeCustomFieldValue(42)).toBe(42);
  });

  it('returns null for null', () => {
    expect(importer.normalizeCustomFieldValue(null)).toBeNull();
  });

  it('extracts name from user object', () => {
    expect(importer.normalizeCustomFieldValue({ name: 'alice', emailAddress: 'a@b.com' })).toBe('alice');
  });

  it('falls back to displayName if no name', () => {
    expect(importer.normalizeCustomFieldValue({ displayName: 'Alice Smith' })).toBe('Alice Smith');
  });

  it('extracts value from select-list option', () => {
    expect(importer.normalizeCustomFieldValue({ value: 'Gold', id: '1' })).toBe('Gold');
  });

  it('maps array of options to array of values', () => {
    const result = importer.normalizeCustomFieldValue([
      { value: 'Red' },
      { value: 'Blue' }
    ]);
    expect(result).toEqual(['Red', 'Blue']);
  });

  it('JSON-stringifies unknown object shapes', () => {
    const obj = { foo: 'bar', baz: 123 };
    expect(importer.normalizeCustomFieldValue(obj)).toBe(JSON.stringify(obj));
  });
});

// ─── extractText (ADF) ────────────────────────────────────────────────────────

describe('extractText()', () => {
  let importer;

  beforeEach(() => { importer = makeImporter(); });
  afterEach(() => fs.rmSync(importer._tempDir, { recursive: true, force: true }));

  it('returns plain string unchanged', () => {
    expect(importer.extractText('staging')).toBe('staging');
  });

  it('returns null for null', () => {
    expect(importer.extractText(null)).toBeNull();
  });

  it('extracts text from ADF doc node', () => {
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'hello world' }] }
      ]
    };
    expect(importer.extractText(adf)).toBe('hello world');
  });

  it('joins multiple paragraphs with newline', () => {
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'first' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'second' }] }
      ]
    };
    expect(importer.extractText(adf)).toBe('first\nsecond');
  });

  it('handles nested ADF content', () => {
    const adf = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'foo' },
            { type: 'text', text: 'bar' }
          ]
        }
      ]
    };
    expect(importer.extractText(adf)).toBe('foobar');
  });

  it('returns null for ADF with no text content', () => {
    const adf = { version: 1, type: 'doc', content: [] };
    expect(importer.extractText(adf)).toBeNull();
  });
});
