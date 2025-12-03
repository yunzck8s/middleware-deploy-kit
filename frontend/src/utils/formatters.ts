import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

// 配置 dayjs
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
};

/**
 * 格式化时间（相对时间）
 */
export const formatRelativeTime = (dateString: string): string => {
  return dayjs(dateString).fromNow();
};

/**
 * 格式化完整时间
 */
export const formatDateTime = (
  dateString: string,
  format = 'YYYY-MM-DD HH:mm:ss'
): string => {
  return dayjs(dateString).format(format);
};

/**
 * 格式化日期
 */
export const formatDateOnly = (dateString: string): string => {
  return dayjs(dateString).format('YYYY-MM-DD');
};

/**
 * 格式化时间
 */
export const formatTimeOnly = (dateString: string): string => {
  return dayjs(dateString).format('HH:mm:ss');
};

/**
 * 格式化持续时间（秒转换为可读格式）
 */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}秒`;
  }

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}分${secs}秒` : `${minutes}分`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  let result = `${hours}小时`;
  if (minutes > 0) result += `${minutes}分`;
  if (secs > 0) result += `${secs}秒`;

  return result;
};

/**
 * 格式化百分比
 */
export const formatPercentage = (value: number, decimals = 0): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * 格式化数字（添加千分位）
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString('zh-CN');
};

/**
 * 截断长文本
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength)}...`;
};

/**
 * 格式化 IP 地址和端口
 */
export const formatHostPort = (host: string, port: number): string => {
  return `${host}:${port}`;
};

/**
 * 高亮关键词
 * 注意：此函数返回字符串，实际高亮需要在组件中实现
 */
export const highlightKeyword = (text: string, _keyword: string): string => {
  // 简化版本：直接返回原文本
  // 实际高亮需要在组件中使用 dangerouslySetInnerHTML 或其他方式实现
  return text;
};
