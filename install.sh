#!/bin/bash
# SaaS DocOps - Production Grade Installer for macOS
# Usage: curl -sSL https://raw.githubusercontent.com/jaylkim/saas-docops/main/install.sh | bash -s -- [options]
# Options:
#   --yes          Non-interactive mode (accept defaults)
#   --vault <path> Specify vault path
#   --no-open      Do not open Obsidian after install
#   --force        Force install even if requirements missing
#   --rebuild      Force rebuild node-pty after install

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
REBUILD_PTY=false
NEW_VERSION=""
CURRENT_VERSION=""
TTY_AVAILABLE=false

# Check if we can read from terminal
if [ -t 0 ]; then
    # stdin is a terminal
    TTY_AVAILABLE=true
elif [ -c /dev/tty ] && [ -r /dev/tty ] && [ -w /dev/tty ]; then
    # /dev/tty is available (piped execution but terminal exists)
    TTY_AVAILABLE=true
fi

# Safe read function that handles piped execution
safe_read() {
    local prompt="$1"
    local default="$2"
    local result=""

    if [ "$TTY_AVAILABLE" = true ]; then
        if [ -t 0 ]; then
            read -p "$prompt" result || result=""
        else
            printf "%s" "$prompt" > /dev/tty
            read result < /dev/tty 2>/dev/null || result=""
        fi
    fi

    if [ -z "$result" ]; then
        result="$default"
    fi

    echo "$result"
}

# Safe read for single character with -n 1
safe_read_char() {
    local prompt="$1"
    local default="$2"
    local result=""

    if [ "$TTY_AVAILABLE" = true ]; then
        if [ -t 0 ]; then
            read -p "$prompt" -n 1 -r result || result=""
            echo ""
        else
            printf "%s" "$prompt" > /dev/tty
            read -n 1 -r result < /dev/tty 2>/dev/null || result=""
            echo "" > /dev/tty
        fi
    fi

    if [ -z "$result" ]; then
        result="$default"
    fi

    echo "$result"
}

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
        --rebuild) REBUILD_PTY=true ;;
        *) log_error "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

