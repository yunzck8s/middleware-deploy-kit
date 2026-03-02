# 中间件离线部署管理平台

一个用于离线环境部署中间件（Nginx、Redis、OpenSSH）的 Web 管理平台，使用 Go + React 技术栈构建。

## 🚀 功能特性

### 当前已实现（阶段 1-2）
- ✅ 基础认证系统（JWT）
- ✅ 用户登录/登出
- ✅ 响应式管理界面
- ✅ Nginx JSON 日志格式
- ✅ 离线部署脚本（Nginx、Redis、OpenSSH）

### 已完成（阶段 3-8）
- ✅ 离线包管理（上传、版本管理、元数据解析）
- ✅ SSL 证书管理（上传、查看、应用）
- ✅ Nginx 可视化配置（创建、编辑、应用到服务器）
- ✅ 服务器管理（本地/远程 SSH 连接）
- ✅ 部署管理与实时日志（SSE 流式日志、取消部署）
- ✅ 参数化部署（动态表单生成、参数验证）
- ✅ 部署历史与统计（仪表盘数据可视化）

### 待完成（阶段 9-10）
- 🚧 端到端测试
- 🚧 生产环境部署准备

## 📦 支持的中间件

| 中间件 | 版本 | 支持系统 |
|--------|------|----------|
| Nginx | 1.28.0 | Rocky Linux 9.4, OpenEuler 22.03, Kylin V10, CentOS 7.9 |
| Redis | 6.2.20 | Rocky Linux 9.4 |
| OpenSSH | 10.0p2 | Rocky Linux, OpenEuler, Kylin V10 |

## 🛠️ 技术栈

### 后端
- **语言**: Go 1.21+
- **框架**: Gin
- **数据库**: SQLite (GORM)
- **认证**: JWT
- **日志**: Logrus

### 前端
- **框架**: React 18 + TypeScript
- **构建**: Vite
- **UI库**: Ant Design v5
- **状态管理**: Redux Toolkit
- **路由**: React Router v6
- **HTTP**: Axios

## 📋 环境要求

- **Go**: 1.21 或更高版本
- **Node.js**: 18.0 或更高版本
- **npm**: 9.0 或更高版本

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/yunzck8s/middleware-deploy-kit.git
cd middleware-deploy-kit
```

### 2. 启动后端服务

```bash
cd backend
go mod tidy
go run cmd/server/main.go
```

后端服务将在 `http://localhost:8080` 启动

**默认管理员账号**:
- 用户名: `admin`
- 密码: `admin123`

### 3. 启动前端服务

打开新终端：

```bash
cd frontend
npm install
npm run dev
```

前端服务将在 `http://localhost:5173` 启动

### 4. 访问系统

在浏览器打开: `http://localhost:5173`

使用默认账号登录即可开始使用。

## 📁 项目结构

```
middleware-deploy-kit/
├── backend/                 # Go 后端
│   ├── cmd/server/         # 主程序入口
│   ├── internal/           # 内部包
│   │   ├── api/           # API 处理器
│   │   ├── models/        # 数据模型
│   │   ├── db/            # 数据库层
│   │   ├── service/       # 业务逻辑
│   │   ├── config/        # 配置
│   │   └── utils/         # 工具函数
│   ├── pkg/               # 公共包
│   ├── data/              # 运行时数据
│   └── scripts/           # 增强版部署脚本
│
├── frontend/              # React 前端
│   ├── src/
│   │   ├── api/          # API 客户端
│   │   ├── components/   # 组件
│   │   ├── pages/        # 页面
│   │   ├── store/        # Redux
│   │   ├── hooks/        # 自定义 Hooks
│   │   └── types/        # TypeScript 类型
│
├── nginx/                 # Nginx 部署脚本
├── redis/                 # Redis 部署脚本
└── openssh_auto_install_10.0p2/  # OpenSSH 部署脚本
```

## 🔧 配置说明

### 后端配置

配置文件: `backend/internal/config/config.go`

```go
Server:
  Host: "0.0.0.0"
  Port: 8080

Database:
  Type: "sqlite"
  DSN:  "./data/deploy.db"

JWT:
  Secret:     "your-secret-key-change-in-production"
  ExpireTime: 24h
```

### 前端配置

环境变量文件: `frontend/.env`

```bash
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

## 📝 API 文档

### 认证接口

| 方法 | 路径 | 说明 | 需要认证 |
|------|------|------|----------|
| POST | `/api/v1/auth/login` | 用户登录 | ❌ |
| POST | `/api/v1/auth/logout` | 用户登出 | ✅ |
| GET | `/api/v1/auth/profile` | 获取用户信息 | ✅ |
| PUT | `/api/v1/auth/password` | 修改密码 | ✅ |

## 🗺️ 开发路线图

- [x] **阶段 1**: 基础改进（.gitignore、Nginx JSON日志）
- [x] **阶段 2**: 基础架构（Go后端 + React前端 + JWT认证）
- [x] **阶段 3**: 离线包和证书管理
- [x] **阶段 4**: 服务器管理
- [x] **阶段 5**: Nginx 可视化配置
- [x] **阶段 6**: 脚本重构（智能重试、幂等性）
- [x] **阶段 7**: 部署执行引擎（实时日志、取消部署）
- [x] **阶段 8**: 部署前端界面（参数化部署、配置应用）
- [ ] **阶段 9**: 端到端测试
- [ ] **阶段 10**: 生产部署和发布 v1.0.0

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 📞 联系方式

- GitHub: [yunzck8s/middleware-deploy-kit](https://github.com/yunzck8s/middleware-deploy-kit)

---

**当前版本**: v0.9.0-dev (阶段 1-8 完成)

**上次更新**: 2026-03-02
