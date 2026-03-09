import type { ReactNode } from 'react';
import { Empty } from 'antd';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

const EmptyState = ({ title, description, action, icon }: EmptyStateProps) => {
  return (
    <div className="empty-state-shell">
      {icon ? (
        <div className="empty-state-shell__icon">{icon}</div>
      ) : (
        <Empty description={false} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      <h3 className="empty-state-shell__title">{title}</h3>
      {description && <p className="empty-state-shell__description">{description}</p>}
      {action && <div className="empty-state-shell__action">{action}</div>}
    </div>
  );
};

export default EmptyState;
