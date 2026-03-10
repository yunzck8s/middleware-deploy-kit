#!/bin/bash
set -e

VERSION=${VERSION:-"1.0.0"}
BUILD_TIME=$(date -u '+%Y-%m-%d_%H:%M:%S')
DIST_DIR="$(cd "$(dirname "$0")/.." && pwd)/dist"
BUILD_DIR="$DIST_DIR/middleware-deploy-kit-v${VERSION}"
ARCHIVE_NAME="middleware-deploy-kit-v${VERSION}-linux-amd64.tar.gz"

echo "==> Building Middleware Deploy Kit v${VERSION}"

# Clean
rm -rf "$DIST_DIR"
mkdir -p "$BUILD_DIR"/{bin,web,packages,config,scripts,systemd,docs}

# Build backend
echo "==> Building backend (Linux amd64)..."
cd "$(dirname "$0")/../backend"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -ldflags "-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME}" \
  -o "$BUILD_DIR/bin/server" \
  ./cmd/server

# Build frontend
echo "==> Building frontend..."
cd "$(dirname "$0")/../frontend"
npm run build
cp -r dist/* "$BUILD_DIR/web/"

# Copy Nginx package
echo "==> Copying Nginx offline package..."
cp -r "$(dirname "$0")/../packages/nginx" "$BUILD_DIR/packages/"

# Copy deployment files
echo "==> Copying deployment files..."
cp "$(dirname "$0")/../deploy/systemd/middleware-deploy.service" "$BUILD_DIR/systemd/"
cp "$(dirname "$0")/../deploy/nginx/nginx.conf.template" "$BUILD_DIR/config/"
cp "$(dirname "$0")/../deploy/config/config.yaml.example" "$BUILD_DIR/config/" 2>/dev/null || true

# Copy scripts
cp "$(dirname "$0")/install.sh" "$BUILD_DIR/scripts/"
cp "$(dirname "$0")/uninstall.sh" "$BUILD_DIR/scripts/"
cp "$(dirname "$0")/upgrade.sh" "$BUILD_DIR/scripts/"
chmod +x "$BUILD_DIR/scripts/"*.sh

# Copy docs
cp "$(dirname "$0")/../docs/DEPLOYMENT.md" "$BUILD_DIR/" 2>/dev/null || echo "部署文档" > "$BUILD_DIR/README.md"

# Create VERSION file
echo "VERSION=${VERSION}" > "$BUILD_DIR/VERSION"
echo "BUILD_TIME=${BUILD_TIME}" >> "$BUILD_DIR/VERSION"
echo "PLATFORM=linux-amd64" >> "$BUILD_DIR/VERSION"

# Create archive
echo "==> Creating archive..."
cd "$DIST_DIR"
tar -czf "$ARCHIVE_NAME" "middleware-deploy-kit-v${VERSION}"

SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
echo "==> Build complete: $ARCHIVE_NAME ($SIZE)"
echo "    Location: $DIST_DIR/$ARCHIVE_NAME"
