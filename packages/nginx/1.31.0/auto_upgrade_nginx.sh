#!/bin/bash

set -euo pipefail

# 颜色输出定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 打印函数
print_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

# 常量与变量
NGINX_VERSION="1.31.0"
NGINX_TAR="nginx-${NGINX_VERSION}.tar.gz"
ASSUME_YES="${ASSUME_YES:-0}"

# 由 detect_install_dir 填充
NGINX_INSTALL_DIR="${NGINX_INSTALL_DIR:-}"
# 由 detect_configure_args 填充
NGINX_USER=""
OLD_CONFIGURE_ARGS=""
# 由 backup_binary 填充
BACKUP_PATH=""
# 编译临时目录
BUILD_DIR=""

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 清理临时目录
cleanup() {
    if [[ -n "$BUILD_DIR" && -d "$BUILD_DIR" ]]; then
        rm -rf "$BUILD_DIR"
    fi
}
trap cleanup EXIT

# 检查 root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "此脚本需要以 root 权限运行"
        exit 1
    fi
}

# 校验候选目录是否为合法 nginx 安装目录
is_valid_install_dir() {
    local dir="$1"
    [[ -n "$dir" && -x "$dir/sbin/nginx" ]]
}

# 自动探测 nginx 安装目录
detect_install_dir() {
    print_info "探测 Nginx 安装目录..."

    # 1. 环境变量
    if [[ -n "$NGINX_INSTALL_DIR" ]]; then
        if is_valid_install_dir "$NGINX_INSTALL_DIR"; then
            print_info "使用环境变量指定的安装目录: $NGINX_INSTALL_DIR"
            return 0
        else
            print_error "环境变量 NGINX_INSTALL_DIR=$NGINX_INSTALL_DIR 下未找到 sbin/nginx"
            exit 1
        fi
    fi

    # 2. 解析 systemd 单元
    if command -v systemctl &>/dev/null; then
        local exec_line
        exec_line=$(systemctl cat nginx 2>/dev/null | grep -E '^ExecStart=' | head -1 || true)
        if [[ -n "$exec_line" ]]; then
            # ExecStart=/usr/local/nginx/sbin/nginx [args...]
            local exec_bin
            exec_bin=$(echo "$exec_line" | sed -E 's/^ExecStart=([^ ]+).*/\1/')
            # 去掉可能的引号
            exec_bin="${exec_bin%\"}"
            exec_bin="${exec_bin#\"}"
            if [[ -n "$exec_bin" && "$exec_bin" == */sbin/nginx ]]; then
                local candidate
                candidate=$(dirname "$(dirname "$exec_bin")")
                if is_valid_install_dir "$candidate"; then
                    NGINX_INSTALL_DIR="$candidate"
                    print_info "通过 systemd 单元定位到安装目录: $NGINX_INSTALL_DIR"
                    return 0
                fi
            fi
        fi
    fi

    # 3. PATH 查找 + nginx -V --prefix=
    local path_bin
    path_bin=$(command -v nginx 2>/dev/null || true)
    if [[ -n "$path_bin" ]]; then
        path_bin=$(readlink -f "$path_bin" 2>/dev/null || echo "$path_bin")
        local prefix
        prefix=$("$path_bin" -V 2>&1 | grep -oE -- '--prefix=[^ ]+' | head -1 | sed 's/--prefix=//' || true)
        if [[ -n "$prefix" ]] && is_valid_install_dir "$prefix"; then
            NGINX_INSTALL_DIR="$prefix"
            print_info "通过 \$PATH + nginx -V 定位到安装目录: $NGINX_INSTALL_DIR"
            return 0
        fi
        # 若 prefix 解析失败但 path_bin 形如 .../sbin/nginx，则用其上两级
        if [[ "$path_bin" == */sbin/nginx ]]; then
            local candidate
            candidate=$(dirname "$(dirname "$path_bin")")
            if is_valid_install_dir "$candidate"; then
                NGINX_INSTALL_DIR="$candidate"
                print_info "通过 \$PATH 二进制路径定位到安装目录: $NGINX_INSTALL_DIR"
                return 0
            fi
        fi
    fi

    # 4. 常见路径兜底
    local candidates=(
        "/usr/local/nginx"
        "/usr/local/openresty/nginx"
        "/opt/nginx"
        "/usr/share/nginx"
    )
    for c in "${candidates[@]}"; do
        if is_valid_install_dir "$c"; then
            NGINX_INSTALL_DIR="$c"
            print_info "在常见路径中找到安装目录: $NGINX_INSTALL_DIR"
            return 0
        fi
    done

    print_error "未检测到 Nginx 安装。请通过环境变量 NGINX_INSTALL_DIR=/your/path 显式指定"
    exit 1
}

