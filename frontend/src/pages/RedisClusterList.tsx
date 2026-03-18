import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Tag, message, Popconfirm, Row, Col, Empty, Spin } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { getClusterList, deleteCluster, deployCluster, initCluster } from '../api/redisCluster';
import type { RedisCluster } from '../types';
import PageHeader from '../components/common/PageHeader';
import ActionGroup from '../components/common/ActionGroup';
import SectionCard from '../components/common/SectionCard';

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待部署' },
  deploying: { color: 'processing', label: '部署中' },
  deployed: { color: 'cyan', label: '已部署' },
  initializing: { color: 'processing', label: '初始化中' },
  running: { color: 'success', label: '运行中' },
  failed: { color: 'error', label: '失败' },
};

const modeLabels: Record<string, string> = {
  '3x2': '3 主机 × 2 端口',
  '6x1': '6 主机 × 1 端口',
};

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

  useEffect(() => {
    loadClusters();
  }, []);

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

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Redis 集群"
        title="Redis 集群管理"
        subtitle="创建和管理 Redis Cluster 集群（3 主 3 从），支持 3x2 和 6x1 两种拓扑模式。"
        actions={
          <ActionGroup>
            <Button icon={<ReloadOutlined />} onClick={loadClusters}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/middleware/redis/clusters/new')}>
              创建集群
            </Button>
          </ActionGroup>
        }
      />

      <SectionCard title="集群列表" subtitle="所有 Redis 集群及其状态" className="ops-table">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : clusters.length === 0 ? (
          <Empty description="暂无集群">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/middleware/redis/clusters/new')}>
              创建第一个集群
            </Button>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {clusters.map((cluster) => {
              const st = statusMap[cluster.status] || statusMap.pending;
              return (
                <Col xs={24} sm={12} lg={8} key={cluster.id}>
                  <div
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: 12,
                      padding: 20,
                      background: 'var(--bg-elevated)',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/middleware/redis/clusters/${cluster.id}`)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <strong style={{ fontSize: 16 }}>{cluster.name}</strong>
                      <Tag color={st.color}>{st.label}</Tag>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 8 }}>
                      <CloudServerOutlined style={{ marginRight: 6 }} />
                      模式: {modeLabels[cluster.cluster_mode] || cluster.cluster_mode}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 12 }}>
                      版本: Redis {cluster.version} · 节点数: {cluster.total_nodes}
                    </div>
                    {cluster.error_msg && (
                      <div style={{ color: 'var(--color-error)', fontSize: 12, marginBottom: 8 }}>
                        {cluster.error_msg}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
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
  );
}
