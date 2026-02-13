#!/bin/bash
#
# Demo Setup Script
# Creates mock data so DEMO.sh can run without a real Tract server
#

set -e

echo "Setting up demo environment..."

# Create mock issue
mkdir -p issues
cat > issues/APP-3456.md << 'EOF'
---
title: Fix session timeout bug
type: Bug
status: In Progress
priority: High
assignee: john.mcmullan
created: 2026-02-13T18:30:00Z
updated: 2026-02-13T19:45:00Z
components: [Auth, Backend]
labels: [security, urgent]
---

Users are getting logged out after 5 minutes of inactivity. The session timeout should be 30 minutes, not 5.

## Reproduction Steps

1. Log in to the application
2. Wait 5 minutes without any activity
3. Try to navigate to a new page
4. You're redirected to login (session expired)

## Expected Behavior

Session should remain active for 30 minutes of inactivity.

## Technical Details

The issue is in `auth-middleware.js` where `SESSION_TTL` is set to `300` (5 minutes in seconds) instead of `1800` (30 minutes).

## Comments

**john.mcmullan** - 2026-02-13 19:45:00

Investigating the auth middleware configuration.
EOF

# Create mock timesheet data
mkdir -p worklogs
cat > worklogs/2026-02.jsonl << 'EOF'
{"issue":"APP-3450","author":"john.mcmullan","time":"4h","started":"2026-02-13T09:00:00Z","comment":"Implemented new caching layer"}
{"issue":"APP-3451","author":"john.mcmullan","time":"2h","started":"2026-02-13T13:00:00Z","comment":"Code review and testing"}
{"issue":"APP-3452","author":"john.mcmullan","time":"1.5h","started":"2026-02-13T15:00:00Z","comment":"Bug fixes in payment processor"}
{"issue":"APP-3456","author":"john.mcmullan","time":"2h","started":"2026-02-13T20:30:00Z","comment":"Fixed session TTL, increased to 30 minutes"}
EOF

# Create a few more mock issues for grep demo
cat > issues/APP-3450.md << 'EOF'
---
title: Implement caching layer for API
type: Story
status: Done
priority: Medium
---

Add Redis caching to reduce database load.
EOF

cat > issues/APP-3451.md << 'EOF'
---
title: Add request timeout handling
type: Task
status: In Progress
priority: Low
---

Handle timeout errors gracefully in API clients.
EOF

cat > issues/APP-3457.md << 'EOF'
---
title: Implement API rate limiting
type: Story
status: To Do
priority: Medium
---

Add rate limiting to prevent API abuse. Should support:
- Per-user limits
- Per-IP limits
- Configurable thresholds
EOF

# Mock git commits for history demo
git add issues/APP-3456.md 2>/dev/null || true
git commit -m "Create APP-3456: Session timeout bug" 2>/dev/null || true
git commit --allow-empty -m "Update APP-3456: Add reproduction steps" 2>/dev/null || true
git commit --allow-empty -m "[tract-sync] Updated APP-3456 from Jira" 2>/dev/null || true

# Create mock tract commands (if server not available)
if ! command -v tract &> /dev/null; then
    mkdir -p /tmp/tract-demo-bin
    cat > /tmp/tract-demo-bin/tract << 'TRACT_SCRIPT'
#!/bin/bash
cmd="$1"
shift

case "$cmd" in
    doctor)
        echo -e "\033[1;36m\n🔍 Tract Doctor - Running diagnostics\n\033[0m"
        echo -e "\033[0;90mDirectory: $(pwd)\n\033[0m"
        echo -e "\033[0;32m✓\033[0m Git installed \033[0;90m(git version 2.39.0)\033[0m"
        echo -e "\033[0;32m✓\033[0m Git repository initialized"
        echo -e "\033[0;32m✓\033[0m Tract config directory exists"
        echo -e "\033[0;34mℹ\033[0m Tract config file valid \033[0;90m(Project: APP)\033[0m"
        echo -e "\033[0;34mℹ\033[0m Issues directory exists \033[0;90m(4 tickets)\033[0m"
        echo -e "\033[0;34mℹ\033[0m Git user configured \033[0;90m(John McMullan <john@example.com>)\033[0m"
        echo -e "\033[0;33m⚠\033[0m Sync server not set (optional for local use)"
        echo -e "\033[0;90m  Fix: export TRACT_SYNC_SERVER=http://tract-server:3100\033[0m"
        echo
        echo -e "\033[1m────────────────────────────────────────────────────────────\033[0m"
        echo -e "\033[1mSummary:\033[0m"
        echo -e "  \033[0;32m✓ 3 passed\033[0m"
        echo -e "  \033[0;34mℹ 3 info\033[0m"
        echo -e "  \033[0;33m⚠ 1 warnings\033[0m"
        echo
        echo -e "\033[0;33m⚠ Warnings found, but nothing critical.\033[0m\n"
        ;;
    
    create)
        echo -e "\n\033[0;36m📝 Creating ticket in APP...\033[0m"
        echo -e "\033[0;90m   Title: Fix session timeout bug\033[0m"
        echo -e "\033[0;90m   Type: bug\033[0m"
        sleep 1
        ;;
    
    log)
        sleep 1
        ;;
    
    timesheet)
        echo -e "\n\033[1mTimesheet for john.mcmullan - 2026-02-13\033[0m\n"
        echo "┌─────────┬──────────────┬──────┬────────────────────────────────┐"
        echo "│ Issue   │ Started      │ Time │ Comment                        │"
        echo "├─────────┼──────────────┼──────┼────────────────────────────────┤"
        echo "│ APP-3450│ 09:00        │ 4h   │ Implemented new caching layer  │"
        echo "│ APP-3451│ 13:00        │ 2h   │ Code review and testing        │"
        echo "│ APP-3452│ 15:00        │ 1.5h │ Bug fixes in payment processor │"
        echo "│ APP-3456│ 20:30        │ 2h   │ Fixed session TTL              │"
        echo "└─────────┴──────────────┴──────┴────────────────────────────────┘"
        echo
        echo -e "\033[1mTotal: 9.5h\033[0m ✅ (target: 8h)"
        echo
        ;;
    
    *)
        echo "Unknown command: $cmd"
        exit 1
        ;;
esac
TRACT_SCRIPT
    chmod +x /tmp/tract-demo-bin/tract
    export PATH="/tmp/tract-demo-bin:$PATH"
    echo "✓ Created mock 'tract' command for demo"
fi

echo "✓ Demo environment ready!"
echo
echo "Run the demo with:"
echo "  asciinema rec demo.cast -c './DEMO.sh'"
echo
echo "Or run manually:"
echo "  ./DEMO.sh"
