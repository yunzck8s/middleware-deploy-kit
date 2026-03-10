import React from 'react';
import { Form, Input, Switch, Row, Col } from 'antd';

const CachePanel: React.FC = () => {
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>代理缓存</div>

      <Form.Item label="启用缓存" name="cache_enabled" valuePropName="checked">
        <Switch checkedChildren="启用" unCheckedChildren="禁用" />
      </Form.Item>

      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.cache_enabled !== cur.cache_enabled}>
        {({ getFieldValue }) =>
          getFieldValue('cache_enabled') && (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="缓存目录" name="cache_path">
                    <Input placeholder="/var/cache/nginx" style={{ fontFamily: 'var(--font-mono)' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="缓存大小" name="cache_size" extra="keys_zone 大小，例如 10m">
                    <Input placeholder="10m" style={{ fontFamily: 'var(--font-mono)' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="默认缓存时长" name="cache_valid_time" extra="例如 60m、12h 或 1d">
                <Input placeholder="60m" style={{ fontFamily: 'var(--font-mono)' }} />
              </Form.Item>
            </>
          )
        }
      </Form.Item>
    </div>
  );
};

export default CachePanel;
