import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Drawer, message } from 'antd';
import { ReloadOutlined, StopOutlined } from '@ant-design/icons';
import {
  getDeploymentDetail,
  getDeploymentLogs,
  cancelDeployment,
} from '../../api/deployment';
import { useDeploymentLogs } from '../../hooks/useDeploymentLogs';
import type { Deployment, DeploymentLog } from '../../types';
import StatusBadge from '../common/StatusBadge';
import ActionGroup from '../common/ActionGroup';
import TerminalPanel from '../common/TerminalPanel';
import { formatDuration } from '../../utils/formatters';

interface DeployLogDrawerProps {
  /** 部署任务 ID，null 时不显示 */
  deploymentId: number | null;
  /** 是否打开 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 部署完成回调（可用于刷新列表） */
  onComplete?: () => void;
  /** 初始乐观状态（如点击部署后立即设为 running） */
  optimisticStatus?: Deployment['status'];
}

export default function DeployLogDrawer({
  deploymentId,
  open,
  onClose,
  onComplete,
  optimisticStatus,
}: DeployLogDrawerProps) {
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [historicalLogs, setHistoricalLogs] = useState<DeploymentLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef<() => void>(() => {});

  // 当前部署的 status
  const currentStatus = deployment?.status ?? (optimisticStatus || 'pending');
  const isRunning = currentStatus === 'running';

  // SSE 实时日志完成回调
  const handleRealtimeComplete = useCallback(() => {
    onCompleteRef.current();
  }, []);

  const {
    logs: realtimeLogs,
    isConnected: sseConnected,
    disconnect: disconnectSSE,
  } = useDeploymentLogs({
    deploymentId: deploymentId || 0,
    enabled: open && isRunning,
    onComplete: handleRealtimeComplete,
  });

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [realtimeLogs, historicalLogs, autoScroll]);

  const handleLogScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  // 加载部署详情
  const loadDeploymentDetail = async (id: number) => {
    try {
      const detail = await getDeploymentDetail(id);
      setDeployment(detail);
      return detail;
    } catch {
      return null;
    }
  };

  // 加载历史日志
  const loadHistoricalLogs = async (id: number) => {
    try {
      setLogsLoading(true);
      const logsData = await getDeploymentLogs(id);
      setHistoricalLogs(logsData || []);
    } catch {
      // 静默处理
    } finally {
      setLogsLoading(false);
    }
  };

  // 完成回调：刷新详情和日志
  onCompleteRef.current = () => {
    message.success('部署已完成');
    onComplete?.();
    if (deploymentId) {
      void (async () => {
        const detail = await loadDeploymentDetail(deploymentId);
        if (detail && detail.status !== 'running') {
          await loadHistoricalLogs(deploymentId);
        }
      })();
    }
  };

  // 打开时加载数据
  useEffect(() => {
    if (!open || !deploymentId) {
      // 关闭时重置
      if (!open) {
        setDeployment(null);
        setHistoricalLogs([]);
        setAutoScroll(true);
      }
      return;
    }

    // 如果有乐观状态，先设置一个临时快照
    if (optimisticStatus) {
      setDeployment((prev) => prev?.id === deploymentId ? prev : { id: deploymentId, status: optimisticStatus } as Deployment);
    }

    void (async () => {
      const detail = await loadDeploymentDetail(deploymentId);
      const resolved = detail
        ? optimisticStatus === 'running' && detail.status === 'pending'
          ? { ...detail, status: 'running' as const }
          : detail
        : null;
      if (resolved) setDeployment(resolved);
      if (resolved && resolved.status !== 'running') {
        await loadHistoricalLogs(deploymentId);
      }
    })();
  }, [open, deploymentId, optimisticStatus]);

  // 取消部署
  const handleCancel = async () => {
    if (!deploymentId) return;
    try {
      const result = await cancelDeployment(deploymentId);
      message.success(result.message || '已发送取消请求');
      const detail = await loadDeploymentDetail(deploymentId);
      if (detail && detail.status !== 'running') {
        await loadHistoricalLogs(deploymentId);
      }
    } catch (error: any) {
      message.error(error.message || '取消失败');
    }
  };

  // 当前日志：运行中用实时日志，否则用历史日志
  const currentLogs = isRunning ? realtimeLogs : historicalLogs;

  const renderTerminalContent = () => {
    if (currentLogs.length === 0) return '等待日志...';
    return currentLogs
      .map((log) => {
        const timestamp = new Date(log.created_at).toLocaleTimeString('zh-CN');
        const statusIcon = log.status === 'success' ? '✓' : log.status === 'failed' ? '✗' : log.status === 'running' ? '⟳' : '○';
        const statusClass = log.status === 'success' ? 'log-success' : log.status === 'failed' ? 'log-error' : 'log-warning';
        let line = `<span class="log-timestamp">[${timestamp}]</span> <span class="${statusClass}">${statusIcon} ${log.action}</span>`;
        if (log.output) line += `\n${log.output}`;
        if (log.error_msg) line += `\n<span class="log-error">${log.error_msg}</span>`;
        return line;
      })
      .join('\n\n');
  };

  const handleCopyLogs = async () => {
    const plain = currentLogs
      .map((log) => [log.action, log.output, log.error_msg].filter(Boolean).join('\n'))
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(plain);
      message.success('日志已复制到剪贴板');
    } catch {
      message.error('复制日志失败');
    }
  };

  const handleClose = () => {
    disconnectSSE();
    onClose();
  };

  return (
    <Drawer
      title={deployment ? `部署日志 · ${deployment.name}` : '部署日志'}
      open={open}
      onClose={handleClose}
      width={860}
      extra={(
        <ActionGroup>
          {isRunning && (
            <Button danger icon={<StopOutlined />} onClick={handleCancel}>停止</Button>
          )}
          {!isRunning && deploymentId && (
            <Button icon={<ReloadOutlined />} onClick={() => loadHistoricalLogs(deploymentId)}>重新加载</Button>
          )}
        </ActionGroup>
      )}
    >
      <div className="page-stack" style={{ gap: 16 }}>
        {deployment && (
          <div className="resource-summary">
            <div className="summary-card">
              <div className="summary-card__label">任务状态</div>
              <div style={{ marginTop: 10 }}><StatusBadge status={deployment.status} /></div>
              {deployment.error_msg && <div className="summary-card__hint">{deployment.error_msg}</div>}
            </div>
            <div className="summary-card">
              <div className="summary-card__label">目标服务器</div>
              <div className="summary-card__value" style={{ fontSize: 18 }}>{deployment.server?.name || '-'}</div>
              <div className="summary-card__hint">{deployment.server?.host || ''}</div>
            </div>
            <div className="summary-card">
              <div className="summary-card__label">执行耗时</div>
              <div className="summary-card__value" style={{ fontSize: 18 }}>{deployment.duration ? formatDuration(deployment.duration) : '-'}</div>
              <div className="summary-card__hint">共 {currentLogs.length} 条日志</div>
            </div>
          </div>
        )}

        <TerminalPanel
          title="终端日志"
          subtitle={isRunning ? '已连接实时日志' : '历史日志'}
          meta={(
            <>
              {isRunning && sseConnected && <StatusBadge status="running" label="实时日志已连接" compact />}
              <span className="summary-card__hint">共 {currentLogs.length} 条日志</span>
            </>
          )}
          htmlContent={renderTerminalContent()}
          height={500}
          onCopy={currentLogs.length ? handleCopyLogs : undefined}
          onScroll={handleLogScroll}
        />
        <div ref={logEndRef} />
        {logsLoading && <div style={{ textAlign: 'center', padding: 20 }}>正在加载日志...</div>}
      </div>
    </Drawer>
  );
}
