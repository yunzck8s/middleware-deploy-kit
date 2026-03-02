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
  Tooltip,
  Progress,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  DownloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  WarningOutlined,
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
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

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

  const handleDelete = async (id: number) => {
    try {
      await deleteCertificate(id);
      message.success('删除成功');
      loadCertificates();
    } catch (error: any) {
      message.error(error.message || '删除失败');
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
      message.success('下载成功');
    } catch (error: any) {
      message.error(error.message || '下载失败');
    }
  };

  const getDaysUntilExpiry = (validUntil: string): number => {
    const expiry = new Date(validUntil);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getTotalDays = (validFrom: string, validUntil: string): number => {
    return Math.ceil((new Date(validUntil).getTime() - new Date(validFrom).getTime()) / (1000 * 60 * 60 * 24));
  };

  const filteredCerts = certificates.filter((c) => {
    if (!searchText) return true;
    const lower = searchText.toLowerCase();
    return (
      c.name.toLowerCase().includes(lower) ||
      c.domain.toLowerCase().includes(lower)
    );
  });

  const columns: ColumnsType<Certificate> = [
    {
      title: '证书',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SafetyCertificateOutlined style={{ color: 'var(--color-primary)', fontSize: 16 }} />
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {record.domain}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '颁发者',
      dataIndex: 'issuer',
      key: 'issuer',
      ellipsis: true,
      render: (text) => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{text}</span>
      ),
    },
    {
      title: '有效期',
      key: 'validity',
      width: 200,
      render: (_, record) => {
        const days = getDaysUntilExpiry(record.valid_until);
        const totalDays = getTotalDays(record.valid_from, record.valid_until);
        const elapsed = totalDays - days;
        const percent = totalDays > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / totalDays) * 100))) : 100;
        const isExpired = days <= 0;
        const isExpiring = days > 0 && days <= 30;

        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {new Date(record.valid_from).toLocaleDateString('zh-CN')}
              </span>
              <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                {new Date(record.valid_until).toLocaleDateString('zh-CN')}
              </span>
            </div>
            <Progress
              percent={percent}
              size="small"
              showInfo={false}
              strokeColor={isExpired ? '#EF4444' : isExpiring ? '#F59E0B' : '#10B981'}
              trailColor="var(--bg-tertiary)"
            />
          </div>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 140,
      render: (_, record) => {
        const days = getDaysUntilExpiry(record.valid_until);
        if (record.status === 'expired' || days <= 0) {
          return <Tag color="red">已过期</Tag>;
        }
        if (days <= 7) {
          return (
            <Tag color="red" icon={<WarningOutlined />}>
              {days}天后过期
            </Tag>
          );
        }
        if (days <= 30) {
          return (
            <Tag color="orange" icon={<WarningOutlined />}>
              {days}天后过期
            </Tag>
          );
        }
        return <Tag color="green">有效 ({days}天)</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="下载证书">
            <Button
              type="text"
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => handleDownload(record.id, 'cert', record.name)}
              style={{ color: 'var(--color-primary)' }}
            />
          </Tooltip>
          <Tooltip title="下载密钥">
            <Button
              type="text"
              icon={<DownloadOutlined />}
              size="small"
              onClick={() => handleDownload(record.id, 'key', record.name)}
              style={{ color: 'var(--color-secondary)' }}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个证书吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontWeight: 600 }}>SSL 证书管理</span>
            <Input
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="搜索证书名或域名"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
              size="small"
              allowClear
            />
          </div>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadCertificates} size="small">
              刷新
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              onClick={() => setUploadModalVisible(true)}
              size="small"
            >
              上传证书
            </Button>
          </Space>
        }
        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <Table
          columns={columns}
          dataSource={filteredCerts}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个证书`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

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
          <Form.Item label="证书名称" name="name" rules={[{ required: true, message: '请输入证书名称' }]}>
            <Input placeholder="例如: example.com" />
          </Form.Item>
          <Form.Item label="域名" name="domain" extra="可选，如果不填写将从证书中自动提取">
            <Input placeholder="例如: example.com" />
          </Form.Item>
          <Form.Item label="证书文件 (.crt 或 .pem)" required help={certFile ? `已选择: ${certFile.name}` : '请选择证书文件'}>
            <Upload
              beforeUpload={(file) => {
                const ext = file.name.toLowerCase();
                if (!ext.endsWith('.crt') && !ext.endsWith('.pem')) {
                  message.error('格式不正确（需要 .crt 或 .pem）');
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
          <Form.Item label="密钥文件 (.key 或 .pem)" required help={keyFile ? `已选择: ${keyFile.name}` : '请选择密钥文件'}>
            <Upload
              beforeUpload={(file) => {
                const ext = file.name.toLowerCase();
                if (!ext.endsWith('.key') && !ext.endsWith('.pem')) {
                  message.error('格式不正确（需要 .key 或 .pem）');
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
