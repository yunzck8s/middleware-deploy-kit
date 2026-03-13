import { useNavigate } from 'react-router-dom';
import { Button, List, Skeleton } from 'antd';
import {
  CloudServerOutlined,
  InboxOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import LineChart from '../components/charts/LineChart';
import DeploymentStatusOverview from '../components/charts/DeploymentStatusOverview';
import PageHeader from '../components/common/PageHeader';
import MetricTile from '../components/common/MetricTile';
import SectionCard from '../components/common/SectionCard';
import ActionGroup from '../components/common/ActionGroup';
import StatusBadge, { getStatusMeta } from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import { getRecentDayLabels } from '../utils/chartUtils';
import { formatRelativeTime } from '../utils/formatters';

const Dashboard = () => {
  const navigate = useNavigate();
  const { stats, loading, fetchData } = useDashboardData();

  useAutoRefresh(fetchData, { interval: 30000, enabled: true });

  const quickActions = [
    { label: '上传离线包', icon: <InboxOutlined />, path: '/middleware/nginx/packages' },
    { label: '管理证书', icon: <SafetyCertificateOutlined />, path: '/middleware/nginx/certificates' },
    { label: '编辑配置', icon: <SettingOutlined />, path: '/middleware/nginx/configs' },
    { label: '发起部署', icon: <RocketOutlined />, path: '/middleware/nginx/deployments' },
  ];

  const chartDates = getRecentDayLabels(7);

  return (
    <div className="page-stack dashboard-page">
      <PageHeader
        eyebrow="控制台总览"
        title="控制台总览"
        subtitle="把服务器状态、可用资产、部署趋势和证书风险放在同一屏，方便你快速判断下一步。"
        actions={(
          <ActionGroup>
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
              刷新数据
            </Button>
            <Button type="primary" icon={<RocketOutlined />} onClick={() => navigate('/middleware/nginx/deployments')}>
              新建部署任务
            </Button>
          </ActionGroup>
        )}
      />

      <div className="metric-grid">
        <MetricTile
          label="在线服务器"
          value={`${stats?.serversOnline || 0}/${stats?.serversTotal || 0}`}
          hint="当前在线服务器占全部服务器的比例"
          icon={<CloudServerOutlined />}
          tone="success"
          loading={loading}
          onClick={() => navigate('/servers')}
        />
        <MetricTile
          label="可用离线包"
          value={stats?.packagesCount || 0}
          hint="当前可直接用于部署的 Nginx 离线包"
          icon={<InboxOutlined />}
          tone="info"
          loading={loading}
          onClick={() => navigate('/middleware/nginx/packages')}
        />
        <MetricTile
          label="有效证书"
          value={stats?.certificatesTotal || 0}
          hint={`${stats?.certificatesExpiringSoon || 0} 个证书将在 30 天内到期`}
          icon={<SafetyCertificateOutlined />}
          tone={stats?.certificatesExpiringSoon ? 'warning' : 'success'}
          loading={loading}
          onClick={() => navigate('/middleware/nginx/certificates')}
        />
        <MetricTile
          label="配置数量"
          value={stats?.configsTotal || 0}
          hint="当前已保存的 Nginx 配置数量"
          icon={<SettingOutlined />}
          tone="default"
          loading={loading}
          onClick={() => navigate('/middleware/nginx/configs')}
        />
        <MetricTile
          label="运行中部署"
          value={stats?.deploymentsRunning || 0}
          hint={`累计记录 ${stats?.deploymentsTotal || 0} 个部署任务`}
          icon={<RocketOutlined />}
          tone={stats?.deploymentsRunning ? 'warning' : 'default'}
          loading={loading}
          onClick={() => navigate('/middleware/nginx/deployments')}
        />
        <MetricTile
          label="近期成功率"
          value={`${stats?.successRate || 0}%`}
          hint="根据当前部署历史自动计算"
          icon={<ArrowRightOutlined />}
          tone={(stats?.successRate || 0) >= 90 ? 'success' : (stats?.successRate || 0) >= 70 ? 'warning' : 'danger'}
          loading={loading}
        />
      </div>

      <div className="page-grid-2 dashboard-page__body">
        <div className="page-stack">
          <SectionCard
            title="部署趋势"
            subtitle="查看过去 7 天成功和失败任务的变化，快速判断是否需要介入。"
            extra={<StatusBadge status={(stats?.deploymentsRunning || 0) > 0 ? 'running' : 'success'} label={(stats?.deploymentsRunning || 0) > 0 ? '有任务执行中' : '当前无运行中任务'} compact />}
          >
            {loading ? (
              <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 8 }} /></div>
            ) : (
              <div style={{ padding: 16 }}>
                <LineChart
                  data={[
                    { name: '成功', data: stats?.trendData.success || [], color: '#22C55E' },
                    { name: '失败', data: stats?.trendData.failed || [], color: '#EF4444' },
                  ]}
                  xAxisData={chartDates}
                  height={320}
                />
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="最近部署"
            subtitle="按时间倒序查看最近创建的任务，优先关注刚开始或刚结束的任务。"
            extra={<Button type="link" icon={<ArrowRightOutlined />} onClick={() => navigate('/middleware/nginx/deployments')}>查看全部</Button>}
          >
            <div style={{ padding: 16 }}>
              {loading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : !stats?.recentDeployments?.length ? (
                <EmptyState title="还没有部署记录" description="新建部署后，这里会显示最近的执行记录和状态变化。" />
              ) : (
                <List
                  itemLayout="vertical"
                  dataSource={stats.recentDeployments}
                  renderItem={(item) => {
                    const statusMeta = getStatusMeta(item.status);
                    return (
                      <List.Item
                        style={{
                          padding: '16px 0',
                          borderBottomColor: 'var(--border-color)',
                        }}
                        actions={[
                          <Button key="view" type="link" onClick={() => navigate('/middleware/nginx/deployments')}>
                            查看任务详情
                          </Button>,
                        ]}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{item.name}</div>
                            <div style={{ marginTop: 6, color: 'var(--text-secondary)' }}>{item.description || '未填写说明'}</div>
                            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <StatusBadge status={item.status} label={statusMeta.label} compact />
                              <span className="summary-card__hint">{item.server?.name || '未指定服务器'}</span>
                              <span className="summary-card__hint">{formatRelativeTime(item.created_at)}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div className="summary-card__label">任务类型</div>
                            <div className="summary-card__value" style={{ fontSize: 16 }}>{item.type}</div>
                          </div>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              )}
            </div>
          </SectionCard>
        </div>

        <div className="page-stack">
          <SectionCard title="部署状态分布" subtitle="用运维条形概览查看任务结构、占比和风险方向。">
            <div style={{ padding: 16 }}>
              <DeploymentStatusOverview
                data={(stats?.statusData || []).map((item) => ({
                  name: item.name,
                  value: item.value,
                  status: item.status,
                }))}
                total={stats?.deploymentsTotal || 0}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-xl)' }}>
        <SectionCard title="证书风险提醒" subtitle="优先关注即将到期和需要替换的 TLS 资产。">
          <div style={{ padding: 16 }}>
            <div className="summary-card" style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}>
              <div className="summary-card__label">30 天内到期证书</div>
              <div className="summary-card__value" style={{ color: 'var(--color-warning)' }}>{stats?.certificatesExpiringSoon || 0}</div>
              <div className="summary-card__hint">
                {(stats?.certificatesExpiringSoon || 0) > 0
                  ? '建议优先检查域名映射和证书替换计划。'
                  : '当前没有需要立即处理的到期风险。'}
              </div>
            </div>
            <div className="summary-card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)', marginTop: 12 }}>
              <div className="summary-card__label">已过期证书</div>
              <div className="summary-card__value" style={{ color: 'var(--color-danger)' }}>{stats?.certificatesExpired || 0}</div>
              <div className="summary-card__hint">
                {(stats?.certificatesExpired || 0) > 0
                  ? '需要尽快移除或更新，避免服务中断。'
                  : '当前没有已过期的证书。'}
              </div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)' }}>
              <WarningOutlined style={{ color: 'var(--color-warning)' }} />
              到期风险根据当前证书有效期自动计算。
            </div>
          </div>
        </SectionCard>

        <SectionCard title="快捷操作" subtitle="快速进入 Nginx 最常用的工作流。">
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {quickActions.map((action) => (
              <Button
                key={action.path}
                icon={action.icon}
                block
                onClick={() => navigate(action.path)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};

export default Dashboard;
