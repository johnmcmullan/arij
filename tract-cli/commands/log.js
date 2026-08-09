'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { execSync, spawnSync } = require('child_process');

// ── Find worklogs repo ─────────────────────────────────────────────────────────

function findWorklogsRepo() {
  const HOME = process.env.HOME || '/root';
  const TRACT_DIR = path.join(HOME, '.tract');

  if (process.env.TRACT_WORKLOGS_DIR) return process.env.TRACT_WORKLOGS_DIR;

  // workspace.yaml
  const wsFile = path.join(TRACT_DIR, 'workspace.yaml');
  if (fs.existsSync(wsFile)) {
    try {
      const ws = yaml.load(fs.readFileSync(wsFile, 'utf8')) || {};
      for (const p of ws.projects || []) {
        if ((p.prefix || '').toLowerCase() === 'worklogs' ||
            (p.path  || '').toLowerCase().includes('worklogs')) {
          if (fs.existsSync(p.path)) return p.path;
        }
      }
    } catch { /* ignore */ }
  }

  // Scan ~/.tract/
  if (fs.existsSync(TRACT_DIR)) {
    for (const entry of fs.readdirSync(TRACT_DIR)) {
      if (entry.toLowerCase().includes('worklogs')) {
        const candidate = path.join(TRACT_DIR, entry);
        if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, '.git'))) {
          return candidate;
        }
      }
    }
  }

  // Conventional paths
  for (const c of [path.join(HOME, 'work', 'worklogs'), path.join(HOME, 'worklogs')]) {
    if (fs.existsSync(c) && fs.existsSync(path.join(c, '.git'))) return c;
  }

  return null;
}

// ── Time string parsing ────────────────────────────────────────────────────────

function parseTimeToSeconds(timeStr) {
  let total = 0;
  const re = /(\d+(?:\.\d+)?)\s*([dhm])/gi;
  let match;
  while ((match = re.exec(timeStr)) !== null) {
    const n = parseFloat(match[1]);
    switch (match[2].toLowerCase()) {
      case 'd': total += n * 8 * 3600; break; // 1d = 8h
      case 'h': total += n * 3600;     break;
      case 'm': total += n * 60;       break;
    }
  }
  if (total === 0 && /^\d+$/.test(timeStr.trim())) {
    total = parseInt(timeStr.trim(), 10) * 60; // bare number = minutes
  }
  return Math.round(total);
}

// ── Main command ───────────────────────────────────────────────────────────────

async function log(issue, time, comment, options) {
  const seconds = parseTimeToSeconds(time);
  if (seconds <= 0) {
    console.error(chalk.red(`❌ Could not parse time: "${time}"`));
    console.error(chalk.gray('   Use: 2h, 30m, 1h30m, 1d'));
    process.exit(1);
  }

  // Resolve author (Jira username from git config)
  let author = options.author;
  if (!author) {
    try {
      author = execSync('git config user.email', { encoding: 'utf8' }).trim();
      // Strip domain — Jira username is typically the local part, lowercase
      if (author.includes('@')) author = author.split('@')[0].toLowerCase();
    } catch {
      console.error(chalk.red('❌ Could not determine author from git config user.email'));
      process.exit(1);
    }
  }

  const worklogsRepo = options.worklogsDir || findWorklogsRepo();
  if (!worklogsRepo) {
    console.error(chalk.red('❌ Could not find local worklogs repo'));
    console.error(chalk.gray('   Clone it first:  tract clone worklogs --server <host>'));
    console.error(chalk.gray('   Or set:          TRACT_WORKLOGS_DIR=<path>'));
    process.exit(1);
  }

  // Determine JSONL file: YYYY-MM.jsonl
  const started = options.started ? new Date(options.started) : new Date();
  if (isNaN(started.getTime())) {
    console.error(chalk.red(`❌ Invalid --started date: "${options.started}"`));
    process.exit(1);
  }
  const month  = started.toISOString().slice(0, 7); // "2026-03"
  const jsonlPath = path.join(worklogsRepo, `${month}.jsonl`);

  const entry = {
    issue,
    author,
    started:  started.toISOString(),
    seconds,
    comment:  comment || '',
    jiraId:   '',   // empty = not yet synced to Jira
  };

  console.log(chalk.cyan(`\n📝 Logging time to ${issue}...`));
  console.log(chalk.gray(`   Author:  ${author}`));
  console.log(chalk.gray(`   Time:    ${time} (${seconds}s)`));
  if (comment) console.log(chalk.gray(`   Comment: ${comment}`));
  console.log(chalk.gray(`   File:    ${jsonlPath}`));

  // Append JSONL line
  fs.appendFileSync(jsonlPath, JSON.stringify(entry) + '\n');

  // Git commit + push
  const commitMsg = `worklog: ${issue} ${time}${comment ? ` – ${comment}` : ''}`;
  const gitOpts = { cwd: worklogsRepo, encoding: 'utf8' };

  try {
    execSync(`git add "${path.basename(jsonlPath)}"`, gitOpts);
    execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, gitOpts);
  } catch (e) {
    console.error(chalk.red(`❌ Git commit failed: ${e.message}`));
    process.exit(1);
  }

  // Push (non-fatal — entry is already saved locally)
  const push = spawnSync('git', ['push'], { cwd: worklogsRepo, encoding: 'utf8' });
  if (push.status !== 0) {
    console.warn(chalk.yellow(`\n⚠️  git push failed (entry saved locally, will push next time)`));
    console.warn(chalk.gray(push.stderr || push.stdout));
  } else {
    console.log(chalk.green(`\n✅ Logged and pushed!`));
  }

  console.log(chalk.gray(`   The daemon will sync this to Jira on its next cycle.`));
}

module.exports = log;
