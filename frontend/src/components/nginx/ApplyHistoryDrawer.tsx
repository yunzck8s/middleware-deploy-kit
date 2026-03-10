import { useEffect, useMemo, useState } from 'react';
import { Button, Drawer, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { getApplyDetail, getApplyHistory } from '../../api/nginx';
import type { NginxConfigApply, NginxConfigApplyLog } from '../../types';
import { formatDateTime, formatDuration } from '../../utils/formatters';
import ActionGroup from '../common/ActionGroup';
import EmptyState from '../common/EmptyState';
import SectionCard from '../common/SectionCard';
import StatusBadge from '../common/StatusBadge';
import TerminalPanel from '../common/TerminalPanel';

interface ApplyHistoryDrawerProps {
  configId: number | null;
  initialApplyId?: number | null;
  open: boolean;
  onClose: () => void;
}

const POLLABLE_STATUSES = new Set(['pending', 'running']);

const sortApplyLogs = (logs: NginxConfigApplyLog[] = []) => {
  return [...logs].sort((left, right) => {
    if (left.step !== right.step) {
      return left.step - right.step;
    }
    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  });
};

const ApplyHistoryDrawer = ({
  configId,
  initialApplyId = null,
  open,
  onClose,
}: ApplyHistoryDrawerProps) => {
  const [historyLoading, setHistoryLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [applies, setApplies] = useState<NginxConfigApply[]>([]);
  const [activeApplyId, setActiveApplyId] = useState<number | null>(initialApplyId);
  const [activeApply, setActiveApply] = useState<NginxConfigApply | null>(null);

  const loadHistory = async () => {
    if (!configId) return;
    try {
      setHistoryLoading(true);
      const response = await getApplyHistory(configId, { page: 1, page_size: 20 });
      const nextApplies = response.applies || [];
      setApplies(nextApplies);
      setActiveApplyId((currentId) => {
        if (initialApplyId && nextApplies.some((item) => item.id === initialApplyId)) {
          return initialApplyId;
        }
        if (currentId && nextApplies.some((item) => item.id === currentId)) {
          return currentId;
        }
        return nextApplies[0]?.id ?? null;
      });
    } catch (error) {
      console.error('加载配置应用历史失败', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadApplyDetail = async (applyId: number) => {
    try {
      setDetailLoading(true);
      const detail = await getApplyDetail(applyId);
      setActiveApply({
        ...detail,
        logs: sortApplyLogs(detail.logs),
      });
    } catch (error) {
      console.error('加载配置应用详情失败', error);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !configId) return;
    void loadHistory();
  }, [configId, open, initialApplyId]);

  useEffect(() => {
    if (!open) {
      setApplies([]);
      setActiveApply(null);
      setActiveApplyId(initialApplyId);
      return;
    }
    if (!activeApplyId) {
      setActiveApply(null);
      return;
    }
    void loadApplyDetail(activeApplyId);
  }, [activeApplyId, initialApplyId, open]);

  useEffect(() => {
    if (!open || !configId || !activeApplyId || !activeApply || !POLLABLE_STATUSES.has(activeApply.status)) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadHistory();
      void loadApplyDetail(activeApplyId);
    }, 2500);

    return () => window.clearInterval(timer);
  }, [activeApply, activeApplyId, configId, open]);

  const currentLogs = useMemo(() => sortApplyLogs(activeApply?.logs), [activeApply?.logs]);

  const renderTerminalContent = () => {
    if (detailLoading && !activeApply) {
      return '正在加载应用日志...';
    }
    if (!currentLogs.length) {
      return activeApply && POLLABLE_STATUSES.has(activeApply.status) ? '等待应用日志...' : '暂无应用日志';
    }

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

  return (
    <Drawer
      title="配置应用记录"
      open={open}
      onClose={onClose}
      width={980}
      extra={(
        <ActionGroup>
          <Button icon={<ReloadOutlined />} onClick={() => { void loadHistory(); if (activeApplyId) void loadApplyDetail(activeApplyId); }}>
            刷新记录
          </Button>
        </ActionGroup>
      )}
    >
      <div className="page-stack" style={{ gap: 16 }}>
        {!historyLoading && applies.length === 0 ? (
          <EmptyState
            title="还没有配置应用记录"
            description="把配置应用到服务器后，这里会显示执行状态、目标服务器和步骤日志。"
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr)', gap: 16 }}>
            <SectionCard title="最近应用记录" subtitle="按时间倒序查看最近一次配置应用。">
              <div style={{ padding: 12, display: 'grid', gap: 10 }}>
                {historyLoading && !applies.length ? <Spin tip="正在加载应用记录..." /> : null}
                {applies.map((apply) => {
                  const isActive = apply.id === activeApplyId;
                  return (
                    <button
                      key={apply.id}
                      type="button"
                      onClick={() => setActiveApplyId(apply.id)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 14,
                        border: isActive ? '1px solid var(--border-strong)' : '1px solid var(--border-color)',
                        background: isActive ? 'var(--panel-highlight)' : 'var(--bg-muted)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                        <strong style={{ fontSize: 13 }}>{apply.server?.name || `服务器 #${apply.server_id}`}</strong>
                        <StatusBadge status={apply.status} compact />
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>{apply.target_path}</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>{formatDateTime(apply.created_at, 'YYYY-MM-DD HH:mm:ss')}</div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <div className="page-stack" style={{ gap: 16 }}>
              <SectionCard
                title={activeApply ? `应用详情 · ${activeApply.server?.name || `服务器 #${activeApply.server_id}`}` : '应用详情'}
                subtitle="查看配置应用的状态、目标信息和最终结果。"
              >
                {detailLoading && !activeApply ? (
                  <div style={{ padding: 24 }}><Spin tip="正在加载应用详情..." /></div>
                ) : activeApply ? (
                  <div style={{ padding: 12 }}>
                    <div className="resource-summary">
                      <div className="summary-card">
                        <div className="summary-card__label">当前状态</div>
                        <div style={{ marginTop: 10 }}><StatusBadge status={activeApply.status} /></div>
                        {activeApply.error_msg ? <div className="summary-card__hint">{activeApply.error_msg}</div> : null}
                      </div>
                      <div className="summary-card">
                        <div className="summary-card__label">目标服务器</div>
                        <div className="summary-card__value" style={{ fontSize: 18 }}>{activeApply.server?.name || `服务器 #${activeApply.server_id}`}</div>
                        <div className="summary-card__hint">{activeApply.server?.host || '未填写地址'}</div>
                      </div>
                      <div className="summary-card">
                        <div className="summary-card__label">配置路径</div>
                        <div className="summary-card__value" style={{ fontSize: 18 }}>{activeApply.target_path}</div>
                        <div className="summary-card__hint">
                          {activeApply.duration ? `执行耗时 ${formatDuration(activeApply.duration)}` : '执行中时会持续更新'}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', color: 'var(--text-secondary)' }}>
                      <span>创建时间：{formatDateTime(activeApply.created_at, 'YYYY-MM-DD HH:mm:ss')}</span>
                      {activeApply.start_time ? <span>开始时间：{formatDateTime(activeApply.start_time, 'YYYY-MM-DD HH:mm:ss')}</span> : null}
                      {activeApply.end_time ? <span>结束时间：{formatDateTime(activeApply.end_time, 'YYYY-MM-DD HH:mm:ss')}</span> : null}
                    </div>
                  </div>
                ) : (
                  <EmptyState title="请选择一条应用记录" description="左侧会列出最近的配置应用记录，点击后即可查看详情和日志。" />
                )}
              </SectionCard>

              <TerminalPanel
                title="应用日志"
                subtitle={activeApply && POLLABLE_STATUSES.has(activeApply.status) ? '正在轮询最新日志和状态。' : '这里显示本次配置应用保存下来的步骤日志。'}
                meta={<span className="summary-card__hint">共 {currentLogs.length} 条日志</span>}
                htmlContent={renderTerminalContent()}
                height={460}
              />
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default ApplyHistoryDrawer;
