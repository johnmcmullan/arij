'use strict';
const { execFileSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const readline = require('readline');

const WORKSPACE_YAML = path.join(process.env.HOME, '.tract', 'workspace.yaml');

// Python snippet run on the server via SSH stdin.
// Token is base64-encoded as argv[3] to survive SSH argument passing safely.
// Uses only stdlib (no PyYAML) — reads existing YAML with regex, writes with
// simple string manipulation to avoid adding a server dependency.
const UPSERT_PY = `
import sys, base64, os, re
email    = sys.argv[1]
username = sys.argv[2]
token    = base64.b64decode(sys.argv[3]).decode()
p        = "/etc/tract-sync/users.yaml"

# Build the new entry block (2-space indent, no special chars needing quoting
# beyond the token which is base64 so safe).
entry = f"  {email}:\\n    jira_username: {username}\\n    api_token: {token}\\n"

if not os.path.exists(p):
    with open(p, "w") as f:
        f.write("users:\\n" + entry)
else:
    text = open(p).read()
    # Remove existing entry for this email if present.
    text = re.sub(
        r'  ' + re.escape(email) + r':\\n(?:    [^\\n]+\\n)*',
        '', text
    )
    if re.search(r'^users:', text, re.MULTILINE):
        # Append under existing users: key.
        text = re.sub(r'(^users:\\n)', r'\\1' + entry, text, count=1, flags=re.MULTILINE)
    else:
        text += "users:\\n" + entry
    with open(p, "w") as f:
        f.write(text)

print(f"Registered {email} -> {username}")
`.trim();

function ask(rl, q) { return new Promise(r => rl.question(q, r)); }

module.exports = async function auth(options) {
    console.log(chalk.bold.cyan('\n▐ tract auth\n'));

    // Resolve server hostname from options, workspace.yaml, or env var.
    let host = options.server;
    if (!host) {
        try {
            const ws = yaml.load(fs.readFileSync(WORKSPACE_YAML, 'utf8')) || {};
            const url = ws.sync_server || process.env.TRACT_SYNC_SERVER || '';
            host = url.replace(/^https?:\/\//, '').split(/[:\/]/)[0];
        } catch {}
    }
    if (!host) {
        console.error(chalk.red('No sync server. Set sync_server in ~/.tract/workspace.yaml or --server.'));
        process.exit(1);
    }

    // Pre-populate git email as default.
    let gitEmail = '';
    try { gitEmail = execFileSync('git', ['config', 'user.email'], { encoding: 'utf8' }).trim(); } catch {}

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const email    = ((await ask(rl, `Git author email [${gitEmail}]: `)).trim()) || gitEmail;
    const username =  (await ask(rl, 'Jira username: ')).trim();
    const token    =  (await ask(rl, 'Jira API token: ')).trim();
    rl.close();

    if (!email || !username || !token) {
        console.error(chalk.red('All fields required.')); process.exit(1);
    }

    const sshUser  = options.user || 'tract';
    const target   = `${sshUser}@${host}`;
    const tokenB64 = Buffer.from(token).toString('base64');

    console.log(chalk.gray(`\n  Registering on ${target}...`));
    try {
        const out = execFileSync(
            'ssh', [target, `python3 - '${email}' '${username}' '${tokenB64}'`],
            { input: UPSERT_PY, encoding: 'utf8' }
        );
        console.log(chalk.green(`  \u2713 ${out.trim()}`));
        // Reload daemon so it picks up the new token immediately.
        try {
            execFileSync('ssh', [target, 'sudo systemctl kill -s HUP tract-sync'], { encoding: 'utf8' });
            console.log(chalk.gray(`  \u2713 Daemon reloaded\n`));
        } catch {
            console.log(chalk.yellow(`  Reload manually: ssh ${target} sudo systemctl kill -s HUP tract-sync\n`));
        }
    } catch (e) {
        console.error(chalk.red(`  SSH failed: ${e.message}`));
        process.exit(1);
    }
};
