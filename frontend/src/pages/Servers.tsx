import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Tag,
  Space,
  Row,
  Col,
  Tooltip,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ApiOutlined,
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
import type { Server } from '../types';

const { Option } = Select;
const { TextArea } = Input;

const Servers: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('添加服务器');
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testingDirect, setTestingDirect] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [form] = Form.useForm();

  const loadServers = async () => {
    try {
      setLoading(true);
      const response = await getServerList({ page, page_size: pageSize });
      setServers(response.servers);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.message || '加载服务器列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, [page, pageSize]);

  const handleAdd = () => {
    setModalTitle('添加服务器');
    setEditingServer(null);
    form.resetFields();
    form.setFieldsValue({ port: 22, auth_type: 'password' });
    setModalVisible(true);
  };

  const handleEdit = (server: Server) => {
    setModalTitle('编辑服务器');
    setEditingServer(server);
    form.setFieldsValue({
      name: server.name,
      host: server.host,
      port: server.port,
      username: server.username,
      auth_type: server.auth_type,
      os_type: server.os_type,
      os_version: server.os_version,
      description: server.description,
    });
    setModalVisible(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true);
      if (editingServer) {
        await updateServer(editingServer.id, values);
        message.success('更新成功');
      } else {
        await createServer(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      loadServers();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteServer(id);
      message.success('删除成功');
      loadServers();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleTestConnection = async (id: number) => {
    try {
      setTestingId(id);
      const result = await testServerConnection(id);
      if (result.success) {
        message.success(`连接成功！延迟: ${result.latency_ms}ms`);
      } else {
        message.error(`连接失败: ${result.message}`);
      }
      loadServers();
    } catch (error: any) {
      message.error(error.message || '测试连接失败');
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
      if (result.success) {
        message.success(`连接成功！延迟: ${result.latency_ms}ms`);
        if (result.os_type) {
          form.setFieldsValue({ os_type: result.os_type, os_version: result.os_version });
        }
      } else {
        message.error(`连接失败: ${result.message}`);
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写必要的连接信息');
      } else {
        message.error(error.message || '测试连接失败');
      }
    } finally {
      setTestingDirect(false);
    }
  };

  // Filter servers
  const filteredServers = servers.filter((s) => {
    const matchSearch = !searchText ||
      s.name.toLowerCase().includes(searchText.toLowerCase()) ||
      s.host.toLowerCase().includes(searchText.toLowerCase());
    const matchStatus = !statusFilter || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const columns: ColumnsType<Server> = [
    {
      title: '服务器',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            className={`status-dot status-dot--${record.status === 'online' ? 'online' : record.status === 'offline' ? 'offline' : 'unknown'}`}
          />
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {record.host}:{record.port}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{text}</span>
      ),
    },
    {
      title: '认证',
      dataIndex: 'auth_type',
      key: 'auth_type',
      width: 80,
      render: (type: string) => (
        <Tag color={type === 'password' ? 'blue' : 'purple'}>
          {type === 'password' ? '密码' : '密钥'}
        </Tag>
      ),
    },
    {
      title: '操作系统',
      key: 'os',
      render: (_, record) =>
        record.os_type ? (
          <Tag color="cyan">
            {record.os_type} {record.os_version}
          </Tag>
        ) : (
          <span style={{ color: 'var(--text-tertiary)' }}>未知</span>
        ),
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_, record) => {
        const map: Record<string, { color: string; text: string }> = {
          online: { color: 'success', text: '在线' },
          offline: { color: 'error', text: '离线' },
          unknown: { color: 'default', text: '未知' },
        };
        const item = map[record.status] || map.unknown;
        return <Tag color={item.color}>{item.text}</Tag>;
      },
    },
    {
      title: '最后检查',
      key: 'last_check',
      render: (_, record) =>
        record.last_check_at ? (
          <Tooltip title={record.last_check_msg}>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              {new Date(record.last_check_at).toLocaleString('zh-CN')}
            </span>
          </Tooltip>
        ) : (
          <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>从未检查</span>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="测试连接">
            <Button
              type="text"
              icon={testingId === record.id ? <Spin size="small" /> : <ApiOutlined />}
              size="small"
              onClick={() => handleTestConnection(record.id)}
              disabled={testingId !== null}
              style={{ color: 'var(--color-primary)' }}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
              style={{ color: 'var(--text-secondary)' }}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个服务器吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                size="small"
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>服务器管理</span>
            <Input
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="搜索主机名或 IP"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 220, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
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
              <Option value="online">在线</Option>
              <Option value="offline">离线</Option>
              <Option value="unknown">未知</Option>
            </Select>
          </div>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadServers} size="small">
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="small">
              添加服务器
            </Button>
          </Space>
        }
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <Table
          columns={columns}
          dataSource={filteredServers}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 台服务器`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        footer={[
          <Button key="test" onClick={handleTestDirect} loading={testingDirect}>
            测试连接
          </Button>,
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={() => form.submit()}>
            {editingServer ? '更新' : '创建'}
          </Button>,
        ]}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="服务器名称" name="name" rules={[{ required: true, message: '请输入服务器名称' }]}>
                <Input placeholder="例如: Web Server 01" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="主机地址" name="host" rules={[{ required: true, message: '请输入主机地址' }]}>
                <Input placeholder="IP 地址或域名" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="SSH 端口" name="port">
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input placeholder="例如: root" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="认证方式" name="auth_type">
                <Select>
                  <Option value="password">密码</Option>
                  <Option value="key">密钥</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            noStyle
            shouldUpdate={(prev, cur) => prev.auth_type !== cur.auth_type}
          >
            {({ getFieldValue }) =>
              getFieldValue('auth_type') === 'password' ? (
                <Form.Item
                  label="密码"
                  name="password"
                  rules={[{ required: !editingServer, message: '请输入密码' }]}
                  extra={editingServer ? '留空表示不修改密码' : undefined}
                >
                  <Input.Password placeholder="SSH 密码" />
                </Form.Item>
              ) : (
                <>
                  <Form.Item
                    label="私钥"
                    name="private_key"
                    rules={[{ required: !editingServer, message: '请输入私钥' }]}
                    extra={editingServer ? '留空表示不修改私钥' : '粘贴私钥内容'}
                  >
                    <TextArea rows={4} placeholder="-----BEGIN RSA PRIVATE KEY-----..." />
                  </Form.Item>
                  <Form.Item label="私钥密码" name="passphrase">
                    <Input.Password placeholder="如果私钥有密码保护，请输入" />
                  </Form.Item>
                </>
              )
            }
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="操作系统类型" name="os_type">
                <Select placeholder="可通过测试连接自动检测" allowClear>
                  <Option value="rocky">Rocky Linux</Option>
                  <Option value="centos">CentOS</Option>
                  <Option value="openEuler">OpenEuler</Option>
                  <Option value="kylin">Kylin</Option>
                  <Option value="ubuntu">Ubuntu</Option>
                  <Option value="debian">Debian</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="操作系统版本" name="os_version">
                <Input placeholder="例如: 9.4" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="服务器描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Servers;
