#!/bin/bash
# Bootstrap git repo for self-updates
# Run this ONCE on the server to enable self-updates

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Bootstrap Git Repo for Self-Updates"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if we're root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root (or with sudo)"
  exit 1
fi

# Clone the repo if it doesn't exist
if [ ! -d /opt/tract/tract/.git ]; then
  echo "📥 Cloning tract repository..."
  cd /opt/tract
  git clone https://github.com/johnmcmullan/tract.git tract
  chown -R tract:tract tract
else
  echo "✅ Git repo already exists"
fi

# Update systemd service to include PROJECT_NAME
echo "🔧 Updating systemd service..."
if ! grep -q "PROJECT_NAME=%i" /etc/systemd/system/tract-sync@.service; then
  # Add PROJECT_NAME environment variable after EnvironmentFile line
  sed -i '/^EnvironmentFile=/a Environment="PROJECT_NAME=%i"' /etc/systemd/system/tract-sync@.service
  echo "  ✅ Added PROJECT_NAME to service"
else
  echo "  ✅ PROJECT_NAME already configured"
fi

# Reload systemd
echo "🔄 Reloading systemd..."
systemctl daemon-reload

# Restart service
read -p "Restart tract-sync@app.service now? [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  systemctl restart tract-sync@app.service
  sleep 3
  systemctl status tract-sync@app.service --no-pager
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Bootstrap complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Self-update is now enabled. To update in future:"
echo "  curl -X POST http://localhost:3100/update"
echo ""
