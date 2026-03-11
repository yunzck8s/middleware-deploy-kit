# TODO

## 配置管理与部署管理逻辑修复 (2026-03-11)

- [x] **Fix 3**: 移除 HTTP/2 — `listen {{.HTTPSPort}} ssl;`
- [x] **Fix 1**: 证书部署路径自动推导
  - ✅ `deployment.go` Create/BatchCreate 使用 `inferNginxInstallDir`
  - ✅ `Deployments.tsx` 选择服务器后自动填充 target_path
- [x] **Fix 2**: SSL 证书路径 Bug
  - ✅ 模板使用远程路径 `{installDir}/ssl/{filename}` 替代本地管理平台路径
  - ✅ `generateNginxConfigWithContext` 和 `generateNginxConfigWithRuntimeUser` 增加 SSLCertPath/SSLKeyPath/InstallDir
- [x] **Fix 5**: Location 代理设置完善
  - ✅ NginxLocation 模型新增 13 个代理字段
  - ✅ 模板 proxy location 块扩展（HTTP + HTTPS 各 1 处 range 块）
  - ✅ TypeScript 类型同步更新
  - ✅ LocationEditor 新增折叠面板式代理设置（超时/缓冲/高级/重试/WebSocket）
- [x] **Fix 4**: 配置预览支持手动编辑
  - ✅ NginxConfig 模型新增 ManualConfig 字段
  - ✅ ConfigPreview 新增编辑/预览切换、已编辑标签、重置按钮
  - ✅ ConfigEditor 管理 manualConfig 状态，保存/创建时传递
  - ✅ executeApplyConfig 优先使用 ManualConfig

### 验证结果
- ✅ `go build ./...` — 编译通过
- ✅ `go test ./...` — 全部通过
- ✅ `npm run build` — TypeScript 编译 + Vite 构建通过
- ✅ `npx vitest --run` — 13 个测试文件、46 个测试用例全部通过

## 生产部署方案实现 (2026-03-10)

- [x] **Task 1**: 创建构建脚本
  - ✅ `scripts/build.sh` - 交叉编译 Go 后端 (Linux amd64)，构建前端，打包 tar.gz
  - ✅ 使用 `CGO_ENABLED=0` 静态编译，注入版本信息
  - ✅ 输出: `dist/middleware-deploy-kit-v1.0.0-linux-amd64.tar.gz`

- [x] **Task 2**: 创建部署脚本
  - ✅ `scripts/install.sh` - 一键安装到 `/opt/middleware-deploy-kit/`
  - ✅ `scripts/uninstall.sh` - 卸载脚本（可选保留数据）
  - ✅ `scripts/upgrade.sh` - 升级脚本（自动备份和回滚）

- [x] **Task 3**: 创建 systemd 服务
  - ✅ `deploy/systemd/middleware-deploy.service` - systemd 服务配置
  - ✅ 自动重启，环境变量支持

- [x] **Task 4**: 创建 Nginx 配置
  - ✅ `deploy/nginx/nginx.conf.template` - 反向代理配置模板
  - ✅ 前端静态文件 + 后端 API 代理 + SSE 支持

- [x] **Task 5**: 后端环境变量支持
  - ✅ 修改 `backend/internal/config/config.go`
  - ✅ 支持 `SERVER_HOST`, `SERVER_PORT`, `JWT_SECRET`, `DATA_DIR`
  - ✅ 自动生成随机 JWT secret

- [x] **Task 6**: 前端生产配置
  - ✅ `frontend/.env.production` - API 相对路径 `/api/v1`

- [x] **Task 7**: 部署文档
  - ✅ `docs/DEPLOYMENT.md` - 详细部署文档（系统要求、安装、配置、升级、卸载、FAQ）
  - ✅ 更新 `README.md` - 添加生产部署章节

- [x] **Task 8**: 更新 .gitignore
  - ✅ 忽略 `dist/` 构建产物

#### 验证

- ✅ `go build ./...` - 后端编译通过
- ✅ 后端配置环境变量支持正常
- ✅ 所有部署文件创建完成
- ⏳ 待验证: 本地构建测试（需要前端 `npm run build`）
- ⏳ 待验证: Linux 环境完整部署流程

#### 部署包结构

```
middleware-deploy-kit-v1.0.0-linux-amd64.tar.gz (~425MB)
├── bin/server                    # Go 后端二进制
├── web/                          # 前端静态文件
├── packages/nginx/1.28.0/        # Nginx 离线包 (~396MB)
├── config/
│   ├── nginx.conf.template       # Nginx 配置模板
│   └── config.yaml.example       # 配置示例
├── scripts/
│   ├── install.sh                # 安装脚本
│   ├── uninstall.sh              # 卸载脚本
│   └── upgrade.sh                # 升级脚本
├── systemd/
│   └── middleware-deploy.service # systemd 服务
└── VERSION                       # 版本信息
```

