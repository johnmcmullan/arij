'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const yaml = require('js-yaml');

const TRACT_DIR = path.join(process.env.HOME, '.tract');
const GLOBAL_CONFIG = path.join(TRACT_DIR, 'config.yaml');

function readGlobalConfig() {
  if (!fs.existsSync(GLOBAL_CONFIG)) return {};
  try {
    return yaml.load(fs.readFileSync(GLOBAL_CONFIG, 'utf8')) || {};
  } catch (err) {
    return {};
  }
}

function writeGlobalConfig(config) {
  fs.mkdirSync(TRACT_DIR, { recursive: true });
  fs.writeFileSync(GLOBAL_CONFIG, yaml.dump(config), 'utf8');
}

function fetchCatalog(serverUrl) {
  return new Promise((resolve, reject) => {
    const url = `${serverUrl}/catalog`;
    const mod = url.startsWith('https://') ? https : http;
    mod.get(url, { timeout: 10000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Server returned ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(yaml.load(body));
        } catch (err) {
          reject(new Error(`Failed to parse catalog YAML: ${err.message}`));
        }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('Request timed out')));
  });
}

// tract catalog set <url>
async function cmdSet(url) {
  // Normalise: strip trailing slash
  const serverUrl = url.replace(/\/$/, '');

  const config = readGlobalConfig();
  config.catalog_server = serverUrl;
  writeGlobalConfig(config);

  console.log(`✓ Catalog server set to: ${serverUrl}`);
  console.log(`  Saved to: ${GLOBAL_CONFIG}`);
}

// tract catalog list
async function cmdList() {
  const config = readGlobalConfig();
  const serverUrl = config.catalog_server;
  if (!serverUrl) {
    console.error('No catalog server configured. Run: tract catalog set <url>');
    process.exit(1);
  }

  console.log(`Fetching catalog from ${serverUrl}/catalog ...`);
  let catalog;
  try {
    catalog = await fetchCatalog(serverUrl);
  } catch (err) {
    console.error(`Failed to fetch catalog: ${err.message}`);
    process.exit(1);
  }

  const projects = catalog.projects || [];
  if (projects.length === 0) {
    console.log('No projects found in catalog.');
    return;
  }

  console.log(`\nProjects in ${catalog.workspace?.name || 'workspace'}:\n`);
  for (const p of projects) {
    const deps = p.depends_on && p.depends_on.length > 0
      ? `  [depends on: ${p.depends_on.join(', ')}]`
      : '';
    console.log(`  ${p.prefix.padEnd(14)} ${(p.description || p.name).padEnd(40)}${deps}`);
  }
  console.log(`\nClone a project:  tract clone <PREFIX>`);
}

// Entry point — dispatches subcommands
module.exports = async function catalog(subcommand, arg, options) {
  if (subcommand === 'set') {
    if (!arg) {
      console.error('Usage: tract catalog set <url>');
      process.exit(1);
    }
    await cmdSet(arg);
  } else if (subcommand === 'list' || !subcommand) {
    await cmdList();
  } else {
    console.error(`Unknown catalog subcommand: ${subcommand}`);
    console.error('Available subcommands: set, list');
    process.exit(1);
  }
};

module.exports.readGlobalConfig = readGlobalConfig;
module.exports.fetchCatalog = fetchCatalog;
