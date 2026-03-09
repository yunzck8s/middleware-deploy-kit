import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Col,
  Select,
  Spin,
  Switch,
  Table,
  Tooltip,
  message,
} from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  RollbackOutlined,
  StopOutlined,
  SearchOutlined,
  SyncOutlined,
  RocketOutlined,
  CloudServerOutlined,
  InboxOutlined,
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
import PageHeader from '../components/common/PageHeader';
import MetricTile from '../components/common/MetricTile';
import SectionCard from '../components/common/SectionCard';
import FilterToolbar from '../components/common/FilterToolbar';
import ActionGroup from '../components/common/ActionGroup';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import TerminalPanel from '../components/common/TerminalPanel';
import type {
  Deployment,
  DeploymentLog,
  Server,
  MiddlewarePackage,
  Certificate,
  PackageMetadata,
} from '../types';
import { formatDateTime, formatDuration } from '../utils/formatters';

const { Option } = Select;
const { TextArea } = Input;

const DeploymentsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deployType, setDeployType] = useState<'package' | 'certificate'>('package');
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

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [realtimeLogs, historicalLogs]);

  const loadDeployments = async () => {
    try {
      setLoading(true);
      const response = await getDeploymentList({ page: 1, page_size: 1000 });
      setDeployments(response.deployments || []);
      setTotal(response.deployments?.length || 0);
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
        getPackageList({ name: 'nginx', page: 1, page_size: 100 }),
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
  }, []);

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
      loadDeployments();
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

      await createDeployment({ ...values, deploy_params: deployParams } as any);
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

  const filteredDeployments = useMemo(() => {
    return deployments.filter((deployment) => {
      const matchesSearch = !searchText || deployment.name.toLowerCase().includes(searchText.toLowerCase());
      const matchesStatus = !statusFilter || deployment.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [deployments, searchText, statusFilter]);

  const statusSummary = useMemo(() => ({
    pending: deployments.filter((item) => item.status === 'pending').length,
    running: deployments.filter((item) => item.status === 'running').length,
    success: deployments.filter((item) => item.status === 'success').length,
    failed: deployments.filter((item) => item.status === 'failed').length,
  }), [deployments]);

  const currentLogs = currentDeployment?.status === 'running' ? realtimeLogs : historicalLogs;

  const renderTerminalContent = () => {
    if (currentLogs.length === 0) return '等待日志...';
    return currentLogs
      .map((log) => {
        const timestamp = new Date(log.created_at).toLocaleTimeString('zh-CN');
        const statusIcon = log.status === 'success' ? '✓' : log.status === 'failed' ? '✗' : log.status === 'running' ? '⟳' : '○';
        const statusClass = log.status === 'success' ? 'log-success' : log.status === 'failed' ? 'log-error' : 'log-warning';
        let line = `<span class="log-timestamp">[${timestamp}]</span> <span class="${statusClass}">${statusIcon} ${log.action}</span>`;
        if (log.output) line += `\n${log.output}`;
        if (log.error_msg) line += `\n<span class="log-error">${log.error_msg}</span>`;
        return line;
      })
      .join('\n\n');
  };

  const handleCopyLogs = async () => {
    const plain = currentLogs
      .map((log) => [log.action, log.output, log.error_msg].filter(Boolean).join('\n'))
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(plain);
      message.success('日志已复制');
    } catch {
      message.error('复制失败');
    }
  };

  const columns: ColumnsType<Deployment> = [
    {
      title: '任务',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 700 }}>{text}</div>
          <div style={{ marginTop: 6, color: 'var(--text-secondary)' }}>{record.description || '未填写任务描述'}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (value: string) => <StatusBadge status={value === 'package' ? 'info' : 'warning'} label={value === 'package' ? '离线包' : '证书'} compact />,
    },
    {
      title: '服务器',
      key: 'server',
      width: 180,
      render: (_, record) => (
        <div>
          <div>{record.server?.name || '-'}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{record.server?.host || '未记录地址'}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (value: string) => <StatusBadge status={value} compact />,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      render: (value: number) => <span className="mono">{value ? formatDuration(value) : '-'}</span>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 168,
      render: (value: string) => <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(value, 'YYYY-MM-DD HH:mm')}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_, record) => (
        <ActionGroup>
          {(record.status === 'pending' || record.status === 'failed') && (
            <Tooltip title="执行">
              <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handleExecute(record)} />
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
        </ActionGroup>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="部署任务管理"
        title="部署控制室"
        subtitle="围绕创建、执行、取消、回滚和实时日志展示 Nginx 离线部署全流程。"
        actions={(
          <ActionGroup>
            <Button icon={<ReloadOutlined />} onClick={loadDeployments}>刷新</Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
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
          </ActionGroup>
        )}
      />

      <div className="metric-grid metric-grid--cols-4">
        <MetricTile label="任务总量" value={total} hint="所有已记录部署任务" icon={<RocketOutlined />} loading={loading} />
        <MetricTile label="待执行" value={statusSummary.pending} hint="尚未开始的任务" icon={<InboxOutlined />} tone="warning" loading={loading} />
        <MetricTile label="运行中" value={statusSummary.running} hint="正在流式输出日志的任务" icon={<SyncOutlined spin />} tone="info" loading={loading} />
        <MetricTile label="执行成功" value={statusSummary.success} hint="已完成并通过执行流程" icon={<CloudServerOutlined />} tone="success" loading={loading} />
      </div>

      <SectionCard title="任务列表" subtitle="按状态过滤部署任务，并快速进入日志或回滚动作。" className="ops-table">
        <FilterToolbar
          left={(
            <>
              <Input
                prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
                placeholder="搜索任务名称"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                style={{ width: 220 }}
                allowClear
              />
              <Select
                placeholder="部署状态"
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
                style={{ width: 150 }}
              >
                <Option value="pending">待执行</Option>
                <Option value="running">执行中</Option>
                <Option value="success">成功</Option>
                <Option value="failed">失败</Option>
                <Option value="cancelled">已取消</Option>
              </Select>
            </>
          )}
          right={<span className="summary-card__hint">日志抽屉会自动连接运行中任务的 SSE 流</span>}
        />

        {filteredDeployments.length === 0 && !loading ? (
          <EmptyState title="还没有部署任务" description="从离线包或证书创建第一个部署任务，然后在这里跟踪执行进度和日志。" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>创建第一个部署</Button>} />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredDeployments}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{
              current: page,
              pageSize,
              total: filteredDeployments.length,
              showSizeChanger: true,
              showTotal: (count) => `共 ${count} 条任务`,
              onChange: (currentPage, currentPageSize) => {
                setPage(currentPage);
                setPageSize(currentPageSize);
              },
            }}
          />
        )}
      </SectionCard>

      <Modal
        title="创建部署任务"
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={720}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ type: 'package', backup_enabled: true, restart_service: false }}
        >
          <div className="page-stack" style={{ gap: 16 }}>
            <div className="config-section-card">
              <div className="config-section-card__title">任务基础信息</div>
              <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
                <Input placeholder="例如：生产环境 Nginx 包部署" />
              </Form.Item>
              <Form.Item name="description" label="任务说明">
                <TextArea rows={2} placeholder="描述部署目标、批次或变更说明" />
              </Form.Item>
            </div>

            <div className="config-section-card">
              <div className="config-section-card__title">部署目标</div>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="type" label="部署类型" rules={[{ required: true }]}>
                    <Select onChange={(value) => { setDeployType(value); setPackageMetadata(null); setSelectedPackageId(null); }}>
                      <Option value="package">离线包</Option>
                      <Option value="certificate">证书</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="server_id" label="目标服务器" rules={[{ required: true, message: '请选择服务器' }]}>
                    <Select placeholder="选择服务器">
                      {servers.map((server) => <Option key={server.id} value={server.id}>{server.name} ({server.host})</Option>)}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              {deployType === 'package' && (
                <>
                  <Form.Item name="package_id" label="离线包" rules={[{ required: true, message: '请选择离线包' }]}>
                    <Select placeholder="选择离线包" onChange={handlePackageChange} loading={metadataLoading}>
                      {packages.map((pkg) => <Option key={pkg.id} value={pkg.id}>{pkg.display_name} v{pkg.version}</Option>)}
                    </Select>
                  </Form.Item>
                  {metadataLoading && <div style={{ textAlign: 'center', padding: 20 }}><Spin tip="加载部署参数..." /></div>}
                  {!metadataLoading && packageMetadata && packageMetadata.parameters.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div className="summary-card__label" style={{ marginBottom: 12 }}>metadata 参数</div>
                      <ParameterForm parameters={packageMetadata.parameters} form={form} />
                    </div>
                  )}
                </>
              )}

              {deployType === 'certificate' && (
                <Form.Item name="certificate_id" label="证书" rules={[{ required: true, message: '请选择证书' }]}>
                  <Select placeholder="选择证书">
                    {certificates.map((certificate) => <Option key={certificate.id} value={certificate.id}>{certificate.name} ({certificate.domain})</Option>)}
                  </Select>
                </Form.Item>
              )}
            </div>

            <div className="config-section-card">
              <div className="config-section-card__title">执行选项</div>
              <Form.Item name="target_path" label="目标路径">
                <Input placeholder={deployType === 'certificate' ? '/etc/nginx/ssl' : '/tmp'} className="mono" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="backup_enabled" valuePropName="checked" label="部署前备份">
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="restart_service" valuePropName="checked" label="重启服务">
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="service_name" label="服务名">
                    <Input placeholder="nginx" className="mono" />
                  </Form.Item>
                </Col>
              </Row>
            </div>
          </div>
        </Form>
      </Modal>

      <Drawer
        title={currentDeployment ? `部署日志 · ${currentDeployment.name}` : '部署日志'}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          disconnectSSE();
          setCurrentDeployment(null);
          setHistoricalLogs([]);
        }}
        width={860}
        extra={(
          <ActionGroup>
            {currentDeployment?.status === 'running' && (
              <Button danger icon={<StopOutlined />} onClick={() => currentDeployment && handleCancel(currentDeployment.id)}>
                取消部署
              </Button>
            )}
            {currentDeployment?.status !== 'running' && currentDeployment && (
              <Button icon={<ReloadOutlined />} onClick={() => loadHistoricalLogs(currentDeployment.id)}>
                刷新日志
              </Button>
            )}
          </ActionGroup>
        )}
      >
        <div className="page-stack" style={{ gap: 16 }}>
          {currentDeployment && (
            <div className="resource-summary">
              <div className="summary-card">
                <div className="summary-card__label">任务状态</div>
                <div style={{ marginTop: 10 }}><StatusBadge status={currentDeployment.status} /></div>
                {currentDeployment.error_msg && <div className="summary-card__hint">{currentDeployment.error_msg}</div>}
              </div>
              <div className="summary-card">
                <div className="summary-card__label">目标服务器</div>
                <div className="summary-card__value" style={{ fontSize: 18 }}>{currentDeployment.server?.name || '-'}</div>
                <div className="summary-card__hint">{currentDeployment.server?.host || '未记录地址'}</div>
              </div>
              <div className="summary-card">
                <div className="summary-card__label">执行耗时</div>
                <div className="summary-card__value" style={{ fontSize: 18 }}>{currentDeployment.duration ? formatDuration(currentDeployment.duration) : '-'}</div>
                <div className="summary-card__hint">日志记录数 {currentLogs.length}</div>
              </div>
            </div>
          )}

          <TerminalPanel
            title="终端日志"
            subtitle={currentDeployment?.status === 'running' ? 'SSE 实时流已连接，日志会自动滚动到最新位置。' : '显示任务执行后的持久化日志。'}
            meta={(
              <>
                {currentDeployment?.status === 'running' && sseConnected && <StatusBadge status="running" label="实时连接中" compact />}
                <span className="summary-card__hint">{currentLogs.length} 条记录</span>
              </>
            )}
            htmlContent={renderTerminalContent()}
            height={500}
            onCopy={currentLogs.length ? handleCopyLogs : undefined}
          />
          <div ref={logEndRef} />
          {logsLoading && <Spin tip="加载日志中..." />}
        </div>
      </Drawer>
    </div>
  );
};

export default DeploymentsPage;
