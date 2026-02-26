#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const { exec } = require('child_process');

const CATALOG_PATH        = process.env.CATALOG_PATH        || '/opt/tract/catalog.yaml';
const CLI_TGZ_PATH        = process.env.CLI_TGZ_PATH        || '/opt/tract/tract-cli-latest.tgz';
const CLI_PKG_PATH        = process.env.CLI_PKG_PATH        || '/opt/tract/tract-cli/package.json';
const SSH_KNOWN_HOSTS_PATH = process.env.SSH_KNOWN_HOSTS_PATH || '/opt/tract/known-hosts';
const UPDATE_SCRIPT       = process.env.UPDATE_SCRIPT       || path.join(__dirname, 'update-server');
const WEBHOOK_SECRET      = process.env.WEBHOOK_SECRET      || '';  // disabled if empty
const TEMPLATE_PATH       = path.join(__dirname, 'install.sh.template');
const PORT                = process.env.PORT || 8080;

function serve404(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  const webhook = WEBHOOK_SECRET ? '  POST /update' : '';
  res.end(`Not found. Available endpoints: /catalog  /install.sh  /version  /tract-cli.tgz  /known-hosts${webhook}\n`);
}

http.createServer((req, res) => {

  if (req.url === '/catalog') {
    let catalog;
    try {
      catalog = fs.readFileSync(CATALOG_PATH, 'utf8');
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error reading catalog: ${err.message}\nCATALOG_PATH=${CATALOG_PATH}`);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/yaml' });
    res.end(catalog);

  } else if (req.url === '/install.sh') {
    let template;
    try {
      template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error reading install template: ${err.message}`);
      return;
    }
    const serverUrl = `http://${req.headers.host}`;
    const script = template.replace(/__TRACT_SERVER__/g, serverUrl);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(script);

  } else if (req.url === '/version') {
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(CLI_PKG_PATH, 'utf8'));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error reading CLI version: ${err.message}\nCLI_PKG_PATH=${CLI_PKG_PATH}`);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ version: pkg.version }));

  } else if (req.url === '/tract-cli.tgz') {
    let stat;
    try {
      stat = fs.statSync(CLI_TGZ_PATH);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`CLI package not found at ${CLI_TGZ_PATH}\nRun: npm pack in tract-cli/ and copy the .tgz here.`);
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'application/gzip',
      'Content-Length': stat.size,
    });
    fs.createReadStream(CLI_TGZ_PATH).pipe(res);

  } else if (req.url === '/known-hosts') {
    // Serves pre-generated SSH known_hosts entries for all git servers referenced
    // in the catalog. Clients add these to ~/.ssh/known_hosts so `git clone` doesn't
    // prompt about host authenticity. 404 if the file hasn't been set up yet.
    if (!fs.existsSync(SSH_KNOWN_HOSTS_PATH)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`SSH known-hosts file not found at ${SSH_KNOWN_HOSTS_PATH}\nAdmin: run ssh-keyscan for your git servers and save output there.\n`);
      return;
    }
    const knownHosts = fs.readFileSync(SSH_KNOWN_HOSTS_PATH, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(knownHosts);

  } else if (req.method === 'POST' && req.url === '/update') {
    // Webhook endpoint — triggered by GitHub/GitLab push events or manually.
    // Disabled (404) unless WEBHOOK_SECRET is set in the environment.
    if (!WEBHOOK_SECRET) {
      serve404(res);
      return;
    }
    if (req.headers['x-webhook-token'] !== WEBHOOK_SECRET) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }
    // Acknowledge immediately — the update runs in the background
    res.writeHead(202, { 'Content-Type': 'text/plain' });
    res.end('Update triggered\n');

    console.log(`[webhook] Update triggered by POST /update`);
    exec(UPDATE_SCRIPT, { env: process.env }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[webhook] Update failed: ${err.message}`);
        if (stderr) console.error(stderr.trim());
      } else {
        if (stdout) console.log(stdout.trim());
        console.log(`[webhook] Update complete`);
      }
    });

  } else {
    serve404(res);
  }

}).listen(PORT, () => {
  console.log(`tract-catalog listening on :${PORT}`);
  console.log(`  Catalog:          ${CATALOG_PATH}`);
  console.log(`  CLI package:      ${CLI_TGZ_PATH}`);
  console.log(`  CLI version file: ${CLI_PKG_PATH}`);
  console.log(`  SSH known-hosts:  ${fs.existsSync(SSH_KNOWN_HOSTS_PATH) ? SSH_KNOWN_HOSTS_PATH : `${SSH_KNOWN_HOSTS_PATH} (not found — /known-hosts will 404)`}`);
  console.log(`  Webhook:          ${WEBHOOK_SECRET ? 'enabled (POST /update)' : 'disabled (set WEBHOOK_SECRET to enable)'}`);
});
