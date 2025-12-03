import type { DeploymentStatus } from '../types';

/**
 * 图表颜色配置
 */
export const CHART_COLORS = {
  primary: '#1890ff',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#1890ff',
  purple: '#722ed1',
  cyan: '#13c2c2',
  orange: '#fa8c16',
  green: '#3f8600',
  grey: '#d9d9d9',
};

/**
 * 部署状态颜色映射
 */
export const STATUS_COLORS: Record<DeploymentStatus, string> = {
  pending: CHART_COLORS.warning,
  running: CHART_COLORS.primary,
  success: CHART_COLORS.success,
  failed: CHART_COLORS.error,
  cancelled: CHART_COLORS.grey,
};

/**
 * 部署状态标签映射
 */
export const STATUS_LABELS: Record<DeploymentStatus, string> = {
  pending: '待执行',
  running: '进行中',
  success: '成功',
  failed: '失败',
  cancelled: '已取消',
};

/**
 * 图表默认配置
 */
export const DEFAULT_CHART_OPTIONS = {
  // 默认高度
  height: 400,

  // 默认网格配置
  grid: {
    left: '3%',
    right: '4%',
    bottom: '15%',
    containLabel: true,
  },

  // 默认工具提示配置
  tooltip: {
    trigger: 'axis' as const,
    axisPointer: {
      type: 'cross' as const,
    },
  },

  // 默认图例配置
  legend: {
    bottom: 10,
    left: 'center',
  },
};

/**
 * 折线图默认配置
 */
export const LINE_CHART_DEFAULT = {
  smooth: true,
  showArea: true,
  areaOpacity: 0.2,
};

/**
 * 饼图默认配置
 */
export const PIE_CHART_DEFAULT = {
  radius: ['40%', '70%'], // 环形饼图
  showPercentage: true,
};

/**
 * 柱状图默认配置
 */
export const BAR_CHART_DEFAULT = {
  barWidth: '60%',
  showValue: true,
};

/**
 * 主题色板（用于多系列图表）
 */
export const CHART_COLOR_PALETTE = [
  CHART_COLORS.primary,
  CHART_COLORS.success,
  CHART_COLORS.warning,
  CHART_COLORS.error,
  CHART_COLORS.purple,
  CHART_COLORS.cyan,
  CHART_COLORS.orange,
];
