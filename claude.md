# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## **Workflow Orchestration (工作流编排)**

### **1. Plan Node Default (默认计划节点)**

* 对于任何非琐碎任务（3步以上或涉及架构决策），进入计划模式。
* 如果执行过程中出现偏差，立即**停止**并重新制定计划——不要强行推进。
* 计划模式不仅用于构建，也用于验证步骤。
* 预先编写详细规范，以减少歧义。

### **2. Subagent Strategy (子代理策略)**

* 大量使用子代理以保持主上下文窗口的整洁。
* 将研究、探索和并行分析任务分配给子代理。
* 对于复杂问题，通过子代理投入更多计算资源。
* 每个子代理负责一个方向，以确保专注执行。

### **3. Self-Improvement Loop (自我完善循环)**

* 在收到用户的任何更正后：更新 `tasks/lessons.md` 并记录模式。
* 为自己编写规则，防止重复犯错。
* 无情地迭代这些经验教训，直到错误率下降。
* 在针对相关项目启动会话时，审查这些经验教训。

### **4. Verification Before Done (完成后验证)**

* 在证明任务有效之前，绝不标记为完成。
* 在相关时，对比主分支行为与你的更改之间的差异。
* 问问自己：“资深工程师会批准这个吗？”
* 运行测试，检查日志，演示正确性。

### **5. Demand Elegance (Balanced) (追求优雅 - 均衡)**

* 对于非琐碎的更改：停下来思考“是否有更优雅的方法？”
* 如果修复方案感觉很笨拙：“基于我目前所知，实现那个优雅的方案”。
* 简单、明显的修复可以跳过此步——不要过度设计。
* 在提交工作之前，先对自己进行挑战。

### **6. Autonomous Bug Fixing (自主 Bug 修复)**

* 当收到 Bug 报告时：直接修复它。不要请求手把手的指导。
* 定位日志、错误和失败的测试——然后解决它们。
* 用户无需进行上下文切换。
* 无需他人告知，主动修复失败的 CI 测试。

---

## **Task Management (任务管理)**

1. **Plan First (计划优先)**：将计划写入 `tasks/todo.md`，并附带可勾选的项目。
2. **Verify Plan (验证计划)**：在开始实施前进行确认。
3. **Track Progress (跟踪进度)**：随进度标记完成项。
4. **Explain Changes (解释变更)**：在每个步骤提供高层级的总结。
5. **Document Results (记录结果)**：在 `tasks/todo.md` 中添加评审章节。
6. **Capture Lessons (吸取教训)**：在更正后更新 `tasks/lessons.md`。

---

## **Core Principles (核心原则)**

* **Simplicity First (简单至上)**：使每一次更改尽可能简单。影响最小的代码。
* **No Laziness (拒绝懒惰)**：寻找根本原因。不接受临时修复。坚持资深开发人员的标准。
* **Minimal Impact (最小影响)**：更改应仅触及必要的部分。避免引入新 Bug。

---

## Project Overview

Middleware offline deployment management platform (中间件离线部署管理平台) for deploying Nginx, Redis, and OpenSSH in air-gapped environments. Go + React monorepo. UI language is Chinese (zh-CN).

**Requirements**: Go 1.25+, Node.js 18+, npm 9+

## Development Commands

### Backend (Go + Gin)
```bash
cd backend
go mod tidy                                      # install dependencies
go run cmd/server/main.go                        # start server on :8080
go test ./...                                    # run all tests
go test ./internal/api/ -run TestFunctionName    # run single test
go build ./...                                   # compile check without running
```

### Frontend (React + Vite)
```bash
cd frontend
npm install          # install dependencies
npm run dev          # dev server on :5173
npm run build        # type-check + production build (tsc -b && vite build)
npm run lint         # eslint
npx vitest --run     # run tests once (do NOT use npm run test - it starts watch mode)
npx vitest --run src/api/__tests__/auth.test.ts  # single test file
npx vitest --run --coverage                      # test coverage report
```

### Default credentials
- Username: `admin` / Password: `admin123`

## Architecture

### Backend (`backend/`)
- **Entry**: `cmd/server/main.go` — Gin router setup, all route registration in `setupRoutes()`
- **API handlers**: `internal/api/` — resource-based files (nginx.go, deployment.go, server.go, certificate.go, package.go, auth.go)
- **Models**: `internal/models/` — GORM models with SQLite, auto-migrated in `internal/db/db.go`
- **Config**: `internal/config/config.go` — hardcoded defaults (no config file), DSN at `./data/deploy.db`
- **Auth**: JWT-based, middleware in `internal/api/middleware.go`, token utils in `internal/utils/jwt.go`
- **Response helper**: `pkg/response/response.go` — standardized `{code, message, data}` JSON responses
- **Go module path**: `github.com/yunzck8s/middleware-deploy-kit/backend`

