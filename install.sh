#!/bin/bash
# SaaS DocOps - One-line installer for macOS
# Usage: curl -sSL https://raw.githubusercontent.com/jaylkim/saas-docops/main/install.sh | bash
#
# This script:
# 1. Checks prerequisites (Node.js, npm, Claude Code CLI)
# 2. Detects platform (darwin-arm64 / darwin-x64)
# 3. Finds Obsidian vaults
# 4. Downloads and installs the plugin
# 5. Rebuilds node-pty if needed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER="jaylkim"
REPO_NAME="saas-docops"
PLUGIN_ID="saas-docops"
GITHUB_API="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"

# Print with color
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Header
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  SaaS DocOps Installer"
echo "  Claude Code GUI for Obsidian"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# Prerequisites Check
# ============================================================================

check_prerequisites() {
    print_info "Checking prerequisites..."

    local missing=()

    # Check Node.js
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        print_success "Node.js: $node_version"
    else
        missing+=("Node.js")
        print_error "Node.js not found"
    fi

    # Check npm
    if command -v npm &> /dev/null; then
        local npm_version=$(npm --version)
        print_success "npm: $npm_version"
    else
        missing+=("npm")
        print_error "npm not found"
    fi

    # Check Claude Code CLI
    if command -v claude &> /dev/null; then
        local claude_version=$(claude --version 2>/dev/null || echo "installed")
        print_success "Claude Code CLI: $claude_version"
    else
        print_warning "Claude Code CLI not found"
        echo ""
        read -p "    Claude Code CLI가 필요합니다. 지금 설치하시겠습니까? [Y/n] " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
            print_info "Installing Claude Code CLI..."
            npm install -g @anthropic-ai/claude-code
            if command -v claude &> /dev/null; then
                print_success "Claude Code CLI installed successfully"
            else
                print_error "Failed to install Claude Code CLI"
                missing+=("Claude Code CLI")
            fi
        else
            missing+=("Claude Code CLI")
        fi
    fi

    # Check Obsidian
    if [ -d "/Applications/Obsidian.app" ]; then
        print_success "Obsidian: installed"
    else
        print_warning "Obsidian not found at /Applications/Obsidian.app"
        print_warning "Make sure Obsidian is installed before using this plugin"
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        echo ""
        print_error "Missing prerequisites: ${missing[*]}"
        echo ""
        echo "설치 방법:"
        for item in "${missing[@]}"; do
            case $item in
                "Node.js"|"npm")
                    echo "  Node.js/npm: https://nodejs.org/ 에서 다운로드"
                    echo "             또는 brew install node"
                    ;;
                "Claude Code CLI")
                    echo "  Claude Code: npm install -g @anthropic-ai/claude-code"
                    ;;
            esac
        done
        exit 1
    fi

    echo ""
}

# ============================================================================
# Platform Detection
# ============================================================================

detect_platform() {
    print_info "Detecting platform..."

    local os=$(uname -s)
    local arch=$(uname -m)

    if [ "$os" != "Darwin" ]; then
        print_error "This installer only supports macOS"
        print_error "Current OS: $os"
        exit 1
    fi

    case $arch in
        arm64)
            PLATFORM="darwin-arm64"
            print_success "Platform: macOS Apple Silicon (arm64)"
            ;;
        x86_64)
            PLATFORM="darwin-x64"
            print_success "Platform: macOS Intel (x64)"
            ;;
        *)
            print_error "Unsupported architecture: $arch"
            exit 1
            ;;
    esac

    echo ""
}

# ============================================================================
# Find Obsidian Vaults
# ============================================================================

