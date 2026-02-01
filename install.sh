#!/bin/bash
# SaaS DocOps - Production Grade Installer for macOS
# Usage: curl -sSL https://raw.githubusercontent.com/jaylkim/saas-docops/main/install.sh | bash -s -- [options]
# Options:
#   --yes          Non-interactive mode (accept defaults)
#   --vault <path> Specify vault path
#   --no-open      Do not open Obsidian after install
#   --force        Force install even if requirements missing

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Config
REPO_OWNER="jaylkim"
REPO_NAME="saas-docops"
PLUGIN_ID="saas-docops"
GITHUB_API="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"

# State
INTERACTIVE=true
FORCE=false
SPECIFIED_VAULT=""
AUTO_OPEN=true

# Logging
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Parse Args
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --yes) INTERACTIVE=false ;;
        --force) FORCE=true ;;
        --no-open) AUTO_OPEN=false ;;
        --vault) SPECIFIED_VAULT="$2"; shift ;;
        *) log_error "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

check_prerequisites() {
    log_info "Checking prerequisites..."
    local missing=()

    # Node/npm
    if ! command -v node &> /dev/null; then missing+=("Node.js"); fi
    if ! command -v npm &> /dev/null; then missing+=("npm"); fi

    # Claude Code
    if ! command -v claude &> /dev/null; then
        log_warn "Claude Code CLI not found."
        
        if [ "$INTERACTIVE" = true ]; then
             read -p "    Install Claude Code? [Y/n] " -n 1 -r
             echo ""
             if [[ $REPLY =~ ^[Yy]$ || -z $REPLY ]]; then
                install_claude_code
             else
                missing+=("Claude Code")
             fi
        else
            # Try to auto-install if non-interactive but only if brew exists (safer)
            if command -v brew &> /dev/null; then
                install_claude_code
            else
                log_error "Cannot auto-install Claude Code without Homebrew in non-interactive mode."
                missing+=("Claude Code")
            fi
        fi
    else
        log_success "Claude Code: $(claude --version 2>/dev/null || echo 'Installed')"
    fi

    # Obsidian
    if [ ! -d "/Applications/Obsidian.app" ]; then
        log_warn "Obsidian.app not found in /Applications"
    else
        log_success "Obsidian: Installed"
    fi

    if [ ${#missing[@]} -gt 0 ] && [ "$FORCE" = false ]; then
        log_error "Missing requirements: ${missing[*]}"
        exit 1
    fi
}

install_claude_code() {
    if command -v brew &> /dev/null; then
        log_info "Installing Claude Code via Homebrew..."
        brew install --cask claude-code || log_warn "Brew install failed, trying npm..."
    fi

    if ! command -v claude &> /dev/null; then
        log_info "Installing Claude Code via npm..."
        if npm install -g @anthropic-ai/claude-code; then
            log_success "Claude Code installed via npm"
        else
            log_error "npm install failed. Try running: sudo npm install -g @anthropic-ai/claude-code"
            # Don't exit if force is on, but likely will fail later
        fi
    fi
}

# Platform
detect_platform() {
    local os=$(uname -s)
    local arch=$(uname -m)
    if [ "$os" != "Darwin" ]; then
        log_error "macOS only."
        exit 1
    fi
    case $arch in
        arm64) PLATFORM="darwin-arm64" ;;
        x86_64) PLATFORM="darwin-x64" ;;
        *) log_error "Unsupported arch: $arch"; exit 1 ;;
    esac
    log_success "Platform: $PLATFORM"
}

