import client from './client';
import type { ApiResponse } from '../types';

export interface Notification {
  id: number;
  type: string;
  title: string;
  content: string;
  status: string;
  related_type?: string;
  related_id?: number;
  read_at?: string;
  created_at: string;
}

export const notificationAPI = {
  list: async (params?: { status?: string; page?: number; page_size?: number }) => {
    const response = await client.get<ApiResponse<{ list: Notification[]; total: number; page: number }>>('/notifications', { params });
    return (response as unknown as ApiResponse<{ list: Notification[]; total: number; page: number }>).data!;
  },

  getUnreadCount: async () => {
    const response = await client.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
    return (response as unknown as ApiResponse<{ count: number }>).data!;
  },

  markRead: (id: number) =>
    client.put(`/notifications/${id}/read`),

  delete: (id: number) =>
    client.delete(`/notifications/${id}`),
};
