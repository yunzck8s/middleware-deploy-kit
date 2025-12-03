import { useState, useEffect } from 'react';

export type ViewMode = 'table' | 'card';

const STORAGE_KEY_PREFIX = 'viewMode_';

/**
 * 视图模式 Hook
 * 管理视图切换状态并保存到 localStorage
 *
 * @param storageKey 存储键名（会自动添加前缀）
 * @param defaultMode 默认视图模式
 */
export const useViewMode = (
  storageKey: string,
  defaultMode: ViewMode = 'table'
) => {
  const fullKey = STORAGE_KEY_PREFIX + storageKey;

  // 从 localStorage 读取初始值
  const getInitialMode = (): ViewMode => {
    try {
      const stored = localStorage.getItem(fullKey);
      if (stored === 'table' || stored === 'card') {
        return stored;
      }
    } catch (error) {
      console.error('Failed to read view mode from localStorage:', error);
    }
    return defaultMode;
  };

  const [viewMode, setViewMode] = useState<ViewMode>(getInitialMode);

  // 保存到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(fullKey, viewMode);
    } catch (error) {
      console.error('Failed to save view mode to localStorage:', error);
    }
  }, [viewMode, fullKey]);

  return {
    viewMode,
    setViewMode,
    isTableView: viewMode === 'table',
    isCardView: viewMode === 'card',
  };
};
