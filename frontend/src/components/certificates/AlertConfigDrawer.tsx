import { useState, useEffect } from 'react';
import { Drawer, Form, Switch, Checkbox, Select, Button, message } from 'antd';
import { certificateAlertAPI } from '../../api/certificateAlert';

interface Props {
  visible: boolean;
  certificateId: number | null;
  onClose: () => void;
}

export default function AlertConfigDrawer({ visible, certificateId, onClose }: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && certificateId) {
      loadConfig();
    }
  }, [visible, certificateId]);

  const loadConfig = async () => {
    if (!certificateId) return;
    try {
      const config = await certificateAlertAPI.get(certificateId);
      form.setFieldsValue({
        enabled: config.enabled,
        threshold_days: JSON.parse(config.threshold_days),
        notify_internal: config.notify_internal,
        notify_email: config.notify_email,
        notify_webhook: config.notify_webhook,
        email_recipients: config.email_recipients ? JSON.parse(config.email_recipients) : [],
      });
    } catch {
      form.resetFields();
    }
  };

  const handleSave = async (values: any) => {
    if (!certificateId) return;
    setLoading(true);
    try {
      await certificateAlertAPI.createOrUpdate({
        certificate_id: certificateId,
        enabled: values.enabled,
        threshold_days: JSON.stringify(values.threshold_days),
        notify_internal: values.notify_internal,
        notify_email: values.notify_email,
        notify_webhook: values.notify_webhook,
        email_recipients: JSON.stringify(values.email_recipients || []),
      });
      message.success('保存成功');
      onClose();
    } catch {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      title="证书告警配置"
      open={visible}
      onClose={onClose}
      width={520}
      extra={<Button type="primary" loading={loading} onClick={() => form.submit()}>保存</Button>}
    >
      <Form form={form} layout="vertical" onFinish={handleSave} initialValues={{ enabled: true, threshold_days: [30, 7, 1], notify_internal: true }}>
        <Form.Item label="启用告警" name="enabled" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="通知阈值" name="threshold_days">
          <Checkbox.Group options={[{ label: '30天', value: 30 }, { label: '7天', value: 7 }, { label: '1天', value: 1 }]} />
        </Form.Item>
        <Form.Item label="通知方式" style={{ marginBottom: 8 }}>
          <Form.Item name="notify_internal" valuePropName="checked" style={{ display: 'inline-block', marginBottom: 0 }}>
            <Checkbox>系统内通知</Checkbox>
          </Form.Item>
          <Form.Item name="notify_email" valuePropName="checked" style={{ display: 'inline-block', marginBottom: 0, marginLeft: 8 }}>
            <Checkbox>邮件通知</Checkbox>
          </Form.Item>
          <Form.Item name="notify_webhook" valuePropName="checked" style={{ display: 'inline-block', marginBottom: 0, marginLeft: 8 }}>
            <Checkbox>Webhook通知</Checkbox>
          </Form.Item>
        </Form.Item>
        <Form.Item label="邮件接收人" name="email_recipients">
          <Select mode="tags" placeholder="输入邮箱后按回车" />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
