#!/bin/bash

set -e

# 颜色输出定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的信息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "此脚本需要以root权限运行"
        exit 1
    fi
}

# 检查系统版本
check_os_version() {
    if [[ -f /etc/redhat-release ]]; then
        os_version=$(cat /etc/redhat-release)
        if [[ $os_version == *"Rocky Linux release 9.4"* ]]; then
            print_info "检测到 Rocky Linux 9.4"
        else
            print_warning "检测到系统版本: $os_version"
            print_warning "此脚本专为 Rocky Linux 9.4 设计，其他系统可能存在兼容性问题"
        fi
    else
        print_warning "无法检测到系统版本，继续执行..."
    fi
}

# 设置变量
REDIS_VERSION="7.2.7"
REDIS_PACKAGE_NAME="redis-${REDIS_VERSION}.tar.gz"
REDIS_INSTALL_DIR="/usr/local/redis"
REDIS_CONFIG_DIR="/data/redis/conf"
REDIS_DATA_DIR="/data/redis/data"
REDIS_LOG_DIR="/data/redis/log"
REDIS_USER="redis"
REDIS_SERVICE_FILE="/etc/systemd/system/redis.service"

# 参数化配置（可通过环境变量覆盖）
REDIS_PORT="${REDIS_PORT:-6379}"
# 密码为空时自动生成随机密码
if [[ -z "${REDIS_PASSWORD}" ]]; then
    REDIS_PASSWORD="$(openssl rand -base64 32)"
fi

# 集群模式参数
REDIS_CLUSTER_ENABLED="${REDIS_CLUSTER_ENABLED:-false}"
REDIS_PORTS="${REDIS_PORTS:-}"
REDIS_CLUSTER_BASE_DIR="${REDIS_CLUSTER_BASE_DIR:-/data/redis-cluster}"

# 检查离线包是否存在
check_offline_package() {
    print_info "检查离线安装包..."

    if [[ -f "./${REDIS_PACKAGE_NAME}" ]]; then
        print_success "找到离线安装包: ${REDIS_PACKAGE_NAME}"
    else
        print_error "未找到离线安装包: ${REDIS_PACKAGE_NAME}"
        print_error "请将 ${REDIS_PACKAGE_NAME} 放置在当前目录下"
        exit 1
    fi
}

