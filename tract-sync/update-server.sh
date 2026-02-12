#!/bin/bash
# Update tract-sync service on server
# Usage: ./update-server.sh [project]
# Example: ./update-server.sh app

set -e

PROJECT=${1:-app}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Updating Tract Sync: ${PROJECT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Pull latest code from GitHub (as root, no tract login needed)
echo "📥 Pulling latest code from GitHub..."
cd /opt/tract/tract
git fetch origin
git reset --hard origin/master
chown -R tract:tract /opt/tract/tract

# Copy sync service files
echo "📦 Copying sync service files..."
cd /opt/tract/tract-sync
cp -v /opt/tract/tract/tract-sync/lib/*.js lib/
cp -v /opt/tract/tract/tract-sync/server.js .
chown tract:tract lib/*.js server.js

# Install any new npm dependencies
echo "📦 Checking npm dependencies..."
cd /opt/tract/tract-sync
if ! diff -q /opt/tract/tract/tract-sync/package.json package.json >/dev/null 2>&1; then
  echo "   Dependencies changed, running npm install..."
  cp /opt/tract/tract/tract-sync/package.json .
  npm install --production
  chown -R tract:tract node_modules package*.json
fi

# Restart service
echo "🔄 Restarting service..."
systemctl restart tract-sync@${PROJECT}.service

# Wait and check status
echo "⏳ Waiting for service to start..."
sleep 3

if systemctl is-active --quiet tract-sync@${PROJECT}.service; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Update successful!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  systemctl status tract-sync@${PROJECT}.service --no-pager -l | head -20
else
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ Service failed to start!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  journalctl -u tract-sync@${PROJECT}.service -n 50 --no-pager
  exit 1
fi
