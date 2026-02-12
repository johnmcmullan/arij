# Tract CLI

Command-line tool for bootstrapping Tract projects from Jira.

## Installation

**From the tract repository:**
```bash
cd tract-cli
npm install
npm link  # Makes 'tract' command available globally
```

**Or use directly with npx:**
```bash
cd tract-cli
npm install
npx tract onboard --help
```

## Commands

### `tract onboard`

Bootstrap a new Tract project from a Jira project.

**Usage:**
```bash
tract onboard \
  --jira https://your-jira.atlassian.net \
  --project APP \
  --user john@company.com \
  --token your-api-token
```

**Options:**
- `--jira <url>` - Jira instance URL (required)
- `--project <key>` - Jira project key like APP, TB, TINT (required)
- `--user <username>` - Jira username (or set `JIRA_USERNAME`)
- `--token <token>` - Jira API token (or set `JIRA_TOKEN`)
- `--password <password>` - Jira password (or set `JIRA_PASSWORD`)
- `--output <dir>` - Output directory (defaults to current directory)
- `--submodule <path>` - Add as git submodule at this path (e.g., `tickets`)
- `--remote <url>` - Git remote URL for ticket repo (optional, can configure later)
- `--no-git` - Skip git initialization

**Example:**
```bash
# Standalone mode - create independent ticket repo
mkdir ~/projects/app-issues
cd ~/projects/app-issues
tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --user $JIRA_USERNAME \
  --token $JIRA_TOKEN

# Submodule mode - tickets alongside code (RECOMMENDED)
cd ~/work/apps  # Your code repository
tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --submodule tickets \
  --remote git@github.com:company/app-tickets.git

# Submodule mode - configure remote later
cd ~/work/apps
tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --submodule tickets
# Later: cd tickets && git remote add origin <url> && git push -u origin master

# Or with environment variables:
export JIRA_USERNAME=john@company.com
export JIRA_TOKEN=your-api-token
tract onboard --jira https://jira.company.com --project APP
```

**What it creates:**
```
.tract/
  config.yaml         # Project configuration (types, statuses, priorities)
  components.yaml     # Component mappings (if project has components)
projects/
  APP.md              # Project metadata
tickets/              # Directory for issue tickets (empty initially)
README.md             # Project README
.gitignore            # Git ignore file
```

**What it fetches from Jira:**
- Project details (name, description, lead)
- Issue types (Bug, Story, Task, Epic, etc.)
- Workflow statuses (To Do, In Progress, Done, etc.)
- Priorities (Blocker, Critical, Major, Minor, etc.)
- Components (with descriptions)
- Custom fields (for future use)

## Submodule Mode (Recommended for Code Repositories)

When tickets should live alongside your code, use `--submodule` to add tickets as a git submodule:

```bash
cd ~/work/apps  # Your code repository
tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --submodule tickets \
  --remote git@github.com:company/app-tickets.git
```

**What this does:**
1. Creates ticket repository with `.tract/` config
2. Initializes as git repository
3. Pushes to remote (if `--remote` provided)
4. Adds as git submodule at `~/work/apps/tickets/`
5. Creates `.gitattributes` with `export-ignore` rules
6. Commits submodule to parent code repo

**Result structure:**
```
~/work/apps/                   # Your code repository
├── .gitattributes             # tickets/ export-ignore
├── .gitmodules                # submodule definition
├── tickets/                   # ← git submodule
│   ├── .tract/
│   │   └── config.yaml
│   ├── tickets/
│   ├── projects/
│   └── README.md
├── src/                       # your application code
└── README.md
```

**Benefits:**
- **Tickets alongside code** - IDE/context available
- **Separate git history** - ticket changes don't clutter code commits
- **Clean client exports** - `git archive` excludes tickets (via export-ignore)
- **LLM-friendly** - Copilot CLI can work with both code and tickets
- **Version locking** - Can pin ticket state to code releases

**Client distribution:**
```bash
# Create release tarball for clients
git archive HEAD -o app-v2.0.tar.gz
# Result: Contains src/ and code, NO tickets/ or .tract/
```

**Configuring remote later:**
If you didn't provide `--remote` during onboarding:
```bash
cd ~/work/apps/tickets
git remote add origin git@github.com:company/app-tickets.git
git push -u origin master
```

## Authentication

The tool supports multiple authentication methods:

**1. API Token (Recommended for Jira Cloud):**
```bash
tract onboard --user email@company.com --token your-api-token ...
```

**2. Password (Jira Server/Data Center):**
```bash
tract onboard --user username --password your-password ...
```

**3. Environment Variables:**
```bash
export JIRA_USERNAME=john@company.com
export JIRA_TOKEN=your-api-token
# or
export JIRA_PASSWORD=your-password

tract onboard --jira https://jira.company.com --project APP
```

### Getting a Jira API Token

**Jira Cloud:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name like "Tract CLI"
4. Copy the token (you won't see it again!)

**Jira Server/Data Center:**
- Use your regular password
- Or generate a Personal Access Token in user settings

## Workflow

**1. Onboard a project:**
```bash
mkdir ~/projects/app-issues
cd ~/projects/app-issues
tract onboard --jira https://jira.company.com --project APP
```

**2. Review configuration:**
```bash
cat .tract/config.yaml
# Edit if needed: vim .tract/config.yaml
```

**3. Configure components (if applicable):**
```bash
vim .tract/components.yaml
# Add file paths for each component
```

**4. Start using Tract:**
```bash
# Option A: Create tickets manually
vim tickets/APP-001.md

# Option B: Use Tract web UI
# (Start Tract server and point it to this directory)

# Option C: Import existing Jira issues (future feature)
tract import --project APP
```

## Examples

**Onboard multiple projects:**
```bash
for project in APP TB TINT TSD; do
  mkdir ~/projects/${project,,}-issues
  cd ~/projects/${project,,}-issues
  tract onboard --jira https://jira.company.com --project $project
done
```

**Onboard to a specific directory:**
```bash
tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --output ~/projects/app-issues
```

**Onboard without git initialization:**
```bash
tract onboard \
  --jira https://jira.company.com \
  --project APP \
  --no-git
```

## Troubleshooting

**"401 Unauthorized":**
- Check your username and token/password
- For Jira Cloud, make sure you're using an API token, not your password
- Verify credentials with: `curl -u email@company.com:token https://jira.company.com/rest/api/2/myself`

**"404 Not Found":**
- Verify the project key exists: `--project APP`
- Check you have permission to view the project
- Try accessing the project in your browser first

**"Directory not empty":**
- The tool requires an empty directory (except .git)
- Use a different output directory or clean up existing files

**"ENOTFOUND" or connection errors:**
- Check the Jira URL is correct
- Verify you can access it in a browser
- Check for VPN or firewall issues

## Future Commands

**`tract import`** (planned)
- Import existing Jira issues as markdown files
- Preserves history, comments, attachments
- Configurable date ranges and filters

**`tract sync`** (planned)
- Bidirectional sync between Tract and Jira
- For gradual migration scenarios

**`tract validate`** (planned)
- Validate ticket files against .tract schema
- Check for missing required fields

## Development

**Run locally:**
```bash
cd tract-cli
npm install
node bin/tract.js onboard --help
```

**Link for global use:**
```bash
npm link
tract --version
```

**Debug mode:**
```bash
NODE_DEBUG=* tract onboard ...
```
