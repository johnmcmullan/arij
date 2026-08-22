'use strict';

const fs   = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const { listTicketFiles } = require('../lib/ticket-loader');

module.exports = async function normalizeLabels(options) {
  const tractDir = path.resolve(options.tract);
  const configPath = path.join(tractDir, '.tract', 'config.yaml');

  // Load config
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
    } catch (e) {
      console.error(chalk.red(`Failed to load config: ${e.message}`));
      process.exit(1);
    }
  } else {
    console.warn(chalk.yellow(`No .tract/config.yaml found in ${tractDir}, using defaults`));
  }

  const labelMappings = config.labels?.mappings || {};
  const labelCase     = config.labels?.case     || 'lowercase';

  // Find tickets dir
  const ticketsDir = path.join(tractDir, 'tickets');
  if (!fs.existsSync(ticketsDir)) {
    console.error(chalk.red(`No tickets/ directory found in ${tractDir}`));
    process.exit(1);
  }

  const files = listTicketFiles(ticketsDir);
  if (files.length === 0) {
    console.log(chalk.gray('No ticket files found.'));
    return;
  }

  console.log(chalk.blue(`Normalising labels in ${files.length} tickets...`));
  console.log(chalk.gray(`  case: ${labelCase}, mappings: ${Object.keys(labelMappings).length}`));

  let totalChanged = 0;

  for (const { path: filePath } of files) {
    const file = path.basename(filePath);

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parts   = content.split('---\n');
      if (parts.length < 3) continue;

      const frontmatter = yaml.load(parts[1]);
      if (!frontmatter || !frontmatter.labels || !Array.isArray(frontmatter.labels)) continue;

      const originalLabels = [...frontmatter.labels];

      // 1. Apply mappings (explicit first, then case-insensitive fallback)
      const mappedLabels = frontmatter.labels.map(label => {
        if (labelMappings[label]) return labelMappings[label];

        const lowerLabel = label.toLowerCase();
        for (const [key, value] of Object.entries(labelMappings)) {
          if (key.toLowerCase() === lowerLabel) return value;
        }

        // 2. Case normalisation
        switch (labelCase) {
          case 'lowercase': return label.toLowerCase();
          case 'uppercase': return label.toUpperCase();
          case 'title':     return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
          default:          return label;
        }
      });

      // 3. Deduplicate (case-insensitive), preserving first occurrence
      const seen         = new Set();
      const uniqueLabels = [];
      for (const label of mappedLabels) {
        const key = label.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          uniqueLabels.push(label);
        }
      }

      // 4. Sort alphabetically
      uniqueLabels.sort();

      if (JSON.stringify(originalLabels) === JSON.stringify(uniqueLabels)) continue;

      frontmatter.labels = uniqueLabels;
      totalChanged++;

      if (options.verbose) {
        console.log(chalk.gray(`  ${file}: [${originalLabels.join(', ')}] => [${uniqueLabels.join(', ')}]`));
      }

      if (!options.dryRun) {
        const newYaml    = yaml.dump(frontmatter, { lineWidth: -1 });
        const newContent = `---\n${newYaml}---\n${parts.slice(2).join('---\n')}`;
        fs.writeFileSync(filePath, newContent, 'utf8');
      }

    } catch (e) {
      console.warn(chalk.yellow(`  Warning: could not process ${file}: ${e.message}`));
    }
  }

  if (options.dryRun) {
    console.log(chalk.yellow(`Dry run: ${totalChanged} ticket(s) would be changed`));
  } else if (totalChanged > 0) {
    console.log(chalk.green(`Done: normalised labels in ${totalChanged} ticket(s)`));
  } else {
    console.log(chalk.gray('All labels already normalised, nothing to do'));
  }
};
