'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');

// ── Resolve project tractDir (mirrors detect-fields logic) ───────────────────
function resolveTractDir(project, options) {
  let tractDir = path.resolve(options.tract || '.');
  const projectKey = (project || options.project || '').toUpperCase();

  if (!options.tract && projectKey) {
    const subDir = path.join(tractDir, projectKey);
    if (!fs.existsSync(path.join(tractDir, '.tract', 'config.yaml')) &&
         fs.existsSync(path.join(subDir,  '.tract', 'config.yaml'))) {
      tractDir = subDir;
    }
  }

  return { tractDir, projectKey };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function acceptMappings(project, options) {
  console.log(chalk.bold.cyan('\n✅ Tract Accept Mappings\n'));

  const { tractDir, projectKey } = resolveTractDir(project, options);
  const tractSubDir = path.join(tractDir, '.tract');

  if (!fs.existsSync(path.join(tractSubDir, 'config.yaml'))) {
    console.error(chalk.red(`❌ No .tract/config.yaml found in: ${tractDir}`));
    console.error(chalk.gray('   Pass the project key as an argument or use --tract <dir>'));
    process.exit(1);
  }

  // ── Load config to confirm project key ───────────────────────────────────
  const config = yaml.load(fs.readFileSync(path.join(tractSubDir, 'config.yaml'), 'utf8')) || {};
  const resolvedKey = projectKey || (config.project || '').toUpperCase();
  console.log(chalk.gray(`Project:  ${resolvedKey || '(unknown)'}`));
  console.log(chalk.gray(`Tract dir: ${tractDir}\n`));

  // ── Check fields.yaml has entries ───────────────────────────────────────
  const instanceFieldsPath = '/etc/tract-sync/fields.yaml';
  let fieldCount = 0;
  try {
    const fields = yaml.load(fs.readFileSync(instanceFieldsPath, 'utf8')) || {};
    fieldCount = Object.keys(fields.custom_field_map || {}).length;
  } catch (_) {}
  if (fieldCount > 0) {
    console.log(chalk.gray(`  ${instanceFieldsPath}: ${fieldCount} field(s) mapped`));
  } else {
    console.log(chalk.yellow(`⚠️  ${instanceFieldsPath} has no mappings yet — run tract detect-fields ${resolvedKey} first`));
  }

  // ── Delete sentinel ──────────────────────────────────────────────────────
  const sentinelPath = path.join(tractSubDir, '.pending-field-detection');
  if (fs.existsSync(sentinelPath)) {
    fs.unlinkSync(sentinelPath);
    console.log(chalk.green(`✓ Deleted sentinel: ${sentinelPath}`));
  } else {
    console.log(chalk.gray(`  Sentinel already gone: ${sentinelPath}`));
  }

  // ── Delete payload (unless --keep-payload) ───────────────────────────────
  const payloadPath = path.join(tractSubDir, 'detect-fields-payload.json');
  if (!options.keepPayload && fs.existsSync(payloadPath)) {
    fs.unlinkSync(payloadPath);
    console.log(chalk.green(`✓ Cleaned up payload: ${payloadPath}`));
  } else if (options.keepPayload && fs.existsSync(payloadPath)) {
    console.log(chalk.gray(`  Kept payload (--keep-payload): ${payloadPath}`));
  }

  console.log(chalk.bold.cyan(`\n  Sync for ${resolvedKey || tractDir} will start on the next daemon cycle.\n`));
}

module.exports = acceptMappings;
