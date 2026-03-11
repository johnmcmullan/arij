'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');

// ── Find teams directory ───────────────────────────────────────────────────────

function findTeamsDir(options) {
  const HOME = process.env.HOME || '/root';
  const TRACT_DIR = path.join(HOME, '.tract');

  // 1. Explicit --dir flag
  if (options.dir) return path.resolve(options.dir);

  // 2. TRACT_WORKLOGS_DIR env var
  if (process.env.TRACT_WORKLOGS_DIR) {
    return path.join(process.env.TRACT_WORKLOGS_DIR, 'teams');
  }

  // 3. workspace.yaml — look for any project whose path contains 'worklogs'
  const wsFile = path.join(TRACT_DIR, 'workspace.yaml');
  if (fs.existsSync(wsFile)) {
    try {
      const ws = yaml.load(fs.readFileSync(wsFile, 'utf8')) || {};
      for (const p of ws.projects || []) {
        if ((p.prefix || '').toLowerCase() === 'worklogs' ||
            (p.path  || '').toLowerCase().includes('worklogs')) {
          const candidate = path.join(p.path, 'teams');
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    } catch { /* ignore corrupt workspace.yaml */ }
  }

  // 4. Scan ~/.tract/ for any git repo that has a teams/ subdir (worklogs clone)
  if (fs.existsSync(TRACT_DIR)) {
    for (const entry of fs.readdirSync(TRACT_DIR)) {
      if (entry.toLowerCase().includes('worklogs')) {
        const candidate = path.join(TRACT_DIR, entry, 'teams');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  // 5. Conventional non-~/.tract clone paths
  const candidates = [
    path.join(HOME, 'work', 'worklogs', 'teams'),
    path.join(HOME, 'worklogs', 'teams'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  return null;
}

// ── Load all team YAML files ───────────────────────────────────────────────────

function loadTeams(teamsDir) {
  return fs.readdirSync(teamsDir)
    .filter(f => f.endsWith('.yaml') && f !== 'config.yaml')
    .map(f => {
      try {
        const raw = fs.readFileSync(path.join(teamsDir, f), 'utf8');
        return yaml.load(raw);
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── tract teams list ───────────────────────────────────────────────────────────

function teamsList(options) {
  const teamsDir = findTeamsDir(options);
  if (!teamsDir || !fs.existsSync(teamsDir)) {
    console.error(chalk.red('❌ Worklogs repo not found.'));
    console.error(chalk.gray('  Clone it first:  tract clone worklogs --server <host>'));
    console.error(chalk.gray('  Or use:          --dir <path/to/worklogs/teams>'));
    process.exit(1);
  }

  let teams = loadTeams(teamsDir);

  // Filters
  if (options.rd) {
    teams = teams.filter(t => t.is_rd);
  }
  if (options.jurisdiction) {
    teams = teams.filter(t => t.jurisdiction === options.jurisdiction);
  }

  if (teams.length === 0) {
    console.log(chalk.yellow('No teams match the given filters.'));
    return;
  }

  // Group by top-level hierarchy entry
  const grouped = {};
  for (const t of teams) {
    const top = (t.hierarchy && t.hierarchy[0]) || 'Other';
    if (!grouped[top]) grouped[top] = [];
    grouped[top].push(t);
  }

  for (const [group, members] of Object.entries(grouped).sort()) {
    console.log(chalk.bold.cyan(`\n${group}`));
    for (const t of members) {
      const rdBadge = t.is_rd ? chalk.green(' [R&D]') : '';
      const jur = t.jurisdiction ? chalk.gray(` (${t.jurisdiction})`) : '';
      const activeMembers = (t.members || []).filter(m => m.active).length;
      const leadStr = t.lead ? chalk.gray(` lead:${t.lead}`) : '';
      console.log(`  ${chalk.white(t.name)}${rdBadge}${jur}${leadStr}  ${chalk.gray(`${activeMembers} members`)}`);
    }
  }
  console.log();
}

// ── tract teams show ───────────────────────────────────────────────────────────

function teamsShow(nameOrId, options) {
  const teamsDir = findTeamsDir(options);
  if (!teamsDir || !fs.existsSync(teamsDir)) {
    console.error(chalk.red('❌ Worklogs repo not found.'));
    console.error(chalk.gray('  Clone it first:  tract clone worklogs --server <host>'));
    console.error(chalk.gray('  Or use:          --dir <path/to/worklogs/teams>'));
    process.exit(1);
  }

  const teams = loadTeams(teamsDir);
  const query = nameOrId.toLowerCase();
  const team = teams.find(t =>
    String(t.id) === query ||
    t.name.toLowerCase().includes(query) ||
    t.slug === query
  );

  if (!team) {
    console.error(chalk.red(`❌ Team not found: ${nameOrId}`));
    console.error(chalk.gray('  Use "tract teams list" to see available teams.'));
    process.exit(1);
  }

  const rdBadge = team.is_rd ? chalk.green('[R&D]') : chalk.gray('[non-R&D]');
  const jur = team.jurisdiction || chalk.gray('(unspecified)');

  console.log(chalk.bold.cyan(`\n${team.name}`) + '  ' + rdBadge);
  console.log(chalk.gray('─'.repeat(60)));
  console.log(`  ${chalk.gray('ID:')}           ${team.id}`);
  console.log(`  ${chalk.gray('Slug:')}         ${team.slug}`);
  if (team.lead) console.log(`  ${chalk.gray('Lead:')}         ${team.lead}`);
  console.log(`  ${chalk.gray('Jurisdiction:')} ${jur}`);
  console.log(`  ${chalk.gray('Hierarchy:')}`);
  for (const h of team.hierarchy || []) {
    console.log(`    ${chalk.gray('›')} ${h}`);
  }

  const members = team.members || [];
  const active = members.filter(m => m.active);
  const inactive = members.filter(m => !m.active);

  console.log(`\n  ${chalk.bold('Active members')} (${active.length})`);
  console.log(chalk.gray('  ' + '─'.repeat(56)));
  for (const m of active) {
    const avail = m.availability < 100 ? chalk.yellow(` ${m.availability}%`) : '';
    const from = m.date_from ? chalk.gray(` from ${m.date_from}`) : '';
    const role = m.role !== 'Member' ? chalk.gray(` [${m.role}]`) : '';
    console.log(`    ${chalk.white(m.display_name)} (${m.username})${role}${avail}${from}`);
  }

  if (inactive.length > 0) {
    console.log(`\n  ${chalk.dim('Former members')} (${inactive.length})`);
    for (const m of inactive) {
      const to = m.date_to ? chalk.gray(` until ${m.date_to}`) : '';
      console.log(`    ${chalk.dim(`${m.display_name} (${m.username})`)}${to}`);
    }
  }
  console.log();
}

// ── Command export ─────────────────────────────────────────────────────────────

module.exports = { teamsList, teamsShow };