find_obsidian_vaults() {
    print_info "Finding Obsidian vaults..."

    local obsidian_config="$HOME/Library/Application Support/obsidian/obsidian.json"

    if [ ! -f "$obsidian_config" ]; then
        print_error "Obsidian config not found"
        print_error "Please open Obsidian at least once to create a vault"
        exit 1
    fi

    # Parse vault paths from obsidian.json
    # Format: {"vaults": {"vault_id": {"path": "/path/to/vault", ...}, ...}}
    VAULTS=()

    # Use python or node to parse JSON (more reliable than grep/sed)
    if command -v python3 &> /dev/null; then
        while IFS= read -r vault_path; do
            if [ -d "$vault_path" ]; then
                VAULTS+=("$vault_path")
            fi
        done < <(python3 -c "
import json
import sys
try:
    with open('$obsidian_config', 'r') as f:
        data = json.load(f)
    vaults = data.get('vaults', {})
    for v in vaults.values():
        path = v.get('path', '')
        if path:
            print(path)
except Exception as e:
    sys.exit(1)
")
    elif command -v node &> /dev/null; then
        while IFS= read -r vault_path; do
            if [ -d "$vault_path" ]; then
                VAULTS+=("$vault_path")
            fi
        done < <(node -e "
const fs = require('fs');
try {
    const data = JSON.parse(fs.readFileSync('$obsidian_config', 'utf8'));
    const vaults = data.vaults || {};
    Object.values(vaults).forEach(v => {
        if (v.path) console.log(v.path);
    });
} catch (e) {
    process.exit(1);
}
")
    else
        print_error "Neither python3 nor node available for JSON parsing"
        exit 1
    fi

    if [ ${#VAULTS[@]} -eq 0 ]; then
        print_error "No Obsidian vaults found"
        print_error "Please create a vault in Obsidian first"
        exit 1
    fi

    print_success "Found ${#VAULTS[@]} vault(s)"

    # Let user select vault if multiple
    if [ ${#VAULTS[@]} -eq 1 ]; then
        SELECTED_VAULT="${VAULTS[0]}"
        print_success "Using vault: $SELECTED_VAULT"
    else
        echo ""
        echo "여러 vault가 발견되었습니다. 설치할 vault를 선택하세요:"
        echo ""
        for i in "${!VAULTS[@]}"; do
            echo "  $((i+1)). ${VAULTS[$i]}"
        done
        echo ""

        while true; do
            read -p "선택 [1-${#VAULTS[@]}]: " choice
            if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#VAULTS[@]}" ]; then
                SELECTED_VAULT="${VAULTS[$((choice-1))]}"
                break
            else
                print_warning "올바른 번호를 입력하세요"
            fi
        done
        print_success "Selected vault: $SELECTED_VAULT"
    fi

    echo ""
}

# ============================================================================
# Detect Obsidian Electron Version
# ============================================================================

detect_electron_version() {
    print_info "Detecting Obsidian Electron version..."

    local electron_framework="/Applications/Obsidian.app/Contents/Frameworks/Electron Framework.framework"

    if [ ! -d "$electron_framework" ]; then
        print_warning "Could not detect Electron version"
        ELECTRON_VERSION="unknown"
        return
    fi

    # Try to get version from Info.plist
    local info_plist="$electron_framework/Resources/Info.plist"
    if [ -f "$info_plist" ]; then
        ELECTRON_VERSION=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$info_plist" 2>/dev/null || echo "unknown")
    else
        ELECTRON_VERSION="unknown"
    fi

    if [ "$ELECTRON_VERSION" != "unknown" ]; then
        print_success "Obsidian Electron version: $ELECTRON_VERSION"
    else
        print_warning "Could not detect Electron version (will try to use prebuilt binaries)"
    fi

    echo ""
}

# ============================================================================
# Download Latest Release
# ============================================================================

download_latest_release() {
    print_info "Fetching latest release info..."

    # Get release info from GitHub API
    local release_info
    release_info=$(curl -sS "$GITHUB_API")

    if [ $? -ne 0 ]; then
        print_error "Failed to fetch release info from GitHub"
        exit 1
    fi

    # Parse version and download URL
    if command -v python3 &> /dev/null; then
        VERSION=$(echo "$release_info" | python3 -c "import json,sys; print(json.load(sys.stdin).get('tag_name', ''))")
        DOWNLOAD_URL=$(echo "$release_info" | python3 -c "
import json,sys
data = json.load(sys.stdin)
assets = data.get('assets', [])
platform = '$PLATFORM'
for asset in assets:
    name = asset.get('name', '')
    if platform in name and name.endswith('.zip'):
        print(asset.get('browser_download_url', ''))
        break
")
    else
        VERSION=$(echo "$release_info" | node -e "
const chunks = [];
process.stdin.on('data', d => chunks.push(d));
process.stdin.on('end', () => {
    const data = JSON.parse(chunks.join(''));
    console.log(data.tag_name || '');
});
")
        DOWNLOAD_URL=$(echo "$release_info" | node -e "
const chunks = [];
process.stdin.on('data', d => chunks.push(d));
process.stdin.on('end', () => {
    const data = JSON.parse(chunks.join(''));
    const platform = '$PLATFORM';
    const asset = (data.assets || []).find(a => a.name.includes(platform) && a.name.endsWith('.zip'));
    console.log(asset ? asset.browser_download_url : '');
});
")
    fi

    if [ -z "$VERSION" ]; then
        print_error "Could not determine latest version"
        exit 1
    fi

    if [ -z "$DOWNLOAD_URL" ]; then
        print_error "No release found for platform: $PLATFORM"
        print_error "Available at: https://github.com/${REPO_OWNER}/${REPO_NAME}/releases"
        exit 1
    fi

    print_success "Latest version: $VERSION"
    print_info "Downloading from: $DOWNLOAD_URL"

    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT

    # Download
    local zip_file="$TEMP_DIR/$PLUGIN_ID.zip"
    curl -sL -o "$zip_file" "$DOWNLOAD_URL"

    if [ ! -f "$zip_file" ]; then
        print_error "Download failed"
        exit 1
    fi

    print_success "Downloaded successfully"

    # Extract
    print_info "Extracting..."
    unzip -q "$zip_file" -d "$TEMP_DIR"

    EXTRACTED_DIR="$TEMP_DIR"
    print_success "Extracted"

    echo ""
}

# ============================================================================
# Install Plugin
# ============================================================================

install_plugin() {
    print_info "Installing plugin to vault..."

    local plugin_dir="$SELECTED_VAULT/.obsidian/plugins/$PLUGIN_ID"

    # Create plugin directory
    mkdir -p "$plugin_dir"

    # Copy files
    if [ -f "$EXTRACTED_DIR/main.js" ]; then
        cp "$EXTRACTED_DIR/main.js" "$plugin_dir/"
    fi
    if [ -f "$EXTRACTED_DIR/styles.css" ]; then
        cp "$EXTRACTED_DIR/styles.css" "$plugin_dir/"
    fi
    if [ -f "$EXTRACTED_DIR/manifest.json" ]; then
        cp "$EXTRACTED_DIR/manifest.json" "$plugin_dir/"
    fi

    # Copy native modules
    if [ -d "$EXTRACTED_DIR/node_modules" ]; then
        cp -r "$EXTRACTED_DIR/node_modules" "$plugin_dir/"
    fi

    print_success "Files copied to: $plugin_dir"

    # Enable plugin in community-plugins.json
    local community_plugins="$SELECTED_VAULT/.obsidian/community-plugins.json"

    if [ -f "$community_plugins" ]; then
        # Check if already enabled
        if grep -q "\"$PLUGIN_ID\"" "$community_plugins"; then
            print_success "Plugin already enabled"
        else
            # Add to existing array
            if [ "$(cat "$community_plugins")" = "[]" ]; then
                echo "[\"$PLUGIN_ID\"]" > "$community_plugins"
            else
                # Use sed to add to JSON array
                sed -i '' 's/\]$/,"'"$PLUGIN_ID"'"]/' "$community_plugins"
            fi
            print_success "Plugin enabled"
        fi
    else
        # Create new file
        echo "[\"$PLUGIN_ID\"]" > "$community_plugins"
        print_success "Plugin enabled"
    fi

    echo ""
}

# ============================================================================
# Rebuild node-pty if needed
# ============================================================================

check_and_rebuild_pty() {
    print_info "Checking node-pty compatibility..."

    local pty_dir="$SELECTED_VAULT/.obsidian/plugins/$PLUGIN_ID/node_modules/node-pty"

    if [ ! -d "$pty_dir" ]; then
        print_warning "node-pty not found in plugin"
        return
    fi

    # Check if rebuild is needed by testing the binary
    local pty_binary="$pty_dir/build/Release/pty.node"

    if [ ! -f "$pty_binary" ]; then
        print_warning "node-pty binary not found, may need rebuild"

        read -p "    node-pty를 재빌드하시겠습니까? [y/N] " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rebuild_pty
        fi
        return
    fi

    # The prebuilt binary should work for the target platform
    # If there are issues, user can manually rebuild
    print_success "node-pty binary found"
    echo ""
}

rebuild_pty() {
    print_info "Rebuilding node-pty for Obsidian Electron..."

    local plugin_dir="$SELECTED_VAULT/.obsidian/plugins/$PLUGIN_ID"

    cd "$plugin_dir"

    # Determine Electron version to use
    local electron_version="${ELECTRON_VERSION}"
    if [ "$electron_version" = "unknown" ]; then
        electron_version="33.3.2"  # Default Obsidian Electron version
        print_warning "Using default Electron version: $electron_version"
    fi

    # Run electron-rebuild
    print_info "Running electron-rebuild..."
    npx electron-rebuild -f -w node-pty -v "$electron_version"

    if [ $? -eq 0 ]; then
        print_success "node-pty rebuilt successfully"
    else
        print_error "node-pty rebuild failed"
        echo ""
        echo "수동으로 재빌드하려면:"
        echo "  cd \"$plugin_dir\""
        echo "  npx electron-rebuild -f -w node-pty -v $electron_version"
    fi

    echo ""
}

# ============================================================================
# Main
# ============================================================================

main() {
    check_prerequisites
    detect_platform
    find_obsidian_vaults
    detect_electron_version
    download_latest_release
    install_plugin
    check_and_rebuild_pty

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_success "Installation complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "다음 단계:"
    echo "  1. Obsidian을 열거나 재시작하세요 (Cmd+R)"
    echo "  2. Settings → Community Plugins에서 '$PLUGIN_ID' 활성화 확인"
    echo "  3. 리본의 터미널 아이콘을 클릭하거나 'Open Terminal' 명령 실행"
    echo ""
    echo "처음 사용 시 설정 마법사가 자동으로 열립니다."
    echo ""

    # Open vault in Obsidian
    read -p "지금 Obsidian에서 vault를 여시겠습니까? [Y/n] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
        open "obsidian://open?path=$(echo "$SELECTED_VAULT" | sed 's/ /%20/g')"
    fi
}

main "$@"
