import React, { useState } from 'react';
import { Card, Button, Form, Input, Select, InputNumber, Space, Modal, Row, Col, Tag, Empty, Popconfirm, Switch, Progress, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { NginxUpstream, UpstreamServer } from '../../types';

const { Option } = Select;

interface UpstreamEditorProps {
  upstreams: NginxUpstream[];
  onChange: (upstreams: NginxUpstream[]) => void;
}

const lbLabels: Record<string, string> = {
  round_robin: '轮询',
  least_conn: '最少连接',
  ip_hash: 'IP 哈希',
  hash: '自定义哈希',
};

const parseServers = (serversStr: string): UpstreamServer[] => {
  try {
    return JSON.parse(serversStr || '[]');
  } catch {
    return [];
  }
};

const UpstreamEditor: React.FC<UpstreamEditorProps> = ({ upstreams, onChange }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [servers, setServers] = useState<UpstreamServer[]>([]);
  const [form] = Form.useForm();

  const handleAdd = () => {
    setEditingIndex(null);
    form.resetFields();
    form.setFieldsValue({ load_balance: 'round_robin' });
    setServers([{ address: '127.0.0.1', port: 8080, weight: 1 }]);
    setModalVisible(true);
  };

  const handleEdit = (index: number) => {
    const upstream = upstreams[index];
    setEditingIndex(index);
    form.setFieldsValue({ name: upstream.name, load_balance: upstream.load_balance });
    setServers(parseServers(upstream.servers));
    setModalVisible(true);
  };

  const handleDelete = (index: number) => {
    const updated = [...upstreams];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      const updated = [...upstreams];
      const upstream: NginxUpstream = {
        ...values,
        servers: JSON.stringify(servers),
      };
      if (editingIndex !== null) {
        upstream.id = upstreams[editingIndex].id;
        upstream.nginx_config_id = upstreams[editingIndex].nginx_config_id;
        updated[editingIndex] = upstream;
      } else {
        updated.push(upstream);
      }
      onChange(updated);
      setModalVisible(false);
    });
  };

  const addServer = () => {
    setServers([...servers, { address: '', port: 8080, weight: 1 }]);
  };

  const updateServer = (index: number, field: string, value: any) => {
    const updated = [...servers];
    (updated[index] as any)[field] = value;
    setServers(updated);
  };

  const removeServer = (index: number) => {
    const updated = [...servers];
    updated.splice(index, 1);
    setServers(updated);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Upstream 负载均衡</span>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd}>
          添加 Upstream
        </Button>
      </div>

      {upstreams.length === 0 ? (
        <Empty description="暂无 Upstream 配置" style={{ padding: 24 }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upstreams.map((up, index) => {
            const srvs = parseServers(up.servers);
            const totalWeight = srvs.reduce((sum, s) => sum + (s.weight || 1), 0);
            return (
              <Card key={up.id || index} size="small" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="purple" style={{ fontFamily: 'var(--font-mono)', margin: 0 }}>{up.name}</Tag>
                    <Tag>{lbLabels[up.load_balance] || up.load_balance}</Tag>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{srvs.length} 个后端</span>
                  </div>
                  <Space size="small">
                    <Tooltip title="编辑这个 Upstream 集群">
                    <Button type="text" icon={<EditOutlined />} size="small" onClick={() => handleEdit(index)} aria-label="编辑 Upstream 集群" />
                  </Tooltip>
                    <Popconfirm title="确定删除？" onConfirm={() => handleDelete(index)}>
                      <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                    </Popconfirm>
                  </Space>
                </div>
                {srvs.map((srv, i) => {
                  const pct = totalWeight > 0 ? Math.round(((srv.weight || 1) / totalWeight) * 100) : 0;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span className={`status-dot ${srv.down ? 'status-dot--offline' : 'status-dot--online'}`} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 160 }}>
                        {srv.address}:{srv.port}
                      </span>
                      <Progress percent={pct} size="small" style={{ flex: 1 }} showInfo={false} strokeColor="var(--color-primary)" trailColor="var(--bg-secondary)" />
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 40, textAlign: 'right' }}>
                        w={srv.weight || 1}
                      </span>
                      {srv.backup && <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>备用</Tag>}
                      {srv.down && <Tag color="red" style={{ margin: 0, fontSize: 10 }}>下线</Tag>}
                    </div>
                  );
                })}
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        title={editingIndex !== null ? '编辑 Upstream 集群' : '新增 Upstream 集群'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="集群名称" name="name" rules={[{ required: true, message: '请输入 Upstream 集群名称' }]} extra="建议使用能体现业务用途的名字">
                <Input placeholder="backend_servers" style={{ fontFamily: 'var(--font-mono)' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="负载均衡策略" name="load_balance">
                <Select>
                  <Option value="round_robin">轮询（Round Robin）</Option>
                  <Option value="least_conn">最少连接</Option>
                  <Option value="ip_hash">按 IP 哈希</Option>
                  <Option value="hash">自定义哈希</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <div style={{ marginTop: 8, marginBottom: 8, fontWeight: 500, fontSize: 13 }}>上游节点</div>
        {servers.map((srv, index) => (
          <Card key={index} size="small" style={{ marginBottom: 8, background: 'var(--bg-tertiary)' }}>
            <Row gutter={8} align="middle">
              <Col span={7}>
                <Input
                  value={srv.address}
                  onChange={(e) => updateServer(index, 'address', e.target.value)}
                  placeholder="例如：192.168.1.10"
                  size="small"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </Col>
              <Col span={4}>
                <InputNumber
                  value={srv.port}
                  onChange={(v) => updateServer(index, 'port', v)}
                  min={1}
                  max={65535}
                  size="small"
                  style={{ width: '100%' }}
                />
              </Col>
              <Col span={3}>
                <InputNumber
                  value={srv.weight || 1}
                  onChange={(v) => updateServer(index, 'weight', v)}
                  min={1}
                  size="small"
                  addonBefore="w"
                  style={{ width: '100%' }}
                />
              </Col>
              <Col span={4}>
                <Switch
                  checked={srv.backup}
                  onChange={(v) => updateServer(index, 'backup', v)}
                  checkedChildren="备用"
                  unCheckedChildren="主用"
                  size="small"
                />
              </Col>
              <Col span={4}>
                <Switch
                  checked={srv.down}
                  onChange={(v) => updateServer(index, 'down', v)}
                  checkedChildren="下线"
                  unCheckedChildren="启用"
                  size="small"
                />
              </Col>
              <Col span={2}>
                <Tooltip title="删除这个上游节点">
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    onClick={() => removeServer(index)}
                    disabled={servers.length <= 1}
                    aria-label="删除上游节点"
                  />
                </Tooltip>
              </Col>
            </Row>
          </Card>
        ))}
        <Button type="dashed" block onClick={addServer} icon={<PlusOutlined />} size="small">
          添加上游节点
        </Button>
      </Modal>
    </div>
  );
};

export default UpstreamEditor;