check_obsidian_running() {
    if pgrep -x "Obsidian" > /dev/null; then
        log_warn "Obsidian is currently running."
        log_warn "Installing while Obsidian is open may cause issues."
        if [ "$INTERACTIVE" = true ] && [ "$TTY_AVAILABLE" = true ]; then
            REPLY=$(safe_read_char "    Close Obsidian and continue? [Y/n] " "y")
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                osascript -e 'quit app "Obsidian"' 2>/dev/null || true
                sleep 2
                log_success "Obsidian closed."
            else
                log_warn "Continuing with Obsidian running (not recommended)."
            fi
        else
            log_warn "Non-interactive mode: continuing with Obsidian running."
        fi
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    local missing=()

    # Python3 (required for JSON parsing)
    if ! command -v python3 &> /dev/null; then
        log_error "python3 is required but not found."
        exit 1
    fi

    # Node/npm
    if ! command -v node &> /dev/null; then missing+=("Node.js"); fi
    if ! command -v npm &> /dev/null; then missing+=("npm"); fi

    # Claude Code
    if ! command -v claude &> /dev/null; then
        log_warn "Claude Code CLI not found."
        
        if [ "$INTERACTIVE" = true ] && [ "$TTY_AVAILABLE" = true ]; then
             REPLY=$(safe_read_char "    Install Claude Code? [Y/n] " "y")
             if [[ $REPLY =~ ^[Yy]$ ]]; then
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
    log_info "Installing Claude Code via native installer..."
    if curl -fsSL https://claude.ai/install.sh | bash; then
        log_success "Claude Code installed (auto-updates enabled)"
    else
        log_warn "Native install failed. Trying Homebrew..."
        if command -v brew &> /dev/null; then
            if brew install --cask claude-code; then
                log_warn "Installed via Homebrew (manual updates required: brew upgrade claude-code)"
            else
                log_error "Installation failed. Visit https://code.claude.com/docs/ko/setup"
                return 1
            fi
        else
            log_error "Installation failed. Visit https://code.claude.com/docs/ko/setup"
            return 1
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
        if [ "$INTERACTIVE" = false ] || [ "$TTY_AVAILABLE" = false ]; then
            SELECTED_VAULT="${VAULTS[0]}"
            log_warn "Multiple vaults found. Defaulting to first: $SELECTED_VAULT"
            log_warn "Use --vault <path> to specify a different vault."
        else
            echo "Multiple vaults found:"
            for i in "${!VAULTS[@]}"; do
                echo "  $((i+1)). ${VAULTS[$i]}"
            done
            choice=$(safe_read "Select vault [1-${#VAULTS[@]}]: " "1")
            if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#VAULTS[@]} ]; then
                log_error "Invalid selection. Please enter a number between 1 and ${#VAULTS[@]}"
                exit 1
            fi
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

    # Extract version and URL using python
    read -r NEW_VERSION DOWNLOAD_URL < <(echo "$json" | python3 -c "
import json, sys
data = json.load(sys.stdin)
version = data.get('tag_name', '').lstrip('v')
assets = data.get('assets', [])
platform = '$PLATFORM'
url = ''
for a in assets:
    if platform in a.get('name', '') and a.get('name', '').endswith('.zip'):
        url = a.get('browser_download_url', '')
        break
print(version, url)
")

    if [ -z "$DOWNLOAD_URL" ]; then
        log_error "No asset found for $PLATFORM"
        log_error "Check releases at: https://github.com/${REPO_OWNER}/${REPO_NAME}/releases"
        exit 1
    fi

    log_info "Latest version: $NEW_VERSION"

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

    if ! unzip -q "$zip_file" -d "$TEMP_DIR"; then
        log_error "Failed to extract plugin archive."
        exit 1
    fi
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

    # Check current version
    if [ -f "$target_dir/manifest.json" ]; then
        CURRENT_VERSION=$(python3 -c "
import json
try:
    with open('$target_dir/manifest.json', 'r') as f:
        print(json.load(f).get('version', 'unknown'))
except: print('unknown')
")
        log_info "Current version: $CURRENT_VERSION"

        if [ "$CURRENT_VERSION" = "$NEW_VERSION" ] && [ "$FORCE" = false ]; then
            log_success "Already up to date (v$CURRENT_VERSION)"
            return 0
        fi
    fi

    if [ -d "$target_dir" ]; then
        local backup_name="${target_dir}.bak.$(date +%Y%m%d-%H%M%S)"
        log_info "Backing up existing version to $(basename "$backup_name")..."
        mv "$target_dir" "$backup_name"

        # Keep only last 3 backups (safely handle filenames with spaces)
        find "$(dirname "$target_dir")" -maxdepth 1 -name "$(basename "$target_dir").bak.*" -type d -print0 2>/dev/null | \
            xargs -0 ls -dt 2>/dev/null | tail -n +4 | while read -r old_backup; do
                rm -rf "$old_backup"
            done 2>/dev/null || true
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
    local pty_binary="$SELECTED_VAULT/.obsidian/plugins/$PLUGIN_ID/node_modules/node-pty/build/Release/pty.node"
    local plugin_dir="$SELECTED_VAULT/.obsidian/plugins/$PLUGIN_ID"

    if [ -f "$pty_binary" ] && [ "$REBUILD_PTY" = false ]; then
        log_success "node-pty binary verified."
        return 0
    fi

    if [ "$REBUILD_PTY" = true ] || [ ! -f "$pty_binary" ]; then
        log_warn "node-pty binary needs rebuild."

        # Get Obsidian's Electron version
        local electron_version
        electron_version=$(defaults read /Applications/Obsidian.app/Contents/Info.plist ElectronVersion 2>/dev/null || echo "")

        if [ -z "$electron_version" ]; then
            log_warn "Could not detect Obsidian Electron version."
            log_warn "Run manually: cd '$plugin_dir' && npx electron-rebuild -f -w node-pty"
            return 1
        fi

        log_info "Detected Electron version: $electron_version"

        if [ "$INTERACTIVE" = true ] && [ "$TTY_AVAILABLE" = true ] && [ "$REBUILD_PTY" = false ]; then
            REPLY=$(safe_read_char "    Rebuild node-pty for Electron $electron_version? [Y/n] " "y")
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_warn "Skipping rebuild. Terminal may not work correctly."
                return 1
            fi
        fi

        log_info "Rebuilding node-pty (this may take a moment)..."
        if (cd "$plugin_dir" && npx electron-rebuild -f -w node-pty -v "$electron_version" 2>/dev/null); then
            log_success "node-pty rebuilt successfully."
        else
            log_error "Rebuild failed. Try manually:"
            log_error "  cd '$plugin_dir'"
            log_error "  npx electron-rebuild -f -w node-pty -v $electron_version"
            return 1
        fi
    fi
}

main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  SaaS DocOps Installer (v2.1)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    check_obsidian_running
    check_prerequisites
    detect_platform
    select_vault
    download_release
    install_plugin_files
    check_node_pty

    if [ "$AUTO_OPEN" = true ] && [ "$INTERACTIVE" = true ] && [ "$TTY_AVAILABLE" = true ]; then
         REPLY=$(safe_read_char "Open Obsidian now? [Y/n] " "y")
         if [[ $REPLY =~ ^[Yy]$ ]]; then
            open "obsidian://open?path=$(python3 -c "import urllib.parse; print(urllib.parse.quote('''$SELECTED_VAULT'''))")"
         fi
    fi
}

main "$@"
