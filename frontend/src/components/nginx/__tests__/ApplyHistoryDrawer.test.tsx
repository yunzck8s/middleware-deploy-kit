import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/utils';
import ApplyHistoryDrawer from '../ApplyHistoryDrawer';
import * as nginxApi from '../../../api/nginx';

vi.mock('../../../api/nginx', () => ({
  getApplyHistory: vi.fn(),
  getApplyDetail: vi.fn(),
}));

describe('ApplyHistoryDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nginxApi.getApplyHistory).mockResolvedValue({
      applies: [
        {
          id: 9,
          nginx_config_id: 1,
          server_id: 2,
          target_path: '/etc/nginx/nginx.conf',
          backup_enabled: true,
          restart_service: true,
          service_name: 'nginx',
          status: 'success',
          duration: 12,
          created_at: '2026-03-09T09:00:00Z',
          updated_at: '2026-03-09T09:00:12Z',
          server: {
            id: 2,
            name: 'web-02',
            host: '10.0.0.2',
            port: 22,
            username: 'root',
            auth_type: 'password',
            os_type: 'rocky',
            os_version: '9.4',
            description: '',
            tags: '',
            status: 'online',
            last_check_at: null,
            last_check_msg: '',
            created_at: '',
            updated_at: '',
          },
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
    } as any);
    vi.mocked(nginxApi.getApplyDetail).mockResolvedValue({
      id: 9,
      nginx_config_id: 1,
      server_id: 2,
      target_path: '/etc/nginx/nginx.conf',
      backup_enabled: true,
      restart_service: true,
      service_name: 'nginx',
      status: 'success',
      duration: 12,
      created_at: '2026-03-09T09:00:00Z',
      updated_at: '2026-03-09T09:00:12Z',
      server: {
        id: 2,
        name: 'web-02',
        host: '10.0.0.2',
        port: 22,
        username: 'root',
        auth_type: 'password',
        os_type: 'rocky',
        os_version: '9.4',
        description: '',
        tags: '',
        status: 'online',
        last_check_at: null,
        last_check_msg: '',
        created_at: '',
        updated_at: '',
      },
      logs: [
        {
          id: 1,
          apply_id: 9,
          step: 1,
          action: '连接到目标服务器',
          status: 'success',
          output: 'SSH 连接建立成功',
          created_at: '2026-03-09T09:00:02Z',
          updated_at: '2026-03-09T09:00:02Z',
        },
      ],
    } as any);
  });

  it('loads apply history and detail content', async () => {
    renderWithProviders(
      <ApplyHistoryDrawer
        configId={1}
        initialApplyId={9}
        open
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(nginxApi.getApplyHistory).toHaveBeenCalledWith(1, { page: 1, page_size: 20 });
    });

    await waitFor(() => {
      expect(nginxApi.getApplyDetail).toHaveBeenCalledWith(9);
    });

    expect(await screen.findByText('最近应用记录')).toBeInTheDocument();
    expect(screen.getAllByText('web-02').length).toBeGreaterThan(0);
    expect(screen.getAllByText('/etc/nginx/nginx.conf').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/连接到目标服务器/).length).toBeGreaterThan(0);
  });
});
