#!/bin/bash
# SaaS DocOps - Production Grade Installer for macOS
# Usage: curl -sSL https://raw.githubusercontent.com/jaylkim/saas-docops/main/install.sh | bash -s -- [options]
# Options:
#   --yes          Non-interactive mode (accept defaults)
#   --vault <path> Specify vault path
#   --no-open      Do not open Obsidian after install
#   --force        Force install even if requirements missing
#   --rebuild      Force rebuild node-pty after install
#   --all          Install to all detected Obsidian vaults
#   --sync         Update previously installed vaults
#   --list         Show installed vault list

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
INSTALL_ALL=false
SYNC_MODE=false
LIST_MODE=false

# Install tracking
INSTALL_RECORD="$HOME/.saas-docops/installed.json"

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
        --all) INSTALL_ALL=true ;;
        --sync) SYNC_MODE=true ;;
        --list) LIST_MODE=true ;;
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

    # Core Utils
    if ! command -v curl &> /dev/null; then missing+=("curl"); fi
    if ! command -v unzip &> /dev/null; then missing+=("unzip"); fi

    # Python3 (required for JSON parsing)
    if ! command -v python3 &> /dev/null; then
        log_error "python3 is required but not found."
        exit 1
    fi

    # Git (Required)
    if ! command -v git &> /dev/null; then
        log_error "git is required but not found."
        log_warn "Please install Git: xcode-select --install"
        exit 1
    fi

    # Git Configuration (Warning only)
    if [ -z "$(git config --global user.name)" ] || [ -z "$(git config --global user.email)" ]; then
        log_warn "Git global user identity is not configured."
        log_warn "You may encounter errors when committing."
        log_warn "Recommended: git config --global user.name 'Your Name' && git config --global user.email 'email@example.com'"
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

