const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const ora   = require('ora');
const axios = require('axios');

const JiraClient = require('../lib/jira-client');

// ── Daemon credential fallback ────────────────────────────────────────────────
// Read /etc/tract-sync/env so Jira credentials don't need to be duplicated.
// Silently returns {} if the file is absent or unreadable.
function loadDaemonEnv(envFile = '/etc/tract-sync/env') {
  try {
    return fs.readFileSync(envFile, 'utf8')
      .split('\n')
      .reduce((acc, line) => {
        const m = line.match(/^(?:export\s+)?([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m) acc[m[1]] = m[2].replace(/^["']|["']$/g, '');
        return acc;
      }, {});
  } catch (_) { return {}; }
}
// ── Field names that are too large or not useful for field detection ──────────
const SKIP_FIELDS = new Set([
  'description', 'comment', 'renderedFields', 'attachment',
  'worklog', 'changelog', 'subtasks', 'issuelinks',
]);

// ── Shorten a value to something Claude can reason from ───────────────────────
function compactValue(v, depth = 0) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string')  return v.length > 80 ? v.slice(0, 80) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;

  if (Array.isArray(v)) {
    return v.slice(0, 2).map(el => compactValue(el, depth + 1));
  }

  if (typeof v === 'object') {
    if (depth > 2) return '(nested object)';
    const out = {};
    for (const [k, val] of Object.entries(v)) {
      if (val === null || val === undefined) continue;
      out[k] = compactValue(val, depth + 1);
    }
    return out;
  }

  return String(v);
}

// ── Strip noise from a raw Jira issue, keeping shape + sample values ──────────
function compactIssue(issue) {
  const compact = { key: issue.key, fields: {} };
  const fields  = issue.fields || {};

  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined) continue;
    if (SKIP_FIELDS.has(k)) continue;
    compact.fields[k] = compactValue(v);
  }

  return compact;
}

// ── Collect all customfield_NNNNN keys that have any non-null value ───────────
function collectCustomFields(compactIssues) {
  const seen = new Map(); // key → first sample value (for display)
  for (const issue of compactIssues) {
    for (const [k, v] of Object.entries(issue.fields)) {
      if (!k.startsWith('customfield_')) continue;
      if (v === null || v === undefined) continue;
      if (!seen.has(k)) seen.set(k, v);
    }
  }
  return seen;
}

// ── Call the Anthropic Messages API ──────────────────────────────────────────
// ── AI call — SAIS (OpenAI-compatible) or Anthropic ──────────────────────────

async function getSaisToken() {
  const idUrl    = process.env.SAIS_ID_URL;
  const clientId = process.env.CLIENT_ID;
  const secret   = process.env.CLIENT_SECRET;
  const params   = new URLSearchParams({
    grant_type: 'client_credentials', client_id: clientId, client_secret: secret,
  });
  const res = await axios.post(idUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000,
  });
  return res.data.access_token;
}

async function callAI(prompt, apiKey, model) {
  // Prefer SAIS when CLIENT_SECRET + SAIS_URL are set
  if (process.env.CLIENT_SECRET && process.env.SAIS_URL && process.env.SAIS_ID_URL && process.env.CLIENT_ID) {
    const token = await getSaisToken();
    const res = await axios.post(
      `${process.env.SAIS_URL}/v1/chat/completions`,
      { model: model || 'gpt-4o', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 60000 }
    );
    return res.data.choices[0].message.content;
  }
  // Fallback: Anthropic direct
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    { model, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] },
    {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      timeout: 60000,
    }
  );
  return response.data.content[0].text;
}

// ── Build the prompt ──────────────────────────────────────────────────────────
function buildPrompt(projectKey, compactIssues) {
  const issueJson = JSON.stringify(compactIssues, null, 2);

  return `You are analyzing raw Jira ticket data to identify custom field semantics.

Below are ${compactIssues.length} tickets from project ${projectKey}.
Fields starting with "customfield_" are Jira instance-specific and need to be mapped
to human-readable names so the tract import tool can produce correct frontmatter.

Your job:
1. For each customfield_NNNNN that has non-null data in at least one ticket,
   infer its semantic meaning from its value shape and content.
2. Common fields to look for (but don't limit yourself to these):
   - sprint (object with name, state, startDate, endDate, goal — or array of such)
   - story_points (plain number: 1, 2, 3, 5, 8, 13...)
   - epic_link (issue key like APP-123, or short string, or epic object)
   - epic_name (short string — the epic's own display title, only on Epic tickets)
   - team (string or object with a name property)
   - rank (a lexicographic ordering string, looks like "0|hzzzzz:")
   - acceptance_criteria (long text, similar to description)
   - flagged / impediment (boolean or option object containing "Impediment")
   - Any other fields you can identify with reasonable confidence
3. For EVERY customfield you see data in — even ones you can't name — include it
   in the output. Identified fields go in custom_field_map; unidentified ones go
   in a commented-out "unidentified" section with a sample value so the user can
   decide manually without re-fetching from Jira.
4. Include a brief comment on each line explaining what you saw.

Output format — return ONLY this YAML block, nothing else before or after:

\`\`\`yaml
# Suggested custom_field_map for ${projectKey}
# Add this under jira: in your .tract/config.yaml
custom_field_map:
  customfield_XXXXX: sprint          # {name: "Sprint 42", state: "active", ...}
  customfield_YYYYY: story_points    # plain number (3, 5, 8, ...)
  # ... one entry per confidently-identified field

# ── Unidentified custom fields ─────────────────────────────────────────────
# These fields had data but couldn't be confidently named.
# Inspect the sample value and add a mapping above if you recognise the field.
# unidentified:
#   customfield_ZZZZZ: ???    # sample: <compact sample value here>
\`\`\`

Ticket data:
${issueJson}`;
}

