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
          colorPrimary: isDark ? '#B46F43' : '#9E613A',
          colorSuccess: isDark ? '#718754' : '#5E7448',
          colorWarning: isDark ? '#B38A4A' : '#977343',
          colorError: isDark ? '#B96D66' : '#9B5E59',
          colorInfo: isDark ? '#6B8698' : '#587287',
          borderRadius: 10,
          borderRadiusLG: 16,
          fontSize: 14,
          fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          colorBgContainer: isDark ? '#171C24' : '#F7F4EE',
          colorBgElevated: isDark ? '#171C24' : '#F7F4EE',
          colorBgLayout: isDark ? '#0D1117' : '#ECE7DF',
          colorBorder: isDark ? 'rgba(126, 135, 147, 0.14)' : 'rgba(112, 102, 92, 0.14)',
          colorBorderSecondary: isDark ? 'rgba(126, 135, 147, 0.10)' : 'rgba(112, 102, 92, 0.10)',
          colorText: isDark ? '#EDE7DC' : '#1C1813',
          colorTextSecondary: isDark ? '#AEB5C0' : '#575A60',
          colorTextTertiary: isDark ? '#7A828C' : '#746A5F',
          boxShadowSecondary: isDark ? '0 14px 34px rgba(0, 0, 0, 0.22)' : '0 12px 28px rgba(56, 42, 26, 0.08)',
        },
        components: {
          Card: {
            borderRadiusLG: 16,
            paddingLG: 22,
          },
          Button: {
            borderRadius: 10,
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
            darkItemSelectedBg: 'rgba(180, 111, 67, 0.10)',
            darkItemColor: '#AEB5C0',
            darkItemSelectedColor: '#EDE7DC',
            darkItemHoverColor: '#EDE7DC',
            darkItemHoverBg: 'rgba(180, 111, 67, 0.04)',
            itemBg: 'transparent',
            subMenuItemBg: 'transparent',
            itemSelectedBg: 'rgba(158, 97, 58, 0.08)',
            itemColor: '#474136',
            itemSelectedColor: '#7F4D2E',
            itemHoverColor: '#1C1813',
            itemHoverBg: 'rgba(158, 97, 58, 0.04)',
            itemBorderRadius: 12,
          },
          Layout: {
            siderBg: isDark ? '#131820' : '#F2EEE6',
            headerBg: isDark ? 'rgba(13, 17, 23, 0.88)' : 'rgba(247, 244, 238, 0.94)',
            bodyBg: isDark ? '#0D1117' : '#ECE7DF',
          },
          Input: {
            activeBorderColor: isDark ? '#B46F43' : '#9E613A',
            hoverBorderColor: isDark ? '#C48259' : '#B9764C',
          },
          Select: {
            optionSelectedBg: isDark ? 'rgba(180, 111, 67, 0.10)' : 'rgba(158, 97, 58, 0.08)',
          },
          Drawer: {
            colorBgElevated: isDark ? '#171C24' : '#F7F4EE',
          },
          Modal: {
            colorBgElevated: isDark ? '#171C24' : '#F7F4EE',
          },
          Tabs: {
            inkBarColor: isDark ? '#B46F43' : '#9E613A',
            itemSelectedColor: isDark ? '#EDE7DC' : '#7F4D2E',
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
