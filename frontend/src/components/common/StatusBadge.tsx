import type { ReactNode } from 'react';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  WarningOutlined,
  CloudServerOutlined,
  StopOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';

interface StatusMeta {
  label: string;
  tone: 'default' | 'success' | 'warning' | 'danger' | 'info';
  icon: ReactNode;
}

const STATUS_MAP: Record<string, StatusMeta> = {
  success: { label: '已完成', tone: 'success', icon: <CheckCircleOutlined /> },
  failed: { label: '执行失败', tone: 'danger', icon: <CloseCircleOutlined /> },
  running: { label: '执行中', tone: 'info', icon: <LoadingOutlined /> },
  pending: { label: '待执行', tone: 'warning', icon: <ClockCircleOutlined /> },
  cancelled: { label: '已取消', tone: 'default', icon: <StopOutlined /> },
  applied: { label: '使用中', tone: 'success', icon: <CheckCircleOutlined /> },
  idle: { label: '未使用', tone: 'default', icon: <ClockCircleOutlined /> },
  active: { label: '已启用', tone: 'success', icon: <CheckCircleOutlined /> },
  draft: { label: '草稿', tone: 'default', icon: <ClockCircleOutlined /> },
  disabled: { label: '已停用', tone: 'danger', icon: <CloseCircleOutlined /> },
  online: { label: '在线', tone: 'success', icon: <CloudServerOutlined /> },
  offline: { label: '离线', tone: 'danger', icon: <CloudServerOutlined /> },
  unknown: { label: '未知', tone: 'default', icon: <WarningOutlined /> },
  expired: { label: '已过期', tone: 'danger', icon: <WarningOutlined /> },
  expiring: { label: '即将过期', tone: 'warning', icon: <WarningOutlined /> },
  valid: { label: '正常', tone: 'success', icon: <SafetyCertificateOutlined /> },
};

const ANIMATED_STATUSES = new Set(['running', 'pending', 'online', 'expiring']);

export const getStatusMeta = (status: string, fallbackLabel?: string): StatusMeta => {
  return STATUS_MAP[status] ?? {
    label: fallbackLabel || status,
    tone: 'default',
    icon: <ClockCircleOutlined />,
  };
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  compact?: boolean;
}

const StatusBadge = ({ status, label, compact = false }: StatusBadgeProps) => {
  const meta = getStatusMeta(status, label);
  const animated = ANIMATED_STATUSES.has(status);

  return (
    <span className={`status-badge status-badge--${meta.tone} ${compact ? 'status-badge--compact' : ''} ${animated ? 'status-badge--animated' : ''}`.trim()}>
      <span className="status-badge__icon">{meta.icon}</span>
      <span>{label ?? meta.label}</span>
    </span>
  );
};

export default StatusBadge;
