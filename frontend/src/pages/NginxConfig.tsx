import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  message,
  Popconfirm,
  Row,
  Col,
  Empty,
  Skeleton,
  Input,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  SendOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  getNginxConfigList,
  deleteNginxConfig,
  generateNginxConfig,
} from '../api/nginx';
import type { NginxConfig } from '../types';
import ApplyConfigModal from '../components/nginx/ApplyConfigModal';
import ConfigEditor from '../components/nginx/ConfigEditor';
import ConfigPreview from '../components/nginx/ConfigPreview';

const NginxConfigPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<NginxConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<'list' | 'edit' | 'create'>('list');
  const [editingConfigId, setEditingConfigId] = useState<number | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [searchText, setSearchText] = useState('');

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await getNginxConfigList({ page: 1, page_size: 100 });
      setConfigs(response.configs || []);
      setTotal(response.total);
    } catch (error: any) {
      message.error(error.message || '加载配置列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await deleteNginxConfig(id);
      message.success('删除成功');
      loadConfigs();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const handleViewGenerated = async (id: number) => {
    try {
      setPreviewing(true);
      const result = await generateNginxConfig(id);
      setPreviewContent(result.content);
      setPreviewVisible(true);
    } catch (error: any) {
      message.error(error.message || '生成配置失败');
    } finally {
      setPreviewing(false);
    }
  };

  const handleApplyConfig = (id: number) => {
    setSelectedConfigId(id);
    setApplyModalVisible(true);
  };

  const filteredConfigs = configs.filter((c) => {
    if (!searchText) return true;
    const lower = searchText.toLowerCase();
    return c.name.toLowerCase().includes(lower) || (c.description || '').toLowerCase().includes(lower);
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active': return { color: 'var(--color-success)', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'draft': return { color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)' };
      case 'disabled': return { color: 'var(--color-danger)', bg: 'rgba(239, 68, 68, 0.1)' };
      default: return { color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)' };
    }
  };

  // Editor view
  if (editorMode !== 'list') {
    return (
      <ConfigEditor
        configId={editingConfigId}
        onSave={() => loadConfigs()}
        onBack={() => {
          setEditorMode('list');
          setEditingConfigId(null);
          loadConfigs();
        }}
      />
    );
  }

  // List view
  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Nginx 配置管理</h2>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
            placeholder="搜索配置"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200, background: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}
            size="small"
            allowClear
          />
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadConfigs} size="small">
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            onClick={() => {
              setEditingConfigId(null);
              setEditorMode('create');
            }}
          >
            新建配置
          </Button>
        </Space>
      </div>

      {/* Config cards grid */}
      {loading ? (
        <Row gutter={[16, 16]}>
          {[1, 2, 3].map((i) => (
            <Col key={i} xs={24} sm={12} lg={8}>
              <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
                <Skeleton active paragraph={{ rows: 3 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : filteredConfigs.length === 0 ? (
        <Card style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
          <Empty
            description="暂无 Nginx 配置"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingConfigId(null);
                setEditorMode('create');
              }}
            >
              创建第一个配置
            </Button>
          </Empty>
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {filteredConfigs.map((config) => {
            const statusStyle = getStatusStyle(config.status);
            const locationCount = config.locations?.length || 0;
            return (
              <Col key={config.id} xs={24} sm={12} lg={8}>
                <div
                  className="mdk-card"
                  style={{ padding: 20, cursor: 'pointer' }}
                  onClick={() => {
                    setEditingConfigId(config.id);
                    setEditorMode('edit');
                  }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{config.name}</div>
                      {config.description && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{config.description}</div>
                      )}
                    </div>
                    <div
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 500,
                        color: statusStyle.color,
                        background: statusStyle.bg,
                      }}
                    >
                      {config.status === 'active' ? '已启用' : config.status === 'draft' ? '草稿' : '已禁用'}
                    </div>
                  </div>

                  {/* Config info */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {config.enable_http && (
                      <Tag style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                        HTTP:{config.http_port}
                      </Tag>
                    )}
                    {config.enable_https && (
                      <Tag color="green" style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                        HTTPS:{config.https_port}
                      </Tag>
                    )}
                    <Tag style={{ margin: 0, fontSize: 11 }}>
                      {config.server_name}
                    </Tag>
                    {locationCount > 0 && (
                      <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                        {locationCount} locations
                      </Tag>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      borderTop: '1px solid var(--border-color)',
                      paddingTop: 12,
                      marginTop: 4,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button type="text" icon={<EyeOutlined />} size="small" onClick={() => handleViewGenerated(config.id)} loading={previewing}>
                      查看
                    </Button>
                    <Button type="text" icon={<SendOutlined />} size="small" onClick={() => handleApplyConfig(config.id)}>
                      应用
                    </Button>
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      size="small"
                      onClick={() => {
                        setEditingConfigId(config.id);
                        setEditorMode('edit');
                      }}
                    >
                      编辑
                    </Button>
                    <Popconfirm
                      title="确定要删除这个配置吗？"
                      onConfirm={() => handleDelete(config.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button type="text" danger icon={<DeleteOutlined />} size="small">
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      )}

      {/* Total count */}
      {total > 0 && (
        <div style={{ textAlign: 'center', marginTop: 16, color: 'var(--text-tertiary)', fontSize: 12 }}>
          共 {total} 个配置
        </div>
      )}

      {/* Preview modal */}
      {previewVisible && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 40,
          }}
          onClick={() => setPreviewVisible(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 800,
              background: 'var(--bg-secondary)',
              borderRadius: 12,
              padding: 24,
              border: '1px solid var(--border-color)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ConfigPreview content={previewContent} />
            <div style={{ textAlign: 'right', marginTop: 16 }}>
              <Button onClick={() => setPreviewVisible(false)}>关闭</Button>
            </div>
          </div>
        </div>
      )}

      {/* Apply modal */}
      {selectedConfigId && (
        <ApplyConfigModal
          configId={selectedConfigId}
          open={applyModalVisible}
          onClose={() => setApplyModalVisible(false)}
          onSuccess={() => loadConfigs()}
        />
      )}
    </div>
  );
};

export default NginxConfigPage;