// ── Default payload save path ─────────────────────────────────────────────────
function payloadPath(tractDir) {
  return path.join(tractDir, '.tract', 'detect-fields-payload.json');
}

// ── Fetch N tickets per issue type so every field variant is represented ──────
//
// A Bug won't have story_points. An Epic won't be in a sprint. A Sub-task has
// no epic_link. Sampling only by recency risks missing whole field families.
// Stratifying by type guarantees we see what each type contributes.
//
async function fetchStratifiedSample(client, projectKey, perType) {
  // Discover what issue types this project actually uses
  const issueTypes = await client.getIssueTypes(projectKey);
  const typeNames  = issueTypes.map(t => t.name).filter(Boolean);

  if (typeNames.length === 0) {
    // Fallback: just grab recent tickets if type discovery fails
    return client.searchIssues(`project = ${projectKey} ORDER BY updated DESC`, perType * 5);
  }

  console.log(chalk.gray(`  Issue types: ${typeNames.join(', ')}`));

  // Fetch perType tickets for each type in parallel
  const results = await Promise.all(
    typeNames.map(async typeName => {
      const jql = `project = ${projectKey} AND issuetype = "${typeName}" ORDER BY updated DESC`;
      try {
        return await client.searchIssues(jql, perType, { pageSize: perType });
      } catch {
        return []; // type may exist in schema but have no tickets — skip silently
      }
    })
  );

  // Flatten and deduplicate by key
  const seen = new Set();
  const issues = [];
  for (const batch of results) {
    for (const issue of batch) {
      if (!seen.has(issue.key)) {
        seen.add(issue.key);
        issues.push(issue);
      }
    }
  }

  return issues;
}

