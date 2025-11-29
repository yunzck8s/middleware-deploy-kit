import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

// 创建 axios 实例
const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 从 localStorage 获取 token
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
client.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error: AxiosError) => {
    if (error.response) {
      // 处理 401 未授权
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }

      // 返回错误信息
      const errorData = error.response.data as any;
      return Promise.reject(errorData);
    }

    return Promise.reject({
      code: 500,
      message: '网络错误，请稍后重试',
    });
  }
);

export default client;
