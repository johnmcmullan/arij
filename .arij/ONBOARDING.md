# Arij Onboarding Interview

> This document is read by the LLM running `arij init`. Conduct this as a conversation, not a form. Offer smart defaults. Let the user skip anything. Generate `.arij/config.yaml` and the directory structure at the end.

---

## Interview Flow

### 1. Operating Profile

> "Are you setting up Arij for a **shared server** or a **developer workstation**? This changes how things work under the hood."

- **Server:** Standalone repo clones, multi-user, service account git identity, REST API, cross-project reporting
- **Developer:** Submodules in code repos, single-user, direct commits with your git identity, branch validation

Store as `profile: server` or `profile: developer` in config.yaml. See `FEDERATION.md` for the full breakdown of how these modes differ.

Default: `developer` (most common for initial setup)

### 2. Project Name & Prefix

> "What's your project called? And what prefix do you want for ticket IDs — like TB for Tbricks, or APP for your app? Keep it short, 2-4 uppercase letters."

- Validate: uppercase letters only, 2-4 chars
- If they give a name but no prefix, suggest one derived from the name

### 3. Single or Multi-Project Repo?

> "Is this the only project in this repo, or will you have multiple projects tracked here? Most repos are single-project — tickets go in `tickets/`. Multi-project means separate directories like `tickets/TB/`, `tickets/APP/`."

- Default: single project
- If multi-project, ask for each project's prefix and repeat the type/status questions per project (or ask if they share the same config)

### 4. Ticket Types

> "What kinds of tickets do you work with? The usual set is **bug, story, task, epic** — does that work, or do you want to customize? You can also go wildcard mode where any type is accepted, no validation."

- Default: `[bug, story, task, epic]`
- If they mention support cases, incidents, etc., add those
- Wildcard: `['*']`

### 5. Statuses & Workflow

> "How about statuses? A common flow is: **backlog → todo → in-progress → review → done**. Want to use that, tweak it, or define your own? You can also go wildcard if you don't want status validation."

- Default: `[backlog, todo, in-progress, review, done]`
- If they describe a different workflow, map it
- Wildcard: `['*']`

### 6. Tagging Field Name

> "One quick preference thing — do you call them **labels** or **tags**? This just determines the field name in your ticket frontmatter. Either way it's a freeform list you can put whatever you want in."

- Default: `labels`
- Alternative: `tags`
- Store as `tag_field` in config.yaml
- This field name is used everywhere: frontmatter, board filters, queries

### 7. Priority Levels

> "Do you want defined priority levels? Something like **critical, high, medium, low** is standard. Or you can skip this entirely — not every team needs formal priority management."

- Default: `[critical, high, medium, low]`
- Skip: omit `priorities` from config entirely
- Custom: whatever they want

### 8. Estimation Style

> "How do you estimate work — story points (1, 2, 3, 5, 8...), time-based (3d, 8h), or both? And do you want to track time spent and remaining, or just the initial estimate?"

- Options:
  - `points` — estimate field takes numbers
  - `time` — estimate field takes duration strings (3d, 8h)
  - `both` — estimate can be either
  - `none` — skip estimation entirely
- If they want time tracking: enable `logged` and `remaining` fields (just mention they're available, they're always optional in the schema)
- Store preference as `estimate_style` in config.yaml

### 9. Sprints

> "Do you work in sprints? If so, what's your cadence — one week, two weeks, something else?"

- Default: skip (not everyone sprints)
- If yes: create an example sprint file in `.arij/sprints/`
- Store `sprint_cadence` in config.yaml (e.g., `2w`, `1w`, `3w`)

### 10. Components

> "Do you want to track components — like which part of the codebase a ticket relates to? I can scan your repo and suggest some, or you can set them up later."

- If yes and repo has code: offer to run the component bootstrap (see GUIDE.md §3)
- If yes but later: create empty `components.yaml`
- If no: skip

### 11. Rank / Backlog Ordering

> "Do you use backlog ranking — like dragging tickets up and down to prioritize? If so, I'll add a rank field. It uses gapped integers (100, 200, 300) so you can always insert between items."

- Default: skip
- If yes: note that `rank` is available as an optional field, no config needed

### 12. Jira Import

> "Last thing — are you migrating from Jira? If you have an existing instance, I can help import your tickets. I'd just need your Jira URL, an API token, and which project keys to pull."

- If yes, collect:
  - `jira_base_url`: e.g., `https://acme.atlassian.net`
  - `jira_api_token`: API token (suggest they use an env var, don't store in config)
  - `jira_projects`: list of Jira project keys to import (e.g., `[PROJ, SUP]`)
- Store import config in `.arij/import.yaml` (separate from main config, may contain sensitive info)
- If no: skip, move on

---

## After the Interview

Generate the following:

1. **`.arij/config.yaml`** with all collected settings
2. **`tickets/`** directory (with `.gitkeep`)
3. **`.arij/components.yaml`** if requested (empty or bootstrapped)
4. **Empty directories**: `.arij/boards/`, `.arij/sprints/`, `.arij/releases/`, `.arij/customers/`, `.arij/queries/`
5. **`.arij/import.yaml`** if Jira migration was requested
6. **`.gitattributes`** with export-ignore rules

Show the user a summary of what was generated and commit with: `arij: initialize project {PREFIX}`

---

## Tone Notes

- Be conversational, not robotic. You're a colleague helping them set up, not a wizard dialog.
- If they say "just use defaults for everything", respect that — generate config with all defaults and move on.
- If they seem unsure about something, explain briefly why it matters (or doesn't).
- Don't ask all questions if they're clearly in a hurry. Read the room.
- "Skip" is always a valid answer.
