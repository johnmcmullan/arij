'use strict';

const { execSync } = require('child_process');
const chalk = require('chalk');
const tokenStore = require('../lib/token-store');
const { isAdmin } = require('../lib/permissions');

/** Resolve the current user's email from git config, same convention as `tract log`. */
function currentUserEmail() {
  try {
    return execSync('git config user.email', { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function printToken(rawToken) {
  console.log(chalk.green('\n✓ Token created successfully\n'));
  console.log(chalk.gray('Token (save this securely, it will not be shown again):'));
  console.log(`  ${chalk.bold(rawToken)}\n`);
  console.log(chalk.gray('Add to your environment:'));
  console.log(`  export TRACT_API_TOKEN="${rawToken}"\n`);
}

function cmdCreate(options) {
  const email = currentUserEmail();
  if (!email) {
    console.error(chalk.red('❌ Could not determine your email from git config user.email'));
    process.exit(1);
  }
  if (!options.name) {
    console.error(chalk.red('❌ --name is required'));
    process.exit(1);
  }
  const ttlDays = options.ttl ? parseInt(options.ttl, 10) : 365;
  if (!Number.isInteger(ttlDays) || ttlDays <= 0) {
    console.error(chalk.red(`❌ Invalid --ttl: "${options.ttl}"`));
    process.exit(1);
  }

  const rawToken = tokenStore.createToken({ email, name: options.name, ttlDays });
  printToken(rawToken);
}

function cmdCreateService(options) {
  const requester = currentUserEmail();
  if (!requester || !isAdmin(requester)) {
    console.error(chalk.red('❌ create-service requires admin access'));
    process.exit(1);
  }
  if (!options.user) {
    console.error(chalk.red('❌ --user <email> is required'));
    process.exit(1);
  }
  if (!options.name) {
    console.error(chalk.red('❌ --name is required'));
    process.exit(1);
  }
  const ttlDays = options.ttl ? parseInt(options.ttl, 10) : 365;
  if (!Number.isInteger(ttlDays) || ttlDays <= 0) {
    console.error(chalk.red(`❌ Invalid --ttl: "${options.ttl}"`));
    process.exit(1);
  }

  const rawToken = tokenStore.createToken({ email: options.user, name: options.name, ttlDays });
  console.log(chalk.gray(`Service account token for ${options.user}:`));
  printToken(rawToken);
}

function cmdList(options) {
  const email = currentUserEmail();
  if (!email) {
    console.error(chalk.red('❌ Could not determine your email from git config user.email'));
    process.exit(1);
  }

  const showAll = !!options.all;
  if (showAll && !isAdmin(email)) {
    console.error(chalk.red('❌ --all requires admin access'));
    process.exit(1);
  }

  const records = tokenStore.listTokens(showAll ? null : email);
  if (records.length === 0) {
    console.log(chalk.gray('No tokens found.'));
    return;
  }

  console.log(chalk.bold(`\n${records.length} token(s):\n`));
  for (const r of records) {
    const expired = r.expires && new Date(r.expires).getTime() < Date.now();
    const status = expired ? chalk.red('expired') : chalk.green('active');
    console.log(`  ${chalk.bold(r.name)} ${status}`);
    if (showAll) console.log(`    owner:      ${r.email}`);
    console.log(`    created:    ${r.created}`);
    console.log(`    expires:    ${r.expires}`);
    console.log(`    last used:  ${r.lastUsed || 'never'}`);
    console.log('');
  }
}

function cmdRevoke(tokenOrName) {
  const email = currentUserEmail();
  if (!email) {
    console.error(chalk.red('❌ Could not determine your email from git config user.email'));
    process.exit(1);
  }
  if (!tokenOrName) {
    console.error(chalk.red('❌ Usage: tract token revoke <token-or-name>'));
    process.exit(1);
  }

  const revoked = tokenStore.revokeToken(tokenOrName, email);
  if (revoked) {
    console.log(chalk.green(`✓ Revoked ${tokenOrName}`));
  } else {
    console.error(chalk.red(`❌ No token found matching "${tokenOrName}" for ${email}`));
    process.exit(1);
  }
}

module.exports = function token(subcommand, arg, options) {
  switch (subcommand) {
    case 'create':
      return cmdCreate(options);
    case 'create-service':
      return cmdCreateService(options);
    case 'list':
      return cmdList(options);
    case 'revoke':
      return cmdRevoke(arg);
    default:
      console.error(chalk.red(`❌ Unknown subcommand: "${subcommand || ''}"`));
      console.error(chalk.gray('   Usage: tract token <create|create-service|list|revoke> [options]'));
      process.exit(1);
  }
};
