import React, { useMemo, useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Switch, Row, Col, Button, message, Spin } from 'antd';
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
  ArrowLeftOutlined,
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
import PageHeader from '../common/PageHeader';
import SectionCard from '../common/SectionCard';
import ActionGroup from '../common/ActionGroup';
import EmptyState from '../common/EmptyState';

const { Option } = Select;
const { TextArea } = Input;

type NavSection = 'basic' | 'server' | 'locations' | 'upstream' | 'ssl' | 'cache' | 'security' | 'log' | 'custom' | 'preview';

const navItems: { key: NavSection; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'basic', label: '基础设置', icon: <SettingOutlined />, description: '名称、状态、Worker、端口与压缩能力' },
  { key: 'server', label: 'Server 块', icon: <GlobalOutlined />, description: '域名、根目录与全局代理入口' },
  { key: 'locations', label: 'Location 路由', icon: <EnvironmentOutlined />, description: '按路径编排处理逻辑和转发规则' },
  { key: 'upstream', label: 'Upstream 集群', icon: <ClusterOutlined />, description: '定义上游集群与负载均衡策略' },
  { key: 'ssl', label: 'SSL / TLS', icon: <LockOutlined />, description: '证书、协议、安全传输相关设置' },
  { key: 'cache', label: '缓存', icon: <DatabaseOutlined />, description: '缓存路径、大小与有效期' },
  { key: 'security', label: '安全规则', icon: <SafetyOutlined />, description: '限流、连接数、IP 白名单与头部策略' },
  { key: 'log', label: '日志', icon: <FileTextOutlined />, description: '访问日志、错误日志与轮转控制' },
  { key: 'custom', label: '自定义', icon: <CodeOutlined />, description: '补充自定义 Nginx 指令片段' },
  { key: 'preview', label: '配置预览', icon: <EyeOutlined />, description: '查看渲染后的配置内容与 logrotate' },
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
      form.setFieldsValue({
        worker_processes: 'auto',
        worker_connections: 1024,
        enable_http: true,
        http_port: 80,
        enable_https: false,
        https_port: 443,
        http_to_https: false,
        server_name: '_',
        root_path: '/usr/local/nginx/html',
        index_files: 'index.html index.htm',
        access_log_path: '/usr/local/nginx/logs/access.log',
        error_log_path: '/usr/local/nginx/logs/error.log',
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
        status: 'draft',
      });
      setConfigName('新建配置');
    }
  }, [configId, form]);

  const activeItem = useMemo(
    () => navItems.find((item) => item.key === activeSection) || navItems[0],
    [activeSection],
  );

  const loadCertificates = async () => {
    try {
      const result = await getCertificateList({ page: 1, page_size: 100 });
      setCertificates(result.certificates || []);
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
        locations: undefined,
        upstreams: undefined,
        server: undefined,
        certificate: undefined,
      });
    } catch (error: any) {
      message.error(error.message || '暂时无法加载配置详情');
    } finally {
      setLoadingConfig(false);
    }
  };


  const collectConfigPayload = async () => {
    const values = form.getFieldsValue(true);
    const normalizedName = typeof values.name === 'string' ? values.name.trim() : '';

    if (!normalizedName) {
      setActiveSection('basic');
      form.setFields([{ name: 'name', errors: ['请输入配置名称'] }]);
      message.error('请先填写配置名称，再生成预览或保存');
      return null;
    }

    return {
      ...values,
      name: normalizedName,
      locations,
    };
  };

  const handleSave = async () => {
    try {
      const data = await collectConfigPayload();
      if (!data) return;
      setSaving(true);
      if (configId) {
        await updateNginxConfig(configId, data);
        message.success('配置已保存');
      } else {
        await createNginxConfig(data);
        message.success('配置已创建，可返回列表继续应用');
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
      const data = await collectConfigPayload();
      if (!data) return;
      setPreviewing(true);
      const result = await previewNginxConfig(data);
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
      if (!error?.errorFields) {
        message.error(error.message || '生成预览失败');
      }
    } finally {
      setPreviewing(false);
    }
  };

  const renderSection = () => {
    switch (activeSection) {
      case 'basic':
        return (
          <div className="config-section-card">
            <div className="config-section-card__title">基础设置</div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="配置名称" name="name" rules={[{ required: true, message: '请输入配置名称' }] }>
                  <Input placeholder="例如：production-web" onChange={(event) => setConfigName(event.target.value)} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="描述" name="description">
                  <Input placeholder="例如：生产环境 Web 入口" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item label="Worker 进程数" name="worker_processes">
                  <Input placeholder="auto" className="mono" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="单个 Worker 连接数" name="worker_connections">
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="最大请求体大小" name="client_max_body_size">
                  <Input placeholder="100m" className="mono" />
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
            <Form.Item label="发布状态" name="status">
              <Select>
                <Option value="draft">草稿</Option>
                <Option value="active">已启用</Option>
                <Option value="disabled">已停用</Option>
              </Select>
            </Form.Item>
          </div>
        );
      case 'server':
        return (
          <div className="config-section-card">
            <div className="config-section-card__title">Server 块配置</div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="域名（server_name）" name="server_name" extra="可填写 _、单个域名或多个空格分隔的域名">
                  <Input placeholder="_ 或 example.com" className="mono" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="根目录" name="root_path">
                  <Input placeholder="/usr/share/nginx/html" className="mono" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="索引文件列表" name="index_files">
              <Input placeholder="index.html index.htm" className="mono" />
            </Form.Item>
            <Form.Item name="enable_proxy" valuePropName="checked" label="启用默认反向代理">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.enable_proxy !== cur.enable_proxy}>
              {({ getFieldValue }) => getFieldValue('enable_proxy') && (
                <Form.Item label="默认代理地址" name="proxy_pass" extra="Location 路由可单独覆盖这里的代理地址">
                  <Input placeholder="http://127.0.0.1:3000" className="mono" />
                </Form.Item>
              )}
            </Form.Item>
          </div>
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
          <div className="config-section-card">
            <div className="config-section-card__title">日志与轮转</div>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="访问日志路径" name="access_log_path">
                  <Input placeholder="/usr/local/nginx/logs/access.log" className="mono" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="错误日志路径" name="error_log_path">
                  <Input placeholder="/usr/local/nginx/logs/error.log" className="mono" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="日志格式" name="log_format">
              <Select>
                <Option value="main">标准文本（main）</Option>
                <Option value="json">JSON 日志</Option>
              </Select>
            </Form.Item>

            <div style={{ borderTop: '1px solid var(--border-color)', margin: '24px 0 16px' }} />
            <Form.Item
              name="rotate_enabled"
              valuePropName="checked"
              label="启用日志轮转"
              extra="启用后会同时生成 /etc/logrotate.d/nginx 配置"
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>

            <Form.Item noStyle shouldUpdate={(prev, cur) => prev.rotate_enabled !== cur.rotate_enabled}>
              {({ getFieldValue }) => getFieldValue('rotate_enabled') && (
                <>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="轮转频率" name="rotate_frequency">
                        <Select>
                          <Option value="daily">每天</Option>
                          <Option value="weekly">每周</Option>
                          <Option value="monthly">每月</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="保留份数" name="rotate_count">
                        <InputNumber min={1} max={365} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="最大文件大小" name="rotate_max_size" extra="超过这个大小时，也会立即触发轮转">
                        <Input placeholder="100M" className="mono" />
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
              )}
            </Form.Item>
          </div>
        );
      case 'custom':
        return (
          <div className="config-section-card">
            <div className="config-section-card__title">自定义配置</div>
            <Form.Item label="附加 Nginx 指令" name="custom_config" extra="会直接追加到 http 块中，请先确认语法正确">
              <TextArea rows={14} placeholder="# 例如：map $http_upgrade $connection_upgrade { ... }" className="mono" style={{ fontSize: 12 }} />
            </Form.Item>
          </div>
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
    <div className="page-stack">
      <PageHeader
        eyebrow="配置工作台"
        title={configId ? `编辑配置 · ${configName}` : '新建 Nginx 配置'}
        subtitle="在配置工作台里完成基础设置、Server、Location、TLS、安全和预览。"
        actions={(
          <ActionGroup>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>返回列表</Button>
            <Button icon={<EyeOutlined />} onClick={handlePreview} loading={previewing}>生成预览</Button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              {configId ? '保存配置' : '创建配置'}
            </Button>
          </ActionGroup>
        )}
      />

      <div className="config-workbench">
        <div className="config-sidebar">
          {navItems.map((item) => (
            <div
              key={item.key}
              className={`config-nav-item ${activeSection === item.key ? 'active' : ''}`}
              onClick={() => setActiveSection(item.key)}
            >
              {item.icon}
              <div>
                <div>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{item.description}</div>
              </div>
            </div>
          ))}
        </div>

        <SectionCard
          title={activeItem.label}
          subtitle={activeItem.description}
          className="config-main"
          bodyClassName="section-card__body"
        >
          <Form form={form} layout="vertical">
            {renderSection()}
          </Form>
        </SectionCard>

        <SectionCard
          title="预览结果"
          subtitle="保存前先确认最终生成的 Nginx 配置内容。"
          className="config-preview"
          extra={<Button type="link" icon={<EyeOutlined />} onClick={handlePreview} loading={previewing}>刷新预览</Button>}
        >
          {previewContent ? (
            <ConfigPreview content={previewContent} loading={previewing} />
          ) : (
            <EmptyState
              title="还没有预览内容"
              description="点击“生成预览”后，这里会显示 Nginx 配置和 logrotate 配置。"
              action={<Button icon={<EyeOutlined />} onClick={handlePreview} loading={previewing}>生成预览</Button>}
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
};

export default ConfigEditor;
