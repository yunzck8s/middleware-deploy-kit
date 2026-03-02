import { Row, Col, Card, List, Tag, Button, Skeleton } from 'antd';
import {
  AppstoreOutlined,
  CloudServerOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  SettingOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import LineChart from '../components/charts/LineChart';
import PieChart from '../components/charts/PieChart';
import { getStatusColor, getRecentDayLabels } from '../utils/chartUtils';
import type { Deployment } from '../types';

const Dashboard = () => {
  const navigate = useNavigate();
  const { stats, loading, fetchData } = useDashboardData();

  useAutoRefresh(fetchData, { interval: 30000, enabled: true });

  const getDeploymentTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      nginx_config: 'Nginx 配置',
      package: '离线包',
      certificate: '证书',
    };
    return typeMap[type] || type;
  };

  const getStatusTag = (status: string): string => {
    const statusMap: Record<string, string> = {
      pending: '待执行',
      running: '进行中',
      success: '成功',
      failed: '失败',
      cancelled: '已取消',
    };
    return statusMap[status] || status;
  };

  const quickActions = [
    {
      title: '添加服务器',
      icon: <CloudServerOutlined style={{ fontSize: 24, color: '#6366F1' }} />,
      description: '管理远程服务器',
      path: '/servers',
    },
    {
      title: '上传离线包',
      icon: <UploadOutlined style={{ fontSize: 24, color: '#10B981' }} />,
      description: '上传中间件安装包',
      path: '/middleware/nginx/packages',
    },
    {
      title: '创建部署',
      icon: <RocketOutlined style={{ fontSize: 24, color: '#F59E0B' }} />,
      description: '新建部署任务',
      path: '/middleware/nginx/deployments',
    },
    {
      title: 'Nginx 配置',
      icon: <SettingOutlined style={{ fontSize: 24, color: '#8B5CF6' }} />,
      description: '可视化配置管理',
      path: '/middleware/nginx/configs',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>运维概览</h1>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            实时监控平台状态
          </span>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* 5 KPI Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4} xl={4}>
          <div className="kpi-card" onClick={() => navigate('/servers')}>
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <>
                <div className="kpi-label">
                  <CloudServerOutlined style={{ marginRight: 6 }} />
                  服务器
                </div>
                <div className="kpi-value">
                  {stats?.serversOnline || 0}
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 400 }}>
                    /{stats?.serversTotal || 0}
                  </span>
                </div>
                <div className="kpi-trend" style={{ color: 'var(--color-success)' }}>
                  <span className="status-dot status-dot--online" style={{ marginRight: 6 }} />
                  在线
                </div>
              </>
            )}
          </div>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5}>
          <div className="kpi-card" onClick={() => navigate('/middleware/nginx/packages')}>
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <>
                <div className="kpi-label">
                  <AppstoreOutlined style={{ marginRight: 6 }} />
                  离线包
                </div>
                <div className="kpi-value">{stats?.packagesCount || 0}</div>
                <div className="kpi-trend" style={{ color: 'var(--text-secondary)' }}>
                  可用中间件包
                </div>
              </>
            )}
          </div>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5}>
          <div className="kpi-card" onClick={() => navigate('/middleware/nginx/deployments')}>
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <>
                <div className="kpi-label">
                  <RocketOutlined style={{ marginRight: 6 }} />
                  部署任务
                </div>
                <div className="kpi-value">{stats?.deploymentsTotal || 0}</div>
                <div className="kpi-trend" style={{ color: 'var(--color-warning)' }}>
                  {stats?.deploymentsRunning || 0} 运行中
                </div>
              </>
            )}
          </div>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5}>
          <div className="kpi-card">
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <>
                <div className="kpi-label">
                  <CheckCircleOutlined style={{ marginRight: 6 }} />
                  成功率
                </div>
                <div className="kpi-value" style={{ color: 'var(--color-success)' }}>
                  {stats?.successRate || 0}%
                </div>
                <div className="kpi-trend" style={{ color: 'var(--color-success)' }}>
                  部署成功占比
                </div>
              </>
            )}
          </div>
        </Col>
        <Col xs={24} sm={12} lg={5} xl={5}>
          <div className="kpi-card" onClick={() => navigate('/middleware/nginx/certificates')}>
            {loading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <>
                <div className="kpi-label">
                  <SafetyCertificateOutlined style={{ marginRight: 6 }} />
                  证书状态
                </div>
                <div className="kpi-value">{stats?.certificatesTotal || 0}</div>
                <div
                  className="kpi-trend"
                  style={{
                    color: (stats?.certificatesExpiringSoon || 0) > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                  }}
                >
                  {(stats?.certificatesExpiringSoon || 0) > 0 ? (
                    <>
                      <WarningOutlined style={{ marginRight: 4 }} />
                      {stats?.certificatesExpiringSoon} 即将到期
                    </>
                  ) : (
                    '全部正常'
                  )}
                </div>
              </>
            )}
          </div>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title="7日部署趋势"
            styles={{ body: { padding: 16 } }}
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : (
              <LineChart
                data={[
                  { name: '成功', data: stats?.trendData.success || [], color: '#10B981' },
                  { name: '失败', data: stats?.trendData.failed || [], color: '#EF4444' },
                ]}
                xAxisData={getRecentDayLabels(7)}
                height={300}
                smooth
                showArea
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title="部署状态分布"
            styles={{ body: { padding: 16 } }}
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : (
              <PieChart
                data={
                  stats?.statusData.map((item) => ({
                    name: item.name,
                    value: item.value,
                    color: getStatusColor(item.status),
                  })) || []
                }
                height={300}
                showPercentage
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent activity + Quick actions */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title="最近部署"
            extra={
              <Button
                type="link"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate('/middleware/nginx/deployments')}
                style={{ color: 'var(--color-primary)' }}
              >
                查看全部
              </Button>
            }
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (
              <List
                size="small"
                dataSource={stats?.recentDeployments?.slice(0, 6) || []}
                renderItem={(item: Deployment) => (
                  <List.Item style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                      <span
                        className={`status-dot status-dot--${item.status === 'success' ? 'online' : item.status === 'failed' ? 'offline' : 'unknown'}`}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {getDeploymentTypeName(item.type)} → {item.server?.name || '-'}
                        </div>
                      </div>
                      <Tag color={getStatusColor(item.status)} style={{ margin: 0 }}>
                        {getStatusTag(item.status)}
                      </Tag>
                      <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {dayjs(item.created_at).format('MM-DD HH:mm')}
                      </span>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title="快捷操作"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            <Row gutter={[12, 12]}>
              {quickActions.map((action, index) => (
                <Col key={index} xs={12}>
                  <div
                    className="mdk-card"
                    onClick={() => navigate(action.path)}
                    style={{
                      padding: 16,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ marginBottom: 8 }}>{action.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
                      {action.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {action.description}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
