import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Space,
  Tag,
  Select,
  Button,
  Modal,
  Steps,
  Spin,
  Typography,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  EyeOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { getDeploymentList, getDeploymentLogs } from '../api/deployment';
import type { Deployment, DeploymentLog } from '../types';

const { Option } = Select;
const { Text } = Typography;

const DeploymentHistoryPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // 统计
  const [stats, setStats] = useState({ success: 0, failed: 0, total: 0 });

  // 日志查看
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [currentDeployment, setCurrentDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // 加载部署历史
  const loadHistory = async () => {
    try {
      setLoading(true);
      const params: any = { page, page_size: pageSize };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.type = typeFilter;

      const response = await getDeploymentList(params);
      const data = response.deployments || [];
      setDeployments(data);
      setTotal(response.total);

      // 计算统计
      const successCount = data.filter((d) => d.status === 'success').length;
      const failedCount = data.filter((d) => d.status === 'failed').length;
      setStats({
        success: successCount,
        failed: failedCount,
        total: data.length,
      });
    } catch (error: any) {
      console.error('加载部署历史失败', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [page, pageSize, statusFilter, typeFilter]);

  // 加载日志
  const loadLogs = async (deploymentId: number) => {
    try {
      setLogsLoading(true);
      const logsData = await getDeploymentLogs(deploymentId);
      setLogs(logsData || []);
    } catch (error) {
      console.error('加载日志失败', error);
    } finally {
      setLogsLoading(false);
    }
  };

  // 查看详情
  const handleViewDetail = async (record: Deployment) => {
    setCurrentDeployment(record);
    setLogModalVisible(true);
    await loadLogs(record.id);
  };

  // 状态标签
  const renderStatus = (status: string) => {
    const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: { color: 'default', icon: null, text: '待执行' },
      running: { color: 'processing', icon: null, text: '执行中' },
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
      cancelled: { color: 'warning', icon: null, text: '已取消' },
    };
    const item = statusMap[status] || { color: 'default', icon: null, text: status };
    return (
      <Tag color={item.color} icon={item.icon}>
        {item.text}
      </Tag>
    );
  };

  // 类型标签
  const renderType = (type: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      nginx_config: { color: 'green', text: 'Nginx 配置' },
      package: { color: 'blue', text: '离线包' },
      certificate: { color: 'orange', text: '证书' },
    };
    const item = typeMap[type] || { color: 'default', text: type };
    return <Tag color={item.color}>{item.text}</Tag>;
  };

  // 日志步骤状态
  const getStepStatus = (log: DeploymentLog) => {
    switch (log.status) {
      case 'success':
        return 'finish';
      case 'failed':
        return 'error';
      case 'running':
        return 'process';
      default:
        return 'wait';
    }
  };

  const columns: ColumnsType<Deployment> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div>{text}</div>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: renderType,
    },
    {
      title: '目标服务器',
      key: 'server',
      width: 150,
      render: (_, record) => record.server?.name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: renderStatus,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (val) => (val ? `${val}s` : '-'),
    },
    {
      title: '开始时间',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 170,
      render: (val) => (val ? new Date(val).toLocaleString() : '-'),
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 170,
      render: (val) => (val ? new Date(val).toLocaleString() : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总部署次数"
              value={total}
              prefix={<HistoryOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="成功次数"
              value={stats.success}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="失败次数"
              value={stats.failed}
              valueStyle={{ color: '#cf1322' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="部署历史"
        extra={
          <Space>
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 120 }}
              value={statusFilter || undefined}
              onChange={(val) => setStatusFilter(val || '')}
            >
              <Option value="success">成功</Option>
              <Option value="failed">失败</Option>
              <Option value="pending">待执行</Option>
              <Option value="running">执行中</Option>
            </Select>
            <Select
              placeholder="类型筛选"
              allowClear
              style={{ width: 120 }}
              value={typeFilter || undefined}
              onChange={(val) => setTypeFilter(val || '')}
            >
              <Option value="nginx_config">Nginx 配置</Option>
              <Option value="package">离线包</Option>
              <Option value="certificate">证书</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={loadHistory}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={deployments}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title={`部署详情 - ${currentDeployment?.name || ''}`}
        open={logModalVisible}
        onCancel={() => {
          setLogModalVisible(false);
          setCurrentDeployment(null);
        }}
        footer={[
          <Button key="close" onClick={() => setLogModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        <Spin spinning={logsLoading}>
          {currentDeployment && (
            <div style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Text type="secondary">状态：</Text>
                  {renderStatus(currentDeployment.status)}
                </Col>
                <Col span={8}>
                  <Text type="secondary">类型：</Text>
                  {renderType(currentDeployment.type)}
                </Col>
                <Col span={8}>
                  <Text type="secondary">耗时：</Text>
                  {currentDeployment.duration > 0
                    ? `${currentDeployment.duration}s`
                    : '-'}
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={12}>
                  <Text type="secondary">目标服务器：</Text>
                  {currentDeployment.server?.name} ({currentDeployment.server?.host})
                </Col>
                <Col span={12}>
                  <Text type="secondary">目标路径：</Text>
                  {currentDeployment.target_path}
                </Col>
              </Row>
              {currentDeployment.error_msg && (
                <div style={{ marginTop: 8 }}>
                  <Text type="danger">错误信息：{currentDeployment.error_msg}</Text>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Text strong>执行步骤：</Text>
          </div>
          <Steps
            direction="vertical"
            size="small"
            style={{ marginTop: 8 }}
            items={logs.map((log) => ({
              title: log.action,
              status: getStepStatus(log),
              description: (
                <div>
                  {log.output && (
                    <pre
                      style={{
                        background: '#f5f5f5',
                        padding: 8,
                        borderRadius: 4,
                        fontSize: 12,
                        maxHeight: 100,
                        overflow: 'auto',
                        margin: '4px 0',
                      }}
                    >
                      {log.output}
                    </pre>
                  )}
                  {log.error_msg && <Text type="danger">{log.error_msg}</Text>}
                </div>
              ),
            }))}
          />
          {logs.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              暂无执行记录
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default DeploymentHistoryPage;
