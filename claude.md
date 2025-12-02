# 中间件离线部署管理平台 - 剩余开发任务

## 📋 当前开发进度总结

### ✅ 已完成的三大需求（后端部分）

#### 需求1: Nginx 部署路径参数化 ✅
**目标**: 让 Nginx 部署脚本中的路径可以由前端动态传入，避免硬编码

**后端完成**:
- ✅ 添加 `BUILD_REPO_DIR` 参数到 `packages/nginx/1.28.0/metadata.json`
- ✅ 修改 `auto_install_nginx.sh` 第68行使用环境变量 `${BUILD_REPO_DIR:-/data/buildrepo}`
- ✅ PackageMetadata API 支持读取参数定义
- ✅ Deployment.deploy_params 字段支持 JSON 参数
- ✅ 后端环境变量注入机制已实现

**前端待完成**:
- ❌ ParameterForm 组件（动态表单生成）
- ❌ 集成到 Deployments 页面的创建对话框
- ❌ 参数验证逻辑

---

#### 需求2: 部署类型 UX 重构 ✅ (后端完成)
**目标**: 将 nginx_config 从部署任务中分离，改为在 NginxConfig 页面直接应用配置

**后端完成**:
- ✅ 创建 `NginxConfigApply` 和 `NginxConfigApplyLog` 数据模型
  - 位置: `backend/internal/models/nginx_config_apply.go`
  - 包含应用记录、日志、状态追踪

- ✅ 实现 Nginx 配置应用 API
  - `POST /api/v1/nginx/:id/apply` - 应用配置到服务器
  - `GET /api/v1/nginx/:id/apply-history` - 获取应用历史
  - `GET /api/v1/nginx/applies/:id` - 获取应用详情
  - 位置: `backend/internal/api/nginx.go:480-829`

- ✅ executeApplyConfig 执行流程
  1. 生成 Nginx 配置文件
  2. 连接目标服务器 (SSH + SFTP)
  3. 备份原配置文件（可选）
  4. 上传新配置文件
  5. 执行 `nginx -t` 测试
  6. 重启 Nginx 服务（可选）
  7. 完整日志记录

- ✅ 数据库表创建
  - `nginx_config_applies` - 配置应用记录表
  - `nginx_config_apply_logs` - 配置应用日志表

**前端待完成**:
- ❌ 从 Deployments 页面移除 nginx_config 选项
- ❌ NginxConfig 页面添加"应用配置"按钮
- ❌ 创建 ApplyConfigModal 组件（选择服务器、配置选项）
- ❌ 应用历史和日志查看功能

---

#### 需求3: 实时日志和取消部署 ✅ (全部完成)
**目标**: 实时显示部署日志，支持取消正在执行的部署任务

**后端完成**:
- ✅ 部署管理器结构 (deploymentManager)
  - 位置: `backend/internal/api/deployment.go:50-77`
  - 使用 sync.RWMutex 管理运行中的部署
  - 每个部署包含 context、cancel、logChan、done

- ✅ SSE StreamLogs 接口
  - `GET /api/v1/deployments/:id/logs/stream`
  - Server-Sent Events 实时推送日志
  - 先发送历史日志，再推送新日志
  - 位置: `backend/internal/api/deployment.go:306-382`

- ✅ Cancel 接口
  - `POST /api/v1/deployments/:id/cancel`
  - 通过 context.Cancel() 优雅停止
  - 等待当前步骤完成后终止
  - 位置: `backend/internal/api/deployment.go:384-403`

- ✅ executeDeploymentWithContext 重构
  - 支持 Context 取消信号
  - 每个步骤之间检查取消状态
  - 位置: `backend/internal/api/deployment.go:1155-1526`

**前端完成**:
- ✅ useDeploymentLogs Hook
  - 位置: `frontend/src/hooks/useDeploymentLogs.ts`
  - 自动连接 SSE，增量更新日志
  - 监听 'log' 和 'done' 事件

- ✅ cancelDeployment API
  - 位置: `frontend/src/api/deployment.ts:74-77`

- ✅ Deployments 页面集成
  - 位置: `frontend/src/pages/Deployments.tsx`
  - 实时日志显示（蓝色状态提示）
  - 取消按钮（仅 running 状态显示）
  - 历史日志查看（completed 状态）

---

## 🔥 剩余核心任务（按优先级排序）

### 🎯 高优先级 - 前端集成任务

#### 任务 1: 需求2 - 前端移除 nginx_config 部署类型
**文件**: `frontend/src/pages/Deployments.tsx`

