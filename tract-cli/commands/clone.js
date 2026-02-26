'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const yaml = require('js-yaml');
const { readGlobalConfig, fetchCatalog } = require('./catalog');

const TRACT_DIR = path.join(process.env.HOME, '.tract');

// Detect bare git URLs: user@host:/path, ssh://, https://, http://, git://, file://
function looksLikeGitUrl(s) {
  return /[@].*:/.test(s) || /^(ssh|https?|file|git):\/\//.test(s);
}

// Infer a project prefix (UPPER) from the last component of a git URL path.
// tract@reek:/opt/tract/APP → APP
function inferPrefixFromUrl(url) {
  const last = url.replace(/\/$/, '').split(/[:/]/).pop();
  return last ? last.toUpperCase() : 'PROJECT';
}

// Clone a project directly from a git URL into ~/.tract/<PREFIX>.
// No registration file needed — 'tract pull' auto-discovers git repos there.
async function cloneFromUrl(repoUrl, options) {
  const dryRun = options.dryRun || false;
  const prefix = inferPrefixFromUrl(repoUrl);

  const destDir = options.dest
    ? path.resolve(options.dest)
    : path.join(TRACT_DIR, prefix);

  const relDest = '~/' + path.relative(process.env.HOME, destDir).replace(/\\/g, '/');

  console.log(`\n  Cloning ${prefix} → ${relDest}\n`);

  if (dryRun) {
    console.log(`[dry-run] Would clone ${repoUrl} → ${destDir}`);
    return;
  }

  if (isGitRepo(destDir)) {
    console.log(`  (skipped — already cloned at ${relDest})`);
  } else {
    try {
      fs.mkdirSync(path.dirname(destDir), { recursive: true });
      execSync(`git clone ${repoUrl} ${destDir}`, { stdio: 'inherit' });
    } catch (err) {
      console.error(`  ✗ Failed to clone: ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`\n  ✓ Cloned to ${relDest}`);
  console.log(`  Run 'tract pull' at any time to keep it up to date.\n`);
}

// Fetch /known-hosts from the catalog server and add any new entries to
// ~/.ssh/known_hosts. Silent if the endpoint is not configured (404).
async function ensureKnownHosts(serverUrl) {
  return new Promise((resolve) => {
    const url = `${serverUrl}/known-hosts`;
    const mod = url.startsWith('https://') ? https : http;
    mod.get(url, { timeout: 6000 }, (res) => {
      if (res.statusCode !== 200) { resolve(); return; }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        const knownHostsPath = path.join(process.env.HOME, '.ssh', 'known_hosts');
        fs.mkdirSync(path.join(process.env.HOME, '.ssh'), { recursive: true });
        const existing = fs.existsSync(knownHostsPath)
          ? fs.readFileSync(knownHostsPath, 'utf8') : '';
        let added = 0;
        for (const line of body.split('\n')) {
          if (!line || line.startsWith('#')) continue;
          if (!existing.includes(line)) {
            fs.appendFileSync(knownHostsPath, line + '\n');
            added++;
          }
        }
        if (added > 0) console.log(`  (added ${added} SSH host key(s) to ~/.ssh/known_hosts)`);
        resolve();
      });
    }).on('error', resolve).on('timeout', resolve);
  });
}

// Recursively resolve a project prefix → flat unique ordered list of prefixes to clone.
// The requested project is always last (dependencies first).
function resolveDeps(prefix, projects, visited = new Set(), order = []) {
  if (visited.has(prefix)) return order;
  visited.add(prefix);

  const project = projects.find((p) => p.prefix === prefix);
  if (!project) {
    console.error(`✗ Project "${prefix}" not found in catalog.`);
    process.exit(1);
  }

  for (const dep of project.depends_on || []) {
    resolveDeps(dep, projects, visited, order);
  }
  order.push(prefix);
  return order;
}

// Read or create workspace.yaml.
// When workspaceRoot is ~/.tract itself, write to ~/.tract/workspace.yaml
// directly rather than the awkward ~/.tract/.tract/workspace.yaml.
function updateWorkspaceYaml(workspaceRoot, projectEntries) {
  const TRACT_DIR = path.join(process.env.HOME, '.tract');
  const isTractDir = path.resolve(workspaceRoot) === path.resolve(TRACT_DIR);
  const wsDir  = isTractDir ? workspaceRoot : path.join(workspaceRoot, '.tract');
  const wsFile = path.join(wsDir, 'workspace.yaml');

  let ws = {};
  if (fs.existsSync(wsFile)) {
    try {
      ws = yaml.load(fs.readFileSync(wsFile, 'utf8')) || {};
    } catch (err) {
      // If corrupt, start fresh
    }
  }

  ws.workspace = ws.workspace || {};
  ws.projects = ws.projects || [];
  for (const entry of projectEntries) {
    const existing = ws.projects.find((p) => p.prefix === entry.prefix);
    if (!existing) {
      ws.projects.push(entry);
    }
  }

  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(wsFile, yaml.dump(ws), 'utf8');
  return wsFile;
}

function isGitRepo(dir) {
  try {
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

module.exports = async function clone(projectPrefix, options) {
  // Direct git URL (e.g. tract@reek:/opt/tract/APP) — no catalog needed.
  if (looksLikeGitUrl(projectPrefix)) {
    return cloneFromUrl(projectPrefix, options);
  }

  const dryRun = options.dryRun || false;
  const workDir = options.dest ? path.resolve(options.dest) : path.join(process.env.HOME, 'work');

  // 1. Read catalog server URL — fall back to direct SSH clone if --server given
  const globalConfig = readGlobalConfig();
  const serverUrl = globalConfig.catalog_server;
  if (!serverUrl) {
    const sshHost = options.server;
    if (sshHost) {
      // Construct tract@<host>:/opt/tract/<PREFIX> and clone directly
      const repoUrl = `tract@${sshHost}:/opt/tract/${projectPrefix.toUpperCase()}`;
      const destDir = options.dest
        ? path.resolve(options.dest)
        : path.join(TRACT_DIR, projectPrefix.toUpperCase());
      const relDest = '~/' + path.relative(process.env.HOME, destDir).replace(/\\/g, '/');
      console.log(`\n  Cloning ${projectPrefix.toUpperCase()} → ${relDest}\n`);
      if (!dryRun) {
        if (isGitRepo(destDir)) {
          console.log(`  (skipped — already cloned at ${relDest})`);
        } else {
          fs.mkdirSync(path.dirname(destDir), { recursive: true });
          execSync(`git clone ${repoUrl} ${destDir}`, { stdio: 'inherit' });
        }
        const wsFile = updateWorkspaceYaml(TRACT_DIR, [{
          name: projectPrefix.toUpperCase(),
          prefix: projectPrefix.toUpperCase(),
          path: destDir,
          sync_server: sshHost,
        }]);
        const relWs = '~/' + path.relative(process.env.HOME, wsFile).replace(/\\/g, '/');
        console.log(`\n  ✓ Cloned to ${relDest}`);
        console.log(`  ✓ Updated ${relWs}`);
        console.log(`  Run 'tract pull' at any time to keep it up to date.\n`);
      }
      return;
    }
    console.error('No catalog server configured.');
    console.error('  Clone directly:  tract clone APP --server reek');
    console.error('  Or set catalog:  tract catalog set <url>');
    process.exit(1);
  }

  console.log(`✓ Fetching catalog from ${serverUrl}/catalog`);
  await ensureKnownHosts(serverUrl);
  let catalog;
  try {
    catalog = await fetchCatalog(serverUrl);
  } catch (err) {
    console.error(`Failed to fetch catalog: ${err.message}`);
    process.exit(1);
  }

  const projects = catalog.projects || [];
  if (projects.length === 0) {
    console.error('Catalog is empty — no projects defined.');
    process.exit(1);
  }

  // 2. Resolve the prefix to clone (case-insensitive)
  const normalised = projectPrefix.toUpperCase();
  const rootProject = projects.find((p) => p.prefix.toUpperCase() === normalised);
  if (!rootProject) {
    const available = projects.map((p) => p.prefix).join(', ');
    console.error(`Project "${projectPrefix}" not found in catalog.`);
    console.error(`Available: ${available}`);
    process.exit(1);
  }

  const resolvedPrefixes = resolveDeps(rootProject.prefix, projects);

  const deps = resolvedPrefixes.filter((p) => p !== rootProject.prefix);
  if (deps.length > 0) {
    console.log(`✓ Resolving: ${rootProject.prefix} → ${deps.join(', ')}`);
  }
  console.log();

  if (dryRun) {
    console.log('[dry-run] Would clone:');
  } else {
    console.log('Cloning:');
  }

  const clonedEntries = [];

  for (const prefix of resolvedPrefixes) {
    const project = projects.find((p) => p.prefix === prefix);
    const destDir = path.join(workDir, project.name);
    const relDest = path.relative(process.env.HOME, destDir).replace(/\\/g, '/');

    if (isGitRepo(destDir)) {
      console.log(`  ${project.name.padEnd(20)} → ~/${relDest.padEnd(30)} (skipped — already cloned)`);
    } else if (dryRun) {
      console.log(`  ${project.name.padEnd(20)} → ~/${relDest.padEnd(30)} [would clone]`);
    } else {
      try {
        fs.mkdirSync(path.dirname(destDir), { recursive: true });
        execSync(`git clone ${project.repo_url} ${destDir}`, { stdio: 'inherit' });
        console.log(`  ${project.name.padEnd(20)} → ~/${relDest.padEnd(30)} ✓`);
      } catch (err) {
        console.error(`  ✗ Failed to clone ${project.name}: ${err.message}`);
        process.exit(1);
      }
    }

    clonedEntries.push({
      name: project.name,
      prefix: project.prefix,
      path: `./${project.name}`,
      description: project.description || '',
      ...(project.depends_on && project.depends_on.length > 0
        ? { depends_on: project.depends_on }
        : {}),
    });
  }

  // 3. Write/update workspace.yaml
  if (!dryRun) {
    const wsFile = updateWorkspaceYaml(workDir, clonedEntries);
    const relWs = path.relative(process.env.HOME, wsFile).replace(/\\/g, '/');
    console.log();
    console.log(`✓ Updated ~/${relWs}`);
    console.log();
    console.log(`${resolvedPrefixes.length} ${resolvedPrefixes.length === 1 ? 'repository' : 'repositories'} ready.`);
  } else {
    console.log();
    console.log(`[dry-run] Would update ~/work/.tract/workspace.yaml`);
  }
};
