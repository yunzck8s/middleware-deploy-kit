import { useState, useCallback } from 'react';
import { message } from 'antd';
import { getPackageList } from '../api/package';
import { getServerList } from '../api/server';
import { getDeploymentList } from '../api/deployment';
import type { Deployment, DeploymentStatus } from '../types';
import { formatDate, getRecentDays } from '../utils/chartUtils';

export interface DashboardStats {
  // 统计数据
  packagesCount: number;
  serversTotal: number;
  serversOnline: number;
  deploymentsTotal: number;
  deploymentsRunning: number;
  successRate: number;

  // 图表数据
  trendData: {
    dates: string[];
    success: number[];
    failed: number[];
  };
  statusData: {
    name: string;
    value: number;
    status: DeploymentStatus;
  }[];

  // 最近活动
  recentDeployments: Deployment[];
}

export const useDashboardData = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // 并行获取所有数据
      const [packagesRes, serversRes, deploymentsRes] = await Promise.all([
        getPackageList({ page: 1, page_size: 1000 }),
        getServerList({ page: 1, page_size: 1000 }),
        getDeploymentList({ page: 1, page_size: 1000 }),
      ]);

      // 计算统计数据
      const packagesCount =
        packagesRes.packages?.filter((p) => p.status === 'active').length || 0;
      const serversOnline =
        serversRes.servers?.filter((s) => s.status === 'online').length || 0;
      const serversTotal = serversRes.total || 0;

      const deployments = deploymentsRes.deployments || [];
      const deploymentsTotal = deployments.length;
      const deploymentsRunning = deployments.filter(
        (d) => d.status === 'running'
      ).length;
      const successCount = deployments.filter((d) => d.status === 'success').length;
      const successRate =
        deploymentsTotal > 0
          ? Math.round((successCount / deploymentsTotal) * 100)
          : 0;

      // 计算最近7天的趋势数据
      const recentDays = getRecentDays(7);
      const trendData = {
        dates: recentDays,
        success: recentDays.map((date) => {
          return deployments.filter((d) => {
            const deployDate = formatDate(d.created_at);
            return deployDate === date && d.status === 'success';
          }).length;
        }),
        failed: recentDays.map((date) => {
          return deployments.filter((d) => {
            const deployDate = formatDate(d.created_at);
            return deployDate === date && d.status === 'failed';
          }).length;
        }),
      };

      // 计算状态分布数据
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

      const statusData = (Object.keys(statusCounts) as DeploymentStatus[]).map(
        (status) => ({
          name: getStatusLabel(status),
          value: statusCounts[status],
          status,
        })
      );

      // 最近10条部署记录
      const recentDeployments = deployments
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 10);

      setStats({
        packagesCount,
        serversTotal,
        serversOnline,
        deploymentsTotal,
        deploymentsRunning,
        successRate,
        trendData,
        statusData,
        recentDeployments,
      });
    } catch (error) {
      console.error('获取仪表盘数据失败:', error);
      message.error('获取仪表盘数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  return { stats, loading, fetchData };
};

// 辅助函数：获取状态标签
function getStatusLabel(status: DeploymentStatus): string {
  const labelMap: Record<DeploymentStatus, string> = {
    pending: '待执行',
    running: '进行中',
    success: '成功',
    failed: '失败',
    cancelled: '已取消',
  };
  return labelMap[status] || '未知';
}