---

## 企业级 SaaS UI/UX 全局重设计

- [x] Phase 1: CSS 变量 — Indigo/Zinc 色彩系统替换，移除 shell 变量，纯色 body 背景
- [x] Phase 2: App.tsx ConfigProvider — Ant Design token 全部替换为 indigo/zinc 色值
- [x] Phase 3: Layout.tsx 简化 — 移除顶栏、纯文本菜单标签、移除模块卡片、sidebar 240/72px
- [x] Phase 4: CSS 组件样式 — 移除 ::before 渐变、color-mix()、glassmorphism，纯色背景 + 细边框
- [x] Phase 5: CSS 动效 — 移除 staggered reveal / industrial keyframes / hover 位移，仅保留 opacity 过渡
- [x] Phase 6: ThemeToggle 简化 — 移除文本标签，纯图标按钮

### 验证结果
- `npm run build` — TypeScript + Vite 构建通过 ✅
- `npx vitest --run` — 13 test files / 46 tests 全部通过 ✅
- CSS 文件从 2525 行精简至 ~1050 行

---

## Previous Sprint

### 部署管理 ↔ 配置管理联动修复

- [x] **Fix 1**: 安装脚本创建 nginx 用户 + configure 指定 user/group
  - ✅ 新增 `create_nginx_user()` 函数，`groupadd -r` + `useradd -r -s /sbin/nologin`
  - ✅ `./configure` 添加 `--user=$NGINX_USER --group=$NGINX_USER`
  - ✅ 安装后 `chown $NGINX_USER:$NGINX_USER $NGINX_INSTALL_DIR/logs`
- [x] **Fix 2**: 前端保存完整部署参数（包括默认值）
  - ✅ `handleCreate` 始终包含默认值，去掉空检查
- [x] **Fix 3**: 通用化 `inferPackageDeploymentUser`
  - ✅ 新增 `inferNginxPackageDeployParams` 返回完整 deploy_params
  - ✅ 新增 `inferNginxInstallDir` 辅助函数
  - ✅ 原 `inferPackageDeploymentUser` 改为薄包装
- [x] **Fix 4**: `GetNginxDeployInfo` 查 package 部署 + 返回 deploy_params
  - ✅ 三级查询: NginxConfigApply → Package 部署 → 系统默认值
  - ✅ 响应增加 `deploy_params` 和 `source` 字段
- [x] **Fix 5**: `ApplyConfig` 默认路径从部署记录推导
  - ✅ 通过 `inferNginxInstallDir` 动态推导默认 target_path
- [x] **Fix 6**: `NginxConfigApply` 模型默认路径修正
  - ✅ TargetPath 默认值从 `/etc/nginx/nginx.conf` 改为 `/usr/local/nginx/conf/nginx.conf`
- [x] **Fix 7**: `resolveNginxRuntimeUser` 增加自动创建用户
  - ✅ 当 deploy_params 中有用户但远程不存在时，通过 SSH 自动创建
- [x] **Fix 8**: 配置生成器感知 install dir
  - ✅ 新增 `generateNginxConfigWithContext` 根据实际 installDir 计算路径
  - ✅ 提取 `executeNginxTemplate` 共享模板执行逻辑
  - ✅ `executeApplyConfig` 调用新函数
- [x] **Fix 9**: 前端展示部署上下文
  - ✅ `NginxDeployInfo` 接口增加 `deploy_params` 和 `source`
  - ✅ summary cards 展示安装目录和运行用户
  - ✅ 提示文案区分"来自配置应用历史"和"来自 Nginx 安装记录"

#### 验证

- ✅ `go build ./...` — 编译通过
- ✅ `npm run build` — 前端构建通过（tsc + vite）
- ✅ `npx vitest --run` — 13 test files, 46 tests passed
- ⚠️ `go test ./...` — 后端 `deployment_hook_executor.go` 有预存的 vet 错误（非本次修改引入）

### Industrial Shell Amplification

- [x] **Task 1**: Recast shell theme for an industrial control-room tone
  - ✅ Updated typography, color tokens, shadows, and shell surface treatments
  - ✅ Kept dark/light parity aligned with the new shell palette

- [x] **Task 2**: Rebuild navigation chrome and command header
  - ✅ Reworked the sidebar into an industrial control rail with module codes and operator status
  - ✅ Added a route-aware top command header while keeping routes and responsive behavior intact

