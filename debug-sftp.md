# SFTP 上传失败问题排查指南

## 错误信息
```
sftp: "Failure" (SSH_FX_FAILURE)
```

## 已实施的修复

### 1. 增强目录权限检查
在上传 Nginx 配置前，现在会自动：
- 使用 SSH 创建目标目录（`mkdir -p`）
- 设置目录权限为 755（`chmod 755`）
- 提供更详细的错误信息

### 2. 改进的错误处理
- SFTP 失败时会显示具体的失败原因
- 区分权限问题和磁盘空间问题

## 常见原因和解决方案

### 原因 1: 目标目录权限不足

**问题**: SSH 用户对目标目录没有写权限

**解决方案**:
```bash
# 在目标服务器上执行（以 /etc/nginx 为例）
sudo chmod 755 /etc/nginx
sudo chown $(whoami):$(whoami) /etc/nginx

# 或者给予完整权限
sudo chmod 777 /etc/nginx
```

### 原因 2: SELinux 阻止写入

**检查 SELinux 状态**:
```bash
getenforce
# 如果返回 Enforcing，表示 SELinux 启用
```

**临时解决（测试用）**:
```bash
sudo setenforce 0
```

**永久解决（推荐）**:
```bash
# 修改 SELinux 配置
sudo vi /etc/selinux/config
# 设置 SELINUX=permissive 或 SELINUX=disabled

# 或者为特定目录设置正确的 SELinux 上下文
sudo chcon -R -t httpd_config_t /etc/nginx
sudo semanage fcontext -a -t httpd_config_t "/etc/nginx(/.*)?"
sudo restorecon -Rv /etc/nginx
```

### 原因 3: 使用非 root 用户部署到系统目录

**问题**: 普通用户无法写入 `/etc/nginx`

**解决方案 A - 配置 sudo 免密**:
```bash
# 编辑 sudoers 文件
sudo visudo

# 添加以下行（替换 username 为实际用户名）
username ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/nginx/*
username ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx
username ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx
username ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
```

**解决方案 B - 使用自定义配置目录**:
```bash
# 创建用户可写的配置目录
mkdir -p ~/nginx-configs
chmod 755 ~/nginx-configs

# 在部署时使用这个目录作为目标路径
# 然后通过符号链接或脚本复制到 /etc/nginx
```

**解决方案 C - 修改 Nginx 配置目录所有者**:
```bash
# 将 /etc/nginx 所有者改为部署用户
sudo chown -R deployuser:deployuser /etc/nginx
```

### 原因 4: 磁盘空间不足

**检查磁盘空间**:
```bash
df -h /etc/nginx
```

**清理空间**:
```bash
# 清理日志
sudo journalctl --vacuum-size=100M

# 清理包缓存
sudo yum clean all  # CentOS/Rocky
sudo apt clean     # Ubuntu/Debian
```

### 原因 5: 文件系统只读

**检查挂载状态**:
```bash
mount | grep /etc
```

**重新挂载为读写**:
```bash
sudo mount -o remount,rw /
```

## 推荐的部署配置

### 方案 1: 使用 root 用户（简单但不推荐生产环境）

- **优点**: 无权限问题
- **缺点**: 安全风险高

配置服务器时：
- 用户名: `root`
- 认证: 密码或密钥

### 方案 2: 使用普通用户 + sudo（推荐）

1. **配置 sudo 免密**（针对 Nginx 相关命令）:
```bash
sudo visudo -f /etc/sudoers.d/nginx-deploy

# 添加内容
deployuser ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/nginx/*.conf
deployuser ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
deployuser ALL=(ALL) NOPASSWD: /usr/bin/systemctl * nginx
```

2. **修改目录权限**:
```bash
sudo chown -R deployuser:nginx /etc/nginx
sudo chmod -R 755 /etc/nginx
```

### 方案 3: 使用中间目录（最安全）

1. **配置流程**:
   - 上传到用户目录: `~/nginx-configs/`
   - 使用 deployment hook 中的脚本通过 sudo 复制到 `/etc/nginx/`

2. **创建部署脚本** (`post_deploy` hook):
```bash
#!/bin/bash
# 复制配置到系统目录
sudo cp ~/nginx-configs/nginx.conf /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
```

## 测试步骤

### 1. 手动测试 SFTP 上传

```bash
# 使用 sftp 命令测试
sftp -P 22 username@hostname

# 在 SFTP 会话中
put /tmp/test.txt /etc/nginx/test.txt

# 如果失败，检查错误消息
```

### 2. 测试目录权限

```bash
# SSH 到目标服务器
ssh username@hostname

# 测试写入
touch /etc/nginx/test.txt

# 如果失败，检查权限
ls -ld /etc/nginx
```

### 3. 查看部署日志

在平台的"部署管理"中：
1. 找到失败的部署任务
2. 点击查看日志
3. 查看具体的失败步骤和错误信息

## 快速修复清单

- [ ] 检查目标目录是否存在
- [ ] 检查 SSH 用户对目标目录是否有写权限
- [ ] 检查 SELinux 是否阻止
- [ ] 检查磁盘空间是否充足
- [ ] 确认使用的是正确的用户和认证方式
- [ ] 考虑使用 sudo 或修改目录所有者
- [ ] 重启后端服务使修复生效

## 应用修复

修复已应用到代码，需要重启后端服务：

```bash
cd /home/rocket/projects/middleware-deploy-kit/backend
./server  # 或使用你的启动方式
```
