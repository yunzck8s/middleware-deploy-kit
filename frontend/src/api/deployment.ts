import client from './client';
import type { ApiResponse, Deployment, DeploymentLog, DeploymentType } from '../types';

export interface DeploymentListParams {
  status?: string;
  type?: string;
  page?: number;
  page_size?: number;
}

export interface DeploymentListResponse {
  deployments: Deployment[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateDeploymentData {
  name: string;
  description?: string;
  type: DeploymentType;
  server_id: number;
  nginx_config_id?: number;
  package_id?: number;
  certificate_id?: number;
  target_path?: string;
  backup_enabled?: boolean;
  restart_service?: boolean;
  service_name?: string;
}

// 获取部署任务列表
export const getDeploymentList = async (params: DeploymentListParams = {}): Promise<DeploymentListResponse> => {
  const response = await client.get<ApiResponse<DeploymentListResponse>>('/deployments', { params });
  return (response as unknown as ApiResponse<DeploymentListResponse>).data!;
};

// 获取部署任务详情
export const getDeploymentDetail = async (id: number): Promise<Deployment> => {
  const response = await client.get<ApiResponse<Deployment>>(`/deployments/${id}`);
  return (response as unknown as ApiResponse<Deployment>).data!;
};

// 创建部署任务
export const createDeployment = async (data: CreateDeploymentData): Promise<Deployment> => {
  const response = await client.post<ApiResponse<Deployment>>('/deployments', data);
  return (response as unknown as ApiResponse<Deployment>).data!;
};

// 删除部署任务
export const deleteDeployment = async (id: number): Promise<void> => {
  await client.delete<ApiResponse<void>>(`/deployments/${id}`);
};

// 执行部署任务
export const executeDeployment = async (id: number): Promise<{ message: string }> => {
  const response = await client.post<ApiResponse<{ message: string }>>(`/deployments/${id}/execute`);
  return (response as unknown as ApiResponse<{ message: string }>).data!;
};

// 获取部署日志
export const getDeploymentLogs = async (id: number): Promise<DeploymentLog[]> => {
  const response = await client.get<ApiResponse<DeploymentLog[]>>(`/deployments/${id}/logs`);
  return (response as unknown as ApiResponse<DeploymentLog[]>).data!;
};

// 回滚部署
export const rollbackDeployment = async (id: number): Promise<{ message: string; deployment: Deployment }> => {
  const response = await client.post<ApiResponse<{ message: string; deployment: Deployment }>>(`/deployments/${id}/rollback`);
  return (response as unknown as ApiResponse<{ message: string; deployment: Deployment }>).data!;
};

// 取消部署
export const cancelDeployment = async (id: number): Promise<{ message: string }> => {
  const response = await client.post<ApiResponse<{ message: string }>>(`/deployments/${id}/cancel`);
  return (response as unknown as ApiResponse<{ message: string }>).data!;
};