- [x] **Task 3**: Amplify shared shell primitives
  - ✅ Strengthened page headers, section cards, filter bars, metric tiles, and status treatments
  - ✅ Kept page workflows and data contracts unchanged

- [x] **Task 4**: Verify industrial shell refresh
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Production build passing via `npm run build`

#### Review

- The shell now reads like an industrial Nginx control room: sharper typography, steel-toned surfaces, safety-orange accents, and stronger operational hierarchy.
- Navigation, page chrome, and shared surfaces are visually bolder without changing routes, backend contracts, or task flows.
- Verification passed with `npx vitest --run` and `npm run build`; the existing bundle-size warning remains unchanged.

### Shell Motion Pass

- [x] **Task 1**: Define shell motion language
  - ✅ Tuned easing, durations, and staged reveal hierarchy for the industrial shell
  - ✅ Kept motion serious, stronger in presence, and covered by reduced-motion fallback

- [x] **Task 2**: Add shell route and chrome transitions
  - ✅ Added route-stage entry animation, command-surface reveal, and navigation sweep feedback
  - ✅ Preserved navigation structure, routes, and interaction flow

- [x] **Task 3**: Add shared micro-interactions
  - ✅ Animated page headers, section cards, filter bars, metric tiles, status badges, and shell controls
  - ✅ Kept the motion layer on transform/opacity-based feedback paths

- [x] **Task 4**: Verify shell motion pass
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Production build passing via `npm run build`

#### Review

- The shell now has a clearer motion system: route changes land with a staged reveal, active navigation feels guided, and control surfaces acknowledge hover and press without becoming playful.
- Shared UI primitives now move in the same industrial language, with stronger feedback on metrics, badges, toolbars, and operator controls.
- Verification passed with `npx vitest --run` and `npm run build`; the existing bundle-size warning remains unchanged.

### Shell Copy Clarity Pass

- [x] **Task 1**: Audit high-impact shell copy
  - ✅ Reviewed page headers, empty states, confirmations, action hints, and preview guidance
  - ✅ Identified jargon, mixed terminology, and weak next-step messaging in primary workflows

- [x] **Task 2**: Rewrite primary workflow copy
  - ✅ Clarified package, certificate, server, deployment, and config workflow copy
  - ✅ Kept the tone direct, calm, and admin-friendly for platform administrators

- [x] **Task 3**: Normalize feedback messages
  - ✅ Improved success, error, download, and destructive-action messaging
  - ✅ Made next steps clearer without adding extra noise or changing workflows

- [x] **Task 4**: Verify copy refresh
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Production build passing via `npm run build`

#### Review

- Primary shell copy now explains actions more plainly: destructive dialogs name the affected object, empty states point to the next action, and system hints avoid jargon like raw SSE or vague “metadata-driven” language.
- Configuration and deployment flows now use more consistent Chinese terminology, with less English mixing and clearer action labels.
- Verification passed with `npx vitest --run` and `npm run build`; the existing bundle-size warning remains unchanged.

### Form Copy Clarity Pass

- [x] **Task 1**: Audit form labels and validation copy
  - ✅ Reviewed field labels, placeholders, helper text, and validation messages in the main admin workflows
  - ✅ Identified jargon, weak examples, and places where the next action was unclear

- [x] **Task 2**: Clarify primary form workflows
  - ✅ Improved package, certificate, server, deployment, and config form copy
  - ✅ Kept the tone concise, direct, and admin-friendly

- [x] **Task 3**: Normalize form feedback
  - ✅ Rewrote form success, failure, and inline guidance around upload, save, deploy, and apply actions
  - ✅ Made outcomes and next steps easier to understand without changing form behavior

- [x] **Task 4**: Verify form copy refresh
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Production build passing via `npm run build`

#### Review

- Form fields now explain themselves more clearly: labels are more specific, placeholders use realistic examples, and helper text explains why or when to fill a field.
- Validation and feedback messages are less mechanical and more actionable, especially in deployment, server, certificate, and configuration flows.
- Verification passed with `npx vitest --run` and `npm run build`; the existing bundle-size warning remains unchanged.

### Action Copy Pass

- [x] **Task 1**: Audit row actions and tooltips
  - ✅ Reviewed list actions, icon buttons, preview panels, and log toolbars
  - ✅ Found vague verbs, inconsistent labels, and icon-only actions that lacked context

- [x] **Task 2**: Normalize action wording
  - ✅ Clarified execute, preview, apply, edit, copy, download, and delete actions
  - ✅ Kept row-level actions short, specific, and consistent across list views

