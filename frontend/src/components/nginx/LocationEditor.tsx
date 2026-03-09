import React, { useState } from 'react';
import { Card, Button, Form, Input, Select, InputNumber, Space, Modal, Row, Col, Tag, Empty, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { NginxLocation } from '../../types';

const { Option } = Select;

interface LocationEditorProps {
  locations: NginxLocation[];
  onChange: (locations: NginxLocation[]) => void;
}

const matchTypeLabels: Record<string, string> = {
  prefix: '前缀',
  exact: '精确 (=)',
  regex: '正则 (~)',
  regex_case_insensitive: '正则-忽略大小写 (~*)',
};

const handlerTypeLabels: Record<string, string> = {
  static: '静态文件',
  proxy: '反向代理',
  redirect: '重定向',
  return: '固定返回',
};

const LocationEditor: React.FC<LocationEditorProps> = ({ locations, onChange }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form] = Form.useForm();

  const handleAdd = () => {
    setEditingIndex(null);
    form.resetFields();
    form.setFieldsValue({
      path: '/',
      match_type: 'prefix',
      handler_type: 'static',
      root: '/usr/share/nginx/html',
      try_files: '$uri $uri/ /index.html',
    });
    setModalVisible(true);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    form.setFieldsValue(locations[index]);
    setModalVisible(true);
  };

  const handleDelete = (index: number) => {
    const updated = [...locations];
    updated.splice(index, 1);
    onChange(updated);
  };

  const handleSave = () => {
    form.validateFields().then((values) => {
      const updated = [...locations];
      const loc: NginxLocation = {
        ...values,
        sort_order: editingIndex !== null ? locations[editingIndex].sort_order : locations.length,
      };
      if (editingIndex !== null) {
        loc.id = locations[editingIndex].id;
        updated[editingIndex] = loc;
      } else {
        updated.push(loc);
      }
      onChange(updated);
      setModalVisible(false);
    });
  };

  const getHandlerSummary = (loc: NginxLocation) => {
    switch (loc.handler_type) {
      case 'proxy': return loc.proxy_pass || '-';
      case 'static': return loc.root || loc.try_files || '-';
      case 'redirect': return `${loc.redirect_code || 301} → ${loc.redirect_url || '-'}`;
      case 'return': return `${loc.return_code || 200}`;
      default: return '-';
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Location 规则</span>
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd}>
          添加规则
        </Button>
      </div>

      {locations.length === 0 ? (
        <Empty description="暂无 Location 规则" style={{ padding: 24 }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {locations.map((loc, index) => (
            <Card
              key={loc.id || index}
              size="small"
              style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Tag color="blue" style={{ fontFamily: 'var(--font-mono)', margin: 0 }}>
                  {loc.path}
                </Tag>
                <Tag>{matchTypeLabels[loc.match_type || 'prefix']}</Tag>
                <Tag color="purple">{handlerTypeLabels[loc.handler_type || 'static']}</Tag>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {getHandlerSummary(loc)}
                </span>
                <Space size="small">
                  <Button type="text" icon={<EditOutlined />} size="small" onClick={() => handleEdit(index)} />
                  <Popconfirm title="确定删除？" onConfirm={() => handleDelete(index)}>
                    <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                  </Popconfirm>
                </Space>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title={editingIndex !== null ? '编辑 Location' : '添加 Location'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
        width={650}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="路径" name="path" rules={[{ required: true, message: '请输入路径' }]}>
                <Input placeholder="/ 或 /api 或 /static" style={{ fontFamily: 'var(--font-mono)' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="匹配类型" name="match_type">
                <Select>
                  <Option value="prefix">前缀匹配</Option>
                  <Option value="exact">精确匹配 (=)</Option>
                  <Option value="regex">正则匹配 (~)</Option>
                  <Option value="regex_case_insensitive">正则-忽略大小写 (~*)</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="处理类型" name="handler_type">
            <Select>
              <Option value="static">静态文件</Option>
              <Option value="proxy">反向代理</Option>
              <Option value="redirect">重定向</Option>
              <Option value="return">固定返回</Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.handler_type !== cur.handler_type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('handler_type');
              if (type === 'static') {
                return (
                  <>
                    <Form.Item label="Root 目录" name="root">
                      <Input placeholder="/usr/share/nginx/html" />
                    </Form.Item>
                    <Form.Item label="try_files" name="try_files">
                      <Input placeholder="$uri $uri/ /index.html" style={{ fontFamily: 'var(--font-mono)' }} />
                    </Form.Item>
                  </>
                );
              }
              if (type === 'proxy') {
                return (
                  <>
                    <Form.Item label="Proxy Pass" name="proxy_pass" rules={[{ required: true, message: '请输入代理地址' }]}>
                      <Input placeholder="http://127.0.0.1:3000 或 http://upstream_name" style={{ fontFamily: 'var(--font-mono)' }} />
                    </Form.Item>
                    <Form.Item label="Proxy Headers (JSON)" name="proxy_set_headers" extra="JSON 格式，如：{&quot;Host&quot;: &quot;$host&quot;, &quot;X-Real-IP&quot;: &quot;$remote_addr&quot;}">
                      <Input.TextArea rows={3} placeholder='{"Host": "$host", "X-Real-IP": "$remote_addr"}' style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                    </Form.Item>
                  </>
                );
              }
              if (type === 'redirect') {
                return (
                  <Row gutter={16}>
                    <Col span={16}>
                      <Form.Item label="重定向 URL" name="redirect_url" rules={[{ required: true, message: '请输入 URL' }]}>
                        <Input placeholder="https://example.com" />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item label="状态码" name="redirect_code">
                        <Select>
                          <Option value={301}>301 永久</Option>
                          <Option value={302}>302 临时</Option>
                          <Option value={307}>307</Option>
                          <Option value={308}>308</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
              if (type === 'return') {
                return (
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item label="状态码" name="return_code">
                        <InputNumber min={100} max={599} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item label="返回内容" name="return_body">
                        <Input.TextArea rows={2} placeholder="Response body" />
                      </Form.Item>
                    </Col>
                  </Row>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LocationEditor;
