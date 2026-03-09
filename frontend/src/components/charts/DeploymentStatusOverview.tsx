import StatusBadge from '../common/StatusBadge';
import EmptyState from '../common/EmptyState';
import { formatPercentage } from '../../utils/formatters';

export interface DeploymentStatusOverviewItem {
  name: string;
  value: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
}

interface DeploymentStatusOverviewProps {
  data: DeploymentStatusOverviewItem[];
  total: number;
}

const STATUS_DESCRIPTIONS: Record<DeploymentStatusOverviewItem['status'], string> = {
  pending: '等待执行或人工触发',
  running: '正在输出实时部署日志',
  success: '已完成且通过执行流程',
  failed: '需要查看日志并考虑回滚',
  cancelled: '被人工中止或提前终止',
};

const STATUS_COLORS: Record<DeploymentStatusOverviewItem['status'], string> = {
  pending: '#F59E0B',
  running: '#38BDF8',
  success: '#22C55E',
  failed: '#EF4444',
  cancelled: '#64748B',
};

const DeploymentStatusOverview = ({ data, total }: DeploymentStatusOverviewProps) => {
  if (!total || data.every((item) => item.value === 0)) {
    return (
      <EmptyState
        title="暂无部署状态数据"
        description="创建并执行部署任务后，这里会显示各状态占比、数量与风险提示。"
      />
    );
  }

  return (
    <div className="deployment-status-overview">
      <div className="deployment-status-overview__bar" aria-label="部署状态分布条">
        {data.map((item) => {
          const width = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div
              key={item.status}
              className="deployment-status-overview__bar-segment"
              style={{ width: `${width}%`, background: STATUS_COLORS[item.status] }}
              title={`${item.name}: ${item.value}`}
            />
          );
        })}
      </div>

      <div className="deployment-status-overview__stats">
        {data.map((item) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.status} className="deployment-status-overview__stat-card">
              <div className="deployment-status-overview__stat-top">
                <StatusBadge status={item.status} label={item.name} compact />
                <span className="deployment-status-overview__stat-share">{formatPercentage(percentage, percentage > 0 && percentage < 10 ? 1 : 0)}</span>
              </div>
              <div className="deployment-status-overview__stat-value">{item.value}</div>
            </div>
          );
        })}
      </div>

      <div className="deployment-status-overview__legend">
        {data.map((item) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.status} className="deployment-status-overview__legend-row">
              <div className="deployment-status-overview__legend-main">
                <span className="deployment-status-overview__legend-dot" style={{ background: STATUS_COLORS[item.status] }} />
                <div>
                  <div className="deployment-status-overview__legend-title">{item.name}</div>
                  <div className="deployment-status-overview__legend-description">{STATUS_DESCRIPTIONS[item.status]}</div>
                </div>
              </div>
              <div className="deployment-status-overview__legend-values">
                <span>{item.value}</span>
                <span>{formatPercentage(percentage, percentage > 0 && percentage < 10 ? 1 : 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DeploymentStatusOverview;
