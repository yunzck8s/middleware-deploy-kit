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
import NotificationBell from './NotificationBell';

const { Sider, Content } = AntLayout;

const MOBILE_BREAKPOINT = 768;

interface RouteMeta {
  match: string;
  title: string;
  path?: string;
}

const routes: RouteMeta[] = [
  { match: '/', title: '概览', path: '/' },
  { match: '/servers', title: '服务器', path: '/servers' },
  { match: '/notifications', title: '通知中心', path: '/notifications' },
  { match: '/system-config', title: '系统配置', path: '/system-config' },
  { match: '/middleware/nginx/instances', title: 'Nginx 实例', path: '/middleware/nginx/instances' },
  { match: '/middleware/nginx/packages', title: '离线包', path: '/middleware/nginx/packages' },
  { match: '/middleware/nginx/certificates', title: 'SSL 证书', path: '/middleware/nginx/certificates' },
];

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: '概览' },
  { key: '/servers', icon: <CloudServerOutlined />, label: '服务器' },
  { type: 'divider' },
  { key: '/middleware/nginx/packages', icon: <InboxOutlined />, label: '离线包' },
  { key: '/middleware/nginx/certificates', icon: <SafetyCertificateOutlined />, label: 'SSL 证书' },
  { key: '/middleware/nginx/instances', icon: <RocketOutlined />, label: 'Nginx 实例' },
  { type: 'divider' },
  { key: '/system-config', icon: <SettingOutlined />, label: '系统配置' },
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

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const activeRoute = useMemo(() => {
    return [...routes]
      .sort((left, right) => right.match.length - left.match.length)
      .find((entry) => (entry.match === '/' ? location.pathname === '/' : location.pathname.startsWith(entry.match))) ?? routes[0];
  }, [location.pathname]);

  const breadcrumbItems = useMemo(() => {
    const items: Array<{ title: React.ReactNode; path?: string }> = [{ title: <HomeOutlined />, path: '/' }];
    if (location.pathname === '/') {
      items.push({ title: '概览', path: '/' });
      return items;
    }

    if (location.pathname.startsWith('/middleware/nginx/')) {
      items.push({ title: 'Nginx' });
    }

    items.push({ title: activeRoute.title, path: activeRoute.path });
    return items;
  }, [activeRoute, location.pathname]);

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

  const compactSidebar = collapsed && !isMobile;

  const sidebarContent = (
    <div className="shell-sidebar">
      <div className={`shell-brand ${compactSidebar ? 'shell-brand--collapsed' : ''}`.trim()}>
        <div className="shell-brand__top">
          <div className="shell-brand__mark">N</div>
          {(!collapsed || isMobile) && (
            <div className="shell-brand__copy">
              <div className="shell-brand__title">Nginx 运维控制台</div>
            </div>
          )}
        </div>
      </div>

      <div className="shell-nav-wrap">
        <Menu
          className="shell-nav"
          theme={isDark ? 'dark' : 'light'}
          selectedKeys={[activeRoute.path ?? location.pathname]}
          mode="inline"
          items={menuItems}
          style={{
            background: 'transparent',
            borderRight: 'none',
          }}
          onClick={({ key }) => {
            if (key.startsWith('/')) {
              navigate(key);
            }
          }}
        />
      </div>

      <div className="shell-sidebar__footer">
        <div className="shell-sidebar__controls">
          <ThemeToggle compact={compactSidebar} />
          <Dropdown menu={userMenu} placement="topRight" trigger={['click']}>
            <button type="button" className={`shell-operator ${compactSidebar ? 'shell-operator--compact' : ''}`.trim()}>
              <Avatar className="shell-operator__avatar" size={compactSidebar ? 28 : 32}>
                {user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
              {(!collapsed || isMobile) && (
                <span className="shell-operator__copy">
                  <strong>{user?.username || '用户'}</strong>
                </span>
              )}
            </button>
          </Dropdown>
        </div>
      </div>

      {!isMobile && (
        <div className="shell-collapse-rail">
          <Button
            type="text"
            className="shell-collapse-button"
            onClick={() => setCollapsed(!collapsed)}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            aria-label={collapsed ? '展开导航' : '折叠导航'}
          />
        </div>
      )}
    </div>
  );

  return (
    <AntLayout style={{ minHeight: '100vh', background: 'transparent' }}>
      {isMobile ? (
        <Drawer
          placement="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          width={280}
          styles={{ body: { padding: 0, background: 'var(--sidebar-bg)', position: 'relative', minHeight: '100%' } }}
          closable={false}
        >
          {sidebarContent}
        </Drawer>
      ) : (
        <Sider
          className="shell-sider"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          width={240}
          collapsedWidth={72}
          style={{
            background: 'var(--sidebar-bg)',
            borderRight: '1px solid var(--border-color)',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          {sidebarContent}
        </Sider>
      )}

      <AntLayout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 72 : 240,
          transition: 'margin-left var(--motion-fast) ease',
          background: 'transparent',
        }}
      >
        <div style={{ position: 'fixed', top: 24, right: 28, zIndex: 1000 }}>
          <NotificationBell />
        </div>
        <Content className="shell-content" style={{ padding: isMobile ? '16px' : '24px 28px 28px', background: 'transparent' }}>
          {isMobile && (
            <div style={{ marginBottom: 16 }}>
              <Button
                type="text"
                className="shell-mobile-trigger"
                icon={<MenuOutlined />}
                onClick={() => setMobileOpen(true)}
                aria-label="打开导航菜单"
                style={{ width: 'auto' }}
              />
            </div>
          )}

          {location.pathname !== '/' && (
            <Breadcrumb
              className="shell-breadcrumb"
              items={breadcrumbItems.map((item) => ({
                title: item.title,
                onClick: item.path ? () => navigate(item.path as string) : undefined,
              }))}
            />
          )}

          <div className="shell-stage">
            <div key={location.pathname} className="shell-stage__route">
              <Outlet />
            </div>
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default MainLayout;