# Vault Selection
select_vault() {
    if [ -n "$SPECIFIED_VAULT" ]; then
        if [ ! -d "$SPECIFIED_VAULT" ]; then
            log_error "Specified vault path does not exist: $SPECIFIED_VAULT"
            exit 1
        fi
        SELECTED_VAULT="$SPECIFIED_VAULT"
        log_success "Using specified vault: $SELECTED_VAULT"
        return
    fi

    log_info "Finding vaults..."
    local config="$HOME/Library/Application Support/obsidian/obsidian.json"
    if [ ! -f "$config" ]; then
        log_error "Obsidian config not found."
        exit 1
    fi

    # Parse vaults using python3 (reliable)
    VAULTS=()
    while IFS= read -r line; do
        if [ -d "$line" ]; then VAULTS+=("$line"); fi
    done < <(python3 -c "
import json, sys
try:
    with open('$config', 'r') as f:
        data = json.load(f)
    print('\n'.join([v.get('path', '') for v in data.get('vaults', {}).values() if v.get('path')]))
except: pass
")

    if [ ${#VAULTS[@]} -eq 0 ]; then
        log_error "No vaults found."
        exit 1
    elif [ ${#VAULTS[@]} -eq 1 ]; then
        SELECTED_VAULT="${VAULTS[0]}"
        log_success "Found 1 vault: $SELECTED_VAULT"
    else
        if [ "$INTERACTIVE" = false ]; then
            SELECTED_VAULT="${VAULTS[0]}"
            log_warn "Multiple vaults found. Defaulting to first: $SELECTED_VAULT"
        else
            echo "Multiple vaults found:"
            for i in "${!VAULTS[@]}"; do
                echo "  $((i+1)). ${VAULTS[$i]}"
            done
            read -p "Select vault [1-${#VAULTS[@]}]: " choice
            SELECTED_VAULT="${VAULTS[$((choice-1))]}"
        fi
    fi
}

download_release() {
    log_info "Fetching release info..."
    local json
    if ! json=$(curl -fSL --retry 3 -s "$GITHUB_API"); then
        log_error "Failed to fetch release info."
        exit 1
    fi

    # Extract URL safe using python
    DOWNLOAD_URL=$(echo "$json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
assets = data.get('assets', [])
platform = '$PLATFORM'
for a in assets:
    if platform in a.get('name', '') and a.get('name', '').endswith('.zip'):
        print(a.get('browser_download_url', ''))
        break
")

    if [ -z "$DOWNLOAD_URL" ]; then
        log_error "No asset found for $PLATFORM"
        exit 1
    fi

    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT
    
    local zip_file="$TEMP_DIR/plugin.zip"
    log_info "Downloading $DOWNLOAD_URL..."
    if ! curl -fSL --retry 3 -o "$zip_file" "$DOWNLOAD_URL"; then
        log_error "Download failed."
        exit 1
    fi

    # Checksum verification (Optional placeholder)
    # log_info "Verifying checksum..." 

    unzip -q "$zip_file" -d "$TEMP_DIR"
    EXTRACTED_DIR="$TEMP_DIR"
}

install_plugin_files() {
    log_info "Installing..."
    
    # Find manifest.json to locate root
    local root_file
    root_file=$(find "$EXTRACTED_DIR" -maxdepth 3 -name "manifest.json" | head -n 1)
    
    if [ -z "$root_file" ]; then
        log_error "Invalid plugin package: manifest.json not found"
        exit 1
    fi
    
    local source_dir
    source_dir=$(dirname "$root_file")
    local target_dir="$SELECTED_VAULT/.obsidian/plugins/$PLUGIN_ID"

    if [ -d "$target_dir" ]; then
        log_info "Backing up existing version..."
        mv "$target_dir" "${target_dir}.bak"
    fi

    mkdir -p "$target_dir"
    cp -R "$source_dir/"* "$target_dir/"
    log_success "Installed to $target_dir"

    # Safely enable plugin
    local config="$SELECTED_VAULT/.obsidian/community-plugins.json"
    if [ ! -f "$config" ]; then echo "[]" > "$config"; fi
    
    python3 -c "
import json
try:
    with open('$config', 'r+') as f:
        try: data = json.load(f)
        except: data = []
        if '$PLUGIN_ID' not in data:
            data.append('$PLUGIN_ID')
            f.seek(0)
            json.dump(data, f, indent=2)
            f.truncate()
except Exception as e:
    print('Error updating config:', e)
    exit(1)
" || log_warn "Failed to enable plugin automatically."
    
    log_success "Plugin enabled."
}

check_node_pty() {
    # Simple check for the binary
    if [ -f "$SELECTED_VAULT/.obsidian/plugins/$PLUGIN_ID/node_modules/node-pty/build/Release/pty.node" ]; then
        log_success "node-pty binary verified."
    else
        log_warn "node-pty binary missing. You may need to rebuild it manually."
    fi
}

main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  SaaS DocOps Installer (v2.0)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    check_prerequisites
    detect_platform
    select_vault
    download_release
    install_plugin_files
    check_node_pty

    if [ "$AUTO_OPEN" = true ] && [ "$INTERACTIVE" = true ]; then
         read -p "Open Obsidian now? [Y/n] " -n 1 -r
         echo ""
         if [[ $REPLY =~ ^[Yy]$ || -z $REPLY ]]; then
            open "obsidian://open?path=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$SELECTED_VAULT'''))")"
         fi
    fi
}

main "$@"
