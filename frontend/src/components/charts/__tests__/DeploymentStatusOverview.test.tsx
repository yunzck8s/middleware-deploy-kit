import { describe, it, expect } from 'vitest';
import { render, screen } from '../../../test/utils';
import DeploymentStatusOverview from '../DeploymentStatusOverview';

describe('DeploymentStatusOverview', () => {
  it('renders stacked overview with status values', () => {
    render(
      <DeploymentStatusOverview
        total={10}
        data={[
          { name: '待执行', value: 2, status: 'pending' },
          { name: '进行中', value: 1, status: 'running' },
          { name: '成功', value: 5, status: 'success' },
          { name: '失败', value: 1, status: 'failed' },
          { name: '已取消', value: 1, status: 'cancelled' },
        ]}
      />
    );

    expect(screen.getAllByText('成功').length).toBeGreaterThan(0);
    expect(screen.getAllByText('50%').length).toBeGreaterThan(0);
    expect(screen.getByText('等待执行或人工触发')).toBeInTheDocument();
  });

  it('renders empty state when total is zero', () => {
    render(
      <DeploymentStatusOverview
        total={0}
        data={[
          { name: '待执行', value: 0, status: 'pending' },
          { name: '进行中', value: 0, status: 'running' },
          { name: '成功', value: 0, status: 'success' },
          { name: '失败', value: 0, status: 'failed' },
          { name: '已取消', value: 0, status: 'cancelled' },
        ]}
      />
    );

    expect(screen.getByText('暂无部署状态数据')).toBeInTheDocument();
  });
});