**修改内容**:
```typescript
// 1. 移除 deployType 的 nginx_config 选项 (约540行)
<Form.Item name="type" label="部署类型">
  <Select onChange={(val) => setDeployType(val)}>
    {/* 删除这一行 */}
    {/* <Option value="nginx_config">Nginx 配置</Option> */}
    <Option value="package">离线包</Option>
    <Option value="certificate">证书</Option>
  </Select>
</Form.Item>

// 2. 移除 nginx_config 分支逻辑 (约540-554行)
{/* 删除整个 deployType === 'nginx_config' 的条件渲染 */}
{deployType === 'nginx_config' && (
  <Form.Item name="nginx_config_id" ...>
    ...
  </Form.Item>
)}
```

**预期结果**:
- Deployments 页面只能创建 package 和 certificate 类型的部署
- nginx_config 部署移到 NginxConfig 页面管理

---

#### 任务 2: 需求2 - NginxConfig 页面添加应用配置功能
**文件**: `frontend/src/pages/NginxConfig.tsx`

**需要添加的功能**:

1. **添加"应用配置"按钮到操作列**
```typescript
// 在 columns 的 action 列中添加
<Button
  type="primary"
  size="small"
  icon={<DeploymentUnitOutlined />}
  onClick={() => handleApplyConfig(record)}
>
  应用配置
</Button>
```

2. **创建 nginx API 客户端**
   - 文件: `frontend/src/api/nginx.ts`
   - 添加以下方法:
```typescript
// 应用配置到服务器
export const applyNginxConfig = async (
  id: number,
  data: {
    server_id: number;
    target_path?: string;
    backup_enabled?: boolean;
    restart_service?: boolean;
    service_name?: string;
  }
): Promise<any> => {
  const response = await client.post(`/nginx/${id}/apply`, data);
  return response.data.data;
};

// 获取应用历史
export const getApplyHistory = async (id: number, params?: any): Promise<any> => {
  const response = await client.get(`/nginx/${id}/apply-history`, { params });
  return response.data.data;
};

// 获取应用详情
export const getApplyDetail = async (applyId: number): Promise<any> => {
  const response = await client.get(`/nginx/applies/${applyId}`);
  return response.data.data;
};
```

3. **创建 ApplyConfigModal 组件**
   - 文件: `frontend/src/components/nginx/ApplyConfigModal.tsx`
   - 功能:
     - 选择目标服务器（下拉框）
     - 配置目标路径（默认 `/etc/nginx/nginx.conf`）
     - 是否备份原配置（Switch，默认 true）
     - 是否重启服务（Switch，默认 true）
     - 服务名称（Input，默认 `nginx`）
     - 提交后调用 `applyNginxConfig` API

4. **添加应用历史查看**
   - 在 NginxConfig 详情页面添加"应用历史"Tab
   - 显示应用记录列表（时间、服务器、状态、耗时）
   - 点击记录查看详细日志（类似部署日志）

---

#### 任务 3: 需求1 - 前端参数化表单生成
**文件**: `frontend/src/components/deployment/ParameterForm.tsx` (新建)

**功能需求**:
```typescript
interface ParameterFormProps {
  parameters: PackageParameter[];
  form: FormInstance;
}

// 组件需要根据 parameter.type 渲染不同控件：
// - string → Input
// - number → InputNumber (支持 min/max)
// - boolean → Switch
// - select → Select (带 options)

// 应用验证规则：
// - required: Form.Item rules
// - min/max: InputNumber props
// - min_len/max_len: Input maxLength
// - pattern: Form.Item rules (正则)

// 示例：
<Form.Item
  name={param.name}
  label={param.label}
  tooltip={param.description}
  rules={[
    { required: param.required, message: `请输入${param.label}` },
    { pattern: param.validation?.pattern, message: param.validation?.message }
  ]}
  initialValue={param.default}
>
  {param.type === 'number' ? (
    <InputNumber
      min={param.validation?.min}
      max={param.validation?.max}
      placeholder={param.placeholder}
    />
  ) : param.type === 'boolean' ? (
    <Switch />
  ) : param.type === 'select' ? (
    <Select options={param.options} />
  ) : (
    <Input
      maxLength={param.validation?.max_len}
      placeholder={param.placeholder}
    />
  )}
</Form.Item>
```

**集成到 Deployments 页面**:
```typescript
// 在创建部署对话框中：
// 1. 当选择 package 类型时，监听 package_id 变化
// 2. 调用 getPackageMetadata(packageId)
// 3. 如果返回 metadata 且有 parameters，渲染 ParameterForm
// 4. 提交时将表单值序列化为 JSON 字符串，作为 deploy_params 字段
```

---

### 🧪 测试任务

