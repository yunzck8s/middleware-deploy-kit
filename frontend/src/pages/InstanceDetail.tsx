import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Button,
  Drawer,
  Form,
  Input,
  message,
  Modal,
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
  applyNginxConfig,
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
import {
  getRedisConfig,
  updateRedisConfig,
  testRedisConnection,
  scanRedisKeys,
  getRedisKey,
  deleteRedisKey,
  seedRedisTestData,
} from '../api/redisInstance';
import type { RedisTestResult, RedisKeyInfo, RedisKeyValue } from '../api/redisInstance';
import type {
  MiddlewareInstance,
  InstanceStats,
  NginxConfig,
  Certificate,
  Deployment,
} from '../types';
import InstanceStatusBadge from '../components/middleware/InstanceStatusBadge';
import ConfigEditor from '../components/nginx/ConfigEditor';
import ConfigPreview from '../components/nginx/ConfigPreview';
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
  const [applyingId, setApplyingId] = useState<number | null>(null);
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

  const handleApplyConfig = (config: NginxConfig) => {
    if (!serverId) {
      message.error('当前实例未绑定服务器，无法应用配置');
      return;
    }
    Modal.confirm({
      title: '应用配置',
      content: (
        <div style={{ marginTop: 12 }}>
          <p>确认将配置 <strong>{config.name}</strong> 应用到当前实例的服务器？</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>将自动备份旧配置并重启 Nginx 服务。</p>
        </div>
      ),
      okText: '确认应用',
      cancelText: '取消',
      onOk: async () => {
        try {
          setApplyingId(config.id);
          const result = await applyNginxConfig(config.id, {
            server_id: serverId,
            backup_enabled: true,
            restart_service: true,
          });
          message.success('配置应用任务已创建');
          void loadConfigs();
          handleOpenApplyHistory(result.nginx_config_id, result.id);
        } catch (error: any) {
          message.error(error.message || '应用配置失败');
        } finally {
          setApplyingId(null);
        }
      },
    });
  };

  const handleOpenApplyHistory = (configId: number, applyId?: number | null) => {
    setApplyHistoryConfigId(configId);
    setSelectedApplyId(applyId ?? null);
    setApplyHistoryVisible(true);
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
            const blocks = config.server_blocks || [];
            const hasBlocks = blocks.length > 0;
            const locationCount = hasBlocks
              ? blocks.reduce((sum, b) => sum + (b.locations?.length || 0), 0)
              : (config.locations?.length || 0);
            const isApplied = config.status === 'applied';
            return (
              <div key={config.id} className="resource-card">
                <div className="resource-card__header">
                  <div>
                    <div className="resource-card__title">{config.name}</div>
                    <div className="resource-card__description">{config.description || '未填写说明'}</div>
                  </div>
                  {isApplied && <StatusBadge status="applied" compact />}
                </div>

                <div className="resource-card__tags" style={{ marginTop: 16 }}>
                  {hasBlocks ? (
                    <>
                      {blocks.map((block, idx) => (
                        <React.Fragment key={idx}>
                          {block.enable_http && <StatusBadge status="valid" label={`HTTP:${block.http_port || 80}`} compact />}
                          {block.enable_https && <StatusBadge status="valid" label={`HTTPS:${block.https_port || 443}`} compact />}
                        </React.Fragment>
                      ))}
                      <StatusBadge status="info" label={`${blocks.length} 个 Server 块`} compact />
                    </>
                  ) : (
                    <>
                      {config.enable_http && <StatusBadge status="valid" label={`HTTP:${config.http_port}`} compact />}
                      {config.enable_https && <StatusBadge status="valid" label={`HTTPS:${config.https_port}`} compact />}
                      <StatusBadge status="default" label={config.server_name || '_'} compact />
                    </>
                  )}
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
                    <Button type="text" icon={<SendOutlined />} loading={applyingId === config.id} onClick={() => handleApplyConfig(config)}>
                      应用配置
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

// ==================== Redis 配置 Tab ====================

function RedisConfigTab({ instanceId }: { instanceId: number }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [confPath, setConfPath] = useState('');
  const [restartService, setRestartService] = useState(false);
  const [dirty, setDirty] = useState(false);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const data = await getRedisConfig(instanceId);
      setContent(data.content);
      setConfPath(data.conf_path);
      setDirty(false);
    } catch (error: any) {
      message.error(error.message || '加载 Redis 配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [instanceId]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateRedisConfig(instanceId, {
        content,
        restart_service: restartService,
      });
      setDirty(false);
      if (result.restart_error) {
        message.warning(`配置已保存，但重启失败: ${result.restart_error}`);
      } else if (result.restarted) {
        message.success('配置已保存并重启 Redis 服务');
      } else {
        message.success('配置已保存');
      }
    } catch (error: any) {
      message.error(error.message || '保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Skeleton active paragraph={{ rows: 12 }} />;
  }

  const lineCount = content.split('\n').length;

  return (
    <div>
      {/* 工具栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
        border: '1px solid var(--border-color)',
        borderBottom: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FolderOpenOutlined style={{ color: 'var(--text-secondary)' }} />
          <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            {confPath}
          </span>
          <span style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)',
            padding: '1px 8px',
            borderRadius: 'var(--radius-sm)',
          }}>
            {lineCount} 行
          </span>
          {dirty && (
            <span style={{
              fontSize: 11,
              color: '#f59e0b',
              background: '#f59e0b18',
              padding: '1px 8px',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 500,
            }}>
              未保存
            </span>
          )}
        </div>
        <Space size={8}>
          <Tooltip title={restartService ? '保存后将自动重启 Redis 服务' : '仅保存配置文件，不重启服务'}>
            <Switch
              checkedChildren="保存后重启"
              unCheckedChildren="仅保存"
              checked={restartService}
              onChange={setRestartService}
            />
          </Tooltip>
          <Button size="small" icon={<ReloadOutlined />} onClick={loadConfig}>重新加载</Button>
          <Button size="small" type="primary" loading={saving} onClick={handleSave} disabled={!dirty}>
            保存配置
          </Button>
        </Space>
      </div>

      {/* 编辑器区域 */}
      <div style={{
        position: 'relative',
        border: '1px solid var(--border-color)',
        borderRadius: '0 0 var(--radius-md) var(--radius-md)',
        overflow: 'hidden',
      }}>
        {/* 重启警告条 */}
        {restartService && (
          <div style={{
            padding: '6px 16px',
            fontSize: 12,
            background: '#f59e0b14',
            color: '#f59e0b',
            borderBottom: '1px solid #f59e0b33',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{ fontSize: 14 }}>!</span>
            保存时将自动重启 Redis 服务，请确认配置无误
          </div>
        )}
        <Input.TextArea
          value={content}
          onChange={(e) => { setContent(e.target.value); setDirty(true); }}
          autoSize={{ minRows: 24, maxRows: 50 }}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: '1.7',
            background: 'var(--bg-secondary)',
            border: 'none',
            borderRadius: 0,
            padding: '12px 16px',
            resize: 'none',
          }}
        />
      </div>
    </div>
  );
}

