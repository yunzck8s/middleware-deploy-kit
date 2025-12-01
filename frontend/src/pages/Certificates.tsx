import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Upload,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
  Tag,
  Space,
  Row,
  Col,
  Tooltip,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  DownloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  getCertificateList,
  uploadCertificate,
  deleteCertificate,
  downloadCertificateFile,
} from '../api/certificate';
import type { Certificate } from '../types';

const Certificates: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [certFile, setCertFile] = useState<UploadFile | null>(null);
  const [keyFile, setKeyFile] = useState<UploadFile | null>(null);
  const [form] = Form.useForm();

  // 加载证书列表
  const loadCertificates = async () => {
    try {
      setLoading(true);
      const response = await getCertificateList({ page, page_size: pageSize });
      setCertificates(response.certificates);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.message || '加载证书列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, [page, pageSize]);

  // 处理上传
  const handleUpload = async (values: any) => {
    if (!certFile || !keyFile) {
      message.error('请上传证书文件和密钥文件');
      return;
    }

    try {
      setUploading(true);
      await uploadCertificate({
        name: values.name,
        domain: values.domain,
        cert_file: certFile.originFileObj as File,
        key_file: keyFile.originFileObj as File,
      });
      message.success('证书上传成功');
      setUploadModalVisible(false);
      form.resetFields();
      setCertFile(null);
      setKeyFile(null);
      loadCertificates();
    } catch (error: any) {
      message.error(error.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 处理删除
  const handleDelete = async (id: number) => {
    try {
      await deleteCertificate(id);
      message.success('删除成功');
      loadCertificates();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 处理下载
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
      message.success('下载成功');
    } catch (error: any) {
      message.error(error.message || '下载失败');
    }
  };

  // 计算剩余天数
  const getDaysUntilExpiry = (validUntil: string): number => {
    const expiry = new Date(validUntil);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // 获取状态标签
  const getStatusTag = (status: string, validUntil: string) => {
    if (status === 'expired') {
      return <Tag color="red">已过期</Tag>;
    }
    const days = getDaysUntilExpiry(validUntil);
    if (days < 30) {
      return <Tag color="orange">即将过期 ({days}天)</Tag>;
    }
    return <Tag color="green">有效</Tag>;
  };

  const columns: ColumnsType<Certificate> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '证书名称',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <SafetyCertificateOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
    },
    {
      title: '颁发者',
      dataIndex: 'issuer',
      key: 'issuer',
      ellipsis: true,
    },
    {
      title: '主题',
      dataIndex: 'subject',
      key: 'subject',
      ellipsis: true,
    },
    {
      title: '有效期',
      key: 'validity',
      render: (_, record) => (
        <div>
          <div style={{ fontSize: '12px' }}>
            起：{new Date(record.valid_from).toLocaleDateString('zh-CN')}
          </div>
          <div style={{ fontSize: '12px' }}>
            止：{new Date(record.valid_until).toLocaleDateString('zh-CN')}
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => getStatusTag(record.status, record.valid_until),
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
      width: 200,
      render: (_, record) => (
        <Space>
          <Tooltip title="下载证书">
            <Button
              type="link"
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => handleDownload(record.id, 'cert', record.name)}
            >
              证书
            </Button>
          </Tooltip>
          <Tooltip title="下载密钥">
            <Button
              type="link"
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => handleDownload(record.id, 'key', record.name)}
            >
              密钥
            </Button>
          </Tooltip>
          <Popconfirm
            title="确定要删除这个证书吗？"
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
            title="SSL 证书管理"
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadCertificates}>
                  刷新
                </Button>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => setUploadModalVisible(true)}
                >
                  上传证书
                </Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={certificates}
              rowKey="id"
              loading={loading}
              pagination={{
                current: page,
                pageSize: pageSize,
                total: total,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个证书`,
                onChange: (page, pageSize) => {
                  setPage(page);
                  setPageSize(pageSize);
                },
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 上传证书对话框 */}
      <Modal
        title="上传 SSL 证书"
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          form.resetFields();
          setCertFile(null);
          setKeyFile(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={uploading}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item
            label="证书名称"
            name="name"
            rules={[{ required: true, message: '请输入证书名称' }]}
          >
            <Input placeholder="例如: example.com" />
          </Form.Item>

          <Form.Item
            label="域名"
            name="domain"
            extra="可选，如果不填写将从证书中自动提取"
          >
            <Input placeholder="例如: example.com" />
          </Form.Item>

          <Form.Item
            label="证书文件 (.crt 或 .pem)"
            required
            help={certFile ? `已选择: ${certFile.name}` : '请选择证书文件'}
          >
            <Upload
              beforeUpload={(file) => {
                const ext = file.name.toLowerCase();
                if (!ext.endsWith('.crt') && !ext.endsWith('.pem')) {
                  message.error('证书文件格式不正确（需要 .crt 或 .pem）');
                  return false;
                }
                setCertFile(file);
                return false;
              }}
              onRemove={() => setCertFile(null)}
              fileList={certFile ? [certFile] : []}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择证书文件</Button>
            </Upload>
          </Form.Item>

          <Form.Item
            label="密钥文件 (.key 或 .pem)"
            required
            help={keyFile ? `已选择: ${keyFile.name}` : '请选择密钥文件'}
          >
            <Upload
              beforeUpload={(file) => {
                const ext = file.name.toLowerCase();
                if (!ext.endsWith('.key') && !ext.endsWith('.pem')) {
                  message.error('密钥文件格式不正确（需要 .key 或 .pem）');
                  return false;
                }
                setKeyFile(file);
                return false;
              }}
              onRemove={() => setKeyFile(null)}
              fileList={keyFile ? [keyFile] : []}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择密钥文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Certificates;
