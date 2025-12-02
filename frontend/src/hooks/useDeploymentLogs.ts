import { useState, useEffect, useRef } from 'react';
import type { DeploymentLog } from '../types';
import { message } from 'antd';

const API_BASE_URL = 'http://localhost:8080';

interface UseDeploymentLogsOptions {
  deploymentId: number;
  onComplete?: () => void;
  enabled?: boolean;
}

export const useDeploymentLogs = ({
  deploymentId,
  onComplete,
  enabled = true,
}: UseDeploymentLogsOptions) => {
  const [logs, setLogs] = useState<DeploymentLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled || !deploymentId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      message.error('未登录，无法连接日志流');
      return;
    }

    const url = `${API_BASE_URL}/api/v1/deployments/${deploymentId}/logs/stream?token=${token}`;

    // 创建 EventSource
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE 连接已建立');
      setIsConnected(true);
    };

    // 监听日志事件
    eventSource.addEventListener('log', (event) => {
      try {
        const log: DeploymentLog = JSON.parse(event.data);
        setLogs((prev) => {
          // 检查是否已存在（避免重复）
          const exists = prev.some(l => l.id === log.id);
          if (exists) {
            // 更新现有日志
            return prev.map(l => l.id === log.id ? log : l);
          }
          // 添加新日志
          return [...prev, log];
        });
      } catch (error) {
        console.error('解析日志数据失败:', error);
      }
    });

    // 监听完成事件
    eventSource.addEventListener('done', () => {
      console.log('部署完成');
      setIsDone(true);
      eventSource.close();
      setIsConnected(false);
      onComplete?.();
    });

    eventSource.onerror = (error) => {
      console.error('SSE 错误:', error);
      message.error('日志连接中断');
      eventSource.close();
      setIsConnected(false);
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        setIsConnected(false);
      }
    };
  }, [deploymentId, enabled, onComplete]);

  const disconnect = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsConnected(false);
    }
  };

  return {
    logs,
    isConnected,
    isDone,
    disconnect,
  };
};
