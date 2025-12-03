import type { Deployment, DeploymentStatus } from '../types';
import { formatDate } from './chartUtils';

/**
 * 按日期分组统计部署数据
 */
export interface DeploymentByDate {
  date: string;
  total: number;
  success: number;
  failed: number;
  pending: number;
  running: number;
  cancelled: number;
}

export const groupDeploymentsByDate = (
  deployments: Deployment[],
  dates: string[]
): DeploymentByDate[] => {
  return dates.map((date) => {
    const deploymentsOnDate = deployments.filter(
      (d) => formatDate(d.created_at) === date
    );

    const statusCounts = {
      total: deploymentsOnDate.length,
      success: 0,
      failed: 0,
      pending: 0,
      running: 0,
      cancelled: 0,
    };

    deploymentsOnDate.forEach((d) => {
      statusCounts[d.status]++;
    });

    return {
      date,
      ...statusCounts,
    };
  });
};

/**
 * 统计部署状态分布
 */
export interface StatusCount {
  status: DeploymentStatus;
  count: number;
  percentage: number;
}

export const calculateStatusDistribution = (
  deployments: Deployment[]
): StatusCount[] => {
  const total = deployments.length;
  if (total === 0) {
    return [];
  }

  const statusCounts: Record<DeploymentStatus, number> = {
    pending: 0,
    running: 0,
    success: 0,
    failed: 0,
    cancelled: 0,
  };

  deployments.forEach((d) => {
    statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
  });

  return (Object.keys(statusCounts) as DeploymentStatus[]).map((status) => ({
    status,
    count: statusCounts[status],
    percentage: Math.round((statusCounts[status] / total) * 100),
  }));
};

/**
 * 计算成功率
 */
export const calculateSuccessRate = (deployments: Deployment[]): number => {
  if (deployments.length === 0) {
    return 0;
  }

  const successCount = deployments.filter((d) => d.status === 'success').length;
  return Math.round((successCount / deployments.length) * 100);
};

/**
 * 获取最近的部署记录
 */
export const getRecentDeployments = (
  deployments: Deployment[],
  limit = 10
): Deployment[] => {
  return [...deployments]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit);
};

/**
 * 过滤部署记录
 */
export interface DeploymentFilter {
  status?: DeploymentStatus;
  type?: string;
  serverId?: number;
  startDate?: string;
  endDate?: string;
  keyword?: string;
}

export const filterDeployments = (
  deployments: Deployment[],
  filter: DeploymentFilter
): Deployment[] => {
  return deployments.filter((d) => {
    // 状态筛选
    if (filter.status && d.status !== filter.status) {
      return false;
    }

    // 类型筛选
    if (filter.type && d.type !== filter.type) {
      return false;
    }

    // 服务器筛选
    if (filter.serverId && d.server_id !== filter.serverId) {
      return false;
    }

    // 日期范围筛选
    if (filter.startDate) {
      const deployDate = new Date(d.created_at);
      const startDate = new Date(filter.startDate);
      if (deployDate < startDate) {
        return false;
      }
    }

    if (filter.endDate) {
      const deployDate = new Date(d.created_at);
      const endDate = new Date(filter.endDate);
      endDate.setHours(23, 59, 59, 999);
      if (deployDate > endDate) {
        return false;
      }
    }

    // 关键词筛选
    if (filter.keyword) {
      const keyword = filter.keyword.toLowerCase();
      const nameMatch = d.name.toLowerCase().includes(keyword);
      const descMatch = d.description?.toLowerCase().includes(keyword);
      const serverMatch = d.server?.name?.toLowerCase().includes(keyword);

      if (!nameMatch && !descMatch && !serverMatch) {
        return false;
      }
    }

    return true;
  });
};
