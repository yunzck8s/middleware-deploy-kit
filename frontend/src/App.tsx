import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuth } from './hooks/useAuth';
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
  return (
    <ConfigProvider locale={zhCN}>
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
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
