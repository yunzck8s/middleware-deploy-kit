#!/bin/bash

set -euo pipefail

# 颜色输出定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# 设置变量（优先从环境变量读取，否则使用默认值）
NGINX_VERSION="1.28.0"
NGINX_TAR="nginx-${NGINX_VERSION}.tar.gz"
NGINX_INSTALL_DIR="${NGINX_INSTALL_DIR:-/usr/local/nginx}"
NGINX_HTTP_PORT="${NGINX_HTTP_PORT:-80}"
NGINX_HTTPS_PORT="${NGINX_HTTPS_PORT:-443}"
NGINX_USER="${NGINX_USER:-nginx}"
NGINX_WORKER_PROCESSES="${NGINX_WORKER_PROCESSES:-auto}"
NGINX_WORKER_CONNECTIONS="${NGINX_WORKER_CONNECTIONS:-1024}"
ENABLE_SSL="${ENABLE_SSL:-true}"
PACKAGE_DIR="package"

# 打印配置信息
print_info "部署配置:"
print_info "  安装目录: $NGINX_INSTALL_DIR"
print_info "  HTTP 端口: $NGINX_HTTP_PORT"
print_info "  HTTPS 端口: $NGINX_HTTPS_PORT"
print_info "  运行用户: $NGINX_USER"
print_info "  Worker 进程数: $NGINX_WORKER_PROCESSES"
print_info "  Worker 连接数: $NGINX_WORKER_CONNECTIONS"
print_info "  启用 SSL: $ENABLE_SSL"

# 检查是否为 root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "此脚本需要以 root 权限运行"
        exit 1
    fi
}

# 关闭 SELinux
disable_selinux() {
    print_info "关闭 SELinux..."
    if [[ $(getenforce) == "Enforcing" ]]; then
        setenforce 0
        print_success "SELinux 已临时关闭"
    fi
    sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config || true
    print_success "SELinux 配置已修改为 permissive (重启后生效)"
}

