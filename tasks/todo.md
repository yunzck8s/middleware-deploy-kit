# TODO

## Current Sprint

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
