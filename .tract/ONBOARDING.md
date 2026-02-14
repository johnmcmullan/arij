# Onboarding Guide for LLMs

> How to help a user set up Tract

## When a User Wants to Set Up Tract

You have two options:

### Option 1: Interactive Mode (Recommended for Humans)

Run the interactive setup:

```bash
tract onboard --interactive
```

This will prompt for:
- Project key (e.g., APP, TB)
- Mode (local-only or Jira sync)
- Jira URL (if syncing)
- Credentials (if syncing)
- Output directory
- Whether to import existing tickets

**Use this when:** User is new to Tract, prefers Q&A, or hasn't gathered all info yet.

### Option 2: Full Arguments (Recommended for LLMs)

Gather all information from the user first, then call with complete arguments:

**For Jira sync:**
```bash
tract onboard \
  --project APP \
  --jira https://jira.company.com \
  --user john.mcmullan \
  --token <api-token> \
  --output ~/my-tickets \
  --import-tickets
```

**For local-only:**
```bash
tract onboard \
  --project APP \
  --local \
  --output ~/my-tickets
```

**Use this when:** You're an LLM helping a user, you've gathered the required info through conversation.

## Required Information

### For Jira Sync:
- `--project`: Project key (2+ characters, uppercase)
- `--jira`: Jira instance URL (https://...)
- `--user`: Jira username (or JIRA_USERNAME env var)
- `--token`: API token (or JIRA_TOKEN env var)
- `--output`: Where to create the project (default: current dir)

### For Local-Only:
- `--project`: Project key
- `--local`: Flag to skip Jira
- `--output`: Where to create the project (default: current dir)

## Gathering Credentials

**API Token:**
- Ask user: "Do you have JIRA_TOKEN set in your environment?"
- If yes: skip --token flag, it will auto-use env var
- If no: "You'll need a Jira API token. Get one from: https://id.atlassian.com/manage/api-tokens"

**Username:**
- Usually their email or company username
- Can also use JIRA_USERNAME env var

## After Onboarding

Once `tract onboard` succeeds, the user can:

1. **Create tickets:**
   ```bash
   cd <output-dir>
   tract create APP --title "My first ticket"
   ```

2. **Import existing Jira tickets** (if they skipped during onboard):
   ```bash
   tract import --status open
   ```

3. **Run diagnostics:**
   ```bash
   tract doctor
   ```

## Common Issues

**"Not in a Tract project"**
- User ran `tract` commands from wrong directory
- Tell them: `cd <output-dir>` first
- Or: `tract` searches parent dirs now (like git)

**"Jira authentication failed"**
- Wrong username/token
- Token expired
- URL incorrect (check https://, no trailing slash)

**"Directory not empty"**
- Onboard requires empty directory
- Suggest: `mkdir fresh-tickets && cd fresh-tickets && tract onboard ...`

## Example Conversation

```
User: "Help me set up Tract for our APP project"

LLM: "I can set up Tract for you. A few questions:
      1. Do you want to sync with Jira, or work locally only?
      2. If Jira: what's your Jira URL?
      3. What's your Jira username?
      4. Do you have JIRA_TOKEN set as an env variable?"

User: "Sync with Jira. URL is jira.company.com, username is john, and yeah I have the token set."

LLM: [Runs: tract onboard --project APP --jira https://jira.company.com --user john --import-tickets]
     "Connecting to Jira... Success! Found 47 components, 12 issue types.
      Importing open tickets... Done. 234 tickets imported.
      
      Your Tract project is ready at ./app-tickets/
      
      Try: cd app-tickets && tract doctor"
```

## Philosophy

**Don't use --interactive from an LLM.** It's designed for human Q&A flows.

**Do gather info conversationally, then call with full args.** You're the interface layer - parse user intent, validate inputs, then execute the command cleanly.

**Errors are your friend.** If `tract onboard` fails, read the error - it tells you exactly what's wrong. Pass that info back to the user clearly.

---

**Remember:** You're not just running commands - you're the natural language interface to Tract. Make it feel seamless.
