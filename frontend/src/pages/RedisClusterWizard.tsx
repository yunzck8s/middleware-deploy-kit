import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Steps, Button, Form, Input, Select, InputNumber,
  Card, Row, Col, message, Space, Tag, Descriptions, Alert,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { getServerList } from '../api/server';
import { getPackageList } from '../api/package';
import { createCluster } from '../api/redisCluster';
import type { Server, MiddlewarePackage, CreateClusterDTO } from '../types';
import PageHeader from '../components/common/PageHeader';
import SectionCard from '../components/common/SectionCard';

const { Option } = Select;

export default function RedisClusterWizard() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [clusterMode, setClusterMode] = useState<'3x2' | '6x1'>('3x2');
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [packages, setPackages] = useState<MiddlewarePackage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // 节点配置状态
  const [nodeConfigs, setNodeConfigs] = useState<{ server_id: number | null; ports: number[] }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // 根据模式初始化节点配置
    if (clusterMode === '3x2') {
      setNodeConfigs([
        { server_id: null, ports: [7001, 7002] },
        { server_id: null, ports: [7001, 7002] },
        { server_id: null, ports: [7001, 7002] },
      ]);
    } else {
      setNodeConfigs([
        { server_id: null, ports: [7001] },
        { server_id: null, ports: [7001] },
        { server_id: null, ports: [7001] },
        { server_id: null, ports: [7001] },
        { server_id: null, ports: [7001] },
        { server_id: null, ports: [7001] },
      ]);
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
    setNodeConfigs((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 校验节点配置
      for (let i = 0; i < nodeConfigs.length; i++) {
        if (!nodeConfigs[i].server_id) {
          message.error(`请为第 ${i + 1} 组节点选择服务器`);
          return;
        }
        if (nodeConfigs[i].ports.length === 0) {
          message.error(`请为第 ${i + 1} 组节点配置端口`);
          return;
        }
      }

      if (!selectedPackageId) {
        message.error('请选择 Redis 离线包');
        return;
      }

      const dto: CreateClusterDTO = {
        name: values.name,
        cluster_mode: clusterMode,
        password: values.password || '',
        package_id: selectedPackageId,
        nodes: nodeConfigs.map((n) => ({
          server_id: n.server_id!,
          ports: n.ports,
        })),
      };

      setSubmitting(true);
      await createCluster(dto);
      message.success('集群创建成功');
      navigate('/middleware/redis/clusters');
    } catch (error: any) {
      if (error.message) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const usedServerIds = nodeConfigs.map((n) => n.server_id).filter(Boolean);

  const steps = [
    {
      title: '选择模式',
      content: (
        <div>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card
                hoverable
                style={{
                  border: clusterMode === '3x2' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                }}
                onClick={() => setClusterMode('3x2')}
              >
                <h3>3x2 模式</h3>
                <p style={{ color: 'var(--text-secondary)' }}>3 台服务器，每台 2 个端口</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>适合服务器数量有限的场景</p>
              </Card>
            </Col>
            <Col span={12}>
              <Card
                hoverable
                style={{
                  border: clusterMode === '6x1' ? '2px solid var(--color-primary)' : '1px solid var(--border-color)',
                  cursor: 'pointer',
                }}
                onClick={() => setClusterMode('6x1')}
              >
                <h3>6x1 模式</h3>
                <p style={{ color: 'var(--text-secondary)' }}>6 台服务器，每台 1 个端口</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>每台独立端口，推荐生产环境</p>
              </Card>
            </Col>
          </Row>

          <div style={{ marginBottom: 16 }}>
            <h4>选择 Redis 离线包</h4>
            <Select
              style={{ width: '100%' }}
              placeholder="选择已上传的 Redis 离线包"
              value={selectedPackageId}
              onChange={setSelectedPackageId}
            >
              {packages.filter((p) => p.status === 'active').map((p) => (
                <Option key={p.id} value={p.id}>
                  {p.display_name || `Redis ${p.version}`} - {p.os_type} {p.os_version}
                </Option>
              ))}
            </Select>
          </div>
        </div>
      ),
    },
    {
      title: '节点配置',
      content: (
        <div>
          <Form form={form} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="集群名称" name="name" rules={[{ required: true, message: '请输入集群名称' }]}>
                  <Input placeholder="例如: prod-redis-cluster" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="集群密码" name="password">
                  <Input.Password placeholder="留空则不设置密码" />
                </Form.Item>
              </Col>
            </Row>
          </Form>

          <h4 style={{ marginBottom: 12 }}>节点分配（共 {nodeConfigs.length} 组，{nodeConfigs.reduce((sum, n) => sum + n.ports.length, 0)} 个节点）</h4>

          {nodeConfigs.map((config, index) => (
            <Card
              key={index}
              size="small"
              title={`节点组 ${index + 1}`}
              style={{ marginBottom: 12 }}
            >
              <Row gutter={16} align="middle">
                <Col span={10}>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择服务器"
                    value={config.server_id}
                    onChange={(v) => updateNodeConfig(index, 'server_id', v)}
                  >
                    {servers.map((s) => (
                      <Option
                        key={s.id}
                        value={s.id}
                        disabled={clusterMode === '6x1' && usedServerIds.includes(s.id) && config.server_id !== s.id}
                      >
                        {s.name} ({s.host})
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={14}>
                  <Space wrap>
                    {config.ports.map((port, pi) => (
                      <Space key={pi} size={4}>
                        <InputNumber
                          min={1}
                          max={65535}
                          value={port}
                          onChange={(v) => {
                            const newPorts = [...config.ports];
                            newPorts[pi] = v || 7001;
                            updateNodeConfig(index, 'ports', newPorts);
                          }}
                          style={{ width: 100 }}
                        />
                        {config.ports.length > 1 && (
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                              const newPorts = config.ports.filter((_, i) => i !== pi);
                              updateNodeConfig(index, 'ports', newPorts);
                            }}
                          />
                        )}
                      </Space>
                    ))}
                    {clusterMode === '3x2' && config.ports.length < 2 && (
                      <Button
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => updateNodeConfig(index, 'ports', [...config.ports, 7002])}
                      >
                        添加端口
                      </Button>
                    )}
                  </Space>
                </Col>
              </Row>
            </Card>
          ))}
        </div>
      ),
    },
    {
      title: '确认创建',
      content: (
        <div>
          <Alert message="请确认以下集群配置信息无误后提交创建。" type="info" showIcon style={{ marginBottom: 16 }} />
          <Descriptions bordered column={2}>
            <Descriptions.Item label="集群名称">{form.getFieldValue('name') || '—'}</Descriptions.Item>
            <Descriptions.Item label="集群模式">
              <Tag color="blue">{clusterMode === '3x2' ? '3x2 (3台×2端口)' : '6x1 (6台×1端口)'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Redis 版本">{selectedPkg?.version || '—'}</Descriptions.Item>
            <Descriptions.Item label="离线包">{selectedPkg?.display_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="密码">{form.getFieldValue('password') ? '已设置' : '未设置'}</Descriptions.Item>
            <Descriptions.Item label="总节点数">6</Descriptions.Item>
          </Descriptions>

          <h4 style={{ margin: '16px 0 8px' }}>节点分配</h4>
          {nodeConfigs.map((config, index) => {
            const server = servers.find((s) => s.id === config.server_id);
            return (
              <div key={index} style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>
                节点组 {index + 1}: {server ? `${server.name} (${server.host})` : '未选择'} — 端口: {config.ports.join(', ')}
              </div>
            );
          })}
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Redis 集群"
        title="创建 Redis 集群"
        subtitle="配置 3 主 3 从的 Redis Cluster 集群"
        actions={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/middleware/redis/clusters')}>
            返回列表
          </Button>
        }
      />

      <SectionCard>
        <Steps current={current} items={steps.map((s) => ({ title: s.title }))} style={{ marginBottom: 24 }} />
        <div style={{ minHeight: 300 }}>{steps[current].content}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
          {current > 0 && <Button onClick={() => setCurrent(current - 1)}>上一步</Button>}
          {current < steps.length - 1 && (
            <Button
              type="primary"
              onClick={() => {
                if (current === 0 && !selectedPackageId) {
                  message.warning('请先选择 Redis 离线包');
                  return;
                }
                setCurrent(current + 1);
              }}
            >
              下一步
            </Button>
          )}
          {current === steps.length - 1 && (
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              创建集群
            </Button>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
