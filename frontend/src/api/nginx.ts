import client from './client';
import type { NginxConfig, NginxConfigApply, NginxUpstream, NginxLocation, ApiResponse } from '../types';

export interface NginxConfigListParams {
  status?: string;
  instance_id?: number;
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
  instance_id?: number;
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
  // 日志轮转
  rotate_enabled?: boolean;
  rotate_frequency?: 'daily' | 'weekly' | 'monthly';
  rotate_count?: number;
  rotate_max_size?: string;
  rotate_compress?: boolean;
  rotate_date_ext?: boolean;
  enable_proxy?: boolean;
  proxy_pass?: string;
  client_max_body_size?: string;
  gzip?: boolean;
  custom_config?: string;
  locations?: NginxLocation[];
  // Advanced SSL
  ssl_protocols?: string;
  ssl_ciphers?: string;
  enable_hsts?: boolean;
  hsts_max_age?: number;
  enable_ocsp?: boolean;
  // Cache
  cache_enabled?: boolean;
  cache_path?: string;
  cache_size?: string;
  cache_valid_time?: string;
  // Security
  rate_limit_enabled?: boolean;
  rate_limit_zone?: string;
  rate_limit_burst?: number;
  conn_limit_enabled?: boolean;
  conn_limit_zone?: string;
  conn_limit_num?: number;
  allow_ips?: string;
  deny_ips?: string;
  security_headers?: string;
}

export interface GenerateResponse {
  config: NginxConfig;
  content: string;
}

export interface PreviewResponse {
  content: string;
  logrotate_content?: string;
}

// ==================== Config CRUD ====================

export const getNginxConfigList = async (params: NginxConfigListParams = {}): Promise<NginxConfigListResponse> => {
  const response = await client.get<ApiResponse<NginxConfigListResponse>>('/nginx', { params });
  return (response as unknown as ApiResponse<NginxConfigListResponse>).data!;
};

export const getNginxConfigDetail = async (id: number): Promise<NginxConfig> => {
  const response = await client.get<ApiResponse<NginxConfig>>(`/nginx/${id}`);
  return (response as unknown as ApiResponse<NginxConfig>).data!;
};

export const createNginxConfig = async (data: CreateNginxConfigData): Promise<NginxConfig> => {
  const response = await client.post<ApiResponse<NginxConfig>>('/nginx', data);
  return (response as unknown as ApiResponse<NginxConfig>).data!;
};

export const updateNginxConfig = async (id: number, data: CreateNginxConfigData): Promise<NginxConfig> => {
  const response = await client.put<ApiResponse<NginxConfig>>(`/nginx/${id}`, data);
  return (response as unknown as ApiResponse<NginxConfig>).data!;
};

export const deleteNginxConfig = async (id: number): Promise<void> => {
  await client.delete<ApiResponse<void>>(`/nginx/${id}`);
};

export const generateNginxConfig = async (id: number): Promise<GenerateResponse> => {
  const response = await client.get<ApiResponse<GenerateResponse>>(`/nginx/${id}/generate`);
  return (response as unknown as ApiResponse<GenerateResponse>).data!;
};

export const previewNginxConfig = async (data: CreateNginxConfigData): Promise<PreviewResponse> => {
  const response = await client.post<ApiResponse<PreviewResponse>>('/nginx/preview', data);
  return (response as unknown as ApiResponse<PreviewResponse>).data!;
};

// ==================== Apply ====================

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

export interface NginxDeployInfo {
  found: boolean;
  source?: string;
  target_path?: string;
  service_name?: string;
  deployed_at?: string;
  deploy_params?: Record<string, any>;
}

export const getNginxDeployInfo = async (serverId: number): Promise<NginxDeployInfo> => {
  const response = await client.get<ApiResponse<NginxDeployInfo>>(`/nginx/deploy-info/${serverId}`);
  return (response as unknown as ApiResponse<NginxDeployInfo>).data!;
};

export interface ApplyHistoryResponse {
  applies: NginxConfigApply[];
  total: number;
  page: number;
  page_size: number;
}

export const applyNginxConfig = async (id: number, data: ApplyConfigData): Promise<NginxConfigApply> => {
  const response = await client.post<ApiResponse<NginxConfigApply>>(`/nginx/${id}/apply`, data);
  return (response as unknown as ApiResponse<NginxConfigApply>).data!;
};

export const getApplyHistory = async (id: number, params?: ApplyHistoryParams): Promise<ApplyHistoryResponse> => {
  const response = await client.get<ApiResponse<ApplyHistoryResponse>>(`/nginx/${id}/apply-history`, { params });
  return (response as unknown as ApiResponse<ApplyHistoryResponse>).data!;
};

export const getApplyDetail = async (applyId: number): Promise<NginxConfigApply> => {
  const response = await client.get<ApiResponse<NginxConfigApply>>(`/nginx/applies/${applyId}`);
  return (response as unknown as ApiResponse<NginxConfigApply>).data!;
};

// ==================== Upstream CRUD ====================

export const getUpstreams = async (configId: number): Promise<NginxUpstream[]> => {
  const response = await client.get<ApiResponse<NginxUpstream[]>>(`/nginx/${configId}/upstreams`);
  return (response as unknown as ApiResponse<NginxUpstream[]>).data!;
};

export const createUpstream = async (configId: number, data: Partial<NginxUpstream>): Promise<NginxUpstream> => {
  const response = await client.post<ApiResponse<NginxUpstream>>(`/nginx/${configId}/upstreams`, data);
  return (response as unknown as ApiResponse<NginxUpstream>).data!;
};

export const updateUpstream = async (uid: number, data: Partial<NginxUpstream>): Promise<NginxUpstream> => {
  const response = await client.put<ApiResponse<NginxUpstream>>(`/nginx/upstreams/${uid}`, data);
  return (response as unknown as ApiResponse<NginxUpstream>).data!;
};

export const deleteUpstream = async (uid: number): Promise<void> => {
  await client.delete<ApiResponse<void>>(`/nginx/upstreams/${uid}`);
};

// ==================== Location CRUD ====================

export const getLocations = async (configId: number): Promise<NginxLocation[]> => {
  const response = await client.get<ApiResponse<NginxLocation[]>>(`/nginx/${configId}/locations`);
  return (response as unknown as ApiResponse<NginxLocation[]>).data!;
};

export const createLocation = async (configId: number, data: Partial<NginxLocation>): Promise<NginxLocation> => {
  const response = await client.post<ApiResponse<NginxLocation>>(`/nginx/${configId}/locations`, data);
  return (response as unknown as ApiResponse<NginxLocation>).data!;
};

export const updateLocation = async (lid: number, data: Partial<NginxLocation>): Promise<NginxLocation> => {
  const response = await client.put<ApiResponse<NginxLocation>>(`/nginx/locations/${lid}`, data);
  return (response as unknown as ApiResponse<NginxLocation>).data!;
};

export const deleteLocation = async (lid: number): Promise<void> => {
  await client.delete<ApiResponse<void>>(`/nginx/locations/${lid}`);
};

export const updateLocationOrder = async (configId: number, orders: { id: number; sort_order: number }[]): Promise<void> => {
  await client.put<ApiResponse<void>>(`/nginx/${configId}/locations/order`, { orders });
};