#### 任务 4: 需求3 - 测试实时日志和取消功能
**测试步骤**:
1. 创建一个 package 类型的部署任务（nginx 离线包）
2. 点击"执行"，观察日志弹窗
   - 验证：显示蓝色"实时日志"提示
   - 验证：日志实时更新（无需刷新）
   - 验证：显示"取消部署"按钮
3. 点击"取消部署"
   - 验证：提示"正在取消，请等待当前步骤完成"
   - 验证：部署在当前步骤完成后停止
   - 验证：状态变为 `cancelled`
4. 关闭日志弹窗后重新打开
   - 验证：显示"刷新"按钮（非 running 状态）
   - 验证：历史日志正常显示

---

#### 任务 5: 需求1 - 测试路径参数化部署
**测试步骤**:
1. 上传 nginx 离线包（packages/nginx/1.28.0.zip）
2. 创建部署任务，选择该离线包
3. 验证：显示参数配置表单（7个参数）
   - Nginx 安装目录
   - HTTP 端口
   - HTTPS 端口
   - Worker 进程数
   - Worker 连接数
   - 错误日志路径
   - 构建仓库目录
4. 修改参数（如端口改为 8080，安装目录改为 `/opt/nginx`）
5. 提交并执行部署
6. 查看部署日志，验证参数是否正确传递
   - 检查日志中是否显示自定义参数
   - SSH 到目标服务器检查实际安装路径

---

#### 任务 6: 需求2 - 测试 Nginx 配置应用流程
**测试步骤**:
1. 在 NginxConfig 页面创建一个配置
2. 点击"应用配置"按钮
3. 选择目标服务器，配置选项
4. 提交应用
5. 验证：
   - 配置文件成功上传到服务器
   - 原配置已备份（如果启用）
   - nginx -t 测试通过
   - 服务成功重启（如果启用）
   - 应用日志完整记录
6. 查看应用历史
   - 验证：显示应用记录列表
   - 验证：可以查看每次应用的详细日志

---

## 📁 文件清单

### 需要创建的新文件
```
frontend/src/
├── components/
│   ├── nginx/
│   │   └── ApplyConfigModal.tsx          # Nginx 配置应用弹窗
│   └── deployment/
│       └── ParameterForm.tsx             # 参数化表单组件
└── api/
    └── nginx.ts                          # Nginx API 客户端（需扩展）
```

### 需要修改的现有文件
```
frontend/src/
├── pages/
│   ├── Deployments.tsx                   # 移除 nginx_config 选项 + 集成 ParameterForm
│   └── NginxConfig.tsx                   # 添加应用配置功能
└── types/
    └── index.ts                          # 添加 NginxConfigApply 类型定义
```

---

## 🎯 完成标准

### 需求1 完成标准
- [x] 后端：metadata API 工作正常
- [x] 后端：环境变量注入机制完成
- [x] 脚本：所有脚本改用环境变量
- [ ] 前端：ParameterForm 组件完成
- [ ] 前端：集成到 Deployments 页面
- [ ] 测试：参数化部署成功，参数正确生效

### 需求2 完成标准
- [x] 后端：NginxConfigApply API 全部完成
- [x] 后端：executeApplyConfig 执行流程完成
- [x] 数据库：新表创建并迁移成功
- [ ] 前端：Deployments 页面移除 nginx_config
- [ ] 前端：NginxConfig 页面添加应用功能
- [ ] 前端：ApplyConfigModal 组件完成
- [ ] 测试：配置应用流程全部通过

### 需求3 完成标准
- [x] 后端：SSE StreamLogs 接口完成
- [x] 后端：Cancel 接口完成
- [x] 后端：Context 取消机制完成
- [x] 前端：useDeploymentLogs Hook 完成
- [x] 前端：Deployments 页面集成完成
- [x] 测试：实时日志工作正常
- [x] 测试：取消部署功能正常

---

## 🚀 后端服务状态

### 当前运行状态
- ✅ 后端服务器: `http://localhost:8080`
- ✅ 前端开发服务器: `http://localhost:5173`
- ✅ 数据库: SQLite (`backend/cmd/server/data/app.db`)
- ✅ 所有新API已注册并就绪

### 新增的API端点
```
POST   /api/v1/nginx/:id/apply              - 应用 Nginx 配置
GET    /api/v1/nginx/:id/apply-history      - 获取应用历史
GET    /api/v1/nginx/applies/:id            - 获取应用详情
POST   /api/v1/deployments/:id/cancel       - 取消部署任务
GET    /api/v1/deployments/:id/logs/stream  - SSE 实时日志流
```

