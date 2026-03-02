import React from 'react';
import { Form, Input, Switch, InputNumber, Row, Col } from 'antd';

const { TextArea } = Input;

const SecurityPanel: React.FC = () => {
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>安全规则</div>

      {/* Rate Limiting */}
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, marginTop: 8 }}>
        速率限制 (Rate Limit)
      </div>
      <Form.Item label="启用速率限制" name="rate_limit_enabled" valuePropName="checked">
        <Switch checkedChildren="启用" unCheckedChildren="禁用" />
      </Form.Item>
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.rate_limit_enabled !== cur.rate_limit_enabled}>
        {({ getFieldValue }) =>
          getFieldValue('rate_limit_enabled') && (
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item label="Zone 配置" name="rate_limit_zone" extra="如: $binary_remote_addr zone=one:10m rate=10r/s">
                  <Input placeholder="$binary_remote_addr zone=one:10m rate=10r/s" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="Burst" name="rate_limit_burst">
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="20" />
                </Form.Item>
              </Col>
            </Row>
          )
        }
      </Form.Item>

      {/* Connection Limiting */}
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, marginTop: 16 }}>
        连接限制 (Connection Limit)
      </div>
      <Form.Item label="启用连接限制" name="conn_limit_enabled" valuePropName="checked">
        <Switch checkedChildren="启用" unCheckedChildren="禁用" />
      </Form.Item>
      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.conn_limit_enabled !== cur.conn_limit_enabled}>
        {({ getFieldValue }) =>
          getFieldValue('conn_limit_enabled') && (
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item label="Zone 配置" name="conn_limit_zone" extra="如: $binary_remote_addr zone=addr:10m">
                  <Input placeholder="$binary_remote_addr zone=addr:10m" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item label="最大连接数" name="conn_limit_num">
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="100" />
                </Form.Item>
              </Col>
            </Row>
          )
        }
      </Form.Item>

      {/* IP Access Control */}
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, marginTop: 16 }}>
        IP 访问控制
      </div>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label="允许 IP (Allow)" name="allow_ips" extra="每行一个 IP 或 CIDR">
            <TextArea rows={3} placeholder="192.168.1.0/24&#10;10.0.0.0/8" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="拒绝 IP (Deny)" name="deny_ips" extra="每行一个 IP 或 CIDR">
            <TextArea rows={3} placeholder="0.0.0.0/0" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
          </Form.Item>
        </Col>
      </Row>

      {/* Security Headers */}
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, marginTop: 16 }}>
        安全头配置
      </div>
      <Form.Item label="Security Headers (JSON)" name="security_headers" extra='如: {"X-Frame-Options": "SAMEORIGIN", "X-Content-Type-Options": "nosniff"}'>
        <TextArea
          rows={3}
          placeholder='{"X-Frame-Options": "SAMEORIGIN", "X-Content-Type-Options": "nosniff", "X-XSS-Protection": "1; mode=block"}'
          style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
        />
      </Form.Item>
    </div>
  );
};

export default SecurityPanel;
