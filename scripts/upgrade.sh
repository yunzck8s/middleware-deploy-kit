#!/bin/bash
set -e

INSTALL_DIR="/data/middleware-deploy-kit"
SERVICE_NAME="middleware-deploy"

if [ "$EUID" -ne 0 ]; then
    echo "错误: 请使用 root 权限运行此脚本"
    exit 1
fi

if [ ! -f "VERSION" ]; then
    echo "错误: 请在解压后的目录中运行此脚本"
    exit 1
fi

NEW_VERSION=$(grep VERSION= VERSION | cut -d= -f2)
OLD_VERSION=$(grep VERSION= $INSTALL_DIR/VERSION 2>/dev/null | cut -d= -f2 || echo "unknown")

echo "==> 升级 Middleware Deploy Kit"
echo "当前版本: $OLD_VERSION"
echo "新版本: $NEW_VERSION"

BACKUP_DIR="$INSTALL_DIR.backup.$(date +%Y%m%d_%H%M%S)"
echo "==> 备份当前版本到 $BACKUP_DIR"
mkdir -p $BACKUP_DIR
cp -r $INSTALL_DIR/{bin,web,VERSION} $BACKUP_DIR/

echo "==> 停止服务..."
systemctl stop $SERVICE_NAME

echo "==> 更新文件..."
cp -r bin/* $INSTALL_DIR/bin/
cp -r web/* $INSTALL_DIR/web/
cp -r packages/* $INSTALL_DIR/packages/
cp -r scripts $INSTALL_DIR/
cp VERSION $INSTALL_DIR/

chmod +x $INSTALL_DIR/bin/server
chmod +x $INSTALL_DIR/scripts/*.sh

echo "==> 启动服务..."
systemctl start $SERVICE_NAME

sleep 2
if systemctl is-active --quiet $SERVICE_NAME; then
    echo "✓ 升级完成: v$OLD_VERSION -> v$NEW_VERSION"
    echo "备份位置: $BACKUP_DIR"
else
    echo "✗ 服务启动失败，正在回滚..."
    cp -r $BACKUP_DIR/{bin,web,VERSION} $INSTALL_DIR/
    systemctl start $SERVICE_NAME
    echo "已回滚到 v$OLD_VERSION"
    exit 1
fi
