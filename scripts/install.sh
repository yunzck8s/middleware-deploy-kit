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

VERSION=$(grep VERSION= VERSION | cut -d= -f2)
echo "==> 安装 Middleware Deploy Kit v${VERSION}"

if [ -d "$INSTALL_DIR" ]; then
    echo "警告: 检测到已安装的版本"
    echo "数据目录: $INSTALL_DIR/data"
    read -p "是否继续安装? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    systemctl stop $SERVICE_NAME 2>/dev/null || true
fi

echo "==> 创建目录..."
mkdir -p $INSTALL_DIR/{bin,web,packages,data,logs}

echo "==> 复制文件..."
cp -r bin/* $INSTALL_DIR/bin/
cp -r web/* $INSTALL_DIR/web/
cp -r packages/* $INSTALL_DIR/packages/
cp -r scripts $INSTALL_DIR/
cp VERSION $INSTALL_DIR/

chmod +x $INSTALL_DIR/bin/server
chmod +x $INSTALL_DIR/scripts/*.sh

echo "==> 安装 systemd 服务..."
cp systemd/middleware-deploy.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable $SERVICE_NAME

echo "==> 启动服务..."
systemctl start $SERVICE_NAME

sleep 2
if systemctl is-active --quiet $SERVICE_NAME; then
    echo "✓ 服务启动成功"
else
    echo "✗ 服务启动失败，请检查日志: journalctl -u $SERVICE_NAME"
    exit 1
fi

echo ""
echo "==> 配置 Nginx 反向代理..."
if command -v nginx &> /dev/null; then
    NGINX_CONF="/etc/nginx/conf.d/middleware-deploy.conf"
    cp config/nginx.conf.template $NGINX_CONF
    nginx -t && systemctl reload nginx
    echo "✓ Nginx 配置已更新"
else
    echo "! Nginx 未安装，请手动配置反向代理"
    echo "  配置模板: $INSTALL_DIR/config/nginx.conf.template"
fi

echo ""
echo "=========================================="
echo "安装完成！"
echo "=========================================="
echo "访问地址: http://$(hostname -I | awk '{print $1}')"
echo "默认账号: admin"
echo "默认密码: admin123"
echo ""
echo "服务管理:"
echo "  启动: systemctl start $SERVICE_NAME"
echo "  停止: systemctl stop $SERVICE_NAME"
echo "  状态: systemctl status $SERVICE_NAME"
echo "  日志: journalctl -u $SERVICE_NAME -f"
echo ""
echo "数据目录: $INSTALL_DIR/data"
echo "=========================================="
