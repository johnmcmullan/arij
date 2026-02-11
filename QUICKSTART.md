# Quick Start Guide

## Installation

```bash
cd ~/work/tract
npm install
npm start
```

Visit **http://localhost:3000**

## Creating Your First Ticket

### Via Web UI
1. Go to http://localhost:3000
2. Click on project "JK"
3. Click "New Ticket"
4. Fill out the form and submit

### Via Command Line (Manual)
Create a new file in `tickets/` directory:

```bash
cat > tickets/JK-027.md << 'EOF'
---
id: JK-027
title: "My New Feature"
status: todo
type: task
created: '2026-02-11'
priority: medium
assignee: null
component: null
labels: []
---

## Description

This is my new feature request with **markdown** support!

## Acceptance Criteria

- [ ] It works
- [ ] It's tested
- [ ] It's documented
EOF
```

Refresh the page - your ticket appears automatically!

## Managing Tickets with Git

```bash
# Commit your changes
./git-commit.sh "Added new feature request"

# Or use git directly
git add tickets/ projects/
git commit -m "Updated project tickets"

# View history
git log --oneline -- tickets/

# See what changed
git diff tickets/JK-027.md

# Revert a change
git checkout HEAD~1 -- tickets/JK-027.md
```

## Searching Tickets

```bash
# Find all high priority tickets
grep "priority: high" tickets/*.md

# Find tickets assigned to John
grep "assignee: John" tickets/*.md

# Search descriptions for keywords
grep -h "authentication" tickets/*.md

# Find all todo tickets
grep "status: todo" tickets/*.md

# Using ripgrep (faster)
rg "priority: critical" tickets/
```

## Adding a Comment

### Via Web UI
1. Open a ticket
2. Scroll to "Add Comment" form
3. Enter your name and comment (markdown supported)
4. Submit

### Via Command Line
```bash
cat >> tickets/JK-027.md << 'EOF'

## Comments

**Your Name** (2026-02-11T10:00:00Z):

This is my comment with **markdown** support!

---

EOF
```

## Changing Status

### Via Board
1. Go to http://localhost:3000/board
2. Drag ticket to different column
3. Status updates automatically

### Via Command Line
```bash
# Edit the file directly
sed -i 's/status: todo/status: in_progress/' tickets/JK-027.md
```

## Creating a New Project

```bash
cat > projects/MYPROJECT.md << 'EOF'
---
name: My Awesome Project
created: '2026-02-11'
archived: false
---

This is the description of my project with **markdown** support.
EOF
```

Now create tickets with ID pattern: `MYPROJECT-001.md`, `MYPROJECT-002.md`, etc.

## Best Practices

1. **Commit Often:** Use `./git-commit.sh "message"` after making changes
2. **Use Branches:** Create feature branches for large changes
3. **Markdown Everything:** Descriptions and comments support full markdown
4. **Extend Frontmatter:** Add custom fields as needed (e.g., `estimated_hours: 5`)
5. **Search First:** Use grep/ripgrep before creating duplicates

## Tips & Tricks

### Bulk Status Change
```bash
# Move all todo tickets to in_progress
sed -i 's/status: todo/status: in_progress/' tickets/*-todo-*.md
```

### Export to JSON
```bash
# Simple export (requires jq)
for f in tickets/*.md; do
  echo "$f"
  # Parse frontmatter and convert to JSON
done
```

### Template for New Tickets
```bash
#!/bin/bash
# save as: new-ticket.sh
NEXT=$(ls tickets/$1-*.md | tail -1 | grep -o '[0-9]*' | tail -1)
NEXT=$((NEXT + 1))
ID=$(printf "%s-%03d" "$1" "$NEXT")

cat > "tickets/$ID.md" << EOF
---
id: $ID
title: "$2"
status: todo
type: task
created: '$(date +%Y-%m-%d)'
priority: medium
assignee: null
component: null
labels: []
---

## Description

$3
EOF

echo "Created tickets/$ID.md"
```

Usage: `./new-ticket.sh JK "New Feature" "Feature description here"`

## Need Help?

- Check the README.md for full documentation
- Check MIGRATION.md for technical details
- Tickets are just markdown files - edit them directly!
- Git is your friend - commit early, commit often

## What's Next?

- Add more projects in `projects/` directory
- Customize frontmatter fields for your needs
- Set up GitHub/GitLab repo for team collaboration
- Build custom search tools
- Create automation scripts
- Integrate with your workflow
