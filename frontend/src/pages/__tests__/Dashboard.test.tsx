import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import Dashboard from '../Dashboard';
import { renderWithProviders } from '../../test/utils';

vi.mock('../../hooks/useDashboardData', () => ({
  useDashboardData: () => ({
    loading: false,
    fetchData: vi.fn(),
    stats: {
      packagesCount: 4,
      serversTotal: 5,
      serversOnline: 3,
      deploymentsTotal: 10,
      deploymentsRunning: 1,
      successRate: 80,
      certificatesTotal: 2,
      certificatesExpiringSoon: 1,
      configsTotal: 6,
      trendData: {
        dates: ['2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09'],
        success: [1, 0, 2, 1, 1, 0, 3],
        failed: [0, 1, 0, 0, 1, 0, 1],
      },
      statusData: [
        { name: '待执行', value: 2, status: 'pending' },
        { name: '进行中', value: 1, status: 'running' },
        { name: '成功', value: 5, status: 'success' },
        { name: '失败', value: 1, status: 'failed' },
        { name: '已取消', value: 1, status: 'cancelled' },
      ],
      recentDeployments: [
        {
          id: 1,
          name: '生产部署',
          description: '主站更新',
          type: 'package',
          server_id: 1,
          status: 'success',
          target_path: '/tmp',
          backup_enabled: true,
          backup_path: '',
          restart_service: false,
          service_name: 'nginx',
          duration: 23,
          error_msg: '',
          can_rollback: false,
          created_at: '2026-03-09T00:00:00Z',
          updated_at: '2026-03-09T00:00:00Z',
          server: { id: 1, name: 'web-01', host: '10.0.0.1', port: 22, username: 'root', auth_type: 'password', os_type: 'rocky', os_version: '9.4', description: '', tags: '', status: 'online', last_check_at: null, last_check_msg: '', created_at: '', updated_at: '' },
        },
      ],
    },
  }),
}));

vi.mock('../../hooks/useAutoRefresh', () => ({
  useAutoRefresh: vi.fn(),
}));

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders status overview instead of pie chart title', async () => {
    const { container } = renderWithProviders(<Dashboard />);

    expect(container.querySelector('.deployment-status-overview')).toBeTruthy();
    expect(screen.getByText('部署状态分布')).toBeInTheDocument();
    expect(screen.getByText('用运维条形概览查看任务结构、占比和风险方向。')).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector('.deployment-status-overview__bar')).toBeTruthy();
    });
  });
});
