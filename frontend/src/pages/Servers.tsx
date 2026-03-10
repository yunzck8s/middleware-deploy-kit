import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tooltip,
  message,
  Popconfirm,
  Spin,
} from 'antd';
import {
  ApiOutlined,
  CloudServerOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getServerList,
  createServer,
  updateServer,
  deleteServer,
  testServerConnection,
  testConnectionDirect,
} from '../api/server';
import type { Server, SSHTestResult } from '../types';
import PageHeader from '../components/common/PageHeader';
import MetricTile from '../components/common/MetricTile';
import SectionCard from '../components/common/SectionCard';
import FilterToolbar from '../components/common/FilterToolbar';
import ActionGroup from '../components/common/ActionGroup';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import { formatDateTime } from '../utils/formatters';

const { Option } = Select;
const { TextArea } = Input;

const Servers = () => {
  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testingDirect, setTestingDirect] = useState(false);
  const [directTestResult, setDirectTestResult] = useState<SSHTestResult | null>(null);
  const [form] = Form.useForm();

  const loadServers = async () => {
    try {
      setLoading(true);
      const response = await getServerList({ page: 1, page_size: 1000 });
      setServers(response.servers || []);
      setTotal(response.servers?.length || 0);
    } catch (error: any) {
      message.error(error.message || '暂时无法加载服务器列表');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      const matchesSearch = !searchText
        || server.name.toLowerCase().includes(searchText.toLowerCase())
        || server.host.toLowerCase().includes(searchText.toLowerCase());
      const matchesStatus = !statusFilter || server.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [servers, searchText, statusFilter]);

  const onlineCount = useMemo(() => servers.filter((server) => server.status === 'online').length, [servers]);
  const offlineCount = useMemo(() => servers.filter((server) => server.status === 'offline').length, [servers]);
  const autoDetectedOs = useMemo(() => servers.filter((server) => server.os_type).length, [servers]);

  const handleAdd = () => {
    setEditingServer(null);
    setDirectTestResult(null);
    form.resetFields();
    form.setFieldsValue({ port: 22, auth_type: 'password' });
    setDrawerVisible(true);
  };

  const handleEdit = (server: Server) => {
    setEditingServer(server);
    setDirectTestResult(null);
    form.setFieldsValue({
      ...server,
      password: undefined,
      private_key: undefined,
      passphrase: undefined,
    });
    setDrawerVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteServer(id);
      message.success('服务器已删除');
      loadServers();
    } catch (error: any) {
      message.error(error.message || '删除服务器失败');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true);
      if (editingServer) {
        await updateServer(editingServer.id, values);
        message.success('服务器信息已保存');
      } else {
        await createServer(values);
        message.success('服务器已保存，可用于部署和配置应用');
      }
      setDrawerVisible(false);
      form.resetFields();
      setDirectTestResult(null);
      loadServers();
    } catch (error: any) {
      message.error(error.message || '保存服务器失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestConnection = async (id: number) => {
    try {
      setTestingId(id);
      const result = await testServerConnection(id);
      if (result.success) {
        message.success(`SSH 连接成功，延迟 ${result.latency_ms} ms`);
      } else {
        message.error(`SSH 连接失败：${result.message}`);
      }
      loadServers();
    } catch (error: any) {
      message.error(error.message || '暂时无法完成 SSH 连接测试');
    } finally {
      setTestingId(null);
    }
  };

  const handleTestDirect = async () => {
    try {
      const values = await form.validateFields([
        'host', 'port', 'username', 'auth_type', 'password', 'private_key', 'passphrase',
      ]);
      setTestingDirect(true);
      const result = await testConnectionDirect(values);
      setDirectTestResult(result);
      if (result.success && result.os_type) {
        form.setFieldsValue({ os_type: result.os_type, os_version: result.os_version });
      }
      if (result.success) {
        message.success(`SSH 连接成功，延迟 ${result.latency_ms} ms`);
      } else {
        message.error(`SSH 连接失败：${result.message}`);
      }
    } catch (error: any) {
      if (!error?.errorFields) {
        message.error(error.message || '暂时无法完成 SSH 连接测试');
      }
    } finally {
      setTestingDirect(false);
    }
  };

  const columns: ColumnsType<Server> = [
    {
      title: '服务器',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`status-dot status-dot--${record.status === 'online' ? 'online' : record.status === 'offline' ? 'offline' : 'unknown'}`} />
          <div>
            <div style={{ fontWeight: 700 }}>{text}</div>
            <div style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {record.host}:{record.port}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '连接信息',
      key: 'auth',
      render: (_, record) => (
        <div>
          <div>{record.username}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
            {record.auth_type === 'password' ? '密码认证' : '密钥认证'}
          </div>
        </div>
      ),
    },
    {
      title: '系统',
      key: 'os',
      render: (_, record) => (
        record.os_type ? <StatusBadge status="valid" label={`${record.os_type} ${record.os_version || ''}`.trim()} compact /> : <StatusBadge status="unknown" label="待识别" compact />
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_, record) => <StatusBadge status={record.status} compact />,
    },
    {
      title: '上次检测',
      key: 'last_check',
      render: (_, record) => (
        record.last_check_at ? (
          <div>
            <div>{formatDateTime(record.last_check_at, 'YYYY-MM-DD HH:mm')}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{record.last_check_msg || '最近一次检测已完成'}</div>
          </div>
        ) : <span style={{ color: 'var(--text-secondary)' }}>尚未检测</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 168,
      render: (_, record) => (
        <Space>
          <Tooltip title="测试这台服务器的 SSH 连接">
            <Button
              type="text"
              icon={testingId === record.id ? <Spin size="small" /> : <ApiOutlined />}
              size="small"
              onClick={() => handleTestConnection(record.id)}
              disabled={testingId !== null}
              aria-label="测试 SSH 连接"
            />
          </Tooltip>
          <Tooltip title="编辑这台服务器">
            <Button type="text" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} aria-label="编辑服务器" />
          </Tooltip>
          <Popconfirm title={`删除服务器“${record.name}”后，不会自动删除已有部署记录。确定删除吗？`} onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Tooltip title="删除这台服务器">
              <Button type="text" danger icon={<DeleteOutlined />} size="small" aria-label="删除服务器" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="服务器资源管理"
        title="服务器管理"
        subtitle="维护目标服务器、SSH 凭据和连通性，为部署和配置应用提供执行目标。"
        actions={(
          <ActionGroup>
            <Button icon={<ReloadOutlined />} onClick={loadServers}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增服务器</Button>
          </ActionGroup>
        )}
      />

      <div className="metric-grid metric-grid--cols-4">
        <MetricTile label="服务器总数" value={total} hint="当前纳入控制台管理的节点" icon={<CloudServerOutlined />} loading={loading} />
        <MetricTile label="在线节点" value={onlineCount} hint="最近检测成功并可访问" icon={<CloudServerOutlined />} tone="success" loading={loading} />
        <MetricTile label="离线节点" value={offlineCount} hint="需要检查网络、认证或主机状态" icon={<ApiOutlined />} tone={offlineCount > 0 ? 'danger' : 'default'} loading={loading} />
        <MetricTile label="系统识别率" value={`${total ? Math.round((autoDetectedOs / total) * 100) : 0}%`} hint="通过连接测试自动填充的 OS 信息" icon={<SearchOutlined />} tone="info" loading={loading} />
      </div>

      <SectionCard title="服务器列表" subtitle="按状态、认证方式和最近一次检测结果筛选目标服务器。" className="ops-table">
        <FilterToolbar
          left={(
            <>
              <Input
                prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
                placeholder="搜索主机名或 IP"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                style={{ width: 240 }}
                allowClear
              />
              <Select
                placeholder="按状态筛选"
                value={statusFilter}
                onChange={setStatusFilter}
                allowClear
                style={{ width: 140 }}
              >
                <Option value="online">在线</Option>
                <Option value="offline">离线</Option>
                <Option value="unknown">未知</Option>
              </Select>
            </>
          )}
          right={<span className="summary-card__hint">新增或编辑服务器时，可先测试 SSH 连接再保存</span>}
        />

        {filteredServers.length === 0 && !loading ? (
          <EmptyState title="还没有服务器资源" description="先录入一台可连接的目标服务器，再开始配置应用或离线包部署。" action={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增第一台服务器</Button>} />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredServers}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{
              current: page,
              pageSize,
              total: filteredServers.length,
              showSizeChanger: true,
              showTotal: (count) => `共 ${count} 台服务器`,
              onChange: (currentPage, currentPageSize) => {
                setPage(currentPage);
                setPageSize(currentPageSize);
              },
            }}
          />
        )}
      </SectionCard>

      <Drawer
        title={editingServer ? '编辑服务器' : '新增服务器'}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setDirectTestResult(null);
          form.resetFields();
        }}
        width={620}
        extra={(
          <ActionGroup>
            <Button onClick={handleTestDirect} loading={testingDirect}>测试 SSH 连接</Button>
            <Button type="primary" onClick={() => form.submit()} loading={submitting}>{editingServer ? '保存服务器' : '保存服务器'}</Button>
          </ActionGroup>
        )}
      >
        <div className="page-stack" style={{ gap: 16 }}>
          {directTestResult && (
            <div className="summary-card">
              <div className="summary-card__label">最近一次连通性测试</div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <StatusBadge status={directTestResult.success ? 'success' : 'failed'} compact />
                <span className="summary-card__hint">延迟 {directTestResult.latency_ms} ms</span>
                {directTestResult.os_type && (
                  <span className="summary-card__hint">{directTestResult.os_type} {directTestResult.os_version || ''}</span>
                )}
              </div>
              <div style={{ marginTop: 10, color: 'var(--text-secondary)' }}>{directTestResult.message}</div>
            </div>
          )}

          <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ port: 22, auth_type: 'password' }}>
            <div className="config-section-card">
              <div className="config-section-card__title">连接目标</div>
              <div className="operation-grid">
                <div className="operation-grid__main">
                  <Form.Item label="服务器名称" name="name" rules={[{ required: true, message: '请输入服务器名称' }]} extra="建议使用环境 + 角色 + 编号的命名方式">
                    <Input placeholder="例如：prod-edge-01" />
                  </Form.Item>
                </div>
                <div className="operation-grid__aside">
                  <Form.Item label="SSH 端口" name="port">
                    <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                  </Form.Item>
                </div>
              </div>
              <Form.Item label="主机地址或域名" name="host" rules={[{ required: true, message: '请输入主机地址或域名' }]} extra="支持 IP 地址或可解析的域名">
                <Input placeholder="例如：10.0.0.12 或 edge.example.com" />
              </Form.Item>
            </div>

            <div className="config-section-card">
              <div className="config-section-card__title">SSH 认证</div>
              <div className="operation-grid">
                <div className="operation-grid__main">
                  <Form.Item label="SSH 用户名" name="username" rules={[{ required: true, message: '请输入 SSH 用户名' }]}>
                    <Input placeholder="例如：root" />
                  </Form.Item>
                </div>
                <div className="operation-grid__aside">
                  <Form.Item label="认证方式" name="auth_type">
                    <Select>
                      <Option value="password">密码</Option>
                      <Option value="key">密钥</Option>
                    </Select>
                  </Form.Item>
                </div>
              </div>

              <Form.Item noStyle shouldUpdate={(prev, current) => prev.auth_type !== current.auth_type}>
                {({ getFieldValue }) => getFieldValue('auth_type') === 'password' ? (
                  <Form.Item
                    label="密码"
                    name="password"
                    rules={[{ required: !editingServer, message: '请输入密码' }]}
                    extra={editingServer ? '编辑时留空则保留当前密码' : '请输入目标服务器的 SSH 登录密码'}
                  >
                    <Input.Password placeholder="请输入 SSH 登录密码" />
                  </Form.Item>
                ) : (
                  <>
                    <Form.Item
                      label="私钥"
                      name="private_key"
                      rules={[{ required: !editingServer, message: '请输入私钥' }]}
                      extra={editingServer ? '编辑时留空则保留当前私钥' : '粘贴完整私钥内容，包含 BEGIN / END 标记'}
                    >
                      <TextArea rows={5} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
                    </Form.Item>
                    <Form.Item label="私钥密码" name="passphrase">
                      <Input.Password placeholder="如果私钥设置了密码，请填写" />
                    </Form.Item>
                  </>
                )}
              </Form.Item>
            </div>

            <div className="config-section-card">
              <div className="config-section-card__title">系统信息</div>
              <div className="operation-grid">
                <div className="operation-grid__main">
                  <Form.Item label="操作系统类型" name="os_type">
                    <Select placeholder="如未自动识别，可手动选择" allowClear>
                      <Option value="rocky">Rocky Linux</Option>
                      <Option value="centos">CentOS</Option>
                      <Option value="openEuler">OpenEuler</Option>
                      <Option value="kylin">Kylin</Option>
                      <Option value="ubuntu">Ubuntu</Option>
                      <Option value="debian">Debian</Option>
                    </Select>
                  </Form.Item>
                </div>
                <div className="operation-grid__aside">
                  <Form.Item label="系统版本" name="os_version">
                    <Input placeholder="例如：9.4" />
                  </Form.Item>
                </div>
              </div>
              <Form.Item label="描述" name="description">
                <TextArea rows={3} placeholder="例如：生产边缘节点，位于华东机房" />
              </Form.Item>
            </div>
          </Form>
        </div>
      </Drawer>
    </div>
  );
};

export default Servers;
