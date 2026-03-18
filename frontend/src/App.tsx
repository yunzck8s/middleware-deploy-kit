import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin, theme as antTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useDispatch } from 'react-redux';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { logout } from './store/authSlice';
import { getProfile } from './api/auth';
import Login from './pages/Login';
import MainLayout from './components/common/Layout';
import Dashboard from './pages/Dashboard';
import Middleware from './pages/Middleware';
import Certificates from './pages/Certificates';
import Servers from './pages/Servers';
import Notifications from './pages/Notifications';
import SystemConfig from './pages/SystemConfig';
import InstanceList from './pages/InstanceList';
import InstanceDetail from './pages/InstanceDetail';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  const dispatch = useDispatch();
  const { isDark } = useTheme();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          await getProfile();
        } catch {
          dispatch(logout());
        }
      }
      setIsValidating(false);
    };
    validateToken();
  }, [dispatch]);

  if (isValidating) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: 'var(--bg-primary)',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: isDark ? '#6366f1' : '#4f46e5',
          colorSuccess: isDark ? '#22c55e' : '#16a34a',
          colorWarning: isDark ? '#f59e0b' : '#d97706',
          colorError: isDark ? '#ef4444' : '#dc2626',
          colorInfo: isDark ? '#3b82f6' : '#2563eb',
          borderRadius: 8,
          borderRadiusLG: 14,
          fontSize: 14,
          fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          colorBgContainer: isDark ? '#18181b' : '#ffffff',
          colorBgElevated: isDark ? '#18181b' : '#ffffff',
          colorBgLayout: isDark ? '#09090b' : '#fafafa',
          colorBorder: isDark ? 'rgba(161, 161, 170, 0.12)' : '#e4e4e7',
          colorBorderSecondary: isDark ? 'rgba(161, 161, 170, 0.08)' : '#f4f4f5',
          colorText: isDark ? '#fafafa' : '#09090b',
          colorTextSecondary: isDark ? '#a1a1aa' : '#52525b',
          colorTextTertiary: isDark ? '#71717a' : '#71717a',
          boxShadowSecondary: isDark ? '0 4px 12px rgba(0, 0, 0, 0.12)' : '0 4px 12px rgba(0, 0, 0, 0.06)',
        },
        components: {
          Card: {
            borderRadiusLG: 14,
            paddingLG: 20,
          },
          Button: {
            borderRadius: 8,
            controlHeight: 40,
            paddingInline: 16,
            fontWeight: 600,
          },
          Table: {
            borderRadius: 14,
            headerBg: 'transparent',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(99, 102, 241, 0.10)',
            darkItemColor: '#a1a1aa',
            darkItemSelectedColor: '#fafafa',
            darkItemHoverColor: '#fafafa',
            darkItemHoverBg: 'rgba(99, 102, 241, 0.05)',
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
            itemSelectedBg: 'rgba(79, 70, 229, 0.08)',
            itemColor: '#52525b',
            itemSelectedColor: '#4f46e5',
            itemHoverColor: '#09090b',
            itemHoverBg: 'rgba(79, 70, 229, 0.04)',
            itemBorderRadius: 8,
          },
          Layout: {
            siderBg: isDark ? '#0f0f11' : '#ffffff',
            headerBg: isDark ? 'rgba(9, 9, 11, 0.88)' : 'rgba(255, 255, 255, 0.94)',
            bodyBg: isDark ? '#09090b' : '#fafafa',
          },
          Input: {
            activeBorderColor: isDark ? '#6366f1' : '#4f46e5',
            hoverBorderColor: isDark ? '#818cf8' : '#6366f1',
          },
          Select: {
            optionSelectedBg: isDark ? 'rgba(99, 102, 241, 0.10)' : 'rgba(79, 70, 229, 0.08)',
          },
          Drawer: {
            colorBgElevated: isDark ? '#18181b' : '#ffffff',
          },
          Modal: {
            colorBgElevated: isDark ? '#18181b' : '#ffffff',
          },
          Tabs: {
            inkBarColor: isDark ? '#6366f1' : '#4f46e5',
            itemSelectedColor: isDark ? '#fafafa' : '#4f46e5',
          },
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="servers" element={<Servers />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="system-config" element={<SystemConfig />} />
            <Route path="middleware/:type/instances" element={<InstanceList />} />
            <Route path="middleware/:type/instances/:id" element={<InstanceDetail />} />
            <Route path="middleware/nginx/packages" element={<Middleware />} />
            <Route path="middleware/nginx/certificates" element={<Certificates />} />
            <Route path="middleware/redis/*" element={<Navigate to="/middleware/nginx/packages" replace />} />
            <Route path="middleware/openssh/*" element={<Navigate to="/middleware/nginx/packages" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
