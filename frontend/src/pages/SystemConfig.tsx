import { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Switch, Button, Card, Tabs, message } from 'antd';
import { systemConfigAPI } from '../api/systemConfig';

export default function SystemConfig() {
  const [smtpForm] = Form.useForm();
  const [webhookForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const smtp = await systemConfigAPI.get('smtp_config');
      smtpForm.setFieldsValue(JSON.parse(smtp.value));
    } catch (error) {
      // 配置不存在
    }
    try {
      const webhook = await systemConfigAPI.get('webhook_config');
      webhookForm.setFieldsValue(JSON.parse(webhook.value));
    } catch (error) {
      // 配置不存在
    }
  };

  const handleSaveSMTP = async (values: any) => {
    setLoading(true);
    try {
      await systemConfigAPI.set({
        key: 'smtp_config',
        value: JSON.stringify(values),
        category: 'smtp',
      });
      message.success('SMTP配置保存成功');
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTestSMTP = async () => {
    setTesting(true);
    try {
      await systemConfigAPI.testSMTP();
      message.success('测试邮件已发送，请检查收件箱');
    } catch (error: any) {
      message.error(error.message || '测试失败');
    } finally {
      setTesting(false);
    }
  };

  const handleSaveWebhook = async (values: any) => {
    setLoading(true);
    try {
      await systemConfigAPI.set({
        key: 'webhook_config',
        value: JSON.stringify(values),
        category: 'webhook',
      });
      message.success('Webhook配置保存成功');
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    try {
      await systemConfigAPI.testWebhook();
      message.success('测试消息已发送，请检查 Webhook 接收端');
    } catch (error: any) {
      message.error(error.message || '测试失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>系统配置</h2>
      <Tabs
        items={[
          {
            key: 'smtp',
            label: 'SMTP配置',
            children: (
              <Card>
                <Form form={smtpForm} layout="vertical" onFinish={handleSaveSMTP}>
                  <Form.Item label="SMTP主机" name="host" rules={[{ required: true }]}>
                    <Input placeholder="smtp.example.com" />
                  </Form.Item>
                  <Form.Item label="端口" name="port" rules={[{ required: true }]}>
                    <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="用户名" name="username" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item label="密码" name="password" rules={[{ required: true }]}>
                    <Input.Password />
                  </Form.Item>
                  <Form.Item label="发件人" name="from" rules={[{ required: true }]}>
                    <Input placeholder="noreply@example.com" />
                  </Form.Item>
                  <Form.Item label="启用TLS" name="use_tls" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button type="primary" htmlType="submit" loading={loading}>
                      保存
                    </Button>
                    <Button onClick={handleTestSMTP} loading={testing}>
                      测试发送
                    </Button>
                  </div>
                </Form>
              </Card>
            ),
          },
          {
            key: 'webhook',
            label: 'Webhook配置',
            children: (
              <Card>
                <Form form={webhookForm} layout="vertical" onFinish={handleSaveWebhook}>
                  <Form.Item label="Webhook URL" name="url" rules={[{ required: true, type: 'url' }]}>
                    <Input placeholder="https://example.com/webhook" />
                  </Form.Item>
                  <Form.Item label="请求方法" name="method" initialValue="POST">
                    <Input />
                  </Form.Item>
                  <Form.Item label="超时时间(秒)" name="timeout" initialValue={10}>
                    <InputNumber min={1} max={60} style={{ width: '100%' }} />
                  </Form.Item>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button type="primary" htmlType="submit" loading={loading}>
                      保存
                    </Button>
                    <Button onClick={handleTestWebhook} loading={testing}>
                      测试发送
                    </Button>
                  </div>
                </Form>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
