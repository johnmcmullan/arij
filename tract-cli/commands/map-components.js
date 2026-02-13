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

  // Generate directory tree for better context
  const { execSync } = require('child_process');
  let directoryTree = '';
  try {
    directoryTree = execSync(`tree -d -L 3 "${codeRoot}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  } catch (err) {
    // If tree command fails, generate simple listing
    directoryTree = generateSimpleTree(codeRoot, 3);
  }

  // Separate unmapped from mapped components
  const unmappedComponents = componentNames
    .filter(name => !components[name].paths || components[name].paths.length === 0)
    .map(name => ({
      name,
      description: components[name].description || '',
      currentPaths: []
    }));

  const mappedComponents = componentNames
    .filter(name => components[name].paths && components[name].paths.length > 0)
    .map(name => ({
      name,
      description: components[name].description || '',
      currentPaths: components[name].paths
    }));

  // Output component list for LLM
  const outputPath = path.join(tractDir, '.tract', 'mapping-task.json');
  const mappingTask = {
    summary: {
      totalComponents: componentNames.length,
      mapped: mappedComponents.length,
      unmapped: unmappedComponents.length,
      codeRoot: path.relative(tractDir, codeRoot)
    },
    unmappedComponents,
    mappedComponents: mappedComponents.slice(0, 20), // Show first 20 as examples
    directoryTree,
    directories: directories.map(dir => path.relative(codeRoot, dir)).sort(),
    instructions: {
      task: 'Map unmapped components to directory paths in the codebase',
      method: 'Use natural language understanding to match component names/descriptions with directory structure',
      workflow: [
        '1. Review unmappedComponents list (names + descriptions)',
        '2. Review directoryTree to understand codebase structure',
        '3. Match each component to most likely directory path(s)',
        '4. Update .tract/components.yaml with paths array for each component',
        '5. Work in batches - map 20-50 at a time for review'
      ],
      examples: {
        'Analyst': ['packages/analyst'],
        'Analyst/Best execution': ['packages/analyst/bestx'],
        'FX / Market making': ['packages/fx_mm'],
        'ETF': ['packages/etf']
      }
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(mappingTask, null, 2));
  
  console.log(chalk.bold.green('✅ Mapping task prepared!\n'));
  console.log(chalk.yellow(`📁 Task file: ${path.relative(process.cwd(), outputPath)}\n`));
  console.log(chalk.gray(`   Unmapped: ${unmappedComponents.length} components`));
  console.log(chalk.gray(`   Mapped:   ${mappedComponents.length} components\n`));
  
  console.log(chalk.bold('🤖 LLM Mapping Workflow:\n'));
  console.log(chalk.cyan('First iteration (map ~20-50 components):'));
  console.log(chalk.gray('  "Map the first 20 unmapped components from .tract/mapping-task.json'));
  console.log(chalk.gray('   to paths in the directory tree. Update .tract/components.yaml"\n'));
  
  console.log(chalk.cyan('Second iteration (map next batch):'));
  console.log(chalk.gray('  "Map the next 20 unmapped components to paths"\n'));
  
  console.log(chalk.cyan('Continue until all components mapped, then commit:'));
  console.log(chalk.gray('  "Commit the component mappings to git"\n'));
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

function generateSimpleTree(root, maxDepth) {
  const lines = [root];
  
  function scan(dir, depth, prefix) {
    if (depth > maxDepth) return;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.'));
      
      entries.forEach((entry, i) => {
        const isLast = i === entries.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        lines.push(prefix + connector + entry.name);
        
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        scan(path.join(dir, entry.name), depth + 1, newPrefix);
      });
    } catch (err) {
      // Skip unreadable directories
    }
  }
  
  scan(root, 0, '');
  return lines.join('\n');
}

module.exports = mapComponents;
