import { useState, useEffect, useRef } from 'react';
import type { DeploymentLog } from '../types';
import { message } from 'antd';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:9090/api/v1';
const STREAM_BASE_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

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
  const expectedCloseRef = useRef(false);
  const completedRef = useRef(false);

  useEffect(() => {
    setLogs([]);
    setIsConnected(false);
    setIsDone(false);
    completedRef.current = false;
    expectedCloseRef.current = false;

    if (!enabled || !deploymentId) {
      if (eventSourceRef.current) {
        expectedCloseRef.current = true;
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      message.error('未登录，无法连接日志流');
      return;
    }

    const url = `${STREAM_BASE_URL}/api/v1/deployments/${deploymentId}/logs/stream?token=${token}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (eventSourceRef.current !== eventSource) return;
      setIsConnected(true);
      expectedCloseRef.current = false;
    };

    eventSource.addEventListener('log', (event) => {
      if (eventSourceRef.current !== eventSource) return;
      try {
        const log: DeploymentLog = JSON.parse(event.data);
        setLogs((prev) => {
          const exists = prev.some((item) => item.id === log.id);
          if (exists) {
            return prev.map((item) => (item.id === log.id ? log : item));
          }
          return [...prev, log];
        });
      } catch (error) {
        console.error('解析日志数据失败:', error);
      }
    });

    eventSource.addEventListener('done', () => {
      if (eventSourceRef.current !== eventSource) return;
      completedRef.current = true;
      expectedCloseRef.current = true;
      setIsDone(true);
      setIsConnected(false);
      eventSource.close();
      eventSourceRef.current = null;
      onComplete?.();
    });

    eventSource.onerror = (error) => {
      if (eventSourceRef.current !== eventSource) return;
      const expected = expectedCloseRef.current || completedRef.current;
      console.error('SSE 错误:', error);
      eventSource.close();
      eventSourceRef.current = null;
      setIsConnected(false);
      if (!expected) {
        message.error('日志连接中断');
      }
    };

    return () => {
      expectedCloseRef.current = true;
      if (eventSourceRef.current === eventSource) {
        eventSource.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [deploymentId, enabled, onComplete]);

  const disconnect = () => {
    expectedCloseRef.current = true;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
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
