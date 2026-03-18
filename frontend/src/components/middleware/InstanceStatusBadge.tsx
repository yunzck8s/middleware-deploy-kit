import { Tag } from 'antd';
import {
  CheckCircleFilled, CloseCircleFilled, SyncOutlined,
  MinusCircleFilled, ClockCircleFilled,
} from '@ant-design/icons';
import type { MiddlewareInstance } from '../../types';

interface InstanceStatusBadgeProps {
  status: MiddlewareInstance['status'];
}

const statusConfig: Record<string, {
  color: string;
  text: string;
  icon: React.ReactNode;
}> = {
  running: {
    color: 'success',
    text: '运行中',
    icon: <CheckCircleFilled />,
  },
  stopped: {
    color: 'error',
    text: '已停止',
    icon: <MinusCircleFilled />,
  },
  deploying: {
    color: 'processing',
    text: '部署中',
    icon: <SyncOutlined spin />,
  },
  failed: {
    color: 'error',
    text: '部署失败',
    icon: <CloseCircleFilled />,
  },
  unknown: {
    color: 'default',
    text: '待部署',
    icon: <ClockCircleFilled />,
  },
};

export default function InstanceStatusBadge({ status }: InstanceStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.unknown;

  return (
    <Tag color={config.color} icon={config.icon} style={{ marginRight: 0 }}>
      {config.text}
    </Tag>
  );
}
