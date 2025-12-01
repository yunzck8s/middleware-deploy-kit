import client from './client';
import type { User, ApiResponse } from '../types';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

// 登录
export const login = async (data: LoginRequest): Promise<LoginResponse> => {
  const response = await client.post<ApiResponse<LoginResponse>>('/auth/login', data);
  return (response as unknown as ApiResponse<LoginResponse>).data!;
};

// 登出
export const logout = async (): Promise<void> => {
  await client.post('/auth/logout');
};

// 获取当前用户信息
export const getProfile = async (): Promise<User> => {
  const response = await client.get<ApiResponse<{ user: User }>>('/auth/profile');
  return (response as unknown as ApiResponse<{ user: User }>).data!.user;
};

// 修改密码
export const changePassword = async (data: ChangePasswordRequest): Promise<void> => {
  await client.put('/auth/password', data);
};
