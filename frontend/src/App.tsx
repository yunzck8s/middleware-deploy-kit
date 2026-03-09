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
          colorPrimary: isDark ? '#22C55E' : '#16A34A',
          colorSuccess: '#22C55E',
          colorWarning: '#F59E0B',
          colorError: '#EF4444',
          colorInfo: isDark ? '#38BDF8' : '#0284C7',
          borderRadius: 12,
          borderRadiusLG: 16,
          fontSize: 14,
          fontFamily: "'Fira Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          colorBgContainer: isDark ? '#0F172A' : '#FFFFFF',
          colorBgElevated: isDark ? '#0F172A' : '#FFFFFF',
          colorBgLayout: isDark ? '#020617' : '#F8FAFC',
          colorBorder: isDark ? 'rgba(148,163,184,0.16)' : 'rgba(148,163,184,0.22)',
          colorBorderSecondary: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.16)',
          colorText: isDark ? '#F8FAFC' : '#0F172A',
          colorTextSecondary: isDark ? '#CBD5E1' : '#334155',
          colorTextTertiary: '#64748B',
          boxShadowSecondary: isDark ? '0 18px 50px rgba(2, 6, 23, 0.28)' : '0 18px 50px rgba(15, 23, 42, 0.12)',
        },
        components: {
          Card: {
            borderRadiusLG: 16,
            paddingLG: 24,
          },
          Button: {
            borderRadius: 12,
            controlHeight: 44,
            paddingInline: 16,
            fontWeight: 600,
          },
          Table: {
            borderRadius: 16,
            headerBg: 'transparent',
          },
          Menu: {
            darkItemBg: 'transparent',
            darkSubMenuItemBg: 'transparent',
            darkItemSelectedBg: 'rgba(34, 197, 94, 0.16)',
            darkItemColor: '#CBD5E1',
            darkItemSelectedColor: '#F8FAFC',
            darkItemHoverColor: '#F8FAFC',
            darkItemHoverBg: 'rgba(56, 189, 248, 0.1)',
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
            itemSelectedBg: 'rgba(22, 163, 74, 0.10)',
            itemColor: '#334155',
            itemSelectedColor: '#15803d',
            itemHoverColor: '#0f172a',
            itemHoverBg: 'rgba(148, 163, 184, 0.08)',
            itemBorderRadius: 12,
          },
          Layout: {
            siderBg: isDark ? '#020617' : '#FFFFFF',
            headerBg: isDark ? 'rgba(2,6,23,0.72)' : 'rgba(248,250,252,0.84)',
            bodyBg: isDark ? '#020617' : '#F8FAFC',
          },
          Input: {
            activeBorderColor: isDark ? '#22C55E' : '#16A34A',
            hoverBorderColor: isDark ? '#4ADE80' : '#22C55E',
          },
          Select: {
            optionSelectedBg: isDark ? 'rgba(34, 197, 94, 0.12)' : 'rgba(22, 163, 74, 0.08)',
          },
          Drawer: {
            colorBgElevated: isDark ? '#0F172A' : '#FFFFFF',
          },
          Modal: {
            colorBgElevated: isDark ? '#0F172A' : '#FFFFFF',
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
            <Route path="middleware/redis/*" element={<Navigate to="/middleware/nginx/packages" replace />} />
            <Route path="middleware/openssh/*" element={<Navigate to="/middleware/nginx/packages" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
