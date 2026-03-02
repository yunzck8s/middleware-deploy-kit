import { useState, useCallback } from 'react';
import { message } from 'antd';
import { getPackageList } from '../api/package';
import { getServerList } from '../api/server';
import { getDeploymentList } from '../api/deployment';
import { getCertificateList } from '../api/certificate';
import type { Deployment, DeploymentStatus } from '../types';
import { formatDate, getRecentDays } from '../utils/chartUtils';

export interface DashboardStats {
  packagesCount: number;
  serversTotal: number;
  serversOnline: number;
  deploymentsTotal: number;
  deploymentsRunning: number;
  successRate: number;

  // Certificate stats
  certificatesTotal: number;
  certificatesExpiringSoon: number; // within 30 days

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

  recentDeployments: Deployment[];
}

export const useDashboardData = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      const [packagesRes, serversRes, deploymentsRes, certsRes] = await Promise.all([
        getPackageList({ page: 1, page_size: 1000 }),
        getServerList({ page: 1, page_size: 1000 }),
        getDeploymentList({ page: 1, page_size: 1000 }),
        getCertificateList({ page: 1, page_size: 1000 }),
      ]);

      const packagesCount = packagesRes.packages?.filter((p) => p.status === 'active').length || 0;
      const serversOnline = serversRes.servers?.filter((s) => s.status === 'online').length || 0;
      const serversTotal = serversRes.total || 0;

      const deployments = deploymentsRes.deployments || [];
      const deploymentsTotal = deployments.length;
      const deploymentsRunning = deployments.filter((d) => d.status === 'running').length;
      const successCount = deployments.filter((d) => d.status === 'success').length;
      const successRate = deploymentsTotal > 0 ? Math.round((successCount / deploymentsTotal) * 1000) / 10 : 0;

      // Certificate stats
      const certs = certsRes.certificates || [];
      const certificatesTotal = certs.length;
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const certificatesExpiringSoon = certs.filter((c) => {
        if (c.status === 'expired') return false;
        const expiry = new Date(c.valid_until);
        return expiry <= thirtyDaysLater && expiry > now;
      }).length;

      const recentDays = getRecentDays(7);
      const trendData = {
        dates: recentDays,
        success: recentDays.map((date) =>
          deployments.filter((d) => formatDate(d.created_at) === date && d.status === 'success').length
        ),
        failed: recentDays.map((date) =>
          deployments.filter((d) => formatDate(d.created_at) === date && d.status === 'failed').length
        ),
      };

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

      const statusData = (Object.keys(statusCounts) as DeploymentStatus[]).map((status) => ({
        name: getStatusLabel(status),
        value: statusCounts[status],
        status,
      }));

      const recentDeployments = deployments
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      setStats({
        packagesCount,
        serversTotal,
        serversOnline,
        deploymentsTotal,
        deploymentsRunning,
        successRate,
        certificatesTotal,
        certificatesExpiringSoon,
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
