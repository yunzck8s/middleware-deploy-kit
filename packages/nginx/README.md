# Nginx 离线包

## 📦 版本列表

### 1.28.0
- **状态**: ✅ 可用
- **支持系统**: Rocky Linux 9.4, CentOS 7.9, OpenEuler 22.03, Kylin V10-SP3
- **特性**: SSL、Gzip、反向代理、负载均衡
- **元数据**: [metadata.json](./1.28.0/metadata.json)

## 📋 目录结构

```
nginx/
└── 1.28.0/
    ├── metadata.json          # 包元数据（参数定义、支持的OS等）
    ├── auto_install_nginx.sh  # 安装脚本（从 ../../nginx/ 复制）
    ├── package/
    │   └── nginx-1.28.0.tar.gz
    └── libs/
        ├── rocky/
        ├── centos/
        ├── openEuler/
        └── kylin/
```

## 🔧 安装脚本规范

所有安装脚本必须支持以下环境变量：

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `NGINX_INSTALL_DIR` | 安装目录 | `/usr/local/nginx` |
| `NGINX_HTTP_PORT` | HTTP 端口 | `80` |
| `NGINX_HTTPS_PORT` | HTTPS 端口 | `443` |
| `NGINX_USER` | 运行用户 | `nginx` |
| `NGINX_WORKER_PROCESSES` | Worker 进程数 | `4` |
| `NGINX_WORKER_CONNECTIONS` | Worker 连接数 | `1024` |
| `ENABLE_SSL` | 启用 SSL | `yes` |

## 📝 打包说明

打包时需要包含以下文件：

```bash
cd /home/rocket/projects/middleware-deploy-kit/packages/nginx/1.28.0
zip -r nginx-1.28.0-offline.zip ./*
```

生成的 ZIP 包可直接上传到平台使用。

## 🚀 使用方式

1. 在平台上传离线包
2. 创建部署任务时选择该离线包
3. 配置安装参数（可选）
4. 执行部署

平台会自动：
- 将 ZIP 包上传到目标服务器
- 解压到临时目录
- 根据配置注入环境变量
- 执行 `auto_install_nginx.sh`
