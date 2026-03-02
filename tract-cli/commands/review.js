'use strict';

// review.js — Tract Review commands: open, approve, status, check
//
// Usage:
//   tract review open TB-1234        Move ticket to in-review, open Forgejo PR
//   tract review approve TB-1234     Record human approval on ticket
//   tract review status TB-1234      Show current approval state
//   tract review check TB-1234 <sha> Validate policy (used by pre-receive hook)

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const https = require('https');
const http  = require('http');
const { execFileSync } = require('child_process');

// ── Forgejo config ─────────────────────────────────────────────────────────────
// Reads ~/.tract/forgejo.yaml: { url, token, user }

function loadForgejoConfig() {
  const cfgPath = path.join(process.env.HOME, '.tract', 'forgejo.yaml');
  if (!fs.existsSync(cfgPath)) return null;
  return yaml.load(fs.readFileSync(cfgPath, 'utf8'));
}

function forgejoRequest(cfg, method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const base = new URL(cfg.url);
    const isHttps = base.protocol === 'https:';
    const options = {
      hostname: base.hostname,
      port: base.port || (isHttps ? 443 : 80),
      path: `/api/v1${apiPath}`,
      method,
      headers: {
        'Authorization': `token ${cfg.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };
    const req = (isHttps ? https : http).request(options, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Ticket helpers ─────────────────────────────────────────────────────────────

function findTicketFile(ticketId) {
  const flat = path.join('tickets', `${ticketId}.md`);
  if (fs.existsSync(flat)) return flat;
  const num = ticketId.match(/-(\d+)$/)?.[1] || '';
  if (num) {
    const sharded = path.join('tickets', num[num.length - 1], `${ticketId}.md`);
    if (fs.existsSync(sharded)) return sharded;
  }
  if (fs.existsSync('tickets')) {
    for (const entry of fs.readdirSync('tickets')) {
      const candidate = path.join('tickets', entry, `${ticketId}.md`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function parseTicket(ticketFile) {
  const raw = fs.readFileSync(ticketFile, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`Cannot parse frontmatter in ${ticketFile}`);
  return { frontmatter: yaml.load(match[1]), body: match[2] };
}

function writeTicket(ticketFile, frontmatter, body) {
  const fm = yaml.dump(frontmatter, { lineWidth: -1, quotingType: '"' });
  fs.writeFileSync(ticketFile, `---\n${fm}---\n${body}`);
}

function gitUser() {
  try { return execFileSync('git', ['config', 'user.name'], { stdio: 'pipe' }).toString().trim(); }
  catch { return process.env.USER || 'unknown'; }
}

function now() { return new Date().toISOString(); }

// ── tract review open ──────────────────────────────────────────────────────────

async function open(ticketId, options) {
  const ticketFile = findTicketFile(ticketId);
  if (!ticketFile) {
    console.error(chalk.red(`❌ Ticket ${ticketId} not found`));
    process.exit(1);
  }

  const { frontmatter, body } = parseTicket(ticketFile);

  const branch = frontmatter.branch || (frontmatter.branches && frontmatter.branches[0]);
  if (!branch) {
    console.error(chalk.red(`❌ No branch set on ${ticketId}`));
    console.error(chalk.gray(`   Run: tract branch ${ticketId}`));
    process.exit(1);
  }

  if (frontmatter.status === 'in-review' && !options.force) {
    console.error(chalk.yellow(`⚠️  ${ticketId} is already in-review`));
    console.error(chalk.gray('   Use --force to re-open'));
    process.exit(1);
  }

  const base = options.base || 'main';
  const opener = gitUser();

  // ── Update frontmatter ────────────────────────────────────────────────────
  frontmatter.status = 'in-review';
  frontmatter.review = {
    base,
    opened: now(),
    opened_by: opener,
    policy: options.policy || 'agent-only',
    approvals: [],
  };

  // ── Ensure ## Review section exists ──────────────────────────────────────
  let newBody = body;
  if (!/^## Review/m.test(body)) {
    newBody = body.trimEnd() + '\n\n## Review\n\n';
  }

  writeTicket(ticketFile, frontmatter, newBody);

  // ── Commit ticket change ──────────────────────────────────────────────────
  try {
    execFileSync('git', ['add', ticketFile], { stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', `${ticketId}: open review on ${branch}`], { stdio: 'pipe' });
  } catch (err) {
    console.warn(chalk.yellow('⚠️  Ticket updated but commit failed — commit manually'));
  }

  console.log(chalk.cyan(`\n🔍 Opening review for ${ticketId}`));
  console.log(chalk.gray(`   Branch: ${branch} → ${base}`));
  console.log(chalk.gray(`   Policy: ${frontmatter.review.policy}`));

  // ── Open Forgejo PR ───────────────────────────────────────────────────────
  const cfg = loadForgejoConfig();
  if (!cfg) {
    console.log(chalk.yellow('\n⚠️  No Forgejo config at ~/.tract/forgejo.yaml — skipping PR'));
    console.log(chalk.green(`\n✅ Ticket updated to in-review`));
    return;
  }

  // Detect repo from git remote
  let repoPath = options.repo;
  if (!repoPath) {
    try {
      const remote = execFileSync('git', ['remote', 'get-url', 'forgejo'], { stdio: 'pipe' })
        .toString().trim();
      // e.g. http://user:token@host:3000/owner/repo.git
      const m = remote.match(/\/([^/]+\/[^/]+?)(?:\.git)?$/);
      if (m) repoPath = m[1];
    } catch {
      // try origin
      try {
        const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { stdio: 'pipe' })
          .toString().trim();
        const m = remote.match(/\/([^/]+\/[^/]+?)(?:\.git)?$/);
        if (m) repoPath = m[1];
      } catch { /* ignore */ }
    }
  }

  if (!repoPath) {
    console.log(chalk.yellow('\n⚠️  Could not detect Forgejo repo — run from inside the code repo'));
    console.log(chalk.gray('   Or specify with: tract review open --repo owner/reponame'));
    console.log(chalk.green(`\n✅ Ticket updated to in-review`));
    return;
  }

  const title = `${ticketId}: ${frontmatter.title || branch}`;
  const prBody = `Ticket: ${ticketId}\nBranch: \`${branch}\`\n\nOpened via \`tract review open\`.`;

  const res = await forgejoRequest(cfg, 'POST', `/repos/${repoPath}/pulls`, {
    title,
    body: prBody,
    head: branch,
    base,
  });

  if (res.status === 201) {
    const pr = res.body;
    // Record PR URL back in ticket
    frontmatter.review.pr_url = pr.html_url;
    frontmatter.review.pr_number = pr.number;
    const { body: currentBody } = parseTicket(ticketFile);
    writeTicket(ticketFile, frontmatter, currentBody);
    execFileSync('git', ['add', ticketFile], { stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', `${ticketId}: record PR #${pr.number}`], { stdio: 'pipe' });
    console.log(chalk.green(`\n✅ PR opened: ${pr.html_url}`));
  } else if (res.status === 422 && JSON.stringify(res.body).includes('already exists')) {
    console.log(chalk.yellow('\n⚠️  PR already exists for this branch'));
    console.log(chalk.green(`\n✅ Ticket updated to in-review`));
  } else {
    console.log(chalk.yellow(`\n⚠️  Forgejo PR failed (${res.status}): ${JSON.stringify(res.body)}`));
    console.log(chalk.green(`\n✅ Ticket updated to in-review`));
  }
}

// ── tract review approve ───────────────────────────────────────────────────────

async function approve(ticketId, options) {
  const ticketFile = findTicketFile(ticketId);
  if (!ticketFile) {
    console.error(chalk.red(`❌ Ticket ${ticketId} not found`));
    process.exit(1);
  }

  const { frontmatter, body } = parseTicket(ticketFile);

  if (!frontmatter.review) {
    console.error(chalk.red(`❌ ${ticketId} has no review block — run tract review open first`));
    process.exit(1);
  }

  const reviewer = gitUser();
  const entry = {
    reviewer,
    type: 'human',
    approved: true,
    at: now(),
  };
  if (options.comment) entry.summary = options.comment;

  frontmatter.review.approvals = frontmatter.review.approvals || [];
  frontmatter.review.approvals.push(entry);

  // Append to ## Review section in body
  const commentBlock = `\n### ${reviewer} — ${entry.at.slice(0, 10)}\n\n${options.comment || 'Approved.'}\n`;
  let newBody = body;
  if (/^## Review/m.test(body)) {
    newBody = body.trimEnd() + '\n' + commentBlock;
  } else {
    newBody = body.trimEnd() + '\n\n## Review\n' + commentBlock;
  }

  writeTicket(ticketFile, frontmatter, newBody);

  try {
    execFileSync('git', ['add', ticketFile], { stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', `${ticketId}: ${reviewer} approved`], { stdio: 'pipe' });
  } catch {
    console.warn(chalk.yellow('⚠️  Approval recorded but commit failed'));
  }

  console.log(chalk.green(`\n✅ Approval recorded for ${ticketId}`));
  console.log(chalk.gray(`   Reviewer: ${reviewer} (human)`));
  printPolicyStatus(ticketId, frontmatter);
}

// ── tract review status ────────────────────────────────────────────────────────

function status(ticketId) {
  const ticketFile = findTicketFile(ticketId);
  if (!ticketFile) {
    console.error(chalk.red(`❌ Ticket ${ticketId} not found`));
    process.exit(1);
  }

  const { frontmatter } = parseTicket(ticketFile);

  if (!frontmatter.review) {
    console.log(chalk.gray(`${ticketId}: no review open`));
    return;
  }

  const r = frontmatter.review;
  console.log(chalk.cyan(`\n📋 Review status for ${ticketId}`));
  console.log(chalk.gray(`   Status:  ${frontmatter.status}`));
  console.log(chalk.gray(`   Branch:  ${frontmatter.branch || frontmatter.branches?.[0] || 'unknown'}`));
  console.log(chalk.gray(`   Policy:  ${r.policy}`));
  console.log(chalk.gray(`   Opened:  ${r.opened} by ${r.opened_by}`));
  if (r.pr_url) console.log(chalk.gray(`   PR:      ${r.pr_url}`));

  const approvals = r.approvals || [];
  if (approvals.length === 0) {
    console.log(chalk.yellow(`\n   No approvals yet`));
  } else {
    console.log(chalk.gray(`\n   Approvals (${approvals.length}):`));
    for (const a of approvals) {
      const icon = a.approved ? '✅' : '❌';
      const conf = a.confidence != null ? ` (confidence: ${a.confidence})` : '';
      console.log(`     ${icon} ${a.reviewer} [${a.type}]${conf} — ${a.at.slice(0, 16)}`);
    }
  }

  printPolicyStatus(ticketId, frontmatter);
}

// ── tract review check (pre-receive hook) ─────────────────────────────────────

function check(ticketId) {
  const ticketFile = findTicketFile(ticketId);
  if (!ticketFile) {
    // No ticket found — allow (not all branches have tickets)
    process.exit(0);
  }

  const { frontmatter } = parseTicket(ticketFile);

  if (!frontmatter.review) {
    console.error(`TRACT: ${ticketId} has no review block — run tract review open`);
    process.exit(1);
  }

  const policy = frontmatter.review.policy || '1-human';
  const approvals = (frontmatter.review.approvals || []).filter(a => a.approved);
  const humanApprovals = approvals.filter(a => a.type === 'human').length;
  const anyApprovals = approvals.length;

  let ok = false;
  let reason = '';

  if (policy === 'none') {
    ok = true;
    console.error(`TRACT: ${ticketId} policy=none — merge allowed (logged)`);
  } else if (policy === 'agent-only') {
    ok = anyApprovals >= 1;
    reason = `requires ≥1 approval of any type, have ${anyApprovals}`;
  } else if (policy === '1-human') {
    ok = humanApprovals >= 1;
    reason = `requires ≥1 human approval, have ${humanApprovals}`;
  } else if (policy === '2-human') {
    ok = humanApprovals >= 2;
    reason = `requires ≥2 human approvals, have ${humanApprovals}`;
  }

  // Warn on low-confidence agent approvals
  for (const a of approvals) {
    if (a.type === 'agent' && a.confidence != null && a.confidence < 0.6) {
      console.error(`TRACT: warning — ${a.reviewer} confidence ${a.confidence} is low`);
    }
  }

  if (ok) {
    console.error(`TRACT: ${ticketId} policy=${policy} satisfied — merge allowed`);
    process.exit(0);
  } else {
    console.error(`TRACT: ${ticketId} policy=${policy} NOT satisfied — ${reason}`);
    process.exit(1);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function printPolicyStatus(ticketId, frontmatter) {
  const policy = frontmatter.review?.policy || '1-human';
  const approvals = (frontmatter.review?.approvals || []).filter(a => a.approved);
  const humanCount = approvals.filter(a => a.type === 'human').length;
  const anyCount = approvals.length;

  let satisfied = false;
  if (policy === 'none') satisfied = true;
  else if (policy === 'agent-only') satisfied = anyCount >= 1;
  else if (policy === '1-human') satisfied = humanCount >= 1;
  else if (policy === '2-human') satisfied = humanCount >= 2;

  const icon = satisfied ? chalk.green('✅') : chalk.yellow('⏳');
  console.log(`\n   ${icon} Policy ${policy}: ${satisfied ? 'satisfied — ready to merge' : 'not yet satisfied'}`);
  if (satisfied) {
    console.log(chalk.gray(`\n   tract merge ${ticketId}`));
  }
}

// ── Entry point ────────────────────────────────────────────────────────────────

module.exports = async function review(subcommand, ticketId, options) {
  switch (subcommand) {
    case 'open':    return open(ticketId, options);
    case 'approve': return approve(ticketId, options);
    case 'status':  return status(ticketId);
    case 'check':   return check(ticketId);
    default:
      console.error(chalk.red(`❌ Unknown review subcommand: ${subcommand}`));
      console.error(chalk.gray('   Usage: tract review <open|approve|status|check> <ticket>'));
      process.exit(1);
  }
};
