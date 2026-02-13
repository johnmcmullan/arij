#!/bin/bash
#
# Tract Terminal Demo Script
# 
# Usage:
#   1. Install asciinema: npm install -g asciinema
#   2. Run: asciinema rec tract-demo.cast -c "./DEMO.sh"
#   3. Upload to asciinema.org or convert to GIF/video
#
# This script demonstrates the full Tract workflow in ~90 seconds.
#

# Configuration
DEMO_SPEED=1.5  # Typing speed multiplier
PAUSE_SHORT=1   # Short pause (seconds)
PAUSE_LONG=2    # Long pause (seconds)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Helper functions
type_command() {
    local cmd="$1"
    local speed=${2:-0.05}
    echo -ne "${CYAN}\$ ${NC}"
    for ((i=0; i<${#cmd}; i++)); do
        echo -n "${cmd:$i:1}"
        sleep $speed
    done
    echo
    sleep 0.3
}

run_command() {
    local cmd="$1"
    type_command "$cmd"
    eval "$cmd"
}

comment() {
    local text="$1"
    echo
    echo -e "${GRAY}# $text${NC}"
    sleep $PAUSE_SHORT
}

pause() {
    local duration=${1:-$PAUSE_SHORT}
    sleep $duration
}

clear_screen() {
    clear
    echo -e "${BOLD}${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${BLUE}║                    Tract Demo                              ║${NC}"
    echo -e "${BOLD}${BLUE}║        Git-native project management for developers       ║${NC}"
    echo -e "${BOLD}${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo
}

# ============================================================================
# DEMO START
# ============================================================================

clear_screen

comment "Let's see how Tract works for developers"
pause $PAUSE_LONG

# Scene 1: Health Check
comment "First, check everything is set up correctly"
run_command "tract doctor"
pause $PAUSE_LONG

comment "✓ All green - we're ready to work"
pause $PAUSE_SHORT

# Scene 2: Create a Ticket (via CLI)
clear_screen
comment "Create a ticket from the terminal - no browser needed"
run_command "tract create APP \\"
sleep 0.2
type_command "  --title \"Fix session timeout bug\" \\"
type_command "  --type bug \\"
type_command "  --priority high"
sleep 0.3

# Simulate the command
echo -e "\n${GREEN}✅ Created APP-3456${NC}"
echo -e "${GRAY}   File: issues/APP-3456.md${NC}"
echo -e "${GRAY}   Synced to Jira and committed to git${NC}\n"
pause $PAUSE_LONG

comment "That created a markdown file AND synced to Jira"
pause $PAUSE_SHORT

# Scene 3: View the Ticket
comment "Let's see what it created"
run_command "cat issues/APP-3456.md"
pause $PAUSE_LONG

# Scene 4: Edit the Ticket (show file)
comment "Edit tickets like any markdown file"
run_command "vim issues/APP-3456.md"
pause $PAUSE_SHORT

comment "(Made some changes, added details)"
pause $PAUSE_SHORT

# Scene 5: Git Workflow
clear_screen
comment "Commit and push like any git repo"
run_command "git add issues/APP-3456.md"
run_command "git commit -m \"Update APP-3456: Add reproduction steps\""
run_command "git push"
pause $PAUSE_LONG

comment "Changes automatically sync to Jira - managers see them immediately"
pause $PAUSE_LONG

# Scene 6: Log Time
clear_screen
comment "Log time - no forms, no clicking"
run_command "tract log APP-3456 2h \"Fixed session TTL, increased to 30 minutes\""
pause $PAUSE_SHORT

echo -e "\n${GREEN}✅ Time logged successfully!${NC}"
echo -e "${GRAY}   Entry: 2026-02-13T20:30:00Z${NC}"
echo -e "${GRAY}   Synced to Jira and committed to git${NC}\n"
pause $PAUSE_LONG

# Scene 7: Check Timesheet
comment "View your timesheet for today"
run_command "tract timesheet"
pause $PAUSE_LONG

# Scene 8: Work Offline
clear_screen
comment "Jira down? No problem - work offline"
run_command "vim issues/APP-3457.md"
pause $PAUSE_SHORT

comment "(Created new ticket offline)"
pause $PAUSE_SHORT

run_command "git commit -am \"Create APP-3457: API rate limiting\""
pause $PAUSE_SHORT

comment "When Jira comes back online, next push syncs automatically"
pause $PAUSE_LONG

# Scene 9: Search & Grep
clear_screen
comment "Search tickets instantly with grep - way faster than Jira"
run_command "grep -r \"timeout\" issues/"
pause $PAUSE_LONG

comment "Or use git to see history"
run_command "git log --oneline issues/APP-3456.md"
pause $PAUSE_LONG

# Scene 10: LLM Integration
clear_screen
comment "Best part: LLMs can do all of this for you"
echo
echo -e "${YELLOW}You:${NC}  \"Create a ticket for the auth bug we discussed\""
pause $PAUSE_SHORT
echo -e "${CYAN}LLM:${NC}  [runs: tract create APP --title \"Fix auth bug\" ...]"
echo -e "      ${GREEN}Created APP-3458${NC}"
pause $PAUSE_SHORT
echo
echo -e "${YELLOW}You:${NC}  \"I spent 3 hours on APP-3456\""
pause $PAUSE_SHORT
echo -e "${CYAN}LLM:${NC}  [runs: tract log APP-3456 3h ...]"
echo -e "      ${GREEN}Logged 3h to APP-3456${NC}"
pause $PAUSE_LONG

comment "No context switching. No slow web UI. Just talk."
pause $PAUSE_LONG

# Final Screen
clear_screen
echo -e "${BOLD}${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║                     That's Tract                           ║${NC}"
echo -e "${BOLD}${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo
echo -e "${BOLD}What you saw:${NC}"
echo -e "  ${GREEN}✓${NC} Create tickets from terminal"
echo -e "  ${GREEN}✓${NC} Edit as markdown files"
echo -e "  ${GREEN}✓${NC} Use git for version control"
echo -e "  ${GREEN}✓${NC} Log time in seconds"
echo -e "  ${GREEN}✓${NC} Work offline"
echo -e "  ${GREEN}✓${NC} Search with grep (faster than Jira)"
echo -e "  ${GREEN}✓${NC} Delegate to LLMs"
echo
echo -e "${BOLD}All while syncing to Jira automatically.${NC}"
echo
echo -e "${GRAY}Learn more: ${BLUE}https://github.com/johnmcmullan/tract${NC}"
echo

pause 3
