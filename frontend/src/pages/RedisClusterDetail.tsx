import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Tag, Descriptions, Table, message, Popconfirm, Spin, Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined, PlayCircleOutlined, ThunderboltOutlined,
  ReloadOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { getCluster, deleteCluster, deployCluster, initCluster, getClusterStatus } from '../api/redisCluster';
import type { RedisCluster, RedisClusterNode } from '../types';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';
import ActionGroup from '../components/common/ActionGroup';

const statusMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待部署' },
  deploying: { color: 'processing', label: '部署中' },
  deployed: { color: 'cyan', label: '已部署' },
  initializing: { color: 'processing', label: '初始化中' },
  running: { color: 'success', label: '运行中' },
  failed: { color: 'error', label: '失败' },
  success: { color: 'success', label: '成功' },
};

const roleMap: Record<string, { color: string; label: string }> = {
  pending: { color: 'default', label: '待分配' },
  master: { color: 'blue', label: '主节点' },
  replica: { color: 'green', label: '从节点' },
};

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

  const refreshStatus = async () => {
    if (!id) return;
    try {
      const data = await getClusterStatus(Number(id));
      setCluster(data);
    } catch (error: any) {
      message.error(error.message || '刷新状态失败');
    }
  };

  useEffect(() => {
    loadCluster();
  }, [loadCluster]);

  // 部署/初始化中自动刷新
  useEffect(() => {
    if (!cluster) return;
    if (cluster.status === 'deploying' || cluster.status === 'initializing') {
      const timer = setInterval(refreshStatus, 5000);
      return () => clearInterval(timer);
    }
  }, [cluster?.status]);

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

  const nodeColumns: ColumnsType<RedisClusterNode> = [
    {
      title: '服务器',
      key: 'server',
      render: (_, record) => record.server ? `${record.server.name} (${record.server.host})` : `Server #${record.server_id}`,
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      render: (port: number) => <Tag>{port}</Tag>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        const r = roleMap[role] || roleMap.pending;
        return <Tag color={r.color}>{r.label}</Tag>;
      },
    },
    {
      title: '节点 ID',
      dataIndex: 'node_id',
      key: 'node_id',
      render: (v: string) => v ? <span className="mono" style={{ fontSize: 12 }}>{v.substring(0, 12)}...</span> : '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const st = statusMap[status] || statusMap.pending;
        return <Tag color={st.color}>{st.label}</Tag>;
      },
    },
  ];

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (!cluster) {
    return <div style={{ textAlign: 'center', padding: 80 }}>集群不存在</div>;
  }

  const st = statusMap[cluster.status] || statusMap.pending;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Redis 集群"
        title={cluster.name}
        subtitle={`模式: ${cluster.cluster_mode === '3x2' ? '3台×2端口' : '6台×1端口'} · Redis ${cluster.version}`}
        actions={
          <ActionGroup>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/middleware/redis/clusters')}>返回</Button>
            <Button icon={<ReloadOutlined />} onClick={refreshStatus}>刷新状态</Button>
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
        <Alert message="错误信息" description={cluster.error_msg} type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      <SectionCard title="集群信息">
        <Descriptions bordered column={2}>
          <Descriptions.Item label="集群名称">{cluster.name}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={st.color}>{st.label}</Tag></Descriptions.Item>
          <Descriptions.Item label="集群模式">{cluster.cluster_mode === '3x2' ? '3台×2端口' : '6台×1端口'}</Descriptions.Item>
          <Descriptions.Item label="Redis 版本">{cluster.version}</Descriptions.Item>
          <Descriptions.Item label="总节点数">{cluster.total_nodes}</Descriptions.Item>
          <Descriptions.Item label="密码">{cluster.has_password ? '已设置' : '未设置'}</Descriptions.Item>
        </Descriptions>
      </SectionCard>

      <SectionCard title="节点列表" subtitle={`共 ${cluster.nodes?.length || 0} 个节点`} className="ops-table">
        <Table
          columns={nodeColumns}
          dataSource={cluster.nodes || []}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </SectionCard>
    </div>
  );
}
