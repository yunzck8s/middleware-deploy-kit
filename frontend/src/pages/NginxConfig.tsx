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
  Switch,
  message,
  Popconfirm,
  Tag,
  Space,
  Row,
  Col,
  Tabs,
  Divider,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  CodeOutlined,
  CopyOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  getNginxConfigList,
  createNginxConfig,
  updateNginxConfig,
  deleteNginxConfig,
  generateNginxConfig,
  previewNginxConfig,
} from '../api/nginx';
import { getCertificateList } from '../api/certificate';
import type { NginxConfig, Certificate } from '../types';
import ApplyConfigModal from '../components/nginx/ApplyConfigModal';

const { Option } = Select;
const { TextArea } = Input;

const NginxConfigPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<NginxConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('创建配置');
  const [editingConfig, setEditingConfig] = useState<NginxConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [form] = Form.useForm();

  // 加载配置列表
  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await getNginxConfigList({ page, page_size: pageSize });
      setConfigs(response.configs);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.message || '加载配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载证书列表
  const loadCertificates = async () => {
    try {
      const certRes = await getCertificateList({ page: 1, page_size: 100 });
      setCertificates(certRes.certificates);
    } catch (error) {
      console.error('加载证书列表失败', error);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadCertificates();
  }, [page, pageSize]);

  // 打开添加对话框
  const handleAdd = () => {
    setModalTitle('创建 Nginx 配置');
    setEditingConfig(null);
    form.resetFields();
    form.setFieldsValue({
      worker_processes: 'auto',
      worker_connections: 1024,
      enable_http: true,
      http_port: 80,
      enable_https: false,
      https_port: 443,
      http_to_https: false,
      server_name: '_',
      root_path: '/usr/share/nginx/html',
      index_files: 'index.html index.htm',
      access_log_path: '/var/log/nginx/access.log',
      error_log_path: '/var/log/nginx/error.log',
      log_format: 'json',
      enable_proxy: false,
      client_max_body_size: '100m',
      gzip: true,
    });
    setModalVisible(true);
  };

  // 打开编辑对话框
  const handleEdit = (config: NginxConfig) => {
    setModalTitle('编辑 Nginx 配置');
    setEditingConfig(config);

    // 处理 locations：如果为空，设置默认值
    const formValues = {
      ...config,
      locations: config.locations && config.locations.length > 0
        ? config.locations
        : [{ path: '/', proxy_pass: '' }]
    };

    form.setFieldsValue(formValues);
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async (values: any) => {
    try {
      setSubmitting(true);
      if (editingConfig) {
        await updateNginxConfig(editingConfig.id, values);
        message.success('更新成功');
      } else {
        await createNginxConfig(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      loadConfigs();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除配置
  const handleDelete = async (id: number) => {
    try {
      await deleteNginxConfig(id);
      message.success('删除成功');
      loadConfigs();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 查看生成的配置
  const handleViewGenerated = async (id: number) => {
    try {
      setPreviewing(true);
      const result = await generateNginxConfig(id);
      setPreviewContent(result.content);
      setPreviewVisible(true);
    } catch (error: any) {
      message.error(error.message || '生成配置失败');
    } finally {
      setPreviewing(false);
    }
  };

  // 预览当前表单配置
  const handlePreview = async () => {
    try {
      const values = await form.validateFields();
      setPreviewing(true);
      const result = await previewNginxConfig(values);
      setPreviewContent(result.content);
      setPreviewVisible(true);
    } catch (error: any) {
      if (!error.errorFields) {
        message.error(error.message || '预览失败');
      }
    } finally {
      setPreviewing(false);
    }
  };

  // 复制配置
  const handleCopy = () => {
    navigator.clipboard.writeText(previewContent);
    message.success('已复制到剪贴板');
  };

  // 打开应用配置对话框
  const handleApplyConfig = (id: number) => {
    setSelectedConfigId(id);
    setApplyModalVisible(true);
  };

  // 应用配置成功回调
  const handleApplySuccess = () => {
    loadConfigs();
  };

  const columns: ColumnsType<NginxConfig> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '配置名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          {record.description && (
            <div style={{ fontSize: '12px', color: '#999' }}>{record.description}</div>
          )}
        </div>
      ),
    },
    {
      title: '监听端口',
      key: 'ports',
      render: (_, record) => (
        <Space>
          {record.enable_http && <Tag color="blue">HTTP:{record.http_port}</Tag>}
          {record.enable_https && <Tag color="green">HTTPS:{record.https_port}</Tag>}
        </Space>
      ),
    },
    {
      title: '域名',
      dataIndex: 'server_name',
      key: 'server_name',
    },
    {
      title: '日志格式',
      dataIndex: 'log_format',
      key: 'log_format',
      render: (format: string) => (
        <Tag color={format === 'json' ? 'purple' : 'default'}>
          {format.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colors: Record<string, string> = {
          draft: 'default',
          active: 'success',
          disabled: 'error',
        };
        const labels: Record<string, string> = {
          draft: '草稿',
          active: '已启用',
          disabled: '已禁用',
        };
        return <Tag color={colors[status]}>{labels[status]}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handleViewGenerated(record.id)}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<SendOutlined />}
            size="small"
            onClick={() => handleApplyConfig(record.id)}
          >
            应用配置
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个配置吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title="Nginx 可视化配置"
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadConfigs}>
                  刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
                  创建配置
                </Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={configs}
              rowKey="id"
              loading={loading}
              pagination={{
                current: page,
                pageSize: pageSize,
                total: total,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个配置`,
                onChange: (page, pageSize) => {
                  setPage(page);
                  setPageSize(pageSize);
                },
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 创建/编辑配置对话框 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="preview" icon={<CodeOutlined />} onClick={handlePreview} loading={previewing}>
            预览配置
          </Button>,
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={() => form.submit()}>
            {editingConfig ? '更新' : '创建'}
          </Button>,
        ]}
        width={900}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Tabs
            items={[
              {
                key: 'basic',
                label: '基本配置',
                children: (
                  <>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="配置名称"
                          name="name"
                          rules={[{ required: true, message: '请输入配置名称' }]}
                        >
                          <Input placeholder="例如: production-web" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="描述" name="description">
                          <Input placeholder="配置描述（可选）" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item label="Worker 进程数" name="worker_processes">
                          <Input placeholder="auto" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="Worker 连接数" name="worker_connections">
                          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="客户端最大请求体" name="client_max_body_size">
                          <Input placeholder="100m" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="域名" name="server_name">
                          <Input placeholder="_ (匹配所有) 或 example.com" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="根目录" name="root_path">
                          <Input placeholder="/usr/share/nginx/html" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item label="索引文件" name="index_files">
                      <Input placeholder="index.html index.htm" />
                    </Form.Item>
                    <Form.Item name="gzip" valuePropName="checked">
                      <Switch checkedChildren="启用 Gzip" unCheckedChildren="禁用 Gzip" />
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'http',
                label: 'HTTP/HTTPS',
                children: (
                  <>
                    <Divider>HTTP 配置</Divider>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item name="enable_http" valuePropName="checked">
                          <Switch checkedChildren="启用 HTTP" unCheckedChildren="禁用 HTTP" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="HTTP 端口" name="http_port">
                          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Divider>HTTPS 配置</Divider>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item name="enable_https" valuePropName="checked">
                          <Switch checkedChildren="启用 HTTPS" unCheckedChildren="禁用 HTTPS" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="HTTPS 端口" name="https_port">
                          <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="http_to_https" valuePropName="checked">
                          <Switch checkedChildren="HTTP 跳转 HTTPS" unCheckedChildren="不跳转" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item label="SSL 证书" name="certificate_id">
                      <Select placeholder="选择证书" allowClear>
                        {certificates.filter(c => c.status === 'active').map(cert => (
                          <Option key={cert.id} value={cert.id}>
                            {cert.name} ({cert.domain})
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'proxy',
                label: '反向代理',
                children: (
                  <>
                    <Form.Item name="enable_proxy" valuePropName="checked">
                      <Switch checkedChildren="启用反向代理" unCheckedChildren="禁用反向代理" />
                    </Form.Item>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prevValues, currentValues) =>
                        prevValues.enable_proxy !== currentValues.enable_proxy
                      }
                    >
                      {({ getFieldValue }) =>
                        getFieldValue('enable_proxy') && (
                          <>
                            <Alert
                              message="反向代理配置"
                              description="配置 Nginx 将请求转发到后端服务。可以添加多个 location 路径，支持代理不同的后端服务或静态文件。"
                              type="info"
                              showIcon
                              style={{ marginBottom: 16 }}
                            />
                            <Form.List name="locations" initialValue={[{ path: '/', proxy_pass: '' }]}>
                              {(fields, { add, remove }) => (
                                <>
                                  {fields.map(({ key, name, ...restField }, index) => (
                                    <Card
                                      key={key}
                                      size="small"
                                      title={`Location ${index + 1}`}
                                      extra={
                                        fields.length > 1 && (
                                          <Button
                                            type="link"
                                            danger
                                            size="small"
                                            onClick={() => remove(name)}
                                          >
                                            删除
                                          </Button>
                                        )
                                      }
                                      style={{ marginBottom: 16 }}
                                    >
                                      <Row gutter={16}>
                                        <Col span={8}>
                                          <Form.Item
                                            {...restField}
                                            name={[name, 'path']}
                                            label="路径"
                                            rules={[{ required: true, message: '请输入路径' }]}
                                          >
                                            <Input placeholder="/ 或 /api 或 /static" />
                                          </Form.Item>
                                        </Col>
                                        <Col span={16}>
                                          <Form.Item
                                            {...restField}
                                            name={[name, 'proxy_pass']}
                                            label="代理地址"
                                            tooltip="留空则作为静态文件目录"
                                          >
                                            <Input placeholder="http://127.0.0.1:3000" />
                                          </Form.Item>
                                        </Col>
                                      </Row>
                                      <Form.Item
                                        {...restField}
                                        name={[name, 'root']}
                                        label="静态文件路径（可选）"
                                        tooltip="当不使用反向代理时，指定静态文件目录，如 /var/www/html"
                                      >
                                        <Input placeholder="/var/www/html" />
                                      </Form.Item>
                                      <Form.Item
                                        {...restField}
                                        name={[name, 'try_files']}
                                        label="try_files 配置（可选）"
                                        tooltip="自定义 try_files 指令，如 $uri $uri/ /index.html"
                                      >
                                        <Input placeholder="$uri $uri/ =404" />
                                      </Form.Item>
                                    </Card>
                                  ))}
                                  <Form.Item>
                                    <Button
                                      type="dashed"
                                      onClick={() => add({ path: '', proxy_pass: '' })}
                                      block
                                      icon={<PlusOutlined />}
                                    >
                                      添加 Location
                                    </Button>
                                  </Form.Item>
                                </>
                              )}
                            </Form.List>
                          </>
                        )
                      }
                    </Form.Item>
                  </>
                ),
              },
              {
                key: 'log',
                label: '日志配置',
                children: (
                  <>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="访问日志路径" name="access_log_path">
                          <Input placeholder="/var/log/nginx/access.log" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="错误日志路径" name="error_log_path">
                          <Input placeholder="/var/log/nginx/error.log" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item
                      label="日志格式"
                      name="log_format"
                      tooltip="选择日志输出格式，影响日志分析和监控系统的集成"
                    >
                      <Select>
                        <Option value="main">标准格式 (main)</Option>
                        <Option value="json">JSON 格式</Option>
                      </Select>
                    </Form.Item>
                    <Alert
                      message="日志格式说明"
                      description={
                        <div style={{ fontSize: '12px' }}>
                          <div><strong>标准格式 (main)</strong>：传统的文本格式，适合人工查看，每行包含 IP、时间、请求方法等信息。</div>
                          <div style={{ marginTop: 4 }}><strong>JSON 格式</strong>：结构化的 JSON 格式，便于日志收集系统（ELK、Loki 等）解析和分析，支持复杂查询和统计。</div>
                        </div>
                      }
                      type="info"
                      showIcon
                      style={{ marginBottom: 0 }}
                    />
                  </>
                ),
              },
              {
                key: 'custom',
                label: '自定义配置',
                children: (
                  <Form.Item
                    label="自定义配置"
                    name="custom_config"
                    extra="直接添加到 http 块中的自定义配置"
                  >
                    <TextArea rows={10} placeholder="# 在此添加自定义 Nginx 配置" />
                  </Form.Item>
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      {/* 配置预览对话框 */}
      <Modal
        title="Nginx 配置预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        width={800}
        zIndex={1100}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={handleCopy}>
            复制
          </Button>,
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <pre
          style={{
            background: '#1e1e1e',
            color: '#d4d4d4',
            padding: '16px',
            borderRadius: '4px',
            maxHeight: '500px',
            overflow: 'auto',
            fontSize: '13px',
            lineHeight: '1.5',
          }}
        >
          {previewContent}
        </pre>
      </Modal>

      {/* 应用配置对话框 */}
      {selectedConfigId && (
        <ApplyConfigModal
          configId={selectedConfigId}
          open={applyModalVisible}
          onClose={() => setApplyModalVisible(false)}
          onSuccess={handleApplySuccess}
        />
      )}
    </div>
  );
};

export default NginxConfigPage;
