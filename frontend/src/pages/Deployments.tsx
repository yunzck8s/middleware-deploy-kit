import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Col,
  Segmented,
  Select,
  Space,
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
  AppstoreOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getDeploymentList,
  getDeploymentDetail,
  createDeployment,
  deleteDeployment,
  executeDeployment,
  getDeploymentLogs,
  rollbackDeployment,
  cancelDeployment,
  batchCreateDeployment,
} from '../api/deployment';
import { useDeploymentLogs } from '../hooks/useDeploymentLogs';
import { getServerList } from '../api/server';
import { getPackageList, getPackageMetadata } from '../api/package';
import { getCertificateList } from '../api/certificate';
import { getNginxDeployInfo } from '../api/nginx';
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
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<number | null>(null);
  const [currentDeploymentSnapshot, setCurrentDeploymentSnapshot] = useState<Deployment | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [packageMetadata, setPackageMetadata] = useState<PackageMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [, setSelectedPackageId] = useState<number | null>(null);
  const [historicalLogs, setHistoricalLogs] = useState<DeploymentLog[]>([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [batchMode, setBatchMode] = useState(false);
  const [selectedServerIds, setSelectedServerIds] = useState<number[]>([]);
  const [selectedDeploymentIds, setSelectedDeploymentIds] = useState<number[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [form] = Form.useForm();
  const onCompleteRef = useRef<() => void>(() => {});

  const currentDeployment = useMemo(() => {
    if (currentDeploymentSnapshot?.id === selectedDeploymentId) {
      return currentDeploymentSnapshot;
    }
    if (selectedDeploymentId === null) {
      return null;
    }
    return deployments.find((item) => item.id === selectedDeploymentId) ?? null;
  }, [currentDeploymentSnapshot, deployments, selectedDeploymentId]);

  const handleRealtimeComplete = useCallback(() => {
    onCompleteRef.current();
  }, []);

  const {
    logs: realtimeLogs,
    isConnected: sseConnected,
    disconnect: disconnectSSE,
  } = useDeploymentLogs({
    deploymentId: currentDeployment?.id || 0,
    enabled: drawerVisible && currentDeployment?.status === 'running',
    onComplete: handleRealtimeComplete,
  });

  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [realtimeLogs, historicalLogs, autoScroll]);

  const handleLogScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const loadDeployments = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await getDeploymentList({ page: 1, page_size: 1000 });
      setDeployments(response.deployments || []);
      setTotal(response.deployments?.length || 0);
    } catch (error: any) {
      if (!silent) message.error(error.message || '暂时无法加载部署列表');
    } finally {
      if (!silent) setLoading(false);
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

  useEffect(() => {
    const hasRunning = deployments.some((d) => d.status === 'running');
    if (!hasRunning) return;

    const timer = setInterval(() => {
      loadDeployments(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [deployments]);

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

  const loadDeploymentDetail = async (deploymentId: number) => {
    try {
      const detail = await getDeploymentDetail(deploymentId);
      setCurrentDeploymentSnapshot(detail);
      return detail;
    } catch (error) {
      console.error('加载部署详情失败', error);
      return null;
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

  const handleServerChange = async (serverId: number) => {
    if (deployType !== 'certificate') return;
    try {
      const info = await getNginxDeployInfo(serverId);
      const installDir = info.deploy_params?.NGINX_INSTALL_DIR || '/usr/local/nginx';
      form.setFieldValue('target_path', installDir + '/ssl');
    } catch {
      form.setFieldValue('target_path', '/usr/local/nginx/ssl');
    }
  };

  onCompleteRef.current = () => {
    message.success('部署已完成，可查看日志确认结果');
    void loadDeployments();

    if (!selectedDeploymentId) {
      return;
    }

    void (async () => {
      const detail = await loadDeploymentDetail(selectedDeploymentId);
      if (detail && detail.status !== 'running') {
        await loadHistoricalLogs(selectedDeploymentId);
      }
    })();
  };

  const openDeploymentLogs = async (
    record: Deployment,
    options?: { optimisticStatus?: Deployment['status'] },
  ) => {
    const optimisticStatus = options?.optimisticStatus;
    const initialDeployment = optimisticStatus
      ? { ...record, status: optimisticStatus, error_msg: '' }
      : record;

    setSelectedDeploymentId(record.id);
    setCurrentDeploymentSnapshot(initialDeployment);
    setHistoricalLogs([]);
    setDrawerVisible(true);

    const detail = await loadDeploymentDetail(record.id);
    const resolvedDeployment = detail
      ? optimisticStatus === 'running' && detail.status === 'pending'
        ? { ...detail, status: 'running' as const }
        : detail
      : initialDeployment;

    setCurrentDeploymentSnapshot(resolvedDeployment);

    if (resolvedDeployment.status !== 'running') {
      await loadHistoricalLogs(record.id);
    }
  };

  const handleViewLogs = async (record: Deployment) => {
    await openDeploymentLogs(record);
  };

  const handleCancel = async (id: number) => {
    try {
      const result = await cancelDeployment(id);
      message.success(result.message || '已发送取消请求，请等待任务停止');
      void loadDeployments();

      if (selectedDeploymentId === id) {
        const detail = await loadDeploymentDetail(id);
        if (detail && detail.status !== 'running') {
          await loadHistoricalLogs(id);
        }
      }
    } catch (error: any) {
      message.error(error.message || '取消部署失败');
    }
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();

      if (batchMode && selectedServerIds.length === 0) {
        message.error('请至少选择一台服务器');
        return;
      }

      setSubmitting(true);
      let deployParams: string | undefined;

      if (deployType === 'package' && packageMetadata?.parameters) {
        const params: Record<string, any> = {};
        packageMetadata.parameters.forEach((param) => {
          const value = values[param.name];
          params[param.name] = (value !== undefined && value !== null) ? value : param.default;
        });
        deployParams = JSON.stringify(params);
      }

      if (batchMode) {
        await batchCreateDeployment({
          server_ids: selectedServerIds,
          name: values.name,
          description: values.description,
          type: deployType,
          package_id: deployType === 'package' ? values.package_id : undefined,
          certificate_id: deployType === 'certificate' ? values.certificate_id : undefined,
          target_path: values.target_path,
          deploy_params: deployParams,
          auto_execute: false,
        });
        message.success(`成功创建 ${selectedServerIds.length} 个部署任务`);
      } else {
        await createDeployment({ ...values, deploy_params: deployParams } as any);
        message.success('部署任务已创建，可立即执行');
      }

      setModalVisible(false);
      form.resetFields();
      setBatchMode(false);
      setSelectedServerIds([]);
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
      message.success('已开始执行部署任务，正在打开日志');
      void loadDeployments();
      await openDeploymentLogs(record, { optimisticStatus: 'running' });
    } catch (error: any) {
      message.error(error.message || '启动部署失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDeployment(id);
      message.success('部署任务已删除');
      loadDeployments();
    } catch (error: any) {
      message.error(error.message || '删除部署任务失败');
    }
  };

  const handleBatchExecute = async () => {
    if (selectedDeploymentIds.length === 0) {
      message.warning('请先选择要执行的任务');
      return;
    }
    try {
      for (const id of selectedDeploymentIds) {
        await executeDeployment(id);
      }
      message.success(`已启动 ${selectedDeploymentIds.length} 个部署任务`);
      setSelectedDeploymentIds([]);
      loadDeployments();
    } catch (error: any) {
      message.error(error.message || '批量执行失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedDeploymentIds.length === 0) {
      message.warning('请先选择要删除的任务');
      return;
    }
    Modal.confirm({
      title: '确认批量删除',
      content: `确定要删除选中的 ${selectedDeploymentIds.length} 个部署任务吗？删除后任务记录和日志将一并移除，此操作不可恢复。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          for (const id of selectedDeploymentIds) {
            await deleteDeployment(id);
          }
          message.success(`已删除 ${selectedDeploymentIds.length} 个部署任务`);
          setSelectedDeploymentIds([]);
          loadDeployments();
        } catch (error: any) {
          message.error(error.message || '批量删除失败');
        }
      },
    });
  };

  const handleRollback = async (record: Deployment) => {
    try {
      const result = await rollbackDeployment(record.id);
      message.success(result.message || '已创建回滚任务，正在打开日志');
      void loadDeployments();
      if (result.deployment) {
        await openDeploymentLogs(result.deployment);
      }
    } catch (error: any) {
      message.error(error.message || '回滚失败，请检查日志');
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
      message.success('日志已复制到剪贴板');
    } catch {
      message.error('复制日志失败');
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
          <div style={{ marginTop: 6, color: 'var(--text-secondary)' }}>{record.description || '未填写说明'}</div>
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
      title: '安装目录',
      key: 'install_dir',
      width: 200,
      render: (_, record) => {
        let path = record.target_path;
        if (record.type === 'package' && record.deploy_params) {
          try {
            const params = JSON.parse(record.deploy_params);
            if (params.NGINX_INSTALL_DIR) path = params.NGINX_INSTALL_DIR;
          } catch {
            // keep target_path
          }
        }
        return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{path || '-'}</span>;
      },
    },
    {
      title: '服务器',
      key: 'server',
      width: 180,
      render: (_, record) => (
        <div>
          <div>{record.server?.name || '-'}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{record.server?.host || '未填写地址'}</div>
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
            <Tooltip title="开始执行这个部署任务">
              <Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handleExecute(record)} aria-label="执行部署任务" />
            </Tooltip>
          )}
          <Tooltip title="打开这个任务的日志">
            <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewLogs(record)} aria-label="查看部署日志" />
          </Tooltip>
          {record.can_rollback && record.status === 'success' && (
            <Popconfirm title={`回滚任务“${record.name}”会重新执行上一个可用版本。确定继续吗？`} onConfirm={() => handleRollback(record)} okText="继续回滚" cancelText="取消">
              <Tooltip title="回滚到上一个可用版本">
                <Button size="small" icon={<RollbackOutlined />} aria-label="回滚部署任务" />
              </Tooltip>
            </Popconfirm>
          )}
          {record.status !== 'running' && (
            <Popconfirm title={`删除任务“${record.name}”后，任务记录和日志将一并移除。确定删除吗？`} onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
              <Tooltip title="删除这个部署任务">
                <Button size="small" danger icon={<DeleteOutlined />} aria-label="删除部署任务" />
              </Tooltip>
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
        title="部署任务"
        subtitle="在一个视图里创建、执行、取消和回滚部署，并持续查看实时日志。"
        actions={(
          <ActionGroup>
            <Button icon={<ReloadOutlined />} onClick={() => loadDeployments()}>刷新</Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                setDeployType('package');
                setPackageMetadata(null);
                setSelectedPackageId(null);
                setBatchMode(false);
                setSelectedServerIds([]);
                setModalVisible(true);
              }}
            >
              新建部署任务
            </Button>
          </ActionGroup>
        )}
      />

      <div className="metric-grid metric-grid--cols-4">
        <MetricTile label="任务总量" value={total} hint="所有已记录部署任务" icon={<RocketOutlined />} loading={loading} />
        <MetricTile label="待执行" value={statusSummary.pending} hint="尚未开始的任务" icon={<InboxOutlined />} tone="warning" loading={loading} />
        <MetricTile label="运行中" value={statusSummary.running} hint="正在流式输出日志的任务" icon={<SyncOutlined spin />} tone="info" loading={loading} />
        <MetricTile label="已完成" value={statusSummary.success} hint="执行完成且结果正常" icon={<CloudServerOutlined />} tone="success" loading={loading} />
      </div>

      <SectionCard title="部署任务列表" subtitle="按状态筛选部署任务，并快速进入日志、执行或回滚操作。" className="ops-table">
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
                <Option value="success">已完成</Option>
                <Option value="failed">执行失败</Option>
                <Option value="cancelled">已取消</Option>
              </Select>
            </>
          )}
          right={<span className="summary-card__hint">查看运行中的任务时，会自动接入实时日志</span>}
        />

        {filteredDeployments.length === 0 && !loading ? (
          <EmptyState title="还没有部署任务" description="从离线包或证书新建一个部署任务，然后在这里跟踪执行进度和日志。" action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>新建第一个部署任务</Button>} />
        ) : (
          <>
            {selectedDeploymentIds.length > 0 && (
              <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>已选择 {selectedDeploymentIds.length} 个任务</span>
                <Space>
                  <Button icon={<PlayCircleOutlined />} onClick={handleBatchExecute}>批量执行</Button>
                  <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>批量删除</Button>
                  <Button onClick={() => setSelectedDeploymentIds([])}>取消选择</Button>
                </Space>
              </div>
            )}
            <Table
              columns={columns}
              dataSource={filteredDeployments}
              rowKey="id"
              loading={loading}
              size="middle"
              rowSelection={{
                selectedRowKeys: selectedDeploymentIds,
                onChange: (keys) => setSelectedDeploymentIds(keys as number[]),
              }}
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
          </>
        )}
      </SectionCard>

      <Modal
        title="新建部署任务"
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
            <div className="config-section-card" style={{ background: 'var(--bg-elevated)', border: '2px solid var(--border-color)', padding: '16px' }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>部署模式</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>单服务器或批量部署</div>
              </div>
              <Segmented
                value={batchMode ? 'batch' : 'single'}
                onChange={(value) => {
                  const isBatch = value === 'batch';
                  setBatchMode(isBatch);
                  form.setFieldValue('server_id', undefined);
                  setSelectedServerIds([]);
                }}
                block
                options={[
                  {
                    label: (
                      <div style={{ padding: '4px 0' }}>
                        <CloudServerOutlined style={{ fontSize: 16, marginRight: 6 }} />
                        <span>单服务器</span>
                      </div>
                    ),
                    value: 'single',
                  },
                  {
                    label: (
                      <div style={{ padding: '4px 0' }}>
                        <AppstoreOutlined style={{ fontSize: 16, marginRight: 6 }} />
                        <span>批量部署</span>
                      </div>
                    ),
                    value: 'batch',
                  },
                ]}
              />
            </div>

            <div className="config-section-card">
              <div className="config-section-card__title">基本信息</div>
              <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]} extra="建议写清环境、对象和动作，方便后续排查">
                <Input placeholder="例如：生产环境 Nginx 1.28.0 升级" />
              </Form.Item>
              <Form.Item name="description" label="任务说明" extra="可选，补充变更范围、批次或注意事项">
                <TextArea rows={2} placeholder="例如：灰度批次 1，升级主站 Nginx" />
              </Form.Item>
            </div>

            <div className="config-section-card">
              <div className="config-section-card__title">部署对象</div>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="type" label="部署内容" rules={[{ required: true }]} extra="选择这次部署要下发的内容类型">
                    <Select onChange={(value) => { setDeployType(value); setPackageMetadata(null); setSelectedPackageId(null); }}>
                      <Option value="package">离线包</Option>
                      <Option value="certificate">证书</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  {!batchMode ? (
                    <Form.Item name="server_id" label="目标服务器" rules={[{ required: true, message: '请选择目标服务器' }]} extra="部署会在这台服务器上执行">
                      <Select placeholder="选择一台服务器" onChange={handleServerChange}>
                        {servers.map((server) => <Option key={server.id} value={server.id}>{server.name} ({server.host})</Option>)}
                      </Select>
                    </Form.Item>
                  ) : (
                    <Form.Item label="目标服务器" required extra="选择要批量部署的服务器">
                      <Checkbox.Group
                        value={selectedServerIds}
                        onChange={(values) => setSelectedServerIds(values as number[])}
                        style={{ width: '100%' }}
                      >
                        <Space direction="vertical" style={{ width: '100%' }}>
                          {servers.map((server) => (
                            <Checkbox key={server.id} value={server.id}>
                              {server.name} ({server.host})
                            </Checkbox>
                          ))}
                        </Space>
                      </Checkbox.Group>
                      {selectedServerIds.length === 0 && <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>请至少选择一台服务器</div>}
                    </Form.Item>
                  )}
                </Col>
              </Row>

              {deployType === 'package' && (
                <>
                  <Form.Item name="package_id" label="离线包" rules={[{ required: true, message: '请选择离线包' }]} extra="选择要部署到目标服务器的 Nginx 离线包">
                    <Select placeholder="选择一个离线包" onChange={handlePackageChange} loading={metadataLoading}>
                      {packages.map((pkg) => <Option key={pkg.id} value={pkg.id}>{pkg.display_name} v{pkg.version}</Option>)}
                    </Select>
                  </Form.Item>
                  {metadataLoading && <div style={{ textAlign: 'center', padding: 20 }}><Spin tip="正在读取部署参数..." /></div>}
                  {!metadataLoading && packageMetadata && packageMetadata.parameters.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div className="summary-card__label" style={{ marginBottom: 12 }}>部署参数</div>
                      <ParameterForm parameters={packageMetadata.parameters} form={form} />
                    </div>
                  )}
                </>
              )}

              {deployType === 'certificate' && (
                <Form.Item name="certificate_id" label="证书" rules={[{ required: true, message: '请选择证书' }]} extra="选择要部署到服务器的证书和私钥">
                  <Select placeholder="选择一个证书">
                    {certificates.map((certificate) => <Option key={certificate.id} value={certificate.id}>{certificate.name} ({certificate.domain})</Option>)}
                  </Select>
                </Form.Item>
              )}
            </div>

            <div className="config-section-card">
              <div className="config-section-card__title">执行选项</div>
              <Form.Item name="target_path" label="部署目标路径" extra="留空时根据服务器 Nginx 安装目录自动推导">
                <Input placeholder={deployType === 'certificate' ? '{nginx安装目录}/ssl' : '/tmp'} className="mono" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="backup_enabled" valuePropName="checked" label="部署前先备份">
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="restart_service" valuePropName="checked" label="部署后重启服务">
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="service_name" label="服务名称" extra="通常为 nginx；如果是 OpenResty，可改为 openresty">
                    <Input placeholder="例如：nginx" className="mono" />
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
          setSelectedDeploymentId(null);
          setCurrentDeploymentSnapshot(null);
          setHistoricalLogs([]);
        }}
        width={860}
        extra={(
          <ActionGroup>
            {currentDeployment?.status === 'running' && (
              <Button danger icon={<StopOutlined />} onClick={() => currentDeployment && handleCancel(currentDeployment.id)}>
                停止任务
              </Button>
            )}
            {currentDeployment?.status !== 'running' && currentDeployment && (
              <Button icon={<ReloadOutlined />} onClick={() => loadHistoricalLogs(currentDeployment.id)}>
                重新加载日志
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
                <div className="summary-card__hint">{currentDeployment.server?.host || '未填写地址'}</div>
              </div>
              <div className="summary-card">
                <div className="summary-card__label">执行耗时</div>
                <div className="summary-card__value" style={{ fontSize: 18 }}>{currentDeployment.duration ? formatDuration(currentDeployment.duration) : '-'}</div>
                <div className="summary-card__hint">共 {currentLogs.length} 条日志</div>
              </div>
            </div>
          )}

          <TerminalPanel
            title="终端日志"
            subtitle={currentDeployment?.status === 'running' ? '已连接实时日志，页面会自动滚动到最新输出。' : '这里显示任务结束后保存的日志。'}
            meta={(
              <>
                {currentDeployment?.status === 'running' && sseConnected && <StatusBadge status="running" label="实时日志已连接" compact />}
                <span className="summary-card__hint">共 {currentLogs.length} 条日志</span>
              </>
            )}
            htmlContent={renderTerminalContent()}
            height={500}
            onCopy={currentLogs.length ? handleCopyLogs : undefined}
            onScroll={handleLogScroll}
          />
          <div ref={logEndRef} />
          {logsLoading && <Spin tip="正在加载日志..." />}
        </div>
      </Drawer>
    </div>
  );
};

export default DeploymentsPage;
