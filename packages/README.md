# Nginx 离线包仓库

本目录存放 Nginx 的离线安装包、安装脚本和元数据。

## 📂 目录结构

```text
packages/
└── nginx/
    ├── 1.28.0/
    │   ├── metadata.json
    │   ├── auto_install_nginx.sh
    │   ├── package/
    │   └── libs/
    └── README.md
```

## 🎯 设计理念

### 参数化脚本 + 平台注入

Nginx 安装脚本遵循统一规范：
- ✅ 支持环境变量配置
- ✅ 提供合理默认值
- ✅ 包含 `metadata.json` 元数据描述
- ✅ 支持平台动态表单生成
- ✅ 支持离线环境部署

### 元数据驱动部署

`metadata.json` 用于描述：
- Nginx 名称与版本
- 支持的操作系统与版本
- 安装脚本入口
- 可配置参数与默认值
- 功能特性与资源要求

## 🚀 使用方式

1. 在 `packages/nginx/<version>/` 目录准备安装脚本和依赖
2. 打包目录内容为 ZIP 文件
3. 在平台的 `Nginx 管理 > 离线包` 页面上传 ZIP
4. 在 `部署管理` 页面选择离线包并填写参数后执行部署

## 📦 打包示例

```bash
cd packages/nginx/1.28.0
zip -r nginx-1.28.0-offline.zip ./*
```

## 📚 相关文档

- 平台概览: `README.md`
- Nginx 离线包说明: `packages/nginx/README.md`
- 部署测试指南: `tasks/testing-guide.md`
