import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  message,
  Popconfirm,
  Spin,
  Typography,
  Tooltip,
  Row,
  Col,
  Divider,
  Drawer,
} from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  RollbackOutlined,
  StopOutlined,
  SyncOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getDeploymentList,
  createDeployment,
  deleteDeployment,
  executeDeployment,
  getDeploymentLogs,
  rollbackDeployment,
  cancelDeployment,
} from '../api/deployment';
import { useDeploymentLogs } from '../hooks/useDeploymentLogs';
import { getServerList } from '../api/server';
import { getPackageList, getPackageMetadata } from '../api/package';
import { getCertificateList } from '../api/certificate';
import { ParameterForm } from '../components/deployment/ParameterForm';
import type {
  Deployment,
  DeploymentLog,
  Server,
  MiddlewarePackage,
  Certificate,
  PackageMetadata,
} from '../types';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

const DeploymentsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deployType, setDeployType] = useState<string>('package');
  const [servers, setServers] = useState<Server[]>([]);
  const [packages, setPackages] = useState<MiddlewarePackage[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [currentDeployment, setCurrentDeployment] = useState<Deployment | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [packageMetadata, setPackageMetadata] = useState<PackageMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [, setSelectedPackageId] = useState<number | null>(null);
  const [historicalLogs, setHistoricalLogs] = useState<DeploymentLog[]>([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const logEndRef = useRef<HTMLDivElement>(null);
  const [form] = Form.useForm();

  const {
    logs: realtimeLogs,
    isConnected: sseConnected,
    disconnect: disconnectSSE,
  } = useDeploymentLogs({
    deploymentId: currentDeployment?.id || 0,
    enabled: drawerVisible && currentDeployment?.status === 'running',
    onComplete: () => {
      message.success('部署完成');
      loadDeployments();
    },
  });

  // Auto-scroll log terminal
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [realtimeLogs, historicalLogs]);

  const loadDeployments = async () => {
    try {
      setLoading(true);
      const response = await getDeploymentList({ page, page_size: pageSize });
      setDeployments(response.deployments || []);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.message || '加载部署列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadResources = async () => {
    try {
      const [serverRes, pkgRes, certRes] = await Promise.all([
        getServerList({ page: 1, page_size: 100 }),
        getPackageList({ page: 1, page_size: 100 }),
        getCertificateList({ page: 1, page_size: 100 }),
      ]);
      setServers(serverRes.servers || []);
      setPackages(pkgRes.packages || []);
      setCertificates(certRes.certificates || []);
    } catch (error) {
      console.error('加载资源列表失败', error);
    }
  };

  useEffect(() => {
    loadDeployments();
    loadResources();
  }, [page, pageSize]);

  const loadHistoricalLogs = async (deploymentId: number) => {
    try {
      setLogsLoading(true);
      const logsData = await getDeploymentLogs(deploymentId);
      setHistoricalLogs(logsData || []);
    } catch {
      console.error('加载日志失败');
    } finally {
      setLogsLoading(false);
    }
  };

  const loadPackageMetadata = async (packageId: number) => {
    try {
      setMetadataLoading(true);
      setPackageMetadata(null);
      const metadata = await getPackageMetadata(packageId);
      setPackageMetadata(metadata);
    } catch {
      setPackageMetadata(null);
    } finally {
      setMetadataLoading(false);
    }
  };

  const handlePackageChange = (packageId: number) => {
    setSelectedPackageId(packageId);
    loadPackageMetadata(packageId);
  };

  const handleViewLogs = async (record: Deployment) => {
    setCurrentDeployment(record);
    setDrawerVisible(true);
    if (record.status !== 'running') {
      await loadHistoricalLogs(record.id);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      const result = await cancelDeployment(id);
      message.success(result.message || '正在取消部署');
    } catch (error: any) {
      message.error(error.message || '取消失败');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      let deployParams: string | undefined;
      if (deployType === 'package' && packageMetadata?.parameters) {
        const params: Record<string, any> = {};
        packageMetadata.parameters.forEach((param) => {
          const value = values[param.name];
          if (value !== undefined && value !== null) params[param.name] = value;
        });
        if (Object.keys(params).length > 0) deployParams = JSON.stringify(params);
      }
      await createDeployment({ ...values, deploy_params: deployParams });
      message.success('部署任务创建成功');
      setModalVisible(false);
      form.resetFields();
      setPackageMetadata(null);
      setSelectedPackageId(null);
      loadDeployments();
    } catch (error: any) {
      if (error.message) message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecute = async (record: Deployment) => {
    try {
      await executeDeployment(record.id);
      message.success('部署任务已开始执行');
      loadDeployments();
      handleViewLogs(record);
    } catch (error: any) {
      message.error(error.message || '执行部署失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDeployment(id);
      message.success('删除成功');
      loadDeployments();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleRollback = async (record: Deployment) => {
    try {
      const result = await rollbackDeployment(record.id);
      message.success(result.message || '回滚任务已开始');
      loadDeployments();
      if (result.deployment) handleViewLogs(result.deployment);
    } catch (error: any) {
      message.error(error.message || '回滚失败');
    }
  };

  const renderStatus = (status: string) => {
    const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: '待执行' },
      running: { color: 'processing', icon: <LoadingOutlined />, text: '执行中' },
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
      cancelled: { color: 'warning', icon: <CloseCircleOutlined />, text: '已取消' },
    };
    const item = statusMap[status] || { color: 'default', icon: null, text: status };
    return <Tag color={item.color} icon={item.icon}>{item.text}</Tag>;
  };

  const renderType = (type: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      nginx_config: { color: 'green', text: 'Nginx 配置' },
      package: { color: 'blue', text: '离线包' },
      certificate: { color: 'orange', text: '证书' },
    };
    const item = typeMap[type] || { color: 'default', text: type };
    return <Tag color={item.color}>{item.text}</Tag>;
  };

  const filteredDeployments = deployments.filter((d) => {
    const matchSearch = !searchText || d.name.toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = !statusFilter || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const currentLogs = currentDeployment?.status === 'running' ? realtimeLogs : historicalLogs;

  // Generate terminal log text
  const renderTerminalContent = () => {
    if (currentLogs.length === 0) return '等待日志...';
    return currentLogs.map((log) => {
      const timestamp = new Date(log.created_at).toLocaleTimeString('zh-CN');
      const statusIcon = log.status === 'success' ? '✓' : log.status === 'failed' ? '✗' : log.status === 'running' ? '⟳' : '○';
      const statusClass = log.status === 'success' ? 'log-success' : log.status === 'failed' ? 'log-error' : '';
      let line = `<span class="log-timestamp">[${timestamp}]</span> <span class="${statusClass}">${statusIcon} ${log.action}</span>`;
      if (log.output) line += `\n${log.output}`;
      if (log.error_msg) line += `\n<span class="log-error">${log.error_msg}</span>`;
      return line;
    }).join('\n\n');
  };

  const columns: ColumnsType<Deployment> = [
    {
      title: '任务',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
          )}
        </div>
      ),
    },
    { title: '类型', dataIndex: 'type', key: 'type', width: 110, render: renderType },
    {
      title: '服务器',
      key: 'server',
      width: 140,
      render: (_, record) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {record.server?.name || '-'}
        </span>
      ),
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: renderStatus },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (val) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {val ? `${val}s` : '-'}
        </span>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (val) => (
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {new Date(val).toLocaleString('zh-CN')}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          {(record.status === 'pending' || record.status === 'failed') && (
            <Tooltip title="执行">
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleExecute(record)}
              />
            </Tooltip>
          )}
          <Tooltip title="查看日志">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewLogs(record)} />
          </Tooltip>
          {record.can_rollback && record.status === 'success' && (
            <Popconfirm title="确定要回滚吗？" onConfirm={() => handleRollback(record)}>
              <Tooltip title="回滚">
                <Button size="small" icon={<RollbackOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          {record.status !== 'running' && (
            <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(record.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>部署管理</span>
            <Input
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="搜索任务名"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 180, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
              size="small"
              allowClear
            />
            <Select
              placeholder="状态"
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
              style={{ width: 100 }}
              size="small"
            >
              <Option value="pending">待执行</Option>
              <Option value="running">执行中</Option>
              <Option value="success">成功</Option>
              <Option value="failed">失败</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
          </div>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadDeployments} size="small">
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="small"
              onClick={() => {
                form.resetFields();
                setDeployType('package');
                setPackageMetadata(null);
                setSelectedPackageId(null);
                setModalVisible(true);
              }}
            >
              创建部署
            </Button>
          </Space>
        }
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <Table
          columns={columns}
          dataSource={filteredDeployments}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>

      {/* Create deployment modal */}
      <Modal
        title="创建部署任务"
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: 'package', backup_enabled: true, restart_service: false }}
        >
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="例如：生产环境 Nginx 部署" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="任务描述（可选）" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="部署类型" rules={[{ required: true }]}>
                <Select onChange={(val) => { setDeployType(val); setPackageMetadata(null); setSelectedPackageId(null); }}>
                  <Option value="package">离线包</Option>
                  <Option value="certificate">证书</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="server_id" label="目标服务器" rules={[{ required: true, message: '请选择服务器' }]}>
                <Select placeholder="选择服务器">
                  {servers.map((s) => <Option key={s.id} value={s.id}>{s.name} ({s.host})</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {deployType === 'package' && (
            <>
              <Form.Item name="package_id" label="离线包" rules={[{ required: true, message: '请选择离线包' }]}>
                <Select placeholder="选择离线包" onChange={handlePackageChange} loading={metadataLoading}>
                  {packages.map((p) => <Option key={p.id} value={p.id}>{p.display_name} v{p.version}</Option>)}
                </Select>
              </Form.Item>
              {metadataLoading && <div style={{ textAlign: 'center', padding: 20 }}><Spin tip="加载配置参数..." /></div>}
              {!metadataLoading && packageMetadata && packageMetadata.parameters.length > 0 && (
                <>
                  <Divider>部署参数配置</Divider>
                  <ParameterForm parameters={packageMetadata.parameters} form={form} />
                </>
              )}
            </>
          )}

          {deployType === 'certificate' && (
            <Form.Item name="certificate_id" label="证书" rules={[{ required: true, message: '请选择证书' }]}>
              <Select placeholder="选择证书">
                {certificates.map((c) => <Option key={c.id} value={c.id}>{c.name} ({c.domain})</Option>)}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="target_path" label="目标路径">
            <Input placeholder={deployType === 'certificate' ? '/etc/nginx/ssl' : '/tmp'} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="backup_enabled" valuePropName="checked">
                <Switch checkedChildren="备份" unCheckedChildren="不备份" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="restart_service" valuePropName="checked">
                <Switch checkedChildren="重启服务" unCheckedChildren="不重启" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="service_name" label="服务名">
                <Input placeholder="nginx" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Log Drawer with terminal style */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>部署日志</span>
            {currentDeployment && renderStatus(currentDeployment.status)}
            {currentDeployment?.status === 'running' && sseConnected && (
              <Tag color="blue" icon={<SyncOutlined spin />}>实时</Tag>
            )}
          </div>
        }
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          disconnectSSE();
          setCurrentDeployment(null);
          setHistoricalLogs([]);
        }}
        width={700}
        extra={
          <Space>
            {currentDeployment?.status === 'running' && (
              <Button
                danger
                icon={<StopOutlined />}
                size="small"
                onClick={() => currentDeployment && handleCancel(currentDeployment.id)}
              >
                取消
              </Button>
            )}
            {currentDeployment?.status !== 'running' && (
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={() => currentDeployment && loadHistoricalLogs(currentDeployment.id)}
              >
                刷新
              </Button>
            )}
          </Space>
        }
      >
        {/* Deployment info */}
        {currentDeployment && (
          <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg-tertiary)', borderRadius: 8 }}>
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>任务名称</div>
                <div style={{ fontWeight: 500 }}>{currentDeployment.name}</div>
              </Col>
              <Col span={8}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>服务器</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{currentDeployment.server?.name || '-'}</div>
              </Col>
              <Col span={8}>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>耗时</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                  {currentDeployment.duration ? `${currentDeployment.duration}s` : '-'}
                </div>
              </Col>
            </Row>
            {currentDeployment.error_msg && (
              <div style={{ marginTop: 8 }}>
                <Text type="danger" style={{ fontSize: 12 }}>{currentDeployment.error_msg}</Text>
              </div>
            )}
          </div>
        )}

        {/* Terminal log panel */}
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span>终端日志</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>{currentLogs.length} 条记录</span>
        </div>
        <Spin spinning={logsLoading}>
          <div
            className="terminal-log"
            style={{ minHeight: 400, maxHeight: 'calc(100vh - 320px)' }}
            dangerouslySetInnerHTML={{ __html: renderTerminalContent() }}
          />
          <div ref={logEndRef} />
        </Spin>
      </Drawer>
    </div>
  );
};

export default DeploymentsPage;
