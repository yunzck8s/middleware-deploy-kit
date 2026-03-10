# 生产部署文档

## 系统要求

- **操作系统**: Linux (推荐 CentOS 7+, Ubuntu 18.04+)
- **架构**: x86_64 (amd64)
- **权限**: root 或 sudo
- **端口**: 80 (Nginx), 8080 (后端服务)
- **磁盘空间**: 至少 1GB 可用空间
- **内存**: 至少 512MB

## 快速安装

### 1. 下载部署包

```bash
# 下载部署包
wget https://example.com/middleware-deploy-kit-v1.0.0-linux-amd64.tar.gz

# 或使用 scp 从本地上传
scp middleware-deploy-kit-v1.0.0-linux-amd64.tar.gz root@server:/tmp/
```

### 2. 解压并安装

```bash
tar -xzf middleware-deploy-kit-v1.0.0-linux-amd64.tar.gz
cd middleware-deploy-kit-v1.0.0
sudo ./scripts/install.sh
```

### 3. 访问系统

安装完成后，访问 `http://<服务器IP>/`

**默认账号**:
- 用户名: `admin`
- 密码: `admin123`

## 详细说明

### 安装目录结构

```
/data/middleware-deploy-kit/
├── bin/
│   └── server              # 后端二进制文件
├── web/                    # 前端静态文件
├── packages/               # 离线安装包
│   └── nginx/
├── data/                   # 数据目录
│   ├── deploy.db          # SQLite 数据库
│   ├── certificates/      # SSL 证书
│   ├── logs/              # 日志文件
│   └── uploads/           # 上传文件
├── scripts/               # 管理脚本
└── VERSION                # 版本信息
```

### 服务管理

```bash
# 启动服务
systemctl start middleware-deploy

# 停止服务
systemctl stop middleware-deploy

# 重启服务
systemctl restart middleware-deploy

# 查看状态
systemctl status middleware-deploy

# 查看日志
journalctl -u middleware-deploy -f
```

### Nginx 配置

安装脚本会自动配置 Nginx 反向代理（如果已安装）。

手动配置位置: `/etc/nginx/conf.d/middleware-deploy.conf`

配置模板: `/data/middleware-deploy-kit/config/nginx.conf.template`

```bash
# 测试配置
nginx -t

# 重载配置
systemctl reload nginx
```

## 环境变量配置

可通过环境变量覆盖默认配置，编辑 systemd 服务文件:

```bash
vi /etc/systemd/system/middleware-deploy.service
```

添加环境变量:

```ini
[Service]
Environment="SERVER_PORT=8080"
Environment="JWT_SECRET=your-random-secret-here"
Environment="DATA_DIR=/opt/middleware-deploy-kit/data"
```

重载并重启:

```bash
systemctl daemon-reload
systemctl restart middleware-deploy
```

## 升级

### 1. 备份数据

```bash
cp -r /data/middleware-deploy-kit/data /backup/data-$(date +%Y%m%d)
```

### 2. 执行升级

```bash
tar -xzf middleware-deploy-kit-v1.1.0-linux-amd64.tar.gz
cd middleware-deploy-kit-v1.1.0
sudo ./scripts/upgrade.sh
```

升级脚本会自动备份旧版本并回滚失败的升级。

## 卸载

```bash
sudo /data/middleware-deploy-kit/scripts/uninstall.sh
```

卸载脚本会提示是否保留数据目录。

## 常见问题

### 1. 端口被占用

检查端口占用:

```bash
netstat -tlnp | grep :80
netstat -tlnp | grep :8080
```

修改后端端口:

```bash
vi /etc/systemd/system/middleware-deploy.service
# 添加: Environment="SERVER_PORT=9090"
systemctl daemon-reload
systemctl restart middleware-deploy
```

### 2. 服务启动失败

查看详细日志:

```bash
journalctl -u middleware-deploy -n 50 --no-pager
```

常见原因:
- 端口被占用
- 数据目录权限不足
- 磁盘空间不足

### 3. 无法访问前端页面

检查 Nginx 状态:

```bash
systemctl status nginx
nginx -t
```

检查配置文件:

```bash
cat /etc/nginx/conf.d/middleware-deploy.conf
```

### 4. JWT 认证失败

确保 JWT_SECRET 在升级后保持一致，或清除浏览器缓存重新登录。

## 安全建议

1. **修改默认密码**: 首次登录后立即修改 admin 密码
2. **配置防火墙**: 仅开放必要端口
3. **使用 HTTPS**: 配置 SSL 证书（可使用 Let's Encrypt）
4. **定期备份**: 备份 `/data/middleware-deploy-kit/data/` 目录
5. **更新系统**: 保持操作系统和依赖包最新

## 监控和日志

### 应用日志

```bash
# 实时查看日志
journalctl -u middleware-deploy -f

# 查看最近 100 行
journalctl -u middleware-deploy -n 100
```

### 数据库备份

```bash
# 备份数据库
cp /data/middleware-deploy-kit/data/deploy.db /backup/deploy-$(date +%Y%m%d).db
```

## 技术支持

如遇问题，请提供以下信息:

1. 系统版本: `cat /etc/os-release`
2. 服务状态: `systemctl status middleware-deploy`
3. 错误日志: `journalctl -u middleware-deploy -n 50`
4. 版本信息: `cat /data/middleware-deploy-kit/VERSION`
