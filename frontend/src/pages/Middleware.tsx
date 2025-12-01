import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Upload,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tag,
  Space,
  Row,
  Col,
} from 'antd';
import {
  UploadOutlined,
  DeleteOutlined,
  ReloadOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getPackageList, uploadPackage, deletePackage } from '../api/package';
import type { MiddlewarePackage } from '../types';

const { Dragger } = Upload;
const { Option } = Select;

// 中间件类型映射
const MIDDLEWARE_TYPE_MAP: Record<string, { name: string; displayName: string }> = {
  nginx: { name: 'nginx', displayName: 'Nginx' },
  redis: { name: 'redis', displayName: 'Redis' },
  openssh: { name: 'openssh', displayName: 'OpenSSH' },
};

const Middleware: React.FC = () => {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<MiddlewarePackage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [form] = Form.useForm();

  // 从路由中获取中间件类型
  const getMiddlewareType = (): string => {
    const path = location.pathname;
    if (path.includes('/nginx/')) return 'nginx';
    if (path.includes('/redis/')) return 'redis';
    if (path.includes('/openssh/')) return 'openssh';
    return 'nginx'; // 默认
  };

  const middlewareType = getMiddlewareType();
  const middlewareInfo = MIDDLEWARE_TYPE_MAP[middlewareType];

  // 加载离线包列表（根据类型过滤）
  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await getPackageList({
        name: middlewareType, // 根据当前中间件类型过滤
        page,
        page_size: pageSize,
      });
      setPackages(response.packages);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.message || '加载离线包列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, [page, pageSize, middlewareType]);

  // 处理上传
  const handleUpload = async (values: any) => {
    if (fileList.length === 0) {
      message.error('请选择要上传的文件');
      return;
    }

    try {
      setUploading(true);
      await uploadPackage({
        ...values,
        name: middlewareType, // 自动使用当前中间件类型
        file: fileList[0].originFileObj as File,
      });
      message.success(`${middlewareInfo.displayName} 离线包上传成功`);
      setUploadModalVisible(false);
      form.resetFields();
      setFileList([]);
      loadPackages();
    } catch (error: any) {
      message.error(error.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 处理删除
  const handleDelete = async (id: number) => {
    try {
      await deletePackage(id);
      message.success('删除成功');
      loadPackages();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const columns: ColumnsType<MiddlewarePackage> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '名称',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            {record.name} {record.version}
          </div>
        </div>
      ),
    },
    {
      title: '操作系统',
      key: 'os',
      render: (_, record) => (
        <Tag color="blue">
          {record.os_type} {record.os_version}
        </Tag>
      ),
    },
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      ellipsis: true,
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Popconfirm
            title="确定要删除这个离线包吗？"
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
            title={`${middlewareInfo.displayName} 离线包管理`}
            extra={
              <Space>
                <Button icon={<ReloadOutlined />} onClick={loadPackages}>
                  刷新
                </Button>
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => setUploadModalVisible(true)}
                >
                  上传离线包
                </Button>
              </Space>
            }
          >
            <Table
              columns={columns}
              dataSource={packages}
              rowKey="id"
              loading={loading}
              pagination={{
                current: page,
                pageSize: pageSize,
                total: total,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个离线包`,
                onChange: (page, pageSize) => {
                  setPage(page);
                  setPageSize(pageSize);
                },
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* 上传离线包对话框 */}
      <Modal
        title={`上传 ${middlewareInfo.displayName} 离线包`}
        open={uploadModalVisible}
        onCancel={() => {
          setUploadModalVisible(false);
          form.resetFields();
          setFileList([]);
        }}
        onOk={() => form.submit()}
        confirmLoading={uploading}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item
            label="版本号"
            name="version"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input placeholder="例如: 1.28.0" />
          </Form.Item>

          <Form.Item label="显示名称" name="display_name">
            <Input placeholder="例如: Nginx 1.28.0（可选，默认自动生成）" />
          </Form.Item>

          <Form.Item label="描述" name="description">
            <Input.TextArea rows={3} placeholder="离线包描述（可选）" />
          </Form.Item>

          <Form.Item
            label="操作系统类型"
            name="os_type"
            rules={[{ required: true, message: '请选择操作系统类型' }]}
          >
            <Select placeholder="请选择">
              <Option value="rocky">Rocky Linux</Option>
              <Option value="centos">CentOS</Option>
              <Option value="openEuler">OpenEuler</Option>
              <Option value="kylin">Kylin</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="操作系统版本"
            name="os_version"
            rules={[{ required: true, message: '请输入操作系统版本' }]}
          >
            <Input placeholder="例如: 9.4" />
          </Form.Item>

          <Form.Item label="离线包文件" required>
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
                // 创建 UploadFile 对象
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
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                仅支持 ZIP 格式，最大 500MB
              </p>
            </Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Middleware;
