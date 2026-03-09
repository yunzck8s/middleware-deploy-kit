import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Form, Input, Button, message } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  DeploymentUnitOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { login } from '../api/auth';
import { setCredentials } from '../store/authSlice';

const benefits = [
  {
    icon: <DeploymentUnitOutlined />,
    title: '离线部署工作流',
    description: '围绕 Nginx 包、配置、证书和部署任务构建统一控制面板。',
  },
  {
    icon: <CloudServerOutlined />,
    title: '服务器联通感知',
    description: '在执行前确认 SSH 连接、系统版本和目标节点状态。',
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: '配置与证书联动',
    description: '同时管理 TLS 证书、配置模板和部署日志，减少切换成本。',
  },
];

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const response = await login(values);
      dispatch(setCredentials({ user: response.user, token: response.token }));
      message.success('登录成功');
      navigate('/');
    } catch (error: any) {
      message.error(error.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <aside className="login-shell__aside">
        <div className="login-hero">
          <div className="login-hero__badge">Nginx 运维控制台</div>
          <h1 className="login-hero__title">为离线环境而设计的 Nginx 运维控制台</h1>
          <p className="login-hero__subtitle">
            聚焦包分发、TLS 证书、配置编排与实时部署日志，把 Nginx 运维动作集中到一个工作区中。
          </p>
        </div>

        <div className="login-benefits">
          {benefits.map((benefit) => (
            <div key={benefit.title} className="login-benefit">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span className="metric-tile__icon" style={{ width: 36, height: 36 }}>{benefit.icon}</span>
                <strong>{benefit.title}</strong>
              </div>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{benefit.description}</p>
            </div>
          ))}
        </div>
      </aside>

      <div className="login-shell__panel">
        <div className="login-card">
          <div className="login-card__brand">
            <div className="login-card__logo">N</div>
            <div>
              <div className="login-card__title">Nginx 运维控制台</div>
              <div className="login-card__subtitle">Nginx Operations Console</div>
            </div>
          </div>

          <Form name="login" onFinish={onFinish} autoComplete="off" size="large" layout="vertical">
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input
                prefix={<UserOutlined style={{ color: 'var(--text-tertiary)' }} />}
                placeholder="输入管理员用户名"
              />
            </Form.Item>

            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password
                prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />}
                placeholder="输入登录密码"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                进入控制台
              </Button>
            </Form.Item>
          </Form>

          <div className="login-card__hint">默认账号: admin / admin123</div>
        </div>
      </div>
    </div>
  );
};

export default Login;
