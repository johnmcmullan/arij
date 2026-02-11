#!/bin/bash
# Git helper for Tract - commit changes to tickets

if [ "$#" -eq 0 ]; then
    echo "Usage: ./git-commit.sh <message>"
    echo "Example: ./git-commit.sh 'Update ticket JK-001 status'"
    exit 1
fi

cd "$(dirname "$0")"

# Add all ticket and project changes
git add tickets/*.md projects/*.md 2>/dev/null

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "No changes to commit"
    exit 0
fi

# Commit with message
git commit -m "$1"

echo "✓ Committed changes to git"
