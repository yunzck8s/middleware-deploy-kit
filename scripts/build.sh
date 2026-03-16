#!/bin/bash
set -e

VERSION=${VERSION:-"1.0.0"}
BUILD_TIME=$(date -u '+%Y-%m-%d_%H:%M:%S')
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$PROJECT_ROOT/dist"

# 支持指定架构，默认构建两种
# 用法: ARCH=arm64 ./build.sh  或  ARCH=all ./build.sh
ARCH=${ARCH:-"all"}

echo "==> Building Middleware Deploy Kit v${VERSION}"

rm -rf "$DIST_DIR"

# 前端只需构建一次（平台无关）
echo "==> Building frontend..."
cd "$PROJECT_ROOT/frontend"
npm run build

build_for_arch() {
  local arch=$1
  local BUILD_DIR="$DIST_DIR/middleware-deploy-kit-v${VERSION}-linux-${arch}"
  local ARCHIVE_NAME="middleware-deploy-kit-v${VERSION}-linux-${arch}.tar.gz"

  echo ""
  echo "==> Building backend (linux/${arch})..."
  mkdir -p "$BUILD_DIR"/{bin,web,packages,scripts}

  # 构建后端
  cd "$PROJECT_ROOT/backend"
  CGO_ENABLED=0 GOOS=linux GOARCH="${arch}" go build \
    -ldflags "-s -w -X main.Version=${VERSION} -X main.BuildTime=${BUILD_TIME}" \
    -o "$BUILD_DIR/bin/server" \
    ./cmd/server

  # 复制前端产物
  cp -r "$PROJECT_ROOT/frontend/dist/"* "$BUILD_DIR/web/"

  # 复制 Nginx 离线包
  cp -r "$PROJECT_ROOT/packages/nginx" "$BUILD_DIR/packages/"

  # 复制脚本
  cp "$PROJECT_ROOT/scripts/install.sh" "$BUILD_DIR/scripts/"
  cp "$PROJECT_ROOT/scripts/uninstall.sh" "$BUILD_DIR/scripts/"
  cp "$PROJECT_ROOT/scripts/upgrade.sh" "$BUILD_DIR/scripts/"
  chmod +x "$BUILD_DIR/scripts/"*.sh

  # VERSION 文件
  cat > "$BUILD_DIR/VERSION" <<EOF
VERSION=${VERSION}
BUILD_TIME=${BUILD_TIME}
ARCH=${arch}
EOF

  # 打包
  echo "==> Creating archive: ${ARCHIVE_NAME}..."
  cd "$DIST_DIR"
  tar -czf "$ARCHIVE_NAME" "$(basename "$BUILD_DIR")"

  local SIZE
  SIZE=$(du -h "$ARCHIVE_NAME" | cut -f1)
  echo "    Done: $ARCHIVE_NAME ($SIZE)"
}

# 按指定架构构建
case "$ARCH" in
  all)
    build_for_arch "amd64"
    build_for_arch "arm64"
    ;;
  amd64|arm64)
    build_for_arch "$ARCH"
    ;;
  *)
    echo "Error: 不支持的架构 '$ARCH'，可选: amd64, arm64, all"
    exit 1
    ;;
esac

echo ""
echo "==> Build complete!"
ls -lh "$DIST_DIR"/*.tar.gz
