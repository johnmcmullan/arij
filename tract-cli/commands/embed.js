'use strict';

// tract embed — set up qmd collections for all cloned tract projects,
// add per-project context, then run `qmd embed`.
//
// Fails gracefully if qmd is not installed.

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { execSync, spawnSync } = require('child_process');
const chalk = require('chalk');

const TRACT_DIR = path.join(process.env.HOME, '.tract');

// Check qmd is available. Returns the command to use (qmd / npx @tobilu/qmd).
function findQmd() {
  // Prefer a globally installed qmd
  try {
    execSync('qmd --version', { stdio: 'ignore' });
    return 'qmd';
  } catch { /* not found globally */ }

  // Fall back to npx (requires network on first run, but works anywhere)
  try {
    execSync('npx --yes @tobilu/qmd --version', { stdio: 'ignore' });
    return 'npx @tobilu/qmd';
  } catch { /* also not available */ }

  return null;
}

// Read a project's .tract/config.yaml for name/description.
function readProjectConfig(dir) {
  try {
    const cfg = yaml.load(fs.readFileSync(path.join(dir, '.tract', 'config.yaml'), 'utf8'));
    return cfg || {};
  } catch { return {}; }
}

// Build a human-readable context string for qmd from the project config.
function buildContext(prefix, cfg) {
  const parts = [];
  if (cfg.name && cfg.name !== prefix) parts.push(cfg.name);
  if (cfg.description)                 parts.push(cfg.description);
  if (cfg.types?.length)               parts.push(`Issue types: ${cfg.types.slice(0,5).join(', ')}`);
  if (parts.length === 0)              parts.push(`${prefix} project tickets`);
  return parts.join(' — ');
}

module.exports = async function embed(options) {
  console.log(chalk.bold.cyan('\n▐ tract embed\n'));

  // ── 1. Check qmd is available ───────────────────────────────────────────
  const qmd = findQmd();
  if (!qmd) {
    console.log(chalk.yellow('⚠  qmd is not installed — skipping embed.\n'));
    console.log(chalk.gray('   Install it with:'));
    console.log(chalk.gray('     npm install -g @tobilu/qmd'));
    console.log(chalk.gray('   or:'));
    console.log(chalk.gray('     bun install -g @tobilu/qmd\n'));
    process.exit(0);
  }
  console.log(chalk.gray(`   Using: ${qmd}\n`));

  // ── 2. Discover cloned projects ─────────────────────────────────────────
  if (!fs.existsSync(TRACT_DIR)) {
    console.log(chalk.yellow('  No ~/.tract/ directory found. Run tract clone first.\n'));
    process.exit(0);
  }

  const projects = fs.readdirSync(TRACT_DIR)
    .filter(name => !name.startsWith('.'))
    .map(name => ({ name, dir: path.join(TRACT_DIR, name) }))
    .filter(({ dir }) => {
      try {
        return fs.statSync(dir).isDirectory() &&
               fs.existsSync(path.join(dir, '.tract', 'config.yaml'));
      } catch { return false; }
    });

  if (projects.length === 0) {
    console.log(chalk.yellow('  No tract projects found in ~/.tract/\n'));
    process.exit(0);
  }

  // ── 3. Register collections and context ─────────────────────────────────
  console.log(chalk.bold(`Setting up ${projects.length} collection(s):\n`));

  for (const { name, dir } of projects) {
    const cfg     = readProjectConfig(dir);
    const context = buildContext(name, cfg);
    const colUri  = `qmd://${name.toLowerCase()}`;

    process.stdout.write(`  ${chalk.cyan(name.padEnd(8))} `);

    // Add collection (idempotent — qmd skips if already registered)
    const addResult = spawnSync(
      qmd.split(' ')[0],
      [...qmd.split(' ').slice(1), 'collection', 'add', dir, '--name', name.toLowerCase()],
      { encoding: 'utf8', shell: qmd.startsWith('npx') }
    );
    if (addResult.status !== 0 && !addResult.stderr?.includes('already')) {
      console.log(chalk.red(`✗ collection add failed: ${(addResult.stderr || '').trim()}`));
      continue;
    }

    // Add context (idempotent)
    const ctxResult = spawnSync(
      qmd.split(' ')[0],
      [...qmd.split(' ').slice(1), 'context', 'add', colUri, context],
      { encoding: 'utf8', shell: qmd.startsWith('npx') }
    );
    if (ctxResult.status !== 0 && !ctxResult.stderr?.includes('already')) {
      console.log(chalk.yellow(`⚠  context add failed (non-fatal)`));
    }

    console.log(chalk.green(`✓  ${dir}`));
    if (options.verbose) console.log(chalk.gray(`      context: ${context}`));
  }

  console.log('');

  // ── 4. Run qmd embed ─────────────────────────────────────────────────────
  if (options.setupOnly) {
    console.log(chalk.gray('  --setup-only: skipping embed. Run `qmd embed` manually when ready.\n'));
    process.exit(0);
  }

  console.log(chalk.bold('Running qmd embed...\n'));
  console.log(chalk.gray('  (This may take a while on first run — embeddings are cached)\n'));

  const embedResult = spawnSync(
    qmd.split(' ')[0],
    [...qmd.split(' ').slice(1), 'embed'],
    { stdio: 'inherit', shell: qmd.startsWith('npx') }
  );

  if (embedResult.status !== 0) {
    console.log(chalk.red('\n✗ qmd embed failed\n'));
    process.exit(1);
  }

  console.log(chalk.bold.green('\n✅ Embeddings ready. Try:\n'));
  console.log(chalk.gray('   tract search "memory leak"'));
  console.log(chalk.gray('   tract vsearch "customer unhappy with performance"'));
  console.log(chalk.gray('   tract query "FIX session drops EMEA"\n'));
};
