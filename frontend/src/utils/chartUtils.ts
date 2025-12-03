import type { DeploymentStatus } from '../types';

/**
 * 获取部署状态对应的颜色
 */
export const getStatusColor = (status: DeploymentStatus): string => {
  const colorMap: Record<DeploymentStatus, string> = {
    pending: '#faad14',     // 橙色 - 待执行
    running: '#1890ff',     // 蓝色 - 进行中
    success: '#52c41a',     // 绿色 - 成功
    failed: '#ff4d4f',      // 红色 - 失败
    cancelled: '#d9d9d9',   // 灰色 - 已取消
  };

  return colorMap[status] || '#d9d9d9';
};

/**
 * 获取部署状态的中文名称
 */
export const getStatusLabel = (status: DeploymentStatus): string => {
  const labelMap: Record<DeploymentStatus, string> = {
    pending: '待执行',
    running: '进行中',
    success: '成功',
    failed: '失败',
    cancelled: '已取消',
  };

  return labelMap[status] || '未知';
};

/**
 * 格式化日期为 MM-DD 格式
 */
export const formatDateShort = (dateString: string): string => {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}-${day}`;
};

/**
 * 格式化日期为 YYYY-MM-DD 格式
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 获取最近 N 天的日期数组
 */
export const getRecentDays = (days: number): string[] => {
  const result: string[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    result.push(formatDate(date.toISOString()));
  }

  return result;
};

/**
 * 获取最近 N 天的日期标签（MM-DD 格式）
 */
export const getRecentDayLabels = (days: number): string[] => {
  return getRecentDays(days).map(formatDateShort);
};
