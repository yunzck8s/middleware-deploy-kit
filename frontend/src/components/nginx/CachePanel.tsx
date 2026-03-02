import React from 'react';
import { Form, Input, Switch, Row, Col } from 'antd';

const CachePanel: React.FC = () => {
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>缓存配置</div>

      <Form.Item label="启用代理缓存" name="cache_enabled" valuePropName="checked">
        <Switch checkedChildren="启用" unCheckedChildren="禁用" />
      </Form.Item>

      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.cache_enabled !== cur.cache_enabled}>
        {({ getFieldValue }) =>
          getFieldValue('cache_enabled') && (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="缓存路径" name="cache_path">
                    <Input placeholder="/var/cache/nginx" style={{ fontFamily: 'var(--font-mono)' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="缓存大小" name="cache_size" extra="缓存 keys zone 大小 (如 10m)">
                    <Input placeholder="10m" style={{ fontFamily: 'var(--font-mono)' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="缓存有效时间" name="cache_valid_time" extra="缓存有效期 (如 60m, 12h, 1d)">
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
