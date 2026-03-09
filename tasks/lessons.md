# Lessons Learned

## Patterns to Follow

### Backend Development
- Always add new models to `db.AutoMigrate()` in `internal/db/db.go`
- Use standardized response format via `pkg/response/response.go`
- Implement context cancellation for long-running operations
- Use SSE for real-time log streaming (not WebSocket)

### Frontend Development
- API client response interceptor unwraps `response.data` automatically
- Store auth token in localStorage, attach via Axios interceptor
- Use Vitest with `--run` flag for CI (avoid watch mode)
- All TypeScript types go in `src/types/index.ts`
- Use Ant Design 6 components consistently

### Deployment Flow
- Parameters flow: metadata.json → API → frontend form → deploy_params JSON → env vars → shell script
- Shell scripts use `${VAR:-default}` pattern for environment variables
- Always validate parameters on both frontend and backend

## Mistakes to Avoid


### Sectioned Forms
- ❌ Don't rely on `form.validateFields()` without mounted fields when actions can be triggered from a preview-only section.
- ✅ For multi-section Ant Design forms, read persisted values with `form.getFieldsValue(true)` and manually guard required fields before preview/save.

### Testing
- ❌ Don't use `npm run test` in CI (starts watch mode)
- ✅ Use `npx vitest --run` instead

### Architecture
- ❌ Don't hardcode paths in deployment scripts
- ✅ Use parameterized metadata.json with environment variable injection

### Code Quality
- ❌ Don't mix deployment types (nginx_config should be separate from package deployment)
- ✅ Keep concerns separated (config application vs package deployment)

## User Corrections

<!-- Log any corrections received from users here -->

- 2026-03-09: User found that refreshing Nginx config preview during creation failed because preview/save only validated mounted section fields. Fixed by collecting persisted form values and explicitly guarding required fields.
