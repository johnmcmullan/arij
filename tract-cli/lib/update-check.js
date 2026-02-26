'use strict';

/**
 * Background update checker — runs detached so it never blocks a command.
 *
 * Two modes depending on how this file is invoked:
 *   1. require('./update-check').trigger() — called from bin/tract.js on every run.
 *      Prints any pending notice, then spawns a detached worker if the interval has elapsed.
 *   2. node update-check.js --worker — the detached worker itself.
 *      Fetches /version, writes or clears the notice file, then exits.
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

const TRACT_DIR      = path.join(process.env.HOME, '.tract');
const TIMESTAMP_FILE = path.join(TRACT_DIR, '.last-update-check');
const NOTICE_FILE    = path.join(TRACT_DIR, '.update-available');
const CHECK_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8 hours — ~twice a day

// ─── Public API ──────────────────────────────────────────────────────────────

function trigger() {
  // Print any notice from a previous background check (stderr so piped commands aren't polluted)
  if (process.stderr.isTTY && fs.existsSync(NOTICE_FILE)) {
    try {
      const notice = fs.readFileSync(NOTICE_FILE, 'utf8').trim();
      if (notice) process.stderr.write(`\n${notice}\n\n`);
    } catch { /* ignore */ }
  }

  if (!isDue()) return;

  // Write timestamp immediately — prevents parallel invocations all spawning workers
  touchTimestamp();

  // Spawn detached worker; unref() so the parent process can exit normally
  const worker = spawn(process.execPath, [__filename, '--worker'], {
    detached: true,
    stdio: 'ignore',
    env: process.env,
  });
  worker.unref();
}

// Called by update.js after a successful manual update — clears the notice
function clearNotice() {
  try { fs.unlinkSync(NOTICE_FILE); } catch { /* already gone */ }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isDue() {
  try {
    const ts = new Date(fs.readFileSync(TIMESTAMP_FILE, 'utf8').trim());
    return (Date.now() - ts.getTime()) >= CHECK_INTERVAL_MS;
  } catch {
    return true; // First run
  }
}

function touchTimestamp() {
  try {
    fs.mkdirSync(TRACT_DIR, { recursive: true });
    fs.writeFileSync(TIMESTAMP_FILE, new Date().toISOString());
  } catch { /* ignore */ }
}

function readGlobalConfig() {
  try {
    const yaml = require('js-yaml');
    const cfgPath = path.join(TRACT_DIR, 'config.yaml');
    return yaml.load(fs.readFileSync(cfgPath, 'utf8')) || {};
  } catch {
    return {};
  }
}

function fetchVersion(serverUrl) {
  return new Promise((resolve, reject) => {
    const url = `${serverUrl}/version`;
    const mod = url.startsWith('https://') ? https : http;
    const req = mod.get(url, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body).version); }
        catch { reject(new Error('Bad response')); }
      });
    });
    req.setTimeout(6000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

// ─── Worker mode ─────────────────────────────────────────────────────────────

async function runWorker() {
  const config = readGlobalConfig();
  const serverUrl = config.catalog_server;
  if (!serverUrl) return; // Not configured — nothing to check

  let latest;
  try {
    latest = await fetchVersion(serverUrl);
  } catch {
    return; // Server unreachable — silent, try again next interval
  }

  const current = require('../package.json').version;
  fs.mkdirSync(TRACT_DIR, { recursive: true });

  if (latest !== current) {
    fs.writeFileSync(
      NOTICE_FILE,
      `💡 tract v${latest} is available (you have v${current}). Run: tract update`,
    );
  } else {
    // Up to date — clear any stale notice
    clearNotice();
  }
}

if (process.argv[2] === '--worker') {
  runWorker().catch(() => {}); // Worker must never crash noisily
} else {
  module.exports = { trigger, clearNotice };
}
