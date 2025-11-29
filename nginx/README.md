# 🚀 Nginx 自动编译安装

![Nginx](https://img.shields.io/badge/Nginx-1.28.0-green)
![OS](https://img.shields.io/badge/OS-Rocky%20Linux%209.4-blue)
![License](https://img.shields.io/badge/License-MIT-blue)

一个专为 Linux环境设计的 Nginx 1.28.0 离线编译安装脚本，支持 SSL、Gzip 压缩、反向代理等企业级功能。

## 📋 功能特性

- ✅ **离线安装**: 无需网络连接，内置所有依赖包
- ✅ **自动编译**: 从源码编译，支持 SSL 模块
- ✅ **系统服务**: 自动配置 systemd 服务
- ✅ **日志轮转**: 内置 logrotate 配置
- ✅ **安全优化**: 关闭版本显示、SSL 安全配置
- ✅ **多场景配置**: 提供多种预制配置模板

## 🛠️ 系统要求

- **操作系统**: Rocky Linux 9.4（推荐）、Kylin-Server-V10-SP3 2303\2403、OpenEuler 22.03、CentOS7.9
- **权限**: root 用户
- **磁盘空间**: 至少 500MB
- **内存**: 建议 1GB+

## 📦 快速安装

### 1️⃣ 下载并授权
```bash
chmod +x auto_install_nginx.sh
```

### 2️⃣ 执行安装
```bash
./auto_install_nginx.sh
```

### 3️⃣ 验证安装
```bash
# 检查服务状态
systemctl status nginx

# 检查版本信息
/usr/local/nginx/sbin/nginx -V

# 测试配置
/usr/local/nginx/sbin/nginx -t
```

## ⚙️ 安装后配置

### 📂 重要路径
| 类型 | 路径 | 说明 |
|------|------|------|
| 🏠 **安装目录** | `/usr/local/nginx` | Nginx 主目录 |
| ⚙️ **配置文件** | `/usr/local/nginx/conf/nginx.conf` | 主配置文件 |
| 🔧 **二进制文件** | `/usr/local/nginx/sbin/nginx` | 可执行文件 |
| 📄 **日志目录** | `/usr/local/nginx/logs/` | 访问和错误日志 |
| 🔧 **系统服务** | `/etc/systemd/system/nginx.service` | systemd 配置 |

### 🎯 服务管理
```bash
# 启动服务
systemctl start nginx

# 停止服务
systemctl stop nginx

# 重启服务
systemctl restart nginx

# 重载配置
systemctl reload nginx

# 查看状态
systemctl status nginx

# 开机自启
systemctl enable nginx
```

## 📁 项目结构

```bash
compile/nginx/
├── auto_install_nginx.sh    # 🔧 自动安装脚本
├── syncplant/              # 📋 Syncplant 配置模板
│   ├── nginx.conf          #   ├─ 主配置（SSL + 反向代理）
│   ├── nginx-default.conf  #   ├─ 默认配置
│   ├── nginx-http.conf     #   ├─ HTTP 配置
│   ├── nginx-template.conf #   ├─ 通用模板
│   └── nginx-dashboard.conf#   └─ 仪表板配置
├── xiaoke/                 # 📋 Xiaoke 配置模板
│   └── nginx-xiaoke.conf   #   └─ Xiaoke 专用配置
└── README.md               # 📖 说明文档
```

## 🔒 安全配置

脚本会自动处理以下安全设置：

### SELinux 处理
```bash
# 临时关闭（立即生效）
setenforce 0

# 永久关闭（重启后生效）
sed -i 's/^SELINUX=enforcing$/SELINUX=permissive/' /etc/selinux/config
```

### 防火墙配置
```bash
# 如果需要关闭防火墙
systemctl stop firewalld
systemctl disable firewalld

# 或者开放端口（推荐）
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --reload
```

## 🎨 配置模板说明

### 🔹 syncplant/nginx.conf
- **用途**: 生产环境 SSL 反向代理
- **特性**: HTTPS、Gzip 压缩、WebSocket 支持
- **端口**: 31078 (SSL)
- **后端**: 127.0.0.1:30010

### 🔹 syncplant/nginx-default.conf
- **用途**: 基础 HTTP 服务
- **特性**: 静态文件服务、基础配置
- **端口**: 80

### 🔹 syncplant/nginx-http.conf
- **用途**: HTTP 反向代理
- **特性**: 负载均衡、健康检查
- **端口**: 80

### 🔹 xiaoke/nginx-xiaoke.conf
- **用途**: Xiaoke 项目专用
- **特性**: 定制化配置

## 🚨 故障排除

### 常见问题

#### ❌ 服务启动失败（状态码 203）
**原因**: SELinux 权限问题  
**解决**: 
```bash
# 检查 SELinux 状态
getenforce

# 临时关闭
setenforce 0

# 查看详细错误
journalctl -u nginx -f
```

#### ❌ 端口被占用
**检查**: 
```bash
# 查看端口占用
netstat -tlnp | grep :80
ss -tlnp | grep :80

# 修改配置文件端口
vim /usr/local/nginx/conf/nginx.conf
```

#### ❌ SSL 证书错误
**检查**: 
```bash
# 验证证书路径
ls -la /data/nginx/ssl/

# 测试 SSL 配置
openssl s_client -connect localhost:443
```

## 📚 进阶配置

### 性能优化
```nginx
# 在 nginx.conf 中添加
worker_processes auto;
worker_connections 4096;
client_max_body_size 100m;
keepalive_timeout 65;
```

### 日志配置
```bash
# 查看访问日志
tail -f /usr/local/nginx/logs/access.log

# 查看错误日志
tail -f /usr/local/nginx/logs/error.log

# 日志轮转（已自动配置）
cat /etc/logrotate.d/nginx
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个项目！

### 提交建议
1. 🐛 **Bug 反馈**: 提供详细的错误信息和复现步骤
2. ✨ **功能建议**: 描述新功能的使用场景和预期效果
3. 📝 **文档改进**: 修正错误或补充说明
4. 🔧 **脚本优化**: 提升安装效率或兼容性

### 开发指南
- 遵循 Shell 脚本规范
- 增加必要的错误检查
- 提供清晰的注释
- 测试多种环境兼容性

## 📞 技术支持

- 📧 **问题反馈**: 通过 Issue 提交技术问题
- 📚 **文档**: 查看项目 Wiki 获取更多信息
- 🔗 **官方网站**: [Nginx 官方文档](https://nginx.org/en/docs/)

## 📄 许可证

本项目采用 MIT 许可证，详情请查看 [LICENSE](LICENSE) 文件。

---

<div align="center">
  <strong>🚀 Happy Nginx Deployment! 🚀</strong>
</div>



