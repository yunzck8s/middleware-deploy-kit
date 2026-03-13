import client from './client';
import type { ApiResponse } from '../types';

export interface SystemConfig {
  id: number;
  key: string;
  value: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface ConfigRequest {
  key: string;
  value: string;
  category: string;
}

export const systemConfigAPI = {
  set: async (data: ConfigRequest) => {
    const response = await client.post<ApiResponse<SystemConfig>>('/system-config', data);
    return (response as unknown as ApiResponse<SystemConfig>).data!;
  },

  get: async (key: string) => {
    const response = await client.get<ApiResponse<SystemConfig>>(`/system-config/${key}`);
    return (response as unknown as ApiResponse<SystemConfig>).data!;
  },

  testSMTP: async () => {
    const response = await client.post<ApiResponse<{ message: string }>>('/system-config/test-smtp');
    return (response as unknown as ApiResponse<{ message: string }>).data!;
  },

  testWebhook: async () => {
    const response = await client.post<ApiResponse<{ message: string }>>('/system-config/test-webhook');
    return (response as unknown as ApiResponse<{ message: string }>).data!;
  },
};
