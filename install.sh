#!/bin/bash
#
# Tract CLI Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/johnmcmullan/tract/master/install.sh | bash
#

set -e

REPO_URL="https://github.com/johnmcmullan/tract.git"
INSTALL_DIR="${TRACT_INSTALL_DIR:-$HOME/.tract-cli}"
BIN_DIR="${TRACT_BIN_DIR:-$HOME/.local/bin}"

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
    echo -e "${BLUE}➜${NC} Updating to latest version..."
    cd "$INSTALL_DIR"
    git fetch origin master >/dev/null 2>&1
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/master)
    
    if [ "$LOCAL" = "$REMOTE" ]; then
        echo -e "${GREEN}✓${NC} Already up to date"
    else
        git pull origin master
        echo -e "${GREEN}✓${NC} Updated to latest"
    fi
else
    echo -e "${BLUE}➜${NC} Installing Tract CLI to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

# Install dependencies
echo -e "${BLUE}➜${NC} Installing dependencies..."
cd "$INSTALL_DIR/tract-cli"
npm install --silent

# Create symlink
echo -e "${BLUE}➜${NC} Setting up command..."

TRACT_BIN="$INSTALL_DIR/tract-cli/bin/tract.js"
SYMLINK_PATH="$BIN_DIR/tract"

# Ensure ~/.local/bin exists
mkdir -p "$BIN_DIR"

# Create symlink
ln -sf "$TRACT_BIN" "$SYMLINK_PATH"
echo -e "${GREEN}✓${NC} Created symlink: $SYMLINK_PATH"

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo
    echo -e "${YELLOW}⚠${NC}  $BIN_DIR is not in your PATH"
    echo -e "${BLUE}➜${NC} Adding to PATH..."
    
    # Detect shell config file
    SHELL_CONFIG=""
    if [ -n "$BASH_VERSION" ]; then
        SHELL_CONFIG="$HOME/.bashrc"
    elif [ -n "$ZSH_VERSION" ]; then
        SHELL_CONFIG="$HOME/.zshrc"
    else
        # Try to guess
        if [ -f "$HOME/.bashrc" ]; then
            SHELL_CONFIG="$HOME/.bashrc"
        elif [ -f "$HOME/.zshrc" ]; then
            SHELL_CONFIG="$HOME/.zshrc"
        fi
    fi
    
    if [ -n "$SHELL_CONFIG" ] && [ -f "$SHELL_CONFIG" ]; then
        # Check if already added
        if ! grep -q "export PATH=\"\$HOME/.local/bin:\$PATH\"" "$SHELL_CONFIG"; then
            echo "" >> "$SHELL_CONFIG"
            echo "# Added by Tract installer" >> "$SHELL_CONFIG"
            echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$SHELL_CONFIG"
            echo -e "${GREEN}✓${NC} Added to $SHELL_CONFIG"
            echo -e "${YELLOW}ℹ${NC}  Run: ${BLUE}source $SHELL_CONFIG${NC} or restart your shell"
        else
            echo -e "${GREEN}✓${NC} Already in $SHELL_CONFIG"
        fi
    else
        echo -e "${YELLOW}⚠${NC}  Could not detect shell config file"
        echo -e "${YELLOW}➜${NC} Add this to your shell config manually:"
        echo -e "    ${BLUE}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
    fi
    
    # Add to current session
    export PATH="$HOME/.local/bin:$PATH"
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
    echo -e "  ${YELLOW}Option 1: LLM-Assisted Onboarding (Recommended)${NC}"
    echo "     Use Claude Code, OpenClaw, or any LLM CLI:"
    echo
    echo -e "     ${GRAY}cd your-project-directory${NC}"
    echo -e "     ${GRAY}claude  # or openclaw, cursor, etc.${NC}"
    echo
    echo "     Then tell your LLM:"
    echo -e "     ${GREEN}\"Read ~/.tract-cli/.tract/skills/tract-onboarding/SKILL.md"
    echo -e "     and help me set up Tract for this project.\"${NC}"
    echo
    echo -e "     ${GRAY}Quick reference: cat ~/.tract-cli/.tract/LLM-QUICKSTART.txt${NC}"
    echo
    echo -e "  ${YELLOW}Option 2: Manual Onboarding${NC}"
    echo "     Interactive mode:"
    echo -e "     ${GRAY}tract onboard --interactive${NC}"
    echo
    echo "     Or with full arguments:"
    echo -e "     ${GRAY}tract onboard --project APP --local${NC}"
    echo -e "     ${GRAY}tract onboard --project APP --jira <url> --user <name>${NC}"
    echo
    echo -e "${BLUE}Learn More:${NC}"
    echo -e "  LLM Guide: ${GRAY}cat ~/.tract-cli/.tract/LLM-ONBOARDING.md${NC}"
    echo -e "  Full Docs: ${GRAY}https://github.com/johnmcmullan/tract${NC}"
    echo
else
    echo -e "${RED}✗${NC} Installation failed - tract command not found in PATH"
    echo "  Try adding $BIN_DIR to your PATH"
    exit 1
fi