# 安装依赖包
install_dependencies() {
    print_info "安装依赖包..."

    # 检查是否已安装依赖
    if command -v gcc &> /dev/null && command -v make &> /dev/null && rpm -q jemalloc-devel &> /dev/null 2>&1; then
        print_success "依赖包已安装"
        return
    fi

    print_info "使用本地YUM仓库安装依赖..."

    # 检查repo目录是否存在
    if [[ ! -d "./repo" ]]; then
        print_error "未找到本地repo目录: ./repo"
        print_error "请确保repo文件夹在当前目录下"
        exit 1
    fi

    # 备份并禁用所有远程仓库，避免离线环境卡住
    mkdir -p /etc/yum.repos.d/backup
    for repo_file in /etc/yum.repos.d/*.repo; do
        [[ "$(basename "$repo_file")" == "redis-local.repo" ]] && continue
        mv "$repo_file" /etc/yum.repos.d/backup/ 2>/dev/null || true
    done
    print_info "已临时禁用远程仓库"

    # 创建本地仓库
    cat > /etc/yum.repos.d/redis-local.repo << EOF
[redis-local]
name=Redis Local Repository
baseurl=file:///$(pwd)/repo
enabled=1
gpgcheck=0
EOF

    # 清理并更新缓存
    dnf clean all
    dnf makecache

    # 安装依赖包
    dnf install -y \
        gcc gcc-c++ make jemalloc-devel glibc-devel \
        openssl-devel libgcc libstdc++-devel glibc-headers

    # 恢复远程仓库
    if [[ -d /etc/yum.repos.d/backup ]]; then
        mv /etc/yum.repos.d/backup/*.repo /etc/yum.repos.d/ 2>/dev/null || true
        rmdir /etc/yum.repos.d/backup 2>/dev/null || true
        print_info "已恢复远程仓库"
    fi
}

# 创建Redis用户
create_user() {
    print_info "创建Redis用户..."

    if id "${REDIS_USER}" &>/dev/null; then
        print_warning "用户 ${REDIS_USER} 已存在"
    else
        useradd -r -s /bin/false ${REDIS_USER}
        print_success "创建用户 ${REDIS_USER} 成功"
    fi
}

# 创建目录结构
create_directories() {
    print_info "创建目录结构..."

    mkdir -p /data/redis/{data,log,conf}

    chown -R ${REDIS_USER}:${REDIS_USER} /data/redis

    print_success "目录结构创建完成"
}

# 解压并编译Redis
compile_redis() {
    print_info "解压Redis源码..."

    tar -xzf ${REDIS_PACKAGE_NAME}
    cd redis-${REDIS_VERSION}

    print_info "编译Redis..."
    make distclean 2>/dev/null || true
    make -j4
    make install PREFIX=${REDIS_INSTALL_DIR}

    print_success "Redis编译安装完成"
}

# 配置Redis
configure_redis() {
    print_info "配置Redis..."

    # 直接写入完整配置文件
    cat > ${REDIS_CONFIG_DIR}/redis.conf << EOF
# Redis ${REDIS_VERSION} 配置文件

# 网络配置
bind 0.0.0.0
port ${REDIS_PORT}
protected-mode no
tcp-backlog 511
timeout 0
tcp-keepalive 300

# 通用配置
daemonize no
pidfile /data/redis/redis.pid
loglevel notice
logfile ${REDIS_LOG_DIR}/redis.log
databases 16

# 安全配置
requirepass ${REDIS_PASSWORD}

# RDB 持久化
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir ${REDIS_DATA_DIR}

# AOF 持久化
appendonly yes
appendfilename "appendonly.aof"
appenddirname "appendonlydir"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
aof-load-truncated yes
aof-use-rdb-preamble yes

# 内存策略
maxmemory-policy allkeys-lru

# Lazyfree 异步删除
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
replica-lazy-flush yes
lazyfree-lazy-user-del yes
lazyfree-lazy-user-flush yes

# 慢日志
slowlog-log-slower-than 10000
slowlog-max-len 128

# 客户端
maxclients 10000
EOF

    # 设置权限
    chown -R ${REDIS_USER}:${REDIS_USER} /data/redis
    chown -R ${REDIS_USER}:${REDIS_USER} ${REDIS_INSTALL_DIR}

    print_success "Redis配置完成"
}

# 设置 PATH 环境变量
setup_path() {
    print_info "设置 PATH 环境变量..."

    if ! grep -q '/usr/local/redis/bin' /etc/profile; then
        echo 'export PATH=/usr/local/redis/bin:$PATH' >> /etc/profile
        print_success "PATH 已添加到 /etc/profile"
    else
        print_warning "PATH 已存在，跳过"
    fi

    export PATH=/usr/local/redis/bin:$PATH
}

# 创建systemd服务文件
create_service() {
    print_info "创建systemd服务文件..."

    cat > ${REDIS_SERVICE_FILE} << EOF
[Unit]
Description=Redis In-Memory Data Store
After=network.target

[Service]
User=${REDIS_USER}
Group=${REDIS_USER}
ExecStart=${REDIS_INSTALL_DIR}/bin/redis-server ${REDIS_CONFIG_DIR}/redis.conf
ExecStop=${REDIS_INSTALL_DIR}/bin/redis-cli -p ${REDIS_PORT} -a "${REDIS_PASSWORD}" shutdown
Restart=always
RestartSec=10
LimitNOFILE=100000
LimitNPROC=100000

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable redis

    print_success "systemd服务文件创建完成"
}

# 优化内核参数
optimize_kernel_params() {
    print_info "优化Redis内核参数..."

    # 创建Redis内核参数配置文件
    cat > /etc/sysctl.d/99-redis.conf << EOF
# Redis内核参数优化
# 内存相关
vm.overcommit_memory = 1
vm.swappiness = 1

# 网络相关
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 3
net.core.netdev_max_backlog = 5000

# 文件描述符相关
fs.file-max = 1000000
fs.nr_open = 1000000

# 共享内存相关
kernel.shmmax = 68719476736
kernel.shmall = 4294967296
EOF

    # 应用内核参数
    sysctl -p /etc/sysctl.d/99-redis.conf

    # 禁用透明大页
    cat > /etc/rc.d/rc.local << 'EOF'
#!/bin/bash
# 禁用透明大页(Transparent Huge Pages)
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag
EOF

    chmod +x /etc/rc.d/rc.local

    # 立即禁用透明大页
    echo never > /sys/kernel/mm/transparent_hugepage/enabled
    echo never > /sys/kernel/mm/transparent_hugepage/defrag

    # 设置文件描述符限制
    cat > /etc/security/limits.d/redis.conf << EOF
${REDIS_USER} soft nofile 100000
${REDIS_USER} hard nofile 100000
${REDIS_USER} soft nproc 100000
${REDIS_USER} hard nproc 100000
EOF

    print_success "内核参数优化完成"
}

# 关闭防火墙
disable_firewall() {
    print_info "关闭防火墙..."

    if systemctl is-active --quiet firewalld; then
        systemctl stop firewalld
        systemctl disable firewalld
        print_success "防火墙已永久关闭"
    else
        print_warning "firewalld未运行"
    fi
}

# 关闭SELinux
disable_selinux() {
    print_info "关闭SELinux..."

    # 检查SELinux状态
    if [[ $(getenforce) == "Enforcing" ]]; then
        setenforce 0
        print_success "SELinux已临时关闭"
    else
        print_warning "SELinux已处于非强制模式"
    fi

    # 永久关闭
    if [[ -f /etc/selinux/config ]]; then
        sed -i 's/SELINUX=enforcing/SELINUX=disabled/g' /etc/selinux/config
        sed -i 's/SELINUX=permissive/SELINUX=disabled/g' /etc/selinux/config
        print_success "SELinux已永久关闭（重启后生效）"
    else
        print_error "无法找到SELinux配置文件"
    fi
}

# 启动Redis
start_redis() {
    print_info "启动Redis服务..."

    systemctl daemon-reload
    systemctl start redis

    if systemctl is-active --quiet redis; then
        print_success "Redis服务启动成功"
    else
        print_error "Redis服务启动失败"
        systemctl status redis
        exit 1
    fi
}

# 测试Redis连接
test_redis() {
    print_info "测试Redis连接..."

    # 等待Redis完全启动
    sleep 3

    if ${REDIS_INSTALL_DIR}/bin/redis-cli -p ${REDIS_PORT} -a "${REDIS_PASSWORD}" ping | grep -q PONG; then
        print_success "Redis连接测试成功"
    else
        print_error "Redis连接测试失败"
        exit 1
    fi
}

# 集群模式部署
deploy_cluster_mode() {
    print_info "=== 集群模式部署 ==="

    IFS=',' read -ra PORTS_ARRAY <<< "${REDIS_PORTS}"

    for PORT in "${PORTS_ARRAY[@]}"; do
        PORT=$(echo "${PORT}" | tr -d ' ')
        print_info "配置集群节点 - 端口 ${PORT}..."

        # 创建目录结构
        mkdir -p "${REDIS_CLUSTER_BASE_DIR}/${PORT}"/{data,log,conf}

        # 写入 redis.conf
        cat > "${REDIS_CLUSTER_BASE_DIR}/${PORT}/conf/redis.conf" << EOF
# Redis ${REDIS_VERSION} 集群节点配置 - 端口 ${PORT}

# 网络配置
bind 0.0.0.0
port ${PORT}
protected-mode no
tcp-backlog 511
timeout 0
tcp-keepalive 300

# 通用配置
daemonize no
pidfile ${REDIS_CLUSTER_BASE_DIR}/${PORT}/redis.pid
loglevel notice
logfile ${REDIS_CLUSTER_BASE_DIR}/${PORT}/log/redis.log
databases 16

# 安全配置
requirepass ${REDIS_PASSWORD}
masterauth ${REDIS_PASSWORD}

# 集群配置
cluster-enabled yes
cluster-config-file ${REDIS_CLUSTER_BASE_DIR}/${PORT}/data/nodes.conf
cluster-node-timeout 5000

# RDB 持久化
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir ${REDIS_CLUSTER_BASE_DIR}/${PORT}/data

# AOF 持久化
appendonly yes
appendfilename "appendonly.aof"
appenddirname "appendonlydir"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
aof-load-truncated yes
aof-use-rdb-preamble yes

# 内存策略
maxmemory-policy allkeys-lru

# Lazyfree 异步删除
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
replica-lazy-flush yes
lazyfree-lazy-user-del yes
lazyfree-lazy-user-flush yes

# 慢日志
slowlog-log-slower-than 10000
slowlog-max-len 128

# 客户端
maxclients 10000
EOF

        chown -R ${REDIS_USER}:${REDIS_USER} "${REDIS_CLUSTER_BASE_DIR}/${PORT}"
        print_success "端口 ${PORT} 配置完成"
    done

    # 创建模板化 systemd 服务（redis@.service）
    print_info "创建 systemd 模板服务..."
    cat > /etc/systemd/system/redis@.service << EOF
[Unit]
Description=Redis Cluster Node - Port %i
After=network.target

[Service]
User=${REDIS_USER}
Group=${REDIS_USER}
ExecStart=${REDIS_INSTALL_DIR}/bin/redis-server ${REDIS_CLUSTER_BASE_DIR}/%i/conf/redis.conf
ExecStop=${REDIS_INSTALL_DIR}/bin/redis-cli -p %i -a "${REDIS_PASSWORD}" shutdown
Restart=always
RestartSec=10
LimitNOFILE=100000
LimitNPROC=100000

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload

    # 启动所有端口
    for PORT in "${PORTS_ARRAY[@]}"; do
        PORT=$(echo "${PORT}" | tr -d ' ')
        print_info "启动集群节点 redis@${PORT}..."
        systemctl enable --now "redis@${PORT}"

        if systemctl is-active --quiet "redis@${PORT}"; then
            print_success "redis@${PORT} 启动成功"
        else
            print_error "redis@${PORT} 启动失败"
            systemctl status "redis@${PORT}" || true
            exit 1
        fi
    done

    # 等待节点就绪
    sleep 3

    # 验证所有端口 PING/PONG
    for PORT in "${PORTS_ARRAY[@]}"; do
        PORT=$(echo "${PORT}" | tr -d ' ')
        if ${REDIS_INSTALL_DIR}/bin/redis-cli -p "${PORT}" -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep -q PONG; then
            print_success "端口 ${PORT} PING 测试通过"
        else
            print_error "端口 ${PORT} PING 测试失败"
            exit 1
        fi
    done

    print_success "集群模式所有节点部署完成"
    echo "========================================"
    echo "集群节点端口: ${REDIS_PORTS}"
    echo "集群数据目录: ${REDIS_CLUSTER_BASE_DIR}"
    echo "管理命令: systemctl {start|stop|status} redis@{PORT}"
    echo "========================================"
    print_info "Redis密码: ${REDIS_PASSWORD}"
    print_warning "请妥善保管此密码！"
}

# 单机模式部署（原有逻辑封装）
deploy_standalone_mode() {
    print_info "=== 单机模式部署 ==="
    create_directories
    configure_redis
    create_service
    optimize_kernel_params
    start_redis
    test_redis
    show_install_info
}

# 显示安装信息
show_install_info() {
    print_success "Redis安装完成！"
    echo "========================================"
    echo "Redis 版本: ${REDIS_VERSION}"
    echo "安装路径: ${REDIS_INSTALL_DIR}"
    echo "配置文件: ${REDIS_CONFIG_DIR}/redis.conf"
    echo "数据目录: ${REDIS_DATA_DIR}"
    echo "日志文件: ${REDIS_LOG_DIR}/redis.log"
    echo "监听端口: ${REDIS_PORT}"
    echo "启动命令: systemctl start redis"
    echo "停止命令: systemctl stop redis"
    echo "重启命令: systemctl restart redis"
    echo "状态查看: systemctl status redis"
    echo "========================================"

    print_info "Redis密码: ${REDIS_PASSWORD}"
    print_warning "请妥善保管此密码！"
}

# 清理临时文件
cleanup() {
    print_info "清理临时文件..."
    cd /
    rm -rf /tmp/redis-${REDIS_VERSION} redis-${REDIS_VERSION}
    print_success "清理完成"
}

# 主函数
main() {
    print_info "开始安装Redis ${REDIS_VERSION}..."

    check_root
    check_os_version
    check_offline_package
    install_dependencies
    create_user
    compile_redis
    setup_path
    disable_firewall
    disable_selinux

    if [[ "${REDIS_CLUSTER_ENABLED}" == "true" ]]; then
        deploy_cluster_mode
    else
        deploy_standalone_mode
    fi

    cleanup

    print_success "Redis安装过程全部完成！"
}

# 错误处理
trap 'print_error "脚本执行过程中出现错误，请查看日志信息"' ERR

# 执行主函数
main "$@"
