#!/bin/bash
set -e

INSTALL_DIR="/data/middleware-deploy-kit"

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
    echo "警告: 检测到已安装的版本，数据目录: $INSTALL_DIR/data"
    read -p "是否继续安装? (y/N) " -n 1 -r
    echo
    [[ ! $REPLY =~ ^[Yy]$ ]] && exit 1
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

echo ""
echo "=========================================="
echo "安装完成！"
echo "=========================================="
echo ""
echo "启动服务:"
echo "  cd $INSTALL_DIR && nohup ./bin/server > logs/server.log 2>&1 &"
echo ""
echo "访问地址: http://$(hostname -I | awk '{print $1}'):8080"
echo "默认账号: admin"
echo "默认密码: admin123"
echo ""
echo "查看日志: tail -f $INSTALL_DIR/logs/server.log"
echo "停止服务: kill \$(pgrep -f '$INSTALL_DIR/bin/server')"
echo "数据目录: $INSTALL_DIR/data"
echo "=========================================="
