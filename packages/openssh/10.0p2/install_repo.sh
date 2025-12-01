#!/bin/bash

set -euo pipefail

ARCH=$(uname -m)
if [[ "$ARCH" != "x86_64" && "$ARCH" != "amd64" ]]; then
  echo "当前系统架构为 $ARCH，非 x86 架构，脚本退出"
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "请以 root 用户运行此脚本"
  exit 1
fi

echo "***************************开始备份ssh配置***************************"
sudo cp -r /etc/ssh /etc/ssh_old
echo "***************************备份ssh配置完成***************************"

mkdir -p /etc/yum.repos.d/ssh-bakrepo
mv /etc/yum.repos.d/*.repo /etc/yum.repos.d/ssh-bakrepo/


# 操作系统离线 yum 源匹配
OS_ID=$(grep '^ID=' /etc/os-release | awk -F= '{print $2}' | tr -d '"')
echo -e "\033[1;32m当前操作系统: $OS_ID\033[0m"

# 离线源配置
BUILD_REPO_DIR="/data/buildrepo"
mkdir -p "$BUILD_REPO_DIR"
if [ -d "libs" ]; then
  tar -zxvf libs/$OS_ID/*.tar.gz --strip-components=1 -C "$BUILD_REPO_DIR"
else
  echo "libs 目录不存在或未找到任何 .tar.gz 文件"
  exit 1
fi

# 本地源配置
cat > /etc/yum.repos.d/build.repo << EOF
[build]
name=build
baseurl=file://$BUILD_REPO_DIR
gpgcheck=0
enabled=1
EOF

yum makecache || { echo "本地缓存构建失败"; exit 1; }
yum install -y gcc make zlib-devel pam-devel openssl-devel || { echo "依赖安装失败"; exit 1; }

echo "***************************依赖安装完成***************************"



