const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load configuration
const config = require('./config/default.json');

// Create proxy server
const proxy = httpProxy.createProxyServer({});

// Ensure logs directory exists
if (!fs.existsSync(config.logsDir)) {
  fs.mkdirSync(config.logsDir, { recursive: true });
}

// Helper to detect if request is from a web browser
function isWebBrowser(userAgent) {
  if (!userAgent) return false;
  const browserPatterns = /Mozilla|Chrome|Safari|Firefox|Edge|Opera/i;
  const botPatterns = /curl|wget|python|java|node/i;
  return browserPatterns.test(userAgent) && !botPatterns.test(userAgent);
}

// Helper to extract project key from Jira URL
function extractProjectKey(requestUrl) {
  // Match patterns like /browse/APP-123, /rest/api/2/issue/APP-123, /projects/APP
  const patterns = [
    /\/browse\/([A-Z]+)-\d+/,
    /\/rest\/api\/\d+\/issue\/([A-Z]+)-\d+/,
    /\/projects\/([A-Z]+)/,
    /project=([A-Z]+)/,
    /projectKeys=([A-Z]+)/
  ];
  
  for (const pattern of patterns) {
    const match = requestUrl.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Helper to log request/response
function logInteraction(req, proxyRes, body) {
  if (!config.logging.enabled) return;

  const timestamp = new Date().toISOString();
  const projectKey = extractProjectKey(req.url);
  
  const logEntry = {
    timestamp,
    projectKey,
    method: req.method,
    url: req.url,
    headers: req.headers,
    userAgent: req.headers['user-agent'],
    statusCode: proxyRes ? proxyRes.statusCode : null,
    responseHeaders: proxyRes ? proxyRes.headers : null,
    responseBody: body ? JSON.parse(body.toString()) : null
  };

  // Organize logs by date and project
  let logDir = config.logsDir;
  
  if (config.logging.organizeByDate) {
    const date = timestamp.split('T')[0];
    logDir = path.join(logDir, date);
  }
  
  if (config.logging.organizeByProject && projectKey) {
    logDir = path.join(logDir, projectKey);
  }
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create unique filename with timestamp
  const filename = `${timestamp.replace(/[:.]/g, '-')}-${req.method}-${projectKey || 'unknown'}.json`;
  const logPath = path.join(logDir, filename);
  
  fs.writeFileSync(logPath, JSON.stringify(logEntry, null, 2));
  console.log(`[LOG] ${req.method} ${req.url} -> ${logPath}`);
}

// Create HTTP server
const server = http.createServer((req, res) => {
  const projectKey = extractProjectKey(req.url);
  const isMigrated = projectKey && config.migratedProjects.includes(projectKey);
  const isWeb = isWebBrowser(req.headers['user-agent']);

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | Project: ${projectKey || 'N/A'} | Migrated: ${isMigrated} | Web: ${isWeb}`);

  // Handle migrated projects
  if (isMigrated) {
    if (isWeb) {
      // Redirect web browsers to Tract UI
      const tractIssueUrl = req.url.includes('/browse/')
        ? req.url.replace(/\/browse\/([A-Z]+-\d+)/, '/tickets/$1')
        : '/';
      
      res.writeHead(302, {
        'Location': `${config.tractUrl}${tractIssueUrl}`,
        'X-Migrated-To': 'Tract',
        'X-Project-Key': projectKey
      });
      res.end(`Project ${projectKey} has been migrated to Tract. Redirecting...`);
      console.log(`[REDIRECT] ${req.url} -> ${config.tractUrl}${tractIssueUrl}`);
    } else {
      // Return migration notice for API clients
      res.writeHead(410, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        errorMessages: [`Project ${projectKey} has been migrated to Tract`],
        message: 'This project is no longer available in Jira',
        migrated: true,
        projectKey: projectKey,
        tractApiUrl: `${config.tractUrl}/api`,
        tractWebUrl: `${config.tractUrl}`,
        documentation: `${config.tractUrl}/docs/api`
      }, null, 2));
      console.log(`[MIGRATION_NOTICE] ${projectKey} -> Tract`);
    }
    return;
  }

  // Proxy to Jira and log the interaction
  proxy.web(req, res, { target: config.jiraUrl, changeOrigin: true });

  // Capture response for logging
  if (config.logging.enabled && config.logging.logResponses) {
    const chunks = [];
    
    proxy.on('proxyRes', (proxyRes, req, res) => {
      proxyRes.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      proxyRes.on('end', () => {
        const body = Buffer.concat(chunks);
        logInteraction(req, proxyRes, body);
      });
    });
  } else if (config.logging.enabled && config.logging.logRequests) {
    // Log just the request
    logInteraction(req, null, null);
  }
});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
  console.error('[PROXY_ERROR]', err.message);
  res.writeHead(502, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    error: 'Proxy error',
    message: err.message
  }));
});

// Start server
server.listen(config.proxyPort, () => {
  console.log('='.repeat(60));
  console.log('Tract Jira Proxy Server');
  console.log('='.repeat(60));
  console.log(`Listening on: http://localhost:${config.proxyPort}`);
  console.log(`Proxying to:  ${config.jiraUrl}`);
  console.log(`Tract URL:    ${config.tractUrl}`);
  console.log(`Logs dir:     ${config.logsDir}`);
  console.log(`Migrated projects: ${config.migratedProjects.join(', ') || 'None'}`);
  console.log('='.repeat(60));
});
