import { Card } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import type { MiddlewareTypeStats } from '../../types';

interface MiddlewareCardProps {
  stats: MiddlewareTypeStats;
  onClick: () => void;
}

const typeIcons: Record<string, string> = {
  nginx: '🌐',
  redis: '🔴',
  openssh: '🔐',
};

export default function MiddlewareCard({ stats, onClick }: MiddlewareCardProps) {
  return (
    <Card
      hoverable
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>
            {typeIcons[stats.type] || '📦'}
          </div>
          <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{stats.type}</h3>
          <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>
            <div>实例数：{stats.count}</div>
            {stats.configs !== undefined && <div>配置数：{stats.configs}</div>}
            {stats.certificates !== undefined && <div>证书数：{stats.certificates}</div>}
            {stats.last_deploy && <div>最近部署：{stats.last_deploy}</div>}
          </div>
        </div>
        <RightOutlined style={{ fontSize: '20px', color: 'var(--text-tertiary)' }} />
      </div>
    </Card>
  );
}
