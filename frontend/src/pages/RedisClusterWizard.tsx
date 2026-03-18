import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Steps, Button, Form, Input, Select, InputNumber,
  Row, Col, message, Space, Descriptions, Alert,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined,
  ClusterOutlined, CheckOutlined, LockOutlined, UnlockOutlined,
  DeploymentUnitOutlined,
} from '@ant-design/icons';
import { getServerList } from '../api/server';
import { getPackageList } from '../api/package';
import { createCluster } from '../api/redisCluster';
import type { Server, MiddlewarePackage, CreateClusterDTO } from '../types';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';

const { Option } = Select;

/* ── 拓扑预览图 ────────────────────────────── */
function TopologyPreview({ mode }: { mode: '3x2' | '6x1' }) {
  const nodeBase: React.CSSProperties = {
    borderRadius: 8,
    padding: '6px 14px',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 4, fontWeight: 600, letterSpacing: 0.3,
  };
  const masterStyle: React.CSSProperties = {
    ...nodeBase,
    background: 'rgba(99,102,241,0.18)',
    border: '1px solid rgba(99,102,241,0.4)',
    color: '#818cf8',
  };
  const replicaStyle: React.CSSProperties = {
    ...nodeBase,
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#4ade80',
  };
  const connLine: React.CSSProperties = {
    width: 1, height: 16, background: 'var(--border-strong)',
    margin: '0 auto',
  };

  if (mode === '3x2') {
    return (
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            <div style={masterStyle}><span>M</span> :{6999 + i}</div>
            <div style={connLine} />
            <div style={replicaStyle}><span>R</span> :{7099 + i}</div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={masterStyle}><span>M</span> :700{i}</div>
      ))}
      <div style={{ width: '100%', height: 0 }} />
      {[4, 5, 6].map(i => (
        <div key={i} style={replicaStyle}><span>R</span> :700{i}</div>
      ))}
    </div>
  );
}

/* ── 密码强度指示 ───────────────────────────── */
function PasswordStrength({ value }: { value?: string }) {
  if (!value) return null;
  const strength = value.length < 6 ? 0 : value.length < 10 ? 1 : /[A-Z]/.test(value) && /[0-9]/.test(value) ? 3 : 2;
  const configs = [
    { label: '太弱', color: '#ef4444', width: '25%' },
    { label: '一般', color: '#f59e0b', width: '50%' },
    { label: '较强', color: '#22c55e', width: '75%' },
    { label: '强',   color: '#6366f1', width: '100%' },
  ];
  const cfg = configs[strength];
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ height: 3, background: 'var(--border-color)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: cfg.width, background: cfg.color, transition: 'width 0.3s, background 0.3s', borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 11, color: cfg.color, marginTop: 2, display: 'block' }}>{cfg.label}</span>
    </div>
  );
}

