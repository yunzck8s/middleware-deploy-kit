import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Input, Switch, Row, Col, message } from 'antd';
import { applyNginxConfig, getNginxDeployInfo, type ApplyConfigData } from '../../api/nginx';
import { getServerList } from '../../api/server';
import type { Server } from '../../types';

const { Option } = Select;

interface ApplyConfigModalProps {
  configId: number;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ApplyConfigModal: React.FC<ApplyConfigModalProps> = ({
  configId,
  open,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载服务器列表
  useEffect(() => {
    if (open) {
      loadServers();
    }
  }, [open]);

  const loadServers = async () => {
    setLoading(true);
    try {
      // 不过滤状态，显示所有服务器（除了已删除的）
      const data = await getServerList({});
      setServers(data.servers || []);
    } catch (error: any) {
      message.error(error.message || '加载服务器列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 当服务器选择变化时，自动获取部署信息并填充路径
  const handleServerChange = async (serverId: number) => {
    try {
      const deployInfo = await getNginxDeployInfo(serverId);
      if (deployInfo.found && deployInfo.target_path) {
        // 自动填充路径和服务名称
        form.setFieldsValue({
          target_path: deployInfo.target_path,
          service_name: deployInfo.service_name || 'nginx',
        });
        message.success('已自动填充部署路径');
      } else {
        // 没有找到部署记录，使用默认值
        form.setFieldsValue({
          target_path: '/etc/nginx/nginx.conf',
          service_name: 'nginx',
        });
      }
    } catch (error: any) {
      // 获取失败时使用默认值
      form.setFieldsValue({
        target_path: '/etc/nginx/nginx.conf',
        service_name: 'nginx',
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const data: ApplyConfigData = {
        server_id: values.server_id,
        target_path: values.target_path || '/etc/nginx/nginx.conf',
        backup_enabled: values.backup_enabled ?? true,
        restart_service: values.restart_service ?? true,
        service_name: values.service_name || 'nginx',
      };

      await applyNginxConfig(configId, data);
      message.success('配置应用任务已创建');
      form.resetFields();
      onSuccess();
      onClose();
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error.message || '应用配置失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="应用 Nginx 配置到服务器"
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={submitting}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          target_path: '/etc/nginx/nginx.conf',
          backup_enabled: true,
          restart_service: true,
          service_name: 'nginx',
        }}
      >
        <Form.Item
          name="server_id"
          label="目标服务器"
          rules={[{ required: true, message: '请选择目标服务器' }]}
        >
          <Select
            placeholder="选择服务器"
            loading={loading}
            showSearch
            optionFilterProp="children"
            onChange={handleServerChange}
          >
            {servers.map((server) => (
              <Option key={server.id} value={server.id}>
                {server.name} ({server.host}) - {server.status === 'online' ? '在线' : server.status === 'offline' ? '离线' : '未知'}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="target_path"
          label="目标路径"
          tooltip="Nginx 配置文件在服务器上的存储路径"
        >
          <Input placeholder="/etc/nginx/nginx.conf" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="backup_enabled"
              label="备份现有配置"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="restart_service"
              label="应用后重启服务"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="service_name"
          label="服务名称"
          tooltip="重启时使用的服务名称（如 nginx, openresty）"
        >
          <Input placeholder="nginx" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ApplyConfigModal;
