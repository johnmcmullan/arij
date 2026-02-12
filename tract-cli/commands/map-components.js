const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const chalk = require('chalk');
const ora = require('ora');

async function mapComponents(options) {
  console.log(chalk.bold.cyan('\n🗺️  Tract Component Mapper\n'));

  const tractDir = path.resolve(options.tract || '.');
  const codeRoot = path.resolve(options.code || '..');
  const interactive = options.interactive !== false;
  const confidenceThreshold = options.confidence || 80;

  // Validate .tract directory exists
  const componentsPath = path.join(tractDir, '.tract', 'components.yaml');
  if (!fs.existsSync(componentsPath)) {
    console.error(chalk.red(`❌ Error: .tract/components.yaml not found at ${tractDir}`));
    console.error(chalk.yellow('   Run this from your ticket repository or use --tract <path>'));
    process.exit(1);
  }

  // Validate code root exists
  if (!fs.existsSync(codeRoot)) {
    console.error(chalk.red(`❌ Error: Code directory not found: ${codeRoot}`));
    console.error(chalk.yellow('   Use --code <path> to specify code repository location'));
    process.exit(1);
  }

  console.log(chalk.gray(`Tract config: ${tractDir}/.tract/`));
  console.log(chalk.gray(`Code root:    ${codeRoot}`));
  console.log(chalk.gray(`Interactive:  ${interactive ? 'yes' : 'no'}`));
  console.log(chalk.gray(`Confidence:   ${confidenceThreshold}%\n`));

  // Load components
  const spinner = ora('Loading components...').start();
  const componentsData = yaml.load(fs.readFileSync(componentsPath, 'utf8'));
  const components = componentsData.components || {};
  const componentNames = Object.keys(components);
  spinner.succeed(chalk.green(`✓ Loaded ${componentNames.length} components`));

  // Scan code directories
  const scanSpinner = ora('Scanning code repository...').start();
  const directories = scanDirectories(codeRoot, {
    maxDepth: 4,
    exclude: ['.git', 'node_modules', 'tickets', 'third_party', '.tract-tmp']
  });
  scanSpinner.succeed(chalk.green(`✓ Found ${directories.length} directories`));

  console.log(chalk.bold.yellow('\n⚠️  LLM-POWERED MAPPING REQUIRED\n'));
  console.log(chalk.gray('This command needs an LLM to intelligently map components to directories.'));
  console.log(chalk.gray('The mapping is based on natural language understanding, not code patterns.\n'));

  console.log(chalk.bold('📋 Component Mapping Task:\n'));
  console.log(chalk.gray(`Components to map: ${componentNames.length}`));
  console.log(chalk.gray(`Available directories: ${directories.length}\n`));

  console.log(chalk.bold('🤖 Next Steps:\n'));
  console.log(chalk.gray('1. Review component names from .tract/components.yaml'));
  console.log(chalk.gray('2. Review directory structure from code repository'));
  console.log(chalk.gray('3. Use language understanding to match components to paths'));
  console.log(chalk.gray('4. For each component, determine most likely directory matches'));
  console.log(chalk.gray('5. Assign confidence scores based on semantic similarity'));
  console.log(chalk.gray('6. Present mappings for review and confirmation\n'));

  // Output component list for LLM
  const outputPath = path.join(tractDir, '.tract', 'mapping-task.json');
  const mappingTask = {
    components: componentNames.map(name => ({
      name,
      description: components[name].description || '',
      currentPaths: components[name].paths || []
    })),
    directories: directories.map(dir => ({
      path: path.relative(codeRoot, dir),
      name: path.basename(dir)
    })),
    instructions: {
      task: 'Map each component name to one or more directory paths',
      method: 'Use natural language understanding to find semantic matches',
      confidence: 'Provide confidence score 0-100 for each mapping',
      examples: {
        'Analyst': ['packages/analyst'],
        'Market Making': ['shared/market_making', 'beta/strategy/passive_market_making'],
        'API': ['beta/integration/*/instrument_service_api', 'packages/*/api']
      }
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(mappingTask, null, 2));
  
  console.log(chalk.bold.green('✅ Mapping task prepared!\n'));
  console.log(chalk.yellow(`📁 Task definition: ${path.relative(process.cwd(), outputPath)}\n`));
  console.log(chalk.bold('To complete mapping:\n'));
  console.log(chalk.gray('1. Ask your LLM assistant to read the mapping task file'));
  console.log(chalk.gray('2. LLM will analyze component names and directory names'));
  console.log(chalk.gray('3. LLM will suggest mappings with confidence scores'));
  console.log(chalk.gray('4. Review and confirm the mappings'));
  console.log(chalk.gray('5. LLM will update .tract/components.yaml with paths\n'));

  console.log(chalk.bold('Example prompt for LLM:\n'));
  console.log(chalk.cyan('"Read .tract/mapping-task.json and map the components to directories.'));
  console.log(chalk.cyan('For each component, find the most semantically similar directory paths.'));
  console.log(chalk.cyan('Show me the top 50 mappings with confidence scores for review."\n'));
}

function scanDirectories(root, options = {}) {
  const { maxDepth = 4, exclude = [] } = options;
  const results = [];

  function scan(dir, depth) {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (exclude.includes(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;

        const fullPath = path.join(dir, entry.name);
        results.push(fullPath);
        scan(fullPath, depth + 1);
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }

  scan(root, 0);
  return results;
}

module.exports = mapComponents;
