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
- 2026-03-09: User pointed out that shell/page titles became oversized in the admin UI. Keep operational headers visually strong, but cap title scale so it does not wrap aggressively or overpower the page body.
- 2026-03-09: For long-running drawers, do not rely on the clicked table row object as the live source of truth. Rehydrate current status from detail APIs or explicit optimistic state before deciding whether to open an SSE stream.
- 2026-03-09: Hooks that manage `EventSource` or similar live connections must distinguish expected close (unmount/manual/done) from real transport failure; otherwise normal UI flows surface false disconnect errors.
- 2026-03-09: Browser `EventSource` requests cannot send the Axios `Authorization` header. Any SSE endpoint protected by JWT must explicitly accept a query token (or another EventSource-compatible auth mechanism), otherwise the UI will surface false “日志连接中断” errors even when the frontend flow is correct.
- 2026-03-09: For live task drawers, persisting logs to the database is not enough. Any backend helper that writes step logs during execution must also emit those updates into the active runtime stream, otherwise the UI appears frozen until the drawer is reopened and history is reloaded.
- 2026-03-09: For config-application workflows, do not reuse package deployment target paths as configuration file destinations. Package deployments often point at upload/extract directories like `/tmp`, so config-apply defaults must come from config-apply history, nginx_config deployments, or stable install conventions.
- 2026-03-09: When a product ships its own offline Nginx layout, config generation must not inherit generic system-nginx defaults like `/var/log/nginx/*` or `/usr/share/nginx/html`. Normalize legacy saved values at render/apply time as well, otherwise old configs keep failing even after defaults are fixed.
- 2026-03-09: For config-application user directives, do not blindly switch templates to `user nginx;`. First inspect the target server's current nginx.conf, then fall back to recorded deployment parameters or verified runtime conventions; otherwise `nginx -t` fails on hosts that never created an `nginx` system user.
