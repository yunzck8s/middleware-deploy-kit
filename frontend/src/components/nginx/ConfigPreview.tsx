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

  // Token-based syntax highlighting to avoid cascading regex corruption
  const highlightNginx = (text: string): string => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const tokens: { start: number; end: number; html: string }[] = [];

    const collect = (regex: RegExp, color: string) => {
      let m: RegExpExecArray | null;
      while ((m = regex.exec(escaped)) !== null) {
        const overlap = tokens.some((t) => m!.index < t.end && m!.index + m![0].length > t.start);
        if (!overlap) {
          tokens.push({
            start: m.index,
            end: m.index + m[0].length,
            html: `<span style="color:${color}">${m[0]}</span>`,
          });
        }
      }
    };

    collect(/(#.*)/g, '#6A9955');
    collect(
      /\b(server|location|upstream|http|events|worker_processes|worker_connections|listen|server_name|root|index|proxy_pass|proxy_set_header|ssl_certificate|ssl_certificate_key|ssl_protocols|ssl_ciphers|gzip|gzip_vary|gzip_proxied|gzip_comp_level|gzip_types|client_max_body_size|access_log|error_log|try_files|return|rewrite|add_header|limit_req|limit_conn|limit_req_zone|limit_conn_zone|proxy_cache_path|proxy_cache|proxy_cache_valid|include|sendfile|tcp_nopush|tcp_nodelay|keepalive_timeout|types_hash_max_size|log_format|default_type|use|multi_accept|pid|user)\b/g,
      '#569CD6',
    );
    collect(/\b(on|off|auto|epoll|warn)\b/g, '#CE9178');
    collect(/(?<![#\w])(\d+)(s|m|ms|k|M|G)?\b/g, '#B5CEA8');
    collect(/(\$\w+)/g, '#DCDCAA');

    tokens.sort((a, b) => b.start - a.start);
    let result = escaped;
    for (const t of tokens) {
      result = result.slice(0, t.start) + t.html + result.slice(t.end);
    }
    return result;
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
