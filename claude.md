# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Language Preference

- Always respond in Chinese for design documents, reports, planning, and user-facing content
- Code comments and commit messages should be in Chinese
- Technical discussions can be in English when referencing specific APIs or error messages

## Git Operations

- Always execute git commands from repository root, not subdirectories
- Verify current directory with `pwd` before git operations if uncertain
- Use `git pull --rebase` before pushing to handle remote changes
- Commit messages should follow existing style (feat/fix/refactor prefix + Chinese description)

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. Don't accept band-aid fixes.
- **Minimal Impact**: Changes should touch only what's necessary.
- **Verification Before Done**: Run tests and verify compilation before marking tasks complete.

## Task Management

1. **Plan First**: Write plans into `tasks/todo.md` with checkable items for non-trivial tasks (3+ steps)
2. **Track Progress**: Check off items as you go
3. **Capture Lessons**: Update `tasks/lessons.md` after user corrections to prevent repeated mistakes

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

### Production Build
```bash
# 双架构构建（amd64 + arm64）
./scripts/build.sh

# 单架构构建
ARCH=arm64 ./scripts/build.sh
ARCH=amd64 ./scripts/build.sh

# 指定版本
VERSION=1.1.0 ./scripts/build.sh
```
产物输出到 `dist/middleware-deploy-kit-v{VERSION}-linux-{arch}.tar.gz`

## Architecture

### Backend (`backend/`)
- **Entry**: `cmd/server/main.go` — Gin router setup, all route registration in `setupRoutes()`
- **API handlers**: `internal/api/` — resource-based files (nginx.go, deployment.go, server.go, certificate.go, package.go, auth.go, notification.go, certificate_alert.go, system_config.go)
- **Models**: `internal/models/` — GORM models with SQLite, auto-migrated in `internal/db/db.go`
- **Services**: `internal/service/` — business logic (notification.go, email.go, webhook.go)
- **Scheduler**: `internal/scheduler/scheduler.go` — cron-like task scheduler, runs certificate expiry checks daily at 2:00 AM
- **Config**: `internal/config/config.go` — env-based defaults (no config file), DSN at `./data/deploy.db`. Key env vars: `SERVER_HOST` (default `0.0.0.0`), `SERVER_PORT` (default `8080`), `JWT_SECRET` (auto-generated), `DATA_DIR` (default `./data`)
- **Auth**: JWT-based, middleware in `internal/api/middleware.go`, token utils in `internal/utils/jwt.go`
- **Response helper**: `pkg/response/response.go` — standardized `{code, message, data}` JSON responses
- **Go module path**: `github.com/yunzck8s/middleware-deploy-kit/backend`

### Frontend (`frontend/`)
- **Stack**: React 19.2, TypeScript 5.9, Ant Design 6, Redux Toolkit 2.11, React Router 7.9, Vite 7.2, ECharts 5
- **API layer**: `src/api/client.ts` — Axios instance with JWT interceptor; per-resource API files in `src/api/`
- **State**: Redux store in `src/store/` — only `authSlice` (user, token, isAuthenticated)
- **Pages**: `src/pages/` — Dashboard, Deployments, Servers, NginxConfig, Certificates, Middleware, Login, Notifications, SystemConfig
- **Components**: `src/components/` — reusable UI components, certificate alert drawer, notification bell
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
- **Batch deployment**: Deployments page supports single-server and multi-server batch deployment modes. Batch mode uses Segmented component for mode selection, Checkbox.Group for server selection, and supports batch operations (execute/delete) with confirmation dialogs. Real-time logs use SSE with smart auto-scrolling that respects user scroll position. Background polling (5s interval) updates deployment status silently without UI flicker.
- **Certificate update & auto-deploy**: `PUT /certificates/:id` accepts new cert/key files, performs atomic replacement locally (write .tmp → rename), then auto-deploys to all servers using that certificate via SSH/SFTP (also atomic: upload .tmp → `sudo mv`). Runs `sudo nginx -t` before `sudo nginx -s reload`. Uses `which nginx` to detect install path on package-managed hosts. All remote commands use `sudo` for non-root SSH users.
- **Certificate expiry notifications**: Multi-channel notification system (internal + email + webhook) with per-certificate alert configuration. Scheduler runs daily at 2:00 AM to check certificates against configured thresholds (e.g., 30/7/1 days). Deduplication via `CertificateAlertLog` prevents repeated alerts on same day. SMTP config in `SystemConfig` table, webhook supports enterprise WeChat format (`msgtype: "text"`). Frontend: `NotificationBell` in header, `Notifications` page, `AlertConfigDrawer` in certificates page, certificate risk card in dashboard.

## Testing

- Run `npm run build` (frontend) and `go build ./...` (backend) to verify compilation
- Run `npx vitest --run` (frontend) and `go test ./...` (backend) to verify tests pass
- Test authentication, validation, and API handler code after modifications

## Current Status

Backend and frontend are feature-complete. SSL certificate management includes upload, update with atomic replacement, and auto-deploy to remote servers. Multi-channel expiry alerts (internal/email/webhook) with scheduler and per-certificate configuration. Batch deployment with real-time SSE logs. Production build supports amd64 and arm64 dual-architecture output.
