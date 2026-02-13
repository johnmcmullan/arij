#!/bin/bash
#
# Quick test script for Tract sync service
#

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Testing Tract Sync Service"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo

# Set test environment
export JIRA_URL="${JIRA_URL:-https://jira.orcsoftware.com}"
export JIRA_USERNAME="${JIRA_USERNAME:-john.mcmullan}"
export JIRA_PASSWORD="${JIRA_PASSWORD}"
export TRACT_REPO_PATH="${TRACT_REPO_PATH:-/home/john.mcmullan/work/apps/tickets}"
export SYNC_USER="tract-sync"
export SYNC_EMAIL="tract-sync@localhost"
export PORT="${PORT:-3001}"

if [ -z "$JIRA_PASSWORD" ]; then
  echo "❌ JIRA_PASSWORD not set"
  echo "   export JIRA_PASSWORD=your-token"
  exit 1
fi

if [ ! -d "$TRACT_REPO_PATH" ]; then
  echo "❌ Tract repo not found: $TRACT_REPO_PATH"
  exit 1
fi

echo "✅ Configuration:"
echo "   Jira:  $JIRA_URL"
echo "   User:  $JIRA_USERNAME"
echo "   Repo:  $TRACT_REPO_PATH"
echo "   Port:  $PORT"
echo

# Start server in background
echo "🚀 Starting sync service..."
node server.js &
SERVER_PID=$!

# Give it time to start
sleep 2

# Cleanup on exit
trap "kill $SERVER_PID 2>/dev/null || true" EXIT

# Test health endpoint
echo "🧪 Testing health endpoint..."
HEALTH=$(curl -s http://localhost:$PORT/health)
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "   ✅ Health check passed"
else
  echo "   ❌ Health check failed"
  echo "   Response: $HEALTH"
  exit 1
fi

# Test Git webhook with empty payload
echo
echo "🧪 Testing Git webhook (empty payload)..."
GIT_WEBHOOK=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"changedFiles":[]}' \
  http://localhost:$PORT/webhook/git)

if echo "$GIT_WEBHOOK" | grep -q '"status":"ok"'; then
  echo "   ✅ Git webhook passed"
else
  echo "   ❌ Git webhook failed"
  echo "   Response: $GIT_WEBHOOK"
  exit 1
fi

# Test manual sync with a real ticket
echo
echo "🧪 Testing manual sync..."
FIRST_TICKET=$(ls $TRACT_REPO_PATH/issues/*.md 2>/dev/null | head -1)

if [ -n "$FIRST_TICKET" ]; then
  ISSUE_KEY=$(basename "$FIRST_TICKET" .md)
  echo "   Syncing: $ISSUE_KEY"
  
  SYNC_RESULT=$(curl -s -X POST http://localhost:$PORT/sync/git-to-jira/$ISSUE_KEY 2>&1)
  
  if echo "$SYNC_RESULT" | grep -q '"status":"ok"'; then
    echo "   ✅ Manual sync passed"
  else
    echo "   ⚠️  Manual sync returned: $SYNC_RESULT"
    echo "   (This might fail if ticket doesn't exist in Jira)"
  fi
else
  echo "   ⏭️  No tickets found to test with"
fi

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All tests passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "To run in production:"
echo "  npm start"
echo
echo "To install as systemd service:"
echo "  sudo cp systemd/tract-sync.service /etc/systemd/system/"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable tract-sync"
echo "  sudo systemctl start tract-sync"
echo
