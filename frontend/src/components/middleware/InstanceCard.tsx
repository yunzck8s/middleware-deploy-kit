import { Card, Button, Space, Tag, Tooltip, Dropdown, Modal } from 'antd';
import type { MenuProps } from 'antd';
import {
  DeleteOutlined, PlayCircleOutlined, FileTextOutlined,
  CloudServerOutlined, FolderOpenOutlined,
  ClockCircleOutlined, ReloadOutlined, RightOutlined,
  SettingOutlined, MoreOutlined,
} from '@ant-design/icons';
import type { MiddlewareInstance } from '../../types';
import InstanceStatusBadge from './InstanceStatusBadge';
import { getInstallDir, envColors, envLabels } from '../../utils/instance';

interface InstanceCardProps {
  instance: MiddlewareInstance;
  deploying?: boolean;
  onManage: (id: number) => void;
  onDeploy?: (instance: MiddlewareInstance) => void;
  onViewLogs?: (instance: MiddlewareInstance) => void;
  onDelete?: (id: number) => void;
}

// 状态对应的主题色
const statusAccent: Record<string, string> = {
  running: '#22c55e',
  deploying: '#3b82f6',
  failed: '#ef4444',
  stopped: '#71717a',
  unknown: '#71717a',
};

function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  return d.toLocaleDateString('zh-CN');
}

export default function InstanceCard({ instance, deploying, onManage, onDeploy, onViewLogs, onDelete }: InstanceCardProps) {
  const installDir = getInstallDir(instance);
  const isDeploying = deploying || instance.status === 'deploying';
  const isFailed = instance.status === 'failed';
  const isRunning = instance.status === 'running' && !isDeploying;
  const canDeploy = !isDeploying && instance.status !== 'running';

  const resolvedStatus = isDeploying ? 'deploying' : instance.status;
  const accent = statusAccent[resolvedStatus] || statusAccent.unknown;

  // 更多菜单项
  const moreMenuItems: MenuProps['items'] = [
    onViewLogs && !isDeploying && !isRunning && !isFailed ? {
      key: 'logs',
      icon: <FileTextOutlined />,
      label: '部署日志',
      onClick: () => onViewLogs(instance),
    } : null,
    onDelete && !isDeploying ? {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除实例',
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: '确认删除',
          content: '删除实例将无法恢复，确定要删除吗？',
          okText: '删除',
          cancelText: '取消',
          okButtonProps: { danger: true },
          onOk: () => onDelete(instance.id),
        });
      },
    } : null,
  ].filter(Boolean) as MenuProps['items'];

  const hasMoreMenu = moreMenuItems && moreMenuItems.length > 0;

  return (
    <Card
      hoverable
      onClick={() => onManage(instance.id)}
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        border: '1px solid var(--border-color, #f0f0f0)',
        transition: 'all 0.3s ease',
        position: 'relative',
      }}
      styles={{
        body: { padding: 0 },
      }}
    >
      {/* 顶部状态色条 */}
      <div style={{
        height: 3,
        background: accent,
        opacity: resolvedStatus === 'unknown' ? 0.3 : 0.8,
        transition: 'all 0.3s ease',
      }} />

      {/* 卡片内容 */}
      <div style={{ padding: '14px 18px 16px' }}>

        {/* 头部：实例名 + 状态 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}>
                {instance.name}
              </h3>
              <RightOutlined style={{ fontSize: 10, color: 'var(--text-tertiary, #999)', flexShrink: 0, opacity: 0.5 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              {instance.version && (
                <Tag
                  color="geekblue"
                  style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px', marginRight: 0 }}
                >
                  v{instance.version}
                </Tag>
              )}
              {instance.environment && (
                <Tag
                  color={envColors[instance.environment] || 'default'}
                  style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px', marginRight: 0 }}
                >
                  {envLabels[instance.environment] || instance.environment}
                </Tag>
              )}
              {!instance.package_id && (
                <Tag
                  color="warning"
                  style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px', marginRight: 0 }}
                >
                  未关联离线包
                </Tag>
              )}
            </div>
          </div>
          <InstanceStatusBadge status={resolvedStatus} />
        </div>

        {/* 信息网格 — 使用分割线风格的小卡片 */}
        <div style={{
          background: 'var(--bg-tertiary, rgba(255,255,255,0.03))',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          fontSize: 12,
          color: 'var(--text-secondary, #a1a1aa)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloudServerOutlined style={{ fontSize: 13, color: accent, opacity: 0.8 }} />
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-mono, monospace)',
            }}>
              {instance.server?.host || instance.server?.name || `服务器 #${instance.server_id}`}
            </span>
          </div>

          {installDir && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderOpenOutlined style={{ fontSize: 13, color: accent, opacity: 0.8 }} />
              <Tooltip title={installDir}>
                <span style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'var(--font-mono, monospace)',
                }}>
                  {installDir}
                </span>
              </Tooltip>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClockCircleOutlined style={{ fontSize: 13, color: accent, opacity: 0.8 }} />
            <span>{formatTime(instance.updated_at || instance.created_at)}</span>
          </div>
        </div>

        {/* 操作区：主按钮(左) + 次要操作(右) */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: 28,
          }}
        >
          {/* 左侧：主操作按钮 */}
          <div>
            {canDeploy && onDeploy && (
              <Button
                type="primary"
                size="small"
                icon={isFailed ? <ReloadOutlined /> : <PlayCircleOutlined />}
                onClick={() => onDeploy(instance)}
              >
                {isFailed ? '重新部署' : '部署'}
              </Button>
            )}

            {isDeploying && (
              <Button type="primary" size="small" loading style={{ animation: 'pulse 2s ease-in-out infinite' }}>
                部署中
              </Button>
            )}

            {isRunning && (
              <Button size="small" icon={<SettingOutlined />} onClick={() => onManage(instance.id)}>
                管理
              </Button>
            )}
          </div>

          {/* 右侧：次要操作 */}
          <Space size={2}>
            {onViewLogs && (isRunning || isFailed) && (
              <Tooltip title="部署日志">
                <Button type="text" size="small" icon={<FileTextOutlined />} onClick={() => onViewLogs(instance)} />
              </Tooltip>
            )}

            {isDeploying && onViewLogs && (
              <Button type="link" size="small" style={{ padding: '0 4px', fontSize: 12 }} onClick={() => onViewLogs(instance)}>
                查看日志
              </Button>
            )}

            {hasMoreMenu && (
              <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
                <Button type="text" size="small" icon={<MoreOutlined />} style={{ opacity: 0.6 }} />
              </Dropdown>
            )}
          </Space>
        </div>
      </div>
    </Card>
  );
}
