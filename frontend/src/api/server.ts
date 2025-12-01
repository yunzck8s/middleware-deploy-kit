import client from './client';
import type { Server, SSHTestResult, ApiResponse } from '../types';

export interface ServerListParams {
  status?: string;
  os_type?: string;
  page?: number;
  page_size?: number;
}

export interface ServerListResponse {
  servers: Server[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateServerData {
  name: string;
  host: string;
  port?: number;
  username: string;
  auth_type?: 'password' | 'key';
  password?: string;
  private_key?: string;
  passphrase?: string;
  os_type?: string;
  os_version?: string;
  description?: string;
  tags?: string;
}

export interface UpdateServerData {
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  auth_type?: 'password' | 'key';
  password?: string;
  private_key?: string;
  passphrase?: string;
  os_type?: string;
  os_version?: string;
  description?: string;
  tags?: string;
}

export interface TestConnectionData {
  host: string;
  port?: number;
  username: string;
  auth_type?: 'password' | 'key';
  password?: string;
  private_key?: string;
  passphrase?: string;
}

// 获取服务器列表
export const getServerList = async (params: ServerListParams = {}): Promise<ServerListResponse> => {
  const response = await client.get<ApiResponse<ServerListResponse>>('/servers', { params });
  return (response as unknown as ApiResponse<ServerListResponse>).data!;
};

// 获取服务器详情
export const getServerDetail = async (id: number): Promise<Server> => {
  const response = await client.get<ApiResponse<Server>>(`/servers/${id}`);
  return (response as unknown as ApiResponse<Server>).data!;
};

// 创建服务器
export const createServer = async (data: CreateServerData): Promise<Server> => {
  const response = await client.post<ApiResponse<Server>>('/servers', data);
  return (response as unknown as ApiResponse<Server>).data!;
};

// 更新服务器
export const updateServer = async (id: number, data: UpdateServerData): Promise<Server> => {
  const response = await client.put<ApiResponse<Server>>(`/servers/${id}`, data);
  return (response as unknown as ApiResponse<Server>).data!;
};

// 删除服务器
export const deleteServer = async (id: number): Promise<void> => {
  await client.delete<ApiResponse<void>>(`/servers/${id}`);
};

// 测试已保存服务器连接
export const testServerConnection = async (id: number): Promise<SSHTestResult> => {
  const response = await client.post<ApiResponse<SSHTestResult>>(`/servers/${id}/test`);
  return (response as unknown as ApiResponse<SSHTestResult>).data!;
};

// 直接测试连接（不保存）
export const testConnectionDirect = async (data: TestConnectionData): Promise<SSHTestResult> => {
  const response = await client.post<ApiResponse<SSHTestResult>>('/servers/test', data);
  return (response as unknown as ApiResponse<SSHTestResult>).data!;
};
