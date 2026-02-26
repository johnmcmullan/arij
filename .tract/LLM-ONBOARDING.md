# LLM-Assisted Onboarding Guide

> **Novel workflow:** Use your LLM CLI (Claude Code, OpenClaw, etc.) to guide Tract setup.

## For Humans: How to Onboard with an LLM

### Prerequisites

1. **Tract CLI installed.**

   **If your organisation has a tract catalog server** (ask your admin for the URL):
   ```bash
   curl http://tract-server:8080/install.sh | bash
   ```
   This installs the CLI *and* configures it to talk to your team's server. That's all you need.

   **If you're setting up tract for the first time** (no server yet):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/johnmcmullan/tract/master/install.sh | bash
   ```

2. **LLM CLI available:**
   - Claude Code: `claude`
   - OpenClaw: `openclaw`
   - Cursor AI, Copilot CLI, etc.

3. **In your project directory:**
   ```bash
   cd ~/work/my-project
   ```

### The Simple Way — Joining an existing team

If your organisation already uses tract, this is all you need:

```bash
curl http://tract-server:8080/install.sh | bash   # one-time
tract clone TRADING                                # clone your project
```

The `tract clone` command reads the catalog on your server, resolves any project dependencies, clones everything into `~/work/`, and writes a `workspace.yaml`. You're done.

**Start your LLM and say:**

```
Read the Tract onboarding skill at ~/.tract-cli/.tract/skills/tract-onboarding/SKILL.md
and help me set up Tract for this project with local-only mode and project key MYPROJ.
```

**The LLM will:**
1. Read the skill
2. Check if .tract/ already exists
3. Ask any clarifying questions
4. Run `tract onboard --project MYPROJ --local`
5. Verify it worked

### Example Session with Claude Code

```bash
cd ~/work/emacs
claude
```

**You:**
```
Read ~/.tract-cli/.tract/skills/tract-onboarding/SKILL.md and help me onboard 
this Emacs project to Tract. Use local-only mode with project key EMACS.
```

**Claude:**
```
I'll help you set up Tract. Let me read the onboarding skill...

[Reads the skill]

I see this is a fresh project (no .tract/ directory yet). 
I'll set up Tract in local-only mode with project key EMACS.

[Runs: tract onboard --project EMACS --local]

✓ Tract project created!

Created:
- .tract/config.yaml (project configuration)
- .tract/SCHEMA.md (complete specification)
- issues/ directory (for tickets)
- worklogs/ directory (for time tracking)

Initialized git repository and committed initial structure.

You can now create your first ticket:
  tract create EMACS --title "My first ticket"

Want me to verify the setup with 'tract doctor'?
```

**You:** "Yes, run doctor"

**Claude:**
```
[Runs: tract doctor]

🔍 Tract Doctor - Running diagnostics

✓ Git installed
✓ Git repository initialized
✓ Tract config directory exists
✓ Tract config file valid (Project: EMACS)
...

✅ All checks passed! Tract is healthy.

You're all set! What would you like to do first?
```

## For LLMs: How to Use the Skills

**When a user asks to set up Tract:**

### Step 1: Read the Onboarding Skill

```bash
cat ~/.tract-cli/.tract/skills/tract-onboarding/SKILL.md
```

**Key sections:**
- Purpose & triggers - When to use this skill
- Core workflow - Step-by-step process
- Example conversations - Patterns to follow

### Step 2: Check if Already Onboarded

```bash
ls .tract/config.yaml
```

- **If exists:** Don't onboard! Use tract-schema or tract-doctor skill instead.
- **If missing:** Proceed with onboarding.

### Step 3: Gather Information

Ask the user:
- Jira sync or local-only?
- What project key? (2+ chars, uppercase)
- (If Jira) What's the Jira URL, username, token?

### Step 4: Execute Onboarding

**For local-only:**
```bash
tract onboard --project <KEY> --local --output .
```

**For Jira sync:**
```bash
tract onboard \
  --project <KEY> \
  --jira <URL> \
  --user <username> \
  --token <token> \
  --output .
```

### Step 5: Verify Success

```bash
tract doctor
```

Should show green checks for all critical items.

### Step 6: Guide Next Steps

Suggest:
```bash
# Create first ticket
tract create <KEY> --title "First ticket"

# Log time (optional)
tract log <KEY>-1 1h "Initial setup"

# View schema
cat .tract/SCHEMA.md
```

## Skill Locations

**In installed Tract CLI:**
```
~/.tract-cli/.tract/skills/
├── tract-onboarding/
│   ├── SKILL.md
│   └── references/
├── tract-schema/
│   ├── SKILL.md
│   └── references/
└── tract-timetracking/
    ├── SKILL.md
    └── references/
