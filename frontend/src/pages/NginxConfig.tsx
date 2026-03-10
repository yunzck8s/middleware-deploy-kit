import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Drawer,
  Input,
  message,
  Popconfirm,
  Skeleton,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  SendOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
  ClusterOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import {
  getNginxConfigList,
  deleteNginxConfig,
  generateNginxConfig,
} from '../api/nginx';
import type { NginxConfig, NginxConfigApply } from '../types';
import ApplyConfigModal from '../components/nginx/ApplyConfigModal';
import ApplyHistoryDrawer from '../components/nginx/ApplyHistoryDrawer';
import ConfigEditor from '../components/nginx/ConfigEditor';
import ConfigPreview from '../components/nginx/ConfigPreview';
import PageHeader from '../components/common/PageHeader';
import MetricTile from '../components/common/MetricTile';
import SectionCard from '../components/common/SectionCard';
import FilterToolbar from '../components/common/FilterToolbar';
import ActionGroup from '../components/common/ActionGroup';
import EmptyState from '../components/common/EmptyState';
import StatusBadge from '../components/common/StatusBadge';
import { formatDateTime } from '../utils/formatters';

const NginxConfigPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<NginxConfig[]>([]);
  const [total, setTotal] = useState(0);
  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [applyHistoryVisible, setApplyHistoryVisible] = useState(false);
  const [applyHistoryConfigId, setApplyHistoryConfigId] = useState<number | null>(null);
  const [selectedApplyId, setSelectedApplyId] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<'list' | 'edit' | 'create'>('list');
  const [editingConfigId, setEditingConfigId] = useState<number | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState('');

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const response = await getNginxConfigList({ page: 1, page_size: 100 });
      setConfigs(response.configs || []);
      setTotal(response.total || 0);
    } catch (error: any) {
      message.error(error.message || '暂时无法加载配置列表');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const filteredConfigs = useMemo(() => {
    if (!searchText) return configs;
    const lower = searchText.toLowerCase();
    return configs.filter((config) =>
      config.name.toLowerCase().includes(lower)
      || (config.description || '').toLowerCase().includes(lower)
      || (config.server_name || '').toLowerCase().includes(lower),
    );
  }, [configs, searchText]);

  const summary = useMemo(() => ({
    active: configs.filter((config) => config.status === 'active').length,
    draft: configs.filter((config) => config.status === 'draft').length,
    https: configs.filter((config) => config.enable_https).length,
  }), [configs]);

  const handleDelete = async (id: number) => {
    try {
      await deleteNginxConfig(id);
      message.success('配置已删除');
      loadConfigs();
    } catch (error: any) {
      message.error(error.message || '删除配置失败');
    }
  };

  const handleViewGenerated = async (id: number) => {
    try {
      setPreviewingId(id);
      const result = await generateNginxConfig(id);
      setPreviewContent(result.content);
      setPreviewVisible(true);
    } catch (error: any) {
      message.error(error.message || '生成预览失败');
    } finally {
      setPreviewingId(null);
    }
  };

  const handleApplyConfig = (id: number) => {
    setSelectedConfigId(id);
    setApplyModalVisible(true);
  };

  const handleOpenApplyHistory = (configId: number, applyId?: number | null) => {
    setApplyHistoryConfigId(configId);
    setSelectedApplyId(applyId ?? null);
    setApplyHistoryVisible(true);
  };

  const handleApplySuccess = (createdApply: NginxConfigApply) => {
    void loadConfigs();
    handleOpenApplyHistory(createdApply.nginx_config_id, createdApply.id);
  };

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

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Nginx 配置管理"
        title="配置管理"
        subtitle="按名称、状态和域名快速定位配置，并直接进入预览、编辑或应用流程。"
        actions={(
          <ActionGroup>
            <Button icon={<ReloadOutlined />} onClick={loadConfigs}>刷新</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingConfigId(null); setEditorMode('create'); }}>
              新建配置
            </Button>
          </ActionGroup>
        )}
      />

      <div className="metric-grid metric-grid--cols-4">
        <MetricTile label="配置总量" value={total} hint="当前保存的 Nginx 配置模板" icon={<ClusterOutlined />} loading={loading} />
        <MetricTile label="已启用" value={summary.active} hint="可直接应用到服务器的配置" icon={<GlobalOutlined />} tone="success" loading={loading} />
        <MetricTile label="草稿数" value={summary.draft} hint="仍在编辑和验证中的配置" icon={<EditOutlined />} tone="warning" loading={loading} />
        <MetricTile label="HTTPS 配置" value={summary.https} hint="已开启 HTTPS 监听的配置" icon={<SafetyCertificateOutlined />} tone="info" loading={loading} />
      </div>

      <SectionCard title="配置列表" subtitle="按名称、状态、域名和 HTTPS 能力浏览配置，并直接进入预览、编辑或应用。">
        <FilterToolbar
          left={(
            <Input
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              placeholder="搜索配置名称、描述或域名"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              style={{ width: 300 }}
              allowClear
            />
          )}
          right={<span className="summary-card__hint">建议按“预览 → 应用到服务器 → 编辑”的顺序操作</span>}
        />

        <div className="section-card__body">
          {loading ? (
            <Skeleton active paragraph={{ rows: 8 }} />
          ) : filteredConfigs.length === 0 ? (
            <EmptyState
              title="还没有 Nginx 配置"
              description="新建第一个配置后，你可以在工作台里编辑 Server、Location、TLS、缓存和安全规则。"
              action={<Button type="primary" icon={<PlusOutlined />} onClick={() => setEditorMode('create')}>新建第一个配置</Button>}
            />
          ) : (
            <div className="resource-card-grid">
              {filteredConfigs.map((config) => {
                const locationCount = config.locations?.length || 0;
                return (
                  <div key={config.id} className="resource-card">
                    <div className="resource-card__header">
                      <div>
                        <div className="resource-card__title">{config.name}</div>
                        <div className="resource-card__description">{config.description || '未填写说明'}</div>
                      </div>
                      <StatusBadge status={config.status} compact />
                    </div>

                    <div className="resource-card__tags" style={{ marginTop: 16 }}>
                      {config.enable_http && <StatusBadge status="valid" label={`HTTP ${config.http_port}`} compact />}
                      {config.enable_https && <StatusBadge status="valid" label={`HTTPS ${config.https_port}`} compact />}
                      <StatusBadge status="default" label={config.server_name || '_'} compact />
                      {locationCount > 0 && <StatusBadge status="info" label={`${locationCount} 条路由`} compact />}
                    </div>

                    <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                      <div className="summary-card" style={{ padding: 14 }}>
                        <div className="summary-card__label">最后更新</div>
                        <div className="summary-card__hint" style={{ marginTop: 6 }}>{formatDateTime(config.updated_at, 'YYYY-MM-DD HH:mm')}</div>
                      </div>
                    </div>

                    <div className="resource-card__footer">
                      <ActionGroup>
                        <Button type="text" icon={<EyeOutlined />} loading={previewingId === config.id} onClick={() => handleViewGenerated(config.id)}>
                          查看预览
                        </Button>
                        <Button type="text" icon={<SendOutlined />} onClick={() => handleApplyConfig(config.id)}>
                          应用到服务器
                        </Button>
                        <Button type="text" icon={<HistoryOutlined />} onClick={() => handleOpenApplyHistory(config.id)}>
                          应用记录
                        </Button>
                        <Button type="text" icon={<EditOutlined />} onClick={() => { setEditingConfigId(config.id); setEditorMode('edit'); }}>
                          继续编辑
                        </Button>
                      </ActionGroup>
                      <Popconfirm title={`删除配置“${config.name}”后，将不能再直接应用到服务器。确定删除吗？`} onConfirm={() => handleDelete(config.id)} okText="删除" cancelText="取消">
                        <Button type="text" danger icon={<DeleteOutlined />}>删除配置</Button>
                      </Popconfirm>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SectionCard>

      <Drawer title="配置预览" open={previewVisible} onClose={() => setPreviewVisible(false)} width={860}>
        <ConfigPreview content={previewContent} />
      </Drawer>

      {selectedConfigId && (
        <ApplyConfigModal
          configId={selectedConfigId}
          open={applyModalVisible}
          onClose={() => setApplyModalVisible(false)}
          onSuccess={handleApplySuccess}
        />
      )}

      <ApplyHistoryDrawer
        configId={applyHistoryConfigId}
        initialApplyId={selectedApplyId}
        open={applyHistoryVisible}
        onClose={() => {
          setApplyHistoryVisible(false);
          setApplyHistoryConfigId(null);
          setSelectedApplyId(null);
        }}
      />
    </div>
  );
};

export default NginxConfigPage;
