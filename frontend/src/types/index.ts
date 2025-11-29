// 用户类型
export interface User {
  id: number;
  username: string;
  created_at: string;
  updated_at: string;
}

// API 响应类型
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  timestamp: string;
}

// 分页参数
export interface PaginationParams {
  page: number;
  page_size: number;
}

// 分页响应
export interface PaginationResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
