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
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>SSL/TLS 配置</div>

      <Form.Item label="SSL 证书" name="certificate_id">
        <Select placeholder="选择证书" allowClear>
          {certificates.filter((c) => c.status === 'active').map((cert) => (
            <Option key={cert.id} value={cert.id}>
              {cert.name} ({cert.domain})
            </Option>
          ))}
        </Select>
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="SSL 协议" name="ssl_protocols">
            <Select mode="multiple" placeholder="选择协议版本">
              <Option value="TLSv1.2">TLSv1.2</Option>
              <Option value="TLSv1.3">TLSv1.3</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="密码套件预设" name="ssl_ciphers">
            <Select placeholder="选择预设" allowClear>
              <Option value="ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384">
                Modern (推荐)
              </Option>
              <Option value="ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384">
                Intermediate
              </Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item label="HSTS" name="enable_hsts" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="HSTS Max-Age (秒)" name="hsts_max_age">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="31536000" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="OCSP Stapling" name="enable_ocsp" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item label="启用 HTTPS" name="enable_https" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="HTTPS 端口" name="https_port">
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="HTTP→HTTPS 跳转" name="http_to_https" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
};

export default SSLPanel;
