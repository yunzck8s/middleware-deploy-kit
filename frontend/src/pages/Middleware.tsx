import React, { useMemo, useState, useEffect } from 'react';
import {
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Table,
  Upload,
  message,
  Popconfirm,
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
  const [form] = Form.useForm();

  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await getPackageList({ name: 'nginx', page: 1, page_size: 1000 });
      setPackages(response.packages || []);
      setTotal(response.packages?.length || 0);
    } catch (error: any) {
      message.error(error.message || '加载离线包列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

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
      message.error('请选择要上传的文件');
      return;
    }

    try {
      setUploading(true);
      await uploadPackage({
        ...values,
        name: 'nginx',
        file: fileList[0].originFileObj as File,
      });
      message.success('Nginx 离线包上传成功');
      setUploadVisible(false);
      form.resetFields();
      setFileList([]);
      loadPackages();
    } catch (error: any) {
      message.error(error.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deletePackage(id);
      message.success('删除成功');
      loadPackages();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const columns: ColumnsType<MiddlewarePackage> = [
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (value, record) => (
        <div>
          <div style={{ fontWeight: 700 }}>{record.display_name || `Nginx ${value}`}</div>
          <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
            nginx {value}
          </div>
        </div>
      ),
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
        <Popconfirm title="确定要删除这个离线包吗？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Nginx 离线包管理"
        title="离线包资源中心"
        subtitle="维护 Nginx 离线安装包、适配的系统版本和 metadata 驱动参数，为部署任务提供标准输入。"
        actions={(
          <ActionGroup>
            <Button icon={<ReloadOutlined />} onClick={loadPackages}>刷新</Button>
            <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadVisible(true)}>上传离线包</Button>
          </ActionGroup>
        )}
      />

      <div className="metric-grid">
        <MetricTile label="当前资源数" value={total} hint="可被部署任务直接消费的离线包" icon={<InboxOutlined />} tone="info" loading={loading} />
        <MetricTile label="最新版本" value={latestPackage?.version || '—'} hint={latestPackage ? '按当前列表中的版本号识别' : '暂无可用版本'} icon={<DeploymentUnitOutlined />} loading={loading} />
        <MetricTile label="系统覆盖" value={osFootprint} hint="不同 OS / 版本组合数量" icon={<SafetyCertificateOutlined />} tone="success" loading={loading} />
      </div>

      <SectionCard
        title="资源列表"
        subtitle="按版本、系统和上传时间查看可部署的 Nginx 离线包。"
        className="ops-table"
      >
        <FilterToolbar
          left={(
            <Input
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="搜索版本、文件名或系统"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              style={{ width: 280 }}
              allowClear
            />
          )}
          right={<span className="summary-card__hint">metadata 驱动参数将在部署时自动展开</span>}
        />

        {filteredPackages.length === 0 && !loading ? (
          <EmptyState
            title="还没有可用的 Nginx 离线包"
            description="上传 ZIP 离线包后，平台会读取其中的 metadata.json，并在创建部署时自动生成参数表单。"
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
        title="上传 Nginx 离线包"
        open={uploadVisible}
        onClose={() => {
          setUploadVisible(false);
          form.resetFields();
          setFileList([]);
        }}
        width={520}
        extra={<Button type="primary" loading={uploading} onClick={() => form.submit()}>提交上传</Button>}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item label="版本号" name="version" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="例如: 1.28.0" />
          </Form.Item>
          <Form.Item label="显示名称" name="display_name">
            <Input placeholder="例如: Nginx 1.28.0" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="例如：适用于 Rocky Linux 9.4 的离线安装包" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="操作系统类型" name="os_type" rules={[{ required: true, message: '请选择操作系统类型' }]}>
                <Select placeholder="请选择系统">
                  <Option value="rocky">Rocky Linux</Option>
                  <Option value="centos">CentOS</Option>
                  <Option value="openEuler">OpenEuler</Option>
                  <Option value="kylin">Kylin</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="操作系统版本" name="os_version" rules={[{ required: true, message: '请输入版本号' }]}>
                <Input placeholder="例如: 9.4" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="ZIP 离线包" required extra="平台会校验 metadata.json，并自动识别部署参数。">
            <Dragger
              fileList={fileList}
              beforeUpload={(file) => {
                if (!file.name.endsWith('.zip')) {
                  message.error('只支持 ZIP 格式文件');
                  return false;
                }
                if (file.size > 500 * 1024 * 1024) {
                  message.error('文件大小不能超过 500MB');
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
              <p className="ant-upload-hint">支持包含 metadata.json 的 Nginx 离线包，最大 500MB</p>
            </Dragger>
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default Middleware;
