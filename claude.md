# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Middleware offline deployment management platform (中间件离线部署管理平台) for deploying Nginx, Redis, and OpenSSH in air-gapped environments. Go + React monorepo.

## Development Commands

### Backend (Go + Gin)
```bash
cd backend
go mod tidy          # install dependencies
go run cmd/server/main.go   # start server on :8080
go test ./...        # run all tests
go test ./internal/api/ -run TestFunctionName  # run single test
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
```

### Default credentials
- Username: `admin` / Password: `admin123`

## Architecture

### Backend (`backend/`)
- **Entry**: `cmd/server/main.go` — Gin router setup, all route registration in `setupRoutes()`
- **API handlers**: `internal/api/` — each resource has its own file (nginx.go, deployment.go, server.go, etc.)
- **Models**: `internal/models/` — GORM models with SQLite, auto-migrated in `internal/db/db.go`
- **Config**: `internal/config/config.go` — hardcoded defaults (no config file), DSN at `./data/deploy.db`
- **Auth**: JWT-based, middleware in `internal/api/middleware.go`, token utils in `internal/utils/jwt.go`
- **Response helper**: `pkg/response/response.go` — standardized `{code, message, data}` JSON responses

### Frontend (`frontend/`)
- **Stack**: React 19, TypeScript, Ant Design 6, Redux Toolkit, React Router 7, Vite 7
- **API layer**: `src/api/client.ts` — Axios instance with JWT interceptor; per-resource API files in `src/api/`
- **State**: Redux store in `src/store/` (currently just `authSlice`)
- **Pages**: `src/pages/` — Dashboard, Deployments, Servers, NginxConfig, Certificates, Middleware, Login
- **Types**: `src/types/index.ts` — all TypeScript interfaces in one file
- **Tests**: Vitest + jsdom + React Testing Library, setup in `src/test/setup.ts`

### Offline Packages (`packages/`)
Each middleware has versioned directories with `metadata.json` (defines parameters, supported OS, install script) and shell scripts. The deployment flow:
```
metadata.json → API → frontend form → deploy_params JSON → backend injects as env vars → shell script reads ${VAR:-default}
```

## Key Patterns

- **API response format**: All endpoints return `{ code: number, message: string, data: T }`
- **Frontend API client**: Response interceptor unwraps to `response.data`, so API functions return the inner response directly
- **Auth flow**: Token stored in localStorage, attached via Axios request interceptor, 401 triggers auto-logout
- **Database**: SQLite with GORM auto-migration — add new models to `db.AutoMigrate()` in `internal/db/db.go`
- **Real-time logs**: SSE via `GET /api/v1/deployments/:id/logs/stream`, consumed by `useDeploymentLogs` hook using EventSource
- **Deployment cancellation**: Go context.Context cancellation, checked between steps via `ctx.Done()`
- **Go module path**: `github.com/yunzck8s/middleware-deploy-kit/backend`

## Workflow Orchestration

### Plan Node Default
- For any non-trivial task (3+ steps or architectural decisions), enter plan mode.
- If execution deviates, **stop** and re-plan — do not force through.
- Plan mode is for verification steps too, not just building.
- Write detailed specs upfront to reduce ambiguity.

### Subagent Strategy
- Use subagents heavily to keep the main context window clean.
- Delegate research, exploration, and parallel analysis to subagents.
- For complex problems, throw more compute at it via subagents.
- One subagent per direction to ensure focused execution.

### Self-Improvement Loop
- After any user correction: update `tasks/lessons.md` and log the pattern.
- Write rules for yourself to prevent repeat mistakes.
- Ruthlessly iterate on these lessons until error rate drops.
- Review lessons when starting sessions on related projects.

### Verification Before Done
- Never mark a task complete until you've proven it works.
- Diff against main branch behavior vs your changes when relevant.
- Ask yourself: "Would a senior engineer approve this?"
- Run tests, check logs, demonstrate correctness.

### Demand Elegance (Balanced)
- For non-trivial changes: pause and think "is there a more elegant way?"
- If a fix feels hacky: "implement the elegant solution based on what I know now."
- Simple, obvious fixes can skip this — don't over-engineer.
- Challenge yourself before committing work.

### Autonomous Bug Fixing
- When given a bug report: fix it directly. Don't ask for hand-holding.
- Locate logs, errors, and failing tests — then resolve them.
- Users should not need to context-switch.
- Fix failing CI tests proactively without being told.

## Task Management

1. **Plan First**: Write plans into `tasks/todo.md` with checkable items.
2. **Verify Plan**: Confirm before starting implementation.
3. **Track Progress**: Check off items as you go.
4. **Explain Changes**: Provide high-level summaries at each step.
5. **Document Results**: Add review sections in `tasks/todo.md`.
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. Don't accept band-aid fixes. Hold to senior dev standards.
- **Minimal Impact**: Changes should touch only what's necessary. Avoid introducing new bugs.

## Current Development Status

**Backend**: 100% complete ✅
**Frontend**: 100% complete ✅

All core features have been implemented:
1. ✅ ParameterForm component - Dynamic form generation for parameterized deployments
2. ✅ NginxConfig apply feature - ApplyConfigModal with server selection and deployment options
3. ✅ Deployment type cleanup - nginx_config removed, only package and certificate remain
4. ✅ Real-time logs - SSE streaming via useDeploymentLogs hook
5. ✅ Deployment cancellation - Context-based cancellation with status updates

**Next Steps**: End-to-end testing and production deployment preparation
