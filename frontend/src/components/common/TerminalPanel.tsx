import { Button } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

interface TerminalPanelProps {
  title?: string;
  subtitle?: string;
  meta?: ReactNode;
  htmlContent: string;
  height?: number;
  onCopy?: () => void;
}

const TerminalPanel = ({
  title = '终端日志',
  subtitle,
  meta,
  htmlContent,
  height = 420,
  onCopy,
}: TerminalPanelProps) => {
  return (
    <div className="terminal-panel">
      <div className="terminal-panel__toolbar">
        <div>
          <div className="terminal-panel__title">{title}</div>
          {subtitle && <div className="terminal-panel__subtitle">{subtitle}</div>}
        </div>
        <div className="terminal-panel__toolbar-actions">
          {meta}
          {onCopy && (
            <Button type="text" icon={<CopyOutlined />} onClick={onCopy}>
              复制日志
            </Button>
          )}
        </div>
      </div>
      <div
        className="terminal-panel__body terminal-log"
        style={{ minHeight: height, maxHeight: height }}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </div>
  );
};

export default TerminalPanel;
