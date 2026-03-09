import { useEffect, useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Layout as AntLayout, Menu, Drawer, Dropdown, Avatar, message, Breadcrumb, Button } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  InboxOutlined,
  SafetyCertificateOutlined,
  CloudServerOutlined,
  RocketOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  FileTextOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { logout as logoutAction } from '../../store/authSlice';
import { logout as logoutAPI } from '../../api/auth';
import ThemeToggle from './ThemeToggle';

const { Sider, Content } = AntLayout;

const MOBILE_BREAKPOINT = 768;

const breadcrumbMeta: Array<{ match: string; title: string; path?: string }> = [
  { match: '/servers', title: '服务器', path: '/servers' },
  { match: '/middleware/nginx/packages', title: '离线包', path: '/middleware/nginx/packages' },
  { match: '/middleware/nginx/certificates', title: 'SSL 证书', path: '/middleware/nginx/certificates' },
  { match: '/middleware/nginx/configs', title: '配置管理', path: '/middleware/nginx/configs' },
  { match: '/middleware/nginx/deployments', title: '部署管理', path: '/middleware/nginx/deployments' },
];

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: '概览' },
  { key: '/servers', icon: <CloudServerOutlined />, label: '服务器' },
  { type: 'divider' },
  { key: '/middleware/nginx/packages', icon: <InboxOutlined />, label: '离线包' },
  { key: '/middleware/nginx/certificates', icon: <SafetyCertificateOutlined />, label: 'SSL 证书' },
  { key: '/middleware/nginx/configs', icon: <FileTextOutlined />, label: '配置管理' },
  { key: '/middleware/nginx/deployments', icon: <RocketOutlined />, label: '部署管理' },
];

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { isDark } = useTheme();

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const breadcrumbItems = useMemo(() => {
    const items: Array<{ title: React.ReactNode; path?: string }> = [{ title: <HomeOutlined />, path: '/' }];
    if (location.pathname === '/') {
      items.push({ title: '概览', path: '/' });
      return items;
    }

    const match = breadcrumbMeta.find((entry) => location.pathname.startsWith(entry.match));
    if (location.pathname.startsWith('/middleware/nginx/')) {
      items.push({ title: 'Nginx', path: undefined });
    }
    if (match) {
      items.push({ title: match.title, path: match.path });
    }
    return items;
  }, [location.pathname]);

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

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: '个人信息' },
      { key: 'settings', icon: <SettingOutlined />, label: '设置' },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
    ],
  };

  const sidebarContent = (
    <>
      <div
        style={{
          padding: collapsed && !isMobile ? '20px 14px' : '22px 18px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minHeight: 84,
        }}
      >
        <div className="login-card__logo" style={{ width: 42, height: 42, borderRadius: 14, fontSize: 18, flexShrink: 0 }}>
          N
        </div>
        {(!collapsed || isMobile) && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Nginx 运维控制台</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>部署 · 配置 · 证书 · 日志</div>
          </div>
        )}
      </div>

      <div style={{ padding: 12, paddingBottom: 144 }}>
        <Menu
          theme={isDark ? 'dark' : 'light'}
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          style={{
            background: 'transparent',
            borderRight: 'none',
          }}
          onClick={({ key }) => {
            if (key.startsWith('/')) navigate(key);
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          bottom: isMobile ? 0 : 52,
          left: 0,
          right: 0,
          padding: collapsed && !isMobile ? '8px' : '12px 14px',
          borderTop: '1px solid var(--border-color)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed && !isMobile ? 'center' : 'space-between',
            gap: 8,
          }}
        >
          <ThemeToggle />
          <Dropdown menu={userMenu} placement="topRight">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: collapsed && !isMobile ? '6px' : '6px 8px',
                borderRadius: 12,
                background: 'var(--bg-muted)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
              }}
            >
              <Avatar
                size={28}
                style={{
                  background: 'linear-gradient(135deg, var(--color-secondary), var(--color-primary))',
                  fontWeight: 700,
                }}
              >
                {user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
              {(!collapsed || isMobile) && (
                <div>
                  <div style={{ fontWeight: 600, lineHeight: 1.1, fontSize: 13 }}>{user?.username || '用户'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>管理员会话</div>
                </div>
              )}
            </div>
          </Dropdown>
        </div>
      </div>

      {!isMobile && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '10px 12px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: collapsed ? 'center' : 'flex-end',
            background: 'var(--header-bg)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Button type="text" onClick={() => setCollapsed(!collapsed)} icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} />
        </div>
      )}
    </>
  );

  return (
    <AntLayout style={{ minHeight: '100vh', background: 'transparent' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          width={280}
          styles={{ body: { padding: 0, background: 'var(--bg-secondary)', position: 'relative', minHeight: '100%' } }}
          closable={false}
        >
          {sidebarContent}
        </Drawer>
      ) : (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          width={248}
          collapsedWidth={72}
          style={{
            background: 'var(--sidebar-bg)',
            borderRight: '1px solid var(--border-color)',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            overflow: 'auto',
            backdropFilter: 'blur(18px)',
          }}
        >
          {sidebarContent}
        </Sider>
      )}

      <AntLayout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 72 : 248,
          transition: 'margin-left 180ms ease',
          background: 'transparent',
        }}
      >
        <Content style={{ padding: isMobile ? '16px' : '20px 28px 28px', background: 'transparent' }}>
          {isMobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileOpen(true)}
              style={{ marginBottom: 12 }}
              aria-label="打开导航菜单"
            />
          )}
          {location.pathname !== '/' && (
            <Breadcrumb
              style={{ marginBottom: 14 }}
              items={breadcrumbItems.map((item) => ({
                title: item.title,
                onClick: item.path ? () => navigate(item.path as string) : undefined,
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
