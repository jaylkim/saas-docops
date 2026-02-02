#!/bin/bash
# SaaS DocOps - Local Release Packaging Script
# Creates a release package for the current platform without CI
#
# Usage: ./scripts/package-release.sh [version]
# Example: ./scripts/package-release.sh v0.1.0

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"

# Default Electron version (Obsidian)
ELECTRON_VERSION="${ELECTRON_VERSION:-33.3.2}"

# Detect platform
detect_platform() {
    local os=$(uname -s)
    local arch=$(uname -m)

    if [ "$os" != "Darwin" ]; then
        print_error "This script only supports macOS"
        exit 1
    fi

    case $arch in
        arm64)
            PLATFORM="darwin-arm64"
            ;;
        x86_64)
            PLATFORM="darwin-x64"
            ;;
        *)
            print_error "Unsupported architecture: $arch"
            exit 1
            ;;
    esac
}

# Get version
get_version() {
    if [ -n "$1" ]; then
        VERSION="$1"
    else
        # Get from manifest.json
        VERSION="v$(node -e "console.log(require('./manifest.json').version)")"
    fi

    # Validate version format
    if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+ ]]; then
        print_error "Invalid version format: $VERSION"
        print_error "Expected: vX.Y.Z (e.g., v0.1.0)"
        exit 1
    fi
}

# Main
main() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  SaaS DocOps - Release Packaging"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    cd "$PROJECT_DIR"

    detect_platform
    get_version "$1"

    print_info "Version: $VERSION"
    print_info "Platform: $PLATFORM"
    print_info "Electron: $ELECTRON_VERSION"
    echo ""

    # Build
    print_info "Building plugin..."
    npm run build
    print_success "Build complete"

    # Rebuild node-pty
    print_info "Rebuilding node-pty for Electron $ELECTRON_VERSION..."
    npx electron-rebuild -f -w node-pty -v "$ELECTRON_VERSION"
    print_success "node-pty rebuilt"

    # Create dist directory
    mkdir -p "$DIST_DIR"

    # Package name
    PACKAGE_NAME="saas-docops-${VERSION}-${PLATFORM}"
    PACKAGE_DIR="$DIST_DIR/$PACKAGE_NAME"

    # Clean previous package
    rm -rf "$PACKAGE_DIR" "$PACKAGE_DIR.zip"

    # Create package directory
    mkdir -p "$PACKAGE_DIR"

    print_info "Creating package..."

    # Copy main files
    cp "$PROJECT_DIR/main.js" "$PACKAGE_DIR/"
    cp "$PROJECT_DIR/styles.css" "$PACKAGE_DIR/"
    cp "$PROJECT_DIR/manifest.json" "$PACKAGE_DIR/"

    # Copy package.json (required for @electron/rebuild)
    cp "$PROJECT_DIR/package.json" "$PACKAGE_DIR/"

    # Copy node-pty (native module)
    mkdir -p "$PACKAGE_DIR/node_modules"
    cp -r "$PROJECT_DIR/node_modules/node-pty" "$PACKAGE_DIR/node_modules/"

    # Copy node-addon-api (peer dependency)
    cp -r "$PROJECT_DIR/node_modules/node-addon-api" "$PACKAGE_DIR/node_modules/"

    # Clean up unnecessary files to reduce size
    print_info "Cleaning up..."
    rm -rf "$PACKAGE_DIR/node_modules/node-pty/node_modules" 2>/dev/null || true
    rm -rf "$PACKAGE_DIR/node_modules/node-pty/src" 2>/dev/null || true
    rm -rf "$PACKAGE_DIR/node_modules/node-pty/deps" 2>/dev/null || true
    rm -rf "$PACKAGE_DIR/node_modules/node-pty/binding.gyp" 2>/dev/null || true
    rm -rf "$PACKAGE_DIR/node_modules/node-pty/"*.md 2>/dev/null || true
    rm -rf "$PACKAGE_DIR/node_modules/node-addon-api/"*.md 2>/dev/null || true
    rm -rf "$PACKAGE_DIR/node_modules/node-addon-api/doc" 2>/dev/null || true
    rm -rf "$PACKAGE_DIR/node_modules/node-addon-api/test" 2>/dev/null || true
    rm -rf "$PACKAGE_DIR/node_modules/node-addon-api/tools" 2>/dev/null || true

    # Create zip
    print_info "Creating zip archive..."
    cd "$DIST_DIR"
    zip -r "$PACKAGE_NAME.zip" "$PACKAGE_NAME"

    # Cleanup directory
    rm -rf "$PACKAGE_DIR"

    # Show results
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_success "Package created!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  File: $DIST_DIR/$PACKAGE_NAME.zip"
    echo "  Size: $(ls -lh "$PACKAGE_NAME.zip" | awk '{print $5}')"
    echo ""
    echo "Contents:"
    unzip -l "$PACKAGE_NAME.zip" | head -20
    echo ""
    echo "테스트 설치:"
    echo "  1. 원하는 vault의 .obsidian/plugins/saas-docops/에 압축 해제"
    echo "  2. Obsidian 재시작"
    echo ""

    # Option to install locally
    read -p "테스트 vault에 바로 설치하시겠습니까? [y/N] " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Use the existing deploy script's default vault
        local test_vault="/Users/jay/projects/temp"
        if [ -d "$test_vault/.obsidian" ]; then
            print_info "Installing to $test_vault..."
            local plugin_dir="$test_vault/.obsidian/plugins/saas-docops"
            mkdir -p "$plugin_dir"
            unzip -o "$PACKAGE_NAME.zip" -d "$DIST_DIR"
            cp -r "$PACKAGE_DIR/"* "$plugin_dir/"
            rm -rf "$PACKAGE_DIR"
            print_success "Installed to test vault"
        else
            print_warning "Test vault not found at $test_vault"
        fi
    fi
}

main "$@"
