# 🧱 OpenSSH 自动升级工具

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Linux-orange)
![OS](https://img.shields.io/badge/OS-Rocky%20Linux%20%7C%20OpenEuler%20%7C%20Kylin-orange)
![Version](https://img.shields.io/badge/version-10.0p2-blue)

一个用于在 Rocky Linux、Open Euler、Kylin V10 上自动升级 OpenSSH 到 10.0p2 版本的工具集，提升系统 SSH 安全性。

## 🎯 功能特点

- 🔄 **自动化升级**: 一键完成 OpenSSH 从旧版本到 10.0p2 的升级
- 🛡️ **安全备份**: 自动备份原有 SSH 配置文件
- 🌍 **多系统支持**: 支持 Rocky Linux 和 Open Euler、Kylin 操作系统
- ⚡ **高效编译**: 利用多核心并行编译，提升安装速度
- 🔧 **配置优化**: 自动优化 SSH 配置，禁用不安全选项

## 📁 目录结构

```
openssh_auto_install_10.0p2/
├── install_repo.sh              # 离线源配置脚本
├── rocky_build_config_openssh.sh # Rocky Linux 升级脚本
├── euler_build_config_openssh.sh # EulerOS 升级脚本
└── package/
    └── openssh-10.0p2.tar.gz     # OpenSSH 10.0p2 源码包
```

## 🚀 使用方法

### 1️⃣ 准备工作

确保已将 OpenSSH 10.0p2 源码包放置在 `package/` 目录下：

```bash
# 创建 package 目录
mkdir -p package

# 将 openssh-10.0p2.tar.gz 放入 package 目录
cp openssh-10.0p2.tar.gz package/
```

### 2️⃣ 执行升级

根据你的操作系统选择对应的升级脚本：

#### Rocky Linux 系统

```bash
# 以 root 用户执行
sudo ./rocky_build_config_openssh.sh
```

#### EulerOS 系统

```bash
# 以 root 用户执行
sudo ./euler_build_config_openssh.sh
```

### 3️⃣ 离线环境部署

如果在无法访问互联网的环境中部署，可以使用离线源配置脚本：

```bash
# 配置离线 yum 源
sudo ./install_repo.sh
```

## ⚠️ 注意事项

1. **权限要求**: 所有脚本都需要以 root 用户权限运行
2. **系统架构**: 仅支持 x86_64/amd64 架构
3. **备份机制**: 升级前会自动备份 `/etc/ssh` 目录到 `/etc/ssh_old`
4. **依赖安装**: 脚本会自动安装编译所需的依赖包
5. **服务重启**: 升级完成后会自动重启 sshd 服务

## 🛠️ 配置说明

升级过程中会自动注释掉以下不安全的 GSSAPI 配置项：
- `GSSAPIKexAlgorithms`
- `GSSAPIAuthentication`

## 📊 验证升级

升级完成后，可以通过以下命令验证 OpenSSH 版本：

```bash
# 查看 OpenSSH 版本
ssh -V

# 检查 sshd 服务状态
systemctl status sshd
```

## 📞 故障排除

### 常见问题

1. **编译失败**: 检查是否缺少必要的编译依赖
2. **权限不足**: 确保以 root 用户执行脚本
3. **服务启动失败**: 检查配置文件语法是否正确

### 日志查看

```bash
# 查看 sshd 服务日志
journalctl -u sshd -f
```

## 📄 License

本项目采用 MIT License，详情请查看 [LICENSE](../../../../../LICENSE) 文件。

---

<div align="center">
  <strong>🔐 提升系统安全性，保护您的服务器访问通道 🔐</strong><br/>
  <em>自动化 OpenSSH 升级解决方案</em>
</div>