### Frontend (`frontend/`)
- **Stack**: React 19.2, TypeScript 5.9, Ant Design 6, Redux Toolkit 2.11, React Router 7.9, Vite 7.2, ECharts 5
- **API layer**: `src/api/client.ts` — Axios instance with JWT interceptor; per-resource API files in `src/api/`
- **State**: Redux store in `src/store/` — only `authSlice` (user, token, isAuthenticated)
- **Pages**: `src/pages/` — Dashboard, Deployments, Servers, NginxConfig, Certificates, Middleware, Login
- **Types**: `src/types/index.ts` — all TypeScript interfaces in a single file
- **Theme**: Dark/light dual theme via CSS variables (`[data-theme]` attribute) + Ant Design ConfigProvider algorithm switching. `useTheme` hook persists preference to localStorage.
- **Tests**: Vitest + jsdom + React Testing Library, setup in `src/test/setup.ts` (mocks localStorage, matchMedia, IntersectionObserver)

### Nginx Visual Config Editor (`frontend/src/components/nginx/`)
The Nginx config system is the most complex frontend feature. `NginxConfig.tsx` page toggles between a card-grid list view and `ConfigEditor.tsx` (the main editor). The editor has a left nav sidebar with 10 sections, each rendered by a dedicated component:
- `LocationEditor.tsx` — card-based location rules with modal for add/edit (static, proxy, redirect, return handler types)
- `UpstreamEditor.tsx` — upstream pools with inline server management and weight visualization
- `SSLPanel.tsx` — certificate selection, protocols, HSTS, OCSP
- `CachePanel.tsx` — proxy cache toggle with path/size/validity
- `SecurityPanel.tsx` — rate limiting, connection limiting, IP access control, security headers
- `ConfigPreview.tsx` — nginx.conf preview with regex-based syntax highlighting
- `ApplyConfigModal.tsx` — deploy config to selected server

Locations and upstreams are managed as arrays in component state (not form fields), merged with form values on save.

### Offline Packages (`packages/`)
Each middleware (nginx, redis, openssh) has versioned directories with `metadata.json` and shell scripts. The `metadata.json` defines a `parameters[]` array (name, label, type, default, validation), `supported_os[]`, and `install_script` reference. The deployment flow:
```
metadata.json → API → frontend ParameterForm → deploy_params JSON → backend injects as env vars → shell script reads ${VAR:-default}
```

## Key Patterns

- **API response format**: All endpoints return `{ code: number, message: string, data: T }`
- **Frontend API client**: Response interceptor unwraps `response.data.data`, so API functions return the inner data directly
- **Auth flow**: Token stored in localStorage, attached via Axios request interceptor, 401 triggers auto-logout and redirect to `/login`
- **Database**: SQLite with GORM auto-migration — add new models to `db.AutoMigrate()` in `internal/db/db.go`
- **Real-time logs**: SSE via `GET /api/v1/deployments/:id/logs/stream`, consumed by `useDeploymentLogs` hook using EventSource
- **Deployment cancellation**: Go context.Context cancellation, checked between steps via `ctx.Done()`
- **Adding new routes**: All routes registered in `setupRoutes()` in `cmd/server/main.go`, grouped under `/api/v1` with `AuthMiddleware` applied per group
- **Adding new pages**: Create page in `src/pages/`, add route in `App.tsx`, add menu item in `Layout.tsx`
- **Nginx path resolution**: Use `inferNginxInstallDir(serverID)` in `internal/api/nginx.go` to dynamically resolve nginx install directory instead of hardcoding paths. Certificate deployment paths auto-fill as `{installDir}/ssl`. SSL certificate paths in generated nginx.conf use remote server paths (`{installDir}/ssl/{filename}`) not local management platform paths.
- **Manual config override**: `NginxConfig.ManualConfig` field takes precedence over auto-generated config in `executeApplyConfig()`. Frontend ConfigPreview component supports edit/preview toggle mode.
- **Proxy defaults**: Location proxy settings use production-grade defaults (30s connect timeout, 300s send/read timeout, 1024m file sizes, WebSocket + CORS enabled). All 16 proxy directives are configurable via LocationEditor UI with collapsible advanced settings panel.

## Workflow Orchestration

### Plan Node Default
- For any non-trivial task (3+ steps or architectural decisions), enter plan mode.
- If execution deviates, **stop** and re-plan — do not force through.

### Subagent Strategy
- Use subagents heavily to keep the main context window clean.
- Delegate research, exploration, and parallel analysis to subagents.
- One subagent per direction to ensure focused execution.

### Verification Before Done
- Never mark a task complete until you've proven it works.
- Run `npm run build` (frontend) and `go build ./...` (backend) to verify compilation.
- Run `npx vitest --run` (frontend) and `go test ./...` (backend) to verify tests pass.

### Autonomous Bug Fixing
- When given a bug report: fix it directly. Don't ask for hand-holding.
- Locate logs, errors, and failing tests — then resolve them.
- Fix failing tests proactively without being told.

## Task Management

1. **Plan First**: Write plans into `tasks/todo.md` with checkable items.
2. **Track Progress**: Check off items as you go.
3. **Capture Lessons**: Update `tasks/lessons.md` after user corrections.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. Don't accept band-aid fixes.
- **Minimal Impact**: Changes should touch only what's necessary.

## Current Status

Backend and frontend are feature-complete (stages 1-8). Remaining: end-to-end testing (stage 9) and production deployment preparation (stage 10).
