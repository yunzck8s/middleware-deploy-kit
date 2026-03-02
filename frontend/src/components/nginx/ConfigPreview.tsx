import React from 'react';
import { Button, Spin, message } from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';

interface ConfigPreviewProps {
  content: string;
  loading?: boolean;
  onRefresh?: () => void;
}

const ConfigPreview: React.FC<ConfigPreviewProps> = ({ content, loading, onRefresh }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    message.success('已复制到剪贴板');
  };

  // Basic syntax highlighting for nginx config
  const highlightNginx = (text: string): string => {
    return text
      .replace(/(#.*)/g, '<span style="color:#6A9955">$1</span>')
      .replace(/\b(server|location|upstream|http|events|worker_processes|worker_connections|listen|server_name|root|index|proxy_pass|proxy_set_header|ssl_certificate|ssl_certificate_key|ssl_protocols|ssl_ciphers|gzip|client_max_body_size|access_log|error_log|try_files|return|rewrite|add_header|limit_req|limit_conn|limit_req_zone|limit_conn_zone|proxy_cache_path|proxy_cache|proxy_cache_valid|include|sendfile|keepalive_timeout|log_format)\b/g, '<span style="color:#569CD6">$1</span>')
      .replace(/\b(on|off|auto)\b/g, '<span style="color:#CE9178">$1</span>')
      .replace(/(\d+)(s|m|ms|k|M|G)?/g, '<span style="color:#B5CEA8">$1$2</span>')
      .replace(/(\$\w+)/g, '<span style="color:#DCDCAA">$1</span>');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>配置预览</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {onRefresh && (
            <Button icon={<ReloadOutlined />} size="small" onClick={onRefresh} loading={loading}>
              刷新
            </Button>
          )}
          <Button icon={<CopyOutlined />} size="small" onClick={handleCopy}>
            复制
          </Button>
        </div>
      </div>
      <Spin spinning={!!loading}>
        <pre
          style={{
            background: 'var(--code-bg)',
            color: '#D4D4D4',
            padding: 16,
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.6,
            fontFamily: 'var(--font-mono)',
            maxHeight: 500,
            overflow: 'auto',
            border: '1px solid var(--border-color)',
            margin: 0,
          }}
          dangerouslySetInnerHTML={{
            __html: content ? highlightNginx(content) : '<span style="color:#6A9955"># 点击"刷新"生成配置预览</span>',
          }}
        />
      </Spin>
    </div>
  );
};

export default ConfigPreview;
