import React, { useState, useEffect } from 'react';
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
  Steps,
  Spin,
  Typography,
  Tooltip,
  Row,
  Col,
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
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getDeploymentList,
  createDeployment,
  deleteDeployment,
  executeDeployment,
  getDeploymentLogs,
  rollbackDeployment,
} from '../api/deployment';
import { getServerList } from '../api/server';
import { getNginxConfigList } from '../api/nginx';
import { getPackageList } from '../api/package';
import { getCertificateList } from '../api/certificate';
import type {
  Deployment,
  DeploymentLog,
  Server,
  NginxConfig,
  MiddlewarePackage,
  Certificate,
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
  const [deployType, setDeployType] = useState<string>('nginx_config');

  // 资源列表
  const [servers, setServers] = useState<Server[]>([]);
  const [nginxConfigs, setNginxConfigs] = useState<NginxConfig[]>([]);
  const [packages, setPackages] = useState<MiddlewarePackage[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  // 日志查看
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [currentDeployment, setCurrentDeployment] = useState<Deployment | null>(null);
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [form] = Form.useForm();

  // 加载部署列表
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

  // 加载资源列表
  const loadResources = async () => {
    try {
      const [serverRes, nginxRes, pkgRes, certRes] = await Promise.all([
        getServerList({ page: 1, page_size: 100 }),
        getNginxConfigList({ page: 1, page_size: 100 }),
        getPackageList({ page: 1, page_size: 100 }),
        getCertificateList({ page: 1, page_size: 100 }),
      ]);
      setServers(serverRes.servers || []);
      setNginxConfigs(nginxRes.configs || []);
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

  // 自动刷新日志
  useEffect(() => {
    let timer: number | undefined;
    if (autoRefresh && currentDeployment) {
      timer = window.setInterval(() => {
        loadLogs(currentDeployment.id);
        // 检查是否还在运行中
        loadDeployments();
      }, 2000);
    }
    return () => {
      if (timer) window.clearInterval(timer);
    };
  }, [autoRefresh, currentDeployment]);

  // 加载日志
  const loadLogs = async (deploymentId: number) => {
    try {
      setLogsLoading(true);
      const logsData = await getDeploymentLogs(deploymentId);
      setLogs(logsData || []);
    } catch (error: any) {
      console.error('加载日志失败', error);
    } finally {
      setLogsLoading(false);
    }
  };

  // 查看日志
  const handleViewLogs = async (record: Deployment) => {
    setCurrentDeployment(record);
    setLogModalVisible(true);
    await loadLogs(record.id);
    // 如果任务正在运行，启动自动刷新
    if (record.status === 'running') {
      setAutoRefresh(true);
    }
  };

  // 创建部署任务
  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await createDeployment(values);
      message.success('部署任务创建成功');
      setModalVisible(false);
      form.resetFields();
      loadDeployments();
    } catch (error: any) {
      if (error.message) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 执行部署
  const handleExecute = async (record: Deployment) => {
    try {
      await executeDeployment(record.id);
      message.success('部署任务已开始执行');
      loadDeployments();
      // 打开日志查看
      handleViewLogs(record);
    } catch (error: any) {
      message.error(error.message || '执行部署失败');
    }
  };

  // 删除部署
  const handleDelete = async (id: number) => {
    try {
      await deleteDeployment(id);
      message.success('删除成功');
      loadDeployments();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 回滚部署
  const handleRollback = async (record: Deployment) => {
    try {
      const result = await rollbackDeployment(record.id);
      message.success(result.message || '回滚任务已开始执行');
      loadDeployments();
      // 打开日志查看
      if (result.deployment) {
        handleViewLogs(result.deployment);
      }
    } catch (error: any) {
      message.error(error.message || '回滚失败');
    }
  };

  // 状态标签
  const renderStatus = (status: string) => {
    const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: '待执行' },
      running: { color: 'processing', icon: <LoadingOutlined />, text: '执行中' },
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '成功' },
      failed: { color: 'error', icon: <CloseCircleOutlined />, text: '失败' },
      cancelled: { color: 'warning', icon: <CloseCircleOutlined />, text: '已取消' },
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

  const columns: ColumnsType<Deployment> = [
    {
      title: '名称',
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
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (val) => new Date(val).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          {(record.status === 'pending' || record.status === 'failed') && (
            <Tooltip title="执行部署">
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleExecute(record)}
              >
                执行
              </Button>
            </Tooltip>
          )}
          <Tooltip title="查看日志">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewLogs(record)}
            />
          </Tooltip>
          {record.can_rollback && record.status === 'success' && (
            <Popconfirm
              title="确定要回滚到之前的版本吗？"
              onConfirm={() => handleRollback(record)}
            >
              <Tooltip title="回滚部署">
                <Button size="small" icon={<RollbackOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          {record.status !== 'running' && (
            <Popconfirm
              title="确定要删除这个部署任务吗？"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

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

  return (
    <div>
      <Card
        title="部署管理"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadDeployments}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.resetFields();
                setDeployType('nginx_config');
                setModalVisible(true);
              }}
            >
              创建部署任务
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

      {/* 创建部署任务对话框 */}
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
          initialValues={{
            type: 'nginx_config',
            backup_enabled: true,
            restart_service: false,
          }}
        >
          <Form.Item
            name="name"
            label="任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="例如：生产环境 Nginx 配置部署" />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="任务描述（可选）" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="部署类型"
                rules={[{ required: true }]}
              >
                <Select onChange={(val) => setDeployType(val)}>
                  <Option value="nginx_config">Nginx 配置</Option>
                  <Option value="package">离线包</Option>
                  <Option value="certificate">证书</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="server_id"
                label="目标服务器"
                rules={[{ required: true, message: '请选择目标服务器' }]}
              >
                <Select placeholder="选择服务器">
                  {servers.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {s.name} ({s.host})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* 根据类型显示不同的资源选择 */}
          {deployType === 'nginx_config' && (
            <Form.Item
              name="nginx_config_id"
              label="Nginx 配置"
              rules={[{ required: true, message: '请选择 Nginx 配置' }]}
            >
              <Select placeholder="选择配置">
                {nginxConfigs.map((c) => (
                  <Option key={c.id} value={c.id}>
                    {c.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {deployType === 'package' && (
            <Form.Item
              name="package_id"
              label="离线包"
              rules={[{ required: true, message: '请选择离线包' }]}
            >
              <Select placeholder="选择离线包">
                {packages.map((p) => (
                  <Option key={p.id} value={p.id}>
                    {p.display_name} v{p.version}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {deployType === 'certificate' && (
            <Form.Item
              name="certificate_id"
              label="证书"
              rules={[{ required: true, message: '请选择证书' }]}
            >
              <Select placeholder="选择证书">
                {certificates.map((c) => (
                  <Option key={c.id} value={c.id}>
                    {c.name} ({c.domain})
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="target_path" label="目标路径">
            <Input
              placeholder={
                deployType === 'nginx_config'
                  ? '/etc/nginx/nginx.conf'
                  : deployType === 'certificate'
                  ? '/etc/nginx/ssl'
                  : '/tmp'
              }
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="backup_enabled" valuePropName="checked">
                <Switch checkedChildren="备份原文件" unCheckedChildren="不备份" />
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

      {/* 日志查看对话框 */}
      <Modal
        title={`部署日志 - ${currentDeployment?.name || ''}`}
        open={logModalVisible}
        onCancel={() => {
          setLogModalVisible(false);
          setAutoRefresh(false);
          setCurrentDeployment(null);
        }}
        footer={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={() => currentDeployment && loadLogs(currentDeployment.id)}
          >
            刷新
          </Button>,
          <Button
            key="close"
            onClick={() => {
              setLogModalVisible(false);
              setAutoRefresh(false);
            }}
          >
            关闭
          </Button>,
        ]}
        width={700}
      >
        <Spin spinning={logsLoading}>
          {currentDeployment && (
            <div style={{ marginBottom: 16 }}>
              <Space>
                {renderStatus(currentDeployment.status)}
                {currentDeployment.status === 'running' && (
                  <Text type="secondary">自动刷新中...</Text>
                )}
                {currentDeployment.duration > 0 && (
                  <Text type="secondary">耗时: {currentDeployment.duration}s</Text>
                )}
              </Space>
              {currentDeployment.error_msg && (
                <div style={{ marginTop: 8 }}>
                  <Text type="danger">{currentDeployment.error_msg}</Text>
                </div>
              )}
            </div>
          )}
          <Steps
            direction="vertical"
            size="small"
            current={logs.findIndex((l) => l.status === 'running')}
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
              暂无日志
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default DeploymentsPage;
