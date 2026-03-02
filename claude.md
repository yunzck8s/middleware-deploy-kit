# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
