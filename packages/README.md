# 中间件离线包仓库

本目录存放所有中间件的离线安装包、安装脚本和元数据。

## 📂 目录结构

```
packages/
├── nginx/              # Nginx 离线包
│   ├── 1.28.0/        # 版本目录
│   │   ├── metadata.json
│   │   ├── auto_install_nginx.sh
│   │   ├── package/
│   │   └── libs/
│   └── README.md
├── redis/              # Redis 离线包（待添加）
│   └── README.md
└── openssh/            # OpenSSH 离线包（待添加）
    └── README.md
```

## 🎯 设计理念

### 参数化脚本 + 平台注入

所有安装脚本遵循**统一规范**：
- ✅ 支持环境变量配置
- ✅ 提供合理默认值
- ✅ 包含元数据描述（metadata.json）
- ✅ 完全离线可执行

### 工作流程

```
┌─────────────┐
│ 平台 UI     │
│ 配置参数    │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ 生成环境变量         │
│ NGINX_PORT=8080     │
│ NGINX_INSTALL_DIR=  │
└──────┬──────────────┘
       │
       ▼
┌───────────────────────┐
│ SSH 连接目标服务器     │
│ 1. 上传离线包          │
│ 2. 解压                │
│ 3. 注入环境变量        │
│ 4. 执行安装脚本        │
└───────────────────────┘
```

## 📋 元数据格式（metadata.json）

每个版本必须包含 `metadata.json`，定义：
- 包信息（名称、版本、描述）
- 支持的操作系统
- 安装脚本名称
- **可配置参数**（关键！）
- 功能特性
- 系统要求

**示例**：见 `nginx/1.28.0/metadata.json`

## 🔧 脚本开发规范

### 必需支持

1. **环境变量读取**
```bash
INSTALL_DIR="${INSTALL_DIR:-/usr/local/app}"
HTTP_PORT="${HTTP_PORT:-80}"
```

2. **错误处理**
```bash
set -euo pipefail
```

3. **日志输出**
```bash
echo "=== 正在安装 Nginx ==="
echo "安装目录: $INSTALL_DIR"
```

4. **退出码**
- 成功: 0
- 失败: 非0

### 推荐实践

- 幂等性：可重复执行
- 详细日志：方便排查问题
- 参数验证：检查必需参数
- 清理机制：失败后清理临时文件

## 📦 打包流程

### 1. 准备文件

```bash
cd packages/nginx/1.28.0
# 确保包含：
# - metadata.json
# - auto_install_nginx.sh
# - package/
# - libs/
```

### 2. 打包

```bash
zip -r nginx-1.28.0-offline.zip ./*
```

### 3. 上传到平台

在平台界面：
- 中间件管理 > Nginx > 离线包
- 点击"上传离线包"
- 选择生成的 ZIP 文件
- 填写信息（会从 metadata.json 自动读取）

## 🚀 添加新中间件

### 1. 创建目录结构

```bash
mkdir -p packages/新中间件/版本号
```

### 2. 准备文件

- `metadata.json` - 参考 nginx 示例
- `auto_install_xxx.sh` - 安装脚本
- `package/` - 源码包
- `libs/` - 依赖库（按系统分类）

### 3. 编写 metadata.json

定义所有可配置参数和支持的系统。

### 4. 测试安装脚本

```bash
# 测试默认参数
./auto_install_xxx.sh

# 测试自定义参数
INSTALL_DIR=/opt/xxx ./auto_install_xxx.sh
```

### 5. 打包并上传

按照上述打包流程操作。

## 📚 相关文档

- 平台使用文档: `/claude.md`
- Nginx 安装说明: `nginx/README.md`
- 部署 API 文档: `/backend/internal/api/deployment.go`

---

**维护者**: 通过 Git 管理本目录，所有离线包脚本纳入版本控制