```

**How to reference:**
- Absolute path: `~/.tract-cli/.tract/skills/tract-onboarding/SKILL.md`
- Or: `$HOME/.tract-cli/.tract/skills/tract-onboarding/SKILL.md`

## Common Patterns

### Pattern 1: Developer joining a team (catalog server available)

**User:** "I need to get set up on the TRADING project"

**LLM:**
1. Ask: "Do you have the tract catalog server URL from your admin?"
2. User: "Yes, it's http://tract-server:8080"
3. Run: `curl http://tract-server:8080/install.sh | bash` (if not already installed)
4. Run: `tract catalog list` — show available projects
5. Run: `tract clone TRADING` — clones TRADING and all dependencies
6. Run: `tract doctor` in the cloned repo
7. Done — no manual URL copying, no env vars to set

### Pattern 2: Quick Local Setup (no server)

**User:** "Set up Tract for this project"

**LLM:**
1. Read onboarding skill
2. Check for .tract/ (not found)
3. Ask: "What project key?"
4. User: "MYPROJ"
5. Run: `tract onboard --project MYPROJ --local`
6. Confirm success

### Pattern 3: Jira Sync Setup (no server)

**User:** "Connect this project to Jira"

**LLM:**
1. Read onboarding skill
2. Check for .tract/ (not found)
3. Ask: "Project key? Jira URL? Username?"
4. Check if JIRA_TOKEN env var set
5. Run: `tract onboard --project KEY --jira URL --user USERNAME`
6. Verify sync with `tract doctor`

### Pattern 4: User Confused About Tract

**User:** "What is Tract?"

**LLM:**
1. Read SCHEMA.md or README.md
2. Explain: "Tract is a git-native project management system..."
3. Ask: "Would you like to set it up for this project?"

### Pattern 5: Updating tract

**User:** "Is my tract up to date?" or "Update tract"

**LLM:**
1. Run: `tract update`
2. If already up to date: say so
3. If update found: it installs automatically, report the new version
4. Note: tract also checks for updates in the background every 8 hours and will notify at the start of the next command if a new version is available

## Troubleshooting

### LLM Can't Find Skills

**Problem:** Skill files not found

**Solution:**
```
Tell the LLM:
"The skills are at ~/.tract-cli/.tract/skills/. 
Please read tract-onboarding/SKILL.md from there."
```

### LLM Uses Wrong Tract

**Problem:** LLM thinks you mean ONNX Tract or another tool

**Solution:**
```
"I mean Tract the project management system. 
Read the onboarding skill at ~/.tract-cli/.tract/skills/tract-onboarding/SKILL.md"
```

### Onboarding Fails

**Problem:** `tract onboard` returns error

**Solution:**
- LLM should read error message
- Check common-errors.md reference
- Guide user through fix

## Why This Is Novel

**Traditional onboarding:**
1. Read docs
2. Copy/paste commands
3. Debug errors manually
4. Hope it works

**LLM-assisted onboarding:**
1. Tell LLM what you want
2. LLM reads the skill
3. LLM asks clarifying questions
4. LLM executes and verifies
5. LLM troubleshoots errors for you

**Benefits:**
- Natural language instead of command syntax
- Guided, conversational
- Error handling built-in
- Works for beginners and experts

## Keeping tract up to date

tract checks for updates in the background every 8 hours. If an update is available, you'll see a notice at the top of the next command's output:

```
💡 tract v1.0.4 is available (you have v1.0.3). Run: tract update
```

Run `tract update` to install the new version from your organisation's server. No admin rights needed, no separate download step.

Admins push updates by running `update-server` on the catalog server (or it triggers automatically via a GitHub/GitLab webhook). Developers pick up the update at their own pace.

## Future: Auto-Discovery

**Vision:** LLMs automatically discover Tract skills

**Potential approaches:**
1. Environment variable: `TRACT_SKILLS_PATH`
2. OpenClaw skill registry
3. Tract CLI command: `tract skills list`
4. README in ~/.tract-cli/ that guides LLMs

**For now:** Explicitly point LLM to skill path.

## Quick Reference Card

**For Humans - Copy/Paste This:**

```
Read ~/.tract-cli/.tract/skills/tract-onboarding/SKILL.md and help me 
set up Tract for this project as local-only with project key <KEY>.
```

**For LLMs - Instructions:**

1. Read: `~/.tract-cli/.tract/skills/tract-onboarding/SKILL.md`
2. Check: `ls .tract/config.yaml` (should not exist)
3. Ask: Jira or local? Project key?
4. Run: `tract onboard --project <KEY> [--local | --jira <url> --user <name>]`
5. Verify: `tract doctor`
6. Guide: Suggest creating first ticket

---

**This is a novel workflow.** You're using an LLM as the interface layer between human intent and technical execution. The skill files provide structured guidance for the LLM, making onboarding conversational instead of procedural.

Welcome to the future of developer tools. 🚀
