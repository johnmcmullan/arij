'use strict';

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const BUILTIN_SKILLS_DIR = path.join(__dirname, '..', '..', '.tract', 'skills');

// Standard locations Claude Code / Copilot CLI search for skills.
const GLOBAL_SKILLS_DIRS = [
  path.join(process.env.HOME, '.copilot', 'skills'),
  path.join(process.env.HOME, '.claude', 'skills'),
];

function findProjectSkillsDirs(startDir) {
  const found = [];
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (dir !== root) {
    for (const sub of ['.github/skills', '.claude/skills', '.tract/skills']) {
      const candidate = path.join(dir, sub);
      if (fs.existsSync(candidate)) found.push(candidate);
    }
    dir = path.dirname(dir);
  }
  return found;
}

function extraSkillsDirs() {
  const env = process.env.COPILOT_SKILLS_DIRS || '';
  return env.split(',').map(s => s.trim()).filter(Boolean);
}

function loadSkills(skillsDir) {
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir)
    .filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory())
    .map(name => {
      const skillFile = path.join(skillsDir, name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) return null;
      const content = fs.readFileSync(skillFile, 'utf8');
      // Try YAML frontmatter description field first
      let description = '';
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const descLine = fmMatch[1].match(/^description:\s*(.+)$/m);
        if (descLine) description = descLine[1].trim().replace(/^["']|["']$/g, '');
      }
      // Fall back to first paragraph under ## Purpose
      if (!description) {
        const purposeMatch = content.match(/^## Purpose\s*\n+([\s\S]*?)(?=\n##|\n---|\n\*\*|$)/m);
        if (purposeMatch) description = purposeMatch[1].trim().split('\n')[0].replace(/\*\*/g, '').trim();
      }
      return { name, skillFile, description };
    })
    .filter(Boolean);
}

function skillsCommand(nameArg, options) {
  // Collect skills from all locations — first definition of a name wins.
  const seen = new Set();
  const allSkills = [];
  const projectDirs = findProjectSkillsDirs(process.cwd());

  const searchDirs = [
    ...projectDirs,
    ...GLOBAL_SKILLS_DIRS,
    ...extraSkillsDirs(),
    BUILTIN_SKILLS_DIR,
  ];

  for (const dir of searchDirs) {
    for (const skill of loadSkills(dir)) {
      if (!seen.has(skill.name)) {
        seen.add(skill.name);
        allSkills.push(skill);
      }
    }
  }
  allSkills.sort((a, b) => a.name.localeCompare(b.name));

  // tract skills <name> — print skill to stdout
  if (nameArg) {
    const skill = allSkills.find(s => s.name === nameArg);
    if (!skill) {
      console.error(chalk.red(`Unknown skill: ${nameArg}`));
      console.error(chalk.gray(`Run 'tract skills' to list available skills.`));
      process.exit(1);
    }
    process.stdout.write(fs.readFileSync(skill.skillFile, 'utf8'));
    return;
  }

  // tract skills — list all
  console.log(chalk.bold.cyan('\n▐ Tract Skills\n'));
  console.log(chalk.gray('The prompt is the product. Each skill tells an LLM how to operate Tract.\n'));

  if (allSkills.length === 0) {
    console.log(chalk.yellow('  No skills found.'));
  } else {
    const nameWidth = Math.max(...allSkills.map(s => s.name.length)) + 2;
    for (const skill of allSkills) {
      const isBuiltin = skill.skillFile.startsWith(BUILTIN_SKILLS_DIR);
      const tag = isBuiltin ? chalk.gray('builtin') : chalk.blue('local');
      console.log(
        '  ' + chalk.cyan(skill.name.padEnd(nameWidth)) +
        chalk.white(skill.description || '') +
        '  ' + tag
      );
    }
  }

  console.log();
  console.log(chalk.gray('Usage:'));
  console.log(chalk.gray('  tract skills <name>              Print skill prompt to stdout'));
  console.log(chalk.gray('  tract skills <name> | pbcopy     Copy to clipboard (macOS)'));
  console.log(chalk.gray('  tract skills <name> | xclip      Copy to clipboard (Linux)'));
  console.log(chalk.gray('  tract skills <name> | llm        Pipe to your LLM'));
  console.log();
  console.log(chalk.gray(`Search path: ${searchDirs.filter(d => fs.existsSync(d)).join(', ')}`));
  console.log();
}

module.exports = skillsCommand;
