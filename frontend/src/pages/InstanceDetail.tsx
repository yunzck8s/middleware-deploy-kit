import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Drawer,
  Form,
  Input,
  message,
  Popconfirm,
  Progress,
  Skeleton,
  Space,
  Switch,
  Table,
  Tabs,
  Tooltip,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  UploadOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { instanceAPI } from '../api/instance';
import {
  getNginxConfigList,
  deleteNginxConfig,
  generateNginxConfig,
} from '../api/nginx';
import {
  getCertificateList,
  uploadCertificate,
  deleteCertificate,
  downloadCertificateFile,
  updateCertificate,
} from '../api/certificate';
import {
  getDeploymentList,
  executeDeployment,
  deleteDeployment,
  rollbackDeployment,
} from '../api/deployment';
import type {
  MiddlewareInstance,
  InstanceStats,
  NginxConfig,
  NginxConfigApply,
  Certificate,
  Deployment,
} from '../types';
import InstanceStatusBadge from '../components/middleware/InstanceStatusBadge';
import ConfigEditor from '../components/nginx/ConfigEditor';
import ConfigPreview from '../components/nginx/ConfigPreview';
import ApplyConfigModal from '../components/nginx/ApplyConfigModal';
import ApplyHistoryDrawer from '../components/nginx/ApplyHistoryDrawer';
import AlertConfigDrawer from '../components/certificates/AlertConfigDrawer';
import StatusBadge from '../components/common/StatusBadge';
import ActionGroup from '../components/common/ActionGroup';
import DeployLogDrawer from '../components/deployment/DeployLogDrawer';
import { formatDateTime, formatDuration } from '../utils/formatters';

// ==================== 配置管理 Tab ====================

