import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, message, Popconfirm, Row, Col, Empty } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  ClusterOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { getClusterList, deleteCluster, deployCluster, initCluster } from '../api/redisCluster';
import type { RedisCluster } from '../types';
import PageHeader from '../components/common/PageHeader';
import ActionGroup from '../components/common/ActionGroup';
import SectionCard from '../components/common/SectionCard';

/* ── 状态配置 ────────────────────────────────── */
const statusConfig: Record<string, {
  label: string;
  dotColor: string;
  borderColor: string;
  pulse: boolean;
}> = {
  pending:      { label: '待部署',   dotColor: '#71717a', borderColor: 'rgba(113,113,122,0.3)',   pulse: false },
  deploying:    { label: '部署中',   dotColor: '#3b82f6', borderColor: 'rgba(59,130,246,0.4)',    pulse: true  },
  deployed:     { label: '已部署',   dotColor: '#06b6d4', borderColor: 'rgba(6,182,212,0.35)',    pulse: false },
  initializing: { label: '初始化中', dotColor: '#a855f7', borderColor: 'rgba(168,85,247,0.4)',    pulse: true  },
  running:      { label: '运行中',   dotColor: '#22c55e', borderColor: 'rgba(34,197,94,0.4)',     pulse: true  },
  failed:       { label: '失败',     dotColor: '#ef4444', borderColor: 'rgba(239,68,68,0.4)',     pulse: false },
};

/* ── 迷你拓扑图 ─────────────────────────────── */
function MiniTopology({ mode }: { mode: string }) {
  const is3x2 = mode === '3x2';
  const nodeStyle = (role: 'master' | 'replica'): React.CSSProperties => ({
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: role === 'master' ? '#6366f1' : '#22c55e',
    flexShrink: 0,
  });

  if (is3x2) {
    // 3 列，每列 master + replica
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <div style={nodeStyle('master')} title="Master" />
            <div style={{ width: 1, height: 6, background: 'var(--border-strong)' }} />
            <div style={nodeStyle('replica')} title="Replica" />
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>3×2</div>
      </div>
    );
  }

  // 6×1：6 节点横排，交替 master/replica
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2, 3, 4, 5].map(i => (
        <div key={i} style={nodeStyle(i < 3 ? 'master' : 'replica')} title={i < 3 ? 'Master' : 'Replica'} />
      ))}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 4 }}>6×1</div>
    </div>
  );
}

/* ── 状态脉冲圆点 ────────────────────────────── */
function StatusDot({ status }: { status: string }) {
  const cfg = statusConfig[status] || statusConfig.pending;
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {cfg.pulse && (
        <span style={{
          position: 'absolute',
          width: 10, height: 10,
          borderRadius: '50%',
          background: cfg.dotColor,
          opacity: 0.4,
          animation: 'pulse-ring 2s ease-out infinite',
        }} />
      )}
      <span style={{
        width: 8, height: 8,
        borderRadius: '50%',
        background: cfg.dotColor,
        display: 'inline-block',
        position: 'relative',
      }} />
      <span style={{ marginLeft: 6, fontSize: 12, color: cfg.dotColor, fontWeight: 500 }}>{cfg.label}</span>
    </span>
  );
}

/* ── 统计卡片 ────────────────────────────────── */
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      padding: '14px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 36, height: 36,
        borderRadius: 8,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, fontSize: 16,
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: 'var(--text-primary)' }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