// ==================== Redis 连接测试 Tab ====================

function RedisTestTab({ instanceId }: { instanceId: number }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<RedisTestResult | null>(null);

  const handleTest = async () => {
    try {
      setTesting(true);
      const data = await testRedisConnection(instanceId);
      setResult(data);
    } catch (error: any) {
      message.error(error.message || '连接测试失败');
    } finally {
      setTesting(false);
    }
  };

  // 关键指标卡片定义
  const metricCards = result?.connected && result?.info ? [
    { label: 'Redis 版本', value: result.info.redis_version, color: '#3b82f6' },
    { label: '运行时间', value: result.info.uptime_in_days ? `${result.info.uptime_in_days} 天` : '-', color: '#22c55e' },
    { label: '已用内存', value: result.info.used_memory_human || '-', color: '#f59e0b' },
    { label: '连接客户端', value: result.info.connected_clients || '-', color: '#8b5cf6' },
  ].filter(m => m.value && m.value !== '-') : [];

  // 详细信息表格项
  const detailItems = result?.info ? [
    { label: '运行模式', key: 'redis_mode' },
    { label: 'TCP 端口', key: 'tcp_port' },
    { label: '进程 ID', key: 'process_id' },
    { label: '操作系统', key: 'os' },
    { label: '可执行文件', key: 'executable' },
    { label: '配置文件', key: 'config_file' },
    { label: '运行时间（秒）', key: 'uptime_in_seconds' },
  ] : [];

  return (
    <div>
      {/* 未测试时的空状态 */}
      {!result && !testing && (
        <div style={{
          textAlign: 'center',
          padding: '60px 0 40px',
        }}>
          <div style={{
            width: 64,
            height: 64,
            margin: '0 auto 20px',
            borderRadius: '50%',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <ApiOutlined style={{ fontSize: 28, color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
            测试 Redis 连接状态，获取服务器运行信息
          </div>
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={handleTest}
          >
            开始测试
          </Button>
        </div>
      )}

      {/* 测试中 */}
      {testing && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      )}

      {/* 结果展示 */}
      {result && !testing && (
        <div>
          {/* 连接状态 Hero */}
          <div style={{
            position: 'relative',
            padding: '20px 24px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            overflow: 'hidden',
            marginBottom: 16,
          }}>
            {/* 顶部状态色条 */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: result.connected
                ? 'linear-gradient(90deg, #22c55e, #22c55e88)'
                : 'linear-gradient(90deg, #ef4444, #ef444488)',
            }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* 状态指示灯 */}
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: result.connected ? '#22c55e18' : '#ef444418',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: result.connected ? '#22c55e' : '#ef4444',
                    boxShadow: result.connected ? '0 0 8px #22c55e66' : '0 0 8px #ef444466',
                  }} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {result.connected ? 'PONG — 连接成功' : '连接失败'}
                  </div>
                  {result.error && (
                    <div style={{ marginTop: 4, color: '#ef4444', fontSize: 13 }}>{result.error}</div>
                  )}
                  {result.dbsize && (
                    <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: 13 }}>
                      数据库大小: <span style={{ fontFamily: 'var(--font-mono)' }}>{result.dbsize}</span>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {result.latency_ms !== undefined && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: result.latency_ms < 100 ? '#22c55e' : result.latency_ms < 500 ? '#f59e0b' : '#ef4444' }}>
                      {result.latency_ms}<span style={{ fontSize: 13, fontWeight: 400, marginLeft: 2 }}>ms</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>延迟</div>
                  </div>
                )}
                <Button icon={<ReloadOutlined />} onClick={handleTest}>重新测试</Button>
              </div>
            </div>
          </div>

          {/* 关键指标卡片 */}
          {metricCards.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${metricCards.length}, minmax(0, 1fr))`,
              gap: 12,
              marginBottom: 16,
            }}>
              {metricCards.map((card) => (
                <div key={card.label} className="summary-card" style={{ position: 'relative', overflow: 'hidden', padding: '16px 20px' }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: `linear-gradient(90deg, ${card.color}, ${card.color}44)`,
                  }} />
                  <div className="summary-card__label" style={{ fontSize: 12 }}>{card.label}</div>
                  <div style={{
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: card.color,
                    marginTop: 6,
                  }}>
                    {card.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 详细信息 */}
          {result.info && Object.keys(result.info).length > 0 && (
            <div style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '10px 16px',
                background: 'var(--bg-tertiary)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: 13,
                fontWeight: 600,
              }}>
                详细信息
              </div>
              <Table
                dataSource={detailItems.filter(item => result.info![item.key]).map(item => ({
                  key: item.key,
                  label: item.label,
                  value: result.info![item.key],
                }))}
                columns={[
                  {
                    title: '属性',
                    dataIndex: 'label',
                    key: 'label',
                    width: 180,
                    render: (v: string) => <span style={{ color: 'var(--text-secondary)' }}>{v}</span>,
                  },
                  {
                    title: '值',
                    dataIndex: 'value',
                    key: 'value',
                    render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{v}</span>,
                  },
                ]}
                pagination={false}
                size="small"
                showHeader={false}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Redis 数据浏览 Tab ====================

// 类型颜色映射（数据浏览 + Drawer 共享）
const redisTypeColors: Record<string, string> = {
  string: 'blue',
  list: 'green',
  set: 'orange',
  zset: 'purple',
  hash: 'red',
};

// 类型图标映射
const redisTypeIcons: Record<string, string> = {
  string: 'Abc',
  list: '[ ]',
  set: '{ }',
  zset: '⇅',
  hash: '#',
};

// 格式化 TTL 为人类可读
function formatTTL(ttl: number): string {
  if (ttl === -1) return '永不过期';
  if (ttl === -2) return '-';
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m ${ttl % 60}s`;
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`;
  return `${Math.floor(ttl / 86400)}d ${Math.floor((ttl % 86400) / 3600)}h`;
}

// Key 名称渲染：命名空间高亮
function KeyName({ name }: { name: string }) {
  const parts = name.split(':');
  if (parts.length <= 1) {
    return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{name}</span>;
  }
  const ns = parts.slice(0, -1).join(':');
  const leaf = parts[parts.length - 1];
  return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{ns}:</span>
      <span style={{ fontWeight: 500 }}>{leaf}</span>
    </span>
  );
}

function RedisBrowserTab({ instanceId }: { instanceId: number }) {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [keys, setKeys] = useState<RedisKeyInfo[]>([]);
  const [pattern, setPattern] = useState('*');
  const [selectedKey, setSelectedKey] = useState<RedisKeyValue | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [keyDrawerVisible, setKeyDrawerVisible] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleScan = async () => {
    try {
      setScanning(true);
      const data = await scanRedisKeys(instanceId, { pattern, count: 200 });
      setKeys(data.keys || []);
      setScanned(true);
    } catch (error: any) {
      message.error(error.message || '扫描 key 失败');
    } finally {
      setScanning(false);
    }
  };

  const handleViewKey = async (key: string) => {
    try {
      setLoadingKey(key);
      const data = await getRedisKey(instanceId, key);
      setSelectedKey(data);
      setKeyDrawerVisible(true);
    } catch (error: any) {
      message.error(error.message || '获取 key 值失败');
    } finally {
      setLoadingKey(null);
    }
  };

  const handleDeleteKey = async (key: string) => {
    try {
      await deleteRedisKey(instanceId, key);
      message.success(`已删除 key: ${key}`);
      setKeys(prev => prev.filter(k => k.key !== key));
      if (selectedKey?.key === key) {
        setKeyDrawerVisible(false);
        setSelectedKey(null);
      }
    } catch (error: any) {
      message.error(error.message || '删除 key 失败');
    }
  };

  const handleSeedTestData = async () => {
    try {
      setSeeding(true);
      const data = await seedRedisTestData(instanceId);
      message.success(data.message);
      handleScan();
    } catch (error: any) {
      message.error(error.message || '写入测试数据失败');
    } finally {
      setSeeding(false);
    }
  };

  // 类型统计
  const typeCounts = keys.reduce<Record<string, number>>((acc, k) => {
    acc[k.type] = (acc[k.type] || 0) + 1;
    return acc;
  }, {});

  const columns: ColumnsType<RedisKeyInfo> = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      sorter: (a, b) => a.key.localeCompare(b.key),
      render: (text: string, record) => (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          onClick={() => handleViewKey(text)}
        >
          {/* 类型小徽标 */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 22,
            borderRadius: 'var(--radius-sm)',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            background: `var(--ant-color-${redisTypeColors[record.type] || 'default'}, var(--bg-tertiary))`,
            color: 'var(--bg-primary)',
            opacity: 0.85,
            flexShrink: 0,
          }}>
            {redisTypeIcons[record.type] || '?'}
          </span>
          <KeyName name={text} />
          {loadingKey === text && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>...</span>}
        </div>
      ),
    },
    {
      title: 'TTL',
      dataIndex: 'ttl',
      key: 'ttl',
      width: 140,
      sorter: (a, b) => a.ttl - b.ttl,
      render: (v: number) => {
        if (v === -1) return <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>-</span>;
        if (v === -2) return <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>-</span>;
        // 有 TTL：显示进度感
        const isUrgent = v < 60;
        const isWarning = v < 3600;
        return (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : 'var(--text-secondary)',
            fontWeight: isUrgent ? 600 : 400,
          }}>
            {formatTTL(v)}
          </span>
        );
      },
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          <Tooltip title="查看值">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              style={{ color: 'var(--text-secondary)' }}
              onClick={(e) => { e.stopPropagation(); handleViewKey(record.key); }}
            />
          </Tooltip>
          <Popconfirm title={`删除 "${record.key}"？`} onConfirm={() => handleDeleteKey(record.key)} okText="删除" cancelText="取消">
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ];

  // 渲染 key 的值
  const renderValue = (data: RedisKeyValue | null) => {
    if (!data) return null;

    if (data.type === 'hash' && typeof data.value === 'object' && !Array.isArray(data.value)) {
      const entries = Object.entries(data.value);
      return (
        <Table
          dataSource={entries.map(([field, val]) => ({ key: field, field, value: val as string }))}
          columns={[
            { title: 'Field', dataIndex: 'field', key: 'field', width: '35%', render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500 }}>{v}</span> },
            { title: 'Value', dataIndex: 'value', key: 'value', render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all', color: 'var(--text-secondary)' }}>{v}</span> },
          ]}
          pagination={entries.length > 20 ? { pageSize: 20, size: 'small' } : false}
          size="small"
        />
      );
    }

    if (Array.isArray(data.value)) {
      return (
        <Table
          dataSource={data.value.map((v: string, i: number) => ({ key: i, index: i, value: v }))}
          columns={[
            { title: '#', dataIndex: 'index', key: 'index', width: 50, render: (v: number) => <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span> },
            { title: 'Value', dataIndex: 'value', key: 'value', render: (v: string) => <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>{v}</span> },
          ]}
          pagination={data.value.length > 20 ? { pageSize: 20, size: 'small' } : false}
          size="small"
        />
      );
    }

    // string 类型 — JSON 自动格式化
    const strVal = String(data.value);
    let isJson = false;
    let formattedJson = '';
    if (strVal.startsWith('{') || strVal.startsWith('[')) {
      try {
        formattedJson = JSON.stringify(JSON.parse(strVal), null, 2);
        isJson = true;
      } catch { /* 不是 JSON */ }
    }

    return (
      <div style={{
        padding: '14px 16px',
        background: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        lineHeight: '1.7',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {isJson ? formattedJson : strVal}
      </div>
    );
  };

  // 快捷 pattern 按钮
  const quickPatterns = ['*', 'test:*', 'user:*', 'session:*', 'cache:*'];

  return (
    <div>
      {/* 搜索栏 */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 12,
        alignItems: 'center',
      }}>
        <Input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="key 模式，如 user:* 或 session:*"
          onPressEnter={handleScan}
          prefix={<span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.7 }}>SCAN</span>}
          style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
          allowClear
        />
        <Button type="primary" icon={<ReloadOutlined />} loading={scanning} onClick={handleScan}>
          扫描
        </Button>
        <Tooltip title="写入 string/list/set/zset/hash 多种类型的样例数据">
          <Button icon={<PlusOutlined />} loading={seeding} onClick={handleSeedTestData}>
            测试数据
          </Button>
        </Tooltip>
      </div>

      {/* 快捷 pattern */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {quickPatterns.map(p => (
          <span
            key={p}
            onClick={() => { setPattern(p); }}
            style={{
              padding: '2px 10px',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              color: pattern === p ? 'var(--color-primary)' : 'var(--text-secondary)',
              borderColor: pattern === p ? 'var(--color-primary)' : 'var(--border-color)',
              background: pattern === p ? 'var(--color-primary-bg, transparent)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {p}
          </span>
        ))}
      </div>

      {/* 扫描结果统计条 */}
      {scanned && keys.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          padding: '7px 14px',
          background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>{keys.length}</strong> 个 key
          </span>
          <div style={{ width: 1, height: 12, background: 'var(--border-color)' }} />
          {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <Tag key={type} color={redisTypeColors[type] || 'default'} style={{ margin: 0, fontSize: 11 }}>
              {type} {count}
            </Tag>
          ))}
        </div>
      )}

      {/* 空状态 */}
      {!scanned && !scanning && (
        <div style={{ textAlign: 'center', padding: '60px 0 40px' }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 20px', borderRadius: '50%',
            background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <KeyOutlined style={{ fontSize: 28, color: 'var(--text-secondary)' }} />
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            输入 key 模式并点击"扫描"浏览 Redis 数据
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 6 }}>
            使用 SCAN 命令安全扫描，不会阻塞 Redis
          </div>
        </div>
      )}

      {/* 扫描后无结果 */}
      {scanned && keys.length === 0 && !scanning && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-secondary)' }}>
          未找到匹配 <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>"{pattern}"</span> 的 key
        </div>
      )}

      {/* key 列表 */}
      {keys.length > 0 && (
        <Table
          columns={columns}
          dataSource={keys}
          rowKey="key"
          loading={scanning}
          size="small"
          rowClassName={() => 'redis-key-row'}
          onRow={(record) => ({
            onClick: () => handleViewKey(record.key),
            style: { cursor: 'pointer' },
          })}
          pagination={keys.length > 20 ? { pageSize: 20, size: 'small', showTotal: (count) => `共 ${count} 个 key` } : false}
        />
      )}

      {/* Key 值 Drawer */}
      <Drawer
        title="Key 详情"
        open={keyDrawerVisible}
        onClose={() => { setKeyDrawerVisible(false); setSelectedKey(null); }}
        width={640}
      >
        {selectedKey && (
          <div>
            {/* Key 名称 */}
            <div style={{
              padding: '14px 16px',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              marginBottom: 16,
            }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 15,
                fontWeight: 600,
                wordBreak: 'break-all',
                lineHeight: 1.5,
              }}>
                {selectedKey.key}
              </div>
            </div>

            {/* 元信息行 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
              marginBottom: 20,
            }}>
              <div style={{
                padding: '10px 14px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>类型</div>
                <Tag color={redisTypeColors[selectedKey.type] || 'default'} style={{ fontSize: 13, margin: 0 }}>{selectedKey.type}</Tag>
              </div>
              <div style={{
                padding: '10px 14px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>TTL</div>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: selectedKey.ttl > 0 && selectedKey.ttl < 60 ? '#ef4444' : 'var(--text-primary)',
                }}>
                  {formatTTL(selectedKey.ttl)}
                </span>
              </div>
              <div style={{
                padding: '10px 14px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>大小</div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600 }}>
                  {selectedKey.type === 'hash' && typeof selectedKey.value === 'object' && !Array.isArray(selectedKey.value)
                    ? `${Object.keys(selectedKey.value).length} 字段`
                    : Array.isArray(selectedKey.value)
                      ? `${selectedKey.value.length} 元素`
                      : `${String(selectedKey.value).length} 字符`
                  }
                </span>
              </div>
            </div>

            {/* 值标题 */}
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              值
              {selectedKey.type === 'string' && String(selectedKey.value).startsWith('{') && (
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400, background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>JSON</span>
              )}
            </div>

            {/* 值内容 */}
            {renderValue(selectedKey)}
          </div>
        )}
      </Drawer>
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
  EyeInvisibleOutlined,
  KeyOutlined,
  ApiOutlined,
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
  const [showPassword, setShowPassword] = useState(false);

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

            {/* Redis 密码显示 */}
            {(() => {
              if (instance.type !== 'redis' || !instance.deploy_params) return null;
              try {
                const params = JSON.parse(instance.deploy_params);
                const password = params.REDIS_PASSWORD;
                if (!password) return null;
                return (
                  <>
                    <div style={{ width: 1, height: 16, background: 'var(--border-color)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <KeyOutlined style={{ fontSize: 14, color: accent }} />
                      <span style={{ fontFamily: 'var(--font-mono)', userSelect: showPassword ? 'text' : 'none' }}>
                        {showPassword ? password : '••••••••••••'}
                      </span>
                      <Button
                        type="text"
                        size="small"
                        icon={showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ padding: '0 4px', height: 20, color: 'var(--text-secondary)' }}
                      />
                    </div>
                  </>
                );
              } catch { return null; }
            })()}
          </div>
        </div>
      </div>

      {/* 资源统计卡片 */}
      <div className="resource-summary" style={{
        gridTemplateColumns: type === 'redis' ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
      }}>
        {/* Nginx: 配置数 */}
        {type !== 'redis' && (
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
        )}

        {/* Redis: 连接状态 */}
        {type === 'redis' && (
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
              <ApiOutlined style={{ marginRight: 6, color: typeColor }} />Redis 端口
            </div>
            {(() => {
              try {
                const params = instance?.deploy_params ? JSON.parse(instance.deploy_params) : {};
                return (
                  <>
                    <div className="summary-card__value" style={{ color: typeColor }}>
                      {params.REDIS_PORT || '6379'}
                    </div>
                    <div className="summary-card__hint">服务监听端口</div>
                  </>
                );
              } catch {
                return <div className="summary-card__value" style={{ color: typeColor }}>6379</div>;
              }
            })()}
          </div>
        )}

        {/* Nginx: 证书数 */}
        {type !== 'redis' && (
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
        )}

        {/* 部署数（通用） */}
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

      {/* Tabs — 按中间件类型动态生成 */}
      <Tabs
        defaultActiveKey={type === 'redis' ? (defaultTab === 'config' ? 'redis-config' : defaultTab) : defaultTab}
        items={type === 'redis' ? [
          {
            key: 'redis-config',
            label: 'Redis 配置',
            children: <RedisConfigTab instanceId={instanceId} />,
          },
          {
            key: 'redis-test',
            label: '连接测试',
            children: <RedisTestTab instanceId={instanceId} />,
          },
          {
            key: 'redis-browser',
            label: '数据浏览',
            children: <RedisBrowserTab instanceId={instanceId} />,
          },
          {
            key: 'deploy',
            label: '部署历史',
            children: <DeployTab instanceId={instanceId} />,
          },
        ] : [
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
