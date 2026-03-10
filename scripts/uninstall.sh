#!/bin/bash
set -e

INSTALL_DIR="/data/middleware-deploy-kit"
SERVICE_NAME="middleware-deploy"

if [ "$EUID" -ne 0 ]; then
    echo "错误: 请使用 root 权限运行此脚本"
    exit 1
fi

echo "==> 卸载 Middleware Deploy Kit"
echo ""
echo "警告: 此操作将删除程序文件"
read -p "是否保留数据目录? (Y/n) " -n 1 -r
echo
KEEP_DATA=true
[[ $REPLY =~ ^[Nn]$ ]] && KEEP_DATA=false

echo "==> 停止服务..."
systemctl stop $SERVICE_NAME 2>/dev/null || true
systemctl disable $SERVICE_NAME 2>/dev/null || true
rm -f /etc/systemd/system/$SERVICE_NAME.service
systemctl daemon-reload

echo "==> 删除 Nginx 配置..."
rm -f /etc/nginx/conf.d/middleware-deploy.conf
command -v nginx &> /dev/null && nginx -t && systemctl reload nginx 2>/dev/null || true

if [ "$KEEP_DATA" = true ]; then
    echo "==> 备份数据目录..."
    BACKUP_DIR="$INSTALL_DIR.backup.$(date +%Y%m%d_%H%M%S)"
    mv $INSTALL_DIR/data $BACKUP_DIR 2>/dev/null || true
    echo "数据已备份至: $BACKUP_DIR"
fi

echo "==> 删除程序文件..."
rm -rf $INSTALL_DIR

echo "卸载完成"