/* ── 主组件 ──────────────────────────────────── */
export default function RedisClusterList() {
  const navigate = useNavigate();
  const [clusters, setClusters] = useState<RedisCluster[]>([]);
  const [loading, setLoading] = useState(false);

  const loadClusters = async () => {
    setLoading(true);
    try {
      const data = await getClusterList();
      setClusters(Array.isArray(data) ? data : []);
    } catch (error: any) {
      message.error(error.message || '加载集群列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadClusters(); }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteCluster(id);
      message.success('集群已删除');
      loadClusters();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleDeploy = async (id: number, autoInit: boolean) => {
    try {
      await deployCluster(id, autoInit);
      message.success(autoInit ? '一键部署并初始化已启动' : '集群部署已启动');
      loadClusters();
    } catch (error: any) {
      message.error(error.message || '部署失败');
    }
  };

  const handleInit = async (id: number) => {
    try {
      await initCluster(id);
      message.success('集群初始化已启动');
      loadClusters();
    } catch (error: any) {
      message.error(error.message || '初始化失败');
    }
  };

  // 统计数据
  const stats = {
    total:       clusters.length,
    running:     clusters.filter(c => c.status === 'running').length,
    deploying:   clusters.filter(c => c.status === 'deploying' || c.status === 'initializing').length,
    failed:      clusters.filter(c => c.status === 'failed').length,
  };

  return (
    <>
      {/* 脉冲动画全局样式（内联注入，避免修改 CSS 文件）*/}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.4; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        .cluster-card {
          transition: transform var(--motion-fast) var(--ease-out-quart),
                      box-shadow var(--motion-fast) var(--ease-out-quart);
          cursor: pointer;
        }
        .cluster-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        }
      `}</style>

      <div className="page-stack">
        <PageHeader
          eyebrow="Redis 集群"
          title="Redis 集群管理"
          subtitle="创建和管理 Redis Cluster 集群（3 主 3 从），支持 3×2 和 6×1 两种拓扑模式。"
          actions={
            <ActionGroup>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={loadClusters}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/middleware/redis/clusters/new')}>
                创建集群
              </Button>
            </ActionGroup>
          }
        />

        {/* 统计条 */}
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={6}><StatCard label="总集群" value={stats.total} icon={<ClusterOutlined />} color="#6366f1" /></Col>
          <Col xs={12} sm={6}><StatCard label="运行中" value={stats.running} icon={<CheckCircleOutlined />} color="#22c55e" /></Col>
          <Col xs={12} sm={6}><StatCard label="部署中" value={stats.deploying} icon={<LoadingOutlined />} color="#3b82f6" /></Col>
          <Col xs={12} sm={6}><StatCard label="失败" value={stats.failed} icon={<ExclamationCircleOutlined />} color="#ef4444" /></Col>
        </Row>

        <SectionCard title="集群列表" subtitle="所有 Redis 集群及其当前状态">
          {clusters.length === 0 && !loading ? (
            <Empty
              description={<span style={{ color: 'var(--text-secondary)' }}>暂无集群，创建第一个 Redis 集群</span>}
              style={{ padding: '40px 0' }}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/middleware/redis/clusters/new')}>
                创建第一个集群
              </Button>
            </Empty>
          ) : (
            <Row gutter={[16, 16]}>
              {clusters.map((cluster) => {
                const cfg = statusConfig[cluster.status] || statusConfig.pending;
                return (
                  <Col xs={24} sm={12} xl={8} key={cluster.id}>
                    <div
                      className="cluster-card"
                      style={{
                        border: `1px solid ${cfg.borderColor}`,
                        borderRadius: 12,
                        padding: 20,
                        background: 'var(--bg-elevated)',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onClick={() => navigate(`/middleware/redis/clusters/${cluster.id}`)}
                    >
                      {/* 顶部渐变光晕 */}
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                        background: `linear-gradient(90deg, transparent, ${cfg.dotColor}, transparent)`,
                        opacity: 0.8,
                      }} />

                      {/* 标题行 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 2 }}>
                            {cluster.name}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                            Redis {cluster.version || '—'}
                          </div>
                        </div>
                        <StatusDot status={cluster.status} />
                      </div>

                      {/* 拓扑图 */}
                      <div style={{
                        background: 'var(--bg-tertiary)',
                        borderRadius: 8,
                        padding: '10px 14px',
                        marginBottom: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}>
                        <MiniTopology mode={cluster.cluster_mode} />
                        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {cluster.total_nodes} 节点
                        </div>
                      </div>

                      {/* 图例说明 */}
                      <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: 11, color: 'var(--text-tertiary)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
                          主节点
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                          从节点
                        </span>
                        <span style={{ marginLeft: 'auto' }}>
                          {cluster.has_password ? '🔒 已加密' : '无密码'}
                        </span>
                      </div>

                      {/* 错误提示 */}
                      {cluster.error_msg && (
                        <div style={{
                          fontSize: 12,
                          color: '#ef4444',
                          background: 'rgba(239,68,68,0.08)',
                          border: '1px solid rgba(239,68,68,0.2)',
                          borderRadius: 6,
                          padding: '6px 10px',
                          marginBottom: 12,
                          lineHeight: 1.5,
                        }}>
                          {cluster.error_msg}
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                        <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/middleware/redis/clusters/${cluster.id}`)}>
                          详情
                        </Button>
                        {cluster.status === 'pending' && (
                          <>
                            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleDeploy(cluster.id, false)}>
                              部署
                            </Button>
                            <Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleDeploy(cluster.id, true)}>
                              一键部署
                            </Button>
                          </>
                        )}
                        {cluster.status === 'deployed' && (
                          <Button size="small" type="primary" icon={<ThunderboltOutlined />} onClick={() => handleInit(cluster.id)}>
                            初始化集群
                          </Button>
                        )}
                        {cluster.status === 'failed' && (
                          <>
                            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleDeploy(cluster.id, false)}>
                              重新部署
                            </Button>
                            <Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleInit(cluster.id)}>
                              重新初始化
                            </Button>
                          </>
                        )}
                        {(cluster.status === 'pending' || cluster.status === 'failed') && (
                          <Popconfirm title="确定删除此集群？" onConfirm={() => handleDelete(cluster.id)} okText="删除" cancelText="取消">
                            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                          </Popconfirm>
                        )}
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
          )}
        </SectionCard>
      </div>
    </>
  );
}
