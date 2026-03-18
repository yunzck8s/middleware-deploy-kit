import client from './client';
import type { MiddlewareInstance, MiddlewareTypeStats, InstanceStats, CreateInstanceDTO } from '../types';

export const instanceAPI = {
  // 获取所有实例
  getAll: async (params?: { type?: string }): Promise<MiddlewareInstance[]> => {
    const response: any = await client.get('/middleware/instances', { params });
    return response.data;
  },

  // 获取实例详情
  getById: async (id: number): Promise<MiddlewareInstance> => {
    const response: any = await client.get(`/middleware/instances/${id}`);
    return response.data;
  },

  // 创建实例
  create: async (data: CreateInstanceDTO): Promise<MiddlewareInstance> => {
    const response: any = await client.post('/middleware/instances', data);
    return response.data;
  },

  // 更新实例
  update: async (id: number, data: Partial<MiddlewareInstance>): Promise<MiddlewareInstance> => {
    const response: any = await client.put(`/middleware/instances/${id}`, data);
    return response.data;
  },

  // 删除实例
  delete: async (id: number): Promise<void> => {
    await client.delete(`/middleware/instances/${id}`);
  },

  // 获取实例统计
  getStats: async (id: number): Promise<InstanceStats> => {
    const response: any = await client.get(`/middleware/instances/${id}/stats`);
    return response.data;
  },

  // 获取中间件类型统计
  getTypes: async (): Promise<MiddlewareTypeStats[]> => {
    const response: any = await client.get('/middleware/types');
    return response.data;
  },
};
