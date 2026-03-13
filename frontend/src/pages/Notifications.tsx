import { useState, useEffect } from 'react';
import { Table, Button, Tag, Space, Segmented, message } from 'antd';
import { DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { notificationAPI } from '../api/notification';
import type { Notification } from '../api/notification';
import type { ColumnsType } from 'antd/es/table';

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('');

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationAPI.list({ status, page, page_size: 20 });
      setNotifications(res.list || []);
      setTotal(res.total);
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [status, page]);

  const handleMarkRead = async (id: number) => {
    try {
      await notificationAPI.markRead(id);
      message.success('已标记为已读');
      loadNotifications();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notificationAPI.delete(id);
      message.success('删除成功');
      loadNotifications();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns: ColumnsType<Notification> = [
    {
      title: '类型',
      dataIndex: 'type',
      width: 120,
      render: (type) => type === 'cert_expiry' ? <Tag color="warning">证书过期</Tag> : <Tag>系统通知</Tag>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      width: 200,
    },
    {
      title: '内容',
      dataIndex: 'content',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => status === 'unread' ? <Tag color="red">未读</Tag> : <Tag>已读</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 180,
      render: (time) => new Date(time).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space>
          {record.status === 'unread' && (
            <Button size="small" icon={<CheckOutlined />} onClick={() => handleMarkRead(record.id)}>
              已读
            </Button>
          )}
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>通知中心</h2>
        <Segmented
          options={[
            { label: '全部', value: '' },
            { label: '未读', value: 'unread' },
            { label: '已读', value: 'read' },
          ]}
          value={status}
          onChange={(value) => { setStatus(value as string); setPage(1); }}
        />
      </div>
      <Table
        columns={columns}
        dataSource={notifications}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: setPage,
        }}
      />
    </div>
  );
}
