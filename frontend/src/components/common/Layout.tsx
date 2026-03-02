import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Layout as AntLayout, Menu, Dropdown, Avatar, message, Breadcrumb, Input } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  SafetyCertificateOutlined,
  CloudServerOutlined,
  RocketOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  InboxOutlined,
  FileTextOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { logout as logoutAction } from '../../store/authSlice';
import { logout as logoutAPI } from '../../api/auth';
import ThemeToggle from './ThemeToggle';

const { Header, Sider, Content } = AntLayout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(['middleware']);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useAuth();

  const getBreadcrumbs = (pathname: string) => {
    const breadcrumbs: Array<{ title: React.ReactNode; path: string }> = [
      { title: <HomeOutlined />, path: '/' },
    ];

    if (pathname === '/') {
      breadcrumbs.push({ title: '仪表盘', path: '/' });
    } else if (pathname === '/servers') {
      breadcrumbs.push({ title: '服务器管理', path: '/servers' });
    } else if (pathname.startsWith('/middleware/')) {
      breadcrumbs.push({ title: '中间件管理', path: '' });
      let middlewareName = '';
      if (pathname.includes('/nginx/')) middlewareName = 'Nginx';
      else if (pathname.includes('/redis/')) middlewareName = 'Redis';
      else if (pathname.includes('/openssh/')) middlewareName = 'OpenSSH';

      if (middlewareName) {
        breadcrumbs.push({ title: middlewareName, path: '' });
        if (pathname.includes('/packages')) breadcrumbs.push({ title: '离线包管理', path: pathname });
        else if (pathname.includes('/certificates')) breadcrumbs.push({ title: 'SSL证书', path: pathname });
        else if (pathname.includes('/configs')) breadcrumbs.push({ title: '配置管理', path: pathname });
        else if (pathname.includes('/deployments')) breadcrumbs.push({ title: '部署管理', path: pathname });
      }
    }
    return breadcrumbs;
  };

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

  const menuItems: MenuProps['items'] = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/servers',
      icon: <CloudServerOutlined />,
      label: '服务器管理',
    },
    {
      key: 'middleware',
      icon: <AppstoreOutlined />,
      label: '中间件管理',
      children: [
        {
          key: 'nginx-group',
          label: 'Nginx',
          type: 'group',
          children: [
            { key: '/middleware/nginx/packages', icon: <InboxOutlined />, label: '离线包' },
            { key: '/middleware/nginx/certificates', icon: <SafetyCertificateOutlined />, label: 'SSL证书' },
            { key: '/middleware/nginx/configs', icon: <FileTextOutlined />, label: '配置管理' },
            { key: '/middleware/nginx/deployments', icon: <RocketOutlined />, label: '部署管理' },
          ],
        },
        {
          key: 'redis-group',
          label: 'Redis',
          type: 'group',
          children: [
            { key: '/middleware/redis/packages', icon: <InboxOutlined />, label: '离线包' },
            { key: '/middleware/redis/deployments', icon: <RocketOutlined />, label: '部署管理' },
          ],
        },
        {
          key: 'openssh-group',
          label: 'OpenSSH',
          type: 'group',
          children: [
            { key: '/middleware/openssh/packages', icon: <InboxOutlined />, label: '离线包' },
            { key: '/middleware/openssh/deployments', icon: <RocketOutlined />, label: '部署管理' },
          ],
        },
      ],
    },
  ];

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: '个人信息' },
      { key: 'settings', icon: <SettingOutlined />, label: '设置' },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
    ],
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={240}
        collapsedWidth={64}
        style={{
          background: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--border-color)',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          overflow: 'auto',
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '0' : '0 20px',
            borderBottom: '1px solid var(--border-color)',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            M
          </div>
          {!collapsed && (
            <span
              style={{
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: 15,
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-sans)',
              }}
            >
              MDK Deploy
            </span>
          )}
        </div>

        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          openKeys={collapsed ? [] : openKeys}
          onOpenChange={setOpenKeys}
          mode="inline"
          items={menuItems}
          style={{
            background: 'transparent',
            borderRight: 'none',
            padding: '8px 0',
          }}
          onClick={({ key }) => {
            if (key.startsWith('/')) navigate(key);
          }}
        />

        {/* Collapse trigger at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px 16px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: collapsed ? 'center' : 'flex-end',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      </Sider>

      <AntLayout
        style={{
          marginLeft: collapsed ? 64 : 240,
          transition: 'margin-left 0.2s ease',
        }}
      >
        {/* Header */}
        <Header
          style={{
            padding: '0 24px',
            background: 'var(--header-bg)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: 56,
            lineHeight: '56px',
            borderBottom: '1px solid var(--border-color)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)',
              }}
            >
              中间件离线部署管理平台
            </span>
            <Input
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="搜索..."
              style={{
                width: 240,
                background: 'var(--bg-tertiary)',
                borderColor: 'var(--border-color)',
              }}
              size="small"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />
            <Dropdown menu={userMenu} placement="bottomRight">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: 6,
                  transition: 'background 0.2s',
                  gap: 8,
                }}
              >
                <Avatar
                  size={28}
                  style={{
                    background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    fontSize: 12,
                  }}
                >
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </Avatar>
                <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>
                  {user?.username || '用户'}
                </span>
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content
          style={{
            margin: 0,
            padding: 24,
            minHeight: 'calc(100vh - 56px)',
          }}
        >
          {location.pathname !== '/' && (
            <Breadcrumb
              style={{ marginBottom: 16 }}
              items={getBreadcrumbs(location.pathname).map((item) => ({
                title: item.title,
                onClick: item.path ? () => navigate(item.path) : undefined,
                style: item.path ? { cursor: 'pointer' } : undefined,
              }))}
            />
          )}
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default MainLayout;