# Vault Selection (VAULTS array must be populated before calling)
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

    if [ ${#VAULTS[@]} -eq 1 ]; then
        SELECTED_VAULT="${VAULTS[0]}"
        log_success "Using vault: $SELECTED_VAULT"
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

# Record installation to tracking file
record_installation() {
    local vault="$1"
    mkdir -p "$HOME/.saas-docops"
    VAULT="$vault" RECORD="$INSTALL_RECORD" python3 -c "
import json, os
path = os.getenv('RECORD')
vault = os.getenv('VAULT')
try:
    data = json.load(open(path)) if os.path.exists(path) else {'vaults': [], 'lastUpdated': ''}
except: data = {'vaults': [], 'lastUpdated': ''}
if vault not in data['vaults']:
    data['vaults'].append(vault)
from datetime import datetime
data['lastUpdated'] = datetime.now().isoformat()
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
"
}

# Get list of installed vaults from tracking file
get_installed_vaults() {
    if [ ! -f "$INSTALL_RECORD" ]; then
        echo ""
        return
    fi
    RECORD="$INSTALL_RECORD" python3 -c "
import json, os
path = os.getenv('RECORD')
try:
    data = json.load(open(path))
    for v in data.get('vaults', []):
        if os.path.isdir(v):
            print(v)
except: pass
"
}

# List installed vaults
list_installed_vaults() {
    log_info "Installed vaults:"
    local count=0
    while IFS= read -r vault; do
        if [ -n "$vault" ]; then
            local plugin_dir="$vault/.obsidian/plugins/$PLUGIN_ID"
            if [ -d "$plugin_dir" ]; then
                local version
                version=$(MANIFEST="$plugin_dir/manifest.json" python3 -c "
import json, os
try:
    with open(os.getenv('MANIFEST'), 'r') as f:
        print(json.load(f).get('version', 'unknown'))
except: print('unknown')
")
                echo "  ✓ $vault (v$version)"
            else
                echo "  ○ $vault (not installed)"
            fi
            ((count++))
        fi
    done < <(get_installed_vaults)

    if [ $count -eq 0 ]; then
        echo "  (No vaults recorded)"
    fi
    echo ""
    log_info "Total: $count vault(s)"
}

# Install to all detected vaults
install_to_all_vaults() {
    log_info "Installing to all vaults..."
    local success=0
    local failed=0

    for vault in "${VAULTS[@]}"; do
        echo ""
        log_info "━━━ Installing to: $(basename "$vault") ━━━"
        SELECTED_VAULT="$vault"
        if install_plugin_files; then
            check_node_pty || true
            record_installation "$vault"
            ((success++))
        else
            log_error "Failed to install to $vault"
            ((failed++))
        fi
    done

    echo ""
    log_success "Installation complete: $success succeeded, $failed failed"
}

# Sync (update) previously installed vaults
sync_installed_vaults() {
    log_info "Syncing installed vaults..."
    local synced=0
    local failed=0
    local skipped=0

    while IFS= read -r vault; do
        if [ -n "$vault" ] && [ -d "$vault" ]; then
            echo ""
            log_info "━━━ Syncing: $(basename "$vault") ━━━"
            SELECTED_VAULT="$vault"
            if install_plugin_files; then
                check_node_pty || true
                ((synced++))
            else
                log_warn "Skipped $vault (already up to date or error)"
                ((skipped++))
            fi
        fi
    done < <(get_installed_vaults)

    echo ""
    log_success "Sync complete: $synced updated, $skipped skipped"
}

download_release() {
    log_info "Fetching release info..."
    local json
    if ! json=$(curl -fSL --retry 3 -s "$GITHUB_API"); then
        log_error "Failed to fetch release info."
        exit 1
    fi

    # Extract version and URL using python
    # Extract version and URL using python
    read -r NEW_VERSION DOWNLOAD_URL < <(echo "$json" | python3 -c "
import json, sys, os
try:
    data = json.load(sys.stdin)
except json.JSONDecodeError:
    print('', '')
    sys.exit(0)

if 'message' in data and 'API rate limit' in data.get('message', ''):
    sys.stderr.write('GitHub API rate limit exceeded.\n')
    print('', '')
    sys.exit(0)

version = data.get('tag_name', '').lstrip('v')
assets = data.get('assets', [])
platform = os.getenv('PLATFORM', '')
url = ''
for a in assets:
    if platform in a.get('name', '') and a.get('name', '').endswith('.zip'):
        url = a.get('browser_download_url', '')
        break
print(version, url)
")

    if [ -z "$DOWNLOAD_URL" ]; then
        log_error "Failed to resolve download URL for $PLATFORM"
        if echo "$json" | grep -q "API rate limit"; then
             log_error "GitHub API rate limit exceeded. Please try again later."
        else
             log_error "Response invalid or no asset found. Check releases at: https://github.com/${REPO_OWNER}/${REPO_NAME}/releases"
        fi
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
        CURRENT_VERSION=$(MANIFEST="$target_dir/manifest.json" python3 -c "
import json, os
try:
    with open(os.getenv('MANIFEST'), 'r') as f:
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
        # Backup to ~/.saas-docops/backups/ to avoid Obsidian picking up backup as plugin
        local vault_name
        vault_name=$(basename "$SELECTED_VAULT")
        local backup_dir="$HOME/.saas-docops/backups/$vault_name"
        local backup_name="$backup_dir/${PLUGIN_ID}.bak.$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$backup_dir"
        log_info "Backing up existing version to $backup_name..."
        mv "$target_dir" "$backup_name"

        # Keep only last 3 backups per vault
        find "$backup_dir" -maxdepth 1 -name "${PLUGIN_ID}.bak.*" -type d -print0 2>/dev/null | \
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
    
    CONFIG="$config" PLUGIN="$PLUGIN_ID" python3 -c "
import json, os
config_path = os.getenv('CONFIG')
plugin_id = os.getenv('PLUGIN')
try:
    with open(config_path, 'r+') as f:
        try: data = json.load(f)
        except: data = []
        if plugin_id not in data:
            data.append(plugin_id)
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

        # Check for build tools first
        if ! command -v make &> /dev/null || (! command -v cc &> /dev/null && ! command -v clang &> /dev/null); then
            log_error "Build tools (make, compiler) not found."
            log_warn "Please run 'xcode-select --install' to install Command Line Tools."
            log_warn "Or install manually. Rebuild skipped."
            return 1
        fi

        # Try to detect Obsidian's Electron version (multiple methods)
        local electron_version=""

        # Method 1: Info.plist ElectronVersion key (older Obsidian versions)
        electron_version=$(defaults read /Applications/Obsidian.app/Contents/Info.plist ElectronVersion 2>/dev/null || echo "")

        # Method 2: Obsidian version -> known Electron version mapping
        if [ -z "$electron_version" ]; then
            local obsidian_version
            obsidian_version=$(defaults read /Applications/Obsidian.app/Contents/Info.plist CFBundleShortVersionString 2>/dev/null || echo "")
            if [ -n "$obsidian_version" ]; then
                # Obsidian 1.8+ uses Electron 33.x
                local major minor
                major=$(echo "$obsidian_version" | cut -d. -f1)
                minor=$(echo "$obsidian_version" | cut -d. -f2)
                if [ "$major" -ge 1 ] && [ "$minor" -ge 8 ]; then
                    electron_version="33.3.2"
                    log_info "Obsidian $obsidian_version detected, using Electron $electron_version"
                fi
            fi
        fi

        if [ "$INTERACTIVE" = true ] && [ "$TTY_AVAILABLE" = true ] && [ "$REBUILD_PTY" = false ]; then
            local prompt_msg="    Rebuild node-pty"
            if [ -n "$electron_version" ]; then
                prompt_msg="$prompt_msg for Electron $electron_version"
            fi
            REPLY=$(safe_read_char "$prompt_msg? [Y/n] " "y")
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_warn "Skipping rebuild. Terminal may not work correctly."
                return 1
            fi
        fi

        log_info "Rebuilding node-pty (this may take a moment)..."

        # Run @electron/rebuild (newer package name) with module-dir
        local rebuild_cmd="npx @electron/rebuild -f -w node-pty --module-dir ."
        if [ -n "$electron_version" ]; then
            rebuild_cmd="$rebuild_cmd -v $electron_version"
        fi

        if (cd "$plugin_dir" && eval "$rebuild_cmd" 2>&1); then
            log_success "node-pty rebuilt successfully."
        else
            log_error "Rebuild failed. Try manually:"
            log_error "  cd '$plugin_dir'"
            if [ -n "$electron_version" ]; then
                log_error "  npx @electron/rebuild -f -w node-pty --module-dir . -v $electron_version"
            else
                log_error "  npx @electron/rebuild -f -w node-pty --module-dir ."
            fi
            return 1
        fi
    fi
}

main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  SaaS DocOps Installer (v2.1)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Handle --list mode (no installation needed)
    if [ "$LIST_MODE" = true ]; then
        list_installed_vaults
        exit 0
    fi

    check_obsidian_running
    check_prerequisites
    detect_platform

    # Load all vaults first (needed for --all and --sync)
    log_info "Finding vaults..."
    local config="$HOME/Library/Application Support/obsidian/obsidian.json"
    if [ ! -f "$config" ]; then
        log_error "Obsidian config not found."
        exit 1
    fi

    VAULTS=()
    while IFS= read -r line; do
        if [ -d "$line" ]; then VAULTS+=("$line"); fi
    done < <(CONFIG="$config" python3 -c "
import json, sys, os
config_path = os.getenv('CONFIG')
try:
    with open(config_path, 'r') as f:
        data = json.load(f)
    print('\n'.join([v.get('path', '') for v in data.get('vaults', {}).values() if v.get('path')]))
except: pass
")

    if [ ${#VAULTS[@]} -eq 0 ]; then
        log_error "No vaults found."
        exit 1
    fi

    log_success "Found ${#VAULTS[@]} vault(s)"

    # Download release (needed for all modes)
    download_release

    # Handle different modes
    if [ "$INSTALL_ALL" = true ]; then
        install_to_all_vaults
    elif [ "$SYNC_MODE" = true ]; then
        sync_installed_vaults
    else
        # Normal single vault installation
        select_vault
        install_plugin_files
        check_node_pty
        record_installation "$SELECTED_VAULT"

        if [ "$AUTO_OPEN" = true ] && [ "$INTERACTIVE" = true ] && [ "$TTY_AVAILABLE" = true ]; then
             REPLY=$(safe_read_char "Open Obsidian now? [Y/n] " "y")
             if [[ $REPLY =~ ^[Yy]$ ]]; then
                 open "obsidian://open?path=$(VAULT="$SELECTED_VAULT" python3 -c "import urllib.parse, os; print(urllib.parse.quote(os.getenv('VAULT')))")"
             fi
        fi
    fi
}

main "$@"
