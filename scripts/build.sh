#!/bin/bash
set -e

VERSION=${VERSION:-"1.0.0"}
BUILD_TIME=$(date -u '+%Y-%m-%d_%H:%M:%S')
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"
BUILD_DIR="$DIST_DIR/middleware-deploy-kit-v${VERSION}"
ARCHIVE_NAME="middleware-deploy-kit-v${VERSION}-linux-amd64.tar.gz"

echo "==> Building Middleware Deploy Kit v${VERSION}"

rm -rf "$DIST_DIR"
mkdir -p "$BUILD_DIR"/{bin,web,packages,scripts}

# Build backend
echo "==> Building backend (Linux amd64)..."
cd "$PROJECT_ROOT/backend"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -ldflags "-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME}" \
  -o "$BUILD_DIR/bin/server" \
  ./cmd/server

# Build frontend
echo "==> Building frontend..."
cd "$PROJECT_ROOT/frontend"
npm run build
cp -r dist/* "$BUILD_DIR/web/"

# Copy Nginx offline package
echo "==> Copying Nginx offline package..."
cp -r "$PROJECT_ROOT/packages/nginx" "$BUILD_DIR/packages/"

# Copy scripts
cp "$PROJECT_ROOT/scripts/install.sh" "$BUILD_DIR/scripts/"
cp "$PROJECT_ROOT/scripts/uninstall.sh" "$BUILD_DIR/scripts/"
cp "$PROJECT_ROOT/scripts/upgrade.sh" "$BUILD_DIR/scripts/"
chmod +x "$BUILD_DIR/scripts/"*.sh

# VERSION file
echo "VERSION=${VERSION}" > "$BUILD_DIR/VERSION"
echo "BUILD_TIME=${BUILD_TIME}" >> "$BUILD_DIR/VERSION"

# Create archive
echo "==> Creating archive..."
cd "$DIST_DIR"
tar -czf "$ARCHIVE_NAME" "middleware-deploy-kit-v${VERSION}"

SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
echo "==> Build complete: $ARCHIVE_NAME ($SIZE)"
echo "    Location: $DIST_DIR/$ARCHIVE_NAME"