# 配置本地 repo
setup_local_repo() {
    print_info "配置本地 repo..."
    mkdir -p /etc/yum.repos.d/nginx-bakrepo
    mv /etc/yum.repos.d/*.repo /etc/yum.repos.d/nginx-bakrepo/ || true

    OS_ID=$(grep '^ID=' /etc/os-release | awk -F= '{print $2}' | tr -d '"')
    print_info "当前操作系统: $OS_ID"

    BUILD_REPO_DIR="/data/buildrepo"
    mkdir -p "$BUILD_REPO_DIR"
    if [[ -d "libs" ]]; then
        tar -zxvf libs/$OS_ID/*.tar.gz --strip-components=1 -C "$BUILD_REPO_DIR"
    else
        print_error "未找到 libs/$OS_ID 离线包"
        exit 1
    fi

    cat > /etc/yum.repos.d/build.repo << EOF
[build]
name=build
baseurl=file://$BUILD_REPO_DIR
gpgcheck=0
enabled=1
EOF

    yum makecache
    print_success "本地 repo 配置完成"
}

# 安装依赖
install_dependencies() {
    print_info "安装依赖..."
    yum install -y gcc pcre-devel zlib-devel openssl-devel
    print_success "依赖安装完成"
}

# 编译安装 Nginx
compile_nginx() {
    if [[ ! -f "$PACKAGE_DIR/$NGINX_TAR" ]]; then
        print_error "$NGINX_TAR 文件未找到，请确保在 $PACKAGE_DIR 目录"
        exit 1
    fi

    tar -zxvf "$PACKAGE_DIR/$NGINX_TAR"
    cd "nginx-${NGINX_VERSION}"

    ./configure --prefix=$NGINX_INSTALL_DIR --with-http_ssl_module
    make
    make install

    print_success "Nginx 编译安装完成"
}

# 配置 systemd 服务
configure_service() {
    print_info "配置 systemd 服务..."
    cat > /etc/systemd/system/nginx.service << EOF
[Unit]
Description=The NGINX HTTP and reverse proxy server By Devops
After=network.target remote-fs.target nss-lookup.target

[Service]
Type=forking
PIDFile=${NGINX_INSTALL_DIR}/logs/nginx.pid
ExecStartPre=${NGINX_INSTALL_DIR}/sbin/nginx -t
ExecStart=${NGINX_INSTALL_DIR}/sbin/nginx
ExecReload=${NGINX_INSTALL_DIR}/sbin/nginx -s reload
ExecStop=/bin/kill -s QUIT \$MAINPID
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable nginx
    print_success "systemd 服务配置完成"
}

# 启动 Nginx
start_nginx() {
    print_info "启动 Nginx..."
    systemctl start nginx
    if systemctl is-active --quiet nginx; then
        print_success "Nginx 启动成功"
    else
        print_error "Nginx 启动失败"
        systemctl status nginx
        exit 1
    fi
}

# 配置日志
configure_logs() {
    print_info "配置 Nginx 日志..."

    # 在 http 块中添加 JSON 格式的日志配置
    # 先备份原配置
    cp ${NGINX_INSTALL_DIR}/conf/nginx.conf ${NGINX_INSTALL_DIR}/conf/nginx.conf.bak

    # 在 http 块的开始位置添加 map 和 log_format
    sed -i '/^http {/a\
    # JSON 日志格式配置\
    map "$time_iso8601 # $msec" $time_iso8601_ms { "~(^[^+]+)(\\+[0-9:]+) # \\d+\\.(\\d+)$" $1.$3$2; }\
    log_format main\
        '"'"'{"timestamp":"$time_iso8601_ms",'"'"'\
        '"'"'"server_ip":"$server_addr",'"'"'\
        '"'"'"remote_ip":"$remote_addr",'"'"'\
        '"'"'"xff":"$http_x_forwarded_for",'"'"'\
        '"'"'"remote_user":"$remote_user",'"'"'\
        '"'"'"domain":"$host",'"'"'\
        '"'"'"url":"$request_uri",'"'"'\
        '"'"'"referer":"$http_referer",'"'"'\
        '"'"'"upstreamtime":"$upstream_response_time",'"'"'\
        '"'"'"responsetime":"$request_time",'"'"'\
        '"'"'"request_method":"$request_method",'"'"'\
        '"'"'"status":"$status",'"'"'\
        '"'"'"response_length":"$bytes_sent",'"'"'\
        '"'"'"request_length":"$request_length",'"'"'\
        '"'"'"protocol":"$server_protocol",'"'"'\
        '"'"'"upstreamhost":"$upstream_addr",'"'"'\
        '"'"'"http_user_agent":"$http_user_agent"'"'"'\
        '"'"'}'"'"';' ${NGINX_INSTALL_DIR}/conf/nginx.conf

    # 修改访问日志使用 main 格式
    sed -i 's|access_log.*|access_log  '"${NGINX_INSTALL_DIR}"'/logs/access.log  main;|' ${NGINX_INSTALL_DIR}/conf/nginx.conf
    sed -i 's|^error_log.*|error_log '"${NGINX_INSTALL_DIR}"'/logs/error.log;|' ${NGINX_INSTALL_DIR}/conf/nginx.conf

    cat > /etc/logrotate.d/nginx << EOF
${NGINX_INSTALL_DIR}/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 640 root root
    sharedscripts
    postrotate
        if [ -f ${NGINX_INSTALL_DIR}/logs/nginx.pid ]; then
            kill -USR1 \$(cat ${NGINX_INSTALL_DIR}/logs/nginx.pid)
        fi
    endscript
}
EOF

    systemctl restart nginx
    print_success "日志配置完成（已启用 JSON 格式）"
}

# 显示安装信息
show_install_info() {
    print_success "Nginx 安装完成！"
    echo "========================================"
    echo "安装路径: ${NGINX_INSTALL_DIR}"
    echo "配置文件: ${NGINX_INSTALL_DIR}/conf/nginx.conf"
    echo "二进制文件: ${NGINX_INSTALL_DIR}/sbin/nginx"
    echo "启动命令: systemctl start nginx"
    echo "停止命令: systemctl stop nginx"
    echo "重启命令: systemctl restart nginx"
    echo "状态查看: systemctl status nginx"
    echo "========================================"
}

# 主函数
main() {
    print_info "开始安装 Nginx..."
    check_root
    disable_selinux
    setup_local_repo
    install_dependencies
    compile_nginx
    configure_service
    start_nginx
    configure_logs
    show_install_info
    print_success "Nginx 安装过程全部完成！"
}

# 错误处理
trap 'print_error "脚本执行过程中出现错误，请查看提示信息"' ERR

# 执行主函数
main "$@"
