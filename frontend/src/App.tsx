import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useAuth } from './hooks/useAuth';
import Login from './pages/Login';
import MainLayout from './components/common/Layout';
import Dashboard from './pages/Dashboard';

// 路由守卫
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
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
            <Route
              path="middleware"
              element={<div>中间件管理（开发中）</div>}
            />
            <Route
              path="certificates"
              element={<div>证书管理（开发中）</div>}
            />
            <Route
              path="nginx"
              element={<div>Nginx 配置（开发中）</div>}
            />
            <Route
              path="servers"
              element={<div>服务器管理（开发中）</div>}
            />
            <Route
              path="deployments"
              element={<div>部署管理（开发中）</div>}
            />
            <Route
              path="history"
              element={<div>部署历史（开发中）</div>}
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