### 数据库新增表
```sql
-- Nginx 配置应用记录
CREATE TABLE nginx_config_applies (
    id                INTEGER PRIMARY KEY,
    nginx_config_id   INTEGER NOT NULL,
    server_id         INTEGER NOT NULL,
    target_path       TEXT DEFAULT '/etc/nginx/nginx.conf',
    backup_enabled    BOOLEAN DEFAULT true,
    backup_path       TEXT,
    restart_service   BOOLEAN DEFAULT true,
    service_name      TEXT DEFAULT 'nginx',
    status            TEXT DEFAULT 'pending',
    start_time        DATETIME,
    end_time          DATETIME,
    duration          INTEGER,
    error_msg         TEXT,
    created_at        DATETIME,
    updated_at        DATETIME,
    deleted_at        DATETIME
);

-- Nginx 配置应用日志
CREATE TABLE nginx_config_apply_logs (
    id         INTEGER PRIMARY KEY,
    apply_id   INTEGER NOT NULL,
    step       INTEGER,
    action     TEXT NOT NULL,
    status     TEXT DEFAULT 'pending',
    output     TEXT,
    error_msg  TEXT,
    created_at DATETIME,
    updated_at DATETIME
);
```

---

## 📝 开发注意事项

### TypeScript 类型定义
需要在 `frontend/src/types/index.ts` 添加：

```typescript
// Nginx 配置应用类型
export interface NginxConfigApply {
  id: number;
  nginx_config_id: number;
  server_id: number;
  target_path: string;
  backup_enabled: boolean;
  backup_path?: string;
  restart_service: boolean;
  service_name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  start_time?: string;
  end_time?: string;
  duration: number;
  error_msg?: string;
  created_at: string;
  nginx_config?: NginxConfig;
  server?: Server;
  logs?: NginxConfigApplyLog[];
}

export interface NginxConfigApplyLog {
  id: number;
  apply_id: number;
  step: number;
  action: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  output?: string;
  error_msg?: string;
  created_at: string;
}
```

### API 响应格式
所有 API 响应格式保持一致：
```typescript
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}
```

### 错误处理
前端需要统一错误处理：
```typescript
try {
  const result = await applyNginxConfig(id, data);
  message.success('配置应用任务已创建');
} catch (error: any) {
  message.error(error.message || '应用配置失败');
}
```

---

## 🎓 技术要点

### SSE (Server-Sent Events)
- 单向推送，适合实时日志场景
- 浏览器自动重连（网络中断后）
- 事件格式：`event: log\ndata: {...}\n\n`
- 前端使用 EventSource API

### Context 取消机制
- 使用 Go 的 context.Context
- 通过 channel 传递取消信号
- 在每个步骤之间检查 `ctx.Done()`
- 优雅停止，不强制中断

### 参数化部署流程
```
metadata.json → API → 前端表单 → JSON 序列化 → deploy_params
                                                      ↓
环境变量 ← 后端解析 ← Deployment.deploy_params
    ↓
${VAR:-default} ← Bash 脚本读取
```

---

## 📅 估算工时

| 任务 | 预估时间 | 优先级 |
|------|---------|--------|
| 任务1: 移除 nginx_config 选项 | 15 分钟 | P0 |
| 任务2: NginxConfig 应用功能 | 2-3 小时 | P0 |
| 任务3: ParameterForm 组件 | 2-3 小时 | P0 |
| 任务4: 测试实时日志和取消 | 30 分钟 | P1 |
| 任务5: 测试参数化部署 | 30 分钟 | P1 |
| 任务6: 测试配置应用流程 | 30 分钟 | P1 |

**总计**: 约 6-8 小时

---

## ✅ 成功标准

### 功能完整性
- [ ] 所有 API 调用成功，无报错
- [ ] 前端页面正常渲染，无 TypeScript 错误
- [ ] 实时日志流畅显示，无延迟或卡顿
- [ ] 取消部署立即生效，状态正确更新
- [ ] 参数化表单根据 metadata 动态生成
- [ ] Nginx 配置应用流程完整可用

### 用户体验
- [ ] 操作流程直观，符合业务逻辑
- [ ] 错误提示清晰，便于理解
- [ ] 加载状态明确，无悬浮等待
- [ ] 表单验证及时，防止无效输入

### 代码质量
- [ ] 遵循现有代码风格
- [ ] 类型定义完整，无 any 滥用
- [ ] 错误处理健全，不会崩溃
- [ ] 组件可复用，逻辑清晰

---

**最后更新**: 2025-12-01
**当前状态**: 后端 100% 完成，前端 0% 完成
**下一步**: 开始前端集成开发
