import React from 'react';
import { Form, Select, Switch, InputNumber, Row, Col } from 'antd';
import type { Certificate } from '../../types';

const { Option } = Select;

interface SSLPanelProps {
  certificates: Certificate[];
}

const SSLPanel: React.FC<SSLPanelProps> = ({ certificates }) => {
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>HTTPS 与证书</div>

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
          <Form.Item label="HSTS 有效期（秒）" name="hsts_max_age" extra="例如 31536000 表示 1 年">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="31536000" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="启用 OCSP Stapling" name="enable_ocsp" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item label="启用 HTTPS 监听" name="enable_https" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="HTTPS 端口" name="https_port">
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="HTTP 自动跳转到 HTTPS" name="http_to_https" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
};

export default SSLPanel;
