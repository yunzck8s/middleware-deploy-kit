import client from './client';
import type { User } from '../types';

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
export const login = (data: LoginRequest) => {
  return client.post<any, LoginResponse>('/auth/login', data);
};

// 登出
export const logout = () => {
  return client.post('/auth/logout');
};

// 获取当前用户信息
export const getProfile = () => {
  return client.get('/auth/profile');
};

// 修改密码
export const changePassword = (data: ChangePasswordRequest) => {
  return client.put('/auth/password', data);
};
