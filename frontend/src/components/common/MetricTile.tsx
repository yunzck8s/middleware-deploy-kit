import type { ReactNode } from 'react';
import { Skeleton } from 'antd';

interface MetricTileProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
  onClick?: () => void;
}

const MetricTile = ({ label, value, hint, icon, tone = 'default', loading = false, onClick }: MetricTileProps) => {
  if (loading) {
    return (
      <div className="metric-tile metric-tile--loading shell-reveal shell-reveal--metric">
        <Skeleton active paragraph={{ rows: 1 }} />
      </div>
    );
  }

  return (
    <div
      className={`metric-tile metric-tile--${tone} shell-reveal shell-reveal--metric ${onClick ? 'metric-tile--clickable' : ''}`.trim()}
      onClick={onClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="metric-tile__header">
        <span className="metric-tile__label">{label}</span>
        {icon && <span className="metric-tile__icon">{icon}</span>}
      </div>
      <div className="metric-tile__value">{value}</div>
      {hint && <div className="metric-tile__hint">{hint}</div>}
    </div>
  );
};

export default MetricTile;
