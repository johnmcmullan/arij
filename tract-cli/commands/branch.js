'use strict';

// branch.js — create a git branch for a ticket and record it in frontmatter.
//
// Usage:
//   tract branch TB-1234
//   tract branch TB-1234 --name custom-branch-name
//   tract branch TB-1234 --base develop
//
// What it does:
//   1. Finds the ticket file (supports sharded tickets/TB-1/TB-1234.md layout)
//   2. Derives a branch name from the ticket title unless --name is given
//   3. Creates the branch via `git checkout -b`
//   4. Writes `branch: <name>` into the ticket frontmatter
//   5. Commits the frontmatter change

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { execFileSync, execSync } = require('child_process');

module.exports = async function branch(ticketId, options) {
  // ── Locate ticket file ──────────────────────────────────────────────────────
  const ticketFile = findTicketFile(ticketId);
  if (!ticketFile) {
    console.error(chalk.red(`❌ Ticket ${ticketId} not found`));
    console.error(chalk.gray('   Run this command from inside a tract project directory'));
    console.error(chalk.gray(`   Expected: tickets/${ticketId}.md or tickets/<shard>/${ticketId}.md`));
    process.exit(1);
  }

  // ── Parse frontmatter ───────────────────────────────────────────────────────
  const raw = fs.readFileSync(ticketFile, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    console.error(chalk.red(`❌ Could not parse frontmatter in ${ticketFile}`));
    process.exit(1);
  }
  const frontmatter = yaml.load(match[1]);
  const body = match[2];

  // ── Check ticket isn't already merged/done ─────────────────────────────────
  const terminalStatuses = ['done', 'closed', 'merged'];
  if (terminalStatuses.includes((frontmatter.status || '').toLowerCase())) {
    console.error(chalk.red(`❌ Ticket ${ticketId} is ${frontmatter.status} — cannot create branch`));
    process.exit(1);
  }

  // ── Warn if branch already set ─────────────────────────────────────────────
  const existing = frontmatter.branch || (frontmatter.branches && frontmatter.branches[0]);
  if (existing && !options.force) {
    console.error(chalk.yellow(`⚠️  ${ticketId} already has branch: ${existing}`));
    console.error(chalk.gray('   Use --force to create an additional branch'));
    process.exit(1);
  }

  // ── Derive branch name ──────────────────────────────────────────────────────
  const branchName = options.name || deriveBranchName(ticketId, frontmatter.title || '');
  console.log(chalk.cyan(`\n🌿 Creating branch for ${ticketId}`));
  console.log(chalk.gray(`   Branch: ${branchName}`));
  if (options.base) {
    console.log(chalk.gray(`   Base:   ${options.base}`));
  }

  // ── Create git branch ───────────────────────────────────────────────────────
  try {
    const args = ['checkout', '-b', branchName];
    if (options.base) args.push(options.base);
    execFileSync('git', args, { stdio: 'pipe' });
  } catch (err) {
    const msg = err.stderr ? err.stderr.toString().trim() : err.message;
    console.error(chalk.red(`❌ git checkout failed: ${msg}`));
    process.exit(1);
  }

  // ── Write branch into frontmatter ──────────────────────────────────────────
  if (existing && options.force) {
    // Append to branches array
    if (frontmatter.branches) {
      frontmatter.branches.push(branchName);
    } else {
      frontmatter.branches = [frontmatter.branch, branchName];
      delete frontmatter.branch;
    }
  } else {
    frontmatter.branch = branchName;
  }

  // Also move ticket to in-progress if it's open/backlog
  const openStatuses = ['open', 'backlog', 'todo', 'to do'];
  if (openStatuses.includes((frontmatter.status || '').toLowerCase())) {
    frontmatter.status = 'in-progress';
    console.log(chalk.gray(`   Status: open → in-progress`));
  }

  // ── Rewrite ticket file ─────────────────────────────────────────────────────
  const newFrontmatter = yaml.dump(frontmatter, { lineWidth: -1, quotingType: '"' });
  const newContent = `---\n${newFrontmatter}---\n${body}`;
  fs.writeFileSync(ticketFile, newContent);

  // ── Commit frontmatter change ───────────────────────────────────────────────
  try {
    execFileSync('git', ['add', ticketFile], { stdio: 'pipe' });
    execFileSync('git', ['commit', '-m',
      `${ticketId}: add branch ${branchName}`,
    ], { stdio: 'pipe' });
    console.log(chalk.green(`\n✅ Branch created and ticket updated`));
    console.log(chalk.gray(`   ${ticketFile}`));
    console.log(chalk.gray(`   Committed: branch: ${branchName}`));
  } catch (err) {
    console.log(chalk.yellow(`\n⚠️  Branch created but commit failed`));
    console.log(chalk.gray(`   Commit manually: git add ${ticketFile} && git commit`));
  }

  console.log(chalk.cyan(`\n💡 Next: do your work, then:`));
  console.log(chalk.gray(`   tract review open ${ticketId}`));
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function findTicketFile(ticketId) {
  // Flat layout: tickets/TB-1234.md
  const flat = path.join('tickets', `${ticketId}.md`);
  if (fs.existsSync(flat)) return flat;

  // Sharded layout: tickets/TB-1/TB-1234.md
  const prefix = ticketId.replace(/-\d+$/, '');
  const num = ticketId.match(/-(\d+)$/)?.[1] || '';
  if (num) {
    const shard = `${prefix}-${num[0]}`;
    const sharded = path.join('tickets', shard, `${ticketId}.md`);
    if (fs.existsSync(sharded)) return sharded;
  }

  // Search all shards (slower fallback)
  if (fs.existsSync('tickets')) {
    for (const entry of fs.readdirSync('tickets')) {
      const candidate = path.join('tickets', entry, `${ticketId}.md`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

function deriveBranchName(ticketId, title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // strip punctuation
    .trim()
    .replace(/\s+/g, '-')            // spaces → hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .slice(0, 40)                    // keep it short
    .replace(/-$/, '');              // trim trailing hyphen
  return slug ? `feature/${ticketId}-${slug}` : `feature/${ticketId}`;
}
