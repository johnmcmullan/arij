#!/bin/bash
#
# Tract CLI Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/johnmcmullan/tract/master/install.sh | bash
#

set -e

REPO_URL="https://github.com/johnmcmullan/tract.git"
INSTALL_DIR="${TRACT_INSTALL_DIR:-$HOME/.tract-cli}"
BIN_DIR="${TRACT_BIN_DIR:-/usr/local/bin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                   Tract CLI Installer                     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo

# Check dependencies
echo -e "${BLUE}➜${NC} Checking dependencies..."

command -v node >/dev/null 2>&1 || {
    echo -e "${RED}✗${NC} Node.js is required but not installed."
    echo "  Install from: https://nodejs.org/"
    exit 1
}
echo -e "${GREEN}✓${NC} Node.js $(node --version)"

command -v npm >/dev/null 2>&1 || {
    echo -e "${RED}✗${NC} npm is required but not installed."
    exit 1
}
echo -e "${GREEN}✓${NC} npm $(npm --version)"

command -v git >/dev/null 2>&1 || {
    echo -e "${RED}✗${NC} Git is required but not installed."
    exit 1
}
echo -e "${GREEN}✓${NC} Git $(git --version | cut -d' ' -f3)"

echo

# Clone or update repo
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠${NC}  Tract CLI already installed at $INSTALL_DIR"
    read -p "Update to latest version? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}➜${NC} Updating Tract CLI..."
        cd "$INSTALL_DIR"
        git pull origin master
    else
        echo -e "${YELLOW}⊘${NC} Skipping update"
    fi
else
    echo -e "${BLUE}➜${NC} Installing Tract CLI to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

# Install dependencies
echo -e "${BLUE}➜${NC} Installing dependencies..."
cd "$INSTALL_DIR/tract-cli"
npm install --silent

# Create symlink (check if we need sudo)
echo -e "${BLUE}➜${NC} Creating symlink..."

TRACT_BIN="$INSTALL_DIR/tract-cli/bin/tract.js"
SYMLINK_PATH="$BIN_DIR/tract"

if [ -w "$BIN_DIR" ]; then
    ln -sf "$TRACT_BIN" "$SYMLINK_PATH"
else
    echo -e "${YELLOW}⚠${NC}  Need sudo to write to $BIN_DIR"
    sudo ln -sf "$TRACT_BIN" "$SYMLINK_PATH"
fi

# Verify installation
if command -v tract >/dev/null 2>&1; then
    echo
    echo -e "${GREEN}✓${NC} Tract CLI installed successfully!"
    echo
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                 Installation Complete                     ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "  Version: ${GREEN}$(tract --version)${NC}"
    echo -e "  Location: ${BLUE}$INSTALL_DIR${NC}"
    echo -e "  Command: ${BLUE}tract${NC}"
    echo
    echo -e "${BLUE}Next Steps:${NC}"
    echo
    echo "  1. Clone your ticket repo:"
    echo -e "     ${YELLOW}git clone <your-ticket-repo-url>${NC}"
    echo
    echo "  2. Set sync server (optional):"
    echo -e "     ${YELLOW}export TRACT_SYNC_SERVER=http://your-server:3100${NC}"
    echo
    echo "  3. Run diagnostics:"
    echo -e "     ${YELLOW}cd your-ticket-repo && tract doctor${NC}"
    echo
    echo "  4. Start creating tickets:"
    echo -e "     ${YELLOW}tract create APP --title \"My first ticket\"${NC}"
    echo
    echo -e "${BLUE}Documentation:${NC} https://github.com/johnmcmullan/tract"
    echo
else
    echo -e "${RED}✗${NC} Installation failed - tract command not found in PATH"
    echo "  Try adding $BIN_DIR to your PATH"
    exit 1
fi
