# Tract CLI - Quick Start Example

## Installation

```bash
cd ~/work/tract/tract-cli
npm install
```

## Example: Onboard the APP Project

```bash
# Set your Jira credentials (or pass as --user/--token)
export JIRA_USERNAME=your.email@company.com
export JIRA_TOKEN=your-jira-api-token

# Create a directory for the project
mkdir -p ~/projects/app-issues
cd ~/projects/app-issues

# Run the onboard command
~/work/tract/tract-cli/bin/tract.js onboard \
  --jira https://your-jira-instance.atlassian.net \
  --project APP
```

## What You'll See

```
🚀 Tract Onboarding

Jira URL: https://your-jira-instance.atlassian.net
Project:  APP
Output:   /home/you/projects/app-issues

✓ Metadata fetched successfully

📊 Project Metadata:
   Name:        Application Development
   Key:         APP
   Lead:        John McMullan
   Issue Types: 5
   Statuses:    12
   Priorities:  5
   Components:  15

   Types: Bug, Story, Task, Epic, Improvement
   Statuses: To Do, In Progress, Code Review, Testing, Done...

✓ Configuration files generated

📝 Created Files:
   .arij/config.yaml
   .arij/components.yaml
   projects/APP.md
   README.md
   .gitignore

✓ Git repository initialized

✅ Onboarding complete!

Next Steps:

   # Review and edit configuration:
   cat .arij/config.yaml

   # Add component paths:
   vim .arij/components.yaml

   # Import existing Jira issues (future):
   tract import --project APP

   # Start creating tickets:
   # Create tickets/APP-001.md manually or use Tract UI
```

## Generated Files

### `.arij/config.yaml`
```yaml
prefix: APP
name: Application Development
description: Main application development project
types:
  - bug
  - story
  - task
  - epic
  - improvement
statuses:
  - to-do
  - in-progress
  - code-review
  - testing
  - done
priorities:
  - blocker
  - critical
  - major
  - minor
  - trivial
fields:
  required:
    - title
    - type
    - status
  optional:
    - assignee
    - reporter
    - priority
    - component
    - labels
    - created
    - updated
tag_field: labels
```

### `.arij/components.yaml`
```yaml
components:
  API:
    name: API
    description: Backend API services
    paths: []
  Frontend:
    name: Frontend
    description: React frontend application
    paths: []
  Database:
    name: Database
    description: Database schema and migrations
    paths: []
```

### `projects/APP.md`
```markdown
---
key: APP
name: Application Development
description: Main application development project
lead: John McMullan
created: 2026-02-12T09:00:00.000Z
---

# Application Development

Main application development project

## Project Information

- **Key**: APP
- **Lead**: John McMullan
- **Issue Types**: Bug, Story, Task, Epic, Improvement
- **Components**: 15

## Imported from Jira

This project was bootstrapped from Jira using `tract onboard`.

Original Jira project: https://jira.company.com/rest/api/2/project/APP
```

## Next Steps

1. **Review the configuration:**
   ```bash
   cat .arij/config.yaml
   # Edit if needed
   vim .arij/config.yaml
   ```

2. **Add component paths** (optional):
   ```bash
   vim .arij/components.yaml
   # Add paths like:
   #   API:
   #     paths:
   #       - src/api/
   #       - src/services/
   ```

3. **Create your first ticket:**
   ```bash
   cat > tickets/APP-001.md << 'EOF'
   ---
   id: APP-001
   title: Set up CI/CD pipeline
   type: task
   status: to-do
   priority: major
   created: 2026-02-12T09:00:00.000Z
   ---

   ## Description

   Set up GitHub Actions for continuous integration and deployment.

   ## Acceptance Criteria

   - [ ] Tests run on every PR
   - [ ] Deploys to staging on merge to main
   - [ ] Slack notifications on failures
   EOF
   ```

4. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Add first ticket APP-001"
   git push
   ```

5. **Start Tract UI** (optional):
   ```bash
   # In the tract repository
   cd ~/work/tract
   npm start
   # Browse to http://localhost:3000
   ```

## Common Commands

**Onboard multiple projects:**
```bash
for project in APP TB TINT TSD; do
  mkdir ~/projects/${project,,}-issues
  cd ~/projects/${project,,}-issues
  ~/work/tract/tract-cli/bin/tract.js onboard \
    --jira https://jira.company.com \
    --project $project
done
```

**Use with environment variables:**
```bash
export JIRA_USERNAME=your.email@company.com
export JIRA_TOKEN=your-api-token

~/work/tract/tract-cli/bin/tract.js onboard \
  --jira https://jira.company.com \
  --project APP
```

**Onboard to a specific directory:**
```bash
~/work/tract/tract-cli/bin/tract.js onboard \
  --jira https://jira.company.com \
  --project APP \
  --output ~/projects/app-issues
```

## Troubleshooting

**Authentication errors:**
- Get a Jira API token: https://id.atlassian.com/manage-profile/security/api-tokens
- Make sure to use your email as username (for Jira Cloud)
- For Jira Server, use your regular username

**Project not found:**
- Verify the project key is correct (case-insensitive)
- Make sure you have permission to view the project
- Try accessing it in your browser first

**Connection errors:**
- Check the Jira URL (include https://)
- Verify you're connected to VPN if required
- Test with: `curl https://jira.company.com/rest/api/2/myself`
