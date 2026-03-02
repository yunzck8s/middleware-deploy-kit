import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { login } from '../api/auth';
import { setCredentials } from '../store/authSlice';

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
    <div
      className="grid-bg"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Gradient orbs */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15), transparent 70%)',
          top: '-10%',
          right: '-5%',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)',
          bottom: '-10%',
          left: '-5%',
          pointerEvents: 'none',
        }}
      />

      {/* Login card */}
      <div
        style={{
          width: 420,
          padding: 40,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          zIndex: 1,
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <span
              style={{
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 24,
              }}
            >
              M
            </span>
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              margin: 0,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            MDK Deploy
          </h1>
          <p
            style={{
              color: 'var(--text-secondary)',
              marginTop: 6,
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
            }}
          >
            Middleware Deploy Kit
          </p>
        </div>

        <Form name="login" onFinish={onFinish} autoComplete="off" size="large">
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="用户名"
              style={{
                background: 'var(--bg-tertiary)',
                borderColor: 'var(--border-color)',
                height: 44,
                borderRadius: 8,
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="密码"
              style={{
                background: 'var(--bg-tertiary)',
                borderColor: 'var(--border-color)',
                height: 44,
                borderRadius: 8,
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              style={{
                height: 44,
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 15,
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                border: 'none',
              }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div
          style={{
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
          }}
        >
          默认账号: admin / admin123
        </div>
      </div>
    </div>
  );
};

export default Login;
