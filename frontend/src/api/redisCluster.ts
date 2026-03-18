import client from './client';
import type { RedisCluster, CreateClusterDTO, ApiResponse } from '../types';

// 创建集群
export const createCluster = async (data: CreateClusterDTO): Promise<RedisCluster> => {
  const response = await client.post<ApiResponse<RedisCluster>>('/redis/clusters', data);
  return (response as unknown as ApiResponse<RedisCluster>).data!;
};

// 获取集群列表
export const getClusterList = async (): Promise<RedisCluster[]> => {
  const response = await client.get<ApiResponse<RedisCluster[]>>('/redis/clusters');
  return (response as unknown as ApiResponse<RedisCluster[]>).data!;
};

// 获取集群详情
export const getCluster = async (id: number): Promise<RedisCluster> => {
  const response = await client.get<ApiResponse<RedisCluster>>(`/redis/clusters/${id}`);
  return (response as unknown as ApiResponse<RedisCluster>).data!;
};

// 删除集群
export const deleteCluster = async (id: number): Promise<void> => {
  await client.delete(`/redis/clusters/${id}`);
};

// 部署集群
export const deployCluster = async (id: number, autoInit = false): Promise<void> => {
  await client.post(`/redis/clusters/${id}/deploy`, { auto_init: autoInit });
};

// 初始化集群
export const initCluster = async (id: number): Promise<void> => {
  await client.post(`/redis/clusters/${id}/init`);
};

// 获取集群状态
export const getClusterStatus = async (id: number): Promise<RedisCluster> => {
  const response = await client.get<ApiResponse<RedisCluster>>(`/redis/clusters/${id}/status`);
  return (response as unknown as ApiResponse<RedisCluster>).data!;
};