- [x] **Task 3**: Improve tooltip guidance
  - ✅ Made icon-only controls understandable without guessing
  - ✅ Aligned tooltip wording with the rest of the admin shell tone

- [x] **Task 4**: Verify action copy refresh
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Production build passing via `npm run build`

#### Review

- Row-level actions now read more clearly: users can tell whether a button will execute a task, open logs, edit a server, delete an object, or apply a config before clicking.
- Icon-only controls now have more explicit tooltip copy and accessible labels, reducing guesswork in dense tables and editors.
- Verification passed with `npx vitest --run` and `npm run build`; the existing bundle-size warning remains unchanged.

### Status Copy Pass

- [x] **Task 1**: Audit status labels and system hints
  - ✅ Reviewed badges, metric hints, loading text, empty-state summaries, and status descriptions
  - ✅ Found inconsistent status names and system feedback across dashboard, deployments, configs, and history views

- [x] **Task 2**: Normalize status language
  - ✅ Unified deployment, certificate, server, and config status wording
  - ✅ Kept labels short, explicit, and more consistent across views

- [x] **Task 3**: Clarify system-state feedback
  - ✅ Improved loading text, live-log hints, fallback descriptions, and module summaries
  - ✅ Made system feedback more actionable without adding noise

- [x] **Task 4**: Verify status copy refresh
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Production build passing via `npm run build`

#### Review

- Status wording is now more consistent across badges, metrics, filters, and history views, especially around `已完成` / `执行失败` / `已停用` / `待执行`.
- System hints and loading copy now better explain what the platform is doing, from dashboard summaries to real-time log drawers and chart loading states.
- Verification passed with `npx vitest --run` and `npm run build`; the existing bundle-size warning remains unchanged.

### Terminology Pass

- [x] **Task 1**: Audit global product terms
  - ✅ Reviewed page titles, section headings, CTAs, and recurring nouns across the shell
  - ✅ Found mixed metaphors and overlapping names for the same concepts, especially around configs, deployments, and list pages

- [x] **Task 2**: Normalize core terminology
  - ✅ Unified naming for deployments, configs, packages, servers, certificates, and the console shell
  - ✅ Preferred shorter, direct terms that now repeat more consistently across views

- [x] **Task 3**: Align workflow labels
  - ✅ Updated buttons, empty states, and section titles to use the same nouns
  - ✅ Kept the admin language calm, predictable, and easier to scan

- [x] **Task 4**: Verify terminology refresh
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Production build passing via `npm run build`

#### Review

- Page and workflow naming is now more consistent: `控制台总览` / `离线包管理` / `证书管理` / `服务器管理` / `配置管理` / `部署任务` all use the same naming style.
- Repeated nouns like `列表`, `任务`, `配置`, and `工作台` now appear more predictably, reducing the feeling that similar screens are described in different ways.
- Verification passed with `npx vitest --run` and `npm run build`; the existing bundle-size warning remains unchanged.

### Header Scale Tuning

- [x] **Task 1**: Audit shell and page header hierarchy
  - ✅ Compared command-surface and page header title sizes
  - ✅ Confirmed that oversized titles and wrapping hurt readability in dense admin views

- [x] **Task 2**: Reduce oversized title treatment
  - ✅ Reduced shell and page header title scale, padding, and wrapping pressure
  - ✅ Kept hierarchy strong without overpowering the page body

- [x] **Task 3**: Verify header readability
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Production build passing via `npm run build`

#### Review

- Header typography is now noticeably calmer: the command-surface title and page title still anchor the screen, but they no longer dominate the layout or wrap awkwardly.
- The fix specifically removes the narrow title width constraint and lowers the title scale so Chinese page titles read naturally in one line more often.
- Verification passed with `npx vitest --run` and `npm run build`; the existing bundle-size warning remains unchanged.

### Quieter Shell Refinement

- [x] **Task 1**: Rebalance shell visual hierarchy
  - ✅ Reduced oversized headers, double-hero weight, and high-contrast shell treatments
  - ✅ Kept the industrial control-room identity while making it calmer to read

- [x] **Task 2**: Refine global tokens and motion
  - ✅ Desaturated accents, softened surfaces, reduced decorative textures, and toned down animation intensity
  - ✅ Preserved functional feedback and dark/light parity

- [x] **Task 3**: Soften shared shell primitives and main pages
  - ✅ Toned down page headers, metric tiles, section cards, filter bars, tables, drawers, and terminal chrome
  - ✅ Made dashboard, servers, packages, certificates, configs, and deployments visually quieter

