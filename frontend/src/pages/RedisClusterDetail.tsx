import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Table, message, Popconfirm, Spin, Alert, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined, PlayCircleOutlined, ThunderboltOutlined,
  ReloadOutlined, DeleteOutlined, CopyOutlined, LoadingOutlined,
  ClusterOutlined, NodeIndexOutlined, SafetyCertificateOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { getCluster, deleteCluster, deployCluster, initCluster, getClusterStatus } from '../api/redisCluster';
import type { RedisCluster, RedisClusterNode } from '../types';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import ActionGroup from '../components/common/ActionGroup';

/* ── 状态配置 ────────────────────────────────── */
const statusConfig: Record<string, { label: string; dotColor: string; pulse: boolean }> = {
  pending:      { label: '待部署',   dotColor: '#71717a', pulse: false },
  deploying:    { label: '部署中',   dotColor: '#3b82f6', pulse: true  },
  deployed:     { label: '已部署',   dotColor: '#06b6d4', pulse: false },
  initializing: { label: '初始化中', dotColor: '#a855f7', pulse: true  },
  running:      { label: '运行中',   dotColor: '#22c55e', pulse: true  },
  failed:       { label: '失败',     dotColor: '#ef4444', pulse: false },
  success:      { label: '成功',     dotColor: '#22c55e', pulse: false },
};

function StatusBadge({ status, large }: { status: string; large?: boolean }) {
  const cfg = statusConfig[status] || statusConfig.pending;
  const size = large ? 10 : 7;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, position: 'relative' }}>
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        {cfg.pulse && (
          <span style={{
            position: 'absolute',
            width: size, height: size,
            borderRadius: '50%',
            background: cfg.dotColor, opacity: 0.4,
            animation: 'cluster-pulse 2s ease-out infinite',
          }} />
        )}
        <span style={{ width: size, height: size, borderRadius: '50%', background: cfg.dotColor, display: 'inline-block', position: 'relative' }} />
      </span>
      <span style={{ color: cfg.dotColor, fontWeight: large ? 600 : 500, fontSize: large ? 14 : 12 }}>{cfg.label}</span>
    </span>
  );
}

/* ── 节点角色标签 ────────────────────────────── */
function RoleBadge({ role }: { role: string }) {
  if (role === 'master') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4,
      background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)',
      color: '#818cf8', fontSize: 11, fontWeight: 600,
    }}>主节点</span>
  );
  if (role === 'replica') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4,
      background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
      color: '#4ade80', fontSize: 11, fontWeight: 600,
    }}>从节点</span>
  );
  return <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>待分配</span>;
}

/* ── 信息卡片 ────────────────────────────────── */
function InfoCard({ icon, label, value, color = '#6366f1' }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; color?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: `${color}18`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</div>
      </div>
    </div>
  );
}

