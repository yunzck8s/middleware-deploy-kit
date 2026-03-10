import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Button, message } from 'antd';
import { useDeploymentLogs } from '../useDeploymentLogs';

class MockEventSource {
  static instances: MockEventSource[] = [];

  onopen: (() => void) | null = null;
  onerror: ((error: Event) => void) | null = null;
  listeners: Record<string, Array<(event: MessageEvent) => void>> = {};
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }

  close() {}

  emit(type: string, data = '{}') {
    (this.listeners[type] || []).forEach((listener) => listener({ data } as MessageEvent));
  }
}

const HookProbe = ({
  deploymentId,
  enabled = true,
  onComplete,
}: {
  deploymentId: number;
  enabled?: boolean;
  onComplete?: () => void;
}) => {
  const { disconnect, isConnected, isDone } = useDeploymentLogs({ deploymentId, enabled, onComplete });

  return (
    <div>
      <span>{isConnected ? 'connected' : 'disconnected'}</span>
      <span>{isDone ? 'done' : 'running'}</span>
      <Button onClick={disconnect}>disconnect</Button>
    </div>
  );
};

describe('useDeploymentLogs', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.restoreAllMocks();
    localStorage.setItem('token', 'test-token');
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
  });

  it('does not report an error when disconnect is expected', async () => {
    const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => undefined as any);
    render(<HookProbe deploymentId={1} />);

    const instance = MockEventSource.instances[0];
    expect(instance.url).toContain('/api/v1/deployments/1/logs/stream');

    await act(async () => {
      screen.getByRole('button', { name: 'disconnect' }).click();
      instance.onerror?.(new Event('error'));
    });

    expect(errorSpy).not.toHaveBeenCalledWith('日志连接中断');
  });

  it('marks completion without reporting a disconnect error', async () => {
    const onComplete = vi.fn();
    const errorSpy = vi.spyOn(message, 'error').mockImplementation(() => undefined as any);
    render(<HookProbe deploymentId={2} onComplete={onComplete} />);

    const instance = MockEventSource.instances[0];

    await act(async () => {
      instance.emit('done');
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('done')).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalledWith('日志连接中断');
  });
});
