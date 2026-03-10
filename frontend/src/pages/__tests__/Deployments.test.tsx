import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import Deployments from '../Deployments';
import * as packageApi from '../../api/package';

vi.mock('../../api/deployment', () => ({
  getDeploymentList: vi.fn().mockResolvedValue({ deployments: [], total: 0, page: 1, page_size: 10 }),
  getDeploymentDetail: vi.fn(),
  createDeployment: vi.fn(),
  deleteDeployment: vi.fn(),
  executeDeployment: vi.fn(),
  getDeploymentLogs: vi.fn().mockResolvedValue([]),
  rollbackDeployment: vi.fn(),
  cancelDeployment: vi.fn(),
}));

vi.mock('../../api/server', () => ({
  getServerList: vi.fn().mockResolvedValue({ servers: [] }),
}));

vi.mock('../../api/package', () => ({
  getPackageList: vi.fn(),
  getPackageMetadata: vi.fn(),
}));

vi.mock('../../api/certificate', () => ({
  getCertificateList: vi.fn().mockResolvedValue({ certificates: [] }),
}));

vi.mock('../../hooks/useDeploymentLogs', () => ({
  useDeploymentLogs: () => ({
    logs: [],
    isConnected: false,
    disconnect: vi.fn(),
  }),
}));

describe('Deployments Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(packageApi.getPackageList).mockResolvedValue({
      packages: [],
      total: 0,
      page: 1,
      page_size: 100,
    });
  });

  it('requests nginx package resources only', async () => {
    renderWithProviders(<Deployments />);

    await waitFor(() => {
      expect(packageApi.getPackageList).toHaveBeenCalledWith({
        name: 'nginx',
        page: 1,
        page_size: 100,
      });
    });
  });
});
