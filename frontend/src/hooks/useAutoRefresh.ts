import { useEffect, useRef } from 'react';

export interface UseAutoRefreshOptions {
  /** 刷新间隔（毫秒），默认 30000ms (30秒) */
  interval?: number;
  /** 是否启用自动刷新，默认 true */
  enabled?: boolean;
}

/**
 * 自动刷新 Hook
 * 定期执行回调函数，用于自动刷新数据
 *
 * @param callback 刷新回调函数
 * @param options 配置选项
 *
 * @example
 * useAutoRefresh(fetchData, { interval: 30000, enabled: true });
 */
export const useAutoRefresh = (
  callback: () => void,
  options: UseAutoRefreshOptions = {}
) => {
  const { interval = 30000, enabled = true } = options;
  const callbackRef = useRef(callback);

  // 更新 callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // 初始执行一次
    callbackRef.current();

    // 设置定时器
    const timer = setInterval(() => {
      callbackRef.current();
    }, interval);

    // 清理函数
    return () => {
      clearInterval(timer);
    };
  }, [interval, enabled]);
};