/* ── 主组件 ──────────────────────────────────── */
export default function RedisClusterWizard() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [clusterMode, setClusterMode] = useState<'3x2' | '6x1'>('3x2');
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [packages, setPackages] = useState<MiddlewarePackage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [form] = Form.useForm();
  const [nodeConfigs, setNodeConfigs] = useState<{ server_id: number | null; ports: number[] }[]>([]);

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (clusterMode === '3x2') {
      setNodeConfigs([
        { server_id: null, ports: [7001, 7002] },
        { server_id: null, ports: [7001, 7002] },
        { server_id: null, ports: [7001, 7002] },
      ]);
    } else {
      setNodeConfigs(Array.from({ length: 6 }, (_, i) => ({ server_id: null, ports: [7001 + i] })));
    }
  }, [clusterMode]);

  const loadData = async () => {
    try {
      const [serverData, pkgData] = await Promise.all([
        getServerList(),
        getPackageList({ name: 'redis', page: 1, page_size: 100 }),
      ]);
      setServers(Array.isArray(serverData) ? serverData : (serverData as any)?.servers || []);
      setPackages(pkgData?.packages || []);
    } catch (error: any) {
      message.error(error.message || '加载数据失败');
    }
  };

  const updateNodeConfig = (index: number, field: string, value: any) => {
    setNodeConfigs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      for (let i = 0; i < nodeConfigs.length; i++) {
        if (!nodeConfigs[i].server_id) { message.error(`请为第 ${i + 1} 组节点选择服务器`); return; }
        if (nodeConfigs[i].ports.length === 0) { message.error(`请为第 ${i + 1} 组节点配置端口`); return; }
      }
      if (!selectedPackageId) { message.error('请选择 Redis 离线包'); return; }

      const dto: CreateClusterDTO = {
        name: values.name,
        cluster_mode: clusterMode,
        password: values.password || '',
        package_id: selectedPackageId,
        nodes: nodeConfigs.map(n => ({ server_id: n.server_id!, ports: n.ports })),
      };
      setSubmitting(true);
      await createCluster(dto);
      message.success('集群创建成功');
      navigate('/middleware/redis/clusters');
    } catch (error: any) {
      if (error.message) message.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPkg = packages.find(p => p.id === selectedPackageId);
  const usedServerIds = nodeConfigs.map(n => n.server_id).filter(Boolean);

  /* ── Step 1：模式选择 ── */
  const step1 = (
    <div>
      <div style={{ marginBottom: 20, color: 'var(--text-secondary)', fontSize: 13 }}>
        选择集群拓扑模式。两种模式均为 3 主 3 从，区别在于节点分布方式。
      </div>

      <Row gutter={16} style={{ marginBottom: 28 }}>
        {([
          { mode: '3x2' as const, title: '3×2 模式', sub: '3 台服务器，每台 2 个端口', desc: '适合服务器数量受限的环境，每台服务器同时承载主节点和从节点。' },
          { mode: '6x1' as const, title: '6×1 模式', sub: '6 台服务器，每台 1 个端口', desc: '每台服务器独立运行一个节点，隔离性最好，推荐生产环境使用。' },
        ] as const).map(({ mode, title, sub, desc }) => {
          const selected = clusterMode === mode;
          return (
            <Col span={12} key={mode}>
              <div
                onClick={() => setClusterMode(mode)}
                style={{
                  border: selected ? '1.5px solid var(--color-primary)' : '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: 20,
                  cursor: 'pointer',
                  background: selected ? 'var(--panel-highlight)' : 'var(--bg-elevated)',
                  transition: 'all var(--motion-fast)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {selected && (
                  <div style={{
                    position: 'absolute', top: 12, right: 12,
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'var(--color-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CheckOutlined style={{ color: '#fff', fontSize: 10 }} />
                  </div>
                )}
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--color-primary)', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>{sub}</div>
                <div style={{ marginBottom: 16 }}>
                  <TopologyPreview mode={mode} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</div>
              </div>
            </Col>
          );
        })}
      </Row>

      <div>
        <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 13 }}>Redis 离线包</div>
        <Select
          style={{ width: '100%' }}
          placeholder="选择已上传的 Redis 离线包"
          value={selectedPackageId}
          onChange={setSelectedPackageId}
          size="large"
        >
          {packages.filter(p => p.status === 'active').map(p => (
            <Option key={p.id} value={p.id}>
              {p.display_name || `Redis ${p.version}`} — {p.os_type} {p.os_version}
            </Option>
          ))}
        </Select>
        {selectedPkg && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
            已选: Redis {selectedPkg.version} · {selectedPkg.os_type} {selectedPkg.os_version}
          </div>
        )}
      </div>
    </div>
  );

  /* ── Step 2：节点配置 ── */
  const groupColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#06b6d4'];

  const step2 = (
    <div>
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="集群名称" name="name" rules={[{ required: true, message: '请输入集群名称' }]}>
              <Input placeholder="例如: prod-redis-cluster" size="large" prefix={<ClusterOutlined style={{ color: 'var(--text-tertiary)' }} />} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="集群密码" name="password">
              <Input.Password
                placeholder="留空则不设置密码"
                size="large"
                prefix={passwordValue ? <LockOutlined style={{ color: '#6366f1' }} /> : <UnlockOutlined style={{ color: 'var(--text-tertiary)' }} />}
                onChange={e => setPasswordValue(e.target.value)}
              />
            </Form.Item>
            <PasswordStrength value={passwordValue} />
          </Col>
        </Row>
      </Form>

      <div style={{ fontWeight: 500, marginBottom: 12, fontSize: 13, marginTop: 8 }}>
        节点分配 — 共 {nodeConfigs.length} 组 / {nodeConfigs.reduce((sum, n) => sum + n.ports.length, 0)} 个节点
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {nodeConfigs.map((config, index) => {
          const color = groupColors[index % groupColors.length];
          return (
            <div
              key={index}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '14px 16px',
                background: 'var(--bg-elevated)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                borderLeft: `3px solid ${color}`,
              }}
            >
              {/* 序号 */}
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: `${color}20`,
                border: `1px solid ${color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600, color,
                flexShrink: 0,
              }}>
                {index + 1}
              </div>

              {/* 服务器选择 */}
              <Select
                style={{ flex: 1, minWidth: 180 }}
                placeholder="选择服务器"
                value={config.server_id}
                onChange={v => updateNodeConfig(index, 'server_id', v)}
              >
                {servers.map(s => (
                  <Option
                    key={s.id} value={s.id}
                    disabled={clusterMode === '6x1' && usedServerIds.includes(s.id) && config.server_id !== s.id}
                  >
                    {s.name} ({s.host})
                  </Option>
                ))}
              </Select>

              {/* 端口配置 */}
              <Space wrap size={6}>
                {config.ports.map((port, pi) => (
                  <Space key={pi} size={4}>
                    <InputNumber
                      min={1} max={65535} value={port}
                      onChange={v => {
                        const newPorts = [...config.ports];
                        newPorts[pi] = v || 7001;
                        updateNodeConfig(index, 'ports', newPorts);
                      }}
                      style={{ width: 88 }}
                      prefix={<span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>:</span>}
                    />
                    {config.ports.length > 1 && (
                      <Button size="small" type="text" danger icon={<DeleteOutlined />}
                        onClick={() => updateNodeConfig(index, 'ports', config.ports.filter((_, i) => i !== pi))}
                      />
                    )}
                  </Space>
                ))}
                {clusterMode === '3x2' && config.ports.length < 2 && (
                  <Button size="small" icon={<PlusOutlined />}
                    onClick={() => updateNodeConfig(index, 'ports', [...config.ports, 7002])}>
                    添加端口
                  </Button>
                )}
              </Space>
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── Step 3：确认 ── */
  const step3 = (
    <div>
      <Alert
        message="配置已就绪，确认无误后点击「创建集群」"
        type="success"
        showIcon
        style={{ marginBottom: 20 }}
      />

      {/* 集群拓扑预览 */}
      <div style={{
        background: 'var(--bg-tertiary)',
        borderRadius: 10,
        padding: 20,
        marginBottom: 20,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>集群拓扑预览</div>
        <TopologyPreview mode={clusterMode} />
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
          <span style={{ fontSize: 11, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#818cf8', display: 'inline-block' }} /> 主节点 (3)
          </span>
          <span style={{ fontSize: 11, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: '#4ade80', display: 'inline-block' }} /> 从节点 (3)
          </span>
        </div>
      </div>

      <Descriptions bordered column={2} size="small">
        <Descriptions.Item label="集群名称">{form.getFieldValue('name') || '—'}</Descriptions.Item>
        <Descriptions.Item label="集群模式">{clusterMode === '3x2' ? '3×2（3台×2端口）' : '6×1（6台×1端口）'}</Descriptions.Item>
        <Descriptions.Item label="Redis 版本">{selectedPkg?.version || '—'}</Descriptions.Item>
        <Descriptions.Item label="离线包">{selectedPkg?.display_name || selectedPkg?.version || '—'}</Descriptions.Item>
        <Descriptions.Item label="访问密码">{form.getFieldValue('password') ? '已设置' : <span style={{ color: 'var(--text-tertiary)' }}>未设置</span>}</Descriptions.Item>
        <Descriptions.Item label="总节点数">6</Descriptions.Item>
      </Descriptions>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 10 }}>节点分配明细</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {nodeConfigs.map((config, index) => {
            const server = servers.find(s => s.id === config.server_id);
            const color = groupColors[index % groupColors.length];
            return (
              <div key={index} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px',
                background: 'var(--bg-tertiary)',
                borderRadius: 8,
                fontSize: 13,
                borderLeft: `2px solid ${color}`,
              }}>
                <span style={{ color, fontWeight: 600, minWidth: 48, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  组 {index + 1}
                </span>
                <span style={{ color: 'var(--text-primary)', flex: 1 }}>
                  {server ? `${server.name} (${server.host})` : <span style={{ color: '#ef4444' }}>未选择服务器</span>}
                </span>
                <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  :{config.ports.join(', :')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const steps = [
    { title: '选择模式', icon: <DeploymentUnitOutlined />, content: step1 },
    { title: '节点配置', icon: <ClusterOutlined />,      content: step2 },
    { title: '确认创建', icon: <CheckOutlined />,         content: step3 },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Redis 集群"
        title="创建 Redis 集群"
        subtitle="按步骤配置 3 主 3 从 Redis Cluster 集群"
        actions={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/middleware/redis/clusters')}>
            返回列表
          </Button>
        }
      />

      <SectionCard>
        {/* 自定义步骤条 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, padding: '0 8px' }}>
          {steps.map((step, index) => {
            const state = index < current ? 'done' : index === current ? 'active' : 'pending';
            const color = state === 'done' ? '#22c55e' : state === 'active' ? '#6366f1' : 'var(--text-tertiary)';
            return (
              <div key={index} style={{ display: 'flex', alignItems: 'center', flex: index < steps.length - 1 ? 1 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: `2px solid ${color}`,
                    background: state === 'active' ? 'rgba(99,102,241,0.15)' : state === 'done' ? 'rgba(34,197,94,0.15)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color, fontSize: 14, fontWeight: 600,
                    transition: 'all 0.3s',
                  }}>
                    {state === 'done' ? <CheckOutlined /> : index + 1}
                  </div>
                  <span style={{ fontSize: 12, color, fontWeight: state === 'active' ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, marginBottom: 20, marginLeft: 8, marginRight: 8,
                    background: index < current ? '#22c55e' : 'var(--border-color)',
                    transition: 'background 0.3s',
                  }} />
                )}
              </div>
            );
          })}
        </div>

        <div style={{ minHeight: 320 }}>
          {steps[current].content}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
          {current > 0 && <Button onClick={() => setCurrent(current - 1)}>上一步</Button>}
          {current < steps.length - 1 && (
            <Button
              type="primary"
              onClick={() => {
                if (current === 0 && !selectedPackageId) { message.warning('请先选择 Redis 离线包'); return; }
                setCurrent(current + 1);
              }}
            >
              下一步
            </Button>
          )}
          {current === steps.length - 1 && (
            <Button type="primary" loading={submitting} onClick={handleSubmit} icon={<DeploymentUnitOutlined />}>
              创建集群
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
