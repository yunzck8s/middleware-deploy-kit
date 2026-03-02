import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Switch, Row, Col, Button, Space, message, Spin } from 'antd';
import {
  SettingOutlined,
  GlobalOutlined,
  EnvironmentOutlined,
  ClusterOutlined,
  LockOutlined,
  DatabaseOutlined,
  SafetyOutlined,
  FileTextOutlined,
  CodeOutlined,
  SaveOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import LocationEditor from './LocationEditor';
import UpstreamEditor from './UpstreamEditor';
import SSLPanel from './SSLPanel';
import CachePanel from './CachePanel';
import SecurityPanel from './SecurityPanel';
import ConfigPreview from './ConfigPreview';
import {
  getNginxConfigDetail,
  createNginxConfig,
  updateNginxConfig,
  previewNginxConfig,
} from '../../api/nginx';
import { getCertificateList } from '../../api/certificate';
import type { NginxLocation, NginxUpstream, Certificate } from '../../types';

const { Option } = Select;
const { TextArea } = Input;

type NavSection = 'basic' | 'server' | 'locations' | 'upstream' | 'ssl' | 'cache' | 'security' | 'log' | 'custom' | 'preview';

const navItems: { key: NavSection; label: string; icon: React.ReactNode }[] = [
  { key: 'basic', label: '基础设置', icon: <SettingOutlined /> },
  { key: 'server', label: 'Server 块', icon: <GlobalOutlined /> },
  { key: 'locations', label: 'Locations', icon: <EnvironmentOutlined /> },
  { key: 'upstream', label: 'Upstream', icon: <ClusterOutlined /> },
  { key: 'ssl', label: 'SSL/TLS', icon: <LockOutlined /> },
  { key: 'cache', label: '缓存', icon: <DatabaseOutlined /> },
  { key: 'security', label: '安全规则', icon: <SafetyOutlined /> },
  { key: 'log', label: '日志', icon: <FileTextOutlined /> },
  { key: 'custom', label: '自定义', icon: <CodeOutlined /> },
  { key: 'preview', label: '配置预览', icon: <EyeOutlined /> },
];

interface ConfigEditorProps {
  configId?: number | null;
  onSave?: () => void;
  onBack: () => void;
}

const ConfigEditor: React.FC<ConfigEditorProps> = ({ configId, onSave, onBack }) => {
  const [activeSection, setActiveSection] = useState<NavSection>('basic');
  const [form] = Form.useForm();
  const [locations, setLocations] = useState<NginxLocation[]>([]);
  const [upstreams, setUpstreams] = useState<NginxUpstream[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [configName, setConfigName] = useState('');

  useEffect(() => {
    loadCertificates();
    if (configId) {
      loadConfig(configId);
    } else {
      // Defaults for new config
      form.setFieldsValue({
        worker_processes: 'auto',
        worker_connections: 1024,
        enable_http: true,
        http_port: 80,
        enable_https: false,
        https_port: 443,
        http_to_https: false,
        server_name: '_',
        root_path: '/usr/share/nginx/html',
        index_files: 'index.html index.htm',
        access_log_path: '/var/log/nginx/access.log',
        error_log_path: '/var/log/nginx/error.log',
        log_format: 'json',
        rotate_enabled: false,
        rotate_frequency: 'daily',
        rotate_count: 14,
        rotate_max_size: '100M',
        rotate_compress: true,
        rotate_date_ext: true,
        enable_proxy: false,
        client_max_body_size: '100m',
        gzip: true,
        ssl_protocols: 'TLSv1.2 TLSv1.3',
        hsts_max_age: 31536000,
        cache_path: '/var/cache/nginx',
        cache_size: '10m',
        cache_valid_time: '60m',
        rate_limit_burst: 20,
        conn_limit_num: 100,
      });
    }
  }, [configId]);

  const loadCertificates = async () => {
    try {
      const res = await getCertificateList({ page: 1, page_size: 100 });
      setCertificates(res.certificates || []);
    } catch {
      // silent
    }
  };

  const loadConfig = async (id: number) => {
    try {
      setLoadingConfig(true);
      const config = await getNginxConfigDetail(id);
      setConfigName(config.name);
      setLocations(config.locations || []);
      setUpstreams(config.upstreams || []);
      form.setFieldsValue({
        ...config,
        // Don't include nested objects in form
        locations: undefined,
        upstreams: undefined,
        server: undefined,
        certificate: undefined,
      });
    } catch (error: any) {
      message.error(error.message || '加载配置失败');
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const data = {
        ...values,
        locations,
      };
      if (configId) {
        await updateNginxConfig(configId, data);
        message.success('配置已更新');
      } else {
        await createNginxConfig(data);
        message.success('配置已创建');
      }
      onSave?.();
      onBack();
    } catch (error: any) {
      if (error.message) message.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    try {
      const values = await form.validateFields();
      setPreviewing(true);
      const result = await previewNginxConfig({ ...values, locations });
      let content = result.content;
      if (result.logrotate_content) {
        content += '\n\n# ============================================================\n';
        content += '# /etc/logrotate.d/nginx\n';
        content += '# ============================================================\n\n';
        content += result.logrotate_content;
      }
      setPreviewContent(content);
      setActiveSection('preview');
    } catch (error: any) {
      if (!error.errorFields) message.error(error.message || '预览失败');
    } finally {
      setPreviewing(false);
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'basic':
        return (
          <>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>基础设置</div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="配置名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
                  <Input placeholder="production-web" onChange={(e) => setConfigName(e.target.value)} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="描述" name="description">
                  <Input placeholder="配置描述" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Worker 进程数" name="worker_processes">
                  <Input placeholder="auto" style={{ fontFamily: 'var(--font-mono)' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Worker 连接数" name="worker_connections">
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="最大请求体" name="client_max_body_size">
                  <Input placeholder="100m" style={{ fontFamily: 'var(--font-mono)' }} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="gzip" valuePropName="checked" label="Gzip 压缩">
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="enable_http" valuePropName="checked" label="启用 HTTP">
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="HTTP 端口" name="http_port">
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="状态" name="status">
              <Select>
                <Option value="draft">草稿</Option>
                <Option value="active">已启用</Option>
                <Option value="disabled">已禁用</Option>
              </Select>
            </Form.Item>
          </>
        );

      case 'server':
        return (
          <>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Server 块配置</div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="域名 (server_name)" name="server_name">
                  <Input placeholder="_ 或 example.com" style={{ fontFamily: 'var(--font-mono)' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="根目录" name="root_path">
                  <Input placeholder="/usr/share/nginx/html" style={{ fontFamily: 'var(--font-mono)' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="索引文件" name="index_files">
              <Input placeholder="index.html index.htm" style={{ fontFamily: 'var(--font-mono)' }} />
            </Form.Item>
            <Form.Item name="enable_proxy" valuePropName="checked" label="启用反向代理">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.enable_proxy !== cur.enable_proxy}>
              {({ getFieldValue }) =>
                getFieldValue('enable_proxy') && (
                  <Form.Item label="默认 Proxy Pass" name="proxy_pass" extra="全局代理地址（Location 级别可覆盖）">
                    <Input placeholder="http://127.0.0.1:3000" style={{ fontFamily: 'var(--font-mono)' }} />
                  </Form.Item>
                )
              }
            </Form.Item>
          </>
        );

      case 'locations':
        return <LocationEditor locations={locations} onChange={setLocations} />;

      case 'upstream':
        return <UpstreamEditor upstreams={upstreams} onChange={setUpstreams} />;

      case 'ssl':
        return <SSLPanel certificates={certificates} />;

      case 'cache':
        return <CachePanel />;

      case 'security':
        return <SecurityPanel />;

      case 'log':
        return (
          <>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>日志配置</div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="访问日志路径" name="access_log_path">
                  <Input placeholder="/var/log/nginx/access.log" style={{ fontFamily: 'var(--font-mono)' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="错误日志路径" name="error_log_path">
                  <Input placeholder="/var/log/nginx/error.log" style={{ fontFamily: 'var(--font-mono)' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="日志格式" name="log_format">
              <Select>
                <Option value="main">标准格式 (main)</Option>
                <Option value="json">JSON 格式</Option>
              </Select>
            </Form.Item>

            <div style={{ borderTop: '1px solid var(--border-color)', margin: '24px 0 16px' }} />
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>日志轮转 (Logrotate)</div>

            <Form.Item
              name="rotate_enabled"
              valuePropName="checked"
              label="启用日志轮转"
              extra="启用后将部署 logrotate 配置到 /etc/logrotate.d/nginx"
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.rotate_enabled !== cur.rotate_enabled}>
              {({ getFieldValue }) =>
                getFieldValue('rotate_enabled') && (
                  <>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item label="轮转频率" name="rotate_frequency">
                          <Select>
                            <Option value="daily">每天 (daily)</Option>
                            <Option value="weekly">每周 (weekly)</Option>
                            <Option value="monthly">每月 (monthly)</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="保留份数" name="rotate_count">
                          <InputNumber min={1} max={365} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item label="最大文件大小" name="rotate_max_size" extra="超出也触发轮转">
                          <Input placeholder="100M" style={{ fontFamily: 'var(--font-mono)' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={8}>
                        <Form.Item name="rotate_compress" valuePropName="checked" label="压缩旧日志">
                          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                        </Form.Item>
                      </Col>
                      <Col span={8}>
                        <Form.Item name="rotate_date_ext" valuePropName="checked" label="使用日期扩展名">
                          <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                )
              }
            </Form.Item>
          </>
        );

      case 'custom':
        return (
          <>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>自定义配置</div>
            <Form.Item label="自定义 Nginx 配置" name="custom_config" extra="直接添加到 http 块中的自定义配置">
              <TextArea
                rows={12}
                placeholder="# 在此添加自定义 Nginx 配置"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
              />
            </Form.Item>
          </>
        );

      case 'preview':
        return (
          <ConfigPreview
            content={previewContent}
            loading={previewing}
            onRefresh={handlePreview}
          />
        );

      default:
        return null;
    }
  };

  if (loadingConfig) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          padding: '12px 16px',
          background: 'var(--bg-secondary)',
          borderRadius: 8,
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button type="text" onClick={onBack} style={{ color: 'var(--text-secondary)' }}>
            ← 返回列表
          </Button>
          <span style={{ fontWeight: 600, fontSize: 16 }}>
            {configName || '新建配置'}
          </span>
        </div>
        <Space>
          <Button icon={<EyeOutlined />} onClick={handlePreview} loading={previewing}>
            预览
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
            {configId ? '保存' : '创建'}
          </Button>
        </Space>
      </div>

      {/* Editor layout */}
      <div style={{ display: 'flex', gap: 16 }}>
        {/* Left nav */}
        <div
          style={{
            width: 180,
            flexShrink: 0,
            background: 'var(--bg-secondary)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            padding: 8,
          }}
        >
          {navItems.map((item) => (
            <div
              key={item.key}
              className={`config-nav-item ${activeSection === item.key ? 'active' : ''}`}
              onClick={() => setActiveSection(item.key)}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Right content */}
        <div
          style={{
            flex: 1,
            background: 'var(--bg-secondary)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            padding: 24,
            minHeight: 500,
          }}
        >
          <Form form={form} layout="vertical">
            {renderSection()}
          </Form>
        </div>
      </div>
    </div>
  );
};

export default ConfigEditor;