/* ── 主组件 ──────────────────────────────────── */
export default function RedisClusterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cluster, setCluster] = useState<RedisCluster | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCluster = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getCluster(Number(id));
      setCluster(data);
    } catch (error: any) {
      message.error(error.message || '加载集群详情失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const refreshStatus = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getClusterStatus(Number(id));
      setCluster(data);
    } catch (error: any) {
      message.error(error.message || '刷新状态失败');
    }
  }, [id]);

  useEffect(() => { loadCluster(); }, [loadCluster]);

  useEffect(() => {
    if (!cluster) return;
    if (cluster.status === 'deploying' || cluster.status === 'initializing') {
      const timer = setInterval(refreshStatus, 5000);
      return () => clearInterval(timer);
    }
  }, [cluster?.status, refreshStatus]);

  const handleDeploy = async (autoInit: boolean) => {
    try {
      await deployCluster(Number(id), autoInit);
      message.success(autoInit ? '一键部署已启动' : '部署已启动');
      refreshStatus();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const handleInit = async () => {
    try {
      await initCluster(Number(id));
      message.success('集群初始化已启动');
      refreshStatus();
    } catch (error: any) {
      message.error(error.message || '初始化失败');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCluster(Number(id));
      message.success('集群已删除');
      navigate('/middleware/redis/clusters');
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const copyNodeId = (nodeId: string) => {
    navigator.clipboard?.writeText(nodeId).then(() => message.success('节点 ID 已复制'));
  };

  const nodeColumns: ColumnsType<RedisClusterNode> = [
    {
      title: '服务器',
      key: 'server',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>
            {record.server?.name || `Server #${record.server_id}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {record.server?.host}
          </div>
        </div>
      ),
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
      render: (port: number) => (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12,
          background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4,
          color: 'var(--text-secondary)',
        }}>:{port}</span>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 90,
      render: (role: string) => <RoleBadge role={role} />,
    },
    {
      title: '节点 ID',
      dataIndex: 'node_id',
      key: 'node_id',
      render: (v: string) => v ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
            {v.substring(0, 8)}…
          </span>
          <Tooltip title="复制完整节点 ID">
            <CopyOutlined
              style={{ fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer' }}
              onClick={() => copyNodeId(v)}
            />
          </Tooltip>
        </div>
      ) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <StatusBadge status={status} />,
    },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }
  if (!cluster) {
    return <div style={{ textAlign: 'center', padding: 80, color: 'var(--text-secondary)' }}>集群不存在</div>;
  }

  const isActive = cluster.status === 'deploying' || cluster.status === 'initializing';
  const masterNodes = cluster.nodes?.filter(n => n.role === 'master') || [];
  const replicaNodes = cluster.nodes?.filter(n => n.role === 'replica') || [];

  return (
    <>
      <style>{`
        @keyframes cluster-pulse {
          0%   { transform: scale(1);   opacity: 0.4; }
          100% { transform: scale(2.8); opacity: 0; }
        }
      `}</style>

      <div className="page-stack">
        <PageHeader
          eyebrow="Redis 集群"
          title={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              {cluster.name}
              <StatusBadge status={cluster.status} large />
              {isActive && <LoadingOutlined style={{ color: '#6366f1', fontSize: 16 }} spin />}
            </span>
          }
          subtitle={`${cluster.cluster_mode === '3x2' ? '3台×2端口' : '6台×1端口'} · Redis ${cluster.version} · ${cluster.total_nodes} 个节点`}
          actions={
            <ActionGroup>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/middleware/redis/clusters')}>返回</Button>
              <Button icon={<ReloadOutlined />} onClick={refreshStatus}>刷新</Button>
              {(cluster.status === 'pending' || cluster.status === 'failed') && (
                <>
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => handleDeploy(false)}>部署</Button>
                  <Button icon={<ThunderboltOutlined />} onClick={() => handleDeploy(true)}>一键部署</Button>
                </>
              )}
              {cluster.status === 'deployed' && (
                <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleInit}>初始化集群</Button>
              )}
              {(cluster.status === 'pending' || cluster.status === 'failed') && (
                <Popconfirm title="确定删除此集群？" onConfirm={handleDelete} okText="删除" cancelText="取消">
                  <Button danger icon={<DeleteOutlined />}>删除</Button>
                </Popconfirm>
              )}
            </ActionGroup>
          }
        />

        {cluster.error_msg && (
          <Alert message="错误信息" description={cluster.error_msg} type="error" showIcon />
        )}

        {isActive && (
          <Alert
            message={cluster.status === 'deploying' ? '集群节点正在部署中，页面每 5 秒自动刷新…' : '集群正在初始化，执行 redis-cli --cluster create…'}
            type="info"
            showIcon
            icon={<LoadingOutlined spin />}
          />
        )}

        {/* 信息卡片网格 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <InfoCard icon={<ClusterOutlined />} label="集群模式" value={cluster.cluster_mode === '3x2' ? '3×2 模式' : '6×1 模式'} color="#6366f1" />
          <InfoCard icon={<NodeIndexOutlined />} label="Redis 版本" value={cluster.version || '—'} color="#8b5cf6" />
          <InfoCard icon={<CheckCircleOutlined />} label="总节点数" value={`${cluster.total_nodes} 个`} color="#22c55e" />
          <InfoCard icon={<ClusterOutlined />} label="主节点" value={`${masterNodes.length} 个`} color="#6366f1" />
          <InfoCard icon={<NodeIndexOutlined />} label="从节点" value={`${replicaNodes.length} 个`} color="#4ade80" />
          <InfoCard icon={<SafetyCertificateOutlined />} label="访问密码" value={cluster.has_password ? '已设置' : '未设置'} color={cluster.has_password ? '#f59e0b' : '#71717a'} />
        </div>

        {/* 节点列表 */}
        <SectionCard
          title="节点列表"
          subtitle={
            <span style={{ display: 'inline-flex', gap: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#818cf8' }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: '#818cf8', display: 'inline-block' }} />
                主节点 {masterNodes.length}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4ade80' }}>
                <span style={{ width: 6, height: 6, borderRadius: 2, background: '#4ade80', display: 'inline-block' }} />
                从节点 {replicaNodes.length}
              </span>
            </span>
          }
          className="ops-table"
        >
          <Table
            columns={nodeColumns}
            dataSource={cluster.nodes || []}
            rowKey="id"
            pagination={false}
            size="middle"
            rowClassName={(record) =>
              record.role === 'master' ? 'node-row-master' : record.role === 'replica' ? 'node-row-replica' : ''
            }
          />
          <style>{`
            .node-row-master td:first-child { border-left: 2px solid #6366f1 !important; }
            .node-row-replica td:first-child { border-left: 2px solid #22c55e !important; }
          `}</style>
        </SectionCard>
      </div>
    </>
  );
}
