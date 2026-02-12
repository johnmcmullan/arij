#!/bin/bash
# Bootstrap script - run once to get the update script onto the server
# Usage: curl -sSL https://raw.githubusercontent.com/johnmcmullan/tract/master/tract-sync/bootstrap-update.sh | sudo bash -s app

set -e

PROJECT=${1:-app}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Bootstrap Tract Sync Update"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Ensure /opt/tract/tract exists
if [ ! -d /opt/tract/tract ]; then
  echo "❌ /opt/tract/tract not found. Run install-service.sh first."
  exit 1
fi

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
cd /opt/tract/tract
sudo -u root git fetch origin
sudo -u root git reset --hard origin/master
chown -R tract:tract /opt/tract/tract

# Make update script executable
chmod +x /opt/tract/tract/tract-sync/update-server.sh

echo ""
echo "✅ Bootstrap complete!"
echo ""
echo "Now you can update with:"
echo "  sudo /opt/tract/tract/tract-sync/update-server.sh ${PROJECT}"
echo ""

# Ask if they want to continue with the update
read -p "Continue with full update now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  /opt/tract/tract/tract-sync/update-server.sh ${PROJECT}
fi
