import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  Table,
  Upload,
  message,
  Popconfirm,
  Space,
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
  ClockCircleOutlined,
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
import PageHeader from '../components/common/PageHeader';
import MetricTile from '../components/common/MetricTile';
import SectionCard from '../components/common/SectionCard';
import FilterToolbar from '../components/common/FilterToolbar';
import ActionGroup from '../components/common/ActionGroup';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import { formatDateTime } from '../utils/formatters';

const Certificates: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [certFile, setCertFile] = useState<UploadFile | null>(null);
  const [keyFile, setKeyFile] = useState<UploadFile | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const response = await getCertificateList({ page: 1, page_size: 1000 });
      setCertificates(response.certificates || []);
      setTotal(response.certificates?.length || 0);
    } catch (error: any) {
      message.error(error.message || '加载证书列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const getDaysUntilExpiry = (validUntil: string): number => {
    const expiry = new Date(validUntil);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getTotalDays = (validFrom: string, validUntil: string): number => {
    return Math.max(1, Math.ceil((new Date(validUntil).getTime() - new Date(validFrom).getTime()) / (1000 * 60 * 60 * 24)));
  };

  const filteredCerts = useMemo(() => {
    if (!searchText) return certificates;
    const lower = searchText.toLowerCase();
    return certificates.filter((item) => item.name.toLowerCase().includes(lower) || item.domain.toLowerCase().includes(lower));
  }, [certificates, searchText]);

  const summary = useMemo(() => {
    const expired = certificates.filter((item) => item.status === 'expired').length;
    const expiring = certificates.filter((item) => {
      const days = getDaysUntilExpiry(item.valid_until);
      return item.status !== 'expired' && days <= 30;
    }).length;
    const valid = certificates.filter((item) => item.status === 'active' && getDaysUntilExpiry(item.valid_until) > 30).length;
    return { expired, expiring, valid };
  }, [certificates]);

  const handleUpload = async (values: { name: string; domain?: string }) => {
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
      setUploadVisible(false);
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
              <StatusBadge status={status} label={status === 'valid' ? `有效 ${days} 天` : status === 'expiring' ? `${days} 天后到期` : '已过期'} compact />
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
          <Button type="text" icon={<DownloadOutlined />} size="small" onClick={() => handleDownload(record.id, 'cert', record.name)} />
          <Button type="text" icon={<DownloadOutlined />} size="small" onClick={() => handleDownload(record.id, 'key', record.name)} />
          <Popconfirm title="确定要删除这个证书吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="TLS 证书管理"
        title="证书与 TLS 资产"
        subtitle="在一个视图中识别到期风险、查看颁发信息，并为 Nginx HTTPS 配置提供可靠证书输入。"
        actions={(
          <ActionGroup>
            <Button icon={<ReloadOutlined />} onClick={loadCertificates}>刷新</Button>
            <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadVisible(true)}>上传证书</Button>
          </ActionGroup>
        )}
      />

      <div className="metric-grid metric-grid--cols-4">
        <MetricTile label="证书总量" value={total} hint="当前系统中可管理的证书资产" icon={<SafetyCertificateOutlined />} loading={loading} />
        <MetricTile label="健康证书" value={summary.valid} hint="剩余有效期超过 30 天" icon={<SafetyCertificateOutlined />} tone="success" loading={loading} />
        <MetricTile label="即将到期" value={summary.expiring} hint="建议优先安排续期或替换" icon={<ClockCircleOutlined />} tone="warning" loading={loading} />
        <MetricTile label="已过期" value={summary.expired} hint="需要尽快移除或更新" icon={<WarningOutlined />} tone="danger" loading={loading} />
      </div>

      <SectionCard title="风险提示" subtitle="优先处理即将到期和已过期证书，避免 HTTPS 服务中断。">
        <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-secondary)' }}>
          <WarningOutlined style={{ color: 'var(--color-warning)', fontSize: 18 }} />
          当前共有 <strong style={{ color: 'var(--text-primary)' }}>{summary.expiring + summary.expired}</strong> 个证书需要重点关注。
        </div>
      </SectionCard>

      <SectionCard title="证书列表" subtitle="从剩余有效期、域名和颁发者维度管理证书。" className="ops-table">
        <FilterToolbar
          left={(
            <Input
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="搜索证书名称或域名"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              style={{ width: 280 }}
              allowClear
            />
          )}
          right={<span className="summary-card__hint">双下载按钮分别导出 crt 与 key 文件</span>}
        />

        {filteredCerts.length === 0 && !loading ? (
          <EmptyState title="当前没有证书资产" description="上传证书和私钥后，这里会展示有效期、风险等级与下载操作。" action={<Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadVisible(true)}>上传首个证书</Button>} />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredCerts}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{
              current: page,
              pageSize,
              total: filteredCerts.length,
              showSizeChanger: true,
              showTotal: (count) => `共 ${count} 个证书`,
              onChange: (currentPage, currentPageSize) => {
                setPage(currentPage);
                setPageSize(currentPageSize);
              },
            }}
          />
        )}
      </SectionCard>

      <Drawer
        title="上传证书与密钥"
        open={uploadVisible}
        onClose={() => {
          setUploadVisible(false);
          form.resetFields();
          setCertFile(null);
          setKeyFile(null);
        }}
        width={520}
        extra={<Button type="primary" loading={uploading} onClick={() => form.submit()}>提交上传</Button>}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item label="证书名称" name="name" rules={[{ required: true, message: '请输入证书名称' }]}>
            <Input placeholder="例如：nginx-prod-cert" />
          </Form.Item>
          <Form.Item label="绑定域名" name="domain">
            <Input placeholder="例如：api.example.com" />
          </Form.Item>
          <Form.Item label="证书文件 (.crt / .pem)" required>
            <Upload
              beforeUpload={(file) => {
                setCertFile({ uid: file.name, name: file.name, status: 'done', originFileObj: file as any });
                return false;
              }}
              fileList={certFile ? [certFile] : []}
              onRemove={() => setCertFile(null)}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择证书文件</Button>
            </Upload>
          </Form.Item>
          <Form.Item label="密钥文件 (.key)" required>
            <Upload
              beforeUpload={(file) => {
                setKeyFile({ uid: file.name, name: file.name, status: 'done', originFileObj: file as any });
                return false;
              }}
              fileList={keyFile ? [keyFile] : []}
              onRemove={() => setKeyFile(null)}
              maxCount={1}
            >
              <Button icon={<UploadOutlined />}>选择密钥文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default Certificates;
