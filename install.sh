#!/bin/bash
set -e

# Tract CLI Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/johnmcmullan/tract/master/install.sh | bash

INSTALL_DIR="${TRACT_INSTALL_DIR:-$HOME/.tract}"
REPO_URL="https://github.com/johnmcmullan/tract.git"

echo "🚀 Installing Tract CLI..."
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is required but not installed."
    echo "   Install Node.js from https://nodejs.org/ or use your package manager:"
    echo "   - Ubuntu/Debian: sudo apt-get install nodejs npm"
    echo "   - macOS: brew install node"
    echo "   - RHEL/CentOS: sudo yum install nodejs npm"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ Error: Node.js 14 or higher required (found: $(node -v))"
    exit 1
fi

echo "✓ Node.js $(node -v) found"
echo ""

# Check for git
if ! command -v git &> /dev/null; then
    echo "❌ Error: git is required but not installed."
    exit 1
fi

echo "✓ git found"
echo ""

# Create install directory
echo "📁 Installing to: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Clone or update repository
if [ -d "$INSTALL_DIR/.git" ]; then
    echo "📦 Updating existing installation..."
    cd "$INSTALL_DIR"
    git fetch origin
    git reset --hard origin/master
else
    echo "📦 Cloning repository..."
    rm -rf "$INSTALL_DIR"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo ""
echo "📦 Installing dependencies..."
cd "$INSTALL_DIR/tract-cli"
npm install --production --silent

echo ""
echo "🔗 Creating symlink..."

# Determine bin directory
if [ -w "/usr/local/bin" ]; then
    BIN_DIR="/usr/local/bin"
elif [ -d "$HOME/.local/bin" ]; then
    BIN_DIR="$HOME/.local/bin"
    mkdir -p "$BIN_DIR"
else
    BIN_DIR="$HOME/bin"
    mkdir -p "$BIN_DIR"
fi

# Create symlink
ln -sf "$INSTALL_DIR/tract-cli/bin/tract.js" "$BIN_DIR/tract"
chmod +x "$INSTALL_DIR/tract-cli/bin/tract.js"

echo ""
echo "✅ Tract CLI installed successfully!"
echo ""
echo "📍 Installation location: $INSTALL_DIR/tract-cli"
echo "🔗 Symlink created: $BIN_DIR/tract"
echo ""

# Check if bin directory is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo "⚠️  Warning: $BIN_DIR is not in your PATH"
    echo ""
    echo "   Add this to your ~/.bashrc or ~/.zshrc:"
    echo "   export PATH=\"\$PATH:$BIN_DIR\""
    echo ""
fi

echo "🎉 Ready to use! Try:"
echo "   tract --help"
echo "   tract onboard --help"
echo ""
echo "📚 Documentation: https://github.com/johnmcmullan/tract"
echo ""
