import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Row, Col, Input, Select, Button, Modal, Form, message, Steps,
  Spin, Alert, Descriptions, Tag, Divider, Empty, Space,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, RocketOutlined,
  CloudServerOutlined, InfoCircleOutlined,
  CheckCircleOutlined, LoadingOutlined, ExclamationCircleOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import ActionGroup from '../components/common/ActionGroup';
import FilterToolbar from '../components/common/FilterToolbar';
import { instanceAPI } from '../api/instance';
import { getServerList } from '../api/server';
import { getPackageList, getPackageMetadata } from '../api/package';
import { createDeployment, executeDeployment, getDeploymentList } from '../api/deployment';
import type { MiddlewareInstance, Server, MiddlewarePackage, PackageMetadata } from '../types';
import InstanceCard from '../components/middleware/InstanceCard';
import PackageSelector from '../components/middleware/PackageSelector';
import { ParameterForm } from '../components/deployment/ParameterForm';
import DeployLogDrawer from '../components/deployment/DeployLogDrawer';

// 统计卡片
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-color)',
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, color,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

export default function InstanceList() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [instances, setInstances] = useState<MiddlewareInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [packages, setPackages] = useState<MiddlewarePackage[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState<MiddlewarePackage | null>(null);
  const [metadata, setMetadata] = useState<PackageMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [instanceFormValues, setInstanceFormValues] = useState<any>(null);
  const [deployingIds, setDeployingIds] = useState<Set<number>>(new Set());
  const [logDrawerVisible, setLogDrawerVisible] = useState(false);
  const [logDeploymentId, setLogDeploymentId] = useState<number | null>(null);
  const [logOptimisticStatus, setLogOptimisticStatus] = useState<'running' | undefined>(undefined);
  const [form] = Form.useForm();
  const [paramForm] = Form.useForm();

  useEffect(() => {
    loadInstances();
  }, [type]);

  const loadInstances = useCallback(async () => {
    setLoading(true);
    try {
      const data = await instanceAPI.getAll({ type });
      setInstances(data || []);
    } catch (error: any) {
      message.error('加载实例列表失败: ' + (error.message || '网络错误'));
    } finally {
      setLoading(false);
    }
  }, [type]);

  const loadServers = async () => {
    try {
      const res = await getServerList({ page: 1, page_size: 100 });
      setServers(res.servers || []);
    } catch {
      // 静默处理
    }
  };

  const loadPackages = async () => {
    try {
      const data = await getPackageList({ page: 1, page_size: 100 });
      setPackages(data.packages || []);
    } catch {
      // 静默处理
    }
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      if (!selectedPackage) {
        message.warning('请选择一个离线包');
        return;
      }
      // 加载 metadata
      setMetadataLoading(true);
      try {
        const meta = await getPackageMetadata(selectedPackage.id);
        setMetadata(meta);

        // 自动填充默认值
        const defaults: Record<string, any> = {};
        meta.parameters?.forEach(param => {
          if (param.default !== undefined) {
            defaults[param.name] = param.default;
          }
        });
        paramForm.setFieldsValue(defaults);
      } catch (error: any) {
        message.error('加载离线包配置失败: ' + (error.message || '网络错误'));
        return;
      } finally {
        setMetadataLoading(false);
      }
    }

    if (currentStep === 1) {
      // 验证并保存第二步的表单值
      try {
        const values = await form.validateFields();
        setInstanceFormValues(values);
      } catch {
        return;
      }
    }

    setCurrentStep(currentStep + 1);
  };

  // 从部署参数中提取安装路径
  const extractInstallPath = (paramValues: Record<string, any>): string => {
    // 按优先级查找安装路径参数
    const pathKeys = ['NGINX_INSTALL_DIR', 'REDIS_INSTALL_DIR', 'OPENSSH_INSTALL_DIR', 'install_dir', 'install_path'];
    for (const key of pathKeys) {
      if (paramValues[key] && typeof paramValues[key] === 'string') {
        return paramValues[key];
      }
    }
    return '';
  };

  const handleCreate = async () => {
    try {
      const paramValues = await paramForm.validateFields();

      // 使用保存的表单值
      if (!instanceFormValues || !instanceFormValues.name || !instanceFormValues.server_id) {
        message.error('请填写实例名称并选择服务器');
        return;
      }

      if (!selectedPackage || !selectedPackage.id) {
        message.error('请选择一个离线包');
        return;
      }

      const installPath = extractInstallPath(paramValues);

      const submitData = {
        ...instanceFormValues,
        type: type || 'nginx',
        package_id: selectedPackage.id,
        version: selectedPackage.version,
        install_path: installPath,
        deploy_params: paramValues,
        auto_deploy: false,
      };

      setSubmitting(true);

      await instanceAPI.create(submitData);
      message.success('实例创建成功，可点击「部署」开始安装');
      closeModal();
      loadInstances();
    } catch (error: any) {
      message.error(error.message || '创建实例失败');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setCurrentStep(0);
    setSelectedPackage(null);
    setMetadata(null);
    setMetadataLoading(false);
    setInstanceFormValues(null);
    form.resetFields();
    paramForm.resetFields();
  };

  const openCreateModal = () => {
    closeModal();
    loadServers();
    loadPackages();
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await instanceAPI.delete(id);
      message.success('实例删除成功');
      loadInstances();
    } catch (error: any) {
      message.error('删除失败: ' + (error.message || '网络错误'));
    }
  };

  const handleDeploy = async (instance: MiddlewareInstance) => {
    if (!instance.package_id) {
      message.error('该实例未关联离线包，请删除后重新创建并选择离线包');
      return;
    }

    // 添加到正在部署集合，提供即时反馈
    setDeployingIds(prev => new Set(prev).add(instance.id));

    try {
      // 始终创建新部署任务，确保使用最新参数，避免复用有问题的旧任务
      const deployment = await createDeployment({
        name: `部署 ${instance.name}`,
        type: 'package',
        server_id: instance.server_id,
        instance_id: instance.id,
        package_id: instance.package_id,
        target_path: instance.install_path || '/tmp',
        deploy_params: instance.deploy_params || '',
      });
      await executeDeployment(deployment.id);
      // 自动弹出日志 Drawer
      setLogDeploymentId(deployment.id);
      setLogOptimisticStatus('running');
      setLogDrawerVisible(true);
      loadInstances();
    } catch (error: any) {
      // 用户友好的错误消息
      const msg = error.message || '部署失败';
      if (msg.includes('离线包') || msg.includes('package')) {
        message.error('关联的离线包不可用，请检查离线包是否已被删除');
      } else if (msg.includes('SSH') || msg.includes('连接')) {
        message.error('无法连接目标服务器，请检查服务器状态和网络');
      } else {
        message.error('部署失败: ' + msg);
      }
      setDeployingIds(prev => {
        const next = new Set(prev);
        next.delete(instance.id);
        return next;
      });
    }
  };

  // 当实例状态不再是 deploying 时，自动清理 deployingIds
  useEffect(() => {
    if (deployingIds.size === 0) return;
    const stillDeploying = new Set<number>();
    deployingIds.forEach(id => {
      const inst = instances.find(i => i.id === id);
      // 如果实例不存在或状态仍然是 deploying/unknown，保留
      if (!inst || inst.status === 'deploying' || inst.status === 'unknown') {
        stillDeploying.add(id);
      }
    });
    if (stillDeploying.size !== deployingIds.size) {
      setDeployingIds(stillDeploying);
    }
  }, [instances, deployingIds]);

  // 当有实例处于 deploying 状态时，每 5 秒刷新一次
  const hasDeploying = instances.some(inst => inst.status === 'deploying') || deployingIds.size > 0;
  const hasDeployingRef = useRef(hasDeploying);
  hasDeployingRef.current = hasDeploying;

  useEffect(() => {
    if (!hasDeploying) return;

    const timer = setInterval(() => {
      if (hasDeployingRef.current) {
        loadInstances();
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [hasDeploying, loadInstances]);

  // 查看实例最近一次部署的日志
  const openLatestDeploymentLog = async (instanceId: number) => {
    try {
      const response = await getDeploymentList({ instance_id: instanceId, page: 1, page_size: 1 });
      const latest = response.deployments?.[0];
      if (latest) {
        setLogDeploymentId(latest.id);
        setLogOptimisticStatus(latest.status === 'running' ? 'running' : undefined);
        setLogDrawerVisible(true);
      } else {
        message.info('该实例还没有部署记录');
      }
    } catch {
      message.error('获取部署记录失败');
    }
  };

  const filteredInstances = instances.filter(inst => {
    const matchSearch = inst.name.toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = !statusFilter || inst.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const typeLabel = type === 'nginx' ? 'Nginx' : type === 'redis' ? 'Redis' : 'OpenSSH';
  const typeSubtitle = type === 'nginx'
    ? '管理 Nginx 单机实例，支持离线包部署、版本升级与配置管理。'
    : type === 'redis'
    ? '管理 Redis 单机实例，支持离线包部署与数据浏览器。'
    : '管理 OpenSSH 单机实例，支持离线包部署与服务管理。';

  // 统计数据
  const stats = {
    total: instances.length,
    running: instances.filter(i => i.status === 'running').length,
    deploying: instances.filter(i => i.status === 'deploying').length + deployingIds.size,
    failed: instances.filter(i => i.status === 'failed').length,
  };

  // 当前选择的服务器名（用于确认摘要）
  const selectedServer = servers.find(s => s.id === instanceFormValues?.server_id);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow={`${typeLabel} 实例`}
        title={`${typeLabel} 实例管理`}
        subtitle={typeSubtitle}
        actions={
          <ActionGroup>
            <Button icon={<ReloadOutlined />} loading={loading} onClick={loadInstances}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新建实例</Button>
          </ActionGroup>
        }
      />

      {/* 统计条 */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}><StatCard label="总实例" value={stats.total} icon={<DatabaseOutlined />} color="#6366f1" /></Col>
        <Col xs={12} sm={6}><StatCard label="运行中" value={stats.running} icon={<CheckCircleOutlined />} color="#22c55e" /></Col>
        <Col xs={12} sm={6}><StatCard label="部署中" value={stats.deploying} icon={<LoadingOutlined />} color="#3b82f6" /></Col>
        <Col xs={12} sm={6}><StatCard label="失败" value={stats.failed} icon={<ExclamationCircleOutlined />} color="#ef4444" /></Col>
      </Row>

      <SectionCard title="实例列表" subtitle={`所有 ${typeLabel} 实例及其当前状态`}>
        <FilterToolbar
          left={
            <Space>
              <Input
                placeholder="搜索实例名称..."
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                style={{ width: 240 }}
                allowClear
              />
              <Select
                placeholder="筛选状态"
                value={statusFilter || undefined}
                onChange={v => setStatusFilter(v || '')}
                style={{ width: 140 }}
                allowClear
              >
                <Select.Option value="running">运行中</Select.Option>
                <Select.Option value="stopped">已停止</Select.Option>
                <Select.Option value="deploying">部署中</Select.Option>
                <Select.Option value="failed">部署失败</Select.Option>
                <Select.Option value="unknown">待部署</Select.Option>
              </Select>
            </Space>
          }
        />

        {/* 实例卡片列表 */}
        <Spin spinning={loading}>
          {filteredInstances.length > 0 ? (
            <div style={{ padding: '0 0 4px' }}>
              <Row gutter={[16, 16]}>
                {filteredInstances.map(instance => (
                  <Col key={instance.id} xs={24} sm={12} lg={8} xl={6}>
                    <InstanceCard
                      instance={instance}
                      deploying={deployingIds.has(instance.id)}
                      onManage={id => navigate(`/middleware/${type}/instances/${id}`)}
                      onDeploy={handleDeploy}
                      onViewLogs={(inst) => openLatestDeploymentLog(inst.id)}
                      onDelete={handleDelete}
                    />
                  </Col>
                ))}
              </Row>
            </div>
          ) : !loading ? (
            <Empty
              image={<CloudServerOutlined style={{ fontSize: 64, color: 'var(--text-secondary, #999)' }} />}
              description={
                <div>
                  <p style={{ fontSize: 16, color: 'var(--text-primary, #333)', margin: '16px 0 8px' }}>
                    还没有 {typeLabel} 实例
                  </p>
                  <p style={{ color: 'var(--text-secondary, #999)' }}>
                    创建第一个实例，选择离线包并配置部署参数
                  </p>
                </div>
              }
              style={{ padding: '40px 0' }}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                新建 {typeLabel} 实例
              </Button>
            </Empty>
          ) : null}
        </Spin>
      </SectionCard>

      {/* 创建实例向导 */}
      <Modal
        title={
          <Space>
            <RocketOutlined />
            <span>新建 {typeLabel} 实例</span>
          </Space>
        }
        open={modalVisible}
        onCancel={closeModal}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Steps
          current={currentStep}
          items={[
            { title: '选择离线包', description: '选择中间件版本' },
            { title: '实例信息', description: '名称与服务器' },
            { title: '部署参数', description: '配置安装参数' },
          ]}
          style={{ marginBottom: 32 }}
        />

        {/* Step 0: 选择离线包 */}
        {currentStep === 0 && (
          <PackageSelector
            type={type || 'nginx'}
            packages={packages}
            selectedPackage={selectedPackage}
            onSelect={setSelectedPackage}
          />
        )}

        {/* Step 1: 实例信息 */}
        {currentStep === 1 && (
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="实例名称"
              rules={[{ required: true, message: '请输入实例名称' }]}
              extra="建议使用环境+类型+编号的命名方式，如 prod-nginx-01"
            >
              <Input placeholder="例如：prod-nginx-01" />
            </Form.Item>
            <Form.Item
              name="server_id"
              label="关联服务器"
              rules={[{ required: true, message: '请选择服务器' }]}
            >
              <Select placeholder="选择一台服务器">
                {servers.map(s => (
                  <Select.Option key={s.id} value={s.id}>{s.name} ({s.host})</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="environment" label="环境标签" initialValue="prod">
              <Select placeholder="选择环境">
                <Select.Option value="prod">生产环境</Select.Option>
                <Select.Option value="test">测试环境</Select.Option>
                <Select.Option value="dev">开发环境</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={2} placeholder="可选，补充说明" />
            </Form.Item>
          </Form>
        )}

        {/* Step 2: 部署参数 + 确认摘要 */}
        {currentStep === 2 && (
          <>
            {metadataLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin tip="加载部署参数配置..." />
              </div>
            ) : metadata ? (
              <Form form={paramForm} layout="vertical">
                <ParameterForm parameters={metadata.parameters || []} form={paramForm} />
              </Form>
            ) : (
              <Alert
                message="无法加载部署参数"
                description="离线包配置加载失败，请返回上一步重试"
                type="warning"
                showIcon
              />
            )}

            {/* 确认摘要 */}
            <Divider style={{ margin: '16px 0' }} />
            <Alert
              message={
                <Space>
                  <InfoCircleOutlined />
                  <span>创建确认</span>
                </Space>
              }
              description={
                <Descriptions column={2} size="small" style={{ marginTop: 8 }}>
                  <Descriptions.Item label="离线包">
                    <Tag color="blue">{selectedPackage?.display_name || selectedPackage?.name} {selectedPackage?.version}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="目标服务器">
                    {selectedServer ? `${selectedServer.name} (${selectedServer.host})` : instanceFormValues?.server_id || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="实例名称">
                    {instanceFormValues?.name || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="环境">
                    <Tag>{instanceFormValues?.environment === 'prod' ? '生产' : instanceFormValues?.environment === 'test' ? '测试' : '开发'}</Tag>
                  </Descriptions.Item>
                </Descriptions>
              }
              type="info"
              style={{ borderRadius: 8 }}
            />
          </>
        )}

        {/* 底部按钮 */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {currentStep > 0 && (
              <Button onClick={() => setCurrentStep(currentStep - 1)}>上一步</Button>
            )}
          </div>
          <Space>
            {currentStep < 2 && (
              <Button type="primary" onClick={handleNext} loading={metadataLoading}>
                下一步
              </Button>
            )}
            {currentStep === 2 && (
              <Button type="primary" onClick={handleCreate} loading={submitting} disabled={metadataLoading}>
                创建实例
              </Button>
            )}
          </Space>
        </div>
      </Modal>

      {/* 部署日志 Drawer */}
      <DeployLogDrawer
        deploymentId={logDeploymentId}
        open={logDrawerVisible}
        optimisticStatus={logOptimisticStatus}
        onClose={() => {
          setLogDrawerVisible(false);
          setLogDeploymentId(null);
          setLogOptimisticStatus(undefined);
        }}
        onComplete={() => loadInstances()}
      />
    </div>
  );
}
