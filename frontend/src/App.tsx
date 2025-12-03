import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useDispatch } from 'react-redux';
import { useAuth } from './hooks/useAuth';
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

// 路由守卫
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  const dispatch = useDispatch();
  const [isValidating, setIsValidating] = useState(true);

  // 应用启动时验证 token 有效性
  useEffect(() => {
    const validateToken = async () => {
      // 如果 localStorage 中有 token，验证其有效性
      const token = localStorage.getItem('token');
      if (token) {
        try {
          // 调用后端验证 token
          await getProfile();
          // token 有效，无需操作
        } catch (error) {
          // token 无效，清除认证状态
          dispatch(logout());
        }
      }
      setIsValidating(false);
    };

    validateToken();
  }, [dispatch]);

  // 验证中显示加载状态
  if (isValidating) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 8,
          fontSize: 14,
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

            {/* Nginx 管理 */}
            <Route path="middleware/nginx/packages" element={<Middleware />} />
            <Route path="middleware/nginx/certificates" element={<Certificates />} />
            <Route path="middleware/nginx/configs" element={<NginxConfig />} />
            <Route path="middleware/nginx/deployments" element={<Deployments />} />

            {/* Redis 管理 */}
            <Route path="middleware/redis/packages" element={<Middleware />} />
            <Route path="middleware/redis/deployments" element={<Deployments />} />

            {/* OpenSSH 管理 */}
            <Route path="middleware/openssh/packages" element={<Middleware />} />
            <Route path="middleware/openssh/deployments" element={<Deployments />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
