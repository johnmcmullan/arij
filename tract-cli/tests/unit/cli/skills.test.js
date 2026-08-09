const path = require('path');
const fs = require('fs');
const os = require('os');

// skills.js uses process.cwd() to find project skills dir
// and a hardcoded builtin dir — we control the project dir via cwd mock.

const skillsCommand = require(path.join(__dirname, '../../../commands/skills'));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTmpSkillsDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tract-skills-test-'));
  fs.mkdirSync(path.join(tmpDir, '.tract', 'skills'), { recursive: true });
  return tmpDir;
}

function createSkill(tmpDir, name, skillMd) {
  const skillDir = path.join(tmpDir, '.tract', 'skills', name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMd);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tract skills', () => {
  let tmpDir;
  let consoleLogMock;
  let consoleErrorMock;
  let cwdMock;
  let exitMock;

  beforeEach(() => {
    tmpDir = makeTmpSkillsDir();
    cwdMock = jest.spyOn(process, 'cwd').mockReturnValue(tmpDir);
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
    exitMock = jest.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('lists skills from .tract/skills/ directory', () => {
    createSkill(tmpDir, 'my-test-skill', '# My Test Skill\n## Purpose\n\nDoes something useful.\n');

    skillsCommand(null, {});

    const output = consoleLogMock.mock.calls.flat().join('\n');
    expect(output).toMatch(/my-test-skill/);
  });

  test('extracts description from YAML frontmatter description field', () => {
    createSkill(tmpDir, 'frontmatter-skill', [
      '---',
      'description: "Automates the boring stuff"',
      '---',
      '# Frontmatter Skill',
      '',
      'Content here.',
    ].join('\n'));

    skillsCommand(null, {});

    const output = consoleLogMock.mock.calls.flat().join('\n');
    expect(output).toMatch(/Automates the boring stuff/);
  });

  test('extracts description from ## Purpose heading when no frontmatter', () => {
    createSkill(tmpDir, 'purpose-skill', [
      '# Purpose Skill',
      '',
      '## Purpose',
      '',
      'Generates release notes automatically.',
      '',
      '## Usage',
      'Some usage details.',
    ].join('\n'));

    skillsCommand(null, {});

    const output = consoleLogMock.mock.calls.flat().join('\n');
    expect(output).toMatch(/Generates release notes automatically/);
  });

  test('tract skills <name> prints SKILL.md content to stdout', () => {
    const content = '# Special Skill\n\nThis is the full skill prompt.\n';
    createSkill(tmpDir, 'my-test-skill', content);
    const stdoutMock = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});

    skillsCommand('my-test-skill', {});

    expect(stdoutMock).toHaveBeenCalledWith(content);
  });

  test('unknown skill name shows helpful error', () => {
    createSkill(tmpDir, 'my-test-skill', '# Skill\n## Purpose\n\nDoes stuff.\n');

    expect(() => skillsCommand('nonexistent-skill', {})).toThrow('process.exit:1');

    const errorOutput = consoleErrorMock.mock.calls.flat().join('\n');
    expect(errorOutput).toMatch(/Unknown skill/);
    expect(errorOutput).toMatch(/nonexistent-skill/);
  });
});
