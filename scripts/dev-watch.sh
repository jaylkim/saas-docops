#!/bin/bash
# Watch for changes and auto-deploy to test vault
# Usage: ./scripts/dev-watch.sh [vault-path]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PLUGIN_ID="saas-docops"

DEFAULT_VAULT="/Users/jay/projects/temp"
VAULT_PATH="${1:-$DEFAULT_VAULT}"
PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID"

echo "🔄 SaaS DocOps - Development Watch Mode"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project: $PROJECT_DIR"
echo "Vault:   $VAULT_PATH"
echo ""

# Check if vault exists
if [ ! -d "$VAULT_PATH/.obsidian" ]; then
    echo "❌ Error: Vault not found at $VAULT_PATH"
    exit 1
fi

mkdir -p "$PLUGIN_DIR"

# Function to copy files
copy_files() {
    cp "$PROJECT_DIR/main.js" "$PLUGIN_DIR/" 2>/dev/null || true
    cp "$PROJECT_DIR/styles.css" "$PLUGIN_DIR/" 2>/dev/null || true
    cp "$PROJECT_DIR/manifest.json" "$PLUGIN_DIR/" 2>/dev/null || true
    echo "$(date '+%H:%M:%S') - Deployed to test vault"
}

# Copy native modules once
copy_native_modules() {
    mkdir -p "$PLUGIN_DIR/node_modules"
    cp -r "$PROJECT_DIR/node_modules/node-pty" "$PLUGIN_DIR/node_modules/" 2>/dev/null || true
    cp -r "$PROJECT_DIR/node_modules/node-addon-api" "$PLUGIN_DIR/node_modules/" 2>/dev/null || true
    echo "📦 Native modules copied"
}

# Initial build and deploy
echo "📦 Initial build..."
cd "$PROJECT_DIR"
npm run build
copy_native_modules
copy_files

echo ""
echo "👀 Watching for changes... (Ctrl+C to stop)"
echo "💡 Tip: Use Cmd+R in Obsidian to reload after changes"
echo ""

# Watch main.js for changes and auto-copy
# Use fswatch if available, otherwise use polling
if command -v fswatch &> /dev/null; then
    fswatch -o "$PROJECT_DIR/main.js" "$PROJECT_DIR/styles.css" | while read; do
        copy_files
    done &
    WATCH_PID=$!

    # Start esbuild watch
    npm run dev

    # Cleanup on exit
    kill $WATCH_PID 2>/dev/null || true
else
    echo "⚠️  fswatch not found, using polling mode (install with: brew install fswatch)"
    echo ""

    # Start esbuild watch in background
    npm run dev &
    ESBUILD_PID=$!

    # Poll for changes
    LAST_HASH=""
    while true; do
        sleep 2
        if [ -f "$PROJECT_DIR/main.js" ]; then
            CURRENT_HASH=$(md5 -q "$PROJECT_DIR/main.js" 2>/dev/null || echo "")
            if [ "$CURRENT_HASH" != "$LAST_HASH" ] && [ -n "$CURRENT_HASH" ]; then
                LAST_HASH="$CURRENT_HASH"
                copy_files
            fi
        fi
    done

    # Cleanup on exit
    trap "kill $ESBUILD_PID 2>/dev/null" EXIT
fi
