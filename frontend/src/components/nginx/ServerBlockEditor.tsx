import React, { useState } from 'react';
import { Card, Button, Tag, Space, Drawer, Form, Input, InputNumber, Select, Switch, Row, Col, Empty, Popconfirm, Badge } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, GlobalOutlined, LockOutlined } from '@ant-design/icons';
import LocationEditor from './LocationEditor';
import type { NginxServerBlock, NginxLocation, Certificate } from '../../types';

const { Option } = Select;

interface ServerBlockEditorProps {
  serverBlocks: NginxServerBlock[];
  onChange: (blocks: NginxServerBlock[]) => void;
  certificates: Certificate[];
}

// 创建默认 Server Block
const createDefaultBlock = (index: number): NginxServerBlock => ({
  name: `Server ${index + 1}`,
  enable_http: true,
  http_port: 80,
  enable_https: false,
  https_port: 443,
  http_to_https: false,
  server_name: '_',
  root_path: '/usr/local/nginx/html',
  index_files: 'index.html index.htm',
  ssl_protocols: 'TLSv1.2 TLSv1.3',
  enable_hsts: false,
  hsts_max_age: 31536000,
  enable_ocsp: false,
  enable_proxy: false,
  locations: [],
});

const ServerBlockEditor: React.FC<ServerBlockEditorProps> = ({ serverBlocks, onChange, certificates }) => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingBlock, setEditingBlock] = useState<NginxServerBlock | null>(null);
  const [editingLocations, setEditingLocations] = useState<NginxLocation[]>([]);
  const [form] = Form.useForm();

  const openEditor = (index: number | null, block?: NginxServerBlock) => {
    const target = block || createDefaultBlock(serverBlocks.length);
    setEditingIndex(index);
    setEditingBlock(target);
    setEditingLocations(target.locations || []);
    form.setFieldsValue({
      name: target.name,
      server_name: target.server_name,
      root_path: target.root_path,
      index_files: target.index_files,
      enable_http: target.enable_http,
      http_port: target.http_port,
      enable_https: target.enable_https,
      https_port: target.https_port,
      http_to_https: target.http_to_https,
      certificate_id: target.certificate_id,
      ssl_protocols: target.ssl_protocols,
      ssl_ciphers: target.ssl_ciphers,
      enable_hsts: target.enable_hsts,
      hsts_max_age: target.hsts_max_age,
      enable_ocsp: target.enable_ocsp,
      enable_proxy: target.enable_proxy,
      proxy_pass: target.proxy_pass,
    });
    setDrawerVisible(true);
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      const block: NginxServerBlock = {
        ...editingBlock,
        ...values,
        locations: editingLocations,
      };
      const updated = [...serverBlocks];
      if (editingIndex !== null) {
        updated[editingIndex] = block;
      } else {
        updated.push(block);
      }
      onChange(updated);
      setDrawerVisible(false);
      setEditingBlock(null);
      setEditingIndex(null);
    });
  };

  const handleDelete = (index: number) => {
    const updated = serverBlocks.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleCopy = (block: NginxServerBlock) => {
    const copied: NginxServerBlock = {
      ...block,
      id: undefined,
      name: `${block.name || 'Server'} (副本)`,
      locations: (block.locations || []).map((loc) => ({ ...loc, id: undefined, server_block_id: undefined })),
    };
    onChange([...serverBlocks, copied]);
  };

  // 端口 Tag 列表
  const renderPortTags = (block: NginxServerBlock) => {
    const tags: React.ReactNode[] = [];
    if (block.enable_http) {
      tags.push(<Tag key="http" color="blue">HTTP:{block.http_port || 80}</Tag>);
    }
    if (block.enable_https) {
      tags.push(<Tag key="https" color="green">HTTPS:{block.https_port || 443}</Tag>);
    }
    if (block.http_to_https) {
      tags.push(<Tag key="redirect" color="orange">HTTP→HTTPS</Tag>);
    }
    return tags;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Server 块管理</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
            每个 Server 块对应 nginx.conf 中的一个 server &#123;&#125; 段，可独立配置端口、域名、SSL 和路由规则
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor(null)}>
          添加 Server 块
        </Button>
      </div>

      {serverBlocks.length === 0 ? (
        <Empty
          description="暂无 Server 块，点击上方按钮添加"
          style={{ padding: '40px 0' }}
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {serverBlocks.map((block, index) => (
            <Card
              key={index}
              size="small"
              hoverable
              style={{ cursor: 'default' }}
              styles={{ body: { padding: '12px 16px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <GlobalOutlined style={{ color: 'var(--text-tertiary)' }} />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{block.name || `Server ${index + 1}`}</span>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {block.server_name || '_'}
                    </span>
                    {block.enable_https && block.certificate && (
                      <Tag icon={<LockOutlined />} color="green" style={{ marginLeft: 4, fontSize: 11 }}>
                        SSL
                      </Tag>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {renderPortTags(block)}
                    {block.enable_proxy && <Tag color="purple">代理</Tag>}
                    <Badge
                      count={block.locations?.length || 0}
                      showZero
                      color="var(--text-tertiary)"
                      style={{ fontSize: 11 }}
                      title="Location 数量"
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>个路由</span>
                  </div>
                </div>
                <Space size={4}>
                  <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditor(index, block)}>
                    编辑
                  </Button>
                  <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(block)}>
                    复制
                  </Button>
                  <Popconfirm title="确定删除此 Server 块？" onConfirm={() => handleDelete(index)} okText="删除" cancelText="取消">
                    <Button type="text" size="small" danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 编辑 Drawer */}
      <Drawer
        title={editingIndex !== null ? `编辑 Server 块 · ${editingBlock?.name || ''}` : '添加 Server 块'}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setEditingBlock(null); }}
        width={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            <Button type="primary" onClick={handleSave}>确定</Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          {/* 基础信息 */}
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, color: 'var(--text-secondary)' }}>基础信息</div>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="块名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
                <Input placeholder="例如：主站、API 服务" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="域名（server_name）" name="server_name" extra="可填写 _、单个域名或多个空格分隔">
                <Input placeholder="_ 或 example.com" className="mono" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="根目录" name="root_path">
                <Input placeholder="/usr/local/nginx/html" className="mono" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="索引文件列表" name="index_files">
            <Input placeholder="index.html index.htm" className="mono" />
          </Form.Item>

          {/* 监听配置 */}
          <div style={{ fontWeight: 600, fontSize: 13, margin: '20px 0 12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
            监听配置
          </div>
          <Row gutter={16}>
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
            <Col span={8}>
              <Form.Item name="http_to_https" valuePropName="checked" label="HTTP→HTTPS 跳转">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="enable_https" valuePropName="checked" label="启用 HTTPS">
                <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="HTTPS 端口" name="https_port">
                <InputNumber min={1} max={65535} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          {/* SSL 配置 */}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.enable_https !== cur.enable_https}>
            {({ getFieldValue }) => getFieldValue('enable_https') && (
              <>
                <div style={{ fontWeight: 600, fontSize: 13, margin: '20px 0 12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                  SSL / TLS 配置
                </div>
                <Form.Item label="选择证书" name="certificate_id" extra="选择一张已上传、状态正常的证书">
                  <Select placeholder="选择一个证书" allowClear>
                    {certificates.filter((c) => c.status === 'active').map((cert) => (
                      <Option key={cert.id} value={cert.id}>
                        {cert.name} ({cert.domain})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item label="TLS 协议版本" name="ssl_protocols">
                      <Select mode="multiple" placeholder="选择允许的 TLS 版本">
                        <Option value="TLSv1.2">TLSv1.2</Option>
                        <Option value="TLSv1.3">TLSv1.3</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="密码套件" name="ssl_ciphers">
                      <Select placeholder="选择一个预设" allowClear>
                        <Option value="ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384">
                          现代兼容（推荐）
                        </Option>
                        <Option value="ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384">
                          兼容更多客户端
                        </Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item label="启用 HSTS" name="enable_hsts" valuePropName="checked">
                      <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="HSTS 有效期（秒）" name="hsts_max_age">
                      <InputNumber min={0} style={{ width: '100%' }} placeholder="31536000" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="启用 OCSP Stapling" name="enable_ocsp" valuePropName="checked">
                      <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            )}
          </Form.Item>

          {/* 代理入口 */}
          <div style={{ fontWeight: 600, fontSize: 13, margin: '20px 0 12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
            代理入口
          </div>
          <Form.Item name="enable_proxy" valuePropName="checked" label="启用反向代理">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.enable_proxy !== cur.enable_proxy}>
            {({ getFieldValue }) => getFieldValue('enable_proxy') && (
              <Form.Item label="默认代理地址" name="proxy_pass" extra="Location 路由可单独覆盖此地址">
                <Input placeholder="http://127.0.0.1:3000" className="mono" />
              </Form.Item>
            )}
          </Form.Item>

          {/* Location 管理 */}
          <div style={{ fontWeight: 600, fontSize: 13, margin: '20px 0 12px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
            Location 路由
          </div>
          <LocationEditor locations={editingLocations} onChange={setEditingLocations} />
        </Form>
      </Drawer>
    </div>
  );
};

export default ServerBlockEditor;
