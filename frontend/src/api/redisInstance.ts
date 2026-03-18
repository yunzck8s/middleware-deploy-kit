import client from './client';

// Redis 配置读取
export const getRedisConfig = async (instanceId: number): Promise<{ content: string; conf_path: string }> => {
  const response: any = await client.get(`/redis/instances/${instanceId}/config`);
  return response.data;
};

// Redis 配置更新
export const updateRedisConfig = async (
  instanceId: number,
  data: { content: string; restart_service: boolean }
): Promise<{ backup_path: string; restarted: boolean; restart_error?: string }> => {
  const response: any = await client.put(`/redis/instances/${instanceId}/config`, data);
  return response.data;
};

// Redis 连接测试
export interface RedisTestResult {
  connected: boolean;
  ping?: string;
  latency_ms?: number;
  error?: string;
  info?: Record<string, string>;
  dbsize?: string;
}

export const testRedisConnection = async (instanceId: number): Promise<RedisTestResult> => {
  const response: any = await client.post(`/redis/instances/${instanceId}/test`);
  return response.data;
};

// Redis SCAN 扫描 key
export interface RedisKeyInfo {
  key: string;
  type: string;
  ttl: number;
}

export const scanRedisKeys = async (
  instanceId: number,
  data: { pattern: string; count?: number }
): Promise<{ keys: RedisKeyInfo[]; total: number }> => {
  const response: any = await client.post(`/redis/instances/${instanceId}/scan`, data);
  return response.data;
};

// Redis 获取 key 值
export interface RedisKeyValue {
  key: string;
  type: string;
  ttl: number;
  value: any;
}

export const getRedisKey = async (instanceId: number, key: string): Promise<RedisKeyValue> => {
  const response: any = await client.post(`/redis/instances/${instanceId}/key`, { key });
  return response.data;
};

// Redis 删除 key
export const deleteRedisKey = async (instanceId: number, key: string): Promise<{ deleted: string; key: string }> => {
  const response: any = await client.delete(`/redis/instances/${instanceId}/key`, { data: { key } });
  return response.data;
};

// Redis 写入测试数据
export const seedRedisTestData = async (instanceId: number): Promise<{ total: number; succeeded: number; message: string }> => {
  const response: any = await client.post(`/redis/instances/${instanceId}/seed`);
  return response.data;
};
