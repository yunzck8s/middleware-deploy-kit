# TODO

## Current Sprint

### Nginx Package Assembly

- [x] **Task 1**: Merge nginx offline assets into package workspace
  - Use existing project metadata and parameterized install script
  - Import `package/` and `libs/` from the provided tarball
  - Keep output suitable for direct platform upload

- [x] **Task 2**: Build uploadable nginx offline ZIP
  - Produce a final ZIP containing metadata, script, package, and libs
  - Verify archive structure and required files
  - Document artifact path and upload notes

#### Review

- Imported the provided nginx tarball contents into `packages/nginx/1.28.0/package/` and `packages/nginx/1.28.0/libs/` while preserving the project's existing metadata and parameterized install script.
- Built a final uploadable ZIP and verified it by uploading it through the local platform API successfully.

### Frontend Redesign

- [x] **Task 1**: Establish Nginx operations design system
  - ✅ Rebuilt dark-first tokens, spacing, radii, shadows, and shared shell/page primitives
  - ✅ Aligned product branding to Nginx Operations Console across shell and login

- [x] **Task 2**: Redesign shell and primary workflows
  - ✅ Reworked app shell, dashboard, package hub, certificate center, server resource view, config list, config editor, and deployment control room
  - ✅ Unified status badges, page headers, metric tiles, section cards, filters, and terminal log presentation

- [x] **Task 3**: Verify redesigned frontend
  - ✅ All frontend tests passing via `npx vitest --run`
  - ✅ Production build passing via `npm run build`

#### Review

- The frontend now reads as a dedicated Nginx operations console instead of a generic admin panel, with consistent information hierarchy and shared UI primitives.
- Existing API contracts and routes remain intact; the redesign is fully client-side.

### Nginx Only Refactor

- [x] **Task 1**: Enforce nginx-only backend package rules
  - Restrict package upload/list/detail/delete to nginx only
  - Validate uploaded ZIP metadata matches nginx package identity
  - Reject deployments that reference non-nginx packages

- [x] **Task 2**: Clean legacy non-nginx data on startup
  - Mark non-nginx packages deleted and remove physical files when possible
  - Soft-delete related deployments and remove logs/hooks
  - Keep cleanup idempotent and non-blocking on missing files

- [x] **Task 3**: Remove Redis/OpenSSH frontend entrypoints
  - Remove Redis/OpenSSH menu groups and routes
  - Redirect legacy Redis/OpenSSH URLs to nginx pages
  - Make package/deployment pages nginx-only

- [x] **Task 4**: Delete non-nginx package assets and refresh docs
  - Remove `packages/redis/` and `packages/openssh/`
  - Update product naming and docs to nginx-focused wording
  - Refresh testing guides and task notes

- [x] **Task 5**: Verify nginx-only behavior
  - Run backend tests
  - Run frontend tests in non-watch mode
  - Run frontend build

#### Review

- Backend now accepts and exposes only active Nginx packages, validates uploaded ZIP metadata, rejects non-Nginx package deployments, and cleans legacy non-Nginx package data at startup.
- Frontend now shows only Nginx entrypoints, redirects old Redis/OpenSSH URLs, and requests only Nginx package resources.
- Verified with `go test -vet=off ./...`, `npx vitest --run`, and `npm run build`.

### Manual Testing Tasks

- [ ] **Task 1**: Manual E2E testing
  - Test real-time logs and deployment cancellation
  - Test parameterized deployment with custom parameters
  - Test Nginx config apply workflow
  - Estimated: 1.5 hours
  - Reference: `tasks/testing-guide.md`

## Backlog

- [ ] Add deployment rollback UI
- [ ] Implement batch deployment progress tracking
- [ ] Add server health monitoring dashboard
- [ ] Certificate expiration alerts
- [ ] Fix npm security vulnerabilities (6 vulnerabilities: 2 moderate, 4 high)
- [ ] Consider code splitting to reduce bundle size

## Completed

