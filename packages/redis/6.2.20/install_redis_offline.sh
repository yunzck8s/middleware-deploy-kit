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
            print_warning "此脚本专为 Rocky Linux 9.4 设计，继续执行可能存在问题"
            read -p "是否继续执行？(y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        fi
    else
        print_error "无法检测到系统版本"
        exit 1
    fi
}

# 设置变量
# 配置变量（优先从环境变量读取，否则使用默认值）
REDIS_VERSION="6.2.20"
REDIS_PACKAGE_NAME="redis-${REDIS_VERSION}.tar.gz"
REDIS_INSTALL_DIR="${REDIS_INSTALL_DIR:-/usr/local/redis}"
REDIS_CONFIG_DIR="/etc/redis"
REDIS_DATA_DIR="${REDIS_DATA_DIR:-/var/lib/redis}"
REDIS_LOG_DIR="${REDIS_LOG_DIR:-/var/log/redis}"
REDIS_USER="redis"
REDIS_SERVICE_FILE="/etc/systemd/system/redis.service"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_BIND="${REDIS_BIND:-127.0.0.1}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
REDIS_MAXMEMORY="${REDIS_MAXMEMORY:-2gb}"
ENABLE_AOF="${ENABLE_AOF:-yes}"

# 打印配置信息
print_info "Redis 部署配置:"
print_info "  安装目录: $REDIS_INSTALL_DIR"
print_info "  监听端口: $REDIS_PORT"
print_info "  绑定地址: $REDIS_BIND"
print_info "  数据目录: $REDIS_DATA_DIR"
print_info "  日志目录: $REDIS_LOG_DIR"
print_info "  最大内存: $REDIS_MAXMEMORY"
print_info "  AOF 持久化: $ENABLE_AOF"
if [ -n "$REDIS_PASSWORD" ]; then
    print_info "  认证密码: ******"
else
    print_warning "  认证密码: 未设置（生产环境建议设置密码）"
fi

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
    dnf install -y --disablerepo=* --enablerepo=redis-local \
        gcc gcc-c++ make jemalloc-devel glibc-devel \
        openssl-devel libgcc libstdc++-devel glibc-headers
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
    
    mkdir -p ${REDIS_CONFIG_DIR}
    mkdir -p ${REDIS_DATA_DIR}
    mkdir -p ${REDIS_LOG_DIR}
    
    chown -R ${REDIS_USER}:${REDIS_USER} ${REDIS_DATA_DIR}
    chown -R ${REDIS_USER}:${REDIS_USER} ${REDIS_LOG_DIR}
    
    print_success "目录结构创建完成"
}

# 解压并编译Redis
compile_redis() {
    print_info "解压Redis源码..."
    
    tar -xzf ${REDIS_PACKAGE_NAME}
    cd redis-${REDIS_VERSION}
    
    print_info "编译Redis..."
    make distclean 2>/dev/null || true
    make PREFIX=${REDIS_INSTALL_DIR} install
    
    print_success "Redis编译安装完成"
}

# 配置Redis
configure_redis() {
    print_info "配置Redis..."
    
    # 复制配置文件
    cp redis.conf ${REDIS_CONFIG_DIR}/redis.conf
    
    # 修改配置文件
#    sed -i "s|^daemonize no|daemonize yes|g" ${REDIS_CONFIG_DIR}/redis.conf
    sed -i "s|^pidfile /var/run/redis_6379.pid|pidfile ${REDIS_DATA_DIR}/redis.pid|g" ${REDIS_CONFIG_DIR}/redis.conf
    sed -i "s|^logfile ""|logfile ${REDIS_LOG_DIR}/redis.log|g" ${REDIS_CONFIG_DIR}/redis.conf
    sed -i "s|^dir ./|dir ${REDIS_DATA_DIR}|g" ${REDIS_CONFIG_DIR}/redis.conf
    sed -i "s|^bind 127.0.0.1|bind 0.0.0.0|g" ${REDIS_CONFIG_DIR}/redis.conf
    sed -i "s|^# requirepass foobared|requirepass $(openssl rand -base64 32)|g" ${REDIS_CONFIG_DIR}/redis.conf
    
    # 设置权限
    chown -R ${REDIS_USER}:${REDIS_USER} ${REDIS_CONFIG_DIR}
    chown -R ${REDIS_USER}:${REDIS_USER} ${REDIS_INSTALL_DIR}
    
    print_success "Redis配置完成"
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
ExecStop=${REDIS_INSTALL_DIR}/bin/redis-cli shutdown
Restart=always
RestartSec=10

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

# 透明大页禁用
# 通过/etc/rc.local实现
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
    
    # 修改systemd服务文件以支持文件描述符限制
    sed -i '/\[Service\]/a LimitNOFILE=100000\nLimitNPROC=100000' ${REDIS_SERVICE_FILE}
    
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
        # 临时关闭
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

    redis_password=$(grep "^requirepass" ${REDIS_CONFIG_DIR}/redis.conf | awk '{print $2}')
    if ${REDIS_INSTALL_DIR}/bin/redis-cli -a "$redis_password" ping | grep -q PONG; then
        print_success "Redis连接测试成功"
    else
        print_error "Redis连接测试失败"
        exit 1
    fi
}

# 显示安装信息
show_install_info() {
    print_success "Redis安装完成！"
    echo "========================================"
    echo "安装路径: ${REDIS_INSTALL_DIR}"
    echo "配置文件: ${REDIS_CONFIG_DIR}/redis.conf"
    echo "数据目录: ${REDIS_DATA_DIR}"
    echo "日志文件: ${REDIS_LOG_DIR}/redis.log"
    echo "启动命令: systemctl start redis"
    echo "停止命令: systemctl stop redis"
    echo "重启命令: systemctl restart redis"
    echo "状态查看: systemctl status redis"
    echo "========================================"
    
    # 显示Redis密码
    redis_password=$(grep "^requirepass" ${REDIS_CONFIG_DIR}/redis.conf | awk '{print $2}')
    if [[ -n $redis_password ]]; then
        print_info "Redis密码: $redis_password"
        print_warning "请妥善保管此密码！"
    fi
}

# 清理临时文件
cleanup() {
    print_info "清理临时文件..."
    cd /
    rm -rf redis-${REDIS_VERSION}
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
    create_directories
    compile_redis
    configure_redis
    create_service
    disable_firewall
    disable_selinux
    optimize_kernel_params
    start_redis
    test_redis
    show_install_info
    cleanup
    
    print_success "Redis安装过程全部完成！"
}

# 错误处理
trap 'print_error "脚本执行过程中出现错误，请查看日志信息"' ERR

# 执行主函数
main "$@"
