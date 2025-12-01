import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Layout as AntLayout, Menu, Dropdown, Avatar, message, Breadcrumb } from 'antd';
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
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth';
import { logout as logoutAction } from '../../store/authSlice';
import { logout as logoutAPI } from '../../api/auth';

const { Header, Sider, Content } = AntLayout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(['middleware', 'deployments']);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useAuth();

  // 获取面包屑路径
  const getBreadcrumbs = (pathname: string) => {
    const breadcrumbs: Array<{ title: React.ReactNode; path: string }> = [
      { title: <HomeOutlined />, path: '/' }
    ];

    if (pathname === '/') {
      breadcrumbs.push({ title: '仪表盘', path: '/' });
    } else if (pathname === '/servers') {
      breadcrumbs.push({ title: '服务器管理', path: '/servers' });
    } else if (pathname.startsWith('/middleware/')) {
      breadcrumbs.push({ title: '中间件管理', path: '' });

      // 判断中间件类型
      let middlewareName = '';
      if (pathname.includes('/nginx/')) {
        middlewareName = 'Nginx';
      } else if (pathname.includes('/redis/')) {
        middlewareName = 'Redis';
      } else if (pathname.includes('/openssh/')) {
        middlewareName = 'OpenSSH';
      }

      if (middlewareName) {
        breadcrumbs.push({ title: middlewareName, path: '' });

        // 判断功能模块
        if (pathname.includes('/packages')) {
          breadcrumbs.push({ title: '离线包管理', path: pathname });
        } else if (pathname.includes('/certificates')) {
          breadcrumbs.push({ title: 'SSL证书', path: pathname });
        } else if (pathname.includes('/configs')) {
          breadcrumbs.push({ title: '配置管理', path: pathname });
        } else if (pathname.includes('/deployments')) {
          breadcrumbs.push({ title: '部署管理', path: pathname });
        }
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
            {
              key: '/middleware/nginx/packages',
              icon: <InboxOutlined />,
              label: '离线包管理',
            },
            {
              key: '/middleware/nginx/certificates',
              icon: <SafetyCertificateOutlined />,
              label: 'SSL证书',
            },
            {
              key: '/middleware/nginx/configs',
              icon: <FileTextOutlined />,
              label: '配置管理',
            },
            {
              key: '/middleware/nginx/deployments',
              icon: <RocketOutlined />,
              label: '部署管理',
            },
          ],
        },
        {
          key: 'redis-group',
          label: 'Redis',
          type: 'group',
          children: [
            {
              key: '/middleware/redis/packages',
              icon: <InboxOutlined />,
              label: '离线包管理',
            },
            {
              key: '/middleware/redis/deployments',
              icon: <RocketOutlined />,
              label: '部署管理',
            },
          ],
        },
        {
          key: 'openssh-group',
          label: 'OpenSSH',
          type: 'group',
          children: [
            {
              key: '/middleware/openssh/packages',
              icon: <InboxOutlined />,
              label: '离线包管理',
            },
            {
              key: '/middleware/openssh/deployments',
              icon: <RocketOutlined />,
              label: '部署管理',
            },
          ],
        },
      ],
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
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => {
            // 只有点击具体路径才跳转（不是分组标题）
            if (key.startsWith('/')) {
              navigate(key);
            }
          }}
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
          }}
        >
          {location.pathname !== '/' && (
            <Breadcrumb
              style={{
                marginBottom: 16,
              }}
              items={getBreadcrumbs(location.pathname).map((item) => ({
                title: item.title,
                onClick: item.path ? () => navigate(item.path) : undefined,
                style: item.path ? { cursor: 'pointer' } : undefined,
              }))}
            />
          )}
          <div
            style={{
              padding: 24,
              background: '#fff',
              borderRadius: 8,
              minHeight: 'calc(100vh - 160px)',
            }}
          >
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default MainLayout;
