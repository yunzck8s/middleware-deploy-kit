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
import NginxConfig from './pages/NginxConfig';
import Deployments from './pages/Deployments';

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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
      }}>
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
          colorPrimary: isDark ? '#6366F1' : '#4F46E5',
          colorSuccess: '#10B981',
          colorWarning: '#F59E0B',
          colorError: '#EF4444',
          colorInfo: isDark ? '#6366F1' : '#4F46E5',
          borderRadius: 8,
          fontSize: 14,
          fontFamily: "'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          colorBgContainer: isDark ? '#1E293B' : '#FFFFFF',
          colorBgElevated: isDark ? '#1E293B' : '#FFFFFF',
          colorBgLayout: isDark ? '#0F172A' : '#F8FAFC',
          colorBorder: isDark ? '#334155' : '#E2E8F0',
          colorBorderSecondary: isDark ? '#1E293B' : '#F1F5F9',
          colorText: isDark ? '#F1F5F9' : '#0F172A',
          colorTextSecondary: isDark ? '#94A3B8' : '#64748B',
          colorTextTertiary: isDark ? '#64748B' : '#94A3B8',
        },
        components: {
          Card: {
            borderRadiusLG: 8,
            paddingLG: 24,
          },
          Button: {
            borderRadius: 6,
          },
          Table: {
            borderRadius: 8,
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(99, 102, 241, 0.15)',
            darkItemColor: '#94A3B8',
            darkItemSelectedColor: '#6366F1',
            darkItemHoverColor: '#F1F5F9',
            darkItemHoverBg: 'rgba(99, 102, 241, 0.08)',
          },
          Layout: {
            siderBg: isDark ? '#0B1120' : '#FFFFFF',
            headerBg: isDark ? '#0F172A' : '#FFFFFF',
            bodyBg: isDark ? '#0F172A' : '#F8FAFC',
          },
          Input: {
            activeBorderColor: isDark ? '#6366F1' : '#4F46E5',
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
            <Route path="middleware/nginx/packages" element={<Middleware />} />
            <Route path="middleware/nginx/certificates" element={<Certificates />} />
            <Route path="middleware/nginx/configs" element={<NginxConfig />} />
            <Route path="middleware/nginx/deployments" element={<Deployments />} />
            <Route path="middleware/redis/packages" element={<Middleware />} />
            <Route path="middleware/redis/deployments" element={<Deployments />} />
            <Route path="middleware/openssh/packages" element={<Middleware />} />
            <Route path="middleware/openssh/deployments" element={<Deployments />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