// ── Main command ──────────────────────────────────────────────────────────────
async function detectFields(project, options) {
  console.log(chalk.bold.cyan('\n🔍 Tract Field Detector\n'));

  // ── Resolve config ──────────────────────────────────────────────────────────
  const tractDir   = path.resolve(options.tract || '.');
  const configPath = path.join(tractDir, '.tract', 'config.yaml');
  let config = {};

  if (fs.existsSync(configPath)) {
    config = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
  }

  const projectKey = (project || options.project || config.project || '').toUpperCase();
  if (!projectKey) {
    console.error(chalk.red('❌ Project key required — pass it as an argument or set in config.yaml'));
    process.exit(1);
  }

  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  const model  = options.model  || (process.env.CLIENT_SECRET ? 'gpt-4o' : 'claude-sonnet-4-6');

  const usingSais = !!(process.env.CLIENT_SECRET && process.env.SAIS_URL);
  if (!apiKey && !usingSais) {
    console.error(chalk.red('❌ No AI credentials — set ANTHROPIC_API_KEY or CLIENT_SECRET+SAIS_URL'));
    process.exit(1);
  }

  // ── Two modes: re-analyze saved payload, or fetch fresh ────────────────────
  let compactIssues;

  const savedPayload = options.payload || (
    options.reuse && fs.existsSync(payloadPath(tractDir)) ? payloadPath(tractDir) : null
  );

  if (savedPayload) {
    // ── Re-analyze mode: load compact JSON from disk, skip Jira entirely ─────
    if (!fs.existsSync(savedPayload)) {
      console.error(chalk.red(`❌ Payload file not found: ${savedPayload}`));
      process.exit(1);
    }
    compactIssues = JSON.parse(fs.readFileSync(savedPayload, 'utf8'));
    console.log(chalk.gray(`Re-analyzing saved payload: ${savedPayload}`));
    console.log(chalk.gray(`  ${compactIssues.length} tickets, skipping Jira fetch\n`));

  } else {
    // ── Fetch mode: stratified sample across issue types ──────────────────────

    // Read daemon env file as credential fallback so credentials aren't duplicated
    const daemonEnv = loadDaemonEnv();

    const jiraUrl  = options.jira  || config.jira?.url || config.upstream || daemonEnv.JIRA_BASE_URL;
    const username = options.user  || process.env.JIRA_USERNAME  || daemonEnv.JIRA_USERNAME;
    const token    = options.token || process.env.JIRA_TOKEN || process.env.JIRA_PASSWORD
                                   || process.env.JIRA_API_TOKEN || daemonEnv.JIRA_API_TOKEN;
    const perType  = parseInt(options.perType || options.count || '2', 10);

    if (!jiraUrl) {
      console.error(chalk.red('❌ Jira URL required — use --jira or set jira.url in config.yaml'));
      process.exit(1);
    }
    if (!username || !token) {
      console.error(chalk.red('❌ Jira credentials required'));
      console.error(chalk.yellow('   export JIRA_USERNAME=you@company.com'));
      console.error(chalk.yellow('   export JIRA_TOKEN=<api-token>'));
      process.exit(1);
    }

    console.log(chalk.gray(`Project:  ${projectKey}`));
    console.log(chalk.gray(`Jira:     ${jiraUrl}`));
    console.log(chalk.gray(`Sample:   ${perType} tickets per issue type`));
    console.log(chalk.gray(`Model:    ${model}\n`));

    const client = new JiraClient(jiraUrl, { username, password: token });

    const fetchSpinner = ora(`Fetching sample tickets by issue type…`).start();
    let issues;
    try {
      issues = await fetchStratifiedSample(client, projectKey, perType);
      fetchSpinner.succeed(chalk.green(`✓ Fetched ${issues.length} tickets across ${new Set(issues.map(i => i.fields?.issuetype?.name)).size} types`));
    } catch (err) {
      fetchSpinner.fail(chalk.red('Failed to fetch tickets'));
      console.error(chalk.red(`  ${err.message}`));
      process.exit(1);
    }

    if (issues.length === 0) {
      console.error(chalk.red(`❌ No tickets found in project ${projectKey}`));
      process.exit(1);
    }

    compactIssues = issues.map(compactIssue);

    // Always save — enables --reuse on subsequent runs
    const pPath = payloadPath(tractDir);
    try {
      fs.mkdirSync(path.dirname(pPath), { recursive: true });
      fs.writeFileSync(pPath, JSON.stringify(compactIssues, null, 2));
      console.log(chalk.gray(`  Payload saved → ${path.relative(process.cwd(), pPath)}`));
      console.log(chalk.gray(`  Re-analyze without fetching: tract detect-fields ${projectKey} --reuse\n`));
    } catch {
      // Non-fatal
    }
  }

  // ── Show what we're working with ────────────────────────────────────────────
  const customFields = collectCustomFields(compactIssues);
  const issueTypes   = [...new Set(
    compactIssues.map(i => i.fields?.issuetype?.name).filter(Boolean)
  )];
  console.log(chalk.gray(`  Custom fields with data: ${customFields.size}`));
  console.log(chalk.gray(`  Issue types: ${issueTypes.join(', ')}\n`));

  // ── Call Claude ─────────────────────────────────────────────────────────────
  const claudeSpinner = ora(`Asking ${model} to identify fields…`).start();
  let result;
  try {
    result = await callAI(buildPrompt(projectKey, compactIssues), apiKey, model);
    claudeSpinner.succeed(chalk.green('✓ Analysis complete'));
  } catch (err) {
    claudeSpinner.fail(chalk.red('Claude API call failed'));
    console.error(chalk.red(`  ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`));
    process.exit(1);
  }

  // ── Print result ────────────────────────────────────────────────────────────
  console.log(chalk.bold.yellow('\n─── Suggested custom_field_map ───────────────────────────────\n'));
  console.log(result);
  console.log(chalk.bold.yellow('──────────────────────────────────────────────────────────────\n'));

  console.log(
    chalk.gray('1. Paste the ') + chalk.cyan('custom_field_map:') +
    chalk.gray(' block under ') + chalk.cyan('jira:') +
    chalk.gray(' in ') + chalk.cyan('.tract/config.yaml')
  );
  console.log(chalk.gray('2. Review the unidentified section — rename any you recognise'));
  console.log(chalk.gray('3. If you spot a field you want to add without re-fetching:'));
  console.log(chalk.white(`      tract detect-fields ${projectKey} --reuse`));
  console.log(chalk.gray('4. Then run: ') + chalk.white('tract import\n'));
}

module.exports = detectFields;