function ConfigTab({ instanceId, serverId }: { instanceId: number; serverId?: number }) {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<NginxConfig[]>([]);
  const [editorMode, setEditorMode] = useState<'list' | 'edit' | 'create'>('list');
  const [editingConfigId, setEditingConfigId] = useState<number | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [applyHistoryVisible, setApplyHistoryVisible] = useState(false);
  const [applyHistoryConfigId, setApplyHistoryConfigId] = useState<number | null>(null);
  const [selectedApplyId, setSelectedApplyId] = useState<number | null>(null);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await getNginxConfigList({ instance_id: instanceId, page: 1, page_size: 100 });
      setConfigs(response.configs || []);
    } catch (error: any) {
      message.error(error.message || '加载配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, [instanceId]);

  const handleDelete = async (id: number) => {
    try {
      await deleteNginxConfig(id);
      message.success('配置已删除');
      loadConfigs();
    } catch (error: any) {
      message.error(error.message || '删除配置失败');
    }
  };

  const handleViewGenerated = async (id: number) => {
    try {
      setPreviewingId(id);
      const result = await generateNginxConfig(id);
      setPreviewContent(result.content);
      setPreviewVisible(true);
    } catch (error: any) {
      message.error(error.message || '生成预览失败');
    } finally {
      setPreviewingId(null);
    }
  };

  const handleApplyConfig = (id: number) => {
    setSelectedConfigId(id);
    setApplyModalVisible(true);
  };

  const handleOpenApplyHistory = (configId: number, applyId?: number | null) => {
    setApplyHistoryConfigId(configId);
    setSelectedApplyId(applyId ?? null);
    setApplyHistoryVisible(true);
  };

  const handleApplySuccess = (createdApply: NginxConfigApply) => {
    void loadConfigs();
    handleOpenApplyHistory(createdApply.nginx_config_id, createdApply.id);
  };

  if (editorMode !== 'list') {
    return (
      <ConfigEditor
        configId={editingConfigId}
        instanceId={instanceId}
        serverId={serverId}
        onSave={() => loadConfigs()}
        onBack={() => {
          setEditorMode('list');
          setEditingConfigId(null);
          loadConfigs();
        }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: 'var(--text-secondary)' }}>共 {configs.length} 个配置</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingConfigId(null); setEditorMode('create'); }}>
          新建配置
        </Button>
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : configs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          <p>当前实例还没有配置</p>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditorMode('create')}>新建第一个配置</Button>
        </div>
      ) : (
        <div className="resource-card-grid">
          {configs.map((config) => {
            const locationCount = config.locations?.length || 0;
            return (
              <div key={config.id} className="resource-card">
                <div className="resource-card__header">
                  <div>
                    <div className="resource-card__title">{config.name}</div>
                    <div className="resource-card__description">{config.description || '未填写说明'}</div>
                  </div>
                  <StatusBadge status={config.status} compact />
                </div>

                <div className="resource-card__tags" style={{ marginTop: 16 }}>
                  {config.enable_http && <StatusBadge status="valid" label={`HTTP ${config.http_port}`} compact />}
                  {config.enable_https && <StatusBadge status="valid" label={`HTTPS ${config.https_port}`} compact />}
                  <StatusBadge status="default" label={config.server_name || '_'} compact />
                  {locationCount > 0 && <StatusBadge status="info" label={`${locationCount} 条路由`} compact />}
                </div>

                <div style={{ marginTop: 16 }}>
                  <div className="summary-card" style={{ padding: 14 }}>
                    <div className="summary-card__label">最后更新</div>
                    <div className="summary-card__hint" style={{ marginTop: 6 }}>{formatDateTime(config.updated_at, 'YYYY-MM-DD HH:mm')}</div>
                  </div>
                </div>

                <div className="resource-card__footer">
                  <ActionGroup>
                    <Button type="text" icon={<EyeOutlined />} loading={previewingId === config.id} onClick={() => handleViewGenerated(config.id)}>
                      查看预览
                    </Button>
                    <Button type="text" icon={<SendOutlined />} onClick={() => handleApplyConfig(config.id)}>
                      应用到服务器
                    </Button>
                    <Button type="text" icon={<HistoryOutlined />} onClick={() => handleOpenApplyHistory(config.id)}>
                      应用记录
                    </Button>
                    <Button type="text" icon={<EditOutlined />} onClick={() => { setEditingConfigId(config.id); setEditorMode('edit'); }}>
                      继续编辑
                    </Button>
                  </ActionGroup>
                  <Popconfirm title={`删除配置"${config.name}"后，将不能再直接应用到服务器。确定删除吗？`} onConfirm={() => handleDelete(config.id)} okText="删除" cancelText="取消">
                    <Button type="text" danger icon={<DeleteOutlined />}>删除配置</Button>
                  </Popconfirm>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Drawer title="配置预览" open={previewVisible} onClose={() => setPreviewVisible(false)} width={860}>
        <ConfigPreview content={previewContent} />
      </Drawer>

      {selectedConfigId && (
        <ApplyConfigModal
          configId={selectedConfigId}
          open={applyModalVisible}
          onClose={() => setApplyModalVisible(false)}
          onSuccess={handleApplySuccess}
        />
      )}

      <ApplyHistoryDrawer
        configId={applyHistoryConfigId}
        initialApplyId={selectedApplyId}
        open={applyHistoryVisible}
        onClose={() => {
          setApplyHistoryVisible(false);
          setApplyHistoryConfigId(null);
          setSelectedApplyId(null);
        }}
      />
    </div>
  );
}

// ==================== 证书管理 Tab ====================

function CertTab({ instanceId }: { instanceId: number }) {
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [certFile, setCertFile] = useState<UploadFile | null>(null);
  const [keyFile, setKeyFile] = useState<UploadFile | null>(null);
  const [form] = Form.useForm();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertCertId, setAlertCertId] = useState<number | null>(null);
  const [updateVisible, setUpdateVisible] = useState(false);
  const [updateCertId, setUpdateCertId] = useState<number | null>(null);
  const [updateCertFile, setUpdateCertFile] = useState<UploadFile | null>(null);
  const [updateKeyFile, setUpdateKeyFile] = useState<UploadFile | null>(null);
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updateForm] = Form.useForm();

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const response = await getCertificateList({ instance_id: instanceId, page: 1, page_size: 1000 });
      setCertificates(response.certificates || []);
    } catch (error: any) {
      message.error(error.message || '加载证书列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, [instanceId]);

  const getDaysUntilExpiry = (validUntil: string): number => {
    const expiry = new Date(validUntil);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getTotalDays = (validFrom: string, validUntil: string): number => {
    return Math.max(1, Math.ceil((new Date(validUntil).getTime() - new Date(validFrom).getTime()) / (1000 * 60 * 60 * 24)));
  };

  const handleUpload = async (values: { name: string; domain?: string }) => {
    if (!certFile || !keyFile) {
      message.error('请先选择证书文件和私钥文件');
      return;
    }
    try {
      setUploading(true);
      await uploadCertificate({
        name: values.name,
        domain: values.domain,
        instance_id: instanceId,
        cert_file: certFile.originFileObj as File,
        key_file: keyFile.originFileObj as File,
      });
      message.success('证书已上传');
      setUploadVisible(false);
      form.resetFields();
      setCertFile(null);
      setKeyFile(null);
      loadCertificates();
    } catch (error: any) {
      message.error(error.message || '证书上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteCertificate(id);
      message.success('证书已删除');
      loadCertificates();
    } catch (error: any) {
      message.error(error.message || '删除证书失败');
    }
  };

  const handleDownload = async (id: number, type: 'cert' | 'key', name: string) => {
    try {
      const response = await downloadCertificateFile(id, type);
      const url = window.URL.createObjectURL(new Blob([response as any]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${name}.${type === 'cert' ? 'crt' : 'key'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      message.error(error.message || '下载失败');
    }
  };

  const handleUpdate = async () => {
    if (!updateCertId || !updateCertFile || !updateKeyFile) {
      message.error('请选择新的证书文件和私钥文件');
      return;
    }
    try {
      setUpdating(true);
      const result = await updateCertificate(
        updateCertId,
        updateCertFile.originFileObj as File,
        updateKeyFile.originFileObj as File,
        autoDeploy,
      );
      message.success('证书更新成功');
      if (result.deploy_results && Object.keys(result.deploy_results).length > 0) {
        const deployMsg = Object.entries(result.deploy_results)
          .map(([server, status]) => `${server}: ${status}`)
          .join('\n');
        message.info(`部署结果:\n${deployMsg}`, 5);
      }
      setUpdateVisible(false);
      setUpdateCertId(null);
      setUpdateCertFile(null);
      setUpdateKeyFile(null);
      updateForm.resetFields();
      loadCertificates();
    } catch (error: any) {
      message.error(error.message || '证书更新失败');
    } finally {
      setUpdating(false);
    }
  };

  const columns: ColumnsType<Certificate> = [
    {
      title: '证书资产',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SafetyCertificateOutlined style={{ color: 'var(--color-primary)' }} />
            <strong>{text}</strong>
          </div>
          <div style={{ marginTop: 6, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {record.domain}
          </div>
        </div>
      ),
    },
    {
      title: '健康度',
      key: 'health',
      width: 220,
      render: (_, record) => {
        const days = getDaysUntilExpiry(record.valid_until);
        const totalDays = getTotalDays(record.valid_from, record.valid_until);
        const progress = Math.max(0, Math.min(100, Math.round((days / totalDays) * 100)));
        const status = record.status === 'expired' ? 'expired' : days <= 30 ? 'expiring' : 'valid';
        return (
          <div>
            <div style={{ marginBottom: 8 }}>
              <StatusBadge status={status} label={status === 'valid' ? `剩余 ${days} 天` : status === 'expiring' ? `${days} 天后到期` : '已过期'} compact />
            </div>
            <Progress percent={progress} size="small" showInfo={false} strokeColor={status === 'valid' ? '#22C55E' : status === 'expiring' ? '#F59E0B' : '#EF4444'} />
          </div>
        );
      },
    },
    {
      title: '颁发者',
      dataIndex: 'issuer',
      key: 'issuer',
      ellipsis: true,
      render: (value: string) => <span style={{ color: 'var(--text-secondary)' }}>{value || '未知'}</span>,
    },
    {
      title: '有效期',
      key: 'validity',
      render: (_, record) => (
        <div>
          <div>{formatDateTime(record.valid_from, 'YYYY-MM-DD')}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>至 {formatDateTime(record.valid_until, 'YYYY-MM-DD')}</div>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space>
          <Tooltip title="更新证书">
            <Button type="text" icon={<ReloadOutlined />} size="small" onClick={() => { setUpdateCertId(record.id); setUpdateVisible(true); }} />
          </Tooltip>
          <Tooltip title="告警配置">
            <Button type="text" icon={<BellOutlined />} size="small" onClick={() => { setAlertCertId(record.id); setAlertVisible(true); }} />
          </Tooltip>
          <Tooltip title="下载证书">
            <Button type="text" icon={<DownloadOutlined />} size="small" onClick={() => handleDownload(record.id, 'cert', record.name)} />
          </Tooltip>
          <Popconfirm title={`删除证书"${record.name}"？`} onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: 'var(--text-secondary)' }}>共 {certificates.length} 个证书</span>
        <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadVisible(true)}>上传证书</Button>
      </div>

      {certificates.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          <p>当前实例还没有证书</p>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadVisible(true)}>上传首个证书</Button>
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={certificates}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={certificates.length > 10 ? { pageSize: 10, showTotal: (count) => `共 ${count} 个证书` } : false}
        />
      )}

      {/* 上传证书 */}
      <Drawer
        title="上传证书"
        open={uploadVisible}
        onClose={() => { setUploadVisible(false); form.resetFields(); setCertFile(null); setKeyFile(null); }}
        width={520}
        extra={<Button type="primary" loading={uploading} onClick={() => form.submit()}>开始上传</Button>}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item label="证书名称" name="name" rules={[{ required: true, message: '请输入证书名称' }]}>
            <Input placeholder="例如：prod-api-2026" />
          </Form.Item>
          <Form.Item label="主要域名" name="domain">
            <Input placeholder="例如：api.example.com" />
          </Form.Item>
          <Form.Item label="证书文件 (.crt / .pem)" required>
            <Upload
              beforeUpload={(file) => { setCertFile({ uid: file.name, name: file.name, status: 'done', originFileObj: file as any }); return false; }}
              fileList={certFile ? [certFile] : []}
              onRemove={() => setCertFile(null)}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择证书</Button>
            </Upload>
          </Form.Item>
          <Form.Item label="私钥文件 (.key)" required>
            <Upload
              beforeUpload={(file) => { setKeyFile({ uid: file.name, name: file.name, status: 'done', originFileObj: file as any }); return false; }}
              fileList={keyFile ? [keyFile] : []}
              onRemove={() => setKeyFile(null)}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择私钥</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Drawer>

      {/* 更新证书 */}
      <Drawer
        title="更新证书"
        open={updateVisible}
        onClose={() => { setUpdateVisible(false); setUpdateCertId(null); setUpdateCertFile(null); setUpdateKeyFile(null); updateForm.resetFields(); }}
        width={520}
        extra={<Button type="primary" loading={updating} onClick={handleUpdate}>确认更新</Button>}
      >
        <Form form={updateForm} layout="vertical">
          <Form.Item label="新证书文件 (.crt / .pem)" required>
            <Upload
              beforeUpload={(file) => { setUpdateCertFile({ uid: file.name, name: file.name, status: 'done', originFileObj: file as any }); return false; }}
              fileList={updateCertFile ? [updateCertFile] : []}
              onRemove={() => setUpdateCertFile(null)}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择新证书</Button>
            </Upload>
          </Form.Item>
          <Form.Item label="新私钥文件 (.key)" required>
            <Upload
              beforeUpload={(file) => { setUpdateKeyFile({ uid: file.name, name: file.name, status: 'done', originFileObj: file as any }); return false; }}
              fileList={updateKeyFile ? [updateKeyFile] : []}
              onRemove={() => setUpdateKeyFile(null)}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择新私钥</Button>
            </Upload>
          </Form.Item>
          <Form.Item label="自动部署到服务器" extra="开启后，新证书会自动部署到所有使用该证书的服务器并重载 Nginx">
            <Switch checked={autoDeploy} onChange={setAutoDeploy} />
          </Form.Item>
        </Form>
      </Drawer>

      <AlertConfigDrawer
        visible={alertVisible}
        certificateId={alertCertId}
        onClose={() => setAlertVisible(false)}
      />
    </div>
  );
}

// ==================== 部署历史 Tab ====================

function DeployTab({ instanceId }: { instanceId: number }) {
  const [loading, setLoading] = useState(false);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<number | null>(null);
  const [drawerOptimisticStatus, setDrawerOptimisticStatus] = useState<'running' | undefined>(undefined);

  const loadDeployments = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await getDeploymentList({ instance_id: instanceId, page: 1, page_size: 1000 });
      setDeployments(response.deployments || []);
    } catch (error: any) {
      if (!silent) message.error(error.message || '加载部署历史失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();
  }, [instanceId]);

  // 轮询运行中的部署
  useEffect(() => {
    const hasRunning = deployments.some((d) => d.status === 'running');
    if (!hasRunning) return;
    const timer = setInterval(() => { loadDeployments(true); }, 5000);
    return () => clearInterval(timer);
  }, [deployments]);

  const openDeploymentLogs = (record: Deployment, options?: { optimisticStatus?: 'running' }) => {
    setSelectedDeploymentId(record.id);
    setDrawerOptimisticStatus(options?.optimisticStatus);
    setDrawerVisible(true);
  };

  const handleExecute = async (record: Deployment) => {
    try {
      await executeDeployment(record.id);
      message.success('已开始执行部署任务');
      void loadDeployments();
      openDeploymentLogs(record, { optimisticStatus: 'running' });
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
      message.error(error.message || '删除失败');
    }
  };

  const handleRollback = async (record: Deployment) => {
    try {
      const result = await rollbackDeployment(record.id);
      message.success(result.message || '已创建回滚任务');
      void loadDeployments();
      if (result.deployment) {
        openDeploymentLogs(result.deployment);
      }
    } catch (error: any) {
      message.error(error.message || '回滚失败');
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
          <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 12 }}>{record.description || ''}</div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (value: string) => <StatusBadge status={value === 'package' ? 'info' : 'warning'} label={value === 'package' ? '离线包' : value === 'certificate' ? '证书' : '配置'} compact />,
    },
    {
      title: '服务器',
      key: 'server',
      width: 160,
      render: (_, record) => (
        <div>
          <div>{record.server?.name || '-'}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{record.server?.host || ''}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) => <StatusBadge status={value} compact />,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (value: number) => <span className="mono">{value ? formatDuration(value) : '-'}</span>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (value: string) => <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(value, 'YYYY-MM-DD HH:mm')}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <ActionGroup>
          {(record.status === 'pending' || record.status === 'failed') && (
            <Tooltip title="执行"><Button type="primary" size="small" icon={<PlayCircleOutlined />} onClick={() => handleExecute(record)} /></Tooltip>
          )}
          <Tooltip title="查看日志"><Button size="small" icon={<EyeOutlined />} onClick={() => openDeploymentLogs(record)} /></Tooltip>
          {record.can_rollback && record.status === 'success' && (
            <Popconfirm title="确定回滚？" onConfirm={() => handleRollback(record)} okText="回滚" cancelText="取消">
              <Tooltip title="回滚"><Button size="small" icon={<RollbackOutlined />} /></Tooltip>
            </Popconfirm>
          )}
          {record.status !== 'running' && (
            <Popconfirm title={`删除任务"${record.name}"？`} onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
              <Tooltip title="删除"><Button size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </ActionGroup>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: 'var(--text-secondary)' }}>共 {deployments.length} 条部署记录</span>
        <Button icon={<ReloadOutlined />} onClick={() => loadDeployments()}>刷新</Button>
      </div>

      {deployments.length === 0 && !loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          <p>当前实例还没有部署记录</p>
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={deployments}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={deployments.length > 10 ? { pageSize: 10, showTotal: (count) => `共 ${count} 条记录` } : false}
        />
      )}

      <DeployLogDrawer
        deploymentId={selectedDeploymentId}
        open={drawerVisible}
        optimisticStatus={drawerOptimisticStatus}
        onClose={() => {
          setDrawerVisible(false);
          setSelectedDeploymentId(null);
          setDrawerOptimisticStatus(undefined);
        }}
        onComplete={() => loadDeployments()}
      />
    </div>
  );
}

// ==================== 实例详情页主组件 ====================

import { Tag } from 'antd';
import {
  CloudServerOutlined as ServerIcon,
  FolderOpenOutlined,
  AppstoreOutlined,
  SafetyCertificateOutlined as CertIcon,
  DeploymentUnitOutlined,
  ClockCircleOutlined as ClockIcon,
} from '@ant-design/icons';
import { getInstallDir, envLabels, envColors } from '../utils/instance';
import { formatRelativeTime } from '../utils/formatters';

// 状态主题色 — 与 InstanceCard 保持一致
const statusAccent: Record<string, string> = {
  running: '#22c55e',
  deploying: '#3b82f6',
  failed: '#ef4444',
  stopped: '#71717a',
  unknown: '#71717a',
};

// 中间件类型图标色
const typeAccent: Record<string, string> = {
  nginx: '#22c55e',
  redis: '#ef4444',
  openssh: '#f59e0b',
};

export default function InstanceDetail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'config';
  const [instance, setInstance] = useState<MiddlewareInstance | null>(null);
  const [stats, setStats] = useState<InstanceStats | null>(null);

  const instanceId = id ? parseInt(id) : 0;

  useEffect(() => {
    if (instanceId) {
      loadInstance(instanceId);
      loadStats(instanceId);
    }
  }, [instanceId]);

  const loadInstance = async (iid: number) => {
    try {
      const data = await instanceAPI.getById(iid);
      setInstance(data);
    } catch (error: any) {
      message.error('加载实例详情失败: ' + error.message);
    }
  };

  const loadStats = async (iid: number) => {
    try {
      const data = await instanceAPI.getStats(iid);
      setStats(data);
    } catch (error: any) {
      console.error('加载统计失败:', error);
    }
  };

  if (!instance) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center' }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  const installDir = getInstallDir(instance);
  const typeLabel = type === 'nginx' ? 'Nginx' : type === 'redis' ? 'Redis' : 'OpenSSH';
  const accent = statusAccent[instance.status] || statusAccent.unknown;
  const typeColor = typeAccent[type || ''] || 'var(--color-primary)';

  return (
    <div className="page-stack">
      {/* 返回导航 */}
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/middleware/${type}/instances`)}
        style={{ padding: '4px 0', color: 'var(--text-secondary)', marginBottom: 8 }}
      >
        返回实例列表
      </Button>

      {/* Hero 区域 — 渐变背景面板 */}
      <div style={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        overflow: 'hidden',
      }}>
        {/* 顶部状态色条 */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
          opacity: 0.9,
        }} />

        {/* 左侧装饰条 */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 3,
          bottom: 0,
          width: 3,
          background: `linear-gradient(180deg, ${accent}66, transparent)`,
        }} />

        <div style={{ padding: '24px 28px' }}>
          {/* 第一行：实例名 + 状态 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
              }}>
                {instance.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <InstanceStatusBadge status={instance.status} />
                {instance.version && (
                  <Tag
                    color="geekblue"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginRight: 0 }}
                  >
                    {typeLabel} {instance.version}
                  </Tag>
                )}
                {instance.environment && (
                  <Tag
                    color={envColors[instance.environment] || 'default'}
                    style={{ marginRight: 0 }}
                  >
                    {envLabels[instance.environment] || instance.environment}
                  </Tag>
                )}
              </div>
            </div>
          </div>

          {/* 第二行：关键信息条 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            marginTop: 18,
            padding: '12px 16px',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            fontSize: 13,
            color: 'var(--text-secondary)',
            flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ServerIcon style={{ fontSize: 14, color: accent }} />
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {instance.server?.host || instance.server?.name || `服务器 #${instance.server_id}`}
              </span>
            </div>

            {installDir && (
              <>
                <div style={{ width: 1, height: 16, background: 'var(--border-color)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FolderOpenOutlined style={{ fontSize: 14, color: accent }} />
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{installDir}</span>
                </div>
              </>
            )}

            <div style={{ width: 1, height: 16, background: 'var(--border-color)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClockIcon style={{ fontSize: 14, color: accent }} />
              <span>更新于 {formatRelativeTime(instance.updated_at || instance.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 资源统计卡片 */}
      <div className="resource-summary" style={{
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      }}>
        {/* 配置数 */}
        <div className="summary-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, var(--color-info), var(--color-info)44)`,
          }} />
          <div className="summary-card__label">
            <AppstoreOutlined style={{ marginRight: 6, color: 'var(--color-info)' }} />配置
          </div>
          {stats ? (
            <>
              <div className="summary-card__value" style={{ color: 'var(--color-info)' }}>
                {stats.configs}
              </div>
              <div className="summary-card__hint">Nginx 站点配置</div>
            </>
          ) : (
            <Skeleton.Input active size="small" style={{ marginTop: 8, width: 60 }} />
          )}
        </div>

        {/* 证书数 */}
        <div className="summary-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, ${typeColor}, ${typeColor}44)`,
          }} />
          <div className="summary-card__label">
            <CertIcon style={{ marginRight: 6, color: typeColor }} />证书
          </div>
          {stats ? (
            <>
              <div className="summary-card__value" style={{ color: typeColor }}>
                {stats.certificates}
              </div>
              <div className="summary-card__hint">SSL/TLS 证书</div>
            </>
          ) : (
            <Skeleton.Input active size="small" style={{ marginTop: 8, width: 60 }} />
          )}
        </div>

        {/* 部署数 */}
        <div className="summary-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, var(--color-secondary), var(--color-secondary)44)`,
          }} />
          <div className="summary-card__label">
            <DeploymentUnitOutlined style={{ marginRight: 6, color: 'var(--color-secondary)' }} />部署
          </div>
          {stats ? (
            <>
              <div className="summary-card__value" style={{ color: 'var(--color-secondary)' }}>
                {stats.deployments}
              </div>
              <div className="summary-card__hint">
                {stats.last_deploy ? `最近 ${formatRelativeTime(stats.last_deploy)}` : '暂无部署记录'}
              </div>
            </>
          ) : (
            <Skeleton.Input active size="small" style={{ marginTop: 8, width: 60 }} />
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        defaultActiveKey={defaultTab}
        items={[
          {
            key: 'config',
            label: '配置管理',
            children: <ConfigTab instanceId={instanceId} serverId={instance?.server_id} />,
          },
          {
            key: 'cert',
            label: '证书管理',
            children: <CertTab instanceId={instanceId} />,
          },
          {
            key: 'deploy',
            label: '部署历史',
            children: <DeployTab instanceId={instanceId} />,
          },
        ]}
      />
    </div>
  );
}
