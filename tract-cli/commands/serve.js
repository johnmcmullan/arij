'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');
const chokidar = require('chokidar');
const { findTicketsDir, findWorkspace, loadProjectDirs, loadTicketsFromDir, loadTickets } = require('../lib/ticket-loader');

const DEFAULT_PORT = 7766;

// SSE client list
let sseClients = [];

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function send404(res, msg = 'Not found') {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end(msg + '\n');
}

function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const params = {};
  for (const pair of url.slice(idx + 1).split('&')) {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
  }
  return params;
}

function loadSprints(sprintsDir) {
  if (!fs.existsSync(sprintsDir)) return [];
  return fs.readdirSync(sprintsDir)
    .filter(f => f.endsWith('.yaml'))
    .map(f => {
      try {
        const data = yaml.load(fs.readFileSync(path.join(sprintsDir, f), 'utf8'));
        return { id: path.basename(f, '.yaml'), ...data };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function buildDashUrl(entry) {
  const p = new URLSearchParams();
  const params = entry.params || {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') p.set(k, String(v));
  }
  const qs = p.toString();
  return `/dashboards/${entry.file}${qs ? '?' + qs : ''}`;
}

function buildIndexHtml(workspaceDashDir, userDashDir, libDashDir, workspaceName) {
  // Try to load index.yaml: workspace dir first, then user dir
  let registryEntries = null;
  for (const dir of [workspaceDashDir, userDashDir]) {
    const indexYamlPath = path.join(dir, 'index.yaml');
    if (fs.existsSync(indexYamlPath)) {
      try {
        const parsed = yaml.load(fs.readFileSync(indexYamlPath, 'utf8'));
        if (parsed?.dashboards?.length) { registryEntries = parsed.dashboards; break; }
      } catch { /* fall through */ }
    }
  }

  let rows;
  if (registryEntries && registryEntries.length > 0) {
    // Named registry view
    rows = registryEntries.map(d => {
      const url  = buildDashUrl(d);
      const desc = d.description ? `<div class="desc">${esc(d.description)}</div>` : '';
      const paramStr = d.params ? Object.entries(d.params)
        .filter(([,v]) => v !== null && v !== undefined && v !== '')
        .map(([k,v]) => `${k}=${v}`).join(' · ') : '';
      const paramTag = paramStr ? `<span class="params">${esc(paramStr)}</span>` : '';
      return `<li><a class="row" href="${url}">
        <div class="dash-info">
          <div class="name">${esc(d.name || d.file)}</div>
          ${desc}
        </div>
        ${paramTag}
      </a></li>`;
    }).join('\n');
  } else {
    // Fallback: auto-list built-ins + user custom (user overrides built-in with same name)
    const collect = (dir, label) => {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir)
        .filter(f => f.endsWith('.html'))
        .map(f => ({ name: path.basename(f, '.html'), file: f, label }));
    };
    const userItems  = collect(userDashDir, 'custom');
    const userFiles  = new Set(userItems.map(d => d.file));
    const libItems   = collect(libDashDir, '').filter(d => !userFiles.has(d.file));
    const all = [...libItems, ...userItems];
    rows = all.length === 0
      ? '<li class="empty">No dashboards found.</li>'
      : all.map(d =>
          `<li><a class="row" href="/dashboards/${d.file}"><div class="dash-info"><div class="name">${esc(d.name)}</div></div>${d.label ? `<span class="tag">${esc(d.label)}</span>` : ''}</a></li>`
        ).join('\n');
  }

  const title = workspaceName ? `${workspaceName} Dashboards` : 'Tract Dashboards';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <style>
    :root { --bg:#1e1e2e; --bg-alt:#313244; --bg-surface:#181825; --fg:#cdd6f4; --fg-dim:#6c7086; --border:#45475a; --cyan:#89dceb; --blue:#89b4fa; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--fg); font-family: 'JetBrains Mono','Fira Code',monospace,system-ui; font-size: 13px; min-height: 100vh; }
    .wrap { max-width: 680px; margin: 0 auto; padding: 48px 24px; }
    h1 { color: var(--cyan); font-size: 18px; letter-spacing: 0.04em; margin-bottom: 6px; }
    .subtitle { color: var(--fg-dim); font-size: 12px; margin-bottom: 32px; }
    ul { list-style: none; display: flex; flex-direction: column; gap: 2px; }
    ul a.row { display: flex; align-items: center; gap: 12px; text-decoration: none; }
    li { background: var(--bg-alt); border: 1px solid var(--border); border-radius: 6px; transition: border-color 0.12s; }
    li:hover { border-color: var(--blue); }
    li.empty { color: var(--fg-dim); background: transparent; border-style: dashed; padding: 14px 16px; justify-content: center; }
    a.row { padding: 14px 16px; cursor: pointer; }
    a.row:hover { text-decoration: none; }
    .dash-info { flex: 1; }
    a.row .name { color: var(--cyan); font-size: 14px; font-weight: bold; }
    .desc { color: var(--fg-dim); font-size: 11px; margin-top: 4px; }
    .params { color: var(--fg-dim); font-size: 10px; background: var(--bg-surface); border: 1px solid var(--border); border-radius: 4px; padding: 2px 8px; white-space: nowrap; }
    .tag { font-size: 10px; background: var(--bg-surface); color: var(--fg-dim); padding: 2px 8px; border-radius: 99px; border: 1px solid var(--border); }
    .api { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--border); color: var(--fg-dim); font-size: 11px; display: flex; gap: 16px; flex-wrap: wrap; }
    .api a { color: var(--fg-dim); font-size: 11px; font-weight: normal; }
    .api a:hover { color: var(--blue); }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>▐ ${esc(title)}</h1>
    <div class="subtitle">Select a dashboard or bookmark a URL with parameters</div>
    <ul>
      ${rows}
    </ul>
    <div class="api">
      API:
      <a href="/api/tickets">/api/tickets</a>
      <a href="/api/sprints">/api/sprints</a>
      <a href="/api/projects">/api/projects</a>
      <a href="/api/meta">/api/meta</a>
    </div>
  </div>
</body>
</html>`;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function notifySseClients() {
  const msg = `data: ${JSON.stringify({ type: 'reload', ts: Date.now() })}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch { /* client gone */ }
  }
}

async function serveCommand(cmdObj) {
  const port = parseInt(cmdObj.port || DEFAULT_PORT, 10);
  const startDir = cmdObj.workspace || process.cwd();
  const projectFilter = cmdObj.project || null;

  // Resolve workspace and project dirs
  let workspaceRoot = findWorkspace(startDir);
  let projectDirs;
  let sprintsDir;
  let workspaceName;

  if (workspaceRoot) {
    projectDirs = loadProjectDirs(workspaceRoot, projectFilter);
    sprintsDir = path.join(workspaceRoot, '.tract', 'sprints');
    try {
      const ws = yaml.load(fs.readFileSync(path.join(workspaceRoot, '.tract', 'workspace.yaml'), 'utf8'));
      workspaceName = ws.workspace?.name || path.basename(workspaceRoot);
    } catch {
      workspaceName = path.basename(workspaceRoot);
    }
  } else {
    // Single-project fallback
    workspaceRoot = startDir;
    const ticketsDir = findTicketsDir(startDir);
    const cfgPath = path.join(startDir, '.tract', 'config.yaml');
    let prefix = null;
    if (fs.existsSync(cfgPath)) {
      try { const cfg = yaml.load(fs.readFileSync(cfgPath, 'utf8')); prefix = cfg.prefix || cfg.project || null; } catch { /* ok */ }
    }
    projectDirs = ticketsDir
      ? [{ ticketsDir, prefix, name: prefix || 'default' }]
      : [];
    sprintsDir = path.join(startDir, '.tract', 'sprints');
    workspaceName = prefix || path.basename(startDir);
  }

  const libDashDir       = path.join(__dirname, '..', 'lib', 'dashboards');
  const userDashDir      = path.join(os.homedir(), '.tract', 'dashboards');
  const workspaceDashDir = path.join(workspaceRoot, 'dashboards'); // index.yaml only

  // Setup file watcher
  const watchDirs = projectDirs
    .filter(p => fs.existsSync(p.ticketsDir))
    .map(p => p.ticketsDir);

  if (watchDirs.length > 0) {
    const watcher = chokidar.watch(watchDirs, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }
    });
    watcher.on('add', notifySseClients)
           .on('change', notifySseClients)
           .on('unlink', notifySseClients);
  }

  const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    const query = parseQuery(req.url);

    // SSE endpoint
    if (urlPath === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(': connected\n\n');
      sseClients.push(res);
      req.on('close', () => {
        sseClients = sseClients.filter(c => c !== res);
      });
      return;
    }

    // Tickets API
    if (urlPath === '/api/tickets') {
      let tickets = loadTickets(projectDirs);

      if (query.project) {
        const pf = query.project.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        tickets = tickets.filter(t => pf.includes((t.project || '').toUpperCase()));
      }
      if (query.sprint) {
        tickets = tickets.filter(t => t.sprint === query.sprint);
      }
      if (query.status) {
        const statuses = query.status.split(',').map(s => s.trim());
        tickets = tickets.filter(t => statuses.includes(t.status));
      }
      if (query.assignee) {
        const a = query.assignee.toLowerCase();
        tickets = tickets.filter(t => t.assignee && t.assignee.toLowerCase() === a);
      }

      return sendJson(res, tickets);
    }

    // Single ticket API — full content including markdown body
    if (urlPath.startsWith('/api/ticket/')) {
      const id = path.basename(urlPath).toUpperCase();
      for (const p of projectDirs) {
        if (!fs.existsSync(p.ticketsDir)) continue;
        const file = fs.readdirSync(p.ticketsDir)
          .find(f => f.replace(/\.md$/i, '').toUpperCase() === id);
        if (file) {
          const content = fs.readFileSync(path.join(p.ticketsDir, file), 'utf8');
          const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
          const body = bodyMatch ? bodyMatch[1].trim() : '';
          const tickets = loadTicketsFromDir(p.ticketsDir, p.prefix);
          const ticket = tickets.find(t => t.id.toUpperCase() === id);
          if (ticket) return sendJson(res, { ...ticket, body });
        }
      }
      return send404(res, `Ticket ${id} not found`);
    }

    // Sprints API
    if (urlPath === '/api/sprints') {
      return sendJson(res, loadSprints(sprintsDir));
    }

    // Projects API
    if (urlPath === '/api/projects') {
      let dirs = projectDirs;
      if (query.project) {
        const pf = query.project.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        dirs = dirs.filter(p => pf.includes((p.prefix || '').toUpperCase()));
      }
      const projects = dirs.map(p => {
        const count = fs.existsSync(p.ticketsDir)
          ? loadTicketsFromDir(p.ticketsDir, p.prefix).length
          : 0;
        return { prefix: p.prefix, name: p.name, ticketsDir: p.ticketsDir, ticketCount: count };
      });
      return sendJson(res, projects);
    }

    // Meta API
    if (urlPath === '/api/meta') {
      return sendJson(res, {
        workspace: workspaceName,
        port,
        projects: projectDirs.map(p => ({ prefix: p.prefix, name: p.name }))
      });
    }

    // Dashboard index
    if (urlPath === '/') {
      const html = buildIndexHtml(workspaceDashDir, userDashDir, libDashDir, workspaceName);
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
      return res.end(html);
    }

    // Dashboard file serving
    if (urlPath.startsWith('/dashboards/')) {
      const filename = path.basename(urlPath);
      // Guard against path traversal
      if (!filename.endsWith('.html') || filename.includes('/')) {
        return send404(res, 'Invalid dashboard name');
      }
      const userPath = path.join(userDashDir, filename);
      const libPath  = path.join(libDashDir, filename);
      const filePath = fs.existsSync(userPath) ? userPath  // user custom overrides built-in
                     : fs.existsSync(libPath)  ? libPath   // built-in
                     : null;
      if (!filePath) return send404(res, `Dashboard not found: ${filename}`);
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
      return fs.createReadStream(filePath).pipe(res);
    }

    send404(res, `Unknown endpoint: ${urlPath}\nTry: /api/tickets /api/sprints /api/projects /api/meta /api/events /`);
  });

  server.listen(port, () => {
    const projectList = projectDirs.map(p => p.prefix || p.name).join(', ') || '(none)';
    console.log(`tract serve`);
    console.log(`  http://localhost:${port}`);
    console.log(`  Workspace: ${workspaceName}`);
    console.log(`  Projects:  ${projectList}`);
    console.log(`  Watching:  ${watchDirs.length} ticket dir(s)`);
    console.log(`  Dashboards: built-ins + ${userDashDir} (custom)`);
    console.log(`\nPress Ctrl-C to stop.`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close(() => process.exit(0));
  });
}

module.exports = serveCommand;
