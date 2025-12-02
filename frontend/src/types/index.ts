// 用户类型
export interface User {
  id: number;
  username: string;
  created_at: string;
  updated_at: string;
}

// API 响应类型
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  timestamp: string;
}

// 分页参数
export interface PaginationParams {
  page: number;
  page_size: number;
}

// 分页响应
export interface PaginationResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// 中间件离线包
export interface MiddlewarePackage {
  id: number;
  name: string;                    // nginx, redis, openssh
  version: string;                 // 版本号
  display_name: string;            // 显示名称
  description: string;             // 描述
  file_name: string;               // 原始文件名
  file_path: string;               // 存储路径
  file_size: number;               // 文件大小（字节）
  file_hash: string;               // SHA256 哈希
  os_type: string;                 // rocky, centos, openEuler
  os_version: string;              // 9.4, 7.9
  status: 'active' | 'deleted';    // 状态
  uploaded_at: string;             // 上传时间
  metadata?: string;               // JSON 扩展元数据
  created_at: string;
  updated_at: string;
}

// SSL 证书
export interface Certificate {
  id: number;
  name: string;                           // 证书名称
  domain: string;                         // 域名
  cert_file_path: string;                 // .crt 文件路径
  key_file_path: string;                  // .key 文件路径
  valid_from: string;                     // 有效期开始
  valid_until: string;                    // 有效期结束
  issuer: string;                         // 颁发者
  subject: string;                        // 主题
  status: 'active' | 'expired' | 'deleted';  // 状态
  created_at: string;
  updated_at: string;
}

// 服务器
export interface Server {
  id: number;
  name: string;                                    // 服务器名称
  host: string;                                    // 主机地址
  port: number;                                    // SSH 端口
  username: string;                                // SSH 用户名
  auth_type: 'password' | 'key';                   // 认证方式
  os_type: string;                                 // 操作系统类型
  os_version: string;                              // 操作系统版本
  description: string;                             // 描述
  tags: string;                                    // 标签（JSON）
  status: 'online' | 'offline' | 'unknown';        // 状态
  last_check_at: string | null;                    // 最后检查时间
  last_check_msg: string;                          // 最后检查消息
  created_at: string;
  updated_at: string;
}

// SSH 连接测试结果
export interface SSHTestResult {
  success: boolean;
  message: string;
  latency_ms: number;
  os_info: string;
  os_type?: string;
  os_version?: string;
  server?: Server;
}

// Nginx Location 配置
export interface NginxLocation {
  id?: number;
  path: string;                    // 路径，如 /、/api、/static
  match_type?: string;             // 匹配类型：exact(=), prefix(无), regex(~)
  proxy_pass?: string;             // 代理地址
  root?: string;                   // 静态文件根目录
  try_files?: string;              // try_files 配置
}

// Nginx 配置
export interface NginxConfig {
  id: number;
  name: string;
  description: string;
  server_id?: number;
  worker_processes: string;
  worker_connections: number;
  enable_http: boolean;
  http_port: number;
  enable_https: boolean;
  https_port: number;
  certificate_id?: number;
  http_to_https: boolean;
  server_name: string;
  root_path: string;
  index_files: string;
  access_log_path: string;
  error_log_path: string;
  log_format: 'main' | 'json';
  enable_proxy: boolean;
  proxy_pass: string;
  locations?: NginxLocation[];     // 多个 location 配置
  client_max_body_size: string;
  gzip: boolean;
  custom_config: string;
  status: 'draft' | 'active' | 'disabled';
  created_at: string;
  updated_at: string;
  server?: Server;
  certificate?: Certificate;
}

// 部署类型
export type DeploymentType = 'nginx_config' | 'package' | 'certificate';

// 部署状态
export type DeploymentStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

// 部署任务
export interface Deployment {
  id: number;
  name: string;
  description: string;
  type: DeploymentType;
  server_id: number;
  status: DeploymentStatus;
  nginx_config_id?: number;
  package_id?: number;
  certificate_id?: number;
  target_path: string;
  backup_enabled: boolean;
  backup_path: string;
  restart_service: boolean;
  service_name: string;
  deploy_params?: string;         // JSON 格式的部署参数
  started_at?: string;
  completed_at?: string;
  duration: number;
  error_msg: string;
  can_rollback: boolean;
  rolled_back_from?: number;
  server?: Server;
  nginx_config?: NginxConfig;
  package?: MiddlewarePackage;
  certificate?: Certificate;
  logs?: DeploymentLog[];
  created_at: string;
  updated_at: string;
}

// 部署日志
export interface DeploymentLog {
  id: number;
  deployment_id: number;
  step: number;
  action: string;
  status: 'running' | 'success' | 'failed' | 'skipped';
  output: string;
  error_msg: string;
  duration: number;
  created_at: string;
}

// 离线包参数选项
export interface ParameterOption {
  label: string;
  value: string | number | boolean;
}

// 离线包参数定义
export interface PackageParameter {
  name: string;                    // 参数名（环境变量名）
  label: string;                   // 显示标签
  type: 'string' | 'number' | 'boolean' | 'select';  // 参数类型
  default?: string | number | boolean;  // 默认值
  required?: boolean;              // 是否必填
  description?: string;            // 参数说明
  placeholder?: string;            // 占位符
  options?: ParameterOption[];     // 选项（type=select时使用）

  // 验证规则（直接在参数对象中）
  min?: number;                    // 最小值（数字类型）
  max?: number;                    // 最大值（数字类型）
  min_len?: number;                // 最小长度（字符串类型）
  max_len?: number;                // 最大长度（字符串类型）
  pattern?: string;                // 正则表达式（字符串类型）

  advanced?: boolean;              // 是否为高级参数（高级参数将折叠显示）
}

// 支持的操作系统
export interface SupportedOS {
  type: string;                    // 操作系统类型: rocky, centos, openEuler, kylin
  versions: string[];              // 支持的版本列表
}

// 系统要求
export interface PackageRequirements {
  disk_space?: string;             // 磁盘空间（如 "500MB", "1GB"）
  memory?: string;                 // 内存（如 "512MB", "1GB"）
  root_required?: boolean;         // 是否需要 root 权限
  ports?: number[];                // 需要的端口列表
  dependencies?: string[];         // 依赖的系统包
}

// 离线包元数据
export interface PackageMetadata {
  name: string;                    // 包名称
  version: string;                 // 版本号
  display_name: string;            // 显示名称
  description: string;             // 描述
  supported_os: SupportedOS[];     // 支持的操作系统
  install_script: string;          // 安装脚本名称
  parameters: PackageParameter[];  // 可配置参数列表
  features?: string[];             // 功能特性
  requirements?: PackageRequirements; // 系统要求
}

// Nginx 配置应用记录
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
  updated_at: string;
  nginx_config?: NginxConfig;
  server?: Server;
  logs?: NginxConfigApplyLog[];
}

// Nginx 配置应用日志
export interface NginxConfigApplyLog {
  id: number;
  apply_id: number;
  step: number;
  action: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  output?: string;
  error_msg?: string;
  created_at: string;
  updated_at: string;
}
