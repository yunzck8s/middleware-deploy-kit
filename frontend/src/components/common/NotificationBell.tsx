import { useState, useEffect } from 'react';
import { Badge, Dropdown, List, Button } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { notificationAPI } from '../../api/notification';
import type { Notification } from '../../api/notification';

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const navigate = useNavigate();

  const loadUnreadCount = async () => {
    try {
      const res = await notificationAPI.getUnreadCount();
      setCount(res.count);
    } catch (error) {
      // 静默失败
    }
  };

  const loadRecentNotifications = async () => {
    try {
      const res = await notificationAPI.list({ status: 'unread', page: 1, page_size: 5 });
      setNotifications(res.list || []);
    } catch (error) {
      // 静默失败
    }
  };

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000); // 每30秒刷新
    return () => clearInterval(interval);
  }, []);

  const dropdownContent = (
    <div style={{ width: 320, maxHeight: 400, overflow: 'auto' }}>
      <List
        dataSource={notifications}
        renderItem={(item) => (
          <List.Item style={{ cursor: 'pointer', padding: '12px 16px' }}>
            <div>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{item.content}</div>
            </div>
          </List.Item>
        )}
        locale={{ emptyText: '暂无未读通知' }}
      />
      <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
        <Button type="link" onClick={() => navigate('/notifications')}>
          查看全部
        </Button>
      </div>
    </div>
  );

  return (
    <Dropdown
      dropdownRender={() => dropdownContent}
      trigger={['click']}
      onOpenChange={(open) => open && loadRecentNotifications()}
    >
      <Badge count={count} offset={[-2, 2]}>
        <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
      </Badge>
    </Dropdown>
  );
}