### Repository Review (Completed: 2026-03-09)

- [x] **Task 1**: Review core documentation and package layout
  - ✅ Confirmed the product is now focused on Nginx offline deployment and configuration
  - ✅ Verified repository includes real offline package metadata and install scripts
  - Location: `README.md`, `packages/`

- [x] **Task 2**: Inspect backend execution flow and APIs
  - ✅ Verified backend exposes auth, package, certificate, server, nginx, deployment, and script APIs
  - ✅ Confirmed deployment engine uses SSH/SFTP for remote execution and SSE for live logs
  - Location: `backend/cmd/server/main.go`, `backend/internal/api/deployment.go`

- [x] **Task 3**: Inspect frontend routes and deployment workflow
  - ✅ Verified frontend covers dashboard, server management, package/certificate management, Nginx config, and deployments
  - ✅ Confirmed package metadata drives dynamic deployment parameter forms
  - Location: `frontend/src/App.tsx`, `frontend/src/pages/Deployments.tsx`, `frontend/src/components/deployment/ParameterForm.tsx`

#### Review

- The project is already beyond a demo: it can manage assets, connect to servers, execute remote deployments, stream logs, and support rollback/config apply workflows.
- The main unfinished areas remain end-to-end testing and production hardening, matching the roadmap and backlog.

### Automated Testing (Completed: 2026-03-02)

- [x] **Task 1**: Fix backend compilation errors
  - ✅ Fixed non-constant format string errors in deployment_hook_executor.go
  - ✅ All backend tests passing (2.089s)
  - Location: `backend/internal/api/deployment_hook_executor.go`

- [x] **Task 2**: Fix frontend test failures
  - ✅ Added localStorage mock to test setup
  - ✅ All 33 frontend tests passing (2.48s)
  - Location: `frontend/src/test/setup.ts`

- [x] **Task 3**: Verify frontend build
  - ✅ TypeScript compilation successful
  - ✅ Vite build successful (3.37s, 3743 modules)
  - ✅ Production bundle: 764 KB (gzipped)

- [x] **Task 4**: Documentation updates
  - ✅ Updated README.md roadmap (阶段 1-8 完成)
  - ✅ Updated CLAUDE.md development status (100% complete)
  - ✅ Created testing-guide.md with detailed test scenarios
  - ✅ Created test-results.md with automated test report

### Frontend Integration (Completed: 2026-03-02)

- [x] **Task 1**: Remove nginx_config deployment type from Deployments page
  - ✅ Removed nginx_config option from deployment type selector (line 510-511)
  - ✅ Only package and certificate types remain
  - Location: `frontend/src/pages/Deployments.tsx`

- [x] **Task 2**: Implement NginxConfig apply functionality
  - ✅ Created nginx API client methods (applyNginxConfig, getApplyHistory, getApplyDetail)
  - ✅ Created ApplyConfigModal component with server selection and options
  - ✅ Added "Apply Config" button to NginxConfig page
  - ✅ Added apply history tab to NginxConfig detail view
  - Location: `frontend/src/components/nginx/ApplyConfigModal.tsx`, `frontend/src/api/nginx.ts`

- [x] **Task 3**: Implement ParameterForm component
  - ✅ Created dynamic form generator based on metadata.json parameters
  - ✅ Supports string, number, boolean, select input types
  - ✅ Implemented validation rules (required, min/max, pattern, etc.)
  - ✅ Integrated into Deployments page create dialog (line 560-575)
  - Location: `frontend/src/components/deployment/ParameterForm.tsx`

- [x] **Task 4**: Real-time logs implementation
  - ✅ SSE streaming via GET /api/v1/deployments/:id/logs/stream
  - ✅ useDeploymentLogs hook with EventSource
  - ✅ Integrated into deployment detail pages

- [x] **Task 5**: Deployment cancellation
  - ✅ Backend context.Context cancellation
  - ✅ Frontend cancel button and API integration
  - ✅ Status updates (running → cancelled)
