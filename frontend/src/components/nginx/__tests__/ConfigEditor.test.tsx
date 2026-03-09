import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '../../../test/utils';
import ConfigEditor from '../ConfigEditor';
import * as nginxApi from '../../../api/nginx';
import * as certificateApi from '../../../api/certificate';

vi.mock('../../../api/nginx', () => ({
  getNginxConfigDetail: vi.fn(),
  createNginxConfig: vi.fn(),
  updateNginxConfig: vi.fn(),
  previewNginxConfig: vi.fn(),
}));

vi.mock('../../../api/certificate', () => ({
  getCertificateList: vi.fn(),
}));

describe('ConfigEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(certificateApi.getCertificateList).mockResolvedValue({
      certificates: [],
      total: 0,
      page: 1,
      page_size: 100,
    } as any);
  });

  it('does not call preview API without config name from preview section', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfigEditor onBack={vi.fn()} />);

    await user.click(screen.getByText('配置预览'));
    await user.click(screen.getAllByRole('button', { name: /生成预览/ })[0]);

    await waitFor(() => {
      expect(nginxApi.previewNginxConfig).not.toHaveBeenCalled();
    });

    expect(screen.getAllByText('基础设置').length).toBeGreaterThan(0);
  });
});