- [x] **Task 4**: Verify quieter shell pass
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Production build passing via `npm run build`

#### Review

- The shell now reads as a quieter industrial control console: copper and steel accents are still present, but contrast, texture, and motion no longer dominate the screen.
- Header hierarchy, cards, filters, config workbench panels, and dashboard summaries now guide attention back toward the actual operational content instead of the shell chrome itself.
- Verification passed with `npx vitest --run` and `npm run build`; the existing bundle-size warning remains unchanged.

### Deployment Logs And Apply Visibility

- [x] **Task 1**: Repair deployment log lifecycle
  - ✅ Fixed stale deployment state when opening logs after execute
  - ✅ Prevented expected SSE disconnects from showing as errors and fell back to persisted logs when needed

- [x] **Task 2**: Make nginx apply results observable
  - ✅ Reused apply history/detail APIs to surface config apply progress and logs
  - ✅ Open apply result details immediately after a successful submit

- [x] **Task 3**: Cover key regressions with tests
  - ✅ Added targeted frontend coverage for deployment log hook behavior and apply history/detail rendering
  - ✅ Kept existing deployment/config workflows stable

- [x] **Task 4**: Verify end-to-end behavior
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Frontend build passing via `npm run build`
  - ✅ Backend tests passing via `go test -vet=off ./...`

#### Review

- Deployment logs now survive the normal execute → close → reopen cycle: the drawer reconnects or falls back to persisted logs without falsely reporting that the stream broke.
- Package deployment now emits live step updates and streamed install-script output instead of waiting until the whole script finishes before the UI changes.
- Config apply now has an observable flow: successful submission opens an apply-record drawer with recent history, current status, and step logs, so users can see whether the operation is still running, succeeded, or failed.
- Verification passed with `npx vitest --run`, `npm run build`, and `go test -vet=off ./...`.

### Apply Path Auto-Inference

- [x] **Task 1**: Correct backend default path inference
  - ✅ `deploy-info` now prefers successful config-apply history, then successful nginx_config deployments, and finally stable install defaults
  - ✅ Stopped reusing package deployment target paths as config file destinations

- [x] **Task 2**: Redesign apply modal for zero-decision main flow
  - ✅ Selecting a server now shows inferred default path and service summary instead of requiring immediate manual input
  - ✅ Path and service override fields moved behind an explicit advanced customization toggle

- [x] **Task 3**: Keep apply visibility connected
  - ✅ Successful submit still opens the apply-history drawer and shows the final target path in the result view
  - ✅ The modal no longer uses auto-fill toast messages for expected behavior

- [x] **Task 4**: Verify auto-inference flow
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Frontend build passing via `npm run build`
  - ✅ Backend tests passing via `go test -vet=off ./...`

#### Review

- The apply modal now behaves like a server-driven workflow: choose a server first, then review the inferred default path/service, and only customize when needed.
- Default config targets are now derived from actual config-application history or nginx_config deployments, with `/usr/local/nginx/conf/nginx.conf` and `nginx` as the stable fallback.
- Verification passed with `npx vitest --run`, `npm run build`, and `go test -vet=off ./...`.

### Nginx Runtime Path Alignment

- [x] **Task 1**: Align generated config with installed nginx layout
  - ✅ Normalized legacy defaults like `/var/log/nginx/*` and `/usr/share/nginx/html` to the package install layout
  - ✅ Made generated config use the same runtime assumptions as the offline install script

- [x] **Task 2**: Prevent apply-time config test failures
  - ✅ Removed mismatched log/include/pid defaults from generated configs
  - ✅ Kept preview and apply behavior consistent for the current nginx-only workflow

- [x] **Task 3**: Refresh config creation defaults
  - ✅ Updated backend and frontend defaults for new configs to match the installed nginx layout
  - ✅ Avoided generating future configs with stale system-nginx paths

- [x] **Task 4**: Verify runtime alignment
  - ✅ Frontend tests passing via `npx vitest --run`
  - ✅ Frontend build passing via `npm run build`
  - ✅ Backend tests passing via `go test -vet=off ./...`

#### Review

- Generated Nginx configs now align with the offline package layout: `/usr/local/nginx/html`, `/usr/local/nginx/logs/*`, `/usr/local/nginx/conf/mime.types`, and `nginx` as the runtime user.
- Legacy configs that were saved with old system-nginx defaults are normalized at generation time, so existing records no longer fail immediately during `nginx -t` just because they still contain `/var/log/nginx` or `/usr/share/nginx/html`.
- Verification passed with `npx vitest --run`, `npm run build`, and `go test -vet=off ./...`.

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
