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

interface ShellRouteMeta {
  match: string;
  title: string;
  path?: string;
  code: string;
  summary: string;
}

const shellRoutes: ShellRouteMeta[] = [
  { match: '/', title: '概览', path: '/', code: 'OPS-00', summary: '查看 Nginx 整体运行情况、资产数量和当前风险。' },
  { match: '/servers', title: '服务器', path: '/servers', code: 'OPS-10', summary: '管理目标服务器、SSH 接入方式和在线状态。' },
  { match: '/middleware/nginx/packages', title: '离线包', path: '/middleware/nginx/packages', code: 'OPS-20', summary: '管理版本化离线包，为部署任务提供可选资源。' },
  { match: '/middleware/nginx/certificates', title: 'SSL 证书', path: '/middleware/nginx/certificates', code: 'OPS-30', summary: '查看 TLS 资产、到期风险和证书可用状态。' },
  { match: '/middleware/nginx/configs', title: '配置管理', path: '/middleware/nginx/configs', code: 'OPS-40', summary: '编排 Nginx 配置，并在工作台中预览、编辑和应用。' },
  { match: '/middleware/nginx/deployments', title: '部署管理', path: '/middleware/nginx/deployments', code: 'OPS-50', summary: '执行、回滚、取消部署，并持续查看任务日志。' },
];

const createNavLabel = (code: string, label: string) => (
  <span className="shell-nav-label">
    <span className="shell-nav-label__code">{code}</span>
    <span className="shell-nav-label__text">{label}</span>
  </span>
);

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: createNavLabel('00', '概览') },
  { key: '/servers', icon: <CloudServerOutlined />, label: createNavLabel('10', '服务器') },
  { type: 'divider' },
  { key: '/middleware/nginx/packages', icon: <InboxOutlined />, label: createNavLabel('20', '离线包') },
  { key: '/middleware/nginx/certificates', icon: <SafetyCertificateOutlined />, label: createNavLabel('30', 'SSL 证书') },
  { key: '/middleware/nginx/configs', icon: <FileTextOutlined />, label: createNavLabel('40', '配置管理') },
  { key: '/middleware/nginx/deployments', icon: <RocketOutlined />, label: createNavLabel('50', '部署管理') },
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
    return [...shellRoutes]
      .sort((left, right) => right.match.length - left.match.length)
      .find((entry) => (entry.match === '/' ? location.pathname === '/' : location.pathname.startsWith(entry.match))) ?? shellRoutes[0];
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
              <span className="shell-brand__eyebrow">Industrial Console</span>
              <div className="shell-brand__title">Nginx 运维控制台</div>
              <div className="shell-brand__subtitle">平台管理员 · 部署 / 配置 / 证书 / 日志</div>
            </div>
          )}
        </div>
        {(!collapsed || isMobile) && (
          <div className="shell-brand__tags">
            <span className="shell-tag shell-tag--accent">平台管理员</span>
            <span className="shell-tag">Nginx 专用</span>
          </div>
        )}
      </div>

      <div className="shell-nav-wrap">
        {(!collapsed || isMobile) && (
          <div className="shell-nav-caption">
            <span>Control Modules</span>
            <span className="shell-nav-caption__hint">{activeRoute.code}</span>
          </div>
        )}
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
        {(!collapsed || isMobile) && (
          <div className="shell-module-card">
            <span className="shell-module-card__label">Active Module</span>
            <div className="shell-module-card__code">{activeRoute.code}</div>
            <div className="shell-module-card__summary">{activeRoute.summary}</div>
          </div>
        )}

        <div className="shell-sidebar__controls">
          <ThemeToggle compact={compactSidebar} />
          <Dropdown menu={userMenu} placement="topRight" trigger={['click']}>
            <button type="button" className={`shell-operator ${compactSidebar ? 'shell-operator--compact' : ''}`.trim()}>
              <Avatar className="shell-operator__avatar" size={compactSidebar ? 32 : 36}>
                {user?.username?.charAt(0)?.toUpperCase() || 'U'}
              </Avatar>
              {(!collapsed || isMobile) && (
                <span className="shell-operator__copy">
                  <strong>{user?.username || '用户'}</strong>
                  <span>管理员会话</span>
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
          width={300}
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
          width={264}
          collapsedWidth={84}
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
          marginLeft: isMobile ? 0 : collapsed ? 84 : 264,
          transition: 'margin-left var(--motion-fast) ease',
          background: 'transparent',
        }}
      >
        <Content className="shell-content" style={{ padding: isMobile ? '16px' : '24px 28px 28px', background: 'transparent' }}>
          <div className="shell-topbar">
            <div className="shell-topbar__lead">
              {isMobile && (
                <Button
                  type="text"
                  className="shell-mobile-trigger"
                  icon={<MenuOutlined />}
                  onClick={() => setMobileOpen(true)}
                  aria-label="打开导航菜单"
                />
              )}
              <div className="shell-topbar__module">
                <span className="shell-topbar__eyebrow">Command Surface</span>
                <div className="shell-topbar__title-row">
                  <span className="shell-topbar__code">{activeRoute.code}</span>
                  <span className="shell-topbar__title">{activeRoute.title}</span>
                </div>
                <p className="shell-topbar__summary">{activeRoute.summary}</p>
              </div>
            </div>
            <div className="shell-topbar__status">
              <div className="shell-chip">
                <span>角色</span>
                <strong>平台管理员</strong>
              </div>
              <div className="shell-chip">
                <span>模式</span>
                <strong>{isDark ? '夜间模式' : '日间模式'}</strong>
              </div>
              <div className="shell-chip">
                <span>范围</span>
                <strong>Nginx 专用工作面</strong>
              </div>
            </div>
          </div>

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
