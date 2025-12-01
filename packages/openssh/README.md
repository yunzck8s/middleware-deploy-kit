# OpenSSH 离线包

## 📦 版本列表

### 10.0p2

- **支持系统**: Rocky Linux 9.4, openEuler 22.03
- **安装脚本**: `install_repo.sh`
- **特性**:
  - OpenSSH 10.0p2 最新版本
  - 自动备份旧配置到 /etc/ssh_old
  - 完整的离线依赖包
  - 支持多架构（x86_64）
  - systemd 服务集成

## 🔧 可配置参数

所有参数通过环境变量配置，详见 `10.0p2/metadata.json`：

- `SSH_PORT`: SSH 服务端口（默认：22）
- `PERMIT_ROOT_LOGIN`: 是否允许 root 登录（默认：prohibit-password）
- `PASSWORD_AUTHENTICATION`: 是否启用密码认证（默认：yes）

## 📋 使用方法

### 打包

```bash
cd packages/openssh/10.0p2
zip -r openssh-10.0p2-offline.zip ./*
```

### 部署

在平台界面上传 ZIP 包，选择参数后部署到目标服务器。

## ⚠️ 注意事项

- 安装前会自动备份 /etc/ssh 到 /etc/ssh_old
- 安装过程需要 root 权限
- 建议在安装前测试 SSH 配置
