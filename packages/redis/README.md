# Redis 离线包

## 📦 版本列表

### 6.2.20

- **支持系统**: Rocky Linux 9.4, CentOS 7.9, openEuler 22.03
- **安装脚本**: `install_redis_offline.sh`
- **特性**:
  - Redis 6.2.20 稳定版本
  - 完整的离线依赖包
  - 自动创建 systemd 服务
  - 支持 AOF 和 RDB 持久化
  - 自动创建 redis 用户

## 🔧 可配置参数

所有参数通过环境变量配置，详见 `6.2.20/metadata.json`：

- `REDIS_INSTALL_DIR`: 安装目录（默认：/usr/local/redis）
- `REDIS_PORT`: 监听端口（默认：6379）
- `REDIS_BIND`: 绑定地址（默认：127.0.0.1）
- `REDIS_PASSWORD`: 认证密码（默认：空，不设密码）
- `REDIS_MAXMEMORY`: 最大内存（默认：2gb）
- `REDIS_DATA_DIR`: 数据目录（默认：/var/lib/redis）
- `REDIS_LOG_DIR`: 日志目录（默认：/var/log/redis）
- `ENABLE_AOF`: 启用 AOF 持久化（默认：true）

## 📋 使用方法

### 打包

```bash
cd packages/redis/6.2.20
zip -r redis-6.2.20-offline.zip ./*
```

### 部署

在平台界面上传 ZIP 包，选择参数后部署到目标服务器。

## ⚠️ 注意事项

- 安装过程需要 root 权限
- 建议设置强密码（REDIS_PASSWORD）
- 如果对外开放，建议修改 REDIS_BIND 为 0.0.0.0 并设置防火墙规则
- 根据实际内存大小调整 REDIS_MAXMEMORY
