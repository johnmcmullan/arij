'use strict';

// tract search / vsearch / query — wrappers around qmd search commands.
//
// tract search  "text"   → qmd search  (fast keyword)
// tract vsearch "text"   → qmd vsearch (semantic)
// tract query   "text"   → qmd query   (hybrid + reranking, best quality)
//
// If qmd is not installed, tract search falls back to ripgrep or grep -R.
// vsearch and query require qmd (no fallback for semantic search).

const { spawnSync, execSync } = require('child_process');
const chalk = require('chalk');
const path  = require('path');
const fs    = require('fs');

const TRACT_DIR = path.join(process.env.HOME, '.tract');

function findQmd() {
  try { execSync('qmd --version', { stdio: 'ignore' }); return 'qmd'; } catch { /* */ }
  return null;
}

function findGrep() {
  try { execSync('rg --version', { stdio: 'ignore' }); return 'rg'; } catch { /* */ }
  return 'grep'; // always available
}

// Resolve -p TB,SERV to qmd -c tb -c serv args
function projectArgs(projectsOpt) {
  if (!projectsOpt) return [];
  return projectsOpt.split(',')
    .flatMap(p => ['-c', p.trim().toLowerCase()]);
}

// Resolve -p TB,SERV to a list of directories to search
function projectDirs(projectsOpt) {
  if (!projectsOpt) {
    // All cloned projects
    if (!fs.existsSync(TRACT_DIR)) return [TRACT_DIR];
    return fs.readdirSync(TRACT_DIR)
      .filter(n => !n.startsWith('.'))
      .map(n => path.join(TRACT_DIR, n))
      .filter(d => { try { return fs.statSync(d).isDirectory(); } catch { return false; } });
  }
  return projectsOpt.split(',').map(p => path.join(TRACT_DIR, p.trim().toUpperCase()));
}

function fallbackSearch(query, options) {
  const grep = findGrep();
  const dirs = projectDirs(options.project);
  const existing = dirs.filter(d => fs.existsSync(d));

  if (existing.length === 0) {
    console.log(chalk.yellow('\n  No project directories found. Run tract clone first.\n'));
    process.exit(0);
  }

  console.log(chalk.gray(`  (qmd not installed — falling back to ${grep === 'rg' ? 'ripgrep' : 'grep'})\n`));

  let args, cmd;
  if (grep === 'rg') {
    args = ['-l', '--type', 'md', query, ...existing];
    cmd = 'rg';
  } else {
    args = ['-rl', '--include=*.md', query, ...existing];
    cmd = 'grep';
  }

  if (options.files) {
    // files-only mode: just print paths
    const result = spawnSync(cmd, args, { stdio: 'inherit' });
    process.exit(result.status === 1 ? 0 : result.status || 0); // exit 1 = no matches, not an error
  } else {
    // Show matching lines with context
    const lineArgs = grep === 'rg'
      ? ['-n', '--type', 'md', '-C', '1', query, ...existing]
      : ['-rn', '--include=*.md', '-A', '1', query, ...existing];
    const result = spawnSync(cmd, lineArgs, { stdio: 'inherit' });
    process.exit(result.status === 1 ? 0 : result.status || 0);
  }
}

function runQmd(subcommand, query, options) {
  const qmd = findQmd();

  // Keyword search: fall back to grep/rg if qmd missing
  if (!qmd && subcommand === 'search') {
    return fallbackSearch(query, options);
  }

  // Semantic commands require qmd
  if (!qmd) {
    console.log(chalk.yellow(`\n⚠  ${subcommand} requires qmd (semantic search).\n`));
    console.log(chalk.gray('   Install: npm install -g @tobilu/qmd'));
    console.log(chalk.gray('   Then run: tract embed\n'));
    console.log(chalk.gray(`   For keyword search without qmd: tract search "${query}"\n`));
    process.exit(0);
  }

  const args = [
    subcommand,
    query,
    ...projectArgs(options.project),
  ];

  if (options.all)      args.push('--all');
  if (options.files)    args.push('--files');
  if (options.minScore) args.push('--min-score', options.minScore);

  const result = spawnSync(
    qmd.split(' ')[0],
    [...qmd.split(' ').slice(1), ...args],
    { stdio: 'inherit', shell: qmd.startsWith('npx') }
  );

  if (result.status !== 0) process.exit(result.status || 1);
}

module.exports = {
  searchCommand:  (query, options) => runQmd('search',  query, options),
  vsearchCommand: (query, options) => runQmd('vsearch', query, options),
  queryCommand:   (query, options) => runQmd('query',   query, options),
};
