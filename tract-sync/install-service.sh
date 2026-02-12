#!/bin/bash
#
# Tract Sync Service Installer
# Sets up bidirectional Jira sync for a project
#
# Usage: sudo ./install-service.sh PROJECT_NAME
# Example: sudo ./install-service.sh APP
#

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

error() { echo -e "${RED}❌ $1${NC}" >&2; exit 1; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Check running as root
if [ "$EUID" -ne 0 ]; then 
  error "Please run as root: sudo ./install-service.sh PROJECT_NAME"
fi

# Check arguments
if [ $# -lt 1 ]; then
  error "Usage: sudo ./install-service.sh PROJECT_NAME\n   Example: sudo ./install-service.sh APP"
fi

PROJECT_NAME="$1"
PROJECT_LOWER=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]')
TRACT_HOME="/opt/tract"
TRACT_USER="tract"
TRACT_UID=751
REPO_DIR="${TRACT_HOME}/${PROJECT_LOWER}-tickets"
BARE_REPO="${TRACT_HOME}/${PROJECT_LOWER}-tickets.git"
SERVICE_NAME="tract-sync@${PROJECT_LOWER}"

echo -e "${BLUE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Tract Sync Service Installer"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"
echo "Project:     $PROJECT_NAME"
echo "Working dir: $REPO_DIR"
echo "Bare repo:   $BARE_REPO"
echo "Service:     ${SERVICE_NAME}.service"
echo ""

# Create tract user if doesn't exist
if ! id "$TRACT_USER" &>/dev/null; then
  info "Creating $TRACT_USER user (UID $TRACT_UID)..."
  useradd -r -u "$TRACT_UID" -s /sbin/nologin -d "$TRACT_HOME" -m "$TRACT_USER"
  success "Created $TRACT_USER user"
else
  info "$TRACT_USER user already exists"
fi

# Configure git for tract user
info "Configuring git for $TRACT_USER..."
sudo -u "$TRACT_USER" git config --global user.name "Tract Sync"
sudo -u "$TRACT_USER" git config --global user.email "tract-sync@localhost"
success "Git configured"

# Install tract CLI if not present
if [ ! -f "${TRACT_HOME}/bin/tract" ]; then
  info "Installing tract CLI..."
  
  # Determine source directory
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  TRACT_SOURCE=""
  
  # Check if running from tract repo
  if [ -f "$SCRIPT_DIR/../tract-cli/bin/tract.js" ]; then
    info "Using local tract installation from $SCRIPT_DIR/.."
    TRACT_SOURCE="$SCRIPT_DIR/.."
  else
    # Clone from GitHub
    info "Cloning tract from GitHub..."
    TEMP_DIR=$(mktemp -d)
    if git clone https://github.com/johnmcmullan/tract.git "$TEMP_DIR" 2>/dev/null; then
      TRACT_SOURCE="$TEMP_DIR"
    else
      error "Failed to clone tract repo and no local installation found.\n   Please push to GitHub or run from tract directory."
    fi
  fi
  
  # Copy CLI to /opt/tract
  mkdir -p "${TRACT_HOME}/bin"
  cp -r "$TRACT_SOURCE/tract-cli" "${TRACT_HOME}/"
  ln -sf "${TRACT_HOME}/tract-cli/bin/tract.js" "${TRACT_HOME}/bin/tract"
  
  # Install dependencies
  cd "${TRACT_HOME}/tract-cli"
  npm install --production --silent
  
  # Copy sync service
  cp -r "$TRACT_SOURCE/tract-sync" "${TRACT_HOME}/"
  cd "${TRACT_HOME}/tract-sync"
  npm install --production --silent
  
  # Cleanup if we cloned to temp
  if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
    rm -rf "$TEMP_DIR"
  fi
  
  # Fix permissions
  chown -R "$TRACT_USER:$TRACT_USER" "${TRACT_HOME}"
  
  success "Tract CLI installed"
else
  info "Tract CLI already installed"
fi

# Get Jira credentials
echo ""
info "Jira Configuration"
read -p "Jira URL [https://jira.orcsoftware.com]: " JIRA_URL
JIRA_URL=${JIRA_URL:-https://jira.orcsoftware.com}

read -p "Jira Username: " JIRA_USERNAME
if [ -z "$JIRA_USERNAME" ]; then
  error "Jira username required"
fi

read -sp "Jira Password/Token: " JIRA_PASSWORD
echo ""
if [ -z "$JIRA_PASSWORD" ]; then
  error "Jira password required"
fi

# Check if we can copy existing tickets
EXISTING_TICKETS=""
if [ -d "/home/${SUDO_USER}/work/apps/tickets" ]; then
  warn "Found existing tickets at /home/${SUDO_USER}/work/apps/tickets"
  read -p "Copy existing tickets instead of re-importing from Jira? [y/N]: " COPY_EXISTING
  if [[ "$COPY_EXISTING" =~ ^[Yy]$ ]]; then
    EXISTING_TICKETS="/home/${SUDO_USER}/work/apps/tickets"
  fi
fi

# Create or copy ticket repository
if [ -n "$EXISTING_TICKETS" ] && [ -d "$EXISTING_TICKETS" ]; then
  info "Copying existing tickets from $EXISTING_TICKETS..."
  # Copy as root (has permission), then chown to tract user
  cp -r "$EXISTING_TICKETS" "$REPO_DIR"
  chown -R "$TRACT_USER:$TRACT_USER" "$REPO_DIR"
  success "Copied existing tickets"
else
  info "Running tract onboard for $PROJECT_NAME..."
  
  cd "$TRACT_HOME"
  sudo -u "$TRACT_USER" \
    JIRA_URL="$JIRA_URL" \
    JIRA_USERNAME="$JIRA_USERNAME" \
    JIRA_PASSWORD="$JIRA_PASSWORD" \
    "${TRACT_HOME}/bin/tract" onboard "$PROJECT_NAME" --import-tickets
  
  success "Onboarded $PROJECT_NAME from Jira"
  
  # Ask about component mapping
  echo ""
  warn "Component mapping can be done now or later"
  read -p "Map components now? (requires code repo) [y/N]: " MAP_NOW
  if [[ "$MAP_NOW" =~ ^[Yy]$ ]]; then
    read -p "Path to code repository: " CODE_REPO
    if [ -n "$CODE_REPO" ] && [ -d "$CODE_REPO" ]; then
      cd "$REPO_DIR"
      sudo -u "$TRACT_USER" \
        JIRA_URL="$JIRA_URL" \
        JIRA_USERNAME="$JIRA_USERNAME" \
        JIRA_PASSWORD="$JIRA_PASSWORD" \
        "${TRACT_HOME}/bin/tract" map-components "$CODE_REPO"
    fi
  fi
fi

# Create bare repository
info "Creating bare git repository at $BARE_REPO..."
sudo -u "$TRACT_USER" git clone --bare "$REPO_DIR" "$BARE_REPO"
success "Bare repository created"

# Set up post-receive hook
info "Installing post-receive hook..."
HOOK_FILE="${BARE_REPO}/hooks/post-receive"

cat > "$HOOK_FILE" << 'HOOK_EOF'
#!/bin/bash
#
# Git post-receive hook for Tract sync
#

SYNC_URL="${TRACT_SYNC_URL:-http://localhost:3000/webhook/git}"

# Read ref updates from stdin
while read oldrev newrev refname; do
  # Only process main/master branch
  if [[ "$refname" != "refs/heads/main" ]] && [[ "$refname" != "refs/heads/master" ]]; then
    continue
  fi
  
  echo "🔄 Tract sync: processing $refname"
  
  # Get list of changed files
  changed_files=$(git diff --name-only $oldrev $newrev | grep '^issues/.*\.md$')
  
  if [ -z "$changed_files" ]; then
    echo "   No ticket changes detected"
    continue
  fi
  
  # Build JSON payload with file contents
  json_payload='{"changedFiles":['
  first=true
  
  for file in $changed_files; do
    # Get old and new content
    old_content=$(git show $oldrev:$file 2>/dev/null | jq -Rs .)
    new_content=$(git show $newrev:$file 2>/dev/null | jq -Rs .)
    
    if [ "$old_content" = "null" ]; then
      old_content='""'
    fi
    
    if [ "$new_content" = "null" ]; then
      new_content='""'
    fi
    
    if [ "$first" = true ]; then
      first=false
    else
      json_payload="${json_payload},"
    fi
    
    json_payload="${json_payload}{\"path\":\"$file\",\"oldContent\":$old_content,\"newContent\":$new_content}"
  done
  
  json_payload="${json_payload}]}"
  
  # Send to sync service
  echo "   Syncing $(echo $changed_files | wc -w) files to Jira..."
  
  response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "$json_payload" \
    "$SYNC_URL")
  
  if [ $? -eq 0 ]; then
    echo "   ✅ Sync complete"
  else
    echo "   ❌ Sync failed"
  fi
done

# Update working copy
cd /opt/tract/$(basename $(pwd) .git)
unset GIT_DIR
git pull origin master 2>/dev/null || git pull origin main 2>/dev/null
HOOK_EOF

chmod +x "$HOOK_FILE"
chown "$TRACT_USER:$TRACT_USER" "$HOOK_FILE"
success "Post-receive hook installed"

# Configure working copy to track bare repo
info "Configuring git remotes..."
cd "$REPO_DIR"
sudo -u "$TRACT_USER" git remote remove origin 2>/dev/null || true
sudo -u "$TRACT_USER" git remote add origin "$BARE_REPO"
success "Git remotes configured"

# Create systemd template service if not exists
if [ ! -f /etc/systemd/system/tract-sync@.service ]; then
  info "Installing systemd template service..."
  
  cat > /etc/systemd/system/tract-sync@.service << 'SERVICE_EOF'
[Unit]
Description=Tract Sync Service - %i
After=network.target

[Service]
Type=simple
User=tract
WorkingDirectory=/opt/tract/tract-sync
EnvironmentFile=/opt/tract/config/%i.env
Environment="PROJECT_NAME=%i"
ExecStart=/usr/bin/node /opt/tract/tract-sync/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tract-sync-%i

[Install]
WantedBy=multi-user.target
SERVICE_EOF
  
  success "Systemd template installed"
fi

# Create config file for this project
info "Creating service configuration..."
mkdir -p "${TRACT_HOME}/config"

cat > "${TRACT_HOME}/config/${PROJECT_LOWER}.env" << ENV_EOF
JIRA_URL=${JIRA_URL}
JIRA_USERNAME=${JIRA_USERNAME}
JIRA_PASSWORD=${JIRA_PASSWORD}
TRACT_REPO_PATH=${REPO_DIR}
SYNC_USER=tract-sync
SYNC_EMAIL=tract-sync@localhost
PORT=3000
NODE_ENV=production
ENV_EOF

chmod 600 "${TRACT_HOME}/config/${PROJECT_LOWER}.env"
chown "$TRACT_USER:$TRACT_USER" "${TRACT_HOME}/config/${PROJECT_LOWER}.env"
success "Configuration created"

# Enable and start service
info "Starting ${SERVICE_NAME}.service..."
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service"
systemctl start "${SERVICE_NAME}.service"

# Check status
sleep 2
if systemctl is-active --quiet "${SERVICE_NAME}.service"; then
  success "Service started successfully"
else
  error "Service failed to start. Check: journalctl -u ${SERVICE_NAME}.service"
fi

echo ""
echo -e "${GREEN}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Installation Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"
echo "Bare repository:  $BARE_REPO"
echo "Working copy:     $REPO_DIR"
echo "Service:          ${SERVICE_NAME}.service"
echo "Port:             $(grep PORT ${TRACT_HOME}/config/${PROJECT_LOWER}.env | cut -d= -f2)"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚠️  IMPORTANT: Configure Jira Webhook Now!${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "The sync service is running but won't receive Jira updates until"
echo "you configure the webhook in Jira:"
echo ""
echo "1. Go to: ${JIRA_URL}/plugins/servlet/webhooks"
echo "   (or Settings → System → WebHooks)"
echo ""
echo "2. Click 'Create a WebHook'"
echo ""
echo "3. Configure:"
echo "   Name:   Tract Sync - ${PROJECT_NAME}"
echo "   Status: Enabled"
echo "   URL:    http://$(hostname):$(grep PORT ${TRACT_HOME}/config/${PROJECT_LOWER}.env | cut -d= -f2)/webhook/jira"
echo ""
echo "4. Select events:"
echo "   ☑ Issue: created"
echo "   ☑ Issue: updated"
echo "   ☑ Comment: created"
echo "   ☑ Comment: updated"
echo ""
echo "5. JQL Filter (optional):"
echo "   project = ${PROJECT_NAME}"
echo ""
echo "6. Click 'Create'"
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📍 For Developers:"
echo ""
echo "Clone the tickets repository:"
echo "  git clone $(whoami)@$(hostname):$BARE_REPO"
echo ""
echo "Or as submodule in code repo:"
echo "  git submodule add $(whoami)@$(hostname):$BARE_REPO tickets"
echo ""
echo "📊 Monitor & Debug:"
echo ""
echo "Check service status:"
echo "  systemctl status ${SERVICE_NAME}.service"
echo ""
echo "View logs:"
echo "  journalctl -u ${SERVICE_NAME}.service -f"
echo ""
echo "Test health:"
echo "  curl http://localhost:$(grep PORT ${TRACT_HOME}/config/${PROJECT_LOWER}.env | cut -d= -f2)/health"
echo ""
success "Sync service ready! Configure Jira webhook to complete setup. 🚀"
