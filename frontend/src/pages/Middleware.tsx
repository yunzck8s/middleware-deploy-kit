import React, { useMemo, useState, useEffect } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Segmented,
  Table,
  Upload,
  message,
  Popconfirm,
  Tooltip,
  Tag,
  Row,
  Col,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  InboxOutlined,
  SearchOutlined,
  DeploymentUnitOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getPackageList, uploadPackage, deletePackage } from '../api/package';
import type { MiddlewarePackage } from '../types';
import PageHeader from '../components/common/PageHeader';
import MetricTile from '../components/common/MetricTile';
import SectionCard from '../components/common/SectionCard';
import FilterToolbar from '../components/common/FilterToolbar';
import ActionGroup from '../components/common/ActionGroup';
import EmptyState from '../components/common/EmptyState';
import { formatDateTime, formatFileSize } from '../utils/formatters';

const { Dragger } = Upload;
const { Option } = Select;

const MIDDLEWARE_TYPES = [
  { label: 'Nginx', value: 'nginx' },
  { label: 'Redis', value: 'redis' },
  { label: 'OpenSSH', value: 'openssh', disabled: true },
];

const Middleware: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<MiddlewarePackage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState('nginx');
  const [form] = Form.useForm();

  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await getPackageList({ name: selectedType, page: 1, page_size: 1000 });
      setPackages(response.packages || []);
      setTotal(response.packages?.length || 0);
    } catch (error: any) {
      message.error(error.message || '暂时无法加载离线包列表');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, [selectedType]);

  const activePackages = useMemo(() => packages.filter((item) => item.status === 'active'), [packages]);
  const latestPackage = useMemo(
    () => activePackages.slice().sort((left, right) => right.version.localeCompare(left.version))[0],
    [activePackages],
  );
  const osFootprint = useMemo(() => new Set(activePackages.map((item) => `${item.os_type}-${item.os_version}`)).size, [activePackages]);

  const filteredPackages = useMemo(() => {
    if (!searchText) return activePackages;
    const lower = searchText.toLowerCase();
    return activePackages.filter((item) =>
      item.display_name?.toLowerCase().includes(lower)
      || item.version?.toLowerCase().includes(lower)
      || item.file_name?.toLowerCase().includes(lower)
      || `${item.os_type} ${item.os_version}`.toLowerCase().includes(lower),
    );
  }, [activePackages, searchText]);

  const handleUpload = async (values: any) => {
    if (fileList.length === 0) {
      message.error('请先选择一个 ZIP 离线包');
      return;
    }

    try {
      setUploading(true);
      await uploadPackage({
        ...values,
        name: selectedType,
        file: fileList[0].originFileObj as File,
      });
      message.success('离线包已上传，可在新建部署时直接选用');
      setUploadVisible(false);
      form.resetFields();
      setFileList([]);
      loadPackages();
    } catch (error: any) {
      message.error(error.message || '离线包上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePackage(id);
      message.success('离线包已删除');
      loadPackages();
    } catch (error: any) {
      message.error(error.message || '删除离线包失败');
    }
  };

  const columns: ColumnsType<MiddlewarePackage> = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (value, record) => {
        const typeLabel = MIDDLEWARE_TYPES.find((t) => t.value === selectedType)?.label || selectedType;
        return (
          <div>
            <div style={{ fontWeight: 700 }}>{record.display_name || `${typeLabel} ${value}`}</div>
            <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {selectedType} {value}
            </div>
          </div>
        );
      },
    },
    {
      title: '操作系统',
      key: 'os',
      render: (_, record) => <Tag>{record.os_type} {record.os_version}</Tag>,
    },
    {
      title: '文件',
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: true,
      render: (value: string) => <span className="mono" style={{ fontSize: 12 }}>{value}</span>,
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'file_size',
      width: 120,
      render: (value: number) => formatFileSize(value),
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(value, 'YYYY-MM-DD HH:mm')}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 96,
      render: (_, record) => (
        <Popconfirm title={`删除离线包“${record.display_name || `Nginx ${record.version}`}”后，将不能再用于新建部署任务。确定删除吗？`} onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
          <Tooltip title="删除这个离线包">
            <Button type="text" danger icon={<DeleteOutlined />} size="small" aria-label="删除离线包" />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="离线包管理"
        title="离线包管理"
        subtitle="统一管理中间件离线包、适配系统和 metadata.json 参数，部署时可直接选用。"
        actions={(
          <ActionGroup>
            <Button icon={<ReloadOutlined />} onClick={loadPackages}>刷新</Button>
            <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadVisible(true)}>上传离线包</Button>
          </ActionGroup>
        )}
      />

      <div style={{ marginBottom: 16 }}>
        <Segmented
          options={MIDDLEWARE_TYPES}
          value={selectedType}
          onChange={(value) => { setSelectedType(value as string); setPage(1); setSearchText(''); }}
        />
      </div>

      <div className="metric-grid">
        <MetricTile label="当前资源数" value={total} hint="当前可直接用于部署的离线包数" icon={<InboxOutlined />} tone="info" loading={loading} />
        <MetricTile label="最新版本" value={latestPackage?.version || '—'} hint={latestPackage ? '按当前离线包列表中最新的版本号显示' : '暂无可用版本'} icon={<DeploymentUnitOutlined />} loading={loading} />
        <MetricTile label="系统覆盖" value={osFootprint} hint="已覆盖的系统类型和版本组合" icon={<SafetyCertificateOutlined />} tone="success" loading={loading} />
      </div>

      <SectionCard
        title="离线包列表"
        subtitle="按版本、系统和上传时间筛选可部署的 Nginx 离线包。"
        className="ops-table"
      >
        <FilterToolbar
          left={(
            <Input
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="搜索版本、文件名或系统版本"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              style={{ width: 280 }}
              allowClear
            />
          )}
          right={<span className="summary-card__hint">部署时会自动读取 metadata.json 中定义的参数</span>}
        />

        {filteredPackages.length === 0 && !loading ? (
          <EmptyState
            title={`还没有可用的 ${MIDDLEWARE_TYPES.find((t) => t.value === selectedType)?.label || selectedType} 离线包`}
            description="上传包含 metadata.json 的 ZIP 离线包后，创建部署时会自动显示对应参数。"
            action={<Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadVisible(true)}>上传第一个离线包</Button>}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={filteredPackages}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{
              current: page,
              pageSize,
              total: filteredPackages.length,
              showSizeChanger: true,
              showTotal: (count) => `共 ${count} 个离线包`,
              onChange: (currentPage, currentPageSize) => {
                setPage(currentPage);
                setPageSize(currentPageSize);
              },
            }}
          />
        )}
      </SectionCard>

      <Drawer
        title={`上传新的 ${MIDDLEWARE_TYPES.find((t) => t.value === selectedType)?.label || selectedType} 离线包`}
        open={uploadVisible}
        onClose={() => {
          setUploadVisible(false);
          form.resetFields();
          setFileList([]);
        }}
        width={520}
        extra={<Button type="primary" loading={uploading} onClick={() => form.submit()}>开始上传</Button>}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item label="版本号" name="version" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="例如: 1.28.0" />
          </Form.Item>
          <Form.Item label="显示名称" name="display_name" extra="留空时默认显示为 Nginx + 版本号">
            <Input placeholder="例如: Nginx 1.28.0" />
          </Form.Item>
          <Form.Item label="描述" name="description" extra="可选，用来说明适用系统、用途或批次">
            <Input.TextArea rows={3} placeholder="例如：适用于 Rocky Linux 9.4 的 Nginx 离线包" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="操作系统类型" name="os_type" rules={[{ required: true, message: '请选择操作系统类型' }]}>
                <Select placeholder="选择操作系统">
                  <Option value="rocky">Rocky Linux</Option>
                  <Option value="centos">CentOS</Option>
                  <Option value="openEuler">OpenEuler</Option>
                  <Option value="kylin">Kylin</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="操作系统版本" name="os_version" rules={[{ required: true, message: '请输入操作系统版本' }]}>
                <Input placeholder="例如: 9.4" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="ZIP 离线包" required extra="平台会校验 ZIP 包中的 metadata.json，并读取部署参数。">
            <Dragger
              fileList={fileList}
              beforeUpload={(file) => {
                if (!file.name.endsWith('.zip')) {
                  message.error('请上传 ZIP 格式的文件');
                  return false;
                }
                if (file.size > 500 * 1024 * 1024) {
                  message.error('文件不能超过 500 MB');
                  return false;
                }
                const uploadFile: UploadFile = {
                  uid: file.name,
                  name: file.name,
                  status: 'done',
                  originFileObj: file as any,
                };
                setFileList([uploadFile]);
                return false;
              }}
              onRemove={() => setFileList([])}
              maxCount={1}
            >
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">点击或拖拽 ZIP 文件到这里</p>
              <p className="ant-upload-hint">请上传包含 metadata.json 的 ZIP 离线包，最大 500 MB</p>
            </Dragger>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default Middleware;
