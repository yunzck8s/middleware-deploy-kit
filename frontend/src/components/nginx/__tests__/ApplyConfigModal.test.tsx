import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../../test/utils';
import ApplyConfigModal from '../ApplyConfigModal';
import * as nginxApi from '../../../api/nginx';
import * as serverApi from '../../../api/server';

vi.mock('../../../api/nginx', () => ({
  getNginxDeployInfo: vi.fn(),
  applyNginxConfig: vi.fn(),
}));

vi.mock('../../../api/server', () => ({
  getServerList: vi.fn(),
}));

describe('ApplyConfigModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverApi.getServerList).mockResolvedValue({
      servers: [
        {
          id: 1,
          name: 'web-01',
          host: '10.0.0.1',
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
      ],
    } as any);
  });

  it('shows inferred defaults after selecting a server and hides advanced fields by default', async () => {
    const user = userEvent.setup();
    vi.mocked(nginxApi.getNginxDeployInfo).mockResolvedValue({
      found: false,
      target_path: '/usr/local/nginx/conf/nginx.conf',
      service_name: 'nginx',
    });

    renderWithProviders(
      <ApplyConfigModal configId={1} open onClose={vi.fn()} onSuccess={vi.fn()} />,
    );

    expect(screen.getByText('请选择一台服务器后，系统会自动读取默认配置路径和服务名。')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('web-01 (10.0.0.1) - 在线'));

    await waitFor(() => {
      expect(nginxApi.getNginxDeployInfo).toHaveBeenCalledWith(1);
    });

    expect(await screen.findByText('/usr/local/nginx/conf/nginx.conf')).toBeInTheDocument();
    expect(screen.getByText('nginx')).toBeInTheDocument();
    expect(screen.queryByLabelText('目标配置文件路径')).not.toBeInTheDocument();
  });

  it('submits inferred defaults without requiring custom fields', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();

    vi.mocked(nginxApi.getNginxDeployInfo).mockResolvedValue({
      found: true,
      target_path: '/custom/nginx/nginx.conf',
      service_name: 'openresty',
    });
    vi.mocked(nginxApi.applyNginxConfig).mockResolvedValue({
      id: 3,
      nginx_config_id: 1,
      server_id: 1,
      target_path: '/custom/nginx/nginx.conf',
      backup_enabled: true,
      restart_service: true,
      service_name: 'openresty',
      status: 'pending',
      duration: 0,
      created_at: '',
      updated_at: '',
    } as any);

    renderWithProviders(
      <ApplyConfigModal configId={1} open onClose={vi.fn()} onSuccess={onSuccess} />,
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('web-01 (10.0.0.1) - 在线'));
    const confirmButton = document.querySelector('.ant-modal-footer .ant-btn-primary');
    expect(confirmButton).toBeTruthy();
    fireEvent.click(confirmButton as HTMLButtonElement);

    await waitFor(() => {
      expect(nginxApi.applyNginxConfig).toHaveBeenCalledWith(1, {
        server_id: 1,
        target_path: '/custom/nginx/nginx.conf',
        backup_enabled: true,
        restart_service: true,
        service_name: 'openresty',
      });
    });

    expect(onSuccess).toHaveBeenCalled();
  });
});
