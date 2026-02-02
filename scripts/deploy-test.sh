#!/bin/bash
# Deploy plugin to test vault for development testing
# Usage: ./scripts/deploy-test.sh [vault-path]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLUGIN_ID="saas-docops"

# Default test vault (can be overridden via argument)
DEFAULT_VAULT="/Users/vim/projects/temp"
VAULT_PATH="${1:-$DEFAULT_VAULT}"

# Derived paths
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID"

echo "🔧 SaaS DocOps - Deploy to Test Vault"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project: $PROJECT_DIR"
echo "Vault:   $VAULT_PATH"
echo ""

# Check if vault exists
if [ ! -d "$VAULT_PATH/.obsidian" ]; then
    echo "❌ Error: Vault not found at $VAULT_PATH"
    echo "   Make sure the path points to an Obsidian vault"
    exit 1
fi

# Build first
echo "📦 Building..."
cd "$PROJECT_DIR"
npm run build

# Create plugin directory if needed
mkdir -p "$PLUGIN_DIR"

# Copy files
echo "📋 Copying files..."
cp "$PROJECT_DIR/main.js" "$PLUGIN_DIR/"
cp "$PROJECT_DIR/styles.css" "$PLUGIN_DIR/"
cp "$PROJECT_DIR/manifest.json" "$PLUGIN_DIR/"

# Copy native modules (node-pty)
echo "📦 Copying native modules..."
mkdir -p "$PLUGIN_DIR/node_modules"
cp -r "$PROJECT_DIR/node_modules/node-pty" "$PLUGIN_DIR/node_modules/" 2>/dev/null || true
cp -r "$PROJECT_DIR/node_modules/node-addon-api" "$PLUGIN_DIR/node_modules/" 2>/dev/null || true

# Enable plugin in community-plugins.json if not already
COMMUNITY_PLUGINS="$VAULT_PATH/.obsidian/community-plugins.json"
if [ -f "$COMMUNITY_PLUGINS" ]; then
    if ! grep -q "\"$PLUGIN_ID\"" "$COMMUNITY_PLUGINS"; then
        echo "🔌 Enabling plugin..."
        # Simple JSON array append (works for basic cases)
        if [ "$(cat "$COMMUNITY_PLUGINS")" = "[]" ]; then
            echo "[\"$PLUGIN_ID\"]" > "$COMMUNITY_PLUGINS"
        else
            # Add to existing array
            sed -i '' 's/\]$/,"'"$PLUGIN_ID"'"]/' "$COMMUNITY_PLUGINS"
        fi
    fi
else
    echo "[\"$PLUGIN_ID\"]" > "$COMMUNITY_PLUGINS"
fi

echo ""
echo "✅ Deployed successfully!"
echo ""
echo "📝 Next steps:"
echo "   1. Open Obsidian with vault: $VAULT_PATH"
echo "   2. If Obsidian is open, use Cmd+R to reload"
echo "   3. Click terminal icon in ribbon or run 'Open Terminal' command"
echo ""
echo "🧪 Test checklist:"
echo "   [ ] Shell prompt appears"
echo "   [ ] Commands work: ls, pwd, echo \$ANTHROPIC_API_KEY"
echo "   [ ] Resize works"
echo "   [ ] TUI works: vim, htop"
echo "   [ ] Claude Code: claude"
echo "   [ ] Ctrl+C interrupts"
echo "   [ ] Close view (no zombies)"
