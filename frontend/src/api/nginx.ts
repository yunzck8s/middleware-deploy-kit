import client from './client';
import type { NginxConfig, ApiResponse } from '../types';

export interface NginxConfigListParams {
  status?: string;
  page?: number;
  page_size?: number;
}

export interface NginxConfigListResponse {
  configs: NginxConfig[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateNginxConfigData {
  name: string;
  description?: string;
  server_id?: number;
  worker_processes?: string;
  worker_connections?: number;
  enable_http?: boolean;
  http_port?: number;
  enable_https?: boolean;
  https_port?: number;
  certificate_id?: number;
  http_to_https?: boolean;
  server_name?: string;
  root_path?: string;
  index_files?: string;
  access_log_path?: string;
  error_log_path?: string;
  log_format?: string;
  enable_proxy?: boolean;
  proxy_pass?: string;
  client_max_body_size?: string;
  gzip?: boolean;
  custom_config?: string;
}

export interface GenerateResponse {
  config: NginxConfig;
  content: string;
}

export interface PreviewResponse {
  content: string;
}

// 获取 Nginx 配置列表
export const getNginxConfigList = async (params: NginxConfigListParams = {}): Promise<NginxConfigListResponse> => {
  const response = await client.get<ApiResponse<NginxConfigListResponse>>('/nginx', { params });
  return (response as unknown as ApiResponse<NginxConfigListResponse>).data!;
};

// 获取 Nginx 配置详情
export const getNginxConfigDetail = async (id: number): Promise<NginxConfig> => {
  const response = await client.get<ApiResponse<NginxConfig>>(`/nginx/${id}`);
  return (response as unknown as ApiResponse<NginxConfig>).data!;
};

// 创建 Nginx 配置
export const createNginxConfig = async (data: CreateNginxConfigData): Promise<NginxConfig> => {
  const response = await client.post<ApiResponse<NginxConfig>>('/nginx', data);
  return (response as unknown as ApiResponse<NginxConfig>).data!;
};

// 更新 Nginx 配置
export const updateNginxConfig = async (id: number, data: CreateNginxConfigData): Promise<NginxConfig> => {
  const response = await client.put<ApiResponse<NginxConfig>>(`/nginx/${id}`, data);
  return (response as unknown as ApiResponse<NginxConfig>).data!;
};

// 删除 Nginx 配置
export const deleteNginxConfig = async (id: number): Promise<void> => {
  await client.delete<ApiResponse<void>>(`/nginx/${id}`);
};

// 生成 Nginx 配置文件
export const generateNginxConfig = async (id: number): Promise<GenerateResponse> => {
  const response = await client.get<ApiResponse<GenerateResponse>>(`/nginx/${id}/generate`);
  return (response as unknown as ApiResponse<GenerateResponse>).data!;
};

// 预览 Nginx 配置（不保存）
export const previewNginxConfig = async (data: CreateNginxConfigData): Promise<PreviewResponse> => {
  const response = await client.post<ApiResponse<PreviewResponse>>('/nginx/preview', data);
  return (response as unknown as ApiResponse<PreviewResponse>).data!;
};

// ==================== Nginx 配置应用相关 API ====================

export interface ApplyConfigData {
  server_id: number;
  target_path?: string;
  backup_enabled?: boolean;
  restart_service?: boolean;
  service_name?: string;
}

export interface ApplyHistoryParams {
  page?: number;
  page_size?: number;
}

// 获取服务器上的 Nginx 部署信息
export interface NginxDeployInfo {
  found: boolean;
  target_path?: string;
  service_name?: string;
  deployed_at?: string;
}

export const getNginxDeployInfo = async (serverId: number): Promise<NginxDeployInfo> => {
  const response = await client.get<ApiResponse<NginxDeployInfo>>(`/nginx/deploy-info/${serverId}`);
  return (response as unknown as ApiResponse<NginxDeployInfo>).data!;
};

// 应用 Nginx 配置到服务器
export const applyNginxConfig = async (id: number, data: ApplyConfigData): Promise<any> => {
  const response = await client.post<ApiResponse<any>>(`/nginx/${id}/apply`, data);
  return (response as unknown as ApiResponse<any>).data!;
};

// 获取配置应用历史
export const getApplyHistory = async (id: number, params?: ApplyHistoryParams): Promise<any> => {
  const response = await client.get<ApiResponse<any>>(`/nginx/${id}/apply-history`, { params });
  return (response as unknown as ApiResponse<any>).data!;
};

// 获取应用详情（包含日志）
export const getApplyDetail = async (applyId: number): Promise<any> => {
  const response = await client.get<ApiResponse<any>>(`/nginx/applies/${applyId}`);
  return (response as unknown as ApiResponse<any>).data!;
};
