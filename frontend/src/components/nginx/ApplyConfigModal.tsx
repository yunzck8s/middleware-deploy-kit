import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Form, Select, Input, Switch, Row, Col, Spin, message } from 'antd';
import { applyNginxConfig, getNginxDeployInfo, type ApplyConfigData, type NginxDeployInfo } from '../../api/nginx';
import type { NginxConfigApply, Server } from '../../types';
import { getServerList } from '../../api/server';

const { Option } = Select;

const DEFAULT_DEPLOY_INFO: NginxDeployInfo = {
  found: false,
  target_path: '/usr/local/nginx/conf/nginx.conf',
  service_name: 'nginx',
};

interface ApplyConfigModalProps {
  configId: number;
  open: boolean;
  onClose: () => void;
  onSuccess: (createdApply: NginxConfigApply) => void;
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
  const [loadingServers, setLoadingServers] = useState(false);
  const [loadingDeployInfo, setLoadingDeployInfo] = useState(false);
  const [deployInfo, setDeployInfo] = useState<NginxDeployInfo | null>(null);
  const [customizeTarget, setCustomizeTarget] = useState(false);

  const selectedServerId = Form.useWatch('server_id', form);

  const resolvedDeployInfo = useMemo(() => {
    if (!deployInfo) return null;
    return {
      found: deployInfo.found,
      source: deployInfo.source,
      target_path: deployInfo.target_path || DEFAULT_DEPLOY_INFO.target_path,
      service_name: deployInfo.service_name || DEFAULT_DEPLOY_INFO.service_name,
      deployed_at: deployInfo.deployed_at,
      deploy_params: deployInfo.deploy_params,
    };
  }, [deployInfo]);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setDeployInfo(null);
      setCustomizeTarget(false);
      return;
    }

    void loadServers();
    form.setFieldsValue({
      target_path: DEFAULT_DEPLOY_INFO.target_path,
      backup_enabled: true,
      restart_service: true,
      service_name: DEFAULT_DEPLOY_INFO.service_name,
    });
  }, [form, open]);

  const loadServers = async () => {
    setLoadingServers(true);
    try {
      const data = await getServerList({});
      setServers(data.servers || []);
    } catch (error: any) {
      message.error(error.message || '暂时无法加载服务器列表');
    } finally {
      setLoadingServers(false);
    }
  };

  const applyDeployInfo = (info?: NginxDeployInfo | null) => {
    const nextInfo = {
      ...DEFAULT_DEPLOY_INFO,
      ...info,
      target_path: info?.target_path || DEFAULT_DEPLOY_INFO.target_path,
      service_name: info?.service_name || DEFAULT_DEPLOY_INFO.service_name,
    };

    setDeployInfo(nextInfo);
    form.setFieldsValue({
      target_path: nextInfo.target_path,
      service_name: nextInfo.service_name,
    });
  };

  const handleServerChange = async (serverId: number) => {
    setCustomizeTarget(false);
    setLoadingDeployInfo(true);
    try {
      const info = await getNginxDeployInfo(serverId);
      applyDeployInfo(info);
    } catch {
      applyDeployInfo(DEFAULT_DEPLOY_INFO);
    } finally {
      setLoadingDeployInfo(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const fallbackInfo = resolvedDeployInfo || DEFAULT_DEPLOY_INFO;
      const data: ApplyConfigData = {
        server_id: values.server_id,
        target_path: values.target_path || fallbackInfo.target_path,
        backup_enabled: values.backup_enabled ?? true,
        restart_service: values.restart_service ?? true,
        service_name: values.service_name || fallbackInfo.service_name,
      };

      const createdApply = await applyNginxConfig(configId, data);
      message.success('已创建配置应用任务，正在打开执行结果');
      form.resetFields();
      onSuccess(createdApply);
      onClose();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.message || '创建配置应用任务失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setDeployInfo(null);
    setCustomizeTarget(false);
    onClose();
  };

  return (
    <Modal
      title="将 Nginx 配置应用到服务器"
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={submitting}
      width={640}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          target_path: DEFAULT_DEPLOY_INFO.target_path,
          backup_enabled: true,
          restart_service: true,
          service_name: DEFAULT_DEPLOY_INFO.service_name,
        }}
      >
        <Form.Item
          name="server_id"
          label="目标服务器"
          rules={[{ required: true, message: '请选择目标服务器' }]}
        >
          <Select
            placeholder="选择一台服务器"
            loading={loadingServers}
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

        <div className="page-stack" style={{ gap: 12, marginBottom: 16 }}>
          {!selectedServerId ? (
            <div className="summary-card">
              <div className="summary-card__label">默认配置目标</div>
              <div className="summary-card__hint" style={{ marginTop: 10 }}>
                请选择一台服务器后，系统会自动读取默认配置路径和服务名。
              </div>
            </div>
          ) : loadingDeployInfo ? (
            <div className="summary-card" style={{ padding: 20, textAlign: 'center' }}>
              <Spin tip="正在读取这台服务器的默认配置目标..." />
            </div>
          ) : resolvedDeployInfo ? (
            <div className="resource-summary">
              <div className="summary-card">
                <div className="summary-card__label">默认配置文件路径</div>
                <div className="summary-card__value" style={{ fontSize: 18 }}>{resolvedDeployInfo.target_path}</div>
                <div className="summary-card__hint">
                  {resolvedDeployInfo.found
                    ? resolvedDeployInfo.source === 'package_deploy'
                      ? '已根据该服务器的 Nginx 安装记录自动推导。'
                      : '已根据该服务器最近一次成功的配置应用记录自动选择。'
                    : '未找到历史记录，使用系统默认路径。'}
                </div>
              </div>
              <div className="summary-card">
                <div className="summary-card__label">默认重启服务</div>
                <div className="summary-card__value" style={{ fontSize: 18 }}>{resolvedDeployInfo.service_name}</div>
                <div className="summary-card__hint">
                  只有目标机器使用了非标准配置文件位置或服务名时，才需要自定义。
                </div>
              </div>
              {resolvedDeployInfo.deploy_params ? (
                <div className="summary-card">
                  <div className="summary-card__label">部署上下文</div>
                  <div className="summary-card__hint" style={{ marginTop: 10 }}>
                    安装目录: {resolvedDeployInfo.deploy_params.NGINX_INSTALL_DIR || '/usr/local/nginx'}
                    <br />
                    运行用户: {resolvedDeployInfo.deploy_params.NGINX_USER || 'nginx'}
                  </div>
                </div>
              ) : (
                <div className="summary-card">
                  <div className="summary-card__label">目标说明</div>
                  <div className="summary-card__hint" style={{ marginTop: 10 }}>
                    提交后会把当前配置写入上面的默认配置文件路径，并按你的选项备份和重启服务。
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              name="backup_enabled"
              label="应用前先备份当前配置"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="restart_service"
              label="应用后重启 Nginx"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <div className="summary-card" style={{ marginTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div className="summary-card__label">自定义路径与服务</div>
              <div className="summary-card__hint" style={{ marginTop: 6 }}>
                只有目标机器使用了非标准配置文件位置或服务名时，才需要自定义。
              </div>
            </div>
            <Switch checked={customizeTarget} onChange={setCustomizeTarget} />
          </div>
        </div>

        {customizeTarget && (
          <div className="page-stack" style={{ gap: 12, marginTop: 16 }}>
            <Form.Item
              name="target_path"
              label="目标配置文件路径"
              extra="请输入完整的 .conf 文件路径，例如 /usr/local/nginx/conf/nginx.conf"
            >
              <Input placeholder="/usr/local/nginx/conf/nginx.conf" />
            </Form.Item>

            <Form.Item
              name="service_name"
              label="重启服务名称"
              extra="如果服务名不是 nginx，例如 openresty，可在这里覆盖默认值"
            >
              <Input placeholder="例如：nginx" />
            </Form.Item>
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default ApplyConfigModal;
