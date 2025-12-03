import { Row, Col, Card, List, Tag, Button, Space, Skeleton } from 'antd';
import {
  AppstoreOutlined,
  CloudServerOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  UploadOutlined,
  SettingOutlined,
  ReloadOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useDashboardData } from '../hooks/useDashboardData';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import StatisticCard from '../components/common/StatisticCard';
import LineChart from '../components/charts/LineChart';
import PieChart from '../components/charts/PieChart';
import { getStatusColor, getRecentDayLabels } from '../utils/chartUtils';
import type { Deployment } from '../types';

const Dashboard = () => {
  const navigate = useNavigate();
  const { stats, loading, fetchData } = useDashboardData();

  // 自动刷新（每30秒）
  useAutoRefresh(fetchData, { interval: 30000, enabled: true });

  // 获取部署类型的中文名称
  const getDeploymentTypeName = (type: string) => {
    const typeMap: Record<string, string> = {
      nginx_config: 'Nginx 配置',
      package: '离线包',
      certificate: '证书',
    };
    return typeMap[type] || type;
  };

  // 渲染快捷操作卡片
  const quickActions = [
    {
      title: '添加服务器',
      icon: <CloudServerOutlined style={{ fontSize: 32, color: '#1890ff' }} />,
      description: '添加新的服务器进行管理',
      path: '/servers',
    },
    {
      title: '上传离线包',
      icon: <UploadOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
      description: '上传中间件离线安装包',
      path: '/middleware/nginx/packages',
    },
    {
      title: '创建部署',
      icon: <RocketOutlined style={{ fontSize: 32, color: '#fa8c16' }} />,
      description: '创建新的部署任务',
      path: '/middleware/nginx/deployments',
    },
    {
      title: 'Nginx 配置',
      icon: <SettingOutlined style={{ fontSize: 32, color: '#722ed1' }} />,
      description: '管理 Nginx 配置文件',
      path: '/middleware/nginx/configs',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题和刷新按钮 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0 }}>仪表盘</h1>
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchData}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      {/* 统计卡片区域 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="中间件总数"
            value={stats?.packagesCount || 0}
            prefix={<AppstoreOutlined />}
            valueStyle={{ color: '#3f8600' }}
            loading={loading}
            onClick={() => navigate('/middleware/nginx/packages')}
            hoverable
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="服务器总数"
            value={stats?.serversTotal || 0}
            suffix={`/ ${stats?.serversOnline || 0} 在线`}
            prefix={<CloudServerOutlined />}
            valueStyle={{ color: '#1890ff' }}
            loading={loading}
            onClick={() => navigate('/servers')}
            hoverable
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="部署任务"
            value={stats?.deploymentsTotal || 0}
            suffix={`/ ${stats?.deploymentsRunning || 0} 进行中`}
            prefix={<RocketOutlined />}
            valueStyle={{ color: '#faad14' }}
            loading={loading}
            onClick={() => navigate('/middleware/nginx/deployments')}
            hoverable
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatisticCard
            title="部署成功率"
            value={stats?.successRate || 0}
            suffix="%"
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
            loading={loading}
          />
        </Col>
      </Row>

      {/* 图表区域 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="部署趋势（最近 7 天）">
            {loading ? (
              <Skeleton active paragraph={{ rows: 8 }} />
            ) : (
              <LineChart
                data={[
                  {
                    name: '成功',
                    data: stats?.trendData.success || [],
                    color: '#52c41a',
                  },
                  {
                    name: '失败',
                    data: stats?.trendData.failed || [],
                    color: '#ff4d4f',
                  },
                ]}
                xAxisData={getRecentDayLabels(7)}
                height={350}
                smooth
                showArea
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="部署状态分布">
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
                height={350}
                showPercentage
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 最近活动和快捷操作 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            title="最近活动"
            extra={
              <Button
                type="link"
                icon={<ArrowRightOutlined />}
                onClick={() => navigate('/middleware/nginx/deployments')}
              >
                查看全部
              </Button>
            }
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 5 }} />
            ) : (
              <List
                dataSource={stats?.recentDeployments || []}
                renderItem={(item: Deployment) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <div>
                          <span>{item.name}</span>
                          <Tag
                            color={getStatusColor(item.status)}
                            style={{ marginLeft: 8 }}
                          >
                            {getStatusTag(item.status)}
                          </Tag>
                        </div>
                      }
                      description={
                        <Space size="middle">
                          <span>
                            类型: {getDeploymentTypeName(item.type)}
                          </span>
                          <span>
                            服务器: {item.server?.name || '-'}
                          </span>
                          <span>
                            时间: {dayjs(item.created_at).format('MM-DD HH:mm')}
                          </span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="快捷操作">
            <Row gutter={[16, 16]}>
              {quickActions.map((action, index) => (
                <Col key={index} xs={24} sm={12}>
                  <Card
                    hoverable
                    onClick={() => navigate(action.path)}
                    style={{
                      textAlign: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ marginBottom: 12 }}>{action.icon}</div>
                    <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
                      {action.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {action.description}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// 辅助函数：获取状态标签文本
function getStatusTag(status: string): string {
  const statusMap: Record<string, string> = {
    pending: '待执行',
    running: '进行中',
    success: '成功',
    failed: '失败',
    cancelled: '已取消',
  };
  return statusMap[status] || status;
}

export default Dashboard;
