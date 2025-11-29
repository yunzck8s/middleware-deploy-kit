import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Layout as AntLayout, Menu, Dropdown, Avatar, message } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
  CloudServerOutlined,
  RocketOutlined,
  HistoryOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { logout as logoutAction } from '../../store/authSlice';
import { logout as logoutAPI } from '../../api/auth';

const { Header, Sider, Content } = AntLayout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await logoutAPI();
      dispatch(logoutAction());
      message.success('登出成功');
      navigate('/login');
    } catch (error: any) {
      message.error(error.message || '登出失败');
    }
  };

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/middleware',
      icon: <AppstoreOutlined />,
      label: '中间件管理',
    },
    {
      key: '/certificates',
      icon: <SafetyCertificateOutlined />,
      label: '证书管理',
    },
    {
      key: '/nginx',
      icon: <GlobalOutlined />,
      label: 'Nginx 配置',
    },
    {
      key: '/servers',
      icon: <CloudServerOutlined />,
      label: '服务器管理',
    },
    {
      key: '/deployments',
      icon: <RocketOutlined />,
      label: '部署管理',
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: '部署历史',
    },
  ];

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: '个人信息',
      },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: '设置',
      },
      {
        type: 'divider' as const,
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
      >
        <div
          style={{
            height: 32,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
          }}
        >
          {collapsed ? 'MDK' : '中间件部署平台'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 500 }}>
            中间件离线部署管理平台
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
              <span>{user?.username || '用户'}</span>
            </div>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: '#fff',
            borderRadius: 8,
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default MainLayout;