# 用户确认（防止误升级）
confirm_target() {
    print_info "即将升级该 Nginx 安装到 ${NGINX_VERSION}: $NGINX_INSTALL_DIR"
    if [[ "$ASSUME_YES" == "1" ]]; then
        print_info "ASSUME_YES=1，跳过交互确认"
        return 0
    fi
    read -r -p "确认继续升级？[y/N] " ans
    if [[ "$ans" != "y" && "$ans" != "Y" ]]; then
        print_warning "用户取消升级"
        exit 0
    fi
}

# 前置检查
pre_check() {
    if ! is_valid_install_dir "$NGINX_INSTALL_DIR"; then
        print_error "$NGINX_INSTALL_DIR/sbin/nginx 不存在或不可执行"
        exit 1
    fi

    # 读取当前版本
    local current_version
    current_version=$("$NGINX_INSTALL_DIR/sbin/nginx" -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)
    if [[ -z "$current_version" ]]; then
        print_error "无法解析当前 Nginx 版本"
        exit 1
    fi
    print_info "当前 Nginx 版本: $current_version"
    if [[ "$current_version" == "$NGINX_VERSION" ]]; then
        print_warning "当前已是目标版本 $NGINX_VERSION，无需升级"
        exit 0
    fi

    # 离线包（与脚本同级目录）
    local tar_path="$SCRIPT_DIR/$NGINX_TAR"
    if [[ ! -f "$tar_path" ]]; then
        print_error "离线源码包不存在: $tar_path"
        print_error "请将 $NGINX_TAR 放到与本脚本同级目录后重试"
        exit 1
    fi
    print_info "离线源码包: $tar_path"

    # 编译依赖（仅检查，不安装）
    local missing=()
    local pkgs=(gcc make pcre-devel zlib-devel openssl-devel)
    if command -v rpm &>/dev/null; then
        for p in "${pkgs[@]}"; do
            rpm -q "$p" &>/dev/null || missing+=("$p")
        done
    else
        # 非 rpm 系统兜底用命令存在性判断
        command -v gcc  &>/dev/null || missing+=("gcc")
        command -v make &>/dev/null || missing+=("make")
    fi
    if (( ${#missing[@]} > 0 )); then
        print_error "缺少编译依赖: ${missing[*]}"
        print_error "请先使用 1.28.0 安装脚本完成依赖准备，或手动安装上述包后重试"
        exit 1
    fi
    print_info "编译依赖检查通过"
}

# 解析旧 configure 参数
detect_configure_args() {
    local v_output
    v_output=$("$NGINX_INSTALL_DIR/sbin/nginx" -V 2>&1 || true)

    # 提取 configure arguments: 之后的内容
    OLD_CONFIGURE_ARGS=$(echo "$v_output" | grep -oE 'configure arguments:.*' | sed -E 's/^configure arguments:[[:space:]]*//' || true)

    # 解析 user
    NGINX_USER=$(echo "$OLD_CONFIGURE_ARGS" | grep -oE -- '--user=[^ ]+' | head -1 | sed 's/--user=//' || true)
    NGINX_USER="${NGINX_USER:-nginx}"

    if [[ -z "$OLD_CONFIGURE_ARGS" ]]; then
        print_warning "未能从 nginx -V 解析 configure 参数，回退到最小参数集"
        OLD_CONFIGURE_ARGS="--prefix=$NGINX_INSTALL_DIR --user=$NGINX_USER --group=$NGINX_USER --with-http_ssl_module"
    fi
    print_info "将使用的 configure 参数:"
    print_info "  $OLD_CONFIGURE_ARGS"
}

# 备份旧二进制和 nginx.conf
backup_binary() {
    local backup_root="${BACKUP_DIR:-$NGINX_INSTALL_DIR/backup}"
    local ts
    ts=$(date +%Y%m%d-%H%M%S)
    BACKUP_PATH="$backup_root/$ts"
    mkdir -p "$BACKUP_PATH"
    cp -a "$NGINX_INSTALL_DIR/sbin/nginx" "$BACKUP_PATH/nginx"
    if [[ -f "$NGINX_INSTALL_DIR/conf/nginx.conf" ]]; then
        cp -a "$NGINX_INSTALL_DIR/conf/nginx.conf" "$BACKUP_PATH/nginx.conf"
    fi
    print_success "已备份旧二进制到: $BACKUP_PATH/nginx"
}

# 编译新 nginx（不执行 make install）
compile_new_nginx() {
    BUILD_DIR=$(mktemp -d -t nginx-upgrade-XXXXXX)
    print_info "编译目录: $BUILD_DIR"

    tar -zxf "$SCRIPT_DIR/$NGINX_TAR" -C "$BUILD_DIR"
    local src_dir="$BUILD_DIR/nginx-${NGINX_VERSION}"
    if [[ ! -d "$src_dir" ]]; then
        # 兼容包内顶层目录命名不一致的情况
        src_dir=$(find "$BUILD_DIR" -maxdepth 1 -mindepth 1 -type d | head -1)
    fi
    if [[ ! -d "$src_dir" ]]; then
        print_error "解压后未找到源码目录"
        exit 1
    fi

    (
        cd "$src_dir"
        # shellcheck disable=SC2086
        eval ./configure $OLD_CONFIGURE_ARGS
        make -j"$(nproc)"
    )

    if [[ ! -x "$src_dir/objs/nginx" ]]; then
        print_error "编译失败: objs/nginx 不存在"
        exit 1
    fi
    NEW_BINARY="$src_dir/objs/nginx"
    print_success "新二进制编译完成: $NEW_BINARY"
}

# 用新二进制校验现有配置
validate_new_binary() {
    print_info "用新二进制校验现有 nginx.conf..."
    if ! "$NEW_BINARY" -t -c "$NGINX_INSTALL_DIR/conf/nginx.conf" -p "$NGINX_INSTALL_DIR/"; then
        print_error "新二进制无法解析现有配置，升级中止（尚未替换任何文件）"
        exit 1
    fi
    print_success "新二进制配置校验通过"
}

# 回滚
rollback() {
    print_warning "触发回滚..."
    systemctl stop nginx 2>/dev/null || true
    install -m 755 -o root -g root "$BACKUP_PATH/nginx" "$NGINX_INSTALL_DIR/sbin/nginx"
    if systemctl start nginx; then
        print_success "回滚完成，已恢复到旧版本"
    else
        print_error "回滚后启动失败，请人工介入: systemctl status nginx"
    fi
    exit 1
}

# 停-换-启
stop_swap_start() {
    print_info "停止 Nginx..."
    systemctl stop nginx

    print_info "替换 sbin/nginx..."
    if ! install -m 755 -o root -g root "$NEW_BINARY" "$NGINX_INSTALL_DIR/sbin/nginx"; then
        print_error "二进制替换失败"
        rollback
    fi

    print_info "启动 Nginx..."
    if ! systemctl start nginx; then
        print_error "Nginx 启动失败"
        rollback
    fi

    if ! systemctl is-active --quiet nginx; then
        print_error "Nginx 启动后未处于 active 状态"
        rollback
    fi

    local new_version
    new_version=$("$NGINX_INSTALL_DIR/sbin/nginx" -v 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)
    if [[ "$new_version" != "$NGINX_VERSION" ]]; then
        print_error "升级后版本号不符: 期望 $NGINX_VERSION，实际 $new_version"
        rollback
    fi

    print_success "Nginx 已升级并启动: $new_version"
}

show_result() {
    echo "========================================"
    print_success "Nginx 升级完成"
    echo "  安装目录:   $NGINX_INSTALL_DIR"
    echo "  新版本:     $NGINX_VERSION"
    echo "  备份位置:   $BACKUP_PATH/nginx"
    echo ""
    echo "回滚命令（如需）:"
    echo "  sudo install -m 755 $BACKUP_PATH/nginx $NGINX_INSTALL_DIR/sbin/nginx && sudo systemctl restart nginx"
    echo "========================================"
}

main() {
    print_info "开始 Nginx 升级流程，目标版本: $NGINX_VERSION"
    check_root
    detect_install_dir
    confirm_target
    pre_check
    detect_configure_args
    backup_binary
    compile_new_nginx
    validate_new_binary
    stop_swap_start
    show_result
}

trap 'print_error "脚本执行过程中出现错误，请查看上方提示"' ERR

main "$@"
