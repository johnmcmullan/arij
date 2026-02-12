const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

class ConfigGenerator {
  constructor(metadata) {
    this.metadata = metadata;
  }

  normalizeStatus(status) {
    return status
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  normalizeType(type) {
    return type
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  generateConfig() {
    const { project, statuses, issueTypes, priorities } = this.metadata;

    const config = {
      prefix: project.key,
      name: project.name,
      description: project.description || '',
      
      types: issueTypes.map(type => this.normalizeType(type.name)),
      
      statuses: statuses.map(status => this.normalizeStatus(status)),
      
      priorities: priorities.map(p => p.name.toLowerCase()),
      
      fields: {
        required: ['title', 'type', 'status'],
        optional: ['assignee', 'reporter', 'priority', 'component', 'labels', 'created', 'updated']
      },
      
      tag_field: 'labels'
    };

    return yaml.dump(config, { lineWidth: -1 });
  }

  generateComponents() {
    const { components } = this.metadata;

    if (!components || components.length === 0) {
      return null;
    }

    const componentsConfig = {
      components: {}
    };

    components.forEach(component => {
      componentsConfig.components[component.name] = {
        name: component.name,
        description: component.description || '',
        paths: [] // User will need to fill these in
      };
    });

    return yaml.dump(componentsConfig, { lineWidth: -1 });
  }

  generateProjectMetadata() {
    const { project } = this.metadata;
    
    const frontmatter = {
      key: project.key,
      name: project.name,
      description: project.description || '',
      lead: project.lead?.displayName || '',
      created: new Date().toISOString()
    };

    const markdown = `---
${yaml.dump(frontmatter).trim()}
---

# ${project.name}

${project.description || 'Project imported from Jira'}

## Project Information

- **Key**: ${project.key}
- **Lead**: ${project.lead?.displayName || 'N/A'}
- **Issue Types**: ${this.metadata.issueTypes.map(t => t.name).join(', ')}
- **Components**: ${this.metadata.components.length}

## Imported from Jira

This project was bootstrapped from Jira using \`tract onboard\`.

Original Jira project: ${project.self}
`;

    return markdown;
  }

  generateReadme() {
    const { project } = this.metadata;

    return `# ${project.name} (${project.key})

${project.description || 'Project imported from Jira'}

## Getting Started

This is a Tract project - a Jira replacement using Markdown+Git.

### Structure

\`\`\`
.arij/                 # Project configuration
  config.yaml          # Statuses, types, priorities
  components.yaml      # Component definitions
projects/              # Project metadata
  ${project.key}.md            # This project
tickets/               # Issue tickets
  ${project.key}-001.md        # First ticket
  ${project.key}-002.md        # Second ticket
  ...
\`\`\`

### Creating Tickets

Tickets are markdown files with YAML frontmatter:

\`\`\`markdown
---
id: ${project.key}-001
title: Example ticket
type: task
status: todo
priority: medium
created: 2026-02-12T09:00:00.000Z
---

## Description

Your ticket description here...

## Comments

**john.doe** (2026-02-12T10:00:00.000Z):

First comment...
\`\`\`

### Using Tract

1. **Web UI**: Run \`npm start\` in the tract directory
2. **Git**: All changes are version controlled
3. **Search**: Use \`grep\` or \`ripgrep\` to search tickets
4. **Import**: Run \`tract import --project ${project.key}\` to import existing Jira issues

### Configuration

Edit \`.arij/config.yaml\` to customize:
- Issue types
- Workflow statuses
- Priorities
- Required/optional fields

## Imported from Jira

Original project: ${project.self}
Imported: ${new Date().toISOString()}
`;
  }

  writeFiles(outputDir) {
    const files = [];

    // Create directories
    const arijDir = path.join(outputDir, '.arij');
    const projectsDir = path.join(outputDir, 'projects');
    const ticketsDir = path.join(outputDir, 'tickets');

    [arijDir, projectsDir, ticketsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Write .arij/config.yaml
    const configPath = path.join(arijDir, 'config.yaml');
    fs.writeFileSync(configPath, this.generateConfig());
    files.push(configPath);

    // Write .arij/components.yaml if components exist
    const componentsYaml = this.generateComponents();
    if (componentsYaml) {
      const componentsPath = path.join(arijDir, 'components.yaml');
      fs.writeFileSync(componentsPath, componentsYaml);
      files.push(componentsPath);
    }

    // Write projects/{KEY}.md
    const projectPath = path.join(projectsDir, `${this.metadata.project.key}.md`);
    fs.writeFileSync(projectPath, this.generateProjectMetadata());
    files.push(projectPath);

    // Write README.md
    const readmePath = path.join(outputDir, 'README.md');
    fs.writeFileSync(readmePath, this.generateReadme());
    files.push(readmePath);

    // Create .gitignore if it doesn't exist
    const gitignorePath = path.join(outputDir, '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, 'node_modules/\n*.log\n.DS_Store\n');
      files.push(gitignorePath);
    }

    return files;
  }
}

module.exports = ConfigGenerator;
