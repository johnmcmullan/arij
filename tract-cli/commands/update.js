'use strict';

const { execSync } = require('child_process');
const https = require('https');
const http = require('http');
const path = require('path');
const chalk = require('chalk');
const packageJson = require('../package.json');
const { readGlobalConfig } = require('./catalog');
const { clearNotice } = require('../lib/update-check');

function fetchVersion(serverUrl) {
  return new Promise((resolve, reject) => {
    const url = `${serverUrl}/version`;
    const mod = url.startsWith('https://') ? https : http;
    mod.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body).version);
        } catch {
          reject(new Error(`Unexpected response from ${url}: ${body.slice(0, 80)}`));
        }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('Request timed out')));
  });
}

function isGitCheckout() {
  // True if the CLI itself is running from a git repo (i.e. npm link / dev install)
  const cliDir = path.join(__dirname, '..', '..');
  return require('fs').existsSync(path.join(cliDir, '.git'));
}

function gitUpdate() {
  const cliDir = path.resolve(__dirname, '..', '..');
  console.log(`tract is running from a git checkout — pulling latest from origin.`);
  console.log(chalk.gray(`  ${cliDir}\n`));
  try {
    execSync('git pull --ff-only', { cwd: cliDir, stdio: 'inherit' });
    console.log('\n✓ Up to date');
  } catch (err) {
    console.error('\n✗ git pull failed — resolve any conflicts manually.');
    process.exit(1);
  }
}

module.exports = async function update() {
  const current = packageJson.version;
  const config = readGlobalConfig();
  const serverUrl = config.catalog_server;

  // Dev install: just git pull
  if (!serverUrl) {
    if (isGitCheckout()) {
      gitUpdate();
      return;
    }
    console.error('No catalog server configured — cannot check for updates.');
    console.error('Run: tract catalog set <url>');
    process.exit(1);
  }

  // Check latest version on the server
  let latest;
  try {
    process.stdout.write(`Checking for updates at ${serverUrl}/version ... `);
    latest = await fetchVersion(serverUrl);
    console.log(latest);
  } catch (err) {
    console.log('failed');
    console.error(`Could not reach server: ${err.message}`);
    process.exit(1);
  }

  if (latest === current) {
    console.log(`✓ Already up to date (v${current})`);
    return;
  }

  console.log(`Updating tract CLI: v${current} → v${latest}`);
  const tgzUrl = `${serverUrl}/tract-cli.tgz`;
  try {
    execSync(`npm install -g "${tgzUrl}"`, { stdio: 'inherit' });
    clearNotice();
    console.log('\n✓ Update complete');
  } catch (err) {
    console.error('✗ Update failed:', err.message);
    process.exit(1);
  }
};